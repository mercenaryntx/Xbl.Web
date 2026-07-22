using System.Data;
using System.Globalization;
using Dapper;
using Microsoft.Data.Sqlite;
using Xbl.Data;
using Xbl.Web.Models;

namespace Xbl.Web.Data;

// Deliberately independent of Xbl.Data.DatabaseContext: that type models one generic
// (Id, PartitionKey, UpdatedOn, Data JSON) blob table per entity, mirroring Xbox Live API
// payloads. Ratings/genres are a genuinely relational, many-to-many shape (a game can be in
// several genres, a genre has many games), so this context owns its own small schema instead.
public class RatingsContext : IRatingsContext
{
    private const string LastModifiedKey = "LastModified";
    private readonly string _connectionString;

    private const string CreateSchemaScript = """
        CREATE TABLE IF NOT EXISTS Rating (
            Source    TEXT NOT NULL,
            TitleId   TEXT NOT NULL,
            Value     INTEGER NOT NULL CHECK (Value BETWEEN 1 AND 10),
            UpdatedOn TEXT NOT NULL,
            PRIMARY KEY (Source, TitleId)
        );

        CREATE TABLE IF NOT EXISTS Genre (
            Id   INTEGER PRIMARY KEY AUTOINCREMENT,
            Name TEXT NOT NULL UNIQUE COLLATE NOCASE
        );

        CREATE TABLE IF NOT EXISTS GameGenre (
            GenreId INTEGER NOT NULL REFERENCES Genre(Id) ON DELETE CASCADE,
            Source  TEXT NOT NULL,
            TitleId TEXT NOT NULL,
            PRIMARY KEY (GenreId, Source, TitleId)
        );
        CREATE INDEX IF NOT EXISTS IX_GameGenre_Source_TitleId ON GameGenre(Source, TitleId);

        CREATE TABLE IF NOT EXISTS Meta (
            Key   TEXT PRIMARY KEY,
            Value TEXT NOT NULL
        );
        """;

    public RatingsContext(GlobalConfig globalConfig)
    {
        var dataFolder = ResolveDataFolder(globalConfig);
        Directory.CreateDirectory(dataFolder);
        _connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = Path.Combine(dataFolder, "ratings.db"),
            Mode = SqliteOpenMode.ReadWriteCreate
        }.ConnectionString;

        using var connection = CreateOpenConnection();
        connection.Execute(CreateSchemaScript);
    }

    // Azure App Service's zip-deploy replaces the whole site content directory on every deploy
    // (same reason live.db has to be re-seeded by the CI pipeline), so a relative "data" folder
    // isn't safe for anything the app itself needs to persist. %HOME% is backed by an Azure
    // Files share that survives deploys/restarts, so prefer it when running there; fall back to
    // the configured DataFolder everywhere else. Gate on WEBSITE_INSTANCE_ID (set only by Azure
    // App Service) rather than HOME alone - HOME is also set by Git Bash/WSL/CI runners on a dev
    // machine, which would otherwise send local runs to the wrong folder.
    private static string ResolveDataFolder(GlobalConfig globalConfig)
    {
        var isAzureAppService = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WEBSITE_INSTANCE_ID"));
        var home = Environment.GetEnvironmentVariable("HOME");
        return isAzureAppService && !string.IsNullOrEmpty(home)
            ? Path.Combine(home, "data")
            : globalConfig.DataFolder;
    }

    private IDbConnection CreateOpenConnection()
    {
        var connection = new SqliteConnection(_connectionString);
        connection.Open();
        connection.Execute("PRAGMA foreign_keys = ON;");
        return connection;
    }

    // SQLite's INTEGER storage class is always 64-bit, so Microsoft.Data.Sqlite reports it as
    // long/Int64 regardless of the declared column width. Dapper's constructor-based
    // materialization for records requires an exact type match to the reader's column type
    // (unlike its more lenient property-setter mapping for classes), so these must be `long`.
    private record RatingRow(string TitleId, long Value);

    public async Task<Dictionary<string, int>> GetRatingsMapAsync(string source, IEnumerable<string> titleIds = null)
    {
        var idList = titleIds?.ToList();
        if (idList is { Count: 0 }) return new Dictionary<string, int>();

        using var connection = CreateOpenConnection();
        var sql = "SELECT TitleId, Value FROM Rating WHERE Source = @Source";
        object param = new { Source = source };
        if (idList != null)
        {
            sql += " AND TitleId IN @TitleIds";
            param = new { Source = source, TitleIds = idList };
        }
        var rows = await connection.QueryAsync<RatingRow>(sql, param);
        return rows.ToDictionary(r => r.TitleId, r => (int)r.Value);
    }

    public async Task UpsertRatingAsync(string source, string titleId, int value)
    {
        if (value is < 1 or > 10)
            throw new ArgumentOutOfRangeException(nameof(value), "Rating must be between 1 and 10 (half-star units).");

        using var connection = CreateOpenConnection();
        using var transaction = connection.BeginTransaction();
        var now = DateTime.UtcNow.ToString("o");
        await connection.ExecuteAsync("""
            INSERT INTO Rating (Source, TitleId, Value, UpdatedOn) VALUES (@Source, @TitleId, @Value, @Now)
            ON CONFLICT (Source, TitleId) DO UPDATE SET Value = @Value, UpdatedOn = @Now
            """, new { Source = source, TitleId = titleId, Value = value, Now = now }, transaction);
        await TouchLastModifiedAsync(connection, transaction, now);
        transaction.Commit();
    }

    public async Task DeleteRatingAsync(string source, string titleId)
    {
        using var connection = CreateOpenConnection();
        using var transaction = connection.BeginTransaction();
        var now = DateTime.UtcNow.ToString("o");
        await connection.ExecuteAsync(
            "DELETE FROM Rating WHERE Source = @Source AND TitleId = @TitleId",
            new { Source = source, TitleId = titleId }, transaction);
        await TouchLastModifiedAsync(connection, transaction, now);
        transaction.Commit();
    }

    public async Task<IEnumerable<GenreSummary>> GetGenresAsync()
    {
        using var connection = CreateOpenConnection();
        return await connection.QueryAsync<GenreSummary>("""
            SELECT g.Id AS Id, g.Name AS Name, COUNT(gg.GenreId) AS GameCount
            FROM Genre g
            LEFT JOIN GameGenre gg ON gg.GenreId = g.Id
            GROUP BY g.Id, g.Name
            ORDER BY g.Name
            """);
    }

    public async Task<GenreRef> CreateOrGetGenreAsync(string name)
    {
        name = name?.Trim();
        if (string.IsNullOrEmpty(name)) throw new ArgumentException("Genre name is required.", nameof(name));

        using var connection = CreateOpenConnection();
        using var transaction = connection.BeginTransaction();
        var now = DateTime.UtcNow.ToString("o");
        await connection.ExecuteAsync(
            "INSERT INTO Genre (Name) VALUES (@Name) ON CONFLICT (Name) DO NOTHING",
            new { Name = name }, transaction);
        var genre = await connection.QuerySingleAsync<GenreRef>(
            "SELECT Id, Name FROM Genre WHERE Name = @Name", new { Name = name }, transaction);
        await TouchLastModifiedAsync(connection, transaction, now);
        transaction.Commit();
        return genre;
    }

    public async Task<GenreRef> RenameGenreAsync(int genreId, string name)
    {
        name = name?.Trim();
        if (string.IsNullOrEmpty(name)) throw new ArgumentException("Genre name is required.", nameof(name));

        using var connection = CreateOpenConnection();
        using var transaction = connection.BeginTransaction();
        var now = DateTime.UtcNow.ToString("o");
        int affected;
        try
        {
            affected = await connection.ExecuteAsync(
                "UPDATE Genre SET Name = @Name WHERE Id = @GenreId",
                new { Name = name, GenreId = genreId }, transaction);
        }
        catch (SqliteException ex) when (ex.SqliteErrorCode == 19) // SQLITE_CONSTRAINT (unique Name)
        {
            transaction.Rollback();
            throw new InvalidOperationException($"A genre named '{name}' already exists.");
        }

        if (affected == 0)
        {
            transaction.Rollback();
            return null;
        }

        await TouchLastModifiedAsync(connection, transaction, now);
        transaction.Commit();
        return new GenreRef { Id = genreId, Name = name };
    }

    public async Task DeleteGenreAsync(int genreId)
    {
        using var connection = CreateOpenConnection();
        using var transaction = connection.BeginTransaction();
        var now = DateTime.UtcNow.ToString("o");
        await connection.ExecuteAsync("DELETE FROM Genre WHERE Id = @GenreId", new { GenreId = genreId }, transaction);
        await TouchLastModifiedAsync(connection, transaction, now);
        transaction.Commit();
    }

    public async Task AssignGenreAsync(int genreId, string source, string titleId)
    {
        using var connection = CreateOpenConnection();
        using var transaction = connection.BeginTransaction();
        var now = DateTime.UtcNow.ToString("o");
        await connection.ExecuteAsync(
            "INSERT INTO GameGenre (GenreId, Source, TitleId) VALUES (@GenreId, @Source, @TitleId) ON CONFLICT (GenreId, Source, TitleId) DO NOTHING",
            new { GenreId = genreId, Source = source, TitleId = titleId }, transaction);
        await TouchLastModifiedAsync(connection, transaction, now);
        transaction.Commit();
    }

    public async Task UnassignGenreAsync(int genreId, string source, string titleId)
    {
        using var connection = CreateOpenConnection();
        using var transaction = connection.BeginTransaction();
        var now = DateTime.UtcNow.ToString("o");
        await connection.ExecuteAsync(
            "DELETE FROM GameGenre WHERE GenreId = @GenreId AND Source = @Source AND TitleId = @TitleId",
            new { GenreId = genreId, Source = source, TitleId = titleId }, transaction);
        await TouchLastModifiedAsync(connection, transaction, now);
        transaction.Commit();
    }

    private record GenreRow(string TitleId, long Id, string Name);

    public async Task<Dictionary<string, List<GenreRef>>> GetGenreMapAsync(string source, IEnumerable<string> titleIds = null)
    {
        var idList = titleIds?.ToList();
        if (idList is { Count: 0 }) return new Dictionary<string, List<GenreRef>>();

        using var connection = CreateOpenConnection();
        var sql = """
            SELECT gg.TitleId AS TitleId, g.Id AS Id, g.Name AS Name
            FROM GameGenre gg
            JOIN Genre g ON g.Id = gg.GenreId
            WHERE gg.Source = @Source
            """;
        object param = new { Source = source };
        if (idList != null)
        {
            sql += " AND gg.TitleId IN @TitleIds";
            param = new { Source = source, TitleIds = idList };
        }
        var rows = await connection.QueryAsync<GenreRow>(sql, param);
        return rows
            .GroupBy(r => r.TitleId)
            .ToDictionary(g => g.Key, g => g.Select(r => new GenreRef { Id = (int)r.Id, Name = r.Name }).ToList());
    }

    public async Task<HashSet<string>> GetTitleIdsByGenreAsync(string source, int genreId)
    {
        using var connection = CreateOpenConnection();
        var ids = await connection.QueryAsync<string>(
            "SELECT TitleId FROM GameGenre WHERE Source = @Source AND GenreId = @GenreId",
            new { Source = source, GenreId = genreId });
        return ids.ToHashSet();
    }

    public async Task<DateTime?> GetMaxUpdatedOnAsync()
    {
        using var connection = CreateOpenConnection();
        var value = await connection.QuerySingleOrDefaultAsync<string>(
            "SELECT Value FROM Meta WHERE Key = @Key", new { Key = LastModifiedKey });
        return value == null ? null : DateTime.Parse(value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind);
    }

    private static Task TouchLastModifiedAsync(IDbConnection connection, IDbTransaction transaction, string now)
    {
        return connection.ExecuteAsync(
            "INSERT INTO Meta (Key, Value) VALUES (@Key, @Now) ON CONFLICT (Key) DO UPDATE SET Value = @Now",
            new { Key = LastModifiedKey, Now = now }, transaction);
    }
}

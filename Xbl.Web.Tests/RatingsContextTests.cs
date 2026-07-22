using FluentAssertions;
using Microsoft.Data.Sqlite;
using Xbl.Data;
using Xbl.Web.Data;
using Xunit;

namespace Xbl.Web.Tests;

public class RatingsContextTests : IDisposable
{
    private readonly string _dataFolder;
    private readonly RatingsContext _sut;

    public RatingsContextTests()
    {
        _dataFolder = Path.Combine(Path.GetTempPath(), "ratings-tests-" + Guid.NewGuid());
        Directory.CreateDirectory(_dataFolder);
        _sut = new RatingsContext(new GlobalConfig { DataFolder = _dataFolder });
    }

    public void Dispose()
    {
        // Microsoft.Data.Sqlite pools native connections by connection string, so a pooled
        // handle can outlive an individual SqliteConnection.Dispose() and keep the file locked.
        SqliteConnection.ClearAllPools();
        Directory.Delete(_dataFolder, recursive: true);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(11)]
    [InlineData(-1)]
    public async Task UpsertRatingAsync_RejectsOutOfRangeValues(int value)
    {
        var act = () => _sut.UpsertRatingAsync("live", "123", value);
        await act.Should().ThrowAsync<ArgumentOutOfRangeException>();
    }

    [Theory]
    [InlineData(1)]
    [InlineData(10)]
    public async Task UpsertRatingAsync_AcceptsBoundaryValues(int value)
    {
        await _sut.UpsertRatingAsync("live", "123", value);

        var map = await _sut.GetRatingsMapAsync("live");

        map.Should().ContainKey("123").WhoseValue.Should().Be(value);
    }

    [Fact]
    public async Task UpsertRatingAsync_OverwritesExistingRating()
    {
        await _sut.UpsertRatingAsync("live", "123", 4);
        await _sut.UpsertRatingAsync("live", "123", 8);

        var map = await _sut.GetRatingsMapAsync("live");

        map["123"].Should().Be(8);
    }

    [Fact]
    public async Task GetRatingsMapAsync_ScopesBySource()
    {
        await _sut.UpsertRatingAsync("live", "123", 6);
        await _sut.UpsertRatingAsync("x360", "123", 2);

        (await _sut.GetRatingsMapAsync("live"))["123"].Should().Be(6);
        (await _sut.GetRatingsMapAsync("x360"))["123"].Should().Be(2);
    }

    [Fact]
    public async Task DeleteRatingAsync_RemovesRating()
    {
        await _sut.UpsertRatingAsync("live", "123", 6);

        await _sut.DeleteRatingAsync("live", "123");

        (await _sut.GetRatingsMapAsync("live")).Should().NotContainKey("123");
    }

    [Fact]
    public async Task CreateOrGetGenreAsync_DedupesCaseInsensitively()
    {
        var first = await _sut.CreateOrGetGenreAsync("Shooter");
        var second = await _sut.CreateOrGetGenreAsync("shooter");

        second.Id.Should().Be(first.Id);
        (await _sut.GetGenresAsync()).Should().ContainSingle();
    }

    [Fact]
    public async Task AssignGenreAsync_IsIdempotent()
    {
        var genre = await _sut.CreateOrGetGenreAsync("Shooter");

        await _sut.AssignGenreAsync(genre.Id, "live", "123");
        await _sut.AssignGenreAsync(genre.Id, "live", "123");

        var map = await _sut.GetGenreMapAsync("live", ["123"]);
        map["123"].Should().ContainSingle();
    }

    [Fact]
    public async Task UnassignGenreAsync_RemovesTheLink()
    {
        var genre = await _sut.CreateOrGetGenreAsync("Shooter");
        await _sut.AssignGenreAsync(genre.Id, "live", "123");

        await _sut.UnassignGenreAsync(genre.Id, "live", "123");

        (await _sut.GetGenreMapAsync("live", ["123"])).Should().BeEmpty();
    }

    [Fact]
    public async Task DeleteGenreAsync_CascadesGameGenreRows()
    {
        var genre = await _sut.CreateOrGetGenreAsync("Shooter");
        await _sut.AssignGenreAsync(genre.Id, "live", "123");

        await _sut.DeleteGenreAsync(genre.Id);

        (await _sut.GetGenreMapAsync("live", ["123"])).Should().BeEmpty();
        (await _sut.GetGenresAsync()).Should().BeEmpty();
    }

    [Fact]
    public async Task GetTitleIdsByGenreAsync_ScopesBySource()
    {
        var genre = await _sut.CreateOrGetGenreAsync("Shooter");
        await _sut.AssignGenreAsync(genre.Id, "live", "123");
        await _sut.AssignGenreAsync(genre.Id, "x360", "123");

        (await _sut.GetTitleIdsByGenreAsync("live", genre.Id)).Should().BeEquivalentTo(["123"]);
        (await _sut.GetTitleIdsByGenreAsync("live", genre.Id + 1)).Should().BeEmpty();
    }

    [Fact]
    public async Task GetMaxUpdatedOnAsync_IsNullUntilFirstMutationThenAdvances()
    {
        (await _sut.GetMaxUpdatedOnAsync()).Should().BeNull();

        await _sut.UpsertRatingAsync("live", "123", 6);
        var afterRating = await _sut.GetMaxUpdatedOnAsync();
        afterRating.Should().NotBeNull();

        await _sut.CreateOrGetGenreAsync("Shooter");
        var afterGenre = await _sut.GetMaxUpdatedOnAsync();
        afterGenre.Should().NotBeNull();
        afterGenre.Should().BeOnOrAfter(afterRating!.Value);
    }
}

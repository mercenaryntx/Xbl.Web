using AutoMapper;
using KustoLoco.Core;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Xbl.Client;
using Xbl.Client.Extensions;
using Xbl.Client.Models;
using Xbl.Client.Models.Kql;
using Xbl.Client.Models.Xbl.Achievements;
using Xbl.Client.Models.Xbl.Player;
using Xbl.Client.Queries;
using Xbl.Data;
using System.Collections.Immutable;

namespace Xbl.Web.Controllers;

[ApiController]
[Route("[controller]")]
public class QueriesController : ControllerBase
{
    private readonly IDatabaseContext _live;
    private readonly IDatabaseContext _x360;
    private readonly IMapper _mapper;
    private readonly ILogger<QueriesController> _logger;

    public QueriesController(
        [FromKeyedServices(DataSource.Live)] IDatabaseContext live,
        [FromKeyedServices(DataSource.Xbox360)] IDatabaseContext x360,
        IMapper mapper,
        ILogger<QueriesController> logger)
    {
        _live = live.Mandatory();
        _x360 = x360.Mandatory();
        _mapper = mapper;
        _logger = logger;
    }

    [HttpGet("built-in/{queryType}")]
    [ResponseCache(Duration = 3600)]
    public async Task<IActionResult> GetBuiltInQuery(string queryType, [FromQuery] int limit = 50)
    {
        try
        {
            var settings = new Settings { Limit = limit };
            var queries = new SqliteBuiltInQueries(settings, _live, _x360);

            object result = queryType.ToLower() switch
            {
                "summary" => await queries.Count(),
                "rarity" => await queries.RarestAchievements(),
                "completeness" => await queries.MostComplete(),
                "time" => await queries.SpentMostTimeWith(),
                "weighted-rarity" => TransformWeightedRarity(await queries.WeightedRarity()),
                "categories" => await queries.Categories(),
                _ => null
            };

            if (result == null)
                return BadRequest(new { error = "Unknown query type" });

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing built-in query: {QueryType}", queryType);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    private object TransformWeightedRarity(IEnumerable<WeightedAchievementItem> items)
    {
        return items.Select(w => new
        {
            title = w.Title,
            totalCount = w.TotalCount,
            achievedCount = w.AchievedCount,
            rareCount = w.RareCount,
            weight = w.Weight
        }).ToList();
    }

    [HttpPost("kusto")]
    public async Task<IActionResult> ExecuteKustoQuery([FromBody] KustoQueryRequest request)
    {
        const int DefaultPageSize = 100;
        const int MaxPageSize = 1000;
        
        try
        {
            // Validate and set pagination parameters
            var pageSize = request.PageSize > 0 && request.PageSize <= MaxPageSize 
                ? request.PageSize 
                : DefaultPageSize;
            var page = request.Page > 0 ? request.Page : 1;
            
            var context = new KustoQueryContext();

            var liveTitles = await _live.GetAll<Title>();
            var x360Titles = await _x360.GetAll<Title>();
            var titles = liveTitles.Concat(x360Titles).Select(_mapper.Map<KqlTitle>).ToImmutableArray();
            context.WrapDataIntoTable(DataTable.Titles, titles);

            var liveAchievements = await _live.GetAll<Achievement>();
            var x360Achievements = await _x360.GetAll<Achievement>();
            var achievements = liveAchievements.Concat(x360Achievements).Select(_mapper.Map<KqlAchievement>).ToImmutableArray();
            context.WrapDataIntoTable(DataTable.Achievements, achievements);

            var liveStats = await _live.GetAll<Stat>();
            var stats = liveStats.Select(_mapper.Map<KqlMinutesPlayed>).ToImmutableArray();
            context.WrapDataIntoTable(DataTable.Stats, stats);

            var result = await context.RunQuery(request.Query);
            
            if (!string.IsNullOrEmpty(result.Error))
            {
                return BadRequest(new { error = result.Error });
            }

            var columnDefs = result.ColumnDefinitions().ToList();
            var allRows = result.EnumerateRows().Select(row =>
            {
                var rowData = new List<object>();
                for (int i = 0; i < columnDefs.Count; i++)
                {
                    rowData.Add(row[i]);
                }
                return rowData;
            }).ToList();
            
            // Calculate pagination
            var totalRows = allRows.Count;
            var totalPages = (int)Math.Ceiling(totalRows / (double)pageSize);
            var skip = (page - 1) * pageSize;
            var pagedRows = allRows.Skip(skip).Take(pageSize).ToList();
            
            return Ok(new
            {
                columns = columnDefs.Select(c => new { name = c.Name }),
                rows = pagedRows,
                pagination = new
                {
                    currentPage = page,
                    pageSize = pageSize,
                    totalRows = totalRows,
                    totalPages = totalPages,
                    hasNextPage = page < totalPages,
                    hasPreviousPage = page > 1
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing Kusto query");
            return StatusCode(500, new { error = ex.Message });
        }
    }
}

public class KustoQueryRequest
{
    public string Query { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 100;
}

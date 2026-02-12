using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace Xbl.Web.Controllers;

[ApiController]
[Route("[controller]")]
public class SearchController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<SearchController> _logger;
    private readonly IConfiguration _configuration;

    public SearchController(IHttpClientFactory httpClientFactory, ILogger<SearchController> logger, IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _configuration = configuration;
    }

    [HttpGet("trueachievements")]
    [ResponseCache(Duration = 86400, VaryByQueryKeys = ["game", "achievement"])] // Cache for 24 hours per unique query
    public async Task<IActionResult> SearchTrueAchievements([FromQuery] string game, [FromQuery] string achievement)
    {
        if (string.IsNullOrWhiteSpace(game) || string.IsNullOrWhiteSpace(achievement))
        {
            return BadRequest(new { error = "Both 'game' and 'achievement' query parameters are required" });
        }

        // Check for Brave API key
        var braveApiKey = _configuration["BraveSearchApiKey"];
        
        if (!string.IsNullOrEmpty(braveApiKey))
        {
            // Use Brave Search API (2,000 free queries/month)
            return await SearchWithBraveApi(game, achievement, braveApiKey);
        }

        // Fallback: Return TrueAchievements search URL
        return GetFallbackUrl(game, achievement);
    }

    private async Task<IActionResult> SearchWithBraveApi(string game, string achievement, string apiKey)
    {
        try
        {
            var query = $"{achievement} achievement in {game} site:trueachievements.com";
            var httpClient = _httpClientFactory.CreateClient();
            httpClient.DefaultRequestHeaders.Add("X-Subscription-Token", apiKey);
            httpClient.DefaultRequestHeaders.Add("Accept", "application/json");

            var searchUrl = $"https://api.search.brave.com/res/v1/web/search?q={Uri.EscapeDataString(query)}&count=1";
            var response = await httpClient.GetStringAsync(searchUrl);
            
            var result = JsonDocument.Parse(response);
            if (result.RootElement.TryGetProperty("web", out var web) &&
                web.TryGetProperty("results", out var results) &&
                results.GetArrayLength() > 0)
            {
                var firstResult = results[0];
                if (firstResult.TryGetProperty("url", out var urlProperty))
                {
                    var url = urlProperty.GetString();
                    if (!string.IsNullOrEmpty(url) && url.Contains("trueachievements.com/a", StringComparison.OrdinalIgnoreCase))
                    {
                        _logger.LogInformation("Found TrueAchievements URL via Brave: {Url} for game: {Game}, achievement: {Achievement}", 
                            url, game, achievement);
                        return Ok(new { url });
                    }
                }
            }

            _logger.LogWarning("No TrueAchievements URL found via Brave for game: {Game}, achievement: {Achievement}", game, achievement);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching with Brave API for achievement: {Achievement} in game: {Game}", achievement, game);
        }

        return GetFallbackUrl(game, achievement);
    }

    private IActionResult GetFallbackUrl(string game, string achievement)
    {
        var fallbackQuery = $"{achievement} achievement in {game}";
        var fallbackUrl = $"https://www.trueachievements.com/searchresults.aspx?search={Uri.EscapeDataString(fallbackQuery)}";
        return Ok(new { url = fallbackUrl });
    }
}

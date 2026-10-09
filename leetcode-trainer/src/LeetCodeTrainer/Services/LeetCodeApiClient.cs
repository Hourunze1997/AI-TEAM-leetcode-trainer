using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using LeetCodeTrainer.Models;

namespace LeetCodeTrainer.Services;

/// <summary>GraphQL 接口异常。</summary>
public class LeetCodeApiException : Exception
{
    public LeetCodeApiException(string message) : base(message) { }
}

/// <summary>LeetCode GraphQL HTTP 客户端（System.Text.Json + HttpClient，无 API Key）。</summary>
public static class LeetCodeApiClient
{
    private const int PageSize = 50;

    private static bool IsCnSite() => string.Equals(SettingsService.Site, "cn", StringComparison.OrdinalIgnoreCase);

    private static string GetSiteBase() => IsCnSite() ? "https://leetcode.cn/" : "https://leetcode.com/";

    private static string GetGraphQlUrl() => GetSiteBase() + "graphql";

    /// <summary>按当前代理设置创建 HttpClient。</summary>
    public static HttpClient CreateClient()
    {
        var handler = new HttpClientHandler();
        var proxy = SettingsService.ProxyUrl;
        if (!string.IsNullOrWhiteSpace(proxy))
        {
            try
            {
                handler.Proxy = new WebProxy(proxy);
                handler.UseProxy = true;
            }
            catch
            {
                handler.UseProxy = false;
            }
        }
        var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(30) };
        client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) LeetCodeTrainer/1.0");
        client.DefaultRequestHeaders.TryAddWithoutValidation("Referer", GetSiteBase());
        client.DefaultRequestHeaders.TryAddWithoutValidation("Accept", "application/json");
        return client;
    }

    /// <summary>分页 50/次循环拉全量题库；cn 站标题取 translatedTitle。</summary>
    public static async Task<List<Question>> FetchQuestionListAsync(IProgress<SyncProgress>? progress, CancellationToken ct)
    {
        var isCn = IsCnSite();
        using var client = CreateClient();

        var all = new List<Question>();
        var total = 0;
        string? category = null;

        // 主选 all-code-essays（站内全量列表），失败回退 algorithms
        foreach (var cat in new[] { "all-code-essays", "algorithms" })
        {
            try
            {
                var page = await FetchPageAsync(client, cat, 0, isCn, ct);
                category = cat;
                total = page.Total;
                all.AddRange(page.Items);
                break;
            }
            catch (LeetCodeApiException) when (cat == "all-code-essays")
            {
                // 尝试备用 categorySlug
            }
        }

        if (category == null)
        {
            throw new InvalidOperationException("拉取题目列表失败：接口返回异常，请检查网络或代理设置。");
        }

        progress?.Report(new SyncProgress
        {
            Message = "正在同步题目",
            Current = all.Count,
            Total = Math.Max(total, all.Count)
        });

        var skip = all.Count;
        var guard = 0;
        while (all.Count < total && guard++ < 400)
        {
            ct.ThrowIfCancellationRequested();
            var page = await FetchPageAsync(client, category, skip, isCn, ct);
            if (page.Items.Count == 0) break;
            all.AddRange(page.Items);
            skip += page.Items.Count;
            progress?.Report(new SyncProgress { Message = "正在同步题目", Current = all.Count, Total = total });
        }

        return all;
    }

    /// <summary>拉单题题面 HTML 与 exampleTestcases。</summary>
    public static async Task<QuestionDetail> FetchQuestionDetailAsync(string slug)
    {
        var isCn = IsCnSite();
        using var client = CreateClient();
        var payload = new Dictionary<string, object?>
        {
            ["query"] = BuildDetailQuery(isCn),
            ["variables"] = new Dictionary<string, object?> { ["titleSlug"] = slug }
        };
        using var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        using var resp = await client.PostAsync(GetGraphQlUrl(), content);
        resp.EnsureSuccessStatusCode();
        var text = await resp.Content.ReadAsStringAsync();

        using var doc = JsonDocument.Parse(text);
        var root = doc.RootElement;
        ThrowIfGraphQLError(root);
        var question = root.GetProperty("data").GetProperty("question");

        var contentField = isCn ? "translatedContent" : "content";
        return new QuestionDetail
        {
            Slug = slug,
            ContentHtml = question.TryGetProperty(contentField, out var c) && c.ValueKind == JsonValueKind.String
                ? c.GetString() ?? ""
                : "",
            RawExamples = question.TryGetProperty("exampleTestcases", out var e) && e.ValueKind == JsonValueKind.String
                ? e.GetString() ?? ""
                : ""
        };
    }

    private static async Task<(int Total, List<Question> Items)> FetchPageAsync(
        HttpClient client, string categorySlug, int skip, bool isCn, CancellationToken ct)
    {
        var payload = new Dictionary<string, object?>
        {
            ["query"] = BuildListQuery(isCn),
            ["variables"] = new Dictionary<string, object?>
            {
                ["categorySlug"] = categorySlug,
                ["limit"] = PageSize,
                ["skip"] = skip,
                ["filters"] = new Dictionary<string, object?>()
            }
        };
        using var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        using var resp = await client.PostAsync(GetGraphQlUrl(), content, ct);
        resp.EnsureSuccessStatusCode();
        var text = await resp.Content.ReadAsStringAsync(ct);
        return ParseListResponse(text, isCn);
    }

    private static (int Total, List<Question> Items) ParseListResponse(string json, bool isCn)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        ThrowIfGraphQLError(root);

        var data = root.GetProperty("data");
        if (!data.TryGetProperty("problemsetQuestionList", out var ps))
        {
            throw new LeetCodeApiException("接口返回数据缺少 problemsetQuestionList");
        }

        var total = 0;
        if (ps.TryGetProperty("total", out var totalEl) && totalEl.TryGetInt32(out var t)) total = t;

        var list = new List<Question>();
        if (ps.TryGetProperty("questions", out var qs) && qs.ValueKind == JsonValueKind.Array)
        {
            foreach (var q in qs.EnumerateArray())
            {
                try
                {
                    var slug = q.TryGetProperty("titleSlug", out var slugEl) ? slugEl.GetString() ?? "" : "";
                    if (string.IsNullOrEmpty(slug)) continue;

                    var title = q.TryGetProperty("title", out var titleEl) ? titleEl.GetString() ?? "" : "";
                    if (isCn && q.TryGetProperty("translatedTitle", out var ttEl) && ttEl.ValueKind == JsonValueKind.String)
                    {
                        var translated = ttEl.GetString();
                        if (!string.IsNullOrEmpty(translated)) title = translated!;
                    }

                    var frontendId = 0;
                    if (q.TryGetProperty("frontendQuestionId", out var fidEl))
                    {
                        int.TryParse(fidEl.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out frontendId);
                    }

                    var difficulty = NormalizeDifficulty(
                        q.TryGetProperty("difficulty", out var diffEl) ? diffEl.GetString() : null);

                    var tags = "";
                    if (q.TryGetProperty("topicTags", out var tagsEl) && tagsEl.ValueKind == JsonValueKind.Array)
                    {
                        tags = string.Join(",", tagsEl.EnumerateArray()
                            .Where(x => x.TryGetProperty("name", out _))
                            .Select(x => x.GetProperty("name").GetString() ?? ""));
                    }

                    var isPaid = q.TryGetProperty("isPaidOnly", out var paidEl) && paidEl.ValueKind == JsonValueKind.True;

                    var acRate = 0.0;
                    if (q.TryGetProperty("stats", out var statsEl) && statsEl.ValueKind == JsonValueKind.String)
                    {
                        try
                        {
                            using var stats = JsonDocument.Parse(statsEl.GetString() ?? "{}");
                            if (stats.RootElement.TryGetProperty("acRate", out var rateEl) && rateEl.TryGetDouble(out var r))
                            {
                                acRate = r;
                            }
                        }
                        catch
                        {
                            // stats 解析失败时通过率置 0
                        }
                    }

                    list.Add(new Question
                    {
                        FrontendId = frontendId,
                        Title = title,
                        TitleSlug = slug,
                        Difficulty = difficulty,
                        Tags = tags,
                        AcceptanceRate = acRate,
                        IsPaid = isPaid
                    });
                }
                catch
                {
                    // 单条解析失败跳过并继续
                }
            }
        }
        return (total, list);
    }

    private static void ThrowIfGraphQLError(JsonElement root)
    {
        if (root.TryGetProperty("errors", out var errors)
            && errors.ValueKind == JsonValueKind.Array
            && errors.GetArrayLength() > 0)
        {
            var message = errors[0].TryGetProperty("message", out var m) ? m.GetString() : null;
            throw new LeetCodeApiException(message ?? "GraphQL 请求返回错误");
        }
    }

    private static string NormalizeDifficulty(string? raw)
    {
        var d = (raw ?? "").Trim().ToLowerInvariant();
        return d switch
        {
            "easy" or "简单" => "Easy",
            "medium" or "中等" => "Medium",
            "hard" or "困难" => "Hard",
            _ => (raw ?? "").Trim()
        };
    }

    private static string BuildListQuery(bool isCn)
    {
        var titleField = isCn ? "title\n      translatedTitle" : "title";
        return $@"query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {{
  problemsetQuestionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {{
    total: totalNum
    questions: data {{
      acRate
      difficulty
      frontendQuestionId: questionFrontendId
      {titleField}
      titleSlug
      isPaidOnly
      topicTags {{ name }}
      stats
    }}
  }}
}}";
    }

    private static string BuildDetailQuery(bool isCn)
    {
        var contentField = isCn ? "translatedContent" : "content";
        return $@"query questionDetail($titleSlug: String!) {{
  question(titleSlug: $titleSlug) {{
    questionFrontendId
    title
    titleSlug
    difficulty
    {contentField}
    exampleTestcases
  }}
}}";
    }
}

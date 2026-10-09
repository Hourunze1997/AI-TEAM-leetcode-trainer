using LeetCodeTrainer.Data;
using LeetCodeTrainer.Models;

namespace LeetCodeTrainer.Services;

/// <summary>同步编排：全量拉题落库 + 题面/用例懒加载缓存。</summary>
public static class SyncService
{
    /// <summary>全量同步：拉题库 -> UpsertMany 落库（后台线程执行，进度经 IProgress 回 UI）。</summary>
    public static async Task SyncAllAsync(IProgress<SyncProgress>? progress, CancellationToken ct = default)
    {
        await Task.Run(async () =>
        {
            var questions = await LeetCodeApiClient.FetchQuestionListAsync(progress, ct);
            if (questions.Count == 0)
            {
                throw new InvalidOperationException("未获取到题目数据，请检查网络/代理设置后重试。");
            }
            progress?.Report(new SyncProgress { Message = "正在写入本地数据库…", Current = 0, Total = questions.Count });
            QuestionRepository.UpsertMany(questions);
            progress?.Report(new SyncProgress
            {
                Message = $"同步完成，共 {questions.Count} 题",
                Current = questions.Count,
                Total = questions.Count
            });
        }, ct);
    }

    /// <summary>详情懒加载：已缓存直接返回；未缓存则请求题面、解析用例并写入缓存（离线可看）。</summary>
    public static async Task<Question> EnsureDetailLoadedAsync(Question question)
    {
        if (question == null) throw new ArgumentNullException(nameof(question));
        if (!string.IsNullOrEmpty(question.ContentHtml)) return question;

        var detail = await LeetCodeApiClient.FetchQuestionDetailAsync(question.TitleSlug);
        var html = detail.ContentHtml ?? string.Empty;

        var cases = TestCaseParser.ParseFromContent(html);
        if (cases.Count == 0)
        {
            cases = TestCaseParser.ParseFromExampleTestcases(detail.RawExamples ?? string.Empty);
        }
        foreach (var c in cases)
        {
            c.QuestionSlug = question.TitleSlug;
        }

        TestCaseRepository.ReplaceForSlug(question.TitleSlug, cases);
        QuestionRepository.UpdateDetailCache(question.TitleSlug, html, detail.RawExamples ?? string.Empty);

        question.ContentHtml = html;
        question.RawExamples = detail.RawExamples ?? string.Empty;
        question.SyncedAt = DateTime.Now;
        return question;
    }
}

using LeetCodeTrainer.Data;
using LeetCodeTrainer.Models;

namespace LeetCodeTrainer.Services;

/// <summary>统计服务：总览 / 30 天趋势 / 连续打卡 / 收藏。</summary>
public static class StatisticsService
{
    public static StatsOverview GetOverview()
    {
        var overview = new StatsOverview
        {
            TotalQuestions = QuestionRepository.CountAll(),
            SolvedCount = QuestionRepository.CountByStatus(QuestionStatus.Solved)
        };
        foreach (var difficulty in new[] { "Easy", "Medium", "Hard" })
        {
            var total = QuestionRepository.CountByDifficulty(difficulty);
            var solved = QuestionRepository.CountSolvedByDifficulty(difficulty);
            overview.ByDifficulty.Add(new DifficultyStat
            {
                Difficulty = difficulty,
                Total = total,
                Solved = solved,
                Rate = total == 0 ? 0 : Math.Round(solved * 100.0 / total, 1)
            });
        }
        return overview;
    }

    /// <summary>近 30 天每日去重完成题数（补齐空日期）。</summary>
    public static List<DailyCount> GetTrend30Days()
    {
        var counts = RunRecordRepository.GetDailySuccessCounts(30);
        var map = counts.ToDictionary(c => c.Date.Date, c => c.Count);
        var list = new List<DailyCount>(30);
        for (var i = 29; i >= 0; i--)
        {
            var date = DateTime.Today.AddDays(-i);
            list.Add(new DailyCount { Date = date, Count = map.TryGetValue(date, out var c) ? c : 0 });
        }
        return list;
    }

    /// <summary>连续打卡：自今日（无记录则从昨天）起向前连续有成功记录的天数。</summary>
    public static int GetStreak()
    {
        var dates = new HashSet<DateTime>(RunRecordRepository.GetSuccessDates().Select(d => d.Date));
        var day = DateTime.Today;
        if (!dates.Contains(day)) day = day.AddDays(-1);
        var streak = 0;
        while (dates.Contains(day))
        {
            streak++;
            day = day.AddDays(-1);
        }
        return streak;
    }

    public static List<Question> GetFavorites() => QuestionRepository.GetFavorites();
}

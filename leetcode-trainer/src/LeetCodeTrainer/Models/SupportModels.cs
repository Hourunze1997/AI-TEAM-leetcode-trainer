namespace LeetCodeTrainer.Models;

/// <summary>题目列表筛选条件。</summary>
public class QuestionFilter
{
    public string? Search { get; set; }
    public string? Difficulty { get; set; }
    public string? Tag { get; set; }
    public string? Status { get; set; }
    public bool HidePaid { get; set; }
}

/// <summary>单题详情（题面 HTML + 示例用例原始串）。</summary>
public class QuestionDetail
{
    public string Slug { get; set; } = "";
    public string ContentHtml { get; set; } = "";
    public string RawExamples { get; set; } = "";
}

/// <summary>单难度统计。</summary>
public class DifficultyStat
{
    public string Difficulty { get; set; } = "";
    public int Total { get; set; }
    public int Solved { get; set; }
    public double Rate { get; set; }
}

/// <summary>统计总览。</summary>
public class StatsOverview
{
    public int TotalQuestions { get; set; }
    public int SolvedCount { get; set; }
    public List<DifficultyStat> ByDifficulty { get; set; } = new();
}

/// <summary>每日计数（近 N 天趋势）。</summary>
public class DailyCount
{
    public DateTime Date { get; set; }
    public int Count { get; set; }
}

/// <summary>同步/运行进度（IProgress 载体）。</summary>
public class SyncProgress
{
    public string Message { get; set; } = "";
    public int Current { get; set; }
    public int Total { get; set; }
}

/// <summary>单用例运行明细（CodeRunnerService 产出，供详情页展示）。</summary>
public class CaseRunDetail
{
    public int Index { get; set; }
    public string Input { get; set; } = "";
    public string Expected { get; set; } = "";
    public string Actual { get; set; } = "null";
    public bool Passed { get; set; }
    public double ElapsedMs { get; set; }
    public string Error { get; set; } = "";
    public string Stdout { get; set; } = "";
    public string Stderr { get; set; } = "";
}

/// <summary>用例结果展示 VM（绑定用）。</summary>
public class CaseResultVm
{
    public CaseResultVm() { }

    public CaseResultVm(CaseRunDetail detail)
    {
        Index = detail.Index;
        Input = detail.Input;
        Expected = detail.Expected;
        Actual = detail.Actual;
        Passed = detail.Passed;
        ElapsedMs = detail.ElapsedMs;
        Error = detail.Error;
        Stdout = detail.Stdout;
    }

    public int Index { get; set; }
    public string Input { get; set; } = "";
    public string Expected { get; set; } = "";
    public string Actual { get; set; } = "";
    public bool Passed { get; set; }
    public double ElapsedMs { get; set; }
    public string Error { get; set; } = "";
    public string Stdout { get; set; } = "";
}

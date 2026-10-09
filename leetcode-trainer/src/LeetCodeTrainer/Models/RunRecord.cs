namespace LeetCodeTrainer.Models;

/// <summary>运行记录实体。CaseDetails 仅在内存中用于展示明细，不落库。</summary>
public class RunRecord
{
    public int Id { get; set; }
    public string QuestionSlug { get; set; } = "";
    public int PassedCount { get; set; }
    public int TotalCount { get; set; }
    public bool Success { get; set; }
    public string Stdout { get; set; } = "";
    public string Stderr { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public List<CaseRunDetail> CaseDetails { get; set; } = new();
}

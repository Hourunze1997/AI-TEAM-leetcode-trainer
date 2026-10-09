namespace LeetCodeTrainer.Models;

/// <summary>代码草稿实体（每题一份）。</summary>
public class CodeDraft
{
    public int Id { get; set; }
    public string QuestionSlug { get; set; } = "";
    public string Code { get; set; } = "";
    public DateTime UpdatedAt { get; set; }
}

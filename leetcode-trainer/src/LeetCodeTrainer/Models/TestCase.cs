namespace LeetCodeTrainer.Models;

/// <summary>测试用例实体：Input 规整为单行 k=v 串。</summary>
public class TestCase
{
    public int Id { get; set; }
    public string QuestionSlug { get; set; } = "";
    public string Input { get; set; } = "";
    public string ExpectedOutput { get; set; } = "";
}

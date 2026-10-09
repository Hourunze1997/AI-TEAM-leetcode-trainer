using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using LeetCodeTrainer.Models;

namespace LeetCodeTrainer.Services;

/// <summary>测试用例静态解析器：优先题面 HTML 的 Input:/Output:，备选 exampleTestcases 启发式切分。</summary>
public static class TestCaseParser
{
    private static readonly Regex PreRegex =
        new("<pre[^>]*>(.*?)</pre>", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.Singleline);

    private static readonly Regex TagRegex = new("<[^>]*>", RegexOptions.Compiled);

    private static readonly Regex IoRegex =
        new("Input:\\s*(.*?)\\s*Output:\\s*(.*?)(?:\\s*Explanation:|\\s*Follow[- ]?up:|$)",
            RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.Singleline);

    private static readonly Regex ParamStartRegex = new("^\\s*([A-Za-z_]\\w*)\\s*=", RegexOptions.Compiled);

    /// <summary>从题面 HTML 的 &lt;pre&gt; 块解析 Input:/Output: 用例；解析失败的用例跳过。</summary>
    public static List<TestCase> ParseFromContent(string html)
    {
        var list = new List<TestCase>();
        if (string.IsNullOrWhiteSpace(html)) return list;

        foreach (Match m in PreRegex.Matches(html))
        {
            var text = WebUtility.HtmlDecode(TagRegex.Replace(m.Groups[1].Value, " "));
            var io = IoRegex.Match(text);
            if (!io.Success) continue;

            try
            {
                var input = ParseInputLine(io.Groups[1].Value);
                var output = NormalizeWhitespace(io.Groups[2].Value);
                if (string.IsNullOrWhiteSpace(input)) continue;
                list.Add(new TestCase { Input = input, ExpectedOutput = output });
            }
            catch
            {
                // 解析失败的用例跳过并继续
            }
        }
        return list;
    }

    /// <summary>exampleTestcases 启发式切分：行首 param = 且参数名与当前用例首参数相同时判为新用例边界。</summary>
    public static List<TestCase> ParseFromExampleTestcases(string raw)
    {
        var list = new List<TestCase>();
        if (string.IsNullOrWhiteSpace(raw)) return list;

        var text = raw.Trim();

        // 兼容 JSON 数组 / 双重编码 JSON 字符串两种格式
        if (text.StartsWith("["))
        {
            try
            {
                var arr = System.Text.Json.JsonSerializer.Deserialize<List<string>>(text);
                if (arr is { Count: > 0 }) text = string.Join("\n", arr);
            }
            catch { /* 按原文处理 */ }
        }
        else if (text.StartsWith("\""))
        {
            try
            {
                text = System.Text.Json.JsonSerializer.Deserialize<string>(text) ?? text;
            }
            catch { /* 按原文处理 */ }
        }

        var lines = text.Replace("\r\n", "\n").Replace("\r", "\n").Split('\n');
        var current = new List<string>();
        var cases = new List<string>();
        string? firstName = null;

        void Flush()
        {
            if (current.Count > 0)
            {
                cases.Add(string.Join(" ", current));
                current.Clear();
            }
        }

        foreach (var line in lines)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            var m = ParamStartRegex.Match(line);
            var name = m.Success ? m.Groups[1].Value : null;

            if (name != null && firstName != null && current.Count > 0 && string.Equals(name, firstName, StringComparison.Ordinal))
            {
                Flush();
                firstName = name;
                current.Add(line.Trim());
            }
            else
            {
                firstName ??= name;
                current.Add(line.Trim());
            }
        }
        Flush();

        foreach (var c in cases)
        {
            try
            {
                var input = ParseInputLine(c);
                if (!string.IsNullOrWhiteSpace(input))
                {
                    list.Add(new TestCase { Input = input, ExpectedOutput = "" });
                }
            }
            catch
            {
                // 跳过无法解析的片段
            }
        }
        return list;
    }

    /// <summary>把 'nums = [2,7,11,15], target = 9' 规整为单行 'nums=[2,7,11,15], target=9'。</summary>
    public static string ParseInputLine(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return "";
        var folded = NormalizeWhitespace(input);
        var pairs = new List<string>();
        foreach (var part in SplitTopLevel(folded, ','))
        {
            var p = part.Trim();
            if (p.Length == 0) continue;
            var eq = FindTopLevelEquals(p);
            if (eq <= 0) continue; // 无法识别的片段跳过
            var name = p[..eq].Trim();
            var value = p[(eq + 1)..].Trim();
            if (name.Length == 0 || value.Length == 0) continue;
            pairs.Add(name + "=" + value);
        }
        return string.Join(", ", pairs);
    }

    /// <summary>引号感知的空白折叠：换行/连续空白折叠为单空格，括号/逗号附近不加空格。</summary>
    public static string NormalizeWhitespace(string text)
    {
        if (string.IsNullOrEmpty(text)) return "";
        var sb = new StringBuilder(text.Length);
        var inString = false;
        var quote = '\0';
        var escaped = false;
        var pendingSpace = false;

        foreach (var ch in text)
        {
            if (inString)
            {
                sb.Append(ch);
                if (escaped) escaped = false;
                else if (ch == '\\') escaped = true;
                else if (ch == quote) inString = false;
                continue;
            }
            if (ch == '"' || ch == '\'')
            {
                inString = true;
                quote = ch;
                pendingSpace = false;
                sb.Append(ch);
                continue;
            }
            if (char.IsWhiteSpace(ch))
            {
                pendingSpace = true;
                continue;
            }
            if (pendingSpace && sb.Length > 0 && NeedSpaceBefore(sb[^1], ch))
            {
                sb.Append(' ');
            }
            pendingSpace = false;
            sb.Append(ch);
        }
        return sb.ToString().Trim();
    }

    private static bool NeedSpaceBefore(char prev, char next)
    {
        if (prev == '(' || prev == '[' || prev == '{' || prev == ',') return false;
        if (next == ')' || next == ']' || next == '}' || next == ',' || next == ':') return false;
        return true;
    }

    /// <summary>括号/引号感知的顶层分隔切分。</summary>
    private static List<string> SplitTopLevel(string text, char separator = ',')
    {
        var parts = new List<string>();
        var buf = new StringBuilder();
        var depth = 0;
        var inString = false;
        var quote = '\0';
        var escaped = false;

        foreach (var ch in text)
        {
            if (inString)
            {
                buf.Append(ch);
                if (escaped) escaped = false;
                else if (ch == '\\') escaped = true;
                else if (ch == quote) inString = false;
                continue;
            }
            if (ch == '"' || ch == '\'')
            {
                inString = true;
                quote = ch;
                buf.Append(ch);
                continue;
            }
            if (ch == '[' || ch == '{' || ch == '(') depth++;
            else if (ch == ']' || ch == '}' || ch == ')') depth = Math.Max(0, depth - 1);

            if (ch == separator && depth == 0)
            {
                parts.Add(buf.ToString());
                buf.Clear();
            }
            else
            {
                buf.Append(ch);
            }
        }
        if (buf.Length > 0 || parts.Count > 0) parts.Add(buf.ToString());
        return parts;
    }

    /// <summary>找第一个顶层（括号外、引号外、非比较运算）的 '='。</summary>
    private static int FindTopLevelEquals(string s)
    {
        var depth = 0;
        var inString = false;
        var quote = '\0';
        var escaped = false;

        for (var i = 0; i < s.Length; i++)
        {
            var c = s[i];
            if (inString)
            {
                if (escaped) escaped = false;
                else if (c == '\\') escaped = true;
                else if (c == quote) inString = false;
                continue;
            }
            if (c == '"' || c == '\'')
            {
                inString = true;
                quote = c;
                continue;
            }
            if (c == '[' || c == '{' || c == '(') depth++;
            else if (c == ']' || c == '}' || c == ')') depth = Math.Max(0, depth - 1);
            else if (c == '=' && depth == 0)
            {
                if (i > 0 && (s[i - 1] == '!' || s[i - 1] == '<' || s[i - 1] == '>' || s[i - 1] == '=')) continue;
                if (i + 1 < s.Length && s[i + 1] == '=') continue;
                return i;
            }
        }
        return -1;
    }
}

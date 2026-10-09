using System.Diagnostics;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using LeetCodeTrainer.Data;
using LeetCodeTrainer.Models;

namespace LeetCodeTrainer.Services;

/// <summary>本地 Python 执行核心：临时目录 + harness 子进程 + JSON 语义比对。</summary>
public static class CodeRunnerService
{
    private const string ResultsMarker = "###RESULTS###";
    private const int TimeoutMs = 60_000;

    /// <summary>
    /// 运行链路：校验 Python -> 写临时文件 -> 子进程执行 harness ->
    /// 解析 ###RESULTS### -> 逐用例比对 -> 生成 RunRecord 落库并回写题目状态。
    /// </summary>
    public static async Task<RunRecord> RunAsync(Question question, string code, List<TestCase> cases, IProgress<SyncProgress>? progress = null)
    {
        var pythonPath = SettingsService.PythonPath;
        if (string.IsNullOrWhiteSpace(pythonPath) || !File.Exists(pythonPath))
        {
            throw new InvalidOperationException("未找到 Python 解释器，请先到“设置”页配置 Python 路径。");
        }
        if (cases == null || cases.Count == 0)
        {
            throw new InvalidOperationException("没有可运行的测试用例。");
        }

        var harness = ReadEmbeddedHarness();
        var caseJson = BuildCaseJson(cases);

        var tempDir = Path.Combine(Path.GetTempPath(), "LeetCodeTrainer", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        try
        {
            var solutionPath = Path.Combine(tempDir, "solution.py");
            var harnessPath = Path.Combine(tempDir, "harness.py");
            var casesPath = Path.Combine(tempDir, "cases.json");
            File.WriteAllText(solutionPath, code ?? string.Empty, new UTF8Encoding(false));
            File.WriteAllText(harnessPath, harness, new UTF8Encoding(false));
            File.WriteAllText(casesPath, caseJson, new UTF8Encoding(false));

            var psi = new ProcessStartInfo
            {
                FileName = pythonPath,
                Arguments = Quote(harnessPath) + " " + Quote(solutionPath) + " " + Quote(casesPath),
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                WorkingDirectory = tempDir,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            };
            psi.EnvironmentVariables["PYTHONIOENCODING"] = "utf-8";
            psi.EnvironmentVariables["PYTHONUTF8"] = "1";

            using var process = new Process { StartInfo = psi };
            process.Start();
            var stdoutTask = process.StandardOutput.ReadToEndAsync();
            var stderrTask = process.StandardError.ReadToEndAsync();

            var timedOut = false;
            using (var timeoutCts = new CancellationTokenSource(TimeSpan.FromMilliseconds(TimeoutMs)))
            {
                try
                {
                    await process.WaitForExitAsync(timeoutCts.Token);
                }
                catch (OperationCanceledException)
                {
                    timedOut = true;
                    try { process.Kill(entireProcessTree: true); } catch { /* 已退出 */ }
                    try { await process.WaitForExitAsync(); } catch { /* 忽略 */ }
                }
            }

            var stdout = await stdoutTask;
            var stderr = await stderrTask;
            if (timedOut)
            {
                stderr = (stderr ?? "") + $"\n运行超时（{TimeoutMs / 1000} 秒），进程已被强制终止。";
            }

            var details = ParseHarnessOutput(stdout);
            if (details.Count == 0)
            {
                var reason = timedOut ? "运行超时" : "未解析到运行结果（Python 输出异常）";
                for (var i = 0; i < cases.Count; i++)
                {
                    details.Add(new CaseRunDetail { Index = i, Error = reason, Stderr = stderr ?? "" });
                }
            }

            var passed = 0;
            for (var i = 0; i < cases.Count; i++)
            {
                var d = details.FirstOrDefault(x => x.Index == i);
                if (d == null)
                {
                    d = new CaseRunDetail { Index = i, Error = "未获取到该用例的运行结果" };
                    details.Add(d);
                }
                d.Input = cases[i].Input;
                d.Expected = cases[i].ExpectedOutput;
                if (string.IsNullOrEmpty(d.Actual)) d.Actual = "null";
                d.Passed = string.IsNullOrEmpty(d.Error) && IsEqual(cases[i].ExpectedOutput, d.Actual);
                if (d.Passed) passed++;
            }
            details.Sort((a, b) => a.Index.CompareTo(b.Index));

            var record = new RunRecord
            {
                QuestionSlug = question.TitleSlug,
                PassedCount = passed,
                TotalCount = cases.Count,
                Success = passed == cases.Count,
                Stdout = stdout ?? "",
                Stderr = stderr ?? "",
                CreatedAt = DateTime.Now,
                CaseDetails = details
            };

            RunRecordRepository.Add(record);

            // 回写题目状态：记录最近运行时间；非 solved 置为 attempted（待重做）
            question.LastRunAt = record.CreatedAt;
            QuestionRepository.TouchLastRun(question.FrontendId);
            if (question.Status != QuestionStatus.Solved)
            {
                question.Status = QuestionStatus.Attempted;
                QuestionRepository.SetStatus(question.FrontendId, QuestionStatus.Attempted);
            }

            progress?.Report(new SyncProgress
            {
                Message = record.Success ? "全部通过" : "存在未通过的用例",
                Current = passed,
                Total = cases.Count
            });
            return record;
        }
        finally
        {
            CleanupTemp(tempDir);
        }
    }

    private static string Quote(string path) => "\"" + path.Replace("\"", "") + "\"";

    /// <summary>从嵌入资源读取 PythonHarness.py。</summary>
    private static string ReadEmbeddedHarness()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var name = assembly.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith("PythonHarness.py", StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("嵌入式资源 PythonHarness.py 缺失。");
        using var stream = assembly.GetManifestResourceStream(name)
            ?? throw new InvalidOperationException("无法读取嵌入式资源 PythonHarness.py。");
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd();
    }

    /// <summary>生成 harness 用例 JSON：[{index, input, expected_output}]。</summary>
    public static string BuildCaseJson(List<TestCase> cases)
    {
        var arr = new List<object>(cases.Count);
        for (var i = 0; i < cases.Count; i++)
        {
            arr.Add(new Dictionary<string, object?>
            {
                ["index"] = i,
                ["input"] = cases[i].Input ?? "",
                ["expected_output"] = cases[i].ExpectedOutput ?? ""
            });
        }
        return JsonSerializer.Serialize(arr);
    }

    /// <summary>期望/实际比对：先 JSON 语义（数值/结构等价），失败退化为去空白字符串相等。</summary>
    public static bool IsEqual(string? expected, string? actual)
    {
        try
        {
            using var ed = JsonDocument.Parse((expected ?? "").Trim());
            using var ad = JsonDocument.Parse((actual ?? "").Trim());
            return JsonDeepEquals(ed.RootElement, ad.RootElement);
        }
        catch
        {
            return string.Equals(NormalizeForCompare(expected), NormalizeForCompare(actual), StringComparison.Ordinal);
        }
    }

    public static string NormalizeForCompare(string? s) => Regex.Replace(s ?? "", @"\s+", "");

    /// <summary>JSON 深比较（JSON 语义：数值统一按 double、对象按键匹配）。</summary>
    private static bool JsonDeepEquals(JsonElement a, JsonElement b)
    {
        if (a.ValueKind != b.ValueKind) return false;
        switch (a.ValueKind)
        {
            case JsonValueKind.Object:
            {
                var ap = a.EnumerateObject().ToList();
                if (ap.Count != b.EnumerateObject().Count()) return false;
                foreach (var p in ap)
                {
                    if (!b.TryGetProperty(p.Name, out var bv)) return false;
                    if (!JsonDeepEquals(p.Value, bv)) return false;
                }
                return true;
            }
            case JsonValueKind.Array:
            {
                var aa = a.EnumerateArray().ToList();
                var ba = b.EnumerateArray().ToList();
                if (aa.Count != ba.Count) return false;
                for (var i = 0; i < aa.Count; i++)
                {
                    if (!JsonDeepEquals(aa[i], ba[i])) return false;
                }
                return true;
            }
            case JsonValueKind.Number:
                return a.GetDouble().Equals(b.GetDouble());
            case JsonValueKind.String:
                return string.Equals(a.GetString(), b.GetString(), StringComparison.Ordinal);
            default:
                return true; // null / true / false / undefined
        }
    }

    /// <summary>从 stdout 抓取最后一行 '###RESULTS###'+JSON 并解析逐用例结果。</summary>
    private static List<CaseRunDetail> ParseHarnessOutput(string stdout)
    {
        var list = new List<CaseRunDetail>();
        string? json = null;
        var lines = (stdout ?? "").Replace("\r\n", "\n").Split('\n');
        for (var i = lines.Length - 1; i >= 0; i--)
        {
            var line = lines[i];
            var idx = line.IndexOf(ResultsMarker, StringComparison.Ordinal);
            if (idx >= 0)
            {
                json = line[(idx + ResultsMarker.Length)..];
                break;
            }
        }
        if (string.IsNullOrWhiteSpace(json)) return list;

        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return list;
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                var d = new CaseRunDetail();
                if (el.TryGetProperty("index", out var idxEl) && idxEl.TryGetInt32(out var iv)) d.Index = iv;
                if (el.TryGetProperty("actual", out var actEl))
                {
                    d.Actual = actEl.ValueKind == JsonValueKind.Null ? "null" : actEl.GetRawText();
                }
                if (el.TryGetProperty("stdout", out var outEl)) d.Stdout = outEl.GetString() ?? "";
                if (el.TryGetProperty("stderr", out var errEl)) d.Stderr = errEl.GetString() ?? "";
                if (el.TryGetProperty("elapsed_ms", out var msEl) && msEl.TryGetDouble(out var ms)) d.ElapsedMs = ms;
                if (el.TryGetProperty("error", out var eEl)) d.Error = eEl.GetString() ?? "";
                list.Add(d);
            }
        }
        catch
        {
            // 解析失败时按“无结果”处理
        }
        return list;
    }

    public static void CleanupTemp(string tempDir)
    {
        try
        {
            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
        }
        catch
        {
            // 临时目录清理失败忽略
        }
    }
}

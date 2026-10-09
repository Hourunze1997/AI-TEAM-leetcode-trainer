using System.Collections.ObjectModel;
using System.Net;
using System.Text;
using System.Windows.Threading;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using LeetCodeTrainer.Data;
using LeetCodeTrainer.Models;
using LeetCodeTrainer.Services;

namespace LeetCodeTrainer.ViewModels;

/// <summary>题目详情页逻辑：题面加载、代码草稿防抖保存、运行用例、状态/收藏切换。</summary>
public partial class QuestionDetailViewModel : ObservableObject
{
    private readonly Question _question;
    private readonly Action _goBack;
    private readonly DispatcherTimer _autoSaveTimer;
    private bool _suppressAutoSave = true;

    [ObservableProperty] private string _titleText = "";
    [ObservableProperty] private string _difficulty = "";
    [ObservableProperty] private double _acceptanceRate;
    [ObservableProperty] private string _acceptanceText = "";
    [ObservableProperty] private string _statusText = "";
    [ObservableProperty] private string _html = "";
    [ObservableProperty] private string _editorText = "";
    [ObservableProperty] private string _passedText = "";
    [ObservableProperty] private bool _isRunning;
    [ObservableProperty] private bool _favorite;
    [ObservableProperty] private bool _hasCases;

    public ObservableCollection<CaseResultVm> CaseResults { get; } = new();

    public bool CanRun => HasCases && !IsRunning;

    public IAsyncRelayCommand RunTestsCommand { get; }
    public IRelayCommand MarkSolvedCommand { get; }
    public IRelayCommand ResetToAttemptedCommand { get; }
    public IRelayCommand ToggleFavoriteCommand { get; }
    public IRelayCommand BackCommand { get; }

    public QuestionDetailViewModel(Question question, Action goBack)
    {
        _question = question ?? throw new ArgumentNullException(nameof(question));
        _goBack = goBack ?? throw new ArgumentNullException(nameof(goBack));

        TitleText = $"{question.FrontendId}. {question.Title}";
        Difficulty = question.Difficulty;
        AcceptanceRate = question.AcceptanceRate;
        AcceptanceText = $"通过率 {question.AcceptanceRate:0.0}%";
        StatusText = StatusDisplay(question.Status);
        Favorite = question.Favorite;
        Html = BuildHtmlDocument("<p style='color:#64748b;'>正在加载题面…</p>", question);

        RunTestsCommand = new AsyncRelayCommand(RunTestsAsync, () => CanRun);
        MarkSolvedCommand = new RelayCommand(() => SetStatus(QuestionStatus.Solved));
        ResetToAttemptedCommand = new RelayCommand(() => SetStatus(QuestionStatus.Attempted));
        ToggleFavoriteCommand = new RelayCommand(() =>
        {
            Favorite = !Favorite;
            _question.Favorite = Favorite;
            try
            {
                QuestionRepository.SetFavorite(_question.FrontendId, Favorite);
            }
            catch
            {
                // 本地保存失败忽略
            }
        });
        BackCommand = new RelayCommand(() =>
        {
            SaveDraftNow();
            _goBack();
        });

        // 800ms 防抖自动保存草稿
        _autoSaveTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(800) };
        _autoSaveTimer.Tick += (_, _) =>
        {
            _autoSaveTimer.Stop();
            SaveDraftNow();
        };

        _ = LoadAsync();
    }

    partial void OnIsRunningChanged(bool value)
    {
        OnPropertyChanged(nameof(CanRun));
        RunTestsCommand.NotifyCanExecuteChanged();
    }

    partial void OnHasCasesChanged(bool value)
    {
        OnPropertyChanged(nameof(CanRun));
        RunTestsCommand.NotifyCanExecuteChanged();
    }

    partial void OnEditorTextChanged(string value)
    {
        if (_suppressAutoSave) return;
        _autoSaveTimer.Stop();
        _autoSaveTimer.Start();
    }

    /// <summary>加载题面（EnsureDetailLoadedAsync 补拉详情）+ 草稿 + 用例。</summary>
    private async Task LoadAsync()
    {
        try
        {
            var loaded = await SyncService.EnsureDetailLoadedAsync(_question);
            var draft = CodeDraftRepository.GetBySlug(_question.TitleSlug);
            var cases = TestCaseRepository.GetBySlug(_question.TitleSlug);
            HasCases = cases.Count > 0;
            Html = BuildHtmlDocument(
                string.IsNullOrEmpty(loaded.ContentHtml) ? "<p>未获取到题面内容。</p>" : loaded.ContentHtml!,
                _question);
            EditorText = draft?.Code ?? DefaultCodeTemplate();
            if (!HasCases) PassedText = "未解析到示例用例，运行已禁用";
        }
        catch (Exception ex)
        {
            Html = BuildHtmlDocument(
                $"<p style='color:#b91c1c;'>加载题面失败：{WebUtility.HtmlEncode(ex.Message)}<br/>请检查网络/代理，稍后在列表页重新同步。</p>",
                _question);
            EditorText = CodeDraftRepository.GetBySlug(_question.TitleSlug)?.Code ?? DefaultCodeTemplate();
            HasCases = false;
        }
        finally
        {
            _suppressAutoSave = false;
        }
    }

    private async Task RunTestsAsync()
    {
        if (IsRunning) return;
        SaveDraftNow();

        List<TestCase> cases;
        try
        {
            cases = TestCaseRepository.GetBySlug(_question.TitleSlug);
        }
        catch (Exception ex)
        {
            PassedText = "读取用例失败：" + ex.Message;
            return;
        }
        if (cases.Count == 0)
        {
            HasCases = false;
            PassedText = "未解析到示例用例，运行已禁用";
            return;
        }

        IsRunning = true;
        PassedText = "运行中…";
        try
        {
            var record = await CodeRunnerService.RunAsync(_question, EditorText, cases, null);
            CaseResults.Clear();
            foreach (var d in record.CaseDetails.OrderBy(d => d.Index))
            {
                CaseResults.Add(new CaseResultVm(d));
            }
            PassedText = record.Success
                ? $"全部通过（{record.PassedCount}/{record.TotalCount}）"
                : $"通过 {record.PassedCount} / {record.TotalCount}";
            StatusText = StatusDisplay(_question.Status);
        }
        catch (Exception ex)
        {
            PassedText = "运行失败：" + ex.Message;
        }
        finally
        {
            IsRunning = false;
        }
    }

    private void SetStatus(string status)
    {
        _question.Status = status;
        try
        {
            QuestionRepository.SetStatus(_question.FrontendId, status);
        }
        catch (Exception ex)
        {
            StatusText = "保存状态失败：" + ex.Message;
            return;
        }
        StatusText = StatusDisplay(status);
    }

    /// <summary>立即保存草稿（运行前/切页前强制调用）。</summary>
    public void SaveDraftNow()
    {
        try
        {
            CodeDraftRepository.Save(_question.TitleSlug, EditorText ?? string.Empty);
        }
        catch
        {
            // 草稿保存失败忽略
        }
    }

    public void AutoSaveDraft() => SaveDraftNow();

    private static string StatusDisplay(string status) => status switch
    {
        QuestionStatus.Solved => "已解决",
        QuestionStatus.Attempted => "待重做",
        _ => "未做"
    };

    private static string DefaultCodeTemplate() =>
        "class Solution:\n" +
        "    def solve(self, nums, target):\n" +
        "        # 在这里编写你的解法；运行时会自动匹配 Solution 中方法与参数\n" +
        "        pass\n";

    /// <summary>Markdig 渲染 + 内联 CSS 模板，供 WebBrowser 离线展示（禁止外部资源引用）。</summary>
    internal static string BuildHtmlDocument(string bodyHtml, Question question)
    {
        var rendered = Markdig.Markdown.ToHtml(bodyHtml ?? string.Empty);
        var difficultyColor = (question.Difficulty ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "easy" => "#16a34a",
            "medium" => "#d97706",
            "hard" => "#dc2626",
            _ => "#64748b"
        };

        var sb = new StringBuilder();
        sb.Append("<html><head><meta http-equiv='Content-Type' content='text/html; charset=utf-8'/>");
        sb.Append("<meta http-equiv='X-UA-Compatible' content='IE=edge'/>");
        sb.Append("<style>");
        sb.Append("body{font-family:'Microsoft YaHei','Segoe UI',Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.65;margin:12px;}");
        sb.Append("pre{background:#f3f4f6;border:1px solid #e5e7eb;border-radius:4px;padding:8px;white-space:pre-wrap;word-break:break-all;font-family:Consolas,monospace;}");
        sb.Append("code{font-family:Consolas,monospace;}");
        sb.Append("table{border-collapse:collapse;margin:8px 0;}th,td{border:1px solid #d1d5db;padding:4px 8px;}");
        sb.Append("img{max-width:100%;}");
        sb.Append("a{color:#2563eb;}");
        sb.Append("</style></head><body>");
        sb.Append($"<h2 style='margin:0 0 6px 0;font-size:18px;'>{question.FrontendId}. {WebUtility.HtmlEncode(question.Title ?? "")}</h2>");
        sb.Append($"<p style='margin:0 0 10px 0;'><span style='color:{difficultyColor};font-weight:bold;'>{WebUtility.HtmlEncode(question.Difficulty ?? "")}</span>");
        sb.Append($"<span style='color:#64748b;font-size:12px;'>&nbsp;&nbsp;通过率 {question.AcceptanceRate:0.0}%</span></p>");
        sb.Append(rendered);
        sb.Append("</body></html>");
        return sb.ToString();
    }
}

using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Windows.Threading;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using LeetCodeTrainer.Data;
using LeetCodeTrainer.Models;
using LeetCodeTrainer.Services;

namespace LeetCodeTrainer.ViewModels;

/// <summary>题目列表页逻辑：筛选、后台同步、打开详情、收藏切换。</summary>
public partial class QuestionListViewModel : ObservableObject
{
    private DispatcherTimer? _searchDebounce;

    public ObservableCollection<Question> Questions { get; } = new();
    public ObservableCollection<string> Tags { get; } = new();

    public IReadOnlyList<string> DifficultyOptions { get; } = new[] { "全部", "Easy", "Medium", "Hard" };
    public IReadOnlyList<string> StatusOptions { get; } = new[] { "全部", "未做", "待重做", "已解决" };

    [ObservableProperty] private string _searchText = string.Empty;
    [ObservableProperty] private string _selectedDifficulty = "全部";
    [ObservableProperty] private string _selectedTag = "全部";
    [ObservableProperty] private string _selectedStatus = "全部";
    [ObservableProperty] private bool _hidePaid;
    [ObservableProperty] private string _syncStatusText = "尚未同步题库，点击“同步题库”获取最新题目";
    [ObservableProperty] private bool _isSyncing;
    [ObservableProperty] private int _totalCount;

    /// <summary>请求主窗口打开题目详情。</summary>
    public event Action<Question>? RequestOpenQuestion;

    public IAsyncRelayCommand SyncCommand { get; }
    public IRelayCommand SearchCommand { get; }
    public IRelayCommand<Question?> OpenQuestionCommand { get; }
    public IRelayCommand<Question?> ToggleFavoriteCommand { get; }

    public QuestionListViewModel()
    {
        SyncCommand = new AsyncRelayCommand(SyncAsync, () => !IsSyncing);
        SearchCommand = new RelayCommand(() =>
        {
            _searchDebounce?.Stop();
            LoadQuestions();
        });
        OpenQuestionCommand = new RelayCommand<Question?>(q =>
        {
            if (q != null) RequestOpenQuestion?.Invoke(q);
        });
        ToggleFavoriteCommand = new RelayCommand<Question?>(ToggleFavorite);
        PropertyChanged += OnSelfPropertyChanged;

        try
        {
            RefreshTags();
            LoadQuestions();
        }
        catch (Exception ex)
        {
            SyncStatusText = "加载题目失败：" + ex.Message;
        }
    }

    partial void OnIsSyncingChanged(bool value) => SyncCommand.NotifyCanExecuteChanged();

    /// <summary>筛选条件变化触发加载；搜索框走 500ms 防抖，其余立即刷新。</summary>
    private void OnSelfPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(SearchText))
        {
            _searchDebounce ??= CreateSearchDebounce();
            _searchDebounce.Stop();
            _searchDebounce.Start();
        }
        else if (e.PropertyName is nameof(SelectedDifficulty) or nameof(SelectedTag)
                 or nameof(SelectedStatus) or nameof(HidePaid))
        {
            LoadQuestions();
        }
    }

    private DispatcherTimer CreateSearchDebounce()
    {
        var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(500) };
        timer.Tick += (_, _) =>
        {
            timer.Stop();
            LoadQuestions();
        };
        return timer;
    }

    /// <summary>按当前筛选查询并刷新列表（集合未变化时原地更新，保留滚动位置）。</summary>
    public void LoadQuestions()
    {
        try
        {
            var status = SelectedStatus switch
            {
                "未做" => QuestionStatus.Todo,
                "待重做" => QuestionStatus.Attempted,
                "已解决" => QuestionStatus.Solved,
                _ => null
            };
            var filter = new QuestionFilter
            {
                Search = SearchText,
                Difficulty = SelectedDifficulty,
                Tag = SelectedTag,
                Status = status,
                HidePaid = HidePaid
            };
            ApplyQuestions(QuestionRepository.GetFiltered(filter));
        }
        catch (Exception ex)
        {
            SyncStatusText = "查询失败：" + ex.Message;
        }
    }

    private void ApplyQuestions(List<Question> fresh)
    {
        var sameSet = false;
        if (Questions.Count == fresh.Count)
        {
            var bySlug = new Dictionary<string, Question>(Questions.Count);
            foreach (var q in Questions) bySlug[q.TitleSlug] = q;
            sameSet = fresh.All(q => bySlug.ContainsKey(q.TitleSlug));
            if (sameSet)
            {
                foreach (var q in fresh)
                {
                    if (bySlug.TryGetValue(q.TitleSlug, out var existing))
                    {
                        existing.CopyFrom(q);
                    }
                }
            }
        }

        if (!sameSet)
        {
            Questions.Clear();
            foreach (var q in fresh) Questions.Add(q);
        }
        TotalCount = fresh.Count;
    }

    /// <summary>后台同步全量题库（IProgress 更新状态文本，完成后重载列表与标签）。</summary>
    private async Task SyncAsync()
    {
        if (IsSyncing) return;
        IsSyncing = true;
        SyncStatusText = "开始同步题库…";
        var progress = new Progress<SyncProgress>(p =>
        {
            SyncStatusText = p.Total > 0 ? $"{p.Message}（{p.Current}/{p.Total}）" : p.Message;
        });
        try
        {
            await SyncService.SyncAllAsync(progress);
            SyncStatusText = $"同步完成，本地共 {QuestionRepository.CountAll()} 题";
        }
        catch (Exception ex)
        {
            SyncStatusText = "同步失败：" + ex.Message;
        }
        finally
        {
            IsSyncing = false;
            RefreshTags();
            LoadQuestions();
        }
    }

    /// <summary>刷新标签下拉（保留当前选择）。</summary>
    public void RefreshTags()
    {
        var current = SelectedTag;
        var tags = new List<string> { "全部" };
        try
        {
            tags.AddRange(QuestionRepository.GetAllTags());
        }
        catch
        {
            // 标签加载失败时仅保留“全部”
        }
        Tags.Clear();
        foreach (var t in tags) Tags.Add(t);
        SelectedTag = tags.Contains(current) ? current : "全部";
    }

    private void ToggleFavorite(Question? q)
    {
        if (q == null) return;
        q.Favorite = !q.Favorite;
        try
        {
            QuestionRepository.SetFavorite(q.FrontendId, q.Favorite);
        }
        catch (Exception ex)
        {
            SyncStatusText = "更新收藏失败：" + ex.Message;
        }
    }
}

using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using LeetCodeTrainer.Models;

namespace LeetCodeTrainer.ViewModels;

/// <summary>导航容器：持有三个页面 VM 单例，CurrentViewModel 驱动 ContentControl 切换。</summary>
public partial class MainViewModel : ObservableObject
{
    private readonly QuestionListViewModel _listViewModel = new();
    private readonly StatisticsViewModel _statisticsViewModel = new();
    private readonly SettingsViewModel _settingsViewModel = new();

    private QuestionDetailViewModel? _currentDetail;

    [ObservableProperty]
    private ObservableObject? _currentViewModel;

    /// <summary>窗口标题带同步状态。</summary>
    public string Title => $"LeetCode 刷题训练器 — {_listViewModel.SyncStatusText}";

    public IRelayCommand ShowListCommand { get; }
    public IRelayCommand ShowStatsCommand { get; }
    public IRelayCommand ShowSettingsCommand { get; }

    public MainViewModel()
    {
        ShowListCommand = new RelayCommand(ShowList);
        ShowStatsCommand = new RelayCommand(ShowStats);
        ShowSettingsCommand = new RelayCommand(ShowSettings);

        _listViewModel.RequestOpenQuestion += OpenQuestion;
        _statisticsViewModel.RequestOpenQuestion += OpenQuestion;
        _listViewModel.PropertyChanged += (_, e) =>
        {
            if (e.PropertyName == nameof(QuestionListViewModel.SyncStatusText))
            {
                OnPropertyChanged(nameof(Title));
            }
        };

        CurrentViewModel = _listViewModel;
    }

    /// <summary>返回列表时筛选状态保留（列表 VM 常驻），数据刷新为最新状态。</summary>
    private void ShowList()
    {
        _currentDetail?.SaveDraftNow();
        _currentDetail = null;
        _listViewModel.LoadQuestions();
        CurrentViewModel = _listViewModel;
    }

    private void ShowStats()
    {
        _currentDetail?.SaveDraftNow();
        _currentDetail = null;
        _statisticsViewModel.OnActivated();
        CurrentViewModel = _statisticsViewModel;
    }

    private void ShowSettings()
    {
        _currentDetail?.SaveDraftNow();
        _currentDetail = null;
        _settingsViewModel.LoadFromSettings();
        CurrentViewModel = _settingsViewModel;
    }

    public void OpenQuestion(Question? question)
    {
        if (question == null) return;
        _currentDetail?.SaveDraftNow();
        _currentDetail = new QuestionDetailViewModel(question, ShowList);
        CurrentViewModel = _currentDetail;
    }
}

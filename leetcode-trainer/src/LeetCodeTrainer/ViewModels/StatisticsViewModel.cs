using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using LeetCodeTrainer.Models;
using LeetCodeTrainer.Services;
using LiveChartsCore;
using LiveChartsCore.SkiaSharpView;
using LiveChartsCore.SkiaSharpView.Painting;
using SkiaSharp;

namespace LeetCodeTrainer.ViewModels;

/// <summary>统计页逻辑：每次激活刷新总览/图表/打卡/收藏。</summary>
public partial class StatisticsViewModel : ObservableObject
{
    [ObservableProperty] private string _solvedText = "暂无数据";
    [ObservableProperty] private int _streakDays;
    [ObservableProperty] private ISeries[] _difficulties = Array.Empty<ISeries>();
    [ObservableProperty] private ISeries[] _trend = Array.Empty<ISeries>();
    [ObservableProperty] private Axis[] _xAxes = Array.Empty<Axis>();
    [ObservableProperty] private Axis[] _yAxes = Array.Empty<Axis>();

    public ObservableCollection<Question> FavoriteQuestions { get; } = new();

    /// <summary>请求主窗口打开题目详情。</summary>
    public event Action<Question>? RequestOpenQuestion;

    public IRelayCommand<Question?> OpenQuestionCommand { get; }

    public StatisticsViewModel()
    {
        OpenQuestionCommand = new RelayCommand<Question?>(q =>
        {
            if (q != null) RequestOpenQuestion?.Invoke(q);
        });
    }

    public void OnActivated() => Refresh();

    public void Refresh()
    {
        try
        {
            var overview = StatisticsService.GetOverview();
            SolvedText = $"已完成 {overview.SolvedCount} / 共 {overview.TotalQuestions} 题";
            Difficulties = BuildPieSeries(overview);

            var trend = StatisticsService.GetTrend30Days();
            Trend = BuildLineSeries(trend);
            XAxes = new Axis[]
            {
                new()
                {
                    Labels = trend.Select(d => d.Date.ToString("MM-dd")).ToList(),
                    LabelsRotation = 45,
                    LabelsPaint = new SolidColorPaint(SKColors.SlateGray)
                }
            };
            YAxes = new Axis[]
            {
                new() { MinLimit = 0, LabelsPaint = new SolidColorPaint(SKColors.SlateGray) }
            };

            StreakDays = StatisticsService.GetStreak();

            FavoriteQuestions.Clear();
            foreach (var q in StatisticsService.GetFavorites()) FavoriteQuestions.Add(q);
        }
        catch
        {
            // 统计失败时保留旧数据
        }
    }

    /// <summary>各难度完成情况环形图。</summary>
    private static ISeries[] BuildPieSeries(StatsOverview overview)
    {
        var list = new List<ISeries>();
        foreach (var d in overview.ByDifficulty)
        {
            var color = d.Difficulty switch
            {
                "Easy" => new SKColor(34, 197, 94),
                "Medium" => new SKColor(249, 115, 22),
                "Hard" => new SKColor(239, 68, 68),
                _ => SKColors.SlateGray
            };
            list.Add(new PieSeries<int>
            {
                Name = $"{d.Difficulty} {d.Solved}/{d.Total}",
                Values = new[] { d.Solved },
                Fill = new SolidColorPaint(color),
                InnerRadius = 70
            });
        }
        return list.ToArray();
    }

    /// <summary>近 30 天趋势折线。</summary>
    private static ISeries[] BuildLineSeries(List<DailyCount> trend)
    {
        return new ISeries[]
        {
            new LineSeries<int>
            {
                Name = "每日完成题数",
                Values = trend.Select(d => d.Count).ToArray(),
                GeometrySize = 6,
                Stroke = new SolidColorPaint(new SKColor(37, 99, 235)) { StrokeThickness = 3 },
                Fill = new SolidColorPaint(new SKColor(37, 99, 235, 40))
            }
        };
    }
}

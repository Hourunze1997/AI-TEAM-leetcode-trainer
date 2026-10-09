using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace LeetCodeTrainer.Models;

/// <summary>题目状态常量。</summary>
public static class QuestionStatus
{
    public const string Todo = "todo";
    public const string Attempted = "attempted";
    public const string Solved = "solved";
}

/// <summary>题目实体（实现 INPC 便于列表原地刷新时 UI 更新）。</summary>
public class Question : INotifyPropertyChanged
{
    private int _frontendId;
    private string _title = "";
    private string _titleSlug = "";
    private string _difficulty = "";
    private string _tags = "";
    private double _acceptanceRate;
    private bool _isPaid;
    private string _status = QuestionStatus.Todo;
    private bool _favorite;
    private DateTime? _lastRunAt;
    private string? _contentHtml;
    private string? _rawExamples;
    private DateTime? _syncedAt;

    public int FrontendId { get => _frontendId; set => Set(ref _frontendId, value); }
    public string Title { get => _title; set => Set(ref _title, value); }
    public string TitleSlug { get => _titleSlug; set => Set(ref _titleSlug, value); }
    public string Difficulty { get => _difficulty; set => Set(ref _difficulty, value); }
    public string Tags { get => _tags; set => Set(ref _tags, value); }
    public double AcceptanceRate { get => _acceptanceRate; set => Set(ref _acceptanceRate, value); }
    public bool IsPaid { get => _isPaid; set => Set(ref _isPaid, value); }
    public string Status { get => _status; set => Set(ref _status, value); }
    public bool Favorite { get => _favorite; set => Set(ref _favorite, value); }
    public DateTime? LastRunAt { get => _lastRunAt; set => Set(ref _lastRunAt, value); }

    // 扩展列：题面离线缓存
    public string? ContentHtml { get => _contentHtml; set => Set(ref _contentHtml, value); }
    public string? RawExamples { get => _rawExamples; set => Set(ref _rawExamples, value); }
    public DateTime? SyncedAt { get => _syncedAt; set => Set(ref _syncedAt, value); }

    /// <summary>用新数据覆盖本地字段（用于列表原地刷新，保留滚动位置）。</summary>
    public void CopyFrom(Question other)
    {
        FrontendId = other.FrontendId;
        Title = other.Title;
        TitleSlug = other.TitleSlug;
        Difficulty = other.Difficulty;
        Tags = other.Tags;
        AcceptanceRate = other.AcceptanceRate;
        IsPaid = other.IsPaid;
        Status = other.Status;
        Favorite = other.Favorite;
        LastRunAt = other.LastRunAt;
        ContentHtml = other.ContentHtml;
        RawExamples = other.RawExamples;
        SyncedAt = other.SyncedAt;
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    private void Raise([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));

    private bool Set<T>(ref T field, T value, [CallerMemberName] string? name = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value)) return false;
        field = value;
        Raise(name);
        return true;
    }
}

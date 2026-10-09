using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using LeetCodeTrainer.Data;
using LeetCodeTrainer.Services;
using Microsoft.Win32;
using System.Windows;

namespace LeetCodeTrainer.ViewModels;

/// <summary>设置页逻辑：Python 路径 / 代理 / 数据源，保存校验与清空缓存。</summary>
public partial class SettingsViewModel : ObservableObject
{
    [ObservableProperty] private string _pythonPath = string.Empty;
    [ObservableProperty] private string _proxyUrl = string.Empty;
    [ObservableProperty] private string _selectedSite = "leetcode.com";
    [ObservableProperty] private string _statusText = string.Empty;

    public IReadOnlyList<string> SiteOptions { get; } = new[] { "leetcode.com", "leetcode.cn" };

    public IRelayCommand BrowsePythonCommand { get; }
    public IRelayCommand SaveCommand { get; }
    public IRelayCommand ClearCacheCommand { get; }

    public SettingsViewModel()
    {
        BrowsePythonCommand = new RelayCommand(BrowsePython);
        SaveCommand = new RelayCommand(Save);
        ClearCacheCommand = new RelayCommand(ClearCache);
        LoadFromSettings();
    }

    /// <summary>从 SettingsService 读取当前配置。</summary>
    public void LoadFromSettings()
    {
        PythonPath = SettingsService.PythonPath;
        ProxyUrl = SettingsService.ProxyUrl;
        SelectedSite = string.Equals(SettingsService.Site, "cn", StringComparison.OrdinalIgnoreCase)
            ? "leetcode.cn"
            : "leetcode.com";
        StatusText = string.Empty;
    }

    private void BrowsePython()
    {
        var dialog = new OpenFileDialog
        {
            Title = "选择 Python 解释器",
            Filter = "Python 解释器 (python.exe)|python.exe|所有文件 (*.*)|*.*",
            CheckFileExists = true
        };
        if (dialog.ShowDialog() == true)
        {
            PythonPath = dialog.FileName;
            StatusText = SettingsService.ValidatePythonPath(PythonPath)
                ? "已选择 Python 路径，请点击保存。"
                : "所选文件看起来不是 Python 解释器，请确认。";
        }
    }

    private void Save()
    {
        try
        {
            SettingsService.PythonPath = PythonPath?.Trim() ?? "";
            SettingsService.ProxyUrl = ProxyUrl?.Trim() ?? "";
            SettingsService.Site = string.Equals(SelectedSite, "leetcode.cn", StringComparison.OrdinalIgnoreCase)
                ? "cn"
                : "com";

            StatusText = SettingsService.ValidatePythonPath(SettingsService.PythonPath)
                ? "设置已保存。"
                : "设置已保存。注意：Python 路径无效或未配置，无法运行代码。";
            if (!string.IsNullOrWhiteSpace(SettingsService.ProxyUrl))
            {
                StatusText += " 已启用代理。";
            }
            StatusText += "（切换数据源后需重新同步题库）";
        }
        catch (Exception ex)
        {
            StatusText = "保存失败：" + ex.Message;
        }
    }

    private void ClearCache()
    {
        var result = MessageBox.Show(
            "确定要清空本地缓存与全部运行记录吗？\n（设置将保留；题目元数据将重置，需要重新同步）",
            "确认操作", MessageBoxButton.YesNo, MessageBoxImage.Warning);
        if (result != MessageBoxResult.Yes) return;

        try
        {
            TestCaseRepository.ClearAll();
            CodeDraftRepository.ClearAll();
            RunRecordRepository.ClearAll();
            QuestionRepository.ClearMetadata();
            Db.Reindex();
            StatusText = "本地缓存与运行记录已清空（设置保留）。";
        }
        catch (Exception ex)
        {
            StatusText = "清空失败：" + ex.Message;
        }
    }
}

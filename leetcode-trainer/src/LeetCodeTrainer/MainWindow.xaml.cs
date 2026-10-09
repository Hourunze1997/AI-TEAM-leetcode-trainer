using System.Windows;
using LeetCodeTrainer.ViewModels;

namespace LeetCodeTrainer;

/// <summary>主窗口外壳：左侧导航 + 右侧 ContentControl 绑定 CurrentViewModel。</summary>
public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        DataContext = new MainViewModel();
    }
}

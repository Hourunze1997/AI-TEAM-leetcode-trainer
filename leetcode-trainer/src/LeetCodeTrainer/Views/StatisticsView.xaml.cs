using System.Windows.Controls;
using System.Windows.Input;
using LeetCodeTrainer.Models;
using LeetCodeTrainer.ViewModels;

namespace LeetCodeTrainer.Views;

public partial class StatisticsView : UserControl
{
    public StatisticsView()
    {
        InitializeComponent();
    }

    /// <summary>双击收藏题目 -> 打开详情。</summary>
    private void FavoriteList_MouseDoubleClick(object sender, MouseButtonEventArgs e)
    {
        if (DataContext is StatisticsViewModel vm
            && sender is System.Windows.Controls.ListBox list
            && list.SelectedItem is Question question)
        {
            vm.OpenQuestionCommand.Execute(question);
        }
    }
}

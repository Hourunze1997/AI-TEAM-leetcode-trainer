using System.Windows.Controls;
using System.Windows.Input;
using LeetCodeTrainer.Models;
using LeetCodeTrainer.ViewModels;

namespace LeetCodeTrainer.Views;

public partial class QuestionListView : UserControl
{
    public QuestionListView()
    {
        InitializeComponent();
    }

    /// <summary>双击行 -> 打开题目详情。</summary>
    private void QuestionsGrid_MouseDoubleClick(object sender, MouseButtonEventArgs e)
    {
        if (DataContext is QuestionListViewModel vm
            && sender is System.Windows.Controls.DataGrid grid
            && grid.SelectedItem is Question question)
        {
            vm.OpenQuestionCommand.Execute(question);
        }
    }
}

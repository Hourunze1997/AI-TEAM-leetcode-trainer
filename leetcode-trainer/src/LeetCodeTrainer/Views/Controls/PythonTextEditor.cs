using System.Windows;
using System.Windows.Media;
using System.Xml;
using ICSharpCode.AvalonEdit;
using ICSharpCode.AvalonEdit.Highlighting;
using ICSharpCode.AvalonEdit.Highlighting.Xshd;

namespace LeetCodeTrainer.Views.Controls;

/// <summary>Python 代码编辑器：嵌入资源加载语法高亮、行号、4 空格缩进、Text 依赖属性桥接 MVVM。</summary>
public class PythonTextEditor : TextEditor
{
    public static readonly DependencyProperty TextProperty = DependencyProperty.Register(
        nameof(Text), typeof(string), typeof(PythonTextEditor),
        new FrameworkPropertyMetadata(string.Empty, FrameworkPropertyMetadataOptions.BindsTwoWayByDefault, OnTextPropertyChanged));

    private bool _syncing;

    public new string Text
    {
        get => (string)GetValue(TextProperty);
        set => SetValue(TextProperty, value);
    }

    public PythonTextEditor()
    {
        ShowLineNumbers = true;
        Options.ConvertTabsToSpaces = true;
        Options.IndentationSize = 4;
        FontFamily = new FontFamily("Consolas, Microsoft YaHei UI");
        FontSize = 14;
        WordWrap = false;
        LoadHighlighting();
        TextChanged += OnEditorTextChanged;
    }

    private void OnEditorTextChanged(object? sender, EventArgs e)
    {
        if (_syncing) return;
        _syncing = true;
        try
        {
            SetCurrentValue(TextProperty, Document?.Text ?? string.Empty);
        }
        finally
        {
            _syncing = false;
        }
    }

    private static void OnTextPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is not PythonTextEditor editor) return;
        var newText = e.NewValue as string ?? string.Empty;
        var current = editor.Document?.Text ?? string.Empty;
        if (string.Equals(current, newText, StringComparison.Ordinal)) return;
        editor._syncing = true;
        try
        {
            if (editor.Document != null)
            {
                editor.Document.Text = newText;
            }
        }
        catch
        {
            // 文档未就绪时忽略
        }
        finally
        {
            editor._syncing = false;
        }
    }

    /// <summary>从嵌入资源加载 Python.xshd 语法定义。</summary>
    private void LoadHighlighting()
    {
        try
        {
            var assembly = Assembly.GetExecutingAssembly();
            var name = assembly.GetManifestResourceNames()
                .FirstOrDefault(n => n.EndsWith("Python.xshd", StringComparison.OrdinalIgnoreCase));
            if (name == null) return;
            using var stream = assembly.GetManifestResourceStream(name);
            if (stream == null) return;
            using var reader = XmlReader.Create(stream);
            var definition = HighlightingLoader.Load(reader, HighlightingManager.Instance);
            SyntaxHighlighting = definition;
        }
        catch
        {
            // 高亮加载失败不影响编辑功能
        }
    }
}

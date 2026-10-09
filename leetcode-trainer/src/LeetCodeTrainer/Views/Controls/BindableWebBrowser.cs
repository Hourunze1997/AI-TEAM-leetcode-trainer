using System.Windows;
using System.Windows.Controls;

namespace LeetCodeTrainer.Views.Controls;

/// <summary>可绑定 Html 的 WebBrowser：Html 依赖属性变化时 NavigateToString。</summary>
public class BindableWebBrowser : WebBrowser
{
    public static readonly DependencyProperty HtmlProperty = DependencyProperty.Register(
        nameof(Html), typeof(string), typeof(BindableWebBrowser),
        new PropertyMetadata(string.Empty, OnHtmlChanged));

    public string Html
    {
        get => (string)GetValue(HtmlProperty);
        set => SetValue(HtmlProperty, value);
    }

    private static void OnHtmlChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is not BindableWebBrowser browser) return;
        var html = e.NewValue as string;
        if (string.IsNullOrEmpty(html)) return;
        try
        {
            browser.NavigateToString(html);
        }
        catch
        {
            // IE 内核渲染失败时忽略，避免崩溃
        }
    }
}

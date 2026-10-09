using System.Globalization;
using System.Windows;
using System.Windows.Data;
using System.Windows.Media;
using LeetCodeTrainer.Models;

namespace LeetCodeTrainer.Utils;

/// <summary>难度 -> 颜色（Easy 绿 / Medium 橙 / Hard 红）。</summary>
public class DifficultyToBrushConverter : IValueConverter
{
    private static readonly SolidColorBrush EasyBrush = Create(0x16, 0xA3, 0x4A);
    private static readonly SolidColorBrush MediumBrush = Create(0xD9, 0x77, 0x06);
    private static readonly SolidColorBrush HardBrush = Create(0xDC, 0x26, 0x26);
    private static readonly SolidColorBrush GrayBrush = Create(0x64, 0x74, 0x8B);

    private static SolidColorBrush Create(byte r, byte g, byte b)
    {
        var brush = new SolidColorBrush(Color.FromRgb(r, g, b));
        brush.Freeze();
        return brush;
    }

    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var d = (value as string)?.Trim().ToLowerInvariant();
        return d switch
        {
            "easy" or "简单" => EasyBrush,
            "medium" or "中等" => MediumBrush,
            "hard" or "困难" => HardBrush,
            _ => GrayBrush
        };
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => Binding.DoNothing;
}

/// <summary>状态码 -> 中文（todo 未做 / attempted 待重做 / solved 已解决）。</summary>
public class StatusToTextConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        return (value as string) switch
        {
            QuestionStatus.Todo => "未做",
            QuestionStatus.Attempted => "待重做",
            QuestionStatus.Solved => "已解决",
            _ => value?.ToString() ?? ""
        };
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => Binding.DoNothing;
}

/// <summary>bool -> ★/☆。</summary>
public class FavoriteToStarConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is true ? "★" : "☆";

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => Binding.DoNothing;
}

/// <summary>bool -> 收藏颜色（金色/灰色）。</summary>
public class FavoriteToBrushConverter : IValueConverter
{
    private static readonly SolidColorBrush Active = Freeze(Color.FromRgb(0xF5, 0x9E, 0x0B));
    private static readonly SolidColorBrush Idle = Freeze(Color.FromRgb(0x94, 0xA3, 0xB8));

    private static SolidColorBrush Freeze(Color c)
    {
        var brush = new SolidColorBrush(c);
        brush.Freeze();
        return brush;
    }

    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is true ? Active : Idle;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => Binding.DoNothing;
}

/// <summary>bool 取反（双向可用）。</summary>
public class InverseBoolConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is bool b ? !b : true;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is bool b ? !b : false;
}

/// <summary>bool -> Visibility（true 显示）。</summary>
public class BoolToVisibilityConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is true ? Visibility.Visible : Visibility.Collapsed;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is Visibility v && v == Visibility.Visible;
}

/// <summary>bool -> 通过(绿)/失败(红)。</summary>
public class PassedToBrushConverter : IValueConverter
{
    private static readonly SolidColorBrush PassBrush = Freeze(0x16, 0xA3, 0x4A);
    private static readonly SolidColorBrush FailBrush = Freeze(0xDC, 0x26, 0x26);

    private static SolidColorBrush Freeze(byte r, byte g, byte b)
    {
        var brush = new SolidColorBrush(Color.FromRgb(r, g, b));
        brush.Freeze();
        return brush;
    }

    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is true ? PassBrush : FailBrush;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => Binding.DoNothing;
}

/// <summary>字符串为空/空白 -> Collapsed，否则 Visible（用于错误/输出展示）。</summary>
public class EmptyToCollapsedConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => string.IsNullOrWhiteSpace(value as string) ? Visibility.Collapsed : Visibility.Visible;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => Binding.DoNothing;
}

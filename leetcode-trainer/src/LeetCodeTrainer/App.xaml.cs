using System.IO;
using System.Windows;
using LeetCodeTrainer.Data;

namespace LeetCodeTrainer;

/// <summary>WPF 入口：注册全局异常处理并初始化本地数据库。</summary>
public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        RegisterGlobalExceptionHandling();
        try
        {
            Db.Init();
        }
        catch (Exception ex)
        {
            MessageBox.Show($"初始化本地数据库失败：{ex.Message}\n路径：{Db.DbPath}",
                "LeetCode 刷题训练器", MessageBoxButton.OK, MessageBoxImage.Error);
            Shutdown(-1);
        }
    }

    /// <summary>全局兜底：UI 线程异常弹窗、后台异常写日志，避免闪退。</summary>
    private void RegisterGlobalExceptionHandling()
    {
        DispatcherUnhandledException += (_, args) =>
        {
            MessageBox.Show($"发生未处理的异常：{args.Exception.Message}", "错误",
                MessageBoxButton.OK, MessageBoxImage.Error);
            args.Handled = true;
        };

        AppDomain.CurrentDomain.UnhandledException += (_, args) =>
        {
            if (args.ExceptionObject is Exception ex)
            {
                TryWriteCrashLog(ex);
            }
        };

        System.Threading.Tasks.TaskScheduler.UnobservedTaskException += (_, args) =>
        {
            TryWriteCrashLog(args.Exception);
            args.SetObserved();
        };
    }

    private static void TryWriteCrashLog(Exception ex)
    {
        try
        {
            var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "LeetCodeTrainer");
            Directory.CreateDirectory(dir);
            File.AppendAllText(Path.Combine(dir, "crash.log"),
                $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {ex}\r\n\r\n");
        }
        catch
        {
            // 日志写失败时忽略
        }
    }
}

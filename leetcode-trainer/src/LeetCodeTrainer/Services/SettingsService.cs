namespace LeetCodeTrainer.Services;

/// <summary>AppSetting 的强类型设置门面（python_path / proxy_url / site_language）。</summary>
public static class SettingsService
{
    public const string KeyPythonPath = "python_path";
    public const string KeyProxyUrl = "proxy_url";
    public const string KeySiteLanguage = "site_language";

    /// <summary>Python 解释器路径（运行前必须校验，绝不硬编码）。</summary>
    public static string PythonPath
    {
        get => Data.AppSettingRepository.Get(KeyPythonPath, string.Empty);
        set => Data.AppSettingRepository.Set(KeyPythonPath, value ?? string.Empty);
    }

    /// <summary>HTTP 代理地址，为空时使用系统默认。</summary>
    public static string ProxyUrl
    {
        get => Data.AppSettingRepository.Get(KeyProxyUrl, string.Empty);
        set => Data.AppSettingRepository.Set(KeyProxyUrl, value ?? string.Empty);
    }

    /// <summary>站点语言：com | cn（影响 GraphQL 地址与标题字段）。</summary>
    public static string Site
    {
        get => Data.AppSettingRepository.Get(KeySiteLanguage, "com");
        set => Data.AppSettingRepository.Set(KeySiteLanguage,
            string.Equals(value, "cn", StringComparison.OrdinalIgnoreCase) ? "cn" : "com");
    }

    /// <summary>校验：文件存在且文件名包含 python。</summary>
    public static bool ValidatePythonPath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return false;
        try
        {
            return File.Exists(path) && Path.GetFileName(path).ToLowerInvariant().Contains("python");
        }
        catch
        {
            return false;
        }
    }
}

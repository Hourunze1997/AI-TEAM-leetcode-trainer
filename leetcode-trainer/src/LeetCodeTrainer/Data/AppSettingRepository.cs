using Microsoft.Data.Sqlite;

namespace LeetCodeTrainer.Data;

/// <summary>AppSetting 表键值读写。</summary>
public static class AppSettingRepository
{
    public static string Get(string key, string defaultValue)
    {
        try
        {
            using var conn = Db.CreateConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT value FROM AppSetting WHERE key = @key LIMIT 1";
            cmd.Parameters.AddWithValue("@key", key);
            var result = cmd.ExecuteScalar();
            return result is string s ? s : defaultValue;
        }
        catch
        {
            return defaultValue;
        }
    }

    public static void Set(string key, string value)
    {
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "INSERT OR REPLACE INTO AppSetting (key, value) VALUES (@key, @value)";
        cmd.Parameters.AddWithValue("@key", key);
        cmd.Parameters.AddWithValue("@value", value ?? "");
        cmd.ExecuteNonQuery();
    }

    public static Dictionary<string, string> GetAll()
    {
        var dict = new Dictionary<string, string>(StringComparer.Ordinal);
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT key, value FROM AppSetting";
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            dict[r.GetString(0)] = r.IsDBNull(1) ? "" : r.GetString(1);
        }
        return dict;
    }
}

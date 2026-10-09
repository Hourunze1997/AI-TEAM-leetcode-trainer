using System.Globalization;
using LeetCodeTrainer.Models;
using Microsoft.Data.Sqlite;

namespace LeetCodeTrainer.Data;

/// <summary>RunRecord 表写入与统计查询。</summary>
public static class RunRecordRepository
{
    public static void Add(RunRecord record)
    {
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"INSERT INTO RunRecord (question_slug, passed_count, total_count, success, stdout, stderr, created_at)
VALUES (@slug, @passed, @total, @success, @stdout, @stderr, @created)";
        cmd.Parameters.AddWithValue("@slug", record.QuestionSlug ?? "");
        cmd.Parameters.AddWithValue("@passed", record.PassedCount);
        cmd.Parameters.AddWithValue("@total", record.TotalCount);
        cmd.Parameters.AddWithValue("@success", record.Success ? 1 : 0);
        cmd.Parameters.AddWithValue("@stdout", record.Stdout ?? "");
        cmd.Parameters.AddWithValue("@stderr", record.Stderr ?? "");
        cmd.Parameters.AddWithValue("@created", record.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"));
        cmd.ExecuteNonQuery();
    }

    /// <summary>某题最近 N 条运行记录。</summary>
    public static List<RunRecord> GetBySlugRecent(string slug, int count)
    {
        var list = new List<RunRecord>();
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"SELECT id, question_slug, passed_count, total_count, success, stdout, stderr, created_at
FROM RunRecord WHERE question_slug = @slug ORDER BY id DESC LIMIT @limit";
        cmd.Parameters.AddWithValue("@slug", slug);
        cmd.Parameters.AddWithValue("@limit", count);
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            list.Add(new RunRecord
            {
                Id = r.GetInt32(0),
                QuestionSlug = r.GetString(1),
                PassedCount = r.GetInt32(2),
                TotalCount = r.GetInt32(3),
                Success = r.GetInt32(4) != 0,
                Stdout = r.IsDBNull(5) ? "" : r.GetString(5),
                Stderr = r.IsDBNull(6) ? "" : r.GetString(6),
                CreatedAt = ParseDate(r.IsDBNull(7) ? null : r.GetString(7))
            });
        }
        return list;
    }

    /// <summary>近 N 天每天成功运行覆盖的去重题目数。</summary>
    public static List<DailyCount> GetDailySuccessCounts(int days)
    {
        var list = new List<DailyCount>();
        var start = DateTime.Today.AddDays(-(days - 1)).ToString("yyyy-MM-dd");
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"SELECT substr(created_at, 1, 10) AS d, COUNT(DISTINCT question_slug) AS c
FROM RunRecord
WHERE success = 1 AND substr(created_at, 1, 10) >= @start
GROUP BY d
ORDER BY d ASC";
        cmd.Parameters.AddWithValue("@start", start);
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            if (DateTime.TryParseExact(r.GetString(0), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            {
                list.Add(new DailyCount { Date = date, Count = Convert.ToInt32(r.GetValue(1)) });
            }
        }
        return list;
    }

    /// <summary>全部成功记录的日期集合（去重到天），用于计算连续打卡。</summary>
    public static List<DateTime> GetSuccessDates()
    {
        var list = new List<DateTime>();
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT DISTINCT substr(created_at, 1, 10) AS d FROM RunRecord WHERE success = 1 ORDER BY d ASC";
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            if (DateTime.TryParseExact(r.GetString(0), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            {
                list.Add(date);
            }
        }
        return list;
    }

    public static void ClearAll()
    {
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM RunRecord";
        cmd.ExecuteNonQuery();
    }

    private static DateTime ParseDate(string? s)
        => DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) ? d : DateTime.MinValue;
}

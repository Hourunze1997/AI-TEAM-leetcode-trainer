using System.Globalization;
using LeetCodeTrainer.Models;
using Microsoft.Data.Sqlite;

namespace LeetCodeTrainer.Data;

/// <summary>Question 表 CRUD 与筛选查询。</summary>
public static class QuestionRepository
{
    private static string FormatDate(DateTime dt) => dt.ToString("yyyy-MM-dd HH:mm:ss");

    private static DateTime? ReadDate(SqliteDataReader r, string column)
    {
        var i = r.GetOrdinal(column);
        if (r.IsDBNull(i)) return null;
        var s = r.GetString(i);
        return DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) ? d : null;
    }

    private static string? ReadNullableString(SqliteDataReader r, string column)
    {
        var i = r.GetOrdinal(column);
        return r.IsDBNull(i) ? null : r.GetString(i);
    }

    private static Question Map(SqliteDataReader r) => new()
    {
        FrontendId = Convert.ToInt32(r["frontend_id"]),
        Title = Convert.ToString(r["title"]) ?? "",
        TitleSlug = Convert.ToString(r["title_slug"]) ?? "",
        Difficulty = Convert.ToString(r["difficulty"]) ?? "",
        Tags = Convert.ToString(r["tags"]) ?? "",
        AcceptanceRate = r.GetDouble(r.GetOrdinal("acceptance_rate")),
        IsPaid = Convert.ToInt32(r["is_paid"]) != 0,
        Status = Convert.ToString(r["status"]) ?? QuestionStatus.Todo,
        Favorite = Convert.ToInt32(r["favorite"]) != 0,
        LastRunAt = ReadDate(r, "last_run_at"),
        ContentHtml = ReadNullableString(r, "content_html"),
        RawExamples = ReadNullableString(r, "raw_examples"),
        SyncedAt = ReadDate(r, "synced_at")
    };

    /// <summary>组合条件查询：搜索/难度/标签/状态/隐藏会员题，按 FrontendId 升序。</summary>
    public static List<Question> GetFiltered(QuestionFilter? filter)
    {
        filter ??= new QuestionFilter();
        var conds = new List<string>();
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            conds.Add("title LIKE @search");
            cmd.Parameters.AddWithValue("@search", "%" + filter.Search.Trim() + "%");
        }
        if (!string.IsNullOrWhiteSpace(filter.Difficulty) && filter.Difficulty != "全部")
        {
            conds.Add("difficulty = @difficulty");
            cmd.Parameters.AddWithValue("@difficulty", filter.Difficulty);
        }
        if (!string.IsNullOrWhiteSpace(filter.Tag) && filter.Tag != "全部")
        {
            conds.Add("tags LIKE @tag");
            cmd.Parameters.AddWithValue("@tag", "%" + filter.Tag + "%");
        }
        if (!string.IsNullOrWhiteSpace(filter.Status) && filter.Status != "全部")
        {
            conds.Add("status = @status");
            cmd.Parameters.AddWithValue("@status", filter.Status);
        }
        if (filter.HidePaid)
        {
            conds.Add("is_paid = 0");
        }

        cmd.CommandText = "SELECT * FROM Question"
            + (conds.Count > 0 ? " WHERE " + string.Join(" AND ", conds) : "")
            + " ORDER BY frontend_id ASC";
        using var reader = cmd.ExecuteReader();
        var list = new List<Question>();
        while (reader.Read()) list.Add(Map(reader));
        return list;
    }

    public static Question? GetBySlug(string slug)
    {
        if (string.IsNullOrEmpty(slug)) return null;
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT * FROM Question WHERE title_slug = @slug LIMIT 1";
        cmd.Parameters.AddWithValue("@slug", slug);
        using var r = cmd.ExecuteReader();
        return r.Read() ? Map(r) : null;
    }

    /// <summary>按 title_slug 幂等批量插入/更新同步字段（不动 status/favorite/last_run_at/内容缓存），事务包裹。</summary>
    public static void UpsertMany(List<Question> questions)
    {
        if (questions == null || questions.Count == 0) return;
        using var conn = Db.CreateConnection();
        using var tx = conn.BeginTransaction();
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = @"
INSERT INTO Question (frontend_id, title, title_slug, difficulty, tags, acceptance_rate, is_paid, status, favorite, last_run_at, content_html, raw_examples, synced_at)
VALUES (@frontend_id, @title, @title_slug, @difficulty, @tags, @acceptance_rate, @is_paid, 'todo', 0, NULL, NULL, NULL, NULL)
ON CONFLICT(title_slug) DO UPDATE SET
    frontend_id = excluded.frontend_id,
    title = excluded.title,
    difficulty = excluded.difficulty,
    tags = excluded.tags,
    acceptance_rate = excluded.acceptance_rate,
    is_paid = excluded.is_paid";
        cmd.Parameters.AddWithValue("@frontend_id", 0);
        cmd.Parameters.AddWithValue("@title", "");
        cmd.Parameters.AddWithValue("@title_slug", "");
        cmd.Parameters.AddWithValue("@difficulty", "");
        cmd.Parameters.AddWithValue("@tags", "");
        cmd.Parameters.AddWithValue("@acceptance_rate", 0.0);
        cmd.Parameters.AddWithValue("@is_paid", 0);

        foreach (var q in questions)
        {
            if (string.IsNullOrEmpty(q.TitleSlug)) continue;
            cmd.Parameters["@frontend_id"].Value = q.FrontendId;
            cmd.Parameters["@title"].Value = q.Title ?? "";
            cmd.Parameters["@title_slug"].Value = q.TitleSlug;
            cmd.Parameters["@difficulty"].Value = q.Difficulty ?? "";
            cmd.Parameters["@tags"].Value = q.Tags ?? "";
            cmd.Parameters["@acceptance_rate"].Value = q.AcceptanceRate;
            cmd.Parameters["@is_paid"].Value = q.IsPaid ? 1 : 0;
            cmd.ExecuteNonQuery();
        }
        tx.Commit();
    }

    /// <summary>仅更新题面缓存三列。</summary>
    public static void UpdateDetailCache(string slug, string contentHtml, string rawExamples)
    {
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"UPDATE Question SET content_html = @html, raw_examples = @examples, synced_at = @synced WHERE title_slug = @slug";
        cmd.Parameters.AddWithValue("@html", contentHtml ?? "");
        cmd.Parameters.AddWithValue("@examples", rawExamples ?? "");
        cmd.Parameters.AddWithValue("@synced", FormatDate(DateTime.Now));
        cmd.Parameters.AddWithValue("@slug", slug);
        cmd.ExecuteNonQuery();
    }

    public static void SetStatus(int frontendId, string status)
    {
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE Question SET status = @status WHERE frontend_id = @id";
        cmd.Parameters.AddWithValue("@status", status);
        cmd.Parameters.AddWithValue("@id", frontendId);
        cmd.ExecuteNonQuery();
    }

    public static void SetFavorite(int frontendId, bool favorite)
    {
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE Question SET favorite = @fav WHERE frontend_id = @id";
        cmd.Parameters.AddWithValue("@fav", favorite ? 1 : 0);
        cmd.Parameters.AddWithValue("@id", frontendId);
        cmd.ExecuteNonQuery();
    }

    /// <summary>运行后回写最近一次运行时间。</summary>
    public static void TouchLastRun(int frontendId)
    {
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE Question SET last_run_at = @t WHERE frontend_id = @id";
        cmd.Parameters.AddWithValue("@t", FormatDate(DateTime.Now));
        cmd.Parameters.AddWithValue("@id", frontendId);
        cmd.ExecuteNonQuery();
    }

    /// <summary>拆分全表 Tags 逗号串，去重排序供筛选下拉。</summary>
    public static List<string> GetAllTags()
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT tags FROM Question WHERE tags IS NOT NULL AND tags <> ''";
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            foreach (var tag in r.GetString(0).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (tag.Length > 0) set.Add(tag);
            }
        }
        return set.OrderBy(t => t, StringComparer.OrdinalIgnoreCase).ToList();
    }

    public static List<Question> GetFavorites()
    {
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT * FROM Question WHERE favorite = 1 ORDER BY frontend_id ASC";
        using var r = cmd.ExecuteReader();
        var list = new List<Question>();
        while (r.Read()) list.Add(Map(r));
        return list;
    }

    public static int CountAll() => CountWhere("1 = 1", null);

    public static int CountByStatus(string status) => CountWhere("status = @v", status);

    public static int CountByDifficulty(string difficulty) => CountWhere("difficulty = @v", difficulty);

    public static int CountSolvedByDifficulty(string difficulty) => CountWhere("difficulty = @v AND status = 'solved'", difficulty);

    private static int CountWhere(string where, object? value)
    {
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM Question WHERE " + where;
        if (value != null) cmd.Parameters.AddWithValue("@v", value);
        return Convert.ToInt32(cmd.ExecuteScalar());
    }

    /// <summary>清空题目元数据：状态/收藏/运行时间/题面缓存重置（保留行本身与设置）。</summary>
    public static void ClearMetadata()
    {
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"UPDATE Question SET
    status = 'todo',
    favorite = 0,
    last_run_at = NULL,
    content_html = NULL,
    raw_examples = NULL,
    synced_at = NULL";
        cmd.ExecuteNonQuery();
    }
}

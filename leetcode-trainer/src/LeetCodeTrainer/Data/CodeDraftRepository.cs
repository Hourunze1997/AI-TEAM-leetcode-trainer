using LeetCodeTrainer.Models;
using Microsoft.Data.Sqlite;

namespace LeetCodeTrainer.Data;

/// <summary>CodeDraft 表按题目 upsert 保存草稿。</summary>
public static class CodeDraftRepository
{
    public static CodeDraft? GetBySlug(string slug)
    {
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT id, question_slug, code, updated_at FROM CodeDraft WHERE question_slug = @slug LIMIT 1";
        cmd.Parameters.AddWithValue("@slug", slug);
        using var r = cmd.ExecuteReader();
        if (!r.Read()) return null;
        return new CodeDraft
        {
            Id = r.GetInt32(0),
            QuestionSlug = r.GetString(1),
            Code = r.IsDBNull(2) ? "" : r.GetString(2),
            UpdatedAt = DateTime.TryParse(r.IsDBNull(3) ? null : r.GetString(3), out var d) ? d : DateTime.MinValue
        };
    }

    /// <summary>INSERT OR REPLACE 保存草稿。</summary>
    public static void Save(string slug, string code)
    {
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "INSERT OR REPLACE INTO CodeDraft (question_slug, code, updated_at) VALUES (@slug, @code, @updated)";
        cmd.Parameters.AddWithValue("@slug", slug);
        cmd.Parameters.AddWithValue("@code", code ?? "");
        cmd.Parameters.AddWithValue("@updated", DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"));
        cmd.ExecuteNonQuery();
    }

    public static void DeleteForSlug(string slug)
    {
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM CodeDraft WHERE question_slug = @slug";
        cmd.Parameters.AddWithValue("@slug", slug);
        cmd.ExecuteNonQuery();
    }

    public static void ClearAll()
    {
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM CodeDraft";
        cmd.ExecuteNonQuery();
    }
}

using LeetCodeTrainer.Models;
using Microsoft.Data.Sqlite;

namespace LeetCodeTrainer.Data;

/// <summary>TestCase 表按题目整体替换式存储。</summary>
public static class TestCaseRepository
{
    public static List<TestCase> GetBySlug(string slug)
    {
        var list = new List<TestCase>();
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT id, question_slug, input, expected_output FROM TestCase WHERE question_slug = @slug ORDER BY id ASC";
        cmd.Parameters.AddWithValue("@slug", slug);
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            list.Add(new TestCase
            {
                Id = r.GetInt32(0),
                QuestionSlug = r.GetString(1),
                Input = r.IsDBNull(2) ? "" : r.GetString(2),
                ExpectedOutput = r.IsDBNull(3) ? "" : r.GetString(3)
            });
        }
        return list;
    }

    /// <summary>先删后插（事务内），保证重解析后用例集一致。</summary>
    public static void ReplaceForSlug(string slug, List<TestCase> cases)
    {
        using var conn = Db.CreateConnection();
        using var tx = conn.BeginTransaction();

        using (var del = conn.CreateCommand())
        {
            del.Transaction = tx;
            del.CommandText = "DELETE FROM TestCase WHERE question_slug = @slug";
            del.Parameters.AddWithValue("@slug", slug);
            del.ExecuteNonQuery();
        }

        if (cases is { Count: > 0 })
        {
            using var ins = conn.CreateCommand();
            ins.Transaction = tx;
            ins.CommandText = "INSERT INTO TestCase (question_slug, input, expected_output) VALUES (@slug, @input, @expected)";
            ins.Parameters.Add("@slug", SqliteType.Text);
            ins.Parameters.Add("@input", SqliteType.Text);
            ins.Parameters.Add("@expected", SqliteType.Text);
            foreach (var c in cases)
            {
                ins.Parameters["@slug"].Value = slug;
                ins.Parameters["@input"].Value = c.Input ?? "";
                ins.Parameters["@expected"].Value = c.ExpectedOutput ?? "";
                ins.ExecuteNonQuery();
            }
        }

        tx.Commit();
    }

    public static void DeleteForSlug(string slug)
    {
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM TestCase WHERE question_slug = @slug";
        cmd.Parameters.AddWithValue("@slug", slug);
        cmd.ExecuteNonQuery();
    }

    public static void ClearAll()
    {
        using var conn = Db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM TestCase";
        cmd.ExecuteNonQuery();
    }
}

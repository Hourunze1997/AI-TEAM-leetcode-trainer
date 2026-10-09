using Microsoft.Data.Sqlite;

namespace LeetCodeTrainer.Data;

/// <summary>SQLite 基础设施：库文件位于 %AppData%/LeetCodeTrainer/data.db，负责建库建表与连接管理。</summary>
public static class Db
{
    public static string DbPath { get; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "LeetCodeTrainer",
        "data.db");

    private static bool _initialized;

    /// <summary>幂等初始化：建 5 张表与索引。</summary>
    public static void Init()
    {
        if (_initialized) return;
        var dir = Path.GetDirectoryName(DbPath);
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);

        using var conn = CreateConnection();
        const string sql = @"
CREATE TABLE IF NOT EXISTS Question (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    frontend_id INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL DEFAULT '',
    title_slug TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    acceptance_rate REAL NOT NULL DEFAULT 0,
    is_paid INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'todo',
    favorite INTEGER NOT NULL DEFAULT 0,
    last_run_at TEXT,
    content_html TEXT,
    raw_examples TEXT,
    synced_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_question_title_slug ON Question(title_slug);
CREATE INDEX IF NOT EXISTS ix_question_status ON Question(status);
CREATE INDEX IF NOT EXISTS ix_question_difficulty ON Question(difficulty);

CREATE TABLE IF NOT EXISTS TestCase (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_slug TEXT NOT NULL,
    input TEXT NOT NULL DEFAULT '',
    expected_output TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_testcase_slug ON TestCase(question_slug);

CREATE TABLE IF NOT EXISTS CodeDraft (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_slug TEXT NOT NULL,
    code TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_codedraft_slug ON CodeDraft(question_slug);

CREATE TABLE IF NOT EXISTS RunRecord (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_slug TEXT NOT NULL,
    passed_count INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    success INTEGER NOT NULL DEFAULT 0,
    stdout TEXT NOT NULL DEFAULT '',
    stderr TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_runrecord_slug_created ON RunRecord(question_slug, created_at);

CREATE TABLE IF NOT EXISTS AppSetting (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
);";
        using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        cmd.ExecuteNonQuery();
        _initialized = true;
    }

    /// <summary>返回已打开的连接，调用方 using 自管理。</summary>
    public static SqliteConnection CreateConnection()
    {
        var builder = new SqliteConnectionStringBuilder
        {
            DataSource = DbPath,
            Mode = SqliteOpenMode.ReadWriteCreate
        };
        var conn = new SqliteConnection(builder.ToString());
        conn.Open();
        return conn;
    }

    /// <summary>重建索引（清空缓存后调用）。</summary>
    public static void Reindex()
    {
        using var conn = CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "REINDEX;";
        cmd.ExecuteNonQuery();
    }
}

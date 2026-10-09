/**
 * expo-sqlite（openDatabaseSync 新 API）单例连接与建表。
 * 表：floor_plans / calibration_lines / rooms（polygon 存 JSON 字符串）/ quote_items
 */
import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

let dbInstance: SQLiteDatabase | null = null;

/** 返回 openDatabaseSync 打开的单例连接 */
export function getDb(): SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync('floor_area.db');
  }
  return dbInstance;
}

/** 执行四张表的 CREATE TABLE IF NOT EXISTS */
export async function initDatabase(): Promise<void> {
  const db = getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS floor_plans (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      image_uri TEXT NOT NULL,
      scale_px_per_meter REAL,
      building_area_m2 REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calibration_lines (
      id TEXT PRIMARY KEY NOT NULL,
      floor_plan_id TEXT NOT NULL,
      x1 REAL NOT NULL,
      y1 REAL NOT NULL,
      x2 REAL NOT NULL,
      y2 REAL NOT NULL,
      real_length_m REAL NOT NULL,
      pixel_length REAL NOT NULL,
      scale_px_per_meter REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY NOT NULL,
      floor_plan_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      polygon TEXT NOT NULL,
      area_m2 REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quote_items (
      id TEXT PRIMARY KEY NOT NULL,
      floor_plan_id TEXT NOT NULL,
      level TEXT NOT NULL,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity REAL NOT NULL,
      subtotal REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rooms_plan ON rooms(floor_plan_id);
    CREATE INDEX IF NOT EXISTS idx_calib_plan ON calibration_lines(floor_plan_id);
    CREATE INDEX IF NOT EXISTS idx_quote_plan_level ON quote_items(floor_plan_id, level);
  `);
}

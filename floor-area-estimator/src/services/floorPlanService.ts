/**
 * FloorPlan CRUD 服务。
 * 新建时把 image-picker 的临时图片复制到 documentDirectory/images/ 持久化，防止缓存清理后失效。
 */
import * as FileSystem from 'expo-file-system';
import { getDb } from '../db/database';
import { uuid } from '../utils/uuid';
import type { FloorPlan, ProjectSummary } from '../models/types';

function rowToFloorPlan(row: Record<string, unknown>): FloorPlan {
  return {
    id: String(row.id),
    name: String(row.name),
    imageUri: String(row.image_uri),
    scalePxPerMeter:
      row.scale_px_per_meter === null || row.scale_px_per_meter === undefined
        ? null
        : Number(row.scale_px_per_meter),
    buildingAreaM2:
      row.building_area_m2 === null || row.building_area_m2 === undefined
        ? null
        : Number(row.building_area_m2),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/** 把临时图片复制到 documentDirectory/images/，失败时回退原 uri */
async function persistImage(sourceUri: string): Promise<string> {
  try {
    const dir = `${FileSystem.documentDirectory}images`;
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    const extMatch = /\.([a-zA-Z0-9]{2,5})(?:\?|$)/.exec(sourceUri);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
    const dest = `${dir}/${uuid()}.${ext}`;
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
    return dest;
  } catch (e) {
    // 复制失败则沿用临时地址，保证创建流程不中断
    return sourceUri;
  }
}

/** 创建项目：uuid + ISO 时间戳 */
export async function createFloorPlan(input: {
  name: string;
  imageUri: string;
}): Promise<FloorPlan> {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  const uri = await persistImage(input.imageUri);
  await db.runAsync(
    'INSERT INTO floor_plans (id, name, image_uri, scale_px_per_meter, building_area_m2, created_at, updated_at) VALUES (?, ?, ?, NULL, NULL, ?, ?)',
    [id, input.name, uri, now, now],
  );
  return {
    id,
    name: input.name,
    imageUri: uri,
    scalePxPerMeter: null,
    buildingAreaM2: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** 项目列表：LEFT JOIN rooms 求实得面积、JOIN quote_items(standard) 求预算摘要 */
export async function listFloorPlans(): Promise<ProjectSummary[]> {
  const db = getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(`
    SELECT fp.*,
      (SELECT COALESCE(SUM(r.area_m2), 0) FROM rooms r WHERE r.floor_plan_id = fp.id) AS total_area,
      (SELECT COALESCE(SUM(q.subtotal), 0) FROM quote_items q WHERE q.floor_plan_id = fp.id AND q.level = 'standard') AS budget
    FROM floor_plans fp
    ORDER BY fp.created_at DESC
  `);
  return rows.map((row) => {
    const totalArea = Number(row.total_area) || 0;
    const budget = Number(row.budget) || 0;
    return {
      plan: rowToFloorPlan(row),
      totalAreaM2: Math.round(totalArea * 100) / 100,
      budget: budget > 0 ? budget : null,
    };
  });
}

/** 项目详情 */
export async function getFloorPlan(id: string): Promise<FloorPlan | null> {
  const db = getDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM floor_plans WHERE id = ?',
    [id],
  );
  return row ? rowToFloorPlan(row) : null;
}

/** 重命名项目 */
export async function renameFloorPlan(id: string, name: string): Promise<void> {
  const db = getDb();
  await db.runAsync('UPDATE floor_plans SET name = ?, updated_at = ? WHERE id = ?', [
    name,
    new Date().toISOString(),
    id,
  ]);
}

/** 删除项目：事务内级联清理 rooms / calibration_lines / quote_items */
export async function deleteFloorPlan(id: string): Promise<void> {
  const db = getDb();
  const plan = await getFloorPlan(id);
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM rooms WHERE floor_plan_id = ?', [id]);
    await db.runAsync('DELETE FROM calibration_lines WHERE floor_plan_id = ?', [id]);
    await db.runAsync('DELETE FROM quote_items WHERE floor_plan_id = ?', [id]);
    await db.runAsync('DELETE FROM floor_plans WHERE id = ?', [id]);
  });
  // 尽力清理持久化图片（仅清理应用文档目录内的文件）
  if (plan && plan.imageUri.startsWith(FileSystem.documentDirectory ?? '__never__')) {
    try {
      await FileSystem.deleteAsync(plan.imageUri, { idempotent: true });
    } catch (e) {
      // 忽略文件删除失败
    }
  }
}

/** 标定后回写每米像素数（以最新一条标定为准，由调用方保证） */
export async function updateScale(id: string, scalePxPerMeter: number): Promise<void> {
  if (!scalePxPerMeter || scalePxPerMeter <= 0) throw new Error('scale 无效');
  const db = getDb();
  await db.runAsync('UPDATE floor_plans SET scale_px_per_meter = ?, updated_at = ? WHERE id = ?', [
    scalePxPerMeter,
    new Date().toISOString(),
    id,
  ]);
}

/** 保存建筑面积（米²），用于得房率计算；传 null 表示清空 */
export async function updateBuildingArea(
  id: string,
  buildingAreaM2: number | null,
): Promise<void> {
  const db = getDb();
  await db.runAsync('UPDATE floor_plans SET building_area_m2 = ?, updated_at = ? WHERE id = ?', [
    buildingAreaM2,
    new Date().toISOString(),
    id,
  ]);
}

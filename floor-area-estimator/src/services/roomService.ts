/**
 * 房间服务：保存多边形（用项目当前 scale 计算面积）、按项目列表、删除。
 * polygon 在 DB 中存 JSON 字符串，读取时解析回 Point[]。
 */
import { getDb } from '../db/database';
import { polygonAreaM2 } from '../geometry/geometry';
import { getFloorPlan } from './floorPlanService';
import { uuid } from '../utils/uuid';
import type { Point, Room, RoomType } from '../models/types';

function parsePolygon(json: string): Point[] {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((p) => p && typeof p.x === 'number' && typeof p.y === 'number')
      .map((p) => ({ x: p.x as number, y: p.y as number }));
  } catch (e) {
    return [];
  }
}

function rowToRoom(row: Record<string, unknown>): Room {
  return {
    id: String(row.id),
    floorPlanId: String(row.floor_plan_id),
    name: String(row.name),
    type: String(row.type) as RoomType,
    polygon: parsePolygon(String(row.polygon)),
    areaM2: Number(row.area_m2) || 0,
    createdAt: String(row.created_at),
  };
}

/** 保存房间：读取项目当前 scale 用鞋带公式计算 areaM2 后落库 */
export async function saveRoom(input: {
  floorPlanId: string;
  name: string;
  type: RoomType;
  polygon: Point[];
}): Promise<Room> {
  if (!input.polygon || input.polygon.length < 3) {
    throw new Error('多边形至少需要 3 个顶点');
  }
  const plan = await getFloorPlan(input.floorPlanId);
  if (!plan) throw new Error('项目不存在');
  if (plan.scalePxPerMeter === null || plan.scalePxPerMeter <= 0) {
    throw new Error('请先标定比例尺');
  }
  const areaM2 = polygonAreaM2(input.polygon, plan.scalePxPerMeter);

  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO rooms (id, floor_plan_id, name, type, polygon, area_m2, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, input.floorPlanId, input.name, input.type, JSON.stringify(input.polygon), areaM2, now],
  );
  return {
    id,
    floorPlanId: input.floorPlanId,
    name: input.name,
    type: input.type,
    polygon: input.polygon,
    areaM2,
    createdAt: now,
  };
}

/** 按项目列出房间（按创建顺序） */
export async function listRooms(floorPlanId: string): Promise<Room[]> {
  const db = getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM rooms WHERE floor_plan_id = ? ORDER BY created_at ASC, rowid ASC',
    [floorPlanId],
  );
  return rows.map(rowToRoom);
}

/** 删除房间 */
export async function deleteRoom(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM rooms WHERE id = ?', [id]);
}

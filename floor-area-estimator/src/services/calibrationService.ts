/**
 * 标定线服务：保存线段并按「像素距离 / 真实米数」换算 scalePxPerMeter 回写 floor_plans。
 * 多次标定以最新一条为准（每次都直接覆盖项目 scale）。
 */
import { getDb } from '../db/database';
import { distance } from '../geometry/geometry';
import { updateScale } from './floorPlanService';
import { uuid } from '../utils/uuid';
import type { CalibrationLine } from '../models/types';

function rowToLine(row: Record<string, unknown>): CalibrationLine {
  return {
    id: String(row.id),
    floorPlanId: String(row.floor_plan_id),
    x1: Number(row.x1),
    y1: Number(row.y1),
    x2: Number(row.x2),
    y2: Number(row.y2),
    realLengthM: Number(row.real_length_m),
    pixelLength: Number(row.pixel_length),
    scalePxPerMeter: Number(row.scale_px_per_meter),
    createdAt: String(row.created_at),
  };
}

/**
 * 保存标定线，并以 像素距离/真实米数 更新项目 scale。
 * 返回保存后的标定线与最新 scale。
 */
export async function addCalibrationLine(
  floorPlanId: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  realLengthM: number,
): Promise<{ line: CalibrationLine; scalePxPerMeter: number }> {
  if (!isFinite(realLengthM) || realLengthM <= 0) {
    throw new Error('真实长度必须大于 0 米');
  }
  const pixelLength = distance(x1, y1, x2, y2);
  if (pixelLength < 1) {
    throw new Error('两个标定点距离太近，请在图上拉开距离');
  }
  const scale = pixelLength / realLengthM;

  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO calibration_lines
      (id, floor_plan_id, x1, y1, x2, y2, real_length_m, pixel_length, scale_px_per_meter, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, floorPlanId, x1, y1, x2, y2, realLengthM, pixelLength, scale, now],
  );
  await updateScale(floorPlanId, scale);

  const line: CalibrationLine = {
    id,
    floorPlanId,
    x1,
    y1,
    x2,
    y2,
    realLengthM,
    pixelLength,
    scalePxPerMeter: scale,
    createdAt: now,
  };
  return { line, scalePxPerMeter: scale };
}

/** 按项目查询历史标定线（时间正序） */
export async function listCalibrationLines(floorPlanId: string): Promise<CalibrationLine[]> {
  const db = getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM calibration_lines WHERE floor_plan_id = ? ORDER BY created_at ASC, rowid ASC',
    [floorPlanId],
  );
  return rows.map(rowToLine);
}

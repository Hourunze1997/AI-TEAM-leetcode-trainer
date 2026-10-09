/**
 * 纯几何工具（无 React Native 依赖，便于 Jest 单测）。
 * 坐标系统一为原图像素坐标。
 */
import type { Point } from '../models/types';

/** 两点欧氏距离（像素） */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 鞋带公式：多边形有向面积取绝对值，返回像素² */
export function shoelaceArea(points: Point[]): number {
  if (!points || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** 像素²面积 / scale² 得平方米，保留两位小数 */
export function polygonAreaM2(points: Point[], scalePxPerMeter: number): number {
  if (!scalePxPerMeter || scalePxPerMeter <= 0) return 0;
  const px2 = shoelaceArea(points);
  const m2 = px2 / (scalePxPerMeter * scalePxPerMeter);
  return Math.round(m2 * 100) / 100;
}

/** 多边形顶点均值质心，用于标签定位 */
export function centroid(points: Point[]): Point {
  if (!points || points.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}

/** 射线法点包含判断（预留 tap 选中房间） */
export function pointInPolygon(p: Point, poly: Point[]): boolean {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

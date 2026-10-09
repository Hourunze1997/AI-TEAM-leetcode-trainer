/** 全部领域类型定义 */

export type RoomType = 'bedroom' | 'living' | 'kitchen' | 'bathroom' | 'balcony' | 'other';
export type QuoteLevel = 'basic' | 'standard' | 'premium';
export type Tool = 'view' | 'calibrate' | 'draw';

export interface Point {
  x: number;
  y: number;
}

export interface FloorPlan {
  id: string;
  name: string;
  imageUri: string;
  /** 每米对应的原图像素数，标定后写入；null 表示未标定 */
  scalePxPerMeter: number | null;
  buildingAreaM2: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CalibrationLine {
  id: string;
  floorPlanId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  realLengthM: number;
  pixelLength: number;
  scalePxPerMeter: number;
  createdAt: string;
}

export interface Room {
  id: string;
  floorPlanId: string;
  name: string;
  type: RoomType;
  polygon: Point[];
  areaM2: number;
  createdAt: string;
}

export interface QuoteTemplate {
  category: string;
  name: string;
  unit: string;
  defaultPrice: number;
}

export interface QuoteItem {
  id: string;
  floorPlanId: string;
  level: QuoteLevel;
  category: string;
  name: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

/** 项目列表条目：FloorPlan + 实得面积汇总 + standard 档预算摘要 */
export interface ProjectSummary {
  plan: FloorPlan;
  totalAreaM2: number;
  budget: number | null;
}

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  bedroom: '卧室',
  living: '客厅',
  kitchen: '厨房',
  bathroom: '卫生间',
  balcony: '阳台',
  other: '其他',
};

export const QUOTE_LEVELS: QuoteLevel[] = ['basic', 'standard', 'premium'];

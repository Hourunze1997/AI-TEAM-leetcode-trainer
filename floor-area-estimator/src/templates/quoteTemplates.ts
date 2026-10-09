/**
 * 内置装修报价模板：三档（basic/standard/premium）× 六大类（拆改/水电/泥瓦/木工/油漆/主材）。
 * 纯数据 + 纯函数，便于 Jest 单测。
 * 价格规律：standard ≈ basic × 1.6，premium ≈ basic × 2.8。
 */
import type { QuoteLevel, QuoteTemplate } from '../models/types';

/** 分组排序顺序 */
export const CATEGORY_ORDER = ['拆改', '水电', '泥瓦', '木工', '油漆', '主材'];

/** 档位中文名 */
export const LEVEL_LABELS: Record<QuoteLevel, string> = {
  basic: '基础档',
  standard: '标准档',
  premium: '豪华档',
};

interface BaseRow {
  category: string;
  name: string;
  unit: string;
  /** 基础档参考价 */
  basicPrice: number;
}

const BASE_ROWS: BaseRow[] = [
  // 拆改
  { category: '拆改', name: '墙体拆除', unit: '元/㎡', basicPrice: 35 },
  { category: '拆改', name: '墙体新建', unit: '元/㎡', basicPrice: 120 },
  { category: '拆改', name: '开槽布线', unit: '元/延米', basicPrice: 18 },
  { category: '拆改', name: '垃圾清运', unit: '元/项', basicPrice: 800 },
  { category: '拆改', name: '门洞改造', unit: '元/项', basicPrice: 300 },
  { category: '拆改', name: '墙面修复找平', unit: '元/㎡', basicPrice: 25 },
  // 水电
  { category: '水电', name: '水路改造', unit: '元/延米', basicPrice: 55 },
  { category: '水电', name: '电路改造', unit: '元/延米', basicPrice: 45 },
  { category: '水电', name: '强弱电箱改造', unit: '元/项', basicPrice: 450 },
  { category: '水电', name: '开关插座安装', unit: '元/项', basicPrice: 15 },
  { category: '水电', name: '灯具安装', unit: '元/项', basicPrice: 25 },
  { category: '水电', name: '卫生间防水', unit: '元/㎡', basicPrice: 60 },
  // 泥瓦
  { category: '泥瓦', name: '地砖铺贴', unit: '元/㎡', basicPrice: 55 },
  { category: '泥瓦', name: '墙砖铺贴', unit: '元/㎡', basicPrice: 60 },
  { category: '泥瓦', name: '地面找平', unit: '元/㎡', basicPrice: 30 },
  { category: '泥瓦', name: '包立管', unit: '元/延米', basicPrice: 150 },
  { category: '泥瓦', name: '踢脚线安装', unit: '元/延米', basicPrice: 12 },
  { category: '泥瓦', name: '窗台石铺贴', unit: '元/延米', basicPrice: 80 },
  // 木工
  { category: '木工', name: '石膏板吊顶', unit: '元/㎡', basicPrice: 110 },
  { category: '木工', name: '石膏板隔墙', unit: '元/㎡', basicPrice: 95 },
  { category: '木工', name: '定制柜体', unit: '元/㎡', basicPrice: 380 },
  { category: '木工', name: '门套窗套', unit: '元/延米', basicPrice: 90 },
  { category: '木工', name: '背景墙基层', unit: '元/㎡', basicPrice: 160 },
  { category: '木工', name: '木地板铺装', unit: '元/㎡', basicPrice: 40 },
  // 油漆
  { category: '油漆', name: '墙面乳胶漆', unit: '元/㎡', basicPrice: 28 },
  { category: '油漆', name: '墙面基层处理', unit: '元/㎡', basicPrice: 18 },
  { category: '油漆', name: '顶面乳胶漆', unit: '元/㎡', basicPrice: 26 },
  { category: '油漆', name: '木器漆', unit: '元/㎡', basicPrice: 65 },
  { category: '油漆', name: '墙纸墙布铺贴', unit: '元/㎡', basicPrice: 45 },
  { category: '油漆', name: '艺术漆', unit: '元/㎡', basicPrice: 90 },
  // 主材
  { category: '主材', name: '地砖主材', unit: '元/㎡', basicPrice: 90 },
  { category: '主材', name: '木地板主材', unit: '元/㎡', basicPrice: 120 },
  { category: '主材', name: '室内门', unit: '元/项', basicPrice: 1200 },
  { category: '主材', name: '洁具套装', unit: '元/项', basicPrice: 1800 },
  { category: '主材', name: '橱柜', unit: '元/延米', basicPrice: 900 },
  { category: '主材', name: '灯具主材', unit: '元/项', basicPrice: 600 },
];

const LEVEL_MULTIPLIER: Record<QuoteLevel, number> = {
  basic: 1,
  standard: 1.6,
  premium: 2.8,
};

function buildTemplates(): Record<QuoteLevel, QuoteTemplate[]> {
  const result = {
    basic: [] as QuoteTemplate[],
    standard: [] as QuoteTemplate[],
    premium: [] as QuoteTemplate[],
  };
  (Object.keys(LEVEL_MULTIPLIER) as QuoteLevel[]).forEach((level) => {
    result[level] = BASE_ROWS.map((row) => ({
      category: row.category,
      name: row.name,
      unit: row.unit,
      defaultPrice: Math.round(row.basicPrice * LEVEL_MULTIPLIER[level]),
    }));
  });
  return result;
}

/** 三档完整模板（行业参考单价） */
export const QUOTE_TEMPLATES: Record<QuoteLevel, QuoteTemplate[]> = buildTemplates();

/**
 * 默认数量规则：
 * 元/㎡ → 实得面积；元/延米 → 10；元/项 → 1
 */
export function quantityFor(unit: string, totalAreaM2: number): number {
  if (unit === '元/㎡') {
    const q = Math.round((totalAreaM2 || 0) * 100) / 100;
    return Math.max(0, q);
  }
  if (unit === '元/延米') return 10;
  return 1;
}

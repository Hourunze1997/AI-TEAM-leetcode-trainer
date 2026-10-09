/**
 * 零依赖 uuid v4 生成。
 * 优先使用 crypto.getRandomValues（Hermes / RN 环境可能缺失，需回退）。
 */
export function uuid(): string {
  try {
    const g = globalThis as unknown as {
      crypto?: { getRandomValues?: (arr: Uint8Array) => Uint8Array };
    };
    if (g.crypto && typeof g.crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      g.crypto.getRandomValues(bytes);
      // 设置 version(4) 与 variant(10xx) 位
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch (e) {
    // 忽略，走 Math.random 回退
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

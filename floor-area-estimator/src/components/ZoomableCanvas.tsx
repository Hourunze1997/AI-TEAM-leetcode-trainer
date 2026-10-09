/**
 * 可缩放平移画布：
 * - PanResponder 单指拖动平移、双指捏合缩放（以两指中点为锚点，scale 限制 0.5~5）
 * - 位移 < 6px 且时长 < 350ms 判定为 tap，经 toImageCoords 换算成原图像素坐标回调 onTapImage
 * - children(render prop) 作为 SVG 覆盖层放在被 transform 的内层 View 中
 *
 * 坐标契约：RN transform 以视图中心为原点，故
 *   screen = scale * (p - center) + center + translate
 * toImageCoords 中 offsetX/offsetY 需传入「容器原点 + 平移量」的合并值。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import type { Point } from '../models/types';

export interface ImgSize {
  width: number;
  height: number;
}

export interface CanvasInfo {
  imgW: number;
  imgH: number;
  /** 适配屏幕后的显示尺寸（等比） */
  width: number;
  height: number;
}

interface Transform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface Props {
  imageUri: string;
  onTapImage?: (p: Point) => void;
  children?: (info: CanvasInfo) => React.ReactNode;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const TAP_SLOP_PX = 6;
const TAP_MAX_MS = 350;

/**
 * 屏幕坐标 → 原图像素坐标。
 * transform.offsetX/offsetY = 容器在窗口中的原点 + 当前平移量（合并后）。
 */
export function toImageCoords(
  pageX: number,
  pageY: number,
  transform: Transform,
  imgSize: ImgSize,
  baseWidth: number,
): Point {
  if (baseWidth <= 0 || imgSize.width <= 0 || imgSize.height <= 0 || transform.scale <= 0) {
    return { x: 0, y: 0 };
  }
  const ratio = imgSize.width / baseWidth;
  const baseHeight = baseWidth * (imgSize.height / imgSize.width);
  const cx = baseWidth / 2;
  const cy = baseHeight / 2;
  // 相对容器的坐标
  const sx = pageX - transform.offsetX;
  const sy = pageY - transform.offsetY;
  // 逆变换（中心为 transform 原点），再乘显示→原图比例
  const px = cx + (sx - cx) / transform.scale;
  const py = cy + (sy - cy) / transform.scale;
  return { x: px * ratio, y: py * ratio };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** 平移量限位：scale>1 时限制内容不出界，scale<=1 时回中 */
function clampOffset(offset: number, baseSize: number, scale: number): number {
  if (baseSize <= 0) return 0;
  if (scale <= 1) return 0;
  const bound = (baseSize / 2) * (scale - 1);
  return clamp(offset, -bound, bound);
}

export default function ZoomableCanvas({ imageUri, onTapImage, children }: Props) {
  const [imgSize, setImgSize] = useState<ImgSize>({ width: 0, height: 0 });
  const [container, setContainer] = useState({ w: 0, h: 0 });
  const containerRef = useRef<View | null>(null);
  const originRef = useRef({ x: 0, y: 0 });

  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  // 与 Animated.Value 同步的当前变换值（供 tap 换算使用）
  const tr = useRef({ scale: 1, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    const s = scale.addListener(({ value }) => {
      tr.current.scale = value;
    });
    const x = translateX.addListener(({ value }) => {
      tr.current.offsetX = value;
    });
    const y = translateY.addListener(({ value }) => {
      tr.current.offsetY = value;
    });
    return () => {
      scale.removeListener(s);
      translateX.removeListener(x);
      translateY.removeListener(y);
    };
  }, [scale, translateX, translateY]);

  // 加载原图尺寸，并重置视图
  useEffect(() => {
    let cancelled = false;
    scale.setValue(1);
    translateX.setValue(0);
    translateY.setValue(0);
    const fallback = () => {
      if (!cancelled) setImgSize({ width: 1080, height: 810 });
    };
    try {
      Image.getSize(
        imageUri,
        (w, h) => {
          if (!cancelled && w > 0 && h > 0) setImgSize({ width: w, height: h });
          else if (!cancelled) fallback();
        },
        () => fallback(),
      );
    } catch (e) {
      fallback();
    }
    return () => {
      cancelled = true;
    };
  }, [imageUri, scale, translateX, translateY]);

  /** 等比适配容器（fit，宽优先） */
  const fit = useMemo(() => {
    if (!imgSize.width || !imgSize.height || !container.w || !container.h) {
      return { width: 0, height: 0 };
    }
    const s = Math.min(container.w / imgSize.width, (container.h * 0.98) / imgSize.height);
    return {
      width: Math.max(1, Math.floor(imgSize.width * s)),
      height: Math.max(1, Math.floor(imgSize.height * s)),
    };
  }, [imgSize, container]);

  // 保证手势回调读到最新 props 与尺寸
  const latest = useRef({ onTapImage, fitW: 0, fitH: 0, imgW: 0, imgH: 0 });
  latest.current = {
    onTapImage,
    fitW: fit.width,
    fitH: fit.height,
    imgW: imgSize.width,
    imgH: imgSize.height,
  };

  const gesture = useRef({
    startPageX: 0,
    startPageY: 0,
    lastPageX: 0,
    lastPageY: 0,
    startTime: 0,
    isPinch: false,
    everPinch: false,
    pinchStartDist: 1,
    baseScale: 1,
    baseOffsetX: 0,
    baseOffsetY: 0,
    anchorX: 0,
    anchorY: 0,
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const g = gesture.current;
        g.startTime = Date.now();
        g.startPageX = e.nativeEvent.pageX;
        g.startPageY = e.nativeEvent.pageY;
        g.lastPageX = e.nativeEvent.pageX;
        g.lastPageY = e.nativeEvent.pageY;
        g.isPinch = false;
        g.everPinch = false;
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const g = gesture.current;
        const t0 = tr.current;
        const touches = e.nativeEvent.touches;

        if (touches.length >= 2) {
          // 双指：首次进入时以当前变换为基准初始化捏合
          if (!g.isPinch) {
            g.isPinch = true;
            g.everPinch = true;
            g.baseScale = t0.scale;
            g.baseOffsetX = t0.offsetX;
            g.baseOffsetY = t0.offsetY;
            g.pinchStartDist = Math.max(
              1,
              Math.hypot(
                touches[0].pageX - touches[1].pageX,
                touches[0].pageY - touches[1].pageY,
              ),
            );
            g.anchorX = (touches[0].pageX + touches[1].pageX) / 2;
            g.anchorY = (touches[0].pageY + touches[1].pageY) / 2;
          }
          const info = latest.current;
          const d = Math.max(
            1,
            Math.hypot(
              touches[0].pageX - touches[1].pageX,
              touches[0].pageY - touches[1].pageY,
            ),
          );
          const newScale = clamp((g.baseScale * d) / g.pinchStartDist, MIN_SCALE, MAX_SCALE);
          // 锚点（容器坐标）
          const ax = g.anchorX - originRef.current.x;
          const ay = g.anchorY - originRef.current.y;
          const cx = info.fitW / 2;
          const cy = info.fitH / 2;
          // 变换中心为视图中心：screen = scale*(p-c)+c+t
          const pax = cx + (ax - cx - g.baseOffsetX) / g.baseScale;
          const pay = cy + (ay - cy - g.baseOffsetY) / g.baseScale;
          const nt1x = clampOffset(ax - cx - newScale * (pax - cx), info.fitW, newScale);
          const nt1y = clampOffset(ay - cy - newScale * (pay - cy), info.fitH, newScale);
          translateX.setValue(nt1x);
          translateY.setValue(nt1y);
          scale.setValue(newScale);
        } else {
          // 双指回到单指：重新记录基准点，避免跳动
          if (g.isPinch) {
            g.isPinch = false;
            g.lastPageX = e.nativeEvent.pageX;
            g.lastPageY = e.nativeEvent.pageY;
            return;
          }
          const dx = e.nativeEvent.pageX - g.lastPageX;
          const dy = e.nativeEvent.pageY - g.lastPageY;
          g.lastPageX = e.nativeEvent.pageX;
          g.lastPageY = e.nativeEvent.pageY;
          const info = latest.current;
          const nx = clampOffset(t0.offsetX + dx, info.fitW, t0.scale);
          const ny = clampOffset(t0.offsetY + dy, info.fitH, t0.scale);
          translateX.setValue(nx);
          translateY.setValue(ny);
        }
      },
      onPanResponderRelease: (e: GestureResponderEvent, gs: PanResponderGestureState) => {
        const g = gesture.current;
        const dt = Date.now() - g.startTime;
        const moved = Math.hypot(
          e.nativeEvent.pageX - g.startPageX,
          e.nativeEvent.pageY - g.startPageY,
        );
        const info = latest.current;
        // tap 判定：未捏合过 + 小位移 + 短时长 + 单指
        if (
          !g.everPinch &&
          moved < TAP_SLOP_PX &&
          dt < TAP_MAX_MS &&
          gs.numberActiveTouches <= 1 &&
          info.onTapImage &&
          info.fitW > 0 &&
          info.imgW > 0
        ) {
          const p = toImageCoords(
            e.nativeEvent.pageX,
            e.nativeEvent.pageY,
            {
              scale: tr.current.scale,
              offsetX: tr.current.offsetX + originRef.current.x,
              offsetY: tr.current.offsetY + originRef.current.y,
            },
            { width: info.imgW, height: info.imgH },
            info.fitW,
          );
          info.onTapImage(p);
        }
        g.isPinch = false;
        g.everPinch = false;
      },
      onPanResponderTerminate: () => {
        const g = gesture.current;
        g.isPinch = false;
        g.everPinch = false;
      },
    }),
  ).current;

  const handleLayout = useCallback(() => {
    containerRef.current?.measureInWindow((x, y, w, h) => {
      originRef.current = { x, y };
      setContainer({ w, h });
    });
  }, []);

  return (
    <View
      ref={containerRef}
      style={styles.container}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      {fit.width > 0 ? (
        <Animated.View
          style={{
            width: fit.width,
            height: fit.height,
            transform: [{ translateX }, { translateY }, { scale }],
          }}
        >
          <Image
            source={{ uri: imageUri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="stretch"
          />
          {/* SVG 覆盖层：不拦截手势 */}
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, top: 0, width: fit.width, height: fit.height }}
          >
            {children
              ? children({
                  imgW: imgSize.width,
                  imgH: imgSize.height,
                  width: fit.width,
                  height: fit.height,
                })
              : null}
          </View>
        </Animated.View>
      ) : (
        <Text style={styles.hint}>图纸加载中…</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E2430',
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  hint: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 24,
    alignSelf: 'center',
  },
});

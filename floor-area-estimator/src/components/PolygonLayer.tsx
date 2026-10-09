/**
 * 房间层 SVG 覆盖层（需置于 <Svg> 内）：
 * - 已保存房间：按 type 映射半透明填充色的 Polygon，质心处标注「名称 + 面积」
 * - 绘制中：折线 + 顶点圆点 + 首尾闭合虚线
 */
import React from 'react';
import {
  Circle,
  Line,
  Polygon as SvgPolygon,
  Polyline,
  Text as SvgText,
  Tspan,
} from 'react-native-svg';
import type { Point, Room, RoomType } from '../models/types';
import { centroid } from '../geometry/geometry';
import { formatM2 } from '../utils/format';

interface Props {
  rooms: Room[];
  currentPolygon: Point[];
  imgW: number;
}

const ROOM_COLORS: Record<RoomType, string> = {
  bedroom: '#4C7DF0',
  living: '#E8912D',
  kitchen: '#57A773',
  bathroom: '#3FB8AF',
  balcony: '#9B6BC3',
  other: '#8A94A6',
};

const CURRENT_COLOR = '#2563EB';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pointsAttr(points: Point[]): string {
  return points.map((p) => `${round2(p.x)},${round2(p.y)}`).join(' ');
}

export default function PolygonLayer({ rooms, currentPolygon, imgW }: Props) {
  const strokeW = Math.max(1.5, imgW * 0.0025);
  const dotR = Math.max(4, imgW * 0.006);
  const fontSize = Math.max(12, imgW * 0.02);

  return (
    <>
      {rooms.map((room) => {
        const color = ROOM_COLORS[room.type] ?? ROOM_COLORS.other;
        const c = centroid(room.polygon);
        return (
          <React.Fragment key={room.id}>
            <SvgPolygon
              points={pointsAttr(room.polygon)}
              fill={color}
              fillOpacity={0.22}
              stroke={color}
              strokeWidth={strokeW}
              strokeLinejoin="round"
            />
            <SvgText
              x={c.x}
              y={c.y}
              fontSize={fontSize}
              fontWeight="bold"
              fill="#1F2937"
              textAnchor="middle"
            >
              <Tspan x={c.x} dy={0}>
                {room.name}
              </Tspan>
              <Tspan x={c.x} dy={fontSize * 1.35} fill="#374151">
                {formatM2(room.areaM2)}
              </Tspan>
            </SvgText>
          </React.Fragment>
        );
      })}

      {currentPolygon.length > 0 && (
        <>
          {currentPolygon.length >= 2 && (
            <Polyline
              points={pointsAttr(currentPolygon)}
              fill="none"
              stroke={CURRENT_COLOR}
              strokeWidth={strokeW}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {currentPolygon.length >= 3 && (
            <Line
              x1={currentPolygon[currentPolygon.length - 1].x}
              y1={currentPolygon[currentPolygon.length - 1].y}
              x2={currentPolygon[0].x}
              y2={currentPolygon[0].y}
              stroke={CURRENT_COLOR}
              strokeWidth={strokeW * 0.8}
              strokeDasharray="8 6"
            />
          )}
          {currentPolygon.map((p, i) => (
            <Circle
              key={`dot-${i}`}
              cx={p.x}
              cy={p.y}
              r={dotR}
              fill={CURRENT_COLOR}
              stroke="#FFFFFF"
              strokeWidth={strokeW * 0.6}
            />
          ))}
        </>
      )}
    </>
  );
}

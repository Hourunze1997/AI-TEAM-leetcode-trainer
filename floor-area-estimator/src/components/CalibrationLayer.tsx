/**
 * 标定层 SVG 覆盖层（需置于 <Svg> 内）：
 * - 已保存标定线：Line + 两端 Circle + 真实长度 Text
 * - 进行中：两个待选点 Circle 与虚线
 * 颜色使用醒目橙红，与房间多边形区分。
 */
import React from 'react';
import { Circle, Line, Text as SvgText } from 'react-native-svg';
import type { CalibrationLine, Point } from '../models/types';

interface Props {
  lines: CalibrationLine[];
  pendingPoints: Point[];
  imgW: number;
}

const COLOR = '#FF4D1C';

export default function CalibrationLayer({ lines, pendingPoints, imgW }: Props) {
  const strokeW = Math.max(2, imgW * 0.003);
  const dotR = Math.max(5, imgW * 0.007);
  const fontSize = Math.max(12, imgW * 0.02);

  return (
    <>
      {lines.map((l) => {
        const mx = (l.x1 + l.x2) / 2;
        const my = (l.y1 + l.y2) / 2;
        return (
          <React.Fragment key={l.id}>
            <Line
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke={COLOR}
              strokeWidth={strokeW}
              strokeLinecap="round"
            />
            <Circle cx={l.x1} cy={l.y1} r={dotR} fill={COLOR} stroke="#FFFFFF" strokeWidth={strokeW * 0.5} />
            <Circle cx={l.x2} cy={l.y2} r={dotR} fill={COLOR} stroke="#FFFFFF" strokeWidth={strokeW * 0.5} />
            <SvgText
              x={mx}
              y={my - fontSize * 0.8}
              fontSize={fontSize}
              fontWeight="bold"
              fill={COLOR}
              stroke="#FFFFFF"
              strokeWidth={fontSize * 0.16}
              textAnchor="middle"
            >
              {`${l.realLengthM.toFixed(2)} m`}
            </SvgText>
          </React.Fragment>
        );
      })}

      {pendingPoints.length > 0 && (
        <>
          {pendingPoints.length === 2 && (
            <Line
              x1={pendingPoints[0].x}
              y1={pendingPoints[0].y}
              x2={pendingPoints[1].x}
              y2={pendingPoints[1].y}
              stroke={COLOR}
              strokeWidth={strokeW}
              strokeDasharray="8 6"
            />
          )}
          {pendingPoints.map((p, i) => (
            <Circle
              key={`pending-${i}`}
              cx={p.x}
              cy={p.y}
              r={dotR}
              fill="#FFFFFF"
              stroke={COLOR}
              strokeWidth={strokeW}
            />
          ))}
        </>
      )}
    </>
  );
}

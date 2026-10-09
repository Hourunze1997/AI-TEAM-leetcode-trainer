/**
 * 编辑页底部工具条：查看/标定/绘制 三模式切换、撤销上一顶点、闭合多边形、重新开始。
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Tool } from '../models/types';

interface Props {
  tool: Tool;
  onToolChange: (t: Tool) => void;
  onUndo: () => void;
  onClosePolygon: () => void;
  onRestart: () => void;
  canUndo: boolean;
  canClose: boolean;
  hint?: string | null;
}

const TOOLS: { key: Tool; label: string }[] = [
  { key: 'view', label: '查看' },
  { key: 'calibrate', label: '标定' },
  { key: 'draw', label: '绘制' },
];

export default function ToolBar({
  tool,
  onToolChange,
  onUndo,
  onClosePolygon,
  onRestart,
  canUndo,
  canClose,
  hint,
}: Props) {
  return (
    <View style={styles.wrap}>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.row}>
        <View style={styles.modeGroup}>
          {TOOLS.map((t) => {
            const active = tool === t.key;
            return (
              <Pressable
                key={t.key}
                style={[styles.modeBtn, active && styles.modeBtnActive]}
                onPress={() => onToolChange(t.key)}
              >
                <Text style={[styles.modeText, active && styles.modeTextActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.actionGroup}>
          <Pressable
            style={[styles.actionBtn, !canUndo && styles.disabled]}
            disabled={!canUndo}
            onPress={onUndo}
          >
            <Text style={[styles.actionText, !canUndo && styles.disabledText]}>撤销</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.actionPrimary, !canClose && styles.disabled]}
            disabled={!canClose}
            onPress={onClosePolygon}
          >
            <Text style={[styles.actionTextLight, !canClose && styles.disabledText]}>闭合</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={onRestart}>
            <Text style={styles.actionText}>重开</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  hint: {
    color: '#D97706',
    fontSize: 12,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeGroup: {
    flexDirection: 'row',
    backgroundColor: '#EEF1F5',
    borderRadius: 10,
    padding: 3,
  },
  modeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  modeBtnActive: {
    backgroundColor: '#2563EB',
  },
  modeText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
    backgroundColor: '#EEF1F5',
  },
  actionPrimary: {
    backgroundColor: '#2563EB',
  },
  disabled: {
    opacity: 0.4,
  },
  actionText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  actionTextLight: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledText: {
    color: '#9CA3AF',
  },
});

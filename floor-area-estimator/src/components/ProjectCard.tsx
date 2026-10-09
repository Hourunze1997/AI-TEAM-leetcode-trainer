/**
 * 项目列表卡片：缩略图 + 名称 + 实得面积 + standard 档预算摘要 + 删除按钮。
 */
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ProjectSummary } from '../models/types';
import { formatM2, formatMoney } from '../utils/format';

interface Props {
  summary: ProjectSummary;
  onPress: () => void;
  onLongPress: () => void;
  onDelete: () => void;
}

export default function ProjectCard({ summary, onPress, onLongPress, onDelete }: Props) {
  const { plan } = summary;
  return (
    <Pressable style={styles.card} onPress={onPress} onLongPress={onLongPress}>
      {plan.imageUri ? (
        <Image source={{ uri: plan.imageUri }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Text style={styles.placeholderText}>图</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.name}>
          {plan.name}
        </Text>
        <Text style={styles.area}>实得面积 {formatM2(summary.totalAreaM2)}</Text>
        <Text style={styles.budget}>
          {summary.budget ? `标准档预算 ${formatMoney(summary.budget)}` : '尚未生成报价'}
        </Text>
      </View>
      <Pressable hitSlop={10} style={styles.delBtn} onPress={onDelete}>
        <Text style={styles.delText}>删除</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  area: {
    marginTop: 3,
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
  },
  budget: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  delBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  delText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
});

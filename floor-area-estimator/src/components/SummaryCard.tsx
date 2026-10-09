/**
 * 通用汇总卡片（标题 + 大号数值 + 副标题）。
 * 复用于：实得面积、得房率、预算总额、每平米造价。
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  title: string;
  value: string;
  subtitle?: string;
  tone?: 'default' | 'primary';
}

export default function SummaryCard({ title, value, subtitle, tone = 'default' }: Props) {
  const primary = tone === 'primary';
  return (
    <View style={[styles.card, primary && styles.cardPrimary]}>
      <Text style={[styles.title, primary && styles.textLight]}>{title}</Text>
      <Text style={[styles.value, primary && styles.textLight]}>{value}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, primary && styles.textSubtle]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardPrimary: {
    backgroundColor: '#2563EB',
  },
  title: {
    fontSize: 12,
    color: '#6B7280',
  },
  value: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 11,
    color: '#9CA3AF',
  },
  textLight: {
    color: '#FFFFFF',
  },
  textSubtle: {
    color: 'rgba(255,255,255,0.75)',
  },
});

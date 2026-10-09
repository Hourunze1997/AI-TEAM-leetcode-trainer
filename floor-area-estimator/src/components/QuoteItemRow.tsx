/**
 * 报价明细行：分项名称 + 单位标签，单价/数量两个 TextInput（onEndEditing 提交），右侧实时小计。
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { QuoteItem } from '../models/types';
import { formatMoney } from '../utils/format';

interface Props {
  item: QuoteItem;
  onChange: (patch: { unitPrice?: number; quantity?: number }) => void;
}

export default function QuoteItemRow({ item, onChange }: Props) {
  const [priceText, setPriceText] = useState(String(item.unitPrice));
  const [qtyText, setQtyText] = useState(String(item.quantity));

  // 外部数据变化（切档/恢复默认/持久化回写）时同步输入框
  useEffect(() => {
    setPriceText(String(item.unitPrice));
    setQtyText(String(item.quantity));
  }, [item.id, item.unitPrice, item.quantity]);

  const commitPrice = () => {
    const v = parseFloat(priceText);
    if (isFinite(v) && v >= 0 && v !== item.unitPrice) {
      onChange({ unitPrice: Math.round(v * 100) / 100 });
    } else {
      setPriceText(String(item.unitPrice));
    }
  };

  const commitQty = () => {
    const v = parseFloat(qtyText);
    if (isFinite(v) && v > 0 && v !== item.quantity) {
      onChange({ quantity: Math.round(v * 100) / 100 });
    } else {
      setQtyText(String(item.quantity));
    }
  };

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.unit}>{item.unit}</Text>
      </View>
      <Text style={styles.fieldLabel}>单价</Text>
      <TextInput
        style={styles.input}
        value={priceText}
        onChangeText={setPriceText}
        onEndEditing={commitPrice}
        keyboardType="numeric"
        selectTextOnFocus
      />
      <Text style={styles.fieldLabel}>数量</Text>
      <TextInput
        style={[styles.input, styles.qtyInput]}
        value={qtyText}
        onChangeText={setQtyText}
        onEndEditing={commitQty}
        keyboardType="numeric"
        selectTextOnFocus
      />
      <Text style={styles.subtotal}>{formatMoney(item.subtotal)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  left: {
    width: 86,
  },
  name: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
  },
  unit: {
    marginTop: 2,
    fontSize: 11,
    color: '#9CA3AF',
  },
  fieldLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginHorizontal: 4,
  },
  input: {
    width: 56,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 13,
    color: '#111827',
    textAlign: 'center',
  },
  qtyInput: {},
  subtotal: {
    width: 72,
    textAlign: 'right',
    fontSize: 13,
    color: '#111827',
    fontWeight: '700',
  },
});

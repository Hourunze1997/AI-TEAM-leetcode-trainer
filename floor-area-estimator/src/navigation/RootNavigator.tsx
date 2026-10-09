import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProjectListScreen from '../screens/ProjectListScreen';
import EditorScreen from '../screens/EditorScreen';
import AreaSummaryScreen from '../screens/AreaSummaryScreen';
import QuoteScreen from '../screens/QuoteScreen';
import ReportScreen from '../screens/ReportScreen';
import type { QuoteLevel } from '../models/types';

/** 五屏路由参数定义 */
export type RootStackParamList = {
  ProjectList: undefined;
  Editor: { floorPlanId: string };
  AreaSummary: { floorPlanId: string };
  Quote: { floorPlanId: string; level?: QuoteLevel };
  Report: { floorPlanId: string; level?: QuoteLevel };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="ProjectList"
      screenOptions={{
        headerTitleAlign: 'center',
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="ProjectList"
        component={ProjectListScreen}
        options={{ title: '户型面积估算' }}
      />
      <Stack.Screen name="Editor" component={EditorScreen} options={{ title: '图纸编辑' }} />
      <Stack.Screen name="AreaSummary" component={AreaSummaryScreen} options={{ title: '面积汇总' }} />
      <Stack.Screen name="Quote" component={QuoteScreen} options={{ title: '装修报价模拟' }} />
      <Stack.Screen name="Report" component={ReportScreen} options={{ title: '报告导出' }} />
    </Stack.Navigator>
  );
}

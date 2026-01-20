'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  subMonths,
} from 'date-fns';

// プリセット種別
export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last14days'
  | 'last30days'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'allTime'
  | 'custom';

// 日付範囲
export interface SelectedDateRange {
  from: Date;
  to: Date;
}

// プリセットラベル
export const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: '今日',
  yesterday: '昨日',
  last7days: '過去7日間',
  last14days: '過去14日間',
  last30days: '過去30日間',
  thisWeek: '今週',
  lastWeek: '先週',
  thisMonth: '今月',
  lastMonth: '先月',
  allTime: '全期間',
  custom: 'カスタム',
};

// プリセットから日付範囲を計算
export function calculateDateRange(preset: DateRangePreset, customRange?: SelectedDateRange): SelectedDateRange {
  const today = startOfDay(new Date());
  const yesterday = subDays(today, 1);

  switch (preset) {
    case 'today':
      return { from: today, to: endOfDay(today) };
    case 'yesterday':
      return { from: yesterday, to: endOfDay(yesterday) };
    case 'last7days':
      return { from: subDays(yesterday, 6), to: endOfDay(yesterday) };
    case 'last14days':
      return { from: subDays(yesterday, 13), to: endOfDay(yesterday) };
    case 'last30days':
      return { from: subDays(yesterday, 29), to: endOfDay(yesterday) };
    case 'thisWeek':
      return { from: startOfWeek(today, { weekStartsOn: 0 }), to: endOfDay(today) };
    case 'lastWeek': {
      const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 0 });
      return { from: lastWeekStart, to: endOfDay(endOfWeek(lastWeekStart, { weekStartsOn: 0 })) };
    }
    case 'thisMonth':
      return { from: startOfMonth(today), to: endOfDay(today) };
    case 'lastMonth': {
      const lastMonth = subMonths(today, 1);
      return { from: startOfMonth(lastMonth), to: endOfDay(endOfMonth(lastMonth)) };
    }
    case 'allTime':
      return { from: new Date(2000, 0, 1), to: endOfDay(yesterday) };
    case 'custom':
      return customRange || { from: subDays(yesterday, 6), to: endOfDay(yesterday) };
    default:
      return { from: subDays(yesterday, 6), to: endOfDay(yesterday) };
  }
}

// Context
interface ReportDateRangeContextType {
  preset: DateRangePreset;
  customRange: SelectedDateRange | undefined;
  range: SelectedDateRange;
  setReportDateRange: (preset: DateRangePreset, customRange?: SelectedDateRange) => void;
}

const ReportDateRangeContext = createContext<ReportDateRangeContextType | undefined>(undefined);

// LocalStorage キー
const STORAGE_KEYS = {
  preset: 'report-date-preset',
  customFrom: 'report-date-custom-from',
  customTo: 'report-date-custom-to',
};

const getInitialPreset = (): DateRangePreset => {
  if (typeof window === 'undefined') return 'last7days';
  const savedPreset = localStorage.getItem(STORAGE_KEYS.preset) as DateRangePreset | null;
  if (savedPreset && PRESET_LABELS[savedPreset]) {
    return savedPreset;
  }
  return 'last7days';
};

const getInitialCustomRange = (): SelectedDateRange | undefined => {
  if (typeof window === 'undefined') return undefined;
  const savedCustomFrom = localStorage.getItem(STORAGE_KEYS.customFrom);
  const savedCustomTo = localStorage.getItem(STORAGE_KEYS.customTo);
  if (savedCustomFrom && savedCustomTo) {
    return {
      from: new Date(savedCustomFrom),
      to: new Date(savedCustomTo),
    };
  }
  return undefined;
};

// Provider
export function ReportDateRangeProvider({ children }: { children: ReactNode }) {
  const [preset, setPreset] = useState<DateRangePreset>(() => getInitialPreset());
  const [customRange, setCustomRange] = useState<SelectedDateRange | undefined>(
    () => getInitialCustomRange()
  );

  // 日付範囲を設定
  const setReportDateRange = (newPreset: DateRangePreset, newCustomRange?: SelectedDateRange) => {
    setPreset(newPreset);

    if (newPreset === 'custom' && newCustomRange) {
      setCustomRange(newCustomRange);
      localStorage.setItem(STORAGE_KEYS.customFrom, newCustomRange.from.toISOString());
      localStorage.setItem(STORAGE_KEYS.customTo, newCustomRange.to.toISOString());
    }

    localStorage.setItem(STORAGE_KEYS.preset, newPreset);
  };

  // 現在の日付範囲を計算
  const range = calculateDateRange(preset, customRange);

  return (
    <ReportDateRangeContext.Provider value={{ preset, customRange, range, setReportDateRange }}>
      {children}
    </ReportDateRangeContext.Provider>
  );
}

// Hook
export function useReportDateRange() {
  const context = useContext(ReportDateRangeContext);
  if (!context) {
    throw new Error('useReportDateRange must be used within a ReportDateRangeProvider');
  }
  return context;
}

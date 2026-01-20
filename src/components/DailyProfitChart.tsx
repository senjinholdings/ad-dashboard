'use client';

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Tooltip,
} from 'recharts';
import { CreativeData } from '@/types';
import { formatCurrencyFull } from '@/utils/csvParser';

interface DailyProfitChartProps {
  data: CreativeData[];
}

// カラーパレット（クリエイティブ用）
const COLORS = [
  '#0b7f7b', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#6366f1', '#ef4444', '#14b8a6', '#f97316',
  '#84cc16', '#06b6d4', '#a855f7', '#22c55e', '#eab308',
];

const MAX_SLOTS = 15; // 最大スロット数

interface SlotData {
  value: number;
  name: string;
  color: string;
  slotIndex: number;
  side: 'pos' | 'neg';
}

interface DailyData {
  date: string;
  displayDate: string;
  total: number;
  [key: string]: string | number | SlotData | undefined;
}

interface TooltipState {
  dayData: DailyData;
  label: string;
  x: number;
  y: number;
}

export default function DailyProfitChart({ data }: DailyProfitChartProps) {
  const [tooltipState, setTooltipState] = useState<TooltipState | null>(null);
  const [isTooltipPinned, setIsTooltipPinned] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTooltipPinnedRef = useRef(false);

  // ツールチップを非表示にするタイムアウトをクリア
  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // ツールチップを遅延非表示
  const scheduleHide = useCallback(() => {
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      if (!isTooltipPinnedRef.current) {
        setTooltipState(null);
      }
    }, 400);
  }, [clearHideTimeout]);

  // チャートのマウスムーブ - chartDataはuseMemoで後に定義されるため、関数内で参照
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartMouseMove = useCallback((state: any, data: DailyData[]) => {
    if (isTooltipPinnedRef.current) return; // ピン留め中は更新しない

    // activeTooltipIndexを使ってデータを取得
    const index = state?.activeTooltipIndex;
    if (index !== undefined && index >= 0 && index < data.length && state?.activeCoordinate) {
      clearHideTimeout();
      const dayData = data[index];
      setTooltipState({
        dayData,
        label: dayData.displayDate,
        x: state.activeCoordinate.x,
        y: state.activeCoordinate.y,
      });
    }
  }, [clearHideTimeout]);

  // チャートからマウスが離れた
  const handleChartMouseLeave = useCallback(() => {
    if (!isTooltipPinnedRef.current) {
      scheduleHide();
    }
  }, [scheduleHide]);

  // ツールチップにマウスが入った
  const handleTooltipMouseEnter = useCallback(() => {
    clearHideTimeout();
    isTooltipPinnedRef.current = true;
    setIsTooltipPinned(true);
  }, [clearHideTimeout]);

  // ツールチップからマウスが離れた
  const handleTooltipMouseLeave = useCallback(() => {
    isTooltipPinnedRef.current = false;
    setIsTooltipPinned(false);
    scheduleHide();
  }, [scheduleHide]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const element = chartContainerRef.current;
    if (!element) return;

    if (typeof ResizeObserver === 'undefined') {
      const frameId = requestAnimationFrame(() => {
        setContainerWidth(element.offsetWidth);
      });
      return () => cancelAnimationFrame(frameId);
    }

    let frameId: number | null = null;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        setContainerWidth(entry.contentRect.width);
      });
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, []);

  const { chartData, creativeCount, maxPosSlots, maxNegSlots } = useMemo(() => {
    // 日付ごと・クリエイティブごとに利益を集計
    const dailyMap = new Map<string, Map<string, number>>();
    const creativeSet = new Set<string>();

    data.forEach(item => {
      if (!item.date) return;

      const normalizedDate = item.date.replace(/\//g, '-');
      const creativeName = item.creativeName || '(未分類)';

      creativeSet.add(creativeName);

      if (!dailyMap.has(normalizedDate)) {
        dailyMap.set(normalizedDate, new Map());
      }

      const dayData = dailyMap.get(normalizedDate)!;
      const currentProfit = dayData.get(creativeName) || 0;
      dayData.set(creativeName, currentProfit + item.profit);
    });

    // クリエイティブごとの色を全期間の合計利益順で決定（色の一貫性のため）
    const creativeProfitTotals = new Map<string, number>();
    creativeSet.forEach(name => {
      let total = 0;
      dailyMap.forEach(dayData => {
        total += dayData.get(name) || 0;
      });
      creativeProfitTotals.set(name, total);
    });

    const sortedCreatives = Array.from(creativeSet)
      .sort((a, b) => (creativeProfitTotals.get(b) || 0) - (creativeProfitTotals.get(a) || 0));

    const colorMap: Record<string, string> = {};
    sortedCreatives.forEach((name, index) => {
      colorMap[name] = COLORS[index % COLORS.length];
    });

    // チャートデータを作成
    const processed = Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, dayData]) => {
        const result: DailyData = {
          date,
          displayDate: date.slice(5).replace('-', '/'),
          total: 0,
        };

        // この日のクリエイティブを利益でソート
        const dayCreatives = Array.from(dayData.entries())
          .map(([name, profit]) => ({ name, profit, color: colorMap[name] }))
          .filter(c => c.profit !== 0);

        // プラスとマイナスに分離
        const positives = dayCreatives
          .filter(c => c.profit > 0)
          .sort((a, b) => b.profit - a.profit);

        const negatives = dayCreatives
          .filter(c => c.profit < 0)
          .sort((a, b) => b.profit - a.profit);

        positives.forEach((c, i) => {
          const slotIndex = positives.length - 1 - i;
          result[`pos_${slotIndex}`] = c.profit;
          result[`pos_${slotIndex}_color`] = c.color;
          result[`pos_${slotIndex}_data`] = {
            value: c.profit,
            name: c.name,
            color: c.color,
            slotIndex,
            side: 'pos',
          };
        });

        negatives.forEach((c, i) => {
          result[`neg_${i}`] = c.profit;
          result[`neg_${i}_color`] = c.color;
          result[`neg_${i}_data`] = {
            value: c.profit,
            name: c.name,
            color: c.color,
            slotIndex: i,
            side: 'neg',
          };
        });

        result.total = dayCreatives.reduce((sum, c) => sum + c.profit, 0);

        return {
          day: result,
          posCount: positives.length,
          negCount: negatives.length,
        };
      });

    const chartData = processed.map(item => item.day);
    const maxPosSlots = Math.min(
      processed.reduce((max, item) => Math.max(max, item.posCount), 0),
      MAX_SLOTS
    );
    const maxNegSlots = Math.min(
      processed.reduce((max, item) => Math.max(max, item.negCount), 0),
      MAX_SLOTS
    );

    return {
      chartData,
      creativeCount: creativeSet.size,
      maxPosSlots,
      maxNegSlots,
    };
  }, [data]);

  // ツールチップの内容を生成
  const tooltipItems = useMemo(() => {
    if (!tooltipState) return [];

    const items: SlotData[] = [];
    const { dayData } = tooltipState;

    for (let i = 0; i < MAX_SLOTS; i++) {
      const posData = dayData[`pos_${i}_data`] as SlotData | undefined;
      if (posData && posData.value !== 0) {
        items.push(posData);
      }
      const negData = dayData[`neg_${i}_data`] as SlotData | undefined;
      if (negData && negData.value !== 0) {
        items.push(negData);
      }
    }

    items.sort((a, b) => {
      if (a.value !== b.value) return b.value - a.value;
      const aRank = a.side === 'pos' ? -a.slotIndex : a.slotIndex;
      const bRank = b.side === 'pos' ? -b.slotIndex : b.slotIndex;
      return aRank - bRank;
    });

    return items;
  }, [tooltipState]);

  const tooltipTotal = useMemo(() => {
    return tooltipItems.reduce((sum, item) => sum + item.value, 0);
  }, [tooltipItems]);

  if (data.length === 0 || chartData.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#cfe7e7] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-emerald-100 p-2 rounded-lg">
            <span className="material-symbols-outlined text-emerald-600">trending_up</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">デイリー利益推移</h3>
            <p className="text-sm text-gray-500">クリエイティブ別積み上げグラフ</p>
          </div>
        </div>
        <div className="h-80 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
          <div className="text-center">
            <span className="material-symbols-outlined text-4xl mb-2 block">show_chart</span>
            データがありません
          </div>
        </div>
      </div>
    );
  }

  const posSlots = Array.from({ length: maxPosSlots }, (_, i) => i);
  const negSlots = Array.from({ length: maxNegSlots }, (_, i) => i);

  return (
    <div className="bg-white rounded-xl border border-[#cfe7e7] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-2 rounded-lg">
            <span className="material-symbols-outlined text-emerald-600">trending_up</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">デイリー利益推移</h3>
            <p className="text-sm text-gray-500">クリエイティブ別積み上げグラフ（利益順）</p>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          {chartData.length}日間 / {creativeCount}種類
        </div>
      </div>

      <div
        className="h-[400px] relative"
        ref={chartContainerRef}
        onMouseLeave={handleChartMouseLeave}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            stackOffset="sign"
            onMouseMove={(state) => handleChartMouseMove(state, chartData)}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={{ stroke: '#d1d5db' }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(value) => `¥${(value / 10000).toFixed(0)}万`}
              tickLine={{ stroke: '#d1d5db' }}
            />
            <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />
            <Tooltip
              content={() => null}
              cursor={false}
              isAnimationActive={false}
            />

            {posSlots.map((slotIndex) => (
              <Bar
                key={`pos_${slotIndex}`}
                dataKey={`pos_${slotIndex}`}
                stackId="profit"
                isAnimationActive={false}
                fill="#cccccc"
              >
                {chartData.map((entry, dataIndex) => {
                  const color = entry[`pos_${slotIndex}_color`] as string | undefined;
                  return (
                    <Cell
                      key={dataIndex}
                      fill={color || 'transparent'}
                    />
                  );
                })}
              </Bar>
            ))}

            {negSlots.map((slotIndex) => (
              <Bar
                key={`neg_${slotIndex}`}
                dataKey={`neg_${slotIndex}`}
                stackId="profit"
                isAnimationActive={false}
                fill="#cccccc"
              >
                {chartData.map((entry, dataIndex) => {
                  const color = entry[`neg_${slotIndex}_color`] as string | undefined;
                  return (
                    <Cell
                      key={dataIndex}
                      fill={color || 'transparent'}
                    />
                  );
                })}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>

        {/* カスタムツールチップ */}
        {tooltipState && (
          <div
            ref={tooltipRef}
            className="absolute z-50"
            style={{
              left: Math.min(tooltipState.x, (containerWidth || 600) - 300),
              top: Math.max(10, Math.min(tooltipState.y - 100, 200)),
            }}
            onMouseEnter={handleTooltipMouseEnter}
            onMouseLeave={handleTooltipMouseLeave}
          >
            {/* 左側の透明なホバー領域 */}
            <div className="absolute left-0 top-0 w-5 h-full" />
            <div
              className="border border-[#cfe7e7] rounded-xl shadow-lg p-4 bg-white ml-5"
              style={{
                minWidth: '260px',
                maxWidth: '320px',
              }}
            >
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-gray-900">{tooltipState.label}</p>
              {isTooltipPinned && (
                <span className="text-xs text-gray-400">スクロール可</span>
              )}
            </div>
            <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
              {tooltipItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-gray-600 truncate">{item.name}</span>
                  </div>
                  <span className={`font-medium shrink-0 ${item.value >= 0 ? 'text-[#0b7f7b]' : 'text-red-600'}`}>
                    {formatCurrencyFull(item.value)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between">
              <span className="font-medium text-gray-700">合計</span>
              <span className={`font-bold ${tooltipTotal >= 0 ? 'text-[#0b7f7b]' : 'text-red-600'}`}>
                {formatCurrencyFull(tooltipTotal)}
              </span>
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

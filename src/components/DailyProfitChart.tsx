'use client';

import { useMemo, useState, useRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { CreativeData } from '@/types';
import { formatCurrency } from '@/utils/csvParser';

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

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    payload: DailyData;
  }>;
  label?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

function CustomTooltip({ active, payload, label, onMouseEnter, onMouseLeave }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const dayData = payload[0]?.payload;
  if (!dayData) return null;

  // スロットデータを収集
  const items: SlotData[] = [];

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

  // 利益順でソート（大きい順）。同額はスタック順に合わせる
  items.sort((a, b) => {
    if (a.value !== b.value) return b.value - a.value;
    const aRank = a.side === 'pos' ? -a.slotIndex : a.slotIndex;
    const bRank = b.side === 'pos' ? -b.slotIndex : b.slotIndex;
    return aRank - bRank;
  });

  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div
      className="border border-[#cfe7e7] rounded-xl shadow-lg p-4 max-w-sm"
      style={{ backgroundColor: '#ffffff' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <p className="font-semibold text-gray-900 mb-2">{label}</p>
      <div className="space-y-1 max-h-60 overflow-y-auto">
        {items.map((item, index) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-gray-600 truncate max-w-[150px]">{item.name}</span>
            </div>
            <span className={`font-medium ${item.value >= 0 ? 'text-[#0b7f7b]' : 'text-red-600'}`}>
              {formatCurrency(item.value)}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between">
        <span className="font-medium text-gray-700">合計</span>
        <span className={`font-bold ${total >= 0 ? 'text-[#0b7f7b]' : 'text-red-600'}`}>
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

export default function DailyProfitChart({ data }: DailyProfitChartProps) {
  const [isTooltipHovered, setIsTooltipHovered] = useState(false);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTooltipMouseEnter = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setIsTooltipHovered(true);
  };

  const handleTooltipMouseLeave = () => {
    tooltipTimeoutRef.current = setTimeout(() => {
      setIsTooltipHovered(false);
    }, 100);
  };

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

    // 各日の最大スロット数を追跡
    let maxPosSlots = 0;
    let maxNegSlots = 0;

    // チャートデータを作成
    const chartData: DailyData[] = Array.from(dailyMap.entries())
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
          .sort((a, b) => b.profit - a.profit); // 大きい順（一番上に表示）

        const negatives = dayCreatives
          .filter(c => c.profit < 0)
          .sort((a, b) => b.profit - a.profit); // 0に近い順（-23が先、-574が後）

        maxPosSlots = Math.max(maxPosSlots, positives.length);
        maxNegSlots = Math.max(maxNegSlots, negatives.length);

        // プラス側のスロット（pos_0が一番小さい利益 = 一番下、pos_Nが一番大きい = 一番上）
        // ツールチップの表示順（利益大→小）とバーの視覚的順序（上→下）を一致させる
        positives.forEach((c, i) => {
          const slotIndex = positives.length - 1 - i; // 逆順にスロット割り当て
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

        // マイナス側のスロット
        // Rechartsは最初に描画したバーが上（0に近い）になるため、0に近い順で描画
        // neg_0 = 0に近い（-23）→ 上、neg_N = 最もマイナス（-574）→ 下
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

        return result;
      });

    return {
      chartData,
      creativeCount: creativeSet.size,
      maxPosSlots: Math.min(maxPosSlots, MAX_SLOTS),
      maxNegSlots: Math.min(maxNegSlots, MAX_SLOTS),
    };
  }, [data]);

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

  // スロット用のBarコンポーネントを生成
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

      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            stackOffset="sign"
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
            <Tooltip
              content={
                <CustomTooltip
                  onMouseEnter={handleTooltipMouseEnter}
                  onMouseLeave={handleTooltipMouseLeave}
                />
              }
              wrapperStyle={{
                zIndex: 100,
                pointerEvents: 'auto',
              }}
              trigger={isTooltipHovered ? 'click' : 'hover'}
            />
            <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />

            {/* プラス側のスロット（大きい利益から順に積む） */}
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

            {/* マイナス側のスロット（0に近い順で描画→上に配置） */}
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
      </div>
    </div>
  );
}

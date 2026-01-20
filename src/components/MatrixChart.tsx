'use client';

import { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Cell,
} from 'recharts';
import { AggregatedCreativeData } from '@/types';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/csvParser';

interface MatrixChartProps {
  data: AggregatedCreativeData[];
}

// 象限の定義
type Quadrant = 1 | 2 | 3 | 4;

const QUADRANT_CONFIG = {
  1: { name: '好調', color: '#22c55e', bgColor: '#dcfce7', position: '右上', meaning: '最高パフォーマンス', action: '予算拡大推奨' },
  2: { name: 'CPA改善', color: '#3b82f6', bgColor: '#dbeafe', position: '右下', meaning: 'CVあるがCPA高い', action: '入札・ターゲ調整' },
  3: { name: '拡大余地', color: '#eab308', bgColor: '#fef9c3', position: '左上', meaning: '効率良いがCV少', action: '配信拡大検討' },
  4: { name: '停止検討', color: '#ef4444', bgColor: '#fee2e2', position: '左下', meaning: 'CV少・CPA高', action: '停止・改善検討' },
};

interface BubbleDataItem extends AggregatedCreativeData {
  x: number;           // 相対X座標 (-100〜100)
  y: number;           // 相対Y座標 (-100〜100)
  z: number;           // バブルサイズ (0.5〜2.0)
  quadrant: Quadrant;
  cvVsAvg: number;     // CV平均比 (%)
  cpaVsAvg: number;    // CPA平均比 (%)
  roasVsAvg: number;   // ROAS平均比 (%)
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: BubbleDataItem;
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const config = QUADRANT_CONFIG[data.quadrant];

  return (
    <div className="border border-[#cfe7e7] rounded-xl shadow-xl p-4 max-w-sm" style={{ backgroundColor: '#ffffff', boxShadow: '0 0 0 1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-gray-900 truncate flex-1 mr-2">{data.creativeName}</p>
        <span
          className="px-2 py-0.5 rounded-full text-xs font-medium text-white shrink-0"
          style={{ backgroundColor: config.color }}
        >
          {config.name}
        </span>
      </div>
      <p className="text-sm text-gray-500 truncate mb-3">広告数: {data.adCount}件</p>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-500">CV数</span>
          <div className="text-right">
            <span className="font-medium text-gray-800">{formatNumber(data.cv)}件</span>
            <span className={`ml-2 text-xs ${data.cvVsAvg >= 100 ? 'text-green-600' : 'text-red-600'}`}>
              ({data.cvVsAvg.toFixed(0)}%)
            </span>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">CPA</span>
          <div className="text-right">
            <span className="font-medium text-gray-800">{formatCurrency(data.cpa)}</span>
            <span className={`ml-2 text-xs ${data.cpaVsAvg <= 100 ? 'text-green-600' : 'text-red-600'}`}>
              ({data.cpaVsAvg.toFixed(0)}%)
            </span>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">ROAS</span>
          <div className="text-right">
            <span className="font-medium text-gray-800">{formatPercent(data.roas)}</span>
            <span className={`ml-2 text-xs ${data.roasVsAvg >= 100 ? 'text-green-600' : 'text-red-600'}`}>
              ({data.roasVsAvg.toFixed(0)}%)
            </span>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-2 mt-2">
          <div className="flex justify-between">
            <span className="text-gray-500">費用</span>
            <span className="font-medium text-gray-800">{formatCurrency(data.cost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">利益</span>
            <span className={`font-medium ${data.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.profit)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 象限を判定
function getQuadrant(cv: number, cpa: number, avgCV: number, avgCPA: number): Quadrant {
  const hasHighCV = cv >= avgCV;
  const hasLowCPA = cpa <= avgCPA || avgCPA === 0;

  if (hasHighCV && hasLowCPA) return 1;  // 好調: 右上
  if (hasHighCV && !hasLowCPA) return 2; // CPA改善: 右下
  if (!hasHighCV && hasLowCPA) return 3; // 拡大余地: 左上
  return 4;                               // 停止検討: 左下
}

// 相対座標を計算（-100〜100）
function calculateRelativePosition(value: number, avg: number, isInverted: boolean = false): number {
  if (avg === 0) return 0;

  // 値が平均の何倍かを計算
  const ratio = value / avg;

  // 比率を-100〜100の範囲にマッピング
  // ratio = 1 → 0, ratio = 2 → 50, ratio = 0.5 → -50
  let position = (ratio - 1) * 50;

  // -100〜100の範囲にクランプ
  position = Math.max(-100, Math.min(100, position));

  // CPAは反転（低いほど上=良い）
  return isInverted ? -position : position;
}

// バブルサイズを計算（0.5〜2.0）
function calculateBubbleSize(roas: number, avgROAS: number): number {
  if (avgROAS === 0) return 1;
  const ratio = roas / avgROAS;
  // 0.5〜2.0の範囲にマッピング
  return Math.max(0.5, Math.min(2.0, ratio));
}

export default function MatrixChart({ data }: MatrixChartProps) {
  const chartData = useMemo(() => {
    // CV > 0 かつ cost > 0 のデータのみ対象
    const validData = data.filter(c => c.cv > 0 && c.cost > 0);

    if (validData.length === 0) {
      return {
        points: [],
        avgCV: 0,
        avgCPA: 0,
        avgROAS: 0,
        counts: { 1: 0, 2: 0, 3: 0, 4: 0 }
      };
    }

    const avgCV = validData.reduce((sum, c) => sum + c.cv, 0) / validData.length;
    const avgCPA = validData.reduce((sum, c) => sum + c.cpa, 0) / validData.length;
    const avgROAS = validData.reduce((sum, c) => sum + c.roas, 0) / validData.length;

    const points: BubbleDataItem[] = validData.map(creative => {
      const quadrant = getQuadrant(creative.cv, creative.cpa, avgCV, avgCPA);
      const cvVsAvg = avgCV > 0 ? (creative.cv / avgCV) * 100 : 100;
      const cpaVsAvg = avgCPA > 0 ? (creative.cpa / avgCPA) * 100 : 100;
      const roasVsAvg = avgROAS > 0 ? (creative.roas / avgROAS) * 100 : 100;

      return {
        ...creative,
        x: calculateRelativePosition(creative.cv, avgCV, false),      // CV: 右が多い
        y: calculateRelativePosition(creative.cpa, avgCPA, true),     // CPA: 上が低い（良い）
        z: calculateBubbleSize(creative.roas, avgROAS),
        quadrant,
        cvVsAvg,
        cpaVsAvg,
        roasVsAvg,
      };
    });

    // 各象限のカウント
    const counts = {
      1: points.filter(p => p.quadrant === 1).length,
      2: points.filter(p => p.quadrant === 2).length,
      3: points.filter(p => p.quadrant === 3).length,
      4: points.filter(p => p.quadrant === 4).length,
    };

    return { points, avgCV, avgCPA, avgROAS, counts };
  }, [data]);

  // CV > 0 のデータがない場合
  const validDataCount = data.filter(c => c.cv > 0 && c.cost > 0).length;

  if (data.length === 0 || validDataCount === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#cfe7e7] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-teal-100 p-2 rounded-lg">
            <span className="material-symbols-outlined text-[#0b7f7b]">scatter_plot</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              パフォーマンスマトリクス
            </h3>
            <p className="text-sm text-gray-500">CV × CPA の4象限相対評価</p>
          </div>
        </div>
        <div className="h-80 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
          <div className="text-center">
            <span className="material-symbols-outlined text-4xl mb-2 block">upload_file</span>
            {data.length === 0
              ? 'CSVをアップロードするとマトリクスが表示されます'
              : 'CV > 0 のCRがありません'
            }
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#cfe7e7] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-teal-100 p-2 rounded-lg">
            <span className="material-symbols-outlined text-[#0b7f7b]">scatter_plot</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              パフォーマンスマトリクス
            </h3>
            <p className="text-sm text-gray-500">CV × CPA の4象限相対評価（バブルサイズ: 相対ROAS）</p>
          </div>
        </div>

        {/* 凡例 */}
        <div className="flex gap-3">
          {([1, 3, 2, 4] as Quadrant[]).map((q) => (
            <div key={q} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: QUADRANT_CONFIG[q].color }}
              />
              <span className="text-xs text-gray-600">{QUADRANT_CONFIG[q].name}</span>
              <span className="text-xs text-gray-400">({chartData.counts[q]}種)</span>
            </div>
          ))}
        </div>
      </div>

      {/* 平均値表示 */}
      <div className="flex gap-6 mb-4 text-sm bg-gray-50 rounded-lg px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">平均CV:</span>
          <span className="font-medium text-gray-800">{formatNumber(chartData.avgCV)}件</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">平均CPA:</span>
          <span className="font-medium text-gray-800">{formatCurrency(chartData.avgCPA)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">平均ROAS:</span>
          <span className="font-medium text-gray-800">{formatPercent(chartData.avgROAS)}</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-gray-500">対象CR:</span>
          <span className="font-medium text-gray-800">{validDataCount}種類</span>
          <span className="text-xs text-gray-400">(CV&gt;0)</span>
        </div>
      </div>

      <div className="h-[480px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 40, right: 40, bottom: 60, left: 60 }}>
            {/* 4象限の背景色 */}
            {/* 左上: 拡大余地 (x < 0, y > 0) */}
            <ReferenceArea x1={-100} x2={0} y1={0} y2={100} fill={QUADRANT_CONFIG[3].bgColor} fillOpacity={0.6} />
            {/* 右上: 好調 (x >= 0, y > 0) */}
            <ReferenceArea x1={0} x2={100} y1={0} y2={100} fill={QUADRANT_CONFIG[1].bgColor} fillOpacity={0.6} />
            {/* 左下: 停止検討 (x < 0, y < 0) */}
            <ReferenceArea x1={-100} x2={0} y1={-100} y2={0} fill={QUADRANT_CONFIG[4].bgColor} fillOpacity={0.6} />
            {/* 右下: CPA改善 (x >= 0, y < 0) */}
            <ReferenceArea x1={0} x2={100} y1={-100} y2={0} fill={QUADRANT_CONFIG[2].bgColor} fillOpacity={0.6} />

            <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />

            {/* X軸: 相対CV */}
            <XAxis
              type="number"
              dataKey="x"
              domain={[-100, 100]}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}`}
              label={{
                value: '← CV少ない　　　　　CV多い →',
                position: 'bottom',
                offset: 10,
                style: { fontSize: 12, fill: '#6b7280' }
              }}
            />

            {/* Y軸: 相対CPA（反転済み） */}
            <YAxis
              type="number"
              dataKey="y"
              domain={[-100, 100]}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}`}
              label={{
                value: '← CPA高い　　CPA低い →',
                angle: -90,
                position: 'left',
                offset: 0,
                style: { fontSize: 12, fill: '#6b7280', textAnchor: 'middle' }
              }}
            />

            {/* Z軸: バブルサイズ（ROAS） */}
            <ZAxis
              type="number"
              dataKey="z"
              range={[60, 600]}
              domain={[0.5, 2.0]}
            />

            {/* 中央の十字線（平均線） */}
            <ReferenceLine x={0} stroke="#374151" strokeWidth={2} strokeDasharray="6 3" />
            <ReferenceLine y={0} stroke="#374151" strokeWidth={2} strokeDasharray="6 3" />

            <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 1000, backgroundColor: 'transparent', border: 'none', outline: 'none' }} />

            <Scatter data={chartData.points} shape="circle">
              {chartData.points.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={QUADRANT_CONFIG[entry.quadrant].color}
                  fillOpacity={0.85}
                  stroke="#fff"
                  strokeWidth={2}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>

        {/* 象限ラベル（背景に大きく表示）- z-index低めでツールチップの下に */}
        {/* 左上: 拡大余地 - チャートエリア(60px〜50%)の中央 */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"
          style={{ top: 'calc(40px + (100% - 100px) * 0.25)', left: 'calc(60px + (100% - 100px) * 0.25)' }}
        >
          <span
            className="text-4xl font-bold opacity-30"
            style={{ color: QUADRANT_CONFIG[3].color }}
          >
            拡大余地
          </span>
        </div>
        {/* 右上: 好調 - チャートエリア(50%〜右端-40px)の中央 */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"
          style={{ top: 'calc(40px + (100% - 100px) * 0.25)', left: 'calc(60px + (100% - 100px) * 0.75)' }}
        >
          <span
            className="text-4xl font-bold opacity-30"
            style={{ color: QUADRANT_CONFIG[1].color }}
          >
            好調
          </span>
        </div>
        {/* 左下: 停止検討 */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"
          style={{ top: 'calc(40px + (100% - 100px) * 0.75)', left: 'calc(60px + (100% - 100px) * 0.25)' }}
        >
          <span
            className="text-4xl font-bold opacity-30"
            style={{ color: QUADRANT_CONFIG[4].color }}
          >
            停止検討
          </span>
        </div>
        {/* 右下: CPA改善 */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"
          style={{ top: 'calc(40px + (100% - 100px) * 0.75)', left: 'calc(60px + (100% - 100px) * 0.75)' }}
        >
          <span
            className="text-4xl font-bold opacity-30"
            style={{ color: QUADRANT_CONFIG[2].color }}
          >
            CPA改善
          </span>
        </div>

        {/* 中央のラベル */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/90 px-2 py-1 rounded text-xs text-gray-500 border border-gray-200 z-0">
          平均
        </div>
      </div>

    </div>
  );
}

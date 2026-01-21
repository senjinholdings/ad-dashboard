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
  1: { name: '好調', color: '#22c55e', bgColor: '#dcfce7', position: '右上', meaning: 'CV多・利益多', action: '予算拡大推奨' },
  2: { name: '利益改善', color: '#3b82f6', bgColor: '#dbeafe', position: '右下', meaning: 'CVあるが利益少', action: '単価・効率改善' },
  3: { name: '拡大余地', color: '#eab308', bgColor: '#fef9c3', position: '左上', meaning: '利益あるがCV少', action: '配信拡大検討' },
  4: { name: '停止検討', color: '#ef4444', bgColor: '#fee2e2', position: '左下', meaning: 'CV少・利益少', action: '停止・改善検討' },
};

interface BubbleDataItem extends AggregatedCreativeData {
  x: number;           // 相対X座標 (-100〜100)
  y: number;           // 相対Y座標 (-100〜100)
  z: number;           // バブルサイズ (0.5〜2.0)
  quadrant: Quadrant;
  cvVsAvg: number;     // CV平均比 (%)
  profitVsAvg: number; // 利益平均比 (%)
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
            {data.cv > 0 ? (
              <span className={`ml-2 text-xs ${data.cvVsAvg >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                ({data.cvVsAvg.toFixed(0)}%)
              </span>
            ) : (
              <span className="ml-2 text-xs text-gray-400">(CV=0)</span>
            )}
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">利益</span>
          <div className="text-right">
            <span className={`font-medium ${data.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.profit)}
            </span>
            {data.cv > 0 && (
              <span className={`ml-2 text-xs ${data.profitVsAvg >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                ({data.profitVsAvg.toFixed(0)}%)
              </span>
            )}
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">ROAS</span>
          <div className="text-right">
            <span className="font-medium text-gray-800">{formatPercent(data.roas)}</span>
            {data.cv > 0 ? (
              <span className={`ml-2 text-xs ${data.roasVsAvg >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                ({data.roasVsAvg.toFixed(0)}%)
              </span>
            ) : (
              <span className="ml-2 text-xs text-gray-400">(CV=0)</span>
            )}
          </div>
        </div>
        <div className="border-t border-gray-100 pt-2 mt-2">
          <div className="flex justify-between">
            <span className="text-gray-500">費用</span>
            <span className="font-medium text-gray-800">{formatCurrency(data.cost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">CPA</span>
            <span className="font-medium text-gray-800">
              {data.cv > 0 ? formatCurrency(data.cpa) : '-'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 象限を判定
function getQuadrant(cv: number, profit: number, avgCV: number, avgProfit: number): Quadrant {
  const hasHighCV = cv >= avgCV;
  const hasHighProfit = profit >= avgProfit;

  if (hasHighCV && hasHighProfit) return 1;  // 好調: 右上
  if (hasHighCV && !hasHighProfit) return 2; // 利益改善: 右下
  if (!hasHighCV && hasHighProfit) return 3; // 拡大余地: 左上
  return 4;                                   // 停止検討: 左下
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
    // CV > 0 のデータ
    const cvPositiveData = data.filter(c => c.cv > 0 && c.cost > 0);
    // CV = 0 のデータ（赤字のもののみ）
    const cvZeroData = data.filter(c => c.cv === 0 && c.cost > 0 && c.profit < 0);

    if (cvPositiveData.length === 0 && cvZeroData.length === 0) {
      return {
        points: [],
        avgCV: 0,
        avgProfit: 0,
        avgROAS: 0,
        counts: { 1: 0, 2: 0, 3: 0, 4: 0 },
        cvZeroCount: 0
      };
    }

    // CV>0の平均値を計算
    const avgCV = cvPositiveData.length > 0
      ? cvPositiveData.reduce((sum, c) => sum + c.cv, 0) / cvPositiveData.length
      : 0;
    const avgProfit = cvPositiveData.length > 0
      ? cvPositiveData.reduce((sum, c) => sum + c.profit, 0) / cvPositiveData.length
      : 0;
    const avgROAS = cvPositiveData.length > 0
      ? cvPositiveData.reduce((sum, c) => sum + c.roas, 0) / cvPositiveData.length
      : 0;

    // CV>0のポイントを作成
    const cvPositivePoints: BubbleDataItem[] = cvPositiveData.map(creative => {
      const quadrant = getQuadrant(creative.cv, creative.profit, avgCV, avgProfit);
      const cvVsAvg = avgCV > 0 ? (creative.cv / avgCV) * 100 : 100;
      // 利益の平均比は、平均がマイナスの場合も考慮
      const profitVsAvg = avgProfit !== 0 ? (creative.profit / avgProfit) * 100 : (creative.profit >= 0 ? 200 : 0);
      const roasVsAvg = avgROAS > 0 ? (creative.roas / avgROAS) * 100 : 100;

      return {
        ...creative,
        x: calculateRelativePosition(creative.cv, avgCV, false),
        y: calculateRelativePosition(creative.profit, avgProfit, false), // 利益は反転しない（高いほど上）
        z: calculateBubbleSize(creative.roas, avgROAS),
        quadrant,
        cvVsAvg,
        profitVsAvg,
        roasVsAvg,
      };
    });

    // CV=0のポイントを作成（粗利で縦方向に相対評価）
    let cvZeroPoints: BubbleDataItem[] = [];
    if (cvZeroData.length > 0) {
      // 粗利（profit < 0）の最大・最小を取得
      const profits = cvZeroData.map(c => c.profit);
      const maxProfit = Math.max(...profits); // 最も0に近い（赤字が小さい）
      const minProfit = Math.min(...profits); // 最も負（赤字が大きい）
      const profitRange = maxProfit - minProfit;

      cvZeroPoints = cvZeroData.map(creative => {
        // 粗利で縦方向の相対位置を計算（-100〜-50の範囲）
        // 粗利が高い（0に近い）= -50（上寄り）、粗利が低い（大きな赤字）= -100（下端）
        let yPosition: number;
        if (profitRange === 0) {
          yPosition = -75; // 全て同じ粗利なら中間
        } else {
          const profitRatio = (creative.profit - minProfit) / profitRange;
          yPosition = -100 + (profitRatio * 50); // -100〜-50の範囲
        }

        return {
          ...creative,
          x: -95, // CV=0なので左端付近に固定（-100だと端で切れるため）
          y: yPosition, // 粗利で縦方向にプロット
          z: 0.8, // 固定サイズ（小さめ）
          quadrant: 4 as Quadrant, // 停止検討
          cvVsAvg: 0,
          profitVsAvg: 0,
          roasVsAvg: 0,
        };
      });
    }

    const points = [...cvPositivePoints, ...cvZeroPoints];

    // 各象限のカウント
    const counts = {
      1: points.filter(p => p.quadrant === 1).length,
      2: points.filter(p => p.quadrant === 2).length,
      3: points.filter(p => p.quadrant === 3).length,
      4: points.filter(p => p.quadrant === 4).length,
    };

    return { points, avgCV, avgProfit, avgROAS, counts, cvZeroCount: cvZeroData.length };
  }, [data]);

  // CV > 0 のデータ数
  const validDataCount = data.filter(c => c.cv > 0 && c.cost > 0).length;

  // 表示可能なデータがない場合（CV>0もCV=0の赤字もない）
  if (data.length === 0 || chartData.points.length === 0) {
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
            <p className="text-sm text-gray-500">CV × 利益 の4象限相対評価</p>
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
            <p className="text-sm text-gray-500">CV × 利益 の4象限相対評価（バブルサイズ: 相対ROAS）</p>
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
          <span className="text-gray-500">平均利益:</span>
          <span className={`font-medium ${chartData.avgProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(chartData.avgProfit)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">平均ROAS:</span>
          <span className="font-medium text-gray-800">{formatPercent(chartData.avgROAS)}</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-gray-500">対象CR:</span>
          <span className="font-medium text-gray-800">{validDataCount}種類</span>
          <span className="text-xs text-gray-400">(CV&gt;0)</span>
          {chartData.cvZeroCount > 0 && (
            <>
              <span className="text-gray-300 mx-1">+</span>
              <span className="font-medium text-red-600">{chartData.cvZeroCount}種類</span>
              <span className="text-xs text-gray-400">(CV=0赤字)</span>
            </>
          )}
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

            {/* Y軸: 相対利益 */}
            <YAxis
              type="number"
              dataKey="y"
              domain={[-100, 100]}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}`}
              label={{
                value: '← 利益少ない　　利益多い →',
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
        {/* 右下: 利益改善 */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"
          style={{ top: 'calc(40px + (100% - 100px) * 0.75)', left: 'calc(60px + (100% - 100px) * 0.75)' }}
        >
          <span
            className="text-4xl font-bold opacity-30"
            style={{ color: QUADRANT_CONFIG[2].color }}
          >
            利益改善
          </span>
        </div>

        {/* 中央のラベル */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/90 px-2 py-1 rounded text-xs text-gray-500 border border-gray-200 z-0">
          平均
        </div>

        {/* CV=0エリアのラベル（左端） */}
        {chartData.cvZeroCount > 0 && (
          <div
            className="absolute pointer-events-none z-10"
            style={{ top: 'calc(40px + (100% - 100px) * 0.75)', left: '15px' }}
          >
            <div className="bg-red-50 border border-red-200 rounded-lg px-2 py-2 shadow-sm">
              <div className="text-[10px] font-medium text-red-600 text-center whitespace-nowrap">
                CV=0
              </div>
              <div className="text-[10px] text-red-600 text-center">
                ({chartData.cvZeroCount}種)
              </div>
              <div className="text-[9px] text-red-400 text-center mt-1 leading-tight">
                ↑粗利高<br/>↓粗利低
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

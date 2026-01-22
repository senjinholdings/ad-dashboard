'use client';

import { useMemo, useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Cell,
} from 'recharts';
import { AggregatedCreativeData } from '@/types';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/csvParser';

interface MatrixChartProps {
  data: AggregatedCreativeData[];
  onCreativeClick?: (creativeName: string, creativeLink: string) => void;
}

// 象限の定義
type Quadrant = 1 | 2 | 3 | 4;

const QUADRANT_CONFIG = {
  1: { name: '好調', color: '#22c55e', bgColor: '#dcfce7', position: '右上', meaning: 'CV多・黒字', action: '予算拡大推奨' },
  2: { name: '利益改善', color: '#3b82f6', bgColor: '#dbeafe', position: '右下', meaning: 'CV多・赤字', action: '単価・効率改善' },
  3: { name: '拡大余地', color: '#eab308', bgColor: '#fef9c3', position: '左上', meaning: 'CV少・黒字', action: '配信拡大検討' },
  4: { name: '停止検討', color: '#ef4444', bgColor: '#fee2e2', position: '左下', meaning: 'CV少・赤字', action: '停止・改善検討' },
};

interface BubbleDataItem extends AggregatedCreativeData {
  x: number;
  y: number;
  z: number;
  quadrant: Quadrant;
  cvVsAvg: number;
  profitVsAvg: number;
  roasVsAvg: number;
}

// ツールチップ内容コンポーネント
function TooltipContent({ data, onCreativeClick }: { data: BubbleDataItem; onCreativeClick?: (creativeName: string, creativeLink: string) => void }) {
  const config = QUADRANT_CONFIG[data.quadrant];

  return (
    <div className="border border-[#cfe7e7] rounded-xl shadow-xl p-4 w-72 overscroll-contain" style={{ backgroundColor: '#ffffff', boxShadow: '0 0 0 1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)' }}>
      <div className="flex items-center justify-between mb-2">
        {onCreativeClick ? (
          <button
            onClick={() => onCreativeClick(data.creativeName, data.creativeLink)}
            className="font-semibold text-[#0b7f7b] hover:text-[#0a6966] hover:underline truncate flex-1 mr-2 text-left cursor-pointer"
          >
            {data.creativeName}
          </button>
        ) : (
          <p className="font-semibold text-gray-900 truncate flex-1 mr-2">{data.creativeName}</p>
        )}
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span
          className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
          style={{ backgroundColor: config.color }}
        >
          {config.name}
        </span>
        <span className="text-sm text-gray-500">広告数: {data.adCount}件</span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-500">CV数</span>
          <span className="font-medium text-gray-800">{formatNumber(data.cv)}件</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">利益</span>
          <span className={`font-medium ${data.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(data.profit)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">ROAS</span>
          <span className="font-medium text-gray-800">{formatPercent(data.roas)}</span>
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

// 象限を判定（黒字/赤字で上下、CV平均で左右）
function getQuadrant(cv: number, profit: number, avgCV: number): Quadrant {
  const hasHighCV = cv >= avgCV;
  const isProfit = profit >= 0;

  if (hasHighCV && isProfit) return 1;
  if (hasHighCV && !isProfit) return 2;
  if (!hasHighCV && isProfit) return 3;
  return 4;
}

// 相対座標を計算（-100〜100）
function calculateRelativePosition(value: number, avg: number, isInverted: boolean = false): number {
  if (avg === 0) return 0;
  const ratio = value / avg;
  let position = (ratio - 1) * 50;
  position = Math.max(-100, Math.min(100, position));
  return isInverted ? -position : position;
}

// バブルサイズを計算（0.5〜2.0）
function calculateBubbleSize(roas: number, avgROAS: number): number {
  if (avgROAS === 0) return 1;
  const ratio = roas / avgROAS;
  return Math.max(0.5, Math.min(2.0, ratio));
}

// チャートのマージン設定
const CHART_MARGIN = { top: 40, right: 40, bottom: 60, left: 60 };

// メモ化されたチャートコンポーネント
interface MemoizedScatterChartProps {
  points: BubbleDataItem[];
}

const MemoizedScatterChart = memo(function MemoizedScatterChart({ points }: MemoizedScatterChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={CHART_MARGIN}>
        <ReferenceArea x1={-100} x2={0} y1={0} y2={100} fill={QUADRANT_CONFIG[3].bgColor} fillOpacity={0.6} />
        <ReferenceArea x1={0} x2={100} y1={0} y2={100} fill={QUADRANT_CONFIG[1].bgColor} fillOpacity={0.6} />
        <ReferenceArea x1={-100} x2={0} y1={-100} y2={0} fill={QUADRANT_CONFIG[4].bgColor} fillOpacity={0.6} />
        <ReferenceArea x1={0} x2={100} y1={-100} y2={0} fill={QUADRANT_CONFIG[2].bgColor} fillOpacity={0.6} />

        <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />

        <XAxis
          type="number"
          dataKey="x"
          domain={[-100, 100]}
          tick={false}
          axisLine={false}
          label={{
            value: '← CV少ない　　　　　CV多い →',
            position: 'bottom',
            offset: -10,
            style: { fontSize: 12, fill: '#6b7280' }
          }}
        />

        <YAxis
          type="number"
          dataKey="y"
          domain={[-100, 100]}
          tick={false}
          axisLine={false}
          label={{
            value: '← 赤字　　　　黒字 →',
            angle: -90,
            position: 'left',
            offset: 20,
            style: { fontSize: 12, fill: '#6b7280', textAnchor: 'middle' }
          }}
        />

        <ZAxis
          type="number"
          dataKey="z"
          range={[60, 600]}
          domain={[0.5, 2.0]}
        />

        <ReferenceLine x={0} stroke="#374151" strokeWidth={2} strokeDasharray="6 3" />
        <ReferenceLine y={0} stroke="#374151" strokeWidth={2} strokeDasharray="6 3" />

        <Scatter
          data={points}
          shape="circle"
          isAnimationActive={false}
        >
          {points.map((entry, index) => (
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
  );
});

export default function MatrixChart({ data, onCreativeClick }: MatrixChartProps) {
  // ツールチップの内容（ホバー対象が変わった時のみ更新）
  const [tooltipData, setTooltipData] = useState<BubbleDataItem | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // refs
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTooltipPinnedRef = useRef(false);
  const lastThrottleTimeRef = useRef(0);
  const chartPointsRef = useRef<BubbleDataItem[]>([]);
  const lastHoveredPointRef = useRef<string | null>(null);

  // コンテナサイズを監視
  useEffect(() => {
    const element = chartContainerRef.current;
    if (!element) return;

    const updateSize = () => {
      setContainerSize({ width: element.offsetWidth, height: element.offsetHeight });
    };
    updateSize();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateSize);
      observer.observe(element);
      return () => observer.disconnect();
    }
  }, []);

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
        setTooltipData(null);
        lastHoveredPointRef.current = null;
        if (tooltipRef.current) {
          tooltipRef.current.style.display = 'none';
        }
      }
    }, 300);
  }, [clearHideTimeout]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // バブルサイズからヒット半径を計算
  const getHitRadius = useCallback((zValue: number): number => {
    const minArea = 60, maxArea = 600;
    const area = minArea + ((zValue - 0.5) / 1.5) * (maxArea - minArea);
    const radius = Math.sqrt(area / Math.PI);
    // 最小ヒット半径を20pxに設定（小さいバブルでも反応しやすく）
    return Math.max(20, radius + 8);
  }, []);

  // 独自のマウスムーブハンドラ
  const handleNativeMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isTooltipPinnedRef.current) return;

    const now = Date.now();
    if (now - lastThrottleTimeRef.current < 150) return;
    lastThrottleTimeRef.current = now;

    const container = chartContainerRef.current;
    const tooltip = tooltipRef.current;
    const points = chartPointsRef.current;
    if (!container || !tooltip || points.length === 0) return;

    // 計測開始
    const startTime = performance.now();

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // rechartsの実際のチャートエリア（SVGから測定した値）
    // SVG解析結果: CV0点(x=-95)がpixel x=133.55, 右端点(x≈100)がpixel x≈565
    // Y軸: 上端(y=100)がpixel y≈49, 下端(y=-100)がpixel y≈390
    const RECHARTS_Y_AXIS_WIDTH = 63;  // chartLeft = 60(margin) + 63 = 123
    const RECHARTS_TOP_OFFSET = 9;     // chartTop = 40(margin) + 9 = 49
    const RECHARTS_BOTTOM_OFFSET = 30; // X軸ラベル用の追加スペース

    const chartLeft = CHART_MARGIN.left + RECHARTS_Y_AXIS_WIDTH;
    const chartTop = CHART_MARGIN.top + RECHARTS_TOP_OFFSET;
    const chartWidth = containerSize.width - CHART_MARGIN.left - CHART_MARGIN.right - RECHARTS_Y_AXIS_WIDTH;
    const chartHeight = containerSize.height - CHART_MARGIN.top - CHART_MARGIN.bottom - RECHARTS_TOP_OFFSET - RECHARTS_BOTTOM_OFFSET;

    if (chartWidth <= 0 || chartHeight <= 0) {
      console.log('[MatrixChart] chartWidth/Height invalid:', { chartWidth, chartHeight, containerSize });
      return;
    }

    // 最も近いポイントを探す
    let closestPoint: BubbleDataItem | null = null;
    let closestDistSq = Infinity;

    const searchStart = performance.now();
    for (const point of points) {
      const pointPixelX = chartLeft + ((point.x + 100) / 200) * chartWidth;
      const pointPixelY = chartTop + ((100 - point.y) / 200) * chartHeight;

      const dx = mouseX - pointPixelX;
      const dy = mouseY - pointPixelY;
      const distSq = dx * dx + dy * dy;

      const hitRadius = getHitRadius(point.z);
      if (distSq < closestDistSq && distSq < hitRadius * hitRadius) {
        closestDistSq = distSq;
        closestPoint = point;
      }
    }
    const searchEnd = performance.now();

    if (closestPoint) {
      clearHideTimeout();

      // ツールチップをカーソルの右下に表示
      tooltip.style.display = 'block';
      tooltip.style.left = `${mouseX + 15}px`;
      tooltip.style.top = `${mouseY + 15}px`;

      // ホバー対象が変わった時だけ内容を更新
      const pointKey = closestPoint.creativeName;
      if (lastHoveredPointRef.current !== pointKey) {
        lastHoveredPointRef.current = pointKey;
        setTooltipData(closestPoint);
        const endTime = performance.now();
        console.log(`[MatrixChart] HIT: ${closestPoint.creativeName}, dist=${Math.sqrt(closestDistSq).toFixed(1)}px, 検索: ${(searchEnd - searchStart).toFixed(2)}ms`);
      }
    } else {
      // デバッグ: 最も近いポイントまでの距離を表示（10回に1回）
      if (Math.random() < 0.1 && points.length > 0) {
        let minDist = Infinity;
        let nearestPoint: BubbleDataItem | null = null;
        for (const point of points) {
          const pointPixelX = chartLeft + ((point.x + 100) / 200) * chartWidth;
          const pointPixelY = chartTop + ((100 - point.y) / 200) * chartHeight;
          const dist = Math.sqrt((mouseX - pointPixelX) ** 2 + (mouseY - pointPixelY) ** 2);
          if (dist < minDist) {
            minDist = dist;
            nearestPoint = point;
          }
        }
        if (nearestPoint) {
          console.log(`[MatrixChart] MISS: mouse=(${mouseX.toFixed(0)},${mouseY.toFixed(0)}), nearest=${nearestPoint.creativeName} at dist=${minDist.toFixed(0)}px, hitRadius=${getHitRadius(nearestPoint.z).toFixed(0)}px`);
        }
      }
      scheduleHide();
    }
  }, [containerSize, clearHideTimeout, scheduleHide, getHitRadius]);

  // ツールチップにマウスが入った → 固定
  const handleTooltipMouseEnter = useCallback(() => {
    clearHideTimeout();
    isTooltipPinnedRef.current = true;
  }, [clearHideTimeout]);

  // ツールチップからマウスが離れた → 固定解除
  const handleTooltipMouseLeave = useCallback(() => {
    isTooltipPinnedRef.current = false;
    scheduleHide();
  }, [scheduleHide]);

  const chartData = useMemo(() => {
    const cvPositiveData = data.filter(c => c.cv > 0 && c.cost > 0);
    const cvZeroData = data.filter(c => c.cv === 0 && c.cost > 0 && c.profit < 0);

    if (cvPositiveData.length === 0 && cvZeroData.length === 0) {
      return {
        points: [],
        avgCV: 0,
        avgROAS: 0,
        counts: { 1: 0, 2: 0, 3: 0, 4: 0 },
        cvZeroCount: 0,
        profitCount: 0,
        lossCount: 0
      };
    }

    const avgCV = cvPositiveData.length > 0
      ? cvPositiveData.reduce((sum, c) => sum + c.cv, 0) / cvPositiveData.length
      : 0;
    const avgROAS = cvPositiveData.length > 0
      ? cvPositiveData.reduce((sum, c) => sum + c.roas, 0) / cvPositiveData.length
      : 0;

    const profitableData = cvPositiveData.filter(c => c.profit >= 0);
    const lossData = cvPositiveData.filter(c => c.profit < 0);

    const maxProfit = profitableData.length > 0 ? Math.max(...profitableData.map(c => c.profit)) : 0;
    const minProfitInProfitable = profitableData.length > 0 ? Math.min(...profitableData.map(c => c.profit)) : 0;

    const maxLoss = lossData.length > 0 ? Math.max(...lossData.map(c => c.profit)) : 0;
    const minLoss = lossData.length > 0 ? Math.min(...lossData.map(c => c.profit)) : 0;

    const cvPositivePoints: BubbleDataItem[] = cvPositiveData.map(creative => {
      const quadrant = getQuadrant(creative.cv, creative.profit, avgCV);
      const cvVsAvg = avgCV > 0 ? (creative.cv / avgCV) * 100 : 100;
      const profitVsAvg = 0;
      const roasVsAvg = avgROAS > 0 ? (creative.roas / avgROAS) * 100 : 100;

      let yPosition: number;
      if (creative.profit >= 0) {
        const profitRange = maxProfit - minProfitInProfitable;
        if (profitRange === 0) {
          yPosition = 50;
        } else {
          const ratio = (creative.profit - minProfitInProfitable) / profitRange;
          yPosition = 5 + ratio * 90;
        }
      } else {
        const lossRange = maxLoss - minLoss;
        if (lossRange === 0) {
          yPosition = -50;
        } else {
          const ratio = (creative.profit - minLoss) / lossRange;
          yPosition = -95 + ratio * 90;
        }
      }

      return {
        ...creative,
        x: calculateRelativePosition(creative.cv, avgCV, false),
        y: yPosition,
        z: calculateBubbleSize(creative.roas, avgROAS),
        quadrant,
        cvVsAvg,
        profitVsAvg,
        roasVsAvg,
      };
    });

    let cvZeroPoints: BubbleDataItem[] = [];
    if (cvZeroData.length > 0) {
      const profits = cvZeroData.map(c => c.profit);
      const maxProfitZero = Math.max(...profits);
      const minProfitZero = Math.min(...profits);
      const profitRange = maxProfitZero - minProfitZero;

      cvZeroPoints = cvZeroData.map(creative => {
        let yPosition: number;
        if (profitRange === 0) {
          yPosition = -75;
        } else {
          const profitRatio = (creative.profit - minProfitZero) / profitRange;
          yPosition = -100 + (profitRatio * 50);
        }

        return {
          ...creative,
          x: -95,
          y: yPosition,
          z: 0.8,
          quadrant: 4 as Quadrant,
          cvVsAvg: 0,
          profitVsAvg: 0,
          roasVsAvg: 0,
        };
      });
    }

    const points = [...cvPositivePoints, ...cvZeroPoints];

    const counts = {
      1: points.filter(p => p.quadrant === 1).length,
      2: points.filter(p => p.quadrant === 2).length,
      3: points.filter(p => p.quadrant === 3).length,
      4: points.filter(p => p.quadrant === 4).length,
    };

    const profitCount = points.filter(p => p.profit >= 0).length;
    const lossCount = points.filter(p => p.profit < 0).length;

    return { points, avgCV, avgROAS, counts, cvZeroCount: cvZeroData.length, profitCount, lossCount };
  }, [data]);

  // chartPointsRefを更新
  useEffect(() => {
    chartPointsRef.current = chartData.points;
    // デバッグ: CV0ポイントの確認
    const cv0Points = chartData.points.filter(p => p.cv === 0);
    if (cv0Points.length > 0) {
      console.log(`[MatrixChart] CV0ポイント: ${cv0Points.length}件`, cv0Points.map(p => ({ name: p.creativeName, x: p.x, y: p.y, z: p.z })));
    }
    console.log(`[MatrixChart] 全ポイント数: ${chartData.points.length}件`);
  }, [chartData.points]);

  const validDataCount = data.filter(c => c.cv > 0 && c.cost > 0).length;

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
          <h3 className="text-lg font-semibold text-gray-800">
            パフォーマンスマトリクス
          </h3>
        </div>

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

      <div
        className="h-[480px] relative outline-none"
        ref={chartContainerRef}
        data-testid="matrix-chart"
        onMouseMove={handleNativeMouseMove}
        onMouseLeave={scheduleHide}
      >
        {/* メモ化されたチャート */}
        <MemoizedScatterChart points={chartData.points} />

        {/* カスタムツールチップ（初期非表示、DOMで位置更新） */}
        <div
          ref={tooltipRef}
          className="tooltip-container absolute z-[100]"
          data-testid="matrix-tooltip"
          style={{ display: 'none' }}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          {tooltipData && (
            <TooltipContent data={tooltipData} onCreativeClick={onCreativeClick} />
          )}
        </div>

        {/* 象限ラベル */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"
          style={{ top: 'calc(40px + (100% - 100px) * 0.25)', left: 'calc(60px + (100% - 100px) * 0.25)' }}
        >
          <span className="text-4xl font-bold opacity-30" style={{ color: QUADRANT_CONFIG[3].color }}>
            拡大余地
          </span>
        </div>
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"
          style={{ top: 'calc(40px + (100% - 100px) * 0.25)', left: 'calc(60px + (100% - 100px) * 0.75)' }}
        >
          <span className="text-4xl font-bold opacity-30" style={{ color: QUADRANT_CONFIG[1].color }}>
            好調
          </span>
        </div>
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"
          style={{ top: 'calc(40px + (100% - 100px) * 0.75)', left: 'calc(60px + (100% - 100px) * 0.25)' }}
        >
          <span className="text-4xl font-bold opacity-30" style={{ color: QUADRANT_CONFIG[4].color }}>
            停止検討
          </span>
        </div>
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"
          style={{ top: 'calc(40px + (100% - 100px) * 0.75)', left: 'calc(60px + (100% - 100px) * 0.75)' }}
        >
          <span className="text-4xl font-bold opacity-30" style={{ color: QUADRANT_CONFIG[2].color }}>
            利益改善
          </span>
        </div>

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

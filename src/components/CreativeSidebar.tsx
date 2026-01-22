'use client';

import { useMemo, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { CreativeData } from '@/types';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/csvParser';

interface CreativeSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  creativeName: string;
  creativeLink: string;
  allData: CreativeData[];
}

// GoogleドライブのURLをプレビュー用に変換
function convertToPreviewUrl(url: string): string {
  if (!url) return '';

  // Google Drive file URL
  const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFileMatch) {
    return `https://drive.google.com/file/d/${driveFileMatch[1]}/preview`;
  }

  // Google Drive open URL
  const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (driveOpenMatch) {
    return `https://drive.google.com/file/d/${driveOpenMatch[1]}/preview`;
  }

  // Google Drive uc URL
  const driveUcMatch = url.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
  if (driveUcMatch) {
    return `https://drive.google.com/file/d/${driveUcMatch[1]}/preview`;
  }

  return url;
}

// GoogleドライブURLかどうかを判定
function isGoogleDriveUrl(url: string): boolean {
  return url.includes('drive.google.com');
}

export default function CreativeSidebar({
  isOpen,
  onClose,
  creativeName,
  creativeLink,
  allData,
}: CreativeSidebarProps) {
  const previewUrl = convertToPreviewUrl(creativeLink);

  // ESCキーで閉じる
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  // このクリエイティブのデータを集計
  const { metrics, dailyData } = useMemo(() => {
    const filtered = allData.filter(d => d.creativeName === creativeName);

    // 合計値を計算
    const totalCV = filtered.reduce((sum, d) => sum + d.cv, 0);
    const totalCost = filtered.reduce((sum, d) => sum + d.cost, 0);
    const totalRevenue = filtered.reduce((sum, d) => sum + d.revenue, 0);
    const totalProfit = filtered.reduce((sum, d) => sum + d.profit, 0);
    const avgCPA = totalCV > 0 ? totalCost / totalCV : 0;
    const avgROAS = totalCost > 0 ? (totalRevenue / totalCost) * 100 : 0;
    const totalImpressions = filtered.reduce((sum, d) => sum + d.impressions, 0);

    // 日別データを集計
    const dailyMap = new Map<string, { profit: number; cv: number; cost: number }>();
    filtered.forEach(d => {
      if (!d.date) return;
      const normalizedDate = d.date.replace(/\//g, '-');
      const existing = dailyMap.get(normalizedDate) || { profit: 0, cv: 0, cost: 0 };
      dailyMap.set(normalizedDate, {
        profit: existing.profit + d.profit,
        cv: existing.cv + d.cv,
        cost: existing.cost + d.cost,
      });
    });

    const dailyData = Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, values]) => ({
        date,
        displayDate: date.slice(5).replace('-', '/'),
        ...values,
      }));

    return {
      metrics: {
        cv: totalCV,
        cost: totalCost,
        revenue: totalRevenue,
        profit: totalProfit,
        cpa: avgCPA,
        roas: avgROAS,
        impressions: totalImpressions,
        adCount: filtered.length,
      },
      dailyData,
    };
  }, [allData, creativeName]);

  if (!isOpen) return null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="material-symbols-outlined text-[#0b7f7b]">movie</span>
          <span className="font-semibold text-gray-800 truncate">{creativeName}</span>
        </div>
        <div className="flex items-center gap-2">
          {creativeLink && (
            <a
              href={creativeLink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
              title="新しいタブで開く"
            >
              <span className="material-symbols-outlined text-gray-600 text-xl">open_in_new</span>
            </a>
          )}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-gray-600 text-xl">close</span>
          </button>
        </div>
      </div>

      {/* コンテンツ（スクロール可能） */}
      <div className="flex-1 overflow-y-auto">
        {/* クリエイティブプレビュー */}
        <div className="border-b border-gray-200">
          {creativeLink ? (
            <div className="bg-gray-100">
              <iframe
                src={previewUrl}
                className="w-full aspect-video border-0"
                allow="autoplay"
                title={creativeName}
              />
              {isGoogleDriveUrl(creativeLink) && (
                <div className="px-3 py-1.5 bg-gray-50 text-xs text-gray-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">info</span>
                  表示されない場合は共有設定を確認
                </div>
              )}
            </div>
          ) : (
            <div className="h-48 bg-gray-100 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <span className="material-symbols-outlined text-4xl mb-1 block">image_not_supported</span>
                <span className="text-sm">リンクなし</span>
              </div>
            </div>
          )}
        </div>

        {/* 基本指標 */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-lg text-[#0b7f7b]">analytics</span>
            基本指標
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">CV</p>
              <p className="text-lg font-bold text-gray-800">{formatNumber(metrics.cv)}件</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">利益</p>
              <p className={`text-lg font-bold ${metrics.profit >= 0 ? 'text-[#0b7f7b]' : 'text-red-600'}`}>
                {formatCurrency(metrics.profit)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">ROAS</p>
              <p className="text-lg font-bold text-gray-800">{formatPercent(metrics.roas)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">CPA</p>
              <p className="text-lg font-bold text-gray-800">
                {metrics.cv > 0 ? formatCurrency(metrics.cpa) : '-'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">費用</p>
              <p className="text-base font-semibold text-gray-800">{formatCurrency(metrics.cost)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">売上</p>
              <p className="text-base font-semibold text-gray-800">{formatCurrency(metrics.revenue)}</p>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500 text-right">
            広告数: {metrics.adCount}件
          </div>
        </div>

        {/* 期間推移グラフ */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-lg text-[#0b7f7b]">show_chart</span>
            日別利益推移
          </h3>
          {dailyData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0b7f7b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0b7f7b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(value as number), '利益']}
                    labelFormatter={(label) => `${label}`}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="#0b7f7b"
                    strokeWidth={2}
                    fill="url(#profitGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-32 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
              <div className="text-center">
                <span className="material-symbols-outlined text-3xl mb-1 block">event_busy</span>
                <span className="text-sm">日付データなし</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

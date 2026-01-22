'use client';

import { AggregatedCreativeData } from '@/types';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/csvParser';

interface CreativeTableProps {
  topCreatives: AggregatedCreativeData[];
  poorCreatives: AggregatedCreativeData[];
}

const getRankIcon = (index: number) => {
  switch (index) {
    case 0:
      return (
        <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
          <span className="material-symbols-outlined text-yellow-600 text-lg">trophy</span>
        </div>
      );
    case 1:
      return (
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          <span className="material-symbols-outlined text-gray-500 text-lg">military_tech</span>
        </div>
      );
    case 2:
      return (
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
          <span className="material-symbols-outlined text-amber-600 text-lg">workspace_premium</span>
        </div>
      );
    default:
      return (
        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-sm font-medium text-gray-600">
          {index + 1}
        </div>
      );
  }
};

const getStatusBadge = (creative: AggregatedCreativeData) => {
  if (creative.profit < 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
        停止推奨
      </span>
    );
  }
  if (creative.roas >= 90 && creative.roas <= 110) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
        様子見
      </span>
    );
  }
  if (creative.roas > 150) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
        好調
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
      <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
      注意
    </span>
  );
};

export default function CreativeTable({ topCreatives, poorCreatives }: CreativeTableProps) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 好調CR TOP3 */}
      <div className="bg-white rounded-xl border border-[#cfe7e7] p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="bg-teal-100 p-2 rounded-lg">
            <span className="material-symbols-outlined text-[#0b7f7b]">trending_up</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">好調CR TOP3</h3>
            <p className="text-sm text-gray-500">利益順で上位3件</p>
          </div>
        </div>

        {topCreatives.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <span className="material-symbols-outlined text-4xl mb-2 block">inbox</span>
            データがありません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#cfe7e7]">
                  <th className="text-left py-3 px-2 font-medium text-gray-500 text-xs uppercase tracking-wider">順位</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500 text-xs uppercase tracking-wider">CR名</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500 text-xs uppercase tracking-wider">CV</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500 text-xs uppercase tracking-wider">ROAS</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500 text-xs uppercase tracking-wider">利益</th>
                  <th className="text-center py-3 px-2 font-medium text-gray-500 text-xs uppercase tracking-wider">状態</th>
                </tr>
              </thead>
              <tbody>
                {topCreatives.map((creative, index) => (
                  <tr key={creative.creativeName} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-2">{getRankIcon(index)}</td>
                    <td className="py-4 px-2">
                      {creative.creativeLink ? (
                        <a
                          href={creative.creativeLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#0b7f7b] hover:text-[#0a6966] hover:underline truncate max-w-[140px] block"
                          title={creative.creativeName}
                        >
                          {creative.creativeName}
                        </a>
                      ) : (
                        <div className="font-medium text-gray-900 truncate max-w-[140px]" title={creative.creativeName}>
                          {creative.creativeName}
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        広告数: {creative.adCount}件
                      </div>
                    </td>
                    <td className="py-4 px-2 text-right font-medium text-gray-800">{formatNumber(creative.cv)}</td>
                    <td className="py-4 px-2 text-right font-medium text-[#0b7f7b]">
                      {formatPercent(creative.roas)}
                    </td>
                    <td className="py-4 px-2 text-right font-medium text-[#0b7f7b]">
                      {formatCurrency(creative.profit)}
                    </td>
                    <td className="py-4 px-2 text-center">
                      {getStatusBadge(creative)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 不調CR */}
      <div className="bg-white rounded-xl border border-[#cfe7e7] p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="bg-red-100 p-2 rounded-lg">
            <span className="material-symbols-outlined text-red-600">trending_down</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">不調CR</h3>
            <p className="text-sm text-gray-500">赤字額が大きい上位5本</p>
          </div>
        </div>

        {poorCreatives.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <span className="material-symbols-outlined text-4xl mb-2 block text-teal-400">celebration</span>
            <p className="text-teal-600">赤字のクリエイティブはありません</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-[#cfe7e7]">
                  <th className="text-left py-3 px-2 font-medium text-gray-500 text-xs uppercase tracking-wider">CR名</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500 text-xs uppercase tracking-wider">CV</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500 text-xs uppercase tracking-wider">ROAS</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500 text-xs uppercase tracking-wider">利益</th>
                  <th className="text-center py-3 px-2 font-medium text-gray-500 text-xs uppercase tracking-wider">状態</th>
                </tr>
              </thead>
              <tbody>
                {poorCreatives.map((creative) => (
                  <tr key={creative.creativeName} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-2">
                      {creative.creativeLink ? (
                        <a
                          href={creative.creativeLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#0b7f7b] hover:text-[#0a6966] hover:underline truncate max-w-[150px] block"
                          title={creative.creativeName}
                        >
                          {creative.creativeName}
                        </a>
                      ) : (
                        <div className="font-medium text-gray-900 truncate max-w-[150px]" title={creative.creativeName}>
                          {creative.creativeName}
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        広告数: {creative.adCount}件
                      </div>
                    </td>
                    <td className="py-4 px-2 text-right text-gray-800">{formatNumber(creative.cv)}</td>
                    <td className="py-4 px-2 text-right text-red-600 font-medium">
                      {formatPercent(creative.roas)}
                    </td>
                    <td className={`py-4 px-2 text-right font-medium ${creative.profit >= 0 ? 'text-gray-600' : 'text-red-600'}`}>
                      {formatCurrency(creative.profit)}
                    </td>
                    <td className="py-4 px-2 text-center">
                      {getStatusBadge(creative)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

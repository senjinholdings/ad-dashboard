'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { CreativeData, AggregatedCreativeData } from '@/types';
import { calculateSummary, assignCreativeStatus } from '@/utils/csvParser';
import { loadCreatives, saveCreatives } from '@/utils/storage';
import {
  loadSpreadsheetConfig,
  extractSpreadsheetId,
  fetchSpreadsheetDataByName,
  parseSpreadsheetCsv,
  parseCreativeMasterCsv,
  saveSpreadsheetConfig,
  SpreadsheetAdData,
} from '@/utils/spreadsheet';
import SummaryCards from './SummaryCards';
import MatrixChart from './MatrixChart';
import CreativeTable from './CreativeTable';
import DateRangePicker from './DateRangePicker';
import DailyProfitChart from './DailyProfitChart';
import MetricFilter, { MetricFilterConfig, MetricFilterType, applyFilter } from './MetricFilter';
import { useReportDateRange } from '@/contexts/ReportDateRangeContext';
import { useAccount } from '@/contexts/AccountContext';
import { usePerson } from '@/contexts/PersonContext';
import { isWithinInterval, parseISO, startOfDay } from 'date-fns';

// テーブルヘッダー定義
const TABLE_HEADERS: {
  key: string;
  label: string;
  type: MetricFilterType;
  align: 'left' | 'right';
}[] = [
  { key: 'creativeName', label: 'CR名', type: 'text', align: 'left' },
  { key: 'adCount', label: '広告数', type: 'number', align: 'right' },
  { key: 'impressions', label: 'Imp', type: 'number', align: 'right' },
  { key: 'cpm', label: 'CPM', type: 'currency', align: 'right' },
  { key: 'cpa', label: 'CPA', type: 'currency', align: 'right' },
  { key: 'cost', label: 'Cost', type: 'currency', align: 'right' },
  { key: 'cv', label: 'CV', type: 'number', align: 'right' },
  { key: 'revenue', label: '売上', type: 'currency', align: 'right' },
  { key: 'profit', label: '利益', type: 'currency', align: 'right' },
  { key: 'roas', label: 'ROAS', type: 'percentage', align: 'right' },
];

// シート名（固定）
const RAW_SHEET_NAME = 'raw';
const CREATIVE_SHEET_NAME = 'クリエイティブ';

export default function Tab2Report() {
  const [creatives, setCreatives] = useState<CreativeData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // データを読み込む（マウント時 & storageイベント時）
  useEffect(() => {
    const loadData = () => {
      setCreatives(loadCreatives());
      setLastUpdated(loadSpreadsheetConfig()?.lastUpdated ?? null);
    };

    loadData();

    // localStorageの変更を検知
    const handleStorage = () => loadData();
    window.addEventListener('storage', handleStorage);

    // フォーカス時にも再読み込み
    const handleFocus = () => loadData();
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // スプレッドシートからデータを更新
  const handleRefresh = useCallback(async () => {
    const config = loadSpreadsheetConfig();
    if (!config?.spreadsheetId) return;

    setIsRefreshing(true);

    try {
      // クリエイティブマスタを取得
      let masterCreativeNames: string[] = [];
      try {
        const creativeCsvText = await fetchSpreadsheetDataByName(config.spreadsheetId, CREATIVE_SHEET_NAME);
        masterCreativeNames = parseCreativeMasterCsv(creativeCsvText);
      } catch (err) {
        console.warn('クリエイティブマスタの取得に失敗しました:', err);
      }

      const sortedCreativeNames = [...masterCreativeNames].sort((a, b) => b.length - a.length);

      // rawシートからCSVデータを取得
      const csvText = await fetchSpreadsheetDataByName(config.spreadsheetId, RAW_SHEET_NAME);
      const rawData = parseSpreadsheetCsv(csvText);

      // スプレッドシートデータをCreativeDataに変換
      const calculated: CreativeData[] = rawData.map((row: SpreadsheetAdData, index: number) => {
        let matchedCreativeName = '';
        if (row.adName && sortedCreativeNames.length > 0) {
          for (const name of sortedCreativeNames) {
            if (row.adName.includes(name)) {
              matchedCreativeName = name;
              break;
            }
          }
        }

        return {
          id: `creative-${index}-${Date.now()}`,
          date: row.reportStartDate || '',
          accountName: row.accountName || '',
          personName: row.personName || '',
          adName: row.adName || '',
          adSetName: row.adSetName || '',
          projectName: row.projectName || '未設定',
          creativeName: matchedCreativeName,
          impressions: row.impressions || 0,
          cpm: row.cpm || 0,
          cv: row.results || 0,
          cpa: row.costPerResult || 0,
          cost: row.amountSpent || 0,
          revenue: row.revenue || 0,
          profit: row.profit || 0,
          roas: row.roas || 0,
          status: 'excellent' as const,
        };
      });
      const withStatus = assignCreativeStatus(calculated);

      saveCreatives(withStatus);
      setCreatives(withStatus);

      // 設定を更新
      const updatedConfig = {
        ...config,
        lastUpdated: new Date().toISOString(),
      };
      saveSpreadsheetConfig(updatedConfig);
      setLastUpdated(updatedConfig.lastUpdated);

    } catch (err) {
      console.error('データの更新に失敗しました:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // フィルター・ソート状態
  const [filters, setFilters] = useState<Record<string, MetricFilterConfig | null>>({});
  const [sortKey, setSortKey] = useState<string>('profit');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // 日付範囲フィルター（Context）
  const { preset, customRange, range, setReportDateRange } = useReportDateRange();

  // アカウントフィルター（Context）
  const { selectedAccounts, setSelectedAccounts } = useAccount();

  // 担当者フィルター（Context）
  const { selectedPersons, setSelectedPersons } = usePerson();

  // ユニークなアカウント名を取得（担当者が選択されている場合は、その担当者に紐づくアカウントのみ）
  const accountNames = useMemo(() => {
    const names = new Set<string>();
    creatives.forEach(c => {
      if (c.accountName) {
        // 担当者が選択されている場合は、その担当者に紐づくアカウントのみ
        if (selectedPersons.length > 0) {
          if (selectedPersons.includes(c.personName)) {
            names.add(c.accountName);
          }
        } else {
          names.add(c.accountName);
        }
      }
    });
    return Array.from(names).sort();
  }, [creatives, selectedPersons]);

  // ユニークな担当者名を取得（アカウントが選択されている場合は、そのアカウントに紐づく担当者のみ）
  const personNames = useMemo(() => {
    const names = new Set<string>();
    creatives.forEach(c => {
      if (c.personName) {
        // アカウントが選択されている場合は、そのアカウントに紐づく担当者のみ
        if (selectedAccounts.length > 0) {
          if (selectedAccounts.includes(c.accountName)) {
            names.add(c.personName);
          }
        } else {
          names.add(c.personName);
        }
      }
    });
    return Array.from(names).sort();
  }, [creatives, selectedAccounts]);

  // 日付文字列をDateに変換してフィルタリング
  const parseCreativeDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    try {
      const normalized = dateStr.replace(/\//g, '-');
      return startOfDay(parseISO(normalized));
    } catch {
      return null;
    }
  };

  // 日付範囲 + アカウント + 担当者でフィルタリング
  const filteredCreatives = creatives.filter(c => {
    // アカウントフィルター（選択されていない場合は全件表示）
    if (selectedAccounts.length > 0 && !selectedAccounts.includes(c.accountName)) {
      return false;
    }
    // 担当者フィルター（選択されていない場合は全件表示）
    if (selectedPersons.length > 0 && !selectedPersons.includes(c.personName)) {
      return false;
    }
    // 日付フィルター
    const creativeDate = parseCreativeDate(c.date);
    if (!creativeDate) return true;
    return isWithinInterval(creativeDate, { start: startOfDay(range.from), end: startOfDay(range.to) });
  });


  const summary = calculateSummary(filteredCreatives);

  // CR単位で集計
  const aggregatedByCreative = useMemo((): AggregatedCreativeData[] => {
    const grouped = new Map<string, {
      creativeName: string;
      adCount: number;
      impressions: number;
      cv: number;
      cost: number;
      revenue: number;
      profit: number;
    }>();

    filteredCreatives.forEach(c => {
      const name = c.creativeName || '(未分類)';
      const existing = grouped.get(name);
      if (existing) {
        existing.adCount += 1;
        existing.impressions += c.impressions || 0;
        existing.cv += c.cv || 0;
        existing.cost += c.cost || 0;
        existing.revenue += c.revenue || 0;
        existing.profit += c.profit || 0;
      } else {
        grouped.set(name, {
          creativeName: name,
          adCount: 1,
          impressions: c.impressions || 0,
          cv: c.cv || 0,
          cost: c.cost || 0,
          revenue: c.revenue || 0,
          profit: c.profit || 0,
        });
      }
    });

    return Array.from(grouped.values())
      .map(g => ({
        ...g,
        cpm: g.impressions > 0 ? (g.cost / g.impressions) * 1000 : 0,
        cpa: g.cv > 0 ? g.cost / g.cv : 0,
        roas: g.cost > 0 ? (g.revenue / g.cost) * 100 : 0,
      }))
      .sort((a, b) => b.profit - a.profit);
  }, [filteredCreatives]);

  // (未分類)を除外したCR一覧（マトリクス・好調/不調CR用）
  const classifiedCR = aggregatedByCreative.filter(cr => cr.creativeName !== '(未分類)');

  // 好調CR（利益TOP3）と不調CR（赤字額が大きい上位5本）
  const topCR = classifiedCR.slice(0, 3);
  const poorCR = [...classifiedCR]
    .filter(cr => cr.profit < 0)
    .sort((a, b) => a.profit - b.profit)
    .slice(0, 5);

  // フィルター・ソート適用後のデータ
  const filteredAndSortedCreatives = useMemo(() => {
    // フィルター適用
    let result = aggregatedByCreative.filter(cr => {
      for (const header of TABLE_HEADERS) {
        const filter = filters[header.key];
        if (!filter) continue;

        const value = cr[header.key as keyof typeof cr];
        if (!applyFilter(value as number | string, filter, header.type)) {
          return false;
        }
      }
      return true;
    });

    // ソート適用
    result = [...result].sort((a, b) => {
      const aValue = a[sortKey as keyof typeof a];
      const bValue = b[sortKey as keyof typeof b];

      // 文字列比較
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'desc'
          ? bValue.localeCompare(aValue)
          : aValue.localeCompare(bValue);
      }

      // 数値比較
      const aNum = typeof aValue === 'number' ? aValue : 0;
      const bNum = typeof bValue === 'number' ? bValue : 0;
      return sortDirection === 'desc' ? bNum - aNum : aNum - bNum;
    });

    return result;
  }, [aggregatedByCreative, filters, sortKey, sortDirection]);

  // ソートハンドラー
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  // フィルターがアクティブかどうか
  const hasActiveFilters = Object.values(filters).some(f => f !== null);

  // データがない場合のプレースホルダー
  if (creatives.length === 0) {
    return (
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <div className="bg-teal-100 p-2 rounded-lg">
            <span className="material-symbols-outlined text-[#0b7f7b]">bar_chart</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">レポート</h2>
            <p className="text-sm text-gray-500">データを「前提整理・設定」タブで読み込んでください</p>
          </div>
        </div>

        {/* プレースホルダー */}
        <div className="bg-white rounded-xl border border-[#cfe7e7] p-12">
          <div className="text-center text-gray-400">
            <span className="material-symbols-outlined text-6xl mb-4 block">cloud_download</span>
            <p className="text-lg font-medium mb-2">データがありません</p>
            <p className="text-sm">「前提整理・設定」タブでスプレッドシートからデータを読み込んでください</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-teal-100 p-2 rounded-lg">
            <span className="material-symbols-outlined text-[#0b7f7b]">bar_chart</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">レポート</h2>
            {lastUpdated && (
              <p className="text-sm text-gray-500">
                最終更新: {new Date(lastUpdated).toLocaleString('ja-JP')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* 担当者選択 */}
          {personNames.length > 0 && (
            <div className="relative">
              <select
                value={selectedPersons.length === 0 ? 'all' : selectedPersons[0]}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'all') {
                    setSelectedPersons([]);
                  } else {
                    setSelectedPersons([value]);
                  }
                }}
                title={selectedPersons.length === 0 ? '全担当者' : selectedPersons[0]}
                className="appearance-none bg-white border border-[#cfe7e7] rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 hover:border-[#0b7f7b] focus:outline-none focus:ring-2 focus:ring-[#0b7f7b]/20 focus:border-[#0b7f7b] transition-colors cursor-pointer w-[120px] truncate"
              >
                <option value="all">全担当者</option>
                {personNames.map(name => (
                  <option key={name} value={name} title={name}>{name}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-lg">
                expand_more
              </span>
            </div>
          )}
          {/* アカウント選択 */}
          {accountNames.length > 0 && (
            <div className="relative">
              <select
                value={selectedAccounts.length === 0 ? 'all' : selectedAccounts[0]}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'all') {
                    setSelectedAccounts([]);
                  } else {
                    setSelectedAccounts([value]);
                  }
                }}
                title={selectedAccounts.length === 0 ? '全アカウント' : selectedAccounts[0]}
                className="appearance-none bg-white border border-[#cfe7e7] rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 hover:border-[#0b7f7b] focus:outline-none focus:ring-2 focus:ring-[#0b7f7b]/20 focus:border-[#0b7f7b] transition-colors cursor-pointer w-[180px] truncate"
              >
                <option value="all">全アカウント</option>
                {accountNames.map(name => (
                  <option key={name} value={name} title={name}>{name}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-lg">
                expand_more
              </span>
            </div>
          )}
          <DateRangePicker
            value={preset}
            customRange={customRange}
            onChange={setReportDateRange}
          />
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-[#0b7f7b] text-white rounded-lg hover:bg-[#0a6966] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {isRefreshing ? (
              <>
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                <span>更新中...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">sync</span>
                <span>更新</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* サマリーカード */}
      <SummaryCards data={summary} />

      {/* デイリー利益推移 */}
      <DailyProfitChart data={filteredCreatives} />

      {/* パフォーマンスマトリクス */}
      <MatrixChart data={classifiedCR} />

      {/* 好調/不調CR */}
      <CreativeTable topCreatives={topCR} poorCreatives={poorCR} />

      {/* クリエイティブ別集計テーブル */}
      <div className="bg-white rounded-xl border border-[#cfe7e7] p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <span className="material-symbols-outlined text-blue-600">table_chart</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">クリエイティブ別集計</h3>
              <p className="text-sm text-gray-500">
                {hasActiveFilters
                  ? `${filteredAndSortedCreatives.length}件 / ${aggregatedByCreative.length}種類`
                  : `${aggregatedByCreative.length}種類のクリエイティブ`
                }
              </p>
            </div>
          </div>
          {hasActiveFilters && (
            <button
              onClick={() => setFilters({})}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">filter_alt_off</span>
              フィルターをクリア
            </button>
          )}
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-[#cfe7e7]">
                {TABLE_HEADERS.map((header) => (
                  <th
                    key={header.key}
                    className={`py-3 px-3 font-medium text-gray-500 text-xs uppercase tracking-wider ${
                      header.align === 'left' ? 'text-left' : 'text-right'
                    }`}
                  >
                    <div className={`flex items-center gap-1 ${header.align === 'right' ? 'justify-end' : ''}`}>
                      <div
                        className="flex items-center gap-1 cursor-pointer hover:text-gray-700 select-none"
                        onClick={() => handleSort(header.key)}
                      >
                        <span>{header.label}</span>
                        {sortKey === header.key && (
                          <span className="text-blue-600">
                            {sortDirection === 'desc' ? '▼' : '▲'}
                          </span>
                        )}
                      </div>
                      <MetricFilter
                        isActive={!!filters[header.key]}
                        onFilterChange={(filter) => {
                          setFilters(prev => ({ ...prev, [header.key]: filter }));
                        }}
                        metricType={header.type}
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedCreatives.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_HEADERS.length} className="py-8 text-center text-gray-400">
                    条件に一致するデータがありません
                  </td>
                </tr>
              ) : (
                filteredAndSortedCreatives.map((cr) => (
                  <tr key={cr.creativeName} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3">
                      <span className="truncate block max-w-[200px] font-medium text-gray-800" title={cr.creativeName}>
                        {cr.creativeName}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-gray-600">{cr.adCount}</td>
                    <td className="py-3 px-3 text-right text-gray-800">{cr.impressions.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-gray-800">¥{Math.round(cr.cpm).toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-gray-800">{cr.cv > 0 ? `¥${Math.round(cr.cpa).toLocaleString()}` : '-'}</td>
                    <td className="py-3 px-3 text-right text-gray-800">¥{Math.round(cr.cost).toLocaleString()}</td>
                    <td className="py-3 px-3 text-right font-medium text-gray-800">{cr.cv}</td>
                    <td className="py-3 px-3 text-right text-gray-800">¥{Math.round(cr.revenue).toLocaleString()}</td>
                    <td className={`py-3 px-3 text-right font-medium ${cr.profit >= 0 ? 'text-[#0b7f7b]' : 'text-red-600'}`}>
                      ¥{Math.round(cr.profit).toLocaleString()}
                    </td>
                    <td className={`py-3 px-3 text-right font-medium ${cr.roas >= 100 ? 'text-[#0b7f7b]' : 'text-red-600'}`}>
                      {cr.roas.toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

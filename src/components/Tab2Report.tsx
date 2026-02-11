'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { CreativeData, AggregatedCreativeData } from '@/types';
import { calculateSummary, assignCreativeStatus } from '@/utils/csvParser';
import { loadCreativesFromIndexedDB, saveCreativesToIndexedDB } from '@/utils/indexedDB';
import {
  loadSpreadsheetConfig,
  extractSheetGid,
  fetchSpreadsheetData,
  fetchSpreadsheetDataByName,
  parseSpreadsheetCsv,
  parseCreativeMasterCsv,
  parseCreativeMasterWithLinks,
  saveSpreadsheetConfig,
  SpreadsheetAdData,
} from '@/utils/spreadsheet';
import SummaryCards from './SummaryCards';
import MatrixChart from './MatrixChart';
import CreativeTable from './CreativeTable';
import DateRangePicker from './DateRangePicker';
import DailyProfitChart from './DailyProfitChart';
import MetricFilter, { MetricFilterConfig, MetricFilterType, applyFilter } from './MetricFilter';
import MultiSelectDropdown from './MultiSelectDropdown';
import ColumnPickerModal from './ColumnPickerModal';
import { useReportDateRange } from '@/contexts/ReportDateRangeContext';
import { useAccount } from '@/contexts/AccountContext';
import { usePerson } from '@/contexts/PersonContext';
import { useCreativeSidebar } from '@/contexts/CreativeSidebarContext';
import { isWithinInterval, parseISO, startOfDay } from 'date-fns';

const VISIBLE_COLUMNS_STORAGE_KEY = 'ad-dashboard-visible-columns';

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
const CREATIVE_SHEET_NAME = 'クリエイティブ';
// デフォルトのrawシートgid
const DEFAULT_RAW_GID = '567193483';

// セル値のレンダリング関数
function renderCellValue(cr: AggregatedCreativeData, key: string): React.ReactNode {
  switch (key) {
    case 'adCount':
      return cr.adCount;
    case 'impressions':
      return cr.impressions.toLocaleString();
    case 'cpm':
      return `¥${Math.round(cr.cpm).toLocaleString()}`;
    case 'cpa':
      return cr.cv > 0 ? `¥${Math.round(cr.cpa).toLocaleString()}` : '-';
    case 'cost':
      return `¥${Math.round(cr.cost).toLocaleString()}`;
    case 'cv':
      return cr.cv;
    case 'revenue':
      return `¥${Math.round(cr.revenue).toLocaleString()}`;
    case 'profit':
      return `¥${Math.round(cr.profit).toLocaleString()}`;
    case 'roas':
      return `${cr.roas.toFixed(1)}%`;
    default:
      return '';
  }
}

// セルのスタイルクラスを取得
function getCellClassName(cr: AggregatedCreativeData, key: string): string {
  const base = 'py-3 px-3 text-right';
  switch (key) {
    case 'adCount':
      return `${base} text-gray-600`;
    case 'profit':
      return `${base} font-medium ${cr.profit >= 0 ? 'text-[#0b7f7b]' : 'text-red-600'}`;
    case 'roas':
      return `${base} font-medium ${cr.roas >= 100 ? 'text-[#0b7f7b]' : 'text-red-600'}`;
    case 'cv':
      return `${base} font-medium text-gray-800`;
    default:
      return `${base} text-gray-800`;
  }
}

export default function Tab2Report() {
  const [creatives, setCreatives] = useState<CreativeData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 表示カラム管理
  const allColumnKeys = TABLE_HEADERS.map(h => h.key);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    if (typeof window === 'undefined') return allColumnKeys;
    try {
      const saved = localStorage.getItem(VISIBLE_COLUMNS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        const valid = parsed.filter(k => allColumnKeys.includes(k));
        return valid.length > 0 ? valid : allColumnKeys;
      }
    } catch { /* ignore */ }
    return allColumnKeys;
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // visibleColumnsをlocalStorageに保存
  useEffect(() => {
    localStorage.setItem(VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // 表示中のヘッダー（visibleColumnsの順序を尊重）
  const visibleHeaders = useMemo(
    () => visibleColumns
      .map(key => TABLE_HEADERS.find(h => h.key === key))
      .filter((h): h is typeof TABLE_HEADERS[number] => h !== undefined),
    [visibleColumns]
  );

  // サイドバー（Context）
  const { openSidebar, setSidebarData } = useCreativeSidebar();

  // データを読み込む（マウント時 & storageイベント時）
  useEffect(() => {
    const loadData = async () => {
      const data = await loadCreativesFromIndexedDB();
      setCreatives(data);
      setLastUpdated(loadSpreadsheetConfig()?.lastUpdated ?? null);
    };

    loadData();

    // localStorageの変更を検知（IndexedDBは対応していないため、focusイベントで対応）
    const handleFocus = () => loadData();
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // スプレッドシートからデータを更新
  const handleRefresh = async () => {
    const config = loadSpreadsheetConfig();
    if (!config?.spreadsheetId) return;

    setIsRefreshing(true);

    try {
      // クリエイティブマスタを取得（名前とリンク）
      let masterCreativeNames: string[] = [];
      let creativeLinkMap: Map<string, string> = new Map();
      try {
        const creativeCsvText = await fetchSpreadsheetDataByName(config.spreadsheetId, CREATIVE_SHEET_NAME);
        masterCreativeNames = parseCreativeMasterCsv(creativeCsvText);
        creativeLinkMap = parseCreativeMasterWithLinks(creativeCsvText);
      } catch (err) {
        console.warn('クリエイティブマスタの取得に失敗しました:', err);
      }

      const sortedCreativeNames = [...masterCreativeNames].sort((a, b) => b.length - a.length);

      // rawシートからCSVデータを取得（URLのgidまたはデフォルトgidを使用）
      const rawGid = extractSheetGid(config.url) || DEFAULT_RAW_GID;
      const csvText = await fetchSpreadsheetData(config.spreadsheetId, rawGid);
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
          creativeLink: creativeLinkMap.get(matchedCreativeName) || '',
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

      await saveCreativesToIndexedDB(withStatus);
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
  };

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
  const filteredCreatives = useMemo(() => creatives.filter(c => {
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
  }), [creatives, selectedAccounts, selectedPersons, range.from, range.to]);

  // サイドバー用にフィルタされたデータをContextに設定
  useEffect(() => {
    setSidebarData(filteredCreatives);
  }, [filteredCreatives, setSidebarData]);

  const summary = calculateSummary(filteredCreatives);

  // CR単位で集計
  const aggregatedByCreative = useMemo((): AggregatedCreativeData[] => {
    const grouped = new Map<string, {
      creativeName: string;
      creativeLink: string;
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
          creativeLink: c.creativeLink || '',
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
          {/* 担当者選択（複数選択可能） */}
          {personNames.length > 0 && (
            <MultiSelectDropdown
              options={personNames}
              selectedValues={selectedPersons}
              onChange={setSelectedPersons}
              placeholder="担当者を選択"
              searchPlaceholder="担当者を検索..."
              allLabel="全担当者"
              width="w-[140px]"
            />
          )}
          {/* アカウント選択（複数選択可能） */}
          {accountNames.length > 0 && (
            <MultiSelectDropdown
              options={accountNames}
              selectedValues={selectedAccounts}
              onChange={setSelectedAccounts}
              placeholder="アカウントを選択"
              searchPlaceholder="アカウントを検索..."
              allLabel="全アカウント"
              width="w-[180px]"
            />
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
      <DailyProfitChart data={filteredCreatives} onCreativeClick={openSidebar} />

      {/* パフォーマンスマトリクス */}
      <MatrixChart data={classifiedCR} onCreativeClick={openSidebar} />

      {/* 好調/不調CR */}
      <CreativeTable topCreatives={topCR} poorCreatives={poorCR} onCreativeClick={openSidebar} />

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
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={() => setFilters({})}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">filter_alt_off</span>
                フィルターをクリア
              </button>
            )}
            {/* 表示項目の変更ボタン */}
            <button
              onClick={() => setShowColumnPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-sm">view_column</span>
              表示項目の変更
            </button>
            {showColumnPicker && (
              <ColumnPickerModal
                allColumns={TABLE_HEADERS.map(h => ({ key: h.key, label: h.label }))}
                visibleColumns={visibleColumns}
                fixedColumns={['creativeName']}
                onApply={setVisibleColumns}
                onClose={() => setShowColumnPicker(false)}
              />
            )}
          </div>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto overscroll-contain">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-[#cfe7e7]">
                {visibleHeaders.map((header) => (
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
                  <td colSpan={visibleHeaders.length} className="py-8 text-center text-gray-400">
                    条件に一致するデータがありません
                  </td>
                </tr>
              ) : (
                filteredAndSortedCreatives.map((cr) => (
                  <tr key={cr.creativeName} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    {visibleHeaders.map((header) => {
                      if (header.key === 'creativeName') {
                        return (
                          <td key={header.key} className="py-3 px-3">
                            <button
                              onClick={() => openSidebar(cr.creativeName, cr.creativeLink)}
                              className="truncate block max-w-[200px] font-medium text-[#0b7f7b] hover:text-[#0a6966] hover:underline text-left cursor-pointer"
                              title={cr.creativeName}
                            >
                              {cr.creativeName}
                            </button>
                          </td>
                        );
                      }
                      return (
                        <td key={header.key} className={getCellClassName(cr, header.key)}>
                          {renderCellValue(cr, header.key)}
                        </td>
                      );
                    })}
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

'use client';

import { useState, useEffect, useCallback } from 'react';
import { CreativeData } from '@/types';
import { loadCreatives, saveCreatives } from '@/utils/storage';
import { assignCreativeStatus } from '@/utils/csvParser';
import {
  extractSpreadsheetId,
  fetchSpreadsheetDataByName,
  parseSpreadsheetCsv,
  parseCreativeMasterCsv,
  saveSpreadsheetConfig,
  loadSpreadsheetConfig,
  clearSpreadsheetConfig,
  SpreadsheetConfig,
  SpreadsheetAdData,
} from '@/utils/spreadsheet';

// シート名（固定）
const RAW_SHEET_NAME = 'raw';
const CREATIVE_SHEET_NAME = 'クリエイティブ';

// localStorage操作（前提条件）
const PREMISE_STORAGE_KEY = 'ad-dashboard-premise-data';

function clearPremiseData() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(PREMISE_STORAGE_KEY);
  }
}

export default function TabSettings() {
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [spreadsheetConfig, setSpreadsheetConfig] = useState<SpreadsheetConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creativeNames, setCreativeNames] = useState<string[]>([]);
  const [creativesCount, setCreativesCount] = useState(0);
  const [lastSyncResult, setLastSyncResult] = useState<string | null>(null);

  useEffect(() => {
    setCreativesCount(loadCreatives().length);

    const savedConfig = loadSpreadsheetConfig();
    if (savedConfig) {
      setSpreadsheetConfig(savedConfig);
      setSpreadsheetUrl(savedConfig.url);
    }
  }, []);

  const fetchFromSpreadsheet = useCallback(async (url: string) => {
    setIsLoading(true);
    setError(null);
    setLastSyncResult(null);

    try {
      const spreadsheetId = extractSpreadsheetId(url);
      if (!spreadsheetId) {
        throw new Error('無効なスプレッドシートURLです。Google スプレッドシートのURLを入力してください。');
      }

      // クリエイティブマスタを取得
      let masterCreativeNames: string[] = [];
      try {
        const creativeCsvText = await fetchSpreadsheetDataByName(spreadsheetId, CREATIVE_SHEET_NAME);
        masterCreativeNames = parseCreativeMasterCsv(creativeCsvText);
        setCreativeNames(masterCreativeNames);
      } catch (err) {
        console.warn('クリエイティブマスタの取得に失敗しました:', err);
      }

      const sortedCreativeNames = [...masterCreativeNames].sort((a, b) => b.length - a.length);

      // rawシートからCSVデータを取得
      const csvText = await fetchSpreadsheetDataByName(spreadsheetId, RAW_SHEET_NAME);
      const rawData = parseSpreadsheetCsv(csvText);

      if (rawData.length === 0) {
        throw new Error('データが見つかりません。シートにデータがあるか確認してください。');
      }

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
      setCreativesCount(withStatus.length);

      const config: SpreadsheetConfig = {
        url,
        spreadsheetId,
        gid: '0',
        lastUpdated: new Date().toISOString(),
      };
      setSpreadsheetConfig(config);
      saveSpreadsheetConfig(config);

      setLastSyncResult(`${withStatus.length}件のデータを同期しました`);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました');
      console.error('Spreadsheet fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLoadSpreadsheet = () => {
    if (spreadsheetUrl.trim()) {
      fetchFromSpreadsheet(spreadsheetUrl.trim());
    }
  };

  const handleRefresh = () => {
    if (spreadsheetConfig?.url) {
      fetchFromSpreadsheet(spreadsheetConfig.url);
    }
  };

  const handleDisconnect = () => {
    setSpreadsheetUrl('');
    setSpreadsheetConfig(null);
    setCreativeNames([]);
    setCreativesCount(0);
    setLastSyncResult(null);
    clearSpreadsheetConfig();
    clearPremiseData();
    saveCreatives([]);
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <div className="bg-gray-100 p-2 rounded-lg">
          <span className="material-symbols-outlined text-gray-600">settings</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">スプレッドシート連携</h2>
          <p className="text-sm text-gray-500">Google スプレッドシートからデータを取得・同期</p>
        </div>
      </div>

      {/* 接続状態 */}
      <div className="bg-white rounded-xl border border-[#cfe7e7] p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className={`p-2 rounded-lg ${spreadsheetConfig ? 'bg-green-100' : 'bg-gray-100'}`}>
            <span className={`material-symbols-outlined ${spreadsheetConfig ? 'text-green-600' : 'text-gray-400'}`}>
              {spreadsheetConfig ? 'link' : 'link_off'}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">接続状態</h3>
            <p className="text-sm text-gray-500">
              {spreadsheetConfig ? 'スプレッドシートに接続中' : '未接続'}
            </p>
          </div>
        </div>

        {spreadsheetConfig ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-green-600 mt-0.5">check_circle</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-800">接続済み</p>
                  <p className="text-xs text-green-600 truncate mt-1">{spreadsheetConfig.url}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 rounded text-xs text-green-700">
                      <span className="material-symbols-outlined text-sm">table_chart</span>
                      {RAW_SHEET_NAME}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 rounded text-xs text-green-700">
                      <span className="material-symbols-outlined text-sm">palette</span>
                      {CREATIVE_SHEET_NAME}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-800">{creativesCount}</p>
                <p className="text-xs text-gray-500 mt-1">データ件数</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-800">{creativeNames.length}</p>
                <p className="text-xs text-gray-500 mt-1">CRマスタ</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm font-medium text-gray-800">
                  {spreadsheetConfig.lastUpdated
                    ? new Date(spreadsheetConfig.lastUpdated).toLocaleString('ja-JP', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '-'}
                </p>
                <p className="text-xs text-gray-500 mt-1">最終同期</p>
              </div>
            </div>

            {lastSyncResult && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">info</span>
                <p className="text-sm text-blue-700">{lastSyncResult}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#0b7f7b] text-white rounded-lg hover:bg-[#0a6966] transition-all disabled:opacity-50"
              >
                <span className={`material-symbols-outlined ${isLoading ? 'animate-spin' : ''}`}>
                  {isLoading ? 'progress_activity' : 'sync'}
                </span>
                <span className="font-medium">{isLoading ? '同期中...' : 'データを同期'}</span>
              </button>
              <button
                onClick={handleDisconnect}
                disabled={isLoading}
                className="px-4 py-3 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined">link_off</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={spreadsheetUrl}
                onChange={(e) => setSpreadsheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="flex-1 px-4 py-3 border border-[#cfe7e7] rounded-lg focus:ring-2 focus:ring-[#0b7f7b] focus:border-[#0b7f7b] transition-all"
              />
              <button
                onClick={handleLoadSpreadsheet}
                disabled={isLoading || !spreadsheetUrl.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-[#0b7f7b] text-white rounded-lg hover:bg-[#0a6966] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                    <span>接続中...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">link</span>
                    <span>接続</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">接続手順</h4>
              <ol className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="bg-gray-200 text-gray-600 w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0">1</span>
                  <span>Google スプレッドシートを開く</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-gray-200 text-gray-600 w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0">2</span>
                  <span>「共有」→「リンクを知っている全員」に変更</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-gray-200 text-gray-600 w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0">3</span>
                  <span>URLをコピーして上に貼り付け</span>
                </li>
              </ol>
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  必要なシート: 「{RAW_SHEET_NAME}」「{CREATIVE_SHEET_NAME}」
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600">error</span>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

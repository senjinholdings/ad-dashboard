'use client';

import { useState, useEffect } from 'react';
import {
  loadSpreadsheetConfig,
  fetchSpreadsheetDataByName,
  parsePremiseSheetCsv,
  PremiseSheetData,
  defaultPremiseSheetData,
} from '@/utils/spreadsheet';
import { loadCreativesFromIndexedDB } from '@/utils/indexedDB';

// localStorage操作
const PREMISE_STORAGE_KEY = 'ad-dashboard-premise-data';

function loadPremiseData(): PremiseSheetData | null {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(PREMISE_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function savePremiseData(data: PremiseSheetData) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(PREMISE_STORAGE_KEY, JSON.stringify(data));
  }
}

// URLかどうかを判定
const isUrl = (str: string) => str.startsWith('http://') || str.startsWith('https://');

export default function Tab1Premise() {
  const [premiseData, setPremiseData] = useState<PremiseSheetData>(
    () => loadPremiseData() ?? defaultPremiseSheetData
  );
  const [isConnected] = useState(() => !!loadSpreadsheetConfig());
  const [popupImage, setPopupImage] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personNames, setPersonNames] = useState<string[]>([]);

  // 担当者リストを取得（IndexedDBから非同期で）
  useEffect(() => {
    loadCreativesFromIndexedDB().then((creatives) => {
      const names = new Set<string>();
      creatives.forEach((c) => {
        if (c.personName) {
          names.add(c.personName);
        }
      });
      setPersonNames(Array.from(names).sort());
    });
  }, []);

  // 初期選択を設定
  useEffect(() => {
    if (personNames.length > 0 && !selectedPerson) {
      setSelectedPerson(personNames[0]);
    }
  }, [personNames, selectedPerson]);

  // 表示ボタンクリック時の処理
  const handleDisplay = async () => {
    if (!selectedPerson) {
      setError('担当者を選択してください');
      return;
    }

    const config = loadSpreadsheetConfig();
    if (!config?.spreadsheetId) {
      setError('スプレッドシートが接続されていません');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 担当者名のシートからデータを取得
      const csvText = await fetchSpreadsheetDataByName(config.spreadsheetId, selectedPerson);
      const data = parsePremiseSheetCsv(csvText);
      setPremiseData(data);
      savePremiseData(data);
    } catch (err) {
      console.error('前提条件シートの取得に失敗:', err);
      setError(`シート「${selectedPerson}」の取得に失敗しました。シート名を確認してください。`);
    } finally {
      setIsLoading(false);
    }
  };

  // 接続されていない場合
  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <span className="material-symbols-outlined text-blue-600">assignment</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">前提整理</h2>
            <p className="text-sm text-gray-500">スプレッドシートから取得した前提条件</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#cfe7e7] p-12">
          <div className="text-center text-gray-400">
            <span className="material-symbols-outlined text-6xl mb-4 block">link_off</span>
            <p className="text-lg font-medium mb-2">スプレッドシート未接続</p>
            <p className="text-sm">「スプレッドシート連携」タブでデータを接続してください</p>
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
          <div className="bg-blue-100 p-2 rounded-lg">
            <span className="material-symbols-outlined text-blue-600">assignment</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">前提整理</h2>
            <p className="text-sm text-gray-500">スプレッドシートから取得した前提条件</p>
          </div>
        </div>

        {/* 担当者選択UI */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 font-medium">担当者:</label>
          <select
            value={selectedPerson}
            onChange={(e) => setSelectedPerson(e.target.value)}
            className="px-3 py-2 border border-[#cfe7e7] rounded-lg focus:ring-2 focus:ring-[#0b7f7b] focus:border-[#0b7f7b] transition-all text-sm min-w-[120px]"
          >
            {personNames.length === 0 && (
              <option value="">担当者がありません</option>
            )}
            {personNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            onClick={handleDisplay}
            disabled={isLoading || !selectedPerson}
            className="flex items-center gap-2 px-4 py-2 bg-[#0b7f7b] text-white rounded-lg hover:bg-[#0a6966] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {isLoading ? (
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

      {/* エラー表示 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-red-600">error</span>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 3カラムレイアウト */}
      <div className="grid grid-cols-3 gap-4">
        {/* 左カラム: 基本情報 */}
        <div className="bg-white rounded-xl border border-[#cfe7e7] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-purple-100 p-1.5 rounded-lg">
              <span className="material-symbols-outlined text-purple-600 text-lg">fact_check</span>
            </div>
            <h3 className="text-base font-semibold text-gray-800">基本情報</h3>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">現状の全体獲得件数</p>
              <p className="text-base font-semibold text-gray-800">{premiseData.totalAcquisitions || '-'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">クライアントの全体獲得件数</p>
              <p className="text-base font-semibold text-gray-800">{premiseData.clientAcquisitions || '-'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">弊社経由のクライアントROAS</p>
              <p className="text-base font-semibold text-[#0b7f7b]">{premiseData.ourROAS || '-'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">他社メディア経由のクライアントROAS</p>
              <p className="text-base font-semibold text-gray-800">{premiseData.competitorROAS || '-'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">TOP代理店名</p>
              <p className="text-base font-semibold text-gray-800">{premiseData.topAgency || '-'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">獲得メイン媒体</p>
              <p className="text-base font-semibold text-gray-800">{premiseData.mainMedia || '-'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">クライアント方針</p>
              <p className="text-sm text-gray-800">{premiseData.clientPolicy || '-'}</p>
            </div>
          </div>
        </div>

        {/* 中央カラム: 先週の検証・市場CR */}
        <div className="bg-white rounded-xl border border-[#cfe7e7] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-orange-100 p-1.5 rounded-lg">
              <span className="material-symbols-outlined text-orange-600 text-lg">history</span>
            </div>
            <h3 className="text-base font-semibold text-gray-800">先週の検証</h3>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">先週の検証内容</p>
              <p className="text-sm text-gray-800">{premiseData.lastWeekVerification || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">市場の上位CR TOP3</p>
              <div className="space-y-2">
                {[premiseData.marketCR1, premiseData.marketCR2, premiseData.marketCR3].map((cr, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-xs font-medium text-amber-600">
                        {index + 1}
                      </div>
                      <span className="text-xs text-gray-500">位</span>
                    </div>
                    {cr && isUrl(cr) ? (
                      <button
                        onClick={() => setPopupImage(cr)}
                        className="block w-full text-left"
                      >
                        <img
                          src={cr}
                          alt={`市場CR ${index + 1}位`}
                          className="w-full h-24 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity cursor-pointer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </button>
                    ) : cr ? (
                      <p className="text-xs text-gray-700 break-all">{cr}</p>
                    ) : (
                      <p className="text-xs text-gray-400">-</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 右カラム: 今週の方向性 */}
        <div className="bg-white rounded-xl border border-[#cfe7e7] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-teal-100 p-1.5 rounded-lg">
              <span className="material-symbols-outlined text-teal-600 text-lg">target</span>
            </div>
            <h3 className="text-base font-semibold text-gray-800">今週の方向性</h3>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">媒体戦略</p>
              <p className="text-sm text-gray-800">{premiseData.mediaStrategy || '-'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">アイディアの方針</p>
              <p className="text-sm text-gray-800">{premiseData.ideaDirection || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 画像ポップアップモーダル */}
      {popupImage && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setPopupImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] p-2">
            <button
              onClick={() => setPopupImage(null)}
              className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 z-10"
            >
              <span className="material-symbols-outlined text-gray-600">close</span>
            </button>
            <img
              src={popupImage}
              alt="市場CR"
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

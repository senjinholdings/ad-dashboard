// Google スプレッドシート関連のユーティリティ

export interface SpreadsheetInfo {
  id: string;
  url: string;
}

// スプレッドシートURLからIDを抽出
export function extractSpreadsheetId(url: string): string | null {
  // 対応するURLパターン:
  // https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit...
  // https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/...
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// URLからシートID (gid) を抽出
export function extractSheetGid(url: string): string | null {
  const match = url.match(/[#&]gid=(\d+)/);
  return match ? match[1] : null;
}

// スプレッドシートのCSVエクスポートURLを生成（gid指定）
export function getSpreadsheetCsvUrl(spreadsheetId: string, gid: string = '0'): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

// スプレッドシートのCSVエクスポートURLを生成（シート名指定）
export function getSpreadsheetCsvUrlByName(spreadsheetId: string, sheetName: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

// スプレッドシートからCSVデータを取得（gid指定）
export async function fetchSpreadsheetData(spreadsheetId: string, gid: string = '0'): Promise<string> {
  const csvUrl = getSpreadsheetCsvUrl(spreadsheetId, gid);

  const response = await fetch(csvUrl);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('スプレッドシートが見つかりません。URLを確認してください。');
    }
    if (response.status === 403) {
      throw new Error('アクセス権限がありません。「リンクを知っている全員」に共有設定を変更してください。');
    }
    throw new Error(`データの取得に失敗しました (${response.status})`);
  }

  const csvText = await response.text();

  // HTMLが返ってきた場合（共有設定が正しくない場合）
  if (csvText.startsWith('<!DOCTYPE') || csvText.startsWith('<html')) {
    throw new Error('スプレッドシートにアクセスできません。「リンクを知っている全員」に共有設定を変更してください。');
  }

  return csvText;
}

// スプレッドシートからCSVデータを取得（シート名指定）
export async function fetchSpreadsheetDataByName(spreadsheetId: string, sheetName: string): Promise<string> {
  const csvUrl = getSpreadsheetCsvUrlByName(spreadsheetId, sheetName);

  const response = await fetch(csvUrl);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`シート「${sheetName}」が見つかりません。`);
    }
    if (response.status === 403) {
      throw new Error('アクセス権限がありません。「リンクを知っている全員」に共有設定を変更してください。');
    }
    throw new Error(`データの取得に失敗しました (${response.status})`);
  }

  const csvText = await response.text();

  // HTMLやエラーが返ってきた場合
  if (csvText.startsWith('<!DOCTYPE') || csvText.startsWith('<html') || csvText.includes('Error')) {
    throw new Error(`シート「${sheetName}」にアクセスできません。シート名を確認してください。`);
  }

  return csvText;
}

// CSVテキストをパースしてRawAdDataの配列に変換
import Papa from 'papaparse';
import { RawAdData } from '@/types';

// スプレッドシートの拡張データ型（売上・粗利・ROASを含む）
export interface SpreadsheetAdData extends RawAdData {
  revenue: number;    // 売上
  profit: number;     // 粗利
  roas: number;       // ROAS
  projectName: string; // 商材名
  personName: string; // 担当者
  // accountNameはRawAdDataから継承
}

// CSVカラム名のマッピング（スプレッドシート形式対応）
const COLUMN_MAP: { [key: string]: keyof SpreadsheetAdData } = {
  // 日付
  '日付': 'reportStartDate',
  'レポート開始日': 'reportStartDate',
  'レポート終了日': 'reportEndDate',
  // 広告アカウント名
  '広告アカウント名': 'accountName',
  'アカウント名': 'accountName',
  // 広告名
  '広告名': 'adName',
  '広告の名前': 'adName',
  // アドセット名
  'アドセット名': 'adSetName',
  '広告セット名': 'adSetName',
  // インプレッション
  'imp': 'impressions',
  'インプレッション': 'impressions',
  // CPM
  'CPM': 'cpm',
  'CPM(インプレッション単価) (JPY)': 'cpm',
  // CV
  'CV': 'results',
  '結果': 'results',
  // CPA
  'CPA': 'costPerResult',
  '結果の単価': 'costPerResult',
  // 消化金額
  '消化金額': 'amountSpent',
  '消化金額 (JPY)': 'amountSpent',
  // 売上・粗利・ROAS（スプレッドシート独自）
  '売上': 'revenue',
  '粗利': 'profit',
  'ROAS': 'roas',
  // 商材名
  '商材名': 'projectName',
  // 担当者
  '担当者': 'personName',
  '担当': 'personName',
  '運用者': 'personName',
};

// 数値フィールドのリスト
const NUMERIC_FIELDS = ['impressions', 'cpm', 'results', 'costPerResult', 'amountSpent', 'revenue', 'profit', 'roas'];

export function parseSpreadsheetCsv(csvText: string): SpreadsheetAdData[] {
  // ヘッダーなしでパース（1行目がヘッダー）
  const result = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    console.warn('CSV parse warnings:', result.errors);
  }

  const rows = result.data;
  if (rows.length < 2) {
    // ヘッダー行 + 最低1行のデータが必要
    return [];
  }

  // ヘッダー行を動的に検出（「日付」と「広告アカウント名」の両方を含む行を探す）
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    const rowText = row.join(' ');
    // 「日付」と「広告アカウント名」の両方を含む行をヘッダーとする
    const hasDate = rowText.includes('日付');
    const hasAccountName = rowText.includes('広告アカウント名') || rowText.includes('アカウント名');
    if (hasDate && hasAccountName) {
      headerRowIndex = i;
      console.log('DEBUG: ヘッダー行検出 - row', i, ':', row.slice(0, 10));
      break;
    }
  }

  const headers = rows[headerRowIndex];
  // ヘッダー行の次の行からがデータ
  const dataRows = rows.slice(headerRowIndex + 1);

  // デバッグ: カラムマッチング結果を出力
  const columnMatches: Record<string, { headerIndex: number; headerName: string }> = {};
  for (const [csvCol, dataKey] of Object.entries(COLUMN_MAP)) {
    const headerIndex = headers.findIndex((h) => {
      if (!h) return false;
      const trimmedHeader = h.trim();
      return trimmedHeader === csvCol || trimmedHeader.includes(csvCol) || csvCol.includes(trimmedHeader);
    });
    if (headerIndex !== -1) {
      columnMatches[`${csvCol} → ${dataKey}`] = { headerIndex, headerName: headers[headerIndex] };
    }
  }
  console.log('DEBUG カラムマッチング:', columnMatches);
  console.log('DEBUG 全ヘッダー:', headers);
  // CVカラムの確認
  const cvHeaderIndex = headers.findIndex(h => h && (h.trim() === 'CV' || h.trim() === '結果' || h.trim().includes('CV') || h.trim().includes('結果')));
  console.log('DEBUG CV列:', { cvHeaderIndex, headerName: cvHeaderIndex >= 0 ? headers[cvHeaderIndex] : 'NOT FOUND', firstRowValue: cvHeaderIndex >= 0 ? dataRows[0]?.[cvHeaderIndex] : 'N/A' });

  return dataRows
    .filter((row) => {
      // 空の行をスキップ（広告アカウント名カラムで判定）
      const accountNameIndex = headers.findIndex(h => h && (h.includes('広告アカウント名') || h.includes('アカウント名')));
      const accountName = accountNameIndex >= 0 ? row[accountNameIndex] : row[0];
      return accountName && accountName.trim() !== '';
    })
    .map((row) => {
      // ヘッダーとデータを組み合わせてオブジェクトに変換（部分一致対応）
      const mapped: Partial<SpreadsheetAdData> = {};

      for (const [csvCol, dataKey] of Object.entries(COLUMN_MAP)) {
        // ヘッダーの部分一致でカラムを検索
        const headerIndex = headers.findIndex((h) => {
          if (!h) return false;
          const trimmedHeader = h.trim();
          // 完全一致または部分一致
          return trimmedHeader === csvCol || trimmedHeader.includes(csvCol) || csvCol.includes(trimmedHeader);
        });

        if (headerIndex !== -1 && row[headerIndex] !== undefined) {
          const value = row[headerIndex];
          if (value !== '') {
            if (NUMERIC_FIELDS.includes(dataKey)) {
              // 数値の場合、カンマを除去してパース
              const numValue = parseFloat(String(value).replace(/,/g, '')) || 0;
              (mapped as Record<string, unknown>)[dataKey] = numValue;
            } else {
              (mapped as Record<string, unknown>)[dataKey] = value;
            }
          }
        }
      }

      // デフォルト値の設定
      return {
        reportStartDate: mapped.reportStartDate || '',
        reportEndDate: mapped.reportEndDate || '',
        accountName: mapped.accountName || '',
        adName: mapped.adName || '',
        adSetName: mapped.adSetName || '',
        impressions: mapped.impressions || 0,
        cpm: mapped.cpm || 0,
        results: mapped.results || 0,
        costPerResult: mapped.costPerResult || 0,
        amountSpent: mapped.amountSpent || 0,
        revenue: mapped.revenue || 0,
        profit: mapped.profit || 0,
        roas: mapped.roas || 0,
        projectName: mapped.projectName || '',
        personName: mapped.personName || '',
      } as SpreadsheetAdData;
    });
}

// 保存用のスプレッドシート設定
export interface SpreadsheetConfig {
  url: string;
  spreadsheetId: string;
  gid: string;
  creativeGid?: string; // クリエイティブシートのgid
  lastUpdated: string;
}

// 前提条件データの型
export interface PremiseSheetData {
  totalAcquisitions: string;
  clientAcquisitions: string;
  ourROAS: string;
  competitorROAS: string;
  topAgency: string;
  mainMedia: string;
  clientPolicy: string;
  lastWeekVerification: string;
  marketCR1: string;
  marketCR2: string;
  marketCR3: string;
  mediaStrategy: string;
  ideaDirection: string;
}

export const defaultPremiseSheetData: PremiseSheetData = {
  totalAcquisitions: '',
  clientAcquisitions: '',
  ourROAS: '',
  competitorROAS: '',
  topAgency: '',
  mainMedia: '',
  clientPolicy: '',
  lastWeekVerification: '',
  marketCR1: '',
  marketCR2: '',
  marketCR3: '',
  mediaStrategy: '',
  ideaDirection: '',
};

// CSVから前提条件データをパース（ラベルで特定）
export function parsePremiseSheetCsv(csvText: string): PremiseSheetData {
  const result = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: false,
  });

  const data = { ...defaultPremiseSheetData };
  const rows = result.data;

  for (const row of rows) {
    const label = (row[0] || '').trim();
    const value = row[1] || '';

    if (label.includes('現状の全体獲得件数')) data.totalAcquisitions = value;
    else if (label.includes('クライアントの全体獲得件数')) data.clientAcquisitions = value;
    else if (label.includes('弊社経由') && label.includes('ROAS')) data.ourROAS = value;
    else if (label.includes('他社') && label.includes('ROAS')) data.competitorROAS = value;
    else if (label.includes('TOP代理店')) data.topAgency = value;
    else if (label.includes('獲得メイン媒体')) data.mainMedia = value;
    else if (label.includes('クライアント方針')) data.clientPolicy = value;
    else if (label.includes('先週何を検証')) data.lastWeekVerification = value;
    else if (label.includes('市場の上位CR') && label.includes('1位')) data.marketCR1 = value;
    else if (label.includes('市場の上位CR') && label.includes('2位')) data.marketCR2 = value;
    else if (label.includes('市場の上位CR') && label.includes('3位')) data.marketCR3 = value;
    else if (label.includes('媒体戦略')) data.mediaStrategy = value;
    else if (label.includes('アイディアの方針')) data.ideaDirection = value;
  }

  return data;
}

// クリエイティブマスタの型（名前とリンク）
export interface CreativeMaster {
  name: string;
  link: string;
}

// クリエイティブマスタをパース（A列: クリエイティブ名、C列: リンク）
export function parseCreativeMasterCsv(csvText: string): string[] {
  // PapaParseで正しくパース（複数行にまたがる引用符付きフィールドに対応）
  const result = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
  });

  // 最初の3行をスキップし、A列（index 0）の値を取得
  return result.data
    .slice(3)
    .map(row => (row[0] || '').trim())
    .filter(name => name && name.length > 0);
}

// クリエイティブマスタをパース（名前とリンクのマップを返す）
export function parseCreativeMasterWithLinks(csvText: string): Map<string, string> {
  const result = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
  });

  const linkMap = new Map<string, string>();

  // 最初の3行をスキップし、A列（名前）とC列（リンク）を取得
  result.data.slice(3).forEach(row => {
    const name = (row[0] || '').trim();
    const link = (row[2] || '').trim();
    if (name && name.length > 0) {
      linkMap.set(name, link);
    }
  });

  return linkMap;
}

// 広告名からクリエイティブ名をマッチング
export function matchCreativeName(adName: string, creativeNames: string[]): string | null {
  if (!adName) return null;

  // 長い名前から順にマッチング（部分一致で最長マッチを優先）
  const sortedNames = [...creativeNames].sort((a, b) => b.length - a.length);

  for (const creativeName of sortedNames) {
    if (adName.includes(creativeName)) {
      return creativeName;
    }
  }

  return null;
}

const STORAGE_KEY = 'ad-dashboard-spreadsheet-config';

export function saveSpreadsheetConfig(config: SpreadsheetConfig): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }
}

export function loadSpreadsheetConfig(): SpreadsheetConfig | null {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : null;
}

export function clearSpreadsheetConfig(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

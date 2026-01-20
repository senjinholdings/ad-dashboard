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
};

// 数値フィールドのリスト
const NUMERIC_FIELDS = ['impressions', 'cpm', 'results', 'costPerResult', 'amountSpent', 'revenue', 'profit', 'roas'];

export function parseSpreadsheetCsv(csvText: string): SpreadsheetAdData[] {
  // gviz形式はヘッダーが1行目から始まる（スキップ不要）
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    console.warn('CSV parse warnings:', result.errors);
  }

  return result.data
    .filter((row) => {
      // 空の行をスキップ
      const firstValue = Object.values(row)[0];
      return firstValue && firstValue.trim() !== '';
    })
    .map((row) => {
      const mapped: Partial<SpreadsheetAdData> = {};

      for (const [csvCol, dataKey] of Object.entries(COLUMN_MAP)) {
        const value = row[csvCol];
        if (value !== undefined && value !== '') {
          if (NUMERIC_FIELDS.includes(dataKey)) {
            // 数値の場合、カンマを除去してパース
            const numValue = parseFloat(String(value).replace(/,/g, '')) || 0;
            (mapped as Record<string, unknown>)[dataKey] = numValue;
          } else {
            (mapped as Record<string, unknown>)[dataKey] = value;
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

// クリエイティブマスタをパース（A列の4行目以降がクリエイティブ名）
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

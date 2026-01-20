import Papa from 'papaparse';
import { RawAdData, CreativeData, Project, SummaryData } from '@/types';

// CSVカラム名のマッピング
const COLUMN_MAP: { [key: string]: keyof RawAdData } = {
  'レポート開始日': 'reportStartDate',
  'レポート終了日': 'reportEndDate',
  '広告の名前': 'adName',
  '広告セット名': 'adSetName',
  'インプレッション': 'impressions',
  'CPM(インプレッション単価) (JPY)': 'cpm',
  '結果': 'results',
  '結果の単価': 'costPerResult',
  '消化金額 (JPY)': 'amountSpent',
};

// CSVをパースしてRawAdDataの配列に変換
export function parseCSV(file: File): Promise<RawAdData[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const data = results.data.map((row) => {
            const mapped: Partial<RawAdData> = {};

            for (const [csvCol, dataKey] of Object.entries(COLUMN_MAP)) {
              const value = row[csvCol];
              if (value !== undefined) {
                if (['impressions', 'cpm', 'results', 'costPerResult', 'amountSpent'].includes(dataKey)) {
                  // 数値の場合、カンマを除去してパース
                  const numValue = parseFloat(String(value).replace(/,/g, '')) || 0;
                  (mapped as Record<string, unknown>)[dataKey] = numValue;
                } else {
                  (mapped as Record<string, unknown>)[dataKey] = value;
                }
              }
            }

            return mapped as RawAdData;
          });

          resolve(data);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

// 案件マスタとマッチングして計算済みデータを生成
export function calculateCreativeData(
  rawData: RawAdData[],
  projects: Project[],
  creativeNames: string[] = [] // クリエイティブマスタ（オプション）
): CreativeData[] {
  // 長い名前から順にソート（最長マッチ優先）
  const sortedCreativeNames = [...creativeNames].sort((a, b) => b.length - a.length);

  return rawData.map((raw, index) => {
    // 広告セット名で案件をマッチング
    const matchedProject = projects.find(p =>
      raw.adSetName?.includes(p.name) || p.name.includes(raw.adSetName || '')
    );

    // 広告名からクリエイティブ名をマッチング
    let creativeName = '';
    if (raw.adName && sortedCreativeNames.length > 0) {
      for (const name of sortedCreativeNames) {
        if (raw.adName.includes(name)) {
          creativeName = name;
          break;
        }
      }
    }

    const unitPrice = matchedProject?.unitPrice || 0;
    const revenue = unitPrice * raw.results;
    const profit = revenue - raw.amountSpent;
    const roas = raw.amountSpent > 0 ? (revenue / raw.amountSpent) * 100 : 0;

    return {
      id: `creative-${index}-${Date.now()}`,
      date: raw.reportStartDate || '',
      adName: raw.adName || '',
      adSetName: raw.adSetName || '',
      projectName: matchedProject?.name || '未設定',
      creativeName,
      impressions: raw.impressions || 0,
      cpm: raw.cpm || 0,
      cv: raw.results || 0,
      cpa: raw.costPerResult || 0,
      cost: raw.amountSpent || 0,
      revenue,
      profit,
      roas,
      status: 'excellent' as const, // 後で相対評価で更新
    };
  });
}

// 相対評価でステータスを決定
export function assignCreativeStatus(creatives: CreativeData[]): CreativeData[] {
  if (creatives.length === 0) return [];

  // 平均値を計算
  const avgCV = creatives.reduce((sum, c) => sum + c.cv, 0) / creatives.length;
  const avgCPA = creatives.reduce((sum, c) => sum + c.cpa, 0) / creatives.length;

  return creatives.map(creative => {
    let status: CreativeData['status'];

    if (creative.cv >= avgCV && creative.cpa <= avgCPA) {
      status = 'excellent'; // 優良: CV多い & CPA低い
    } else if (creative.cv < avgCV && creative.cpa <= avgCPA) {
      status = 'potential'; // 拡大余地: CV少ない & CPA低い
    } else if (creative.cv >= avgCV && creative.cpa > avgCPA) {
      status = 'improve'; // 効率改善: CV多い & CPA高い
    } else {
      status = 'poor'; // 要改善: CV少ない & CPA高い
    }

    return { ...creative, status };
  });
}

// サマリーデータを計算
export function calculateSummary(creatives: CreativeData[]): SummaryData {
  // 広告セット数: ユニークな広告セット名
  const uniqueAdSetNames = new Set(creatives.map(c => c.adSetName));
  const adSetCount = uniqueAdSetNames.size;

  // 広告数: ユニークな広告名
  const uniqueAdNames = new Set(creatives.map(c => c.adName));
  const adCount = uniqueAdNames.size;

  // クリエイティブ本数: ユニークなクリエイティブ名（空文字を除く）
  const uniqueCreativeNames = new Set(creatives.map(c => c.creativeName).filter(Boolean));
  const creativeCount = uniqueCreativeNames.size;

  const totalCV = creatives.reduce((sum, c) => sum + c.cv, 0);
  const totalRevenue = creatives.reduce((sum, c) => sum + c.revenue, 0);
  const totalProfit = creatives.reduce((sum, c) => sum + c.profit, 0);
  const totalCost = creatives.reduce((sum, c) => sum + c.cost, 0);
  const averageROAS = totalCost > 0 ? (totalRevenue / totalCost) * 100 : 0;

  return {
    adSetCount,
    adCount,
    creativeCount,
    totalCV,
    totalRevenue,
    totalProfit,
    averageROAS,
    totalCost,
  };
}

// 好調CR（上位3つ）を取得
export function getTopCreatives(creatives: CreativeData[], count: number = 3): CreativeData[] {
  return [...creatives]
    .sort((a, b) => b.profit - a.profit)
    .slice(0, count);
}

// 不調CR（赤字額が大きい上位5本）を取得
export function getPoorCreatives(creatives: CreativeData[], count: number = 5): CreativeData[] {
  return [...creatives]
    .filter(c => c.profit < 0)              // 赤字のみ抽出
    .sort((a, b) => a.profit - b.profit)    // 赤字額が大きい順（利益が小さい順）
    .slice(0, count);
}

// 数値フォーマット
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('ja-JP').format(Math.round(num));
}

// 通貨フォーマット
export function formatCurrency(num: number): string {
  if (Math.abs(num) >= 10000) {
    return `¥${(num / 10000).toFixed(1)}万`;
  }
  return `¥${formatNumber(num)}`;
}

// 通貨フォーマット（フル表記: ¥12,000）
export function formatCurrencyFull(num: number): string {
  return `¥${formatNumber(num)}`;
}

// パーセントフォーマット
export function formatPercent(num: number): string {
  return `${num.toFixed(1)}%`;
}

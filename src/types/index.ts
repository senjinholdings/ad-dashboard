// 案件マスタ
export interface Project {
  id: string;
  name: string;
  unitPrice: number; // 単価
}

// CSVから読み込んだ生データ
export interface RawAdData {
  reportStartDate: string;
  reportEndDate: string;
  accountName: string; // 広告アカウント名
  adName: string;
  adSetName: string;
  impressions: number;
  cpm: number;
  results: number; // CV
  costPerResult: number; // CPA
  amountSpent: number; // 広告費
}

// 計算済みクリエイティブデータ
export interface CreativeData {
  id: string;
  date: string; // 日付
  accountName: string; // 広告アカウント名
  personName: string; // 担当者
  adName: string;
  adSetName: string;
  projectName: string;
  creativeName: string; // マッチしたクリエイティブ名
  impressions: number;
  cpm: number;
  cv: number;
  cpa: number;
  cost: number;
  revenue: number; // 売上
  profit: number; // 利益
  roas: number; // ROAS (%)
  status: 'excellent' | 'potential' | 'improve' | 'poor'; // 4象限
}

// CR単位の集計データ
export interface AggregatedCreativeData {
  creativeName: string;
  adCount: number;
  impressions: number;
  cpm: number;
  cv: number;
  cpa: number;
  cost: number;
  revenue: number;
  profit: number;
  roas: number;
}

// サマリーデータ
export interface SummaryData {
  adSetCount: number;     // 広告セット数（ユニークな広告セット名）
  adCount: number;        // 広告数（ユニークな広告名）
  creativeCount: number;  // クリエイティブ本数（ユニークなクリエイティブ名）
  totalCV: number;
  totalRevenue: number;
  totalProfit: number;
  averageROAS: number;
  totalCost: number;
}

// 前提整理データ
export interface PremiseData {
  totalAcquisitions: number;
  clientAcquisitions: number;
  topAgency: string;
  acquiringMedia: string[];
  ourROAS: number;
  competitorROAS: number;
  clientPolicy: 'expand' | 'maintain' | 'reduce';
  notes: string;
}

// 今週の方針データ
export interface StrategyData {
  focusMedia: string[];
  mediaAllocation: { [key: string]: number };
  strategyReason: string;
  creativeDirection: string;
  plannedCreatives: number;
  ideas: string;
}

// 結果報告データ
export interface ReportData {
  weekStartDate: string;
  lastWeekVerification: string;
  marketTopCreatives: string[];
}

// 保存用データ全体
export interface DashboardData {
  premise: PremiseData;
  report: ReportData;
  strategy: StrategyData;
  projects: Project[];
  creatives: CreativeData[];
  lastUpdated: string;
}

// デフォルト値
export const defaultPremiseData: PremiseData = {
  totalAcquisitions: 0,
  clientAcquisitions: 0,
  topAgency: '',
  acquiringMedia: [],
  ourROAS: 0,
  competitorROAS: 0,
  clientPolicy: 'maintain',
  notes: '',
};

export const defaultStrategyData: StrategyData = {
  focusMedia: [],
  mediaAllocation: {},
  strategyReason: '',
  creativeDirection: '',
  plannedCreatives: 0,
  ideas: '',
};

export const defaultReportData: ReportData = {
  weekStartDate: '',
  lastWeekVerification: '',
  marketTopCreatives: ['', '', ''],
};

import {
  DashboardData,
  Project,
  PremiseData,
  StrategyData,
  ReportData,
  CreativeData,
  defaultPremiseData,
  defaultStrategyData,
  defaultReportData,
} from '@/types';

const STORAGE_KEY = 'ad-dashboard-data';

// デフォルトデータ
const defaultDashboardData: DashboardData = {
  premise: defaultPremiseData,
  report: defaultReportData,
  strategy: defaultStrategyData,
  projects: [],
  creatives: [],
  lastUpdated: new Date().toISOString(),
};

// データを読み込み
export function loadData(): DashboardData {
  if (typeof window === 'undefined') {
    return defaultDashboardData;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...defaultDashboardData,
        ...parsed,
      };
    }
  } catch (error) {
    console.error('Failed to load data from localStorage:', error);
  }

  return defaultDashboardData;
}

// データを保存
export function saveData(data: Partial<DashboardData>): void {
  if (typeof window === 'undefined') return;

  try {
    const current = loadData();
    const updated: DashboardData = {
      ...current,
      ...data,
      lastUpdated: new Date().toISOString(),
    };
    const jsonStr = JSON.stringify(updated);
    console.log('DEBUG saveData: attempting to save', jsonStr.length, 'bytes, creatives count:', updated.creatives?.length || 0);
    localStorage.setItem(STORAGE_KEY, jsonStr);
    console.log('DEBUG saveData: success');
  } catch (error) {
    console.error('Failed to save data to localStorage:', error);
  }
}

// 案件マスタを保存
export function saveProjects(projects: Project[]): void {
  saveData({ projects });
}

// 案件マスタを取得
export function loadProjects(): Project[] {
  return loadData().projects;
}

// 前提整理を保存
export function savePremise(premise: PremiseData): void {
  saveData({ premise });
}

// 前提整理を取得
export function loadPremise(): PremiseData {
  return loadData().premise;
}

// 方針を保存
export function saveStrategy(strategy: StrategyData): void {
  saveData({ strategy });
}

// 方針を取得
export function loadStrategy(): StrategyData {
  return loadData().strategy;
}

// 結果報告を保存
export function saveReport(report: ReportData): void {
  saveData({ report });
}

// 結果報告を取得
export function loadReport(): ReportData {
  return loadData().report;
}

// クリエイティブデータを保存
export function saveCreatives(creatives: CreativeData[]): void {
  saveData({ creatives });
}

// クリエイティブデータを取得
export function loadCreatives(): CreativeData[] {
  return loadData().creatives;
}

// 全データをクリア
export function clearAllData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

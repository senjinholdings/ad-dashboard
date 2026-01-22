// IndexedDB ストレージユーティリティ
// localStorage の 5MB 制限を回避するために使用

import { DashboardData, CreativeData, defaultPremiseData, defaultStrategyData, defaultReportData } from '@/types';

const DB_NAME = 'ad-dashboard-db';
const DB_VERSION = 1;
const STORE_NAME = 'dashboard-data';
const DATA_KEY = 'main';

// デフォルトデータ
const defaultDashboardData: DashboardData = {
  premise: defaultPremiseData,
  report: defaultReportData,
  strategy: defaultStrategyData,
  projects: [],
  creatives: [],
  lastUpdated: new Date().toISOString(),
};

// IndexedDB を開く
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB open error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

// データを読み込み（非同期）
export async function loadDataFromIndexedDB(): Promise<DashboardData> {
  if (typeof window === 'undefined') {
    return defaultDashboardData;
  }

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(DATA_KEY);

      request.onsuccess = () => {
        const data = request.result;
        if (data) {
          resolve({
            ...defaultDashboardData,
            ...data,
          });
        } else {
          resolve(defaultDashboardData);
        }
        db.close();
      };

      request.onerror = () => {
        console.error('IndexedDB read error:', request.error);
        resolve(defaultDashboardData);
        db.close();
      };
    });
  } catch (error) {
    console.error('Failed to load data from IndexedDB:', error);
    return defaultDashboardData;
  }
}

// データを保存（非同期）
export async function saveDataToIndexedDB(data: Partial<DashboardData>): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await openDB();
    const current = await loadDataFromIndexedDB();
    const updated: DashboardData = {
      ...current,
      ...data,
      lastUpdated: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(updated, DATA_KEY);

      request.onsuccess = () => {
        console.log('DEBUG IndexedDB: saved successfully, creatives count:', updated.creatives?.length || 0);
        resolve();
        db.close();
      };

      request.onerror = () => {
        console.error('IndexedDB write error:', request.error);
        reject(request.error);
        db.close();
      };
    });
  } catch (error) {
    console.error('Failed to save data to IndexedDB:', error);
    throw error;
  }
}

// クリエイティブデータを保存
export async function saveCreativesToIndexedDB(creatives: CreativeData[]): Promise<void> {
  await saveDataToIndexedDB({ creatives });
}

// クリエイティブデータを取得
export async function loadCreativesFromIndexedDB(): Promise<CreativeData[]> {
  const data = await loadDataFromIndexedDB();
  return data.creatives;
}

// 全データをクリア
export async function clearAllDataFromIndexedDB(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(DATA_KEY);

      request.onsuccess = () => {
        resolve();
        db.close();
      };

      request.onerror = () => {
        console.error('IndexedDB delete error:', request.error);
        reject(request.error);
        db.close();
      };
    });
  } catch (error) {
    console.error('Failed to clear IndexedDB:', error);
    throw error;
  }
}

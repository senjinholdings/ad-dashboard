'use client';

import { createContext, useContext, useState, ReactNode, useMemo, useCallback } from 'react';

// LocalStorage キー
const STORAGE_KEYS = {
  selectedAccounts: 'selected-account-names',
};

// Context型
interface AccountContextType {
  // 選択されたアカウント名の配列
  selectedAccounts: string[];
  setSelectedAccounts: (accounts: string[]) => void;

  // 単一選択用（最初のアカウント）
  selectedAccount: string | null;

  // 全選択かどうか
  isAllSelected: boolean;

  // アカウント選択をトグル
  toggleAccount: (account: string) => void;

  // 全選択/全解除
  selectAll: (accounts: string[]) => void;
  clearSelection: () => void;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

// LocalStorageから初期値を取得
const getInitialSelectedAccounts = (): string[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEYS.selectedAccounts);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
};

// Provider
export function AccountProvider({ children }: { children: ReactNode }) {
  const [selectedAccounts, setSelectedAccountsState] = useState<string[]>(
    () => getInitialSelectedAccounts()
  );

  // 選択アカウントを設定
  const setSelectedAccounts = useCallback((accounts: string[]) => {
    setSelectedAccountsState(accounts);
    if (accounts.length > 0) {
      localStorage.setItem(STORAGE_KEYS.selectedAccounts, JSON.stringify(accounts));
    } else {
      localStorage.removeItem(STORAGE_KEYS.selectedAccounts);
    }
  }, []);

  // アカウントをトグル
  const toggleAccount = useCallback((account: string) => {
    setSelectedAccountsState(prev => {
      const newAccounts = prev.includes(account)
        ? prev.filter(a => a !== account)
        : [...prev, account];

      if (newAccounts.length > 0) {
        localStorage.setItem(STORAGE_KEYS.selectedAccounts, JSON.stringify(newAccounts));
      } else {
        localStorage.removeItem(STORAGE_KEYS.selectedAccounts);
      }

      return newAccounts;
    });
  }, []);

  // 全選択
  const selectAll = useCallback((accounts: string[]) => {
    setSelectedAccountsState(accounts);
    localStorage.setItem(STORAGE_KEYS.selectedAccounts, JSON.stringify(accounts));
  }, []);

  // 全解除
  const clearSelection = useCallback(() => {
    setSelectedAccountsState([]);
    localStorage.removeItem(STORAGE_KEYS.selectedAccounts);
  }, []);

  // 単一選択用（最初のアカウント）
  const selectedAccount = useMemo(
    () => selectedAccounts.length > 0 ? selectedAccounts[0] : null,
    [selectedAccounts]
  );

  // 全選択かどうか（外部から判定）
  const isAllSelected = selectedAccounts.length === 0;

  return (
    <AccountContext.Provider
      value={{
        selectedAccounts,
        setSelectedAccounts,
        selectedAccount,
        isAllSelected,
        toggleAccount,
        selectAll,
        clearSelection,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

// Hook
export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
}

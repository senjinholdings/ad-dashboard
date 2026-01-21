'use client';

import { createContext, useContext, useState, ReactNode, useMemo, useCallback } from 'react';

// LocalStorage キー
const STORAGE_KEYS = {
  selectedPersons: 'selected-person-names',
};

// Context型
interface PersonContextType {
  // 選択された担当者名の配列
  selectedPersons: string[];
  setSelectedPersons: (persons: string[]) => void;

  // 単一選択用（最初の担当者）
  selectedPerson: string | null;

  // 全選択かどうか
  isAllSelected: boolean;

  // 担当者選択をトグル
  togglePerson: (person: string) => void;

  // 全選択/全解除
  selectAll: (persons: string[]) => void;
  clearSelection: () => void;
}

const PersonContext = createContext<PersonContextType | undefined>(undefined);

// LocalStorageから初期値を取得
const getInitialSelectedPersons = (): string[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEYS.selectedPersons);
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
export function PersonProvider({ children }: { children: ReactNode }) {
  const [selectedPersons, setSelectedPersonsState] = useState<string[]>(
    () => getInitialSelectedPersons()
  );

  // 選択担当者を設定
  const setSelectedPersons = useCallback((persons: string[]) => {
    setSelectedPersonsState(persons);
    if (persons.length > 0) {
      localStorage.setItem(STORAGE_KEYS.selectedPersons, JSON.stringify(persons));
    } else {
      localStorage.removeItem(STORAGE_KEYS.selectedPersons);
    }
  }, []);

  // 担当者をトグル
  const togglePerson = useCallback((person: string) => {
    setSelectedPersonsState(prev => {
      const newPersons = prev.includes(person)
        ? prev.filter(p => p !== person)
        : [...prev, person];

      if (newPersons.length > 0) {
        localStorage.setItem(STORAGE_KEYS.selectedPersons, JSON.stringify(newPersons));
      } else {
        localStorage.removeItem(STORAGE_KEYS.selectedPersons);
      }

      return newPersons;
    });
  }, []);

  // 全選択
  const selectAll = useCallback((persons: string[]) => {
    setSelectedPersonsState(persons);
    localStorage.setItem(STORAGE_KEYS.selectedPersons, JSON.stringify(persons));
  }, []);

  // 全解除
  const clearSelection = useCallback(() => {
    setSelectedPersonsState([]);
    localStorage.removeItem(STORAGE_KEYS.selectedPersons);
  }, []);

  // 単一選択用（最初の担当者）
  const selectedPerson = useMemo(
    () => selectedPersons.length > 0 ? selectedPersons[0] : null,
    [selectedPersons]
  );

  // 全選択かどうか（外部から判定）
  const isAllSelected = selectedPersons.length === 0;

  return (
    <PersonContext.Provider
      value={{
        selectedPersons,
        setSelectedPersons,
        selectedPerson,
        isAllSelected,
        togglePerson,
        selectAll,
        clearSelection,
      }}
    >
      {children}
    </PersonContext.Provider>
  );
}

// Hook
export function usePerson() {
  const context = useContext(PersonContext);
  if (!context) {
    throw new Error('usePerson must be used within a PersonProvider');
  }
  return context;
}

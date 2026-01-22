'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CreativeData } from '@/types';

interface SidebarState {
  creativeName: string;
  creativeLink: string;
}

interface CreativeSidebarContextValue {
  // 右サイドバー状態
  sidebar: SidebarState | null;
  openSidebar: (creativeName: string, creativeLink: string) => void;
  closeSidebar: () => void;
  // データ（選択期間でフィルタされたデータ）
  sidebarData: CreativeData[];
  setSidebarData: (data: CreativeData[]) => void;
  // 左サイドバー折りたたみ状態
  isLeftSidebarCollapsed: boolean;
  setLeftSidebarCollapsed: (collapsed: boolean) => void;
}

const CreativeSidebarContext = createContext<CreativeSidebarContextValue | null>(null);

export function CreativeSidebarProvider({ children }: { children: ReactNode }) {
  const [sidebar, setSidebar] = useState<SidebarState | null>(null);
  const [sidebarData, setSidebarData] = useState<CreativeData[]>([]);
  const [isLeftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);

  const openSidebar = useCallback((creativeName: string, creativeLink: string) => {
    setSidebar({ creativeName, creativeLink });
    setLeftSidebarCollapsed(true); // 右サイドバーが開いたら左を折りたたむ
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebar(null);
    setLeftSidebarCollapsed(false); // 右サイドバーが閉じたら左を展開
  }, []);

  return (
    <CreativeSidebarContext.Provider
      value={{
        sidebar,
        openSidebar,
        closeSidebar,
        sidebarData,
        setSidebarData,
        isLeftSidebarCollapsed,
        setLeftSidebarCollapsed,
      }}
    >
      {children}
    </CreativeSidebarContext.Provider>
  );
}

export function useCreativeSidebar() {
  const context = useContext(CreativeSidebarContext);
  if (!context) {
    throw new Error('useCreativeSidebar must be used within a CreativeSidebarProvider');
  }
  return context;
}

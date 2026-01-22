'use client';

import { useState } from 'react';
import Tab1Premise from '@/components/Tab1Premise';
import Tab2Report from '@/components/Tab2Report';
import TabSettings from '@/components/TabSettings';
import CreativeSidebar from '@/components/CreativeSidebar';
import { useCreativeSidebar } from '@/contexts/CreativeSidebarContext';

const TABS = [
  { id: 'premise', label: '前提整理', icon: 'assignment' },
  { id: 'report', label: 'ダッシュボード', icon: 'bar_chart' },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState('report');
  const { sidebar, closeSidebar, sidebarData, isLeftSidebarCollapsed, setLeftSidebarCollapsed } = useCreativeSidebar();

  return (
    <div className="h-screen bg-[#f6f8f8] flex overflow-hidden">
      {/* 左サイドバー（折りたたみ可能） */}
      <aside
        className={`bg-[#0b7f7b] text-white flex flex-col h-screen shrink-0 transition-all duration-300 ease-in-out ${
          isLeftSidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* ロゴ・タイトル */}
        <div className="px-4 py-6 border-b border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isLeftSidebarCollapsed ? (
                /* 閉じている状態：ホバーで開くボタン表示 */
                <button
                  onClick={() => setLeftSidebarCollapsed(false)}
                  className="group relative"
                >
                  <span className="material-symbols-outlined text-2xl group-hover:opacity-0 transition-opacity">
                    monitoring
                  </span>
                  <span className="material-symbols-outlined text-2xl absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    left_panel_open
                  </span>
                  {/* カスタムツールチップ */}
                  <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    サイドバーを開く
                  </span>
                </button>
              ) : (
                <span className="material-symbols-outlined text-2xl">monitoring</span>
              )}
              {!isLeftSidebarCollapsed && (
                <div className="overflow-hidden">
                  <h1 className="text-lg font-bold tracking-tight whitespace-nowrap">
                    広告運用DB
                  </h1>
                  <p className="text-xs text-teal-100 mt-0.5 whitespace-nowrap">
                    週次報告・分析ツール
                  </p>
                </div>
              )}
            </div>
            {/* 折りたたみトグル（開いている時のみ表示） */}
            {!isLeftSidebarCollapsed && (
              <button
                onClick={() => setLeftSidebarCollapsed(true)}
                className="group relative p-1 hover:bg-white/10 rounded transition-colors"
              >
                <span className="material-symbols-outlined text-lg">
                  left_panel_close
                </span>
                {/* カスタムツールチップ */}
                <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  サイドバーを閉じる
                </span>
              </button>
            )}
          </div>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 py-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all
                ${activeTab === tab.id
                  ? 'bg-white/20 border-l-4 border-white'
                  : 'hover:bg-white/10 border-l-4 border-transparent'
                }
                ${isLeftSidebarCollapsed ? 'justify-center px-0' : ''}
              `}
              title={isLeftSidebarCollapsed ? tab.label : undefined}
            >
              <span className="material-symbols-outlined text-xl">{tab.icon}</span>
              {!isLeftSidebarCollapsed && (
                <span className="text-sm font-medium whitespace-nowrap">{tab.label}</span>
              )}
            </button>
          ))}
        </nav>

        {/* フッター */}
        <div className="px-4 py-4 border-t border-white/20">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 text-xs text-teal-100 hover:text-white transition-colors ${
              isLeftSidebarCollapsed ? 'justify-center w-full' : ''
            }`}
            title={isLeftSidebarCollapsed ? 'スプレッドシート連携' : undefined}
          >
            <span className="material-symbols-outlined text-sm">link</span>
            {!isLeftSidebarCollapsed && (
              <span className="whitespace-nowrap">スプレッドシート連携</span>
            )}
          </button>
        </div>
      </aside>

      {/* メインコンテンツ（スクロール可能） */}
      <main className="flex-1 overflow-y-auto h-screen">
        <div className="max-w-6xl mx-auto py-6 px-6 pb-12">
          {activeTab === 'premise' && <Tab1Premise />}
          {activeTab === 'report' && <Tab2Report />}
          {activeTab === 'settings' && <TabSettings />}
        </div>
      </main>

      {/* 右サイドバー（クリエイティブ詳細） - ダッシュボードレポートタブのみ表示 */}
      {sidebar && activeTab === 'report' && (
        <aside className="w-[420px] shrink-0 border-l border-[#cfe7e7] bg-white h-screen overflow-hidden">
          <CreativeSidebar
            isOpen={true}
            onClose={closeSidebar}
            creativeName={sidebar.creativeName}
            creativeLink={sidebar.creativeLink}
            allData={sidebarData}
          />
        </aside>
      )}
    </div>
  );
}

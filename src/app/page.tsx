'use client';

import { useState } from 'react';
import Tab1Premise from '@/components/Tab1Premise';
import Tab2Report from '@/components/Tab2Report';
import TabSettings from '@/components/TabSettings';

const TABS = [
  { id: 'premise', label: '前提整理', icon: 'assignment' },
  { id: 'report', label: '今週の結果報告', icon: 'bar_chart' },
  { id: 'settings', label: 'スプレッドシート連携', icon: 'settings' },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState('report');

  return (
    <div className="h-screen bg-[#f6f8f8] flex overflow-hidden">
      {/* 左サイドバー（固定） */}
      <aside className="w-64 bg-[#0b7f7b] text-white flex flex-col h-screen shrink-0">
        {/* ロゴ・タイトル */}
        <div className="px-5 py-6 border-b border-white/20">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl">monitoring</span>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                広告運用DB
              </h1>
              <p className="text-xs text-teal-100 mt-0.5">
                週次報告・分析ツール
              </p>
            </div>
          </div>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 py-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                w-full flex items-center gap-3 px-5 py-3.5 text-left transition-all
                ${activeTab === tab.id
                  ? 'bg-white/20 border-l-4 border-white'
                  : 'hover:bg-white/10 border-l-4 border-transparent'
                }
              `}
            >
              <span className="material-symbols-outlined text-xl">{tab.icon}</span>
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* フッター */}
        <div className="px-5 py-4 border-t border-white/20">
          <div className="flex items-center gap-2 text-xs text-teal-100">
            <span className="material-symbols-outlined text-sm">storage</span>
            <span>ローカル保存</span>
          </div>
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
    </div>
  );
}

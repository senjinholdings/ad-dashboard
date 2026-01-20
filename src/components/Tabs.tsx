'use client';

interface Tab {
  id: string;
  label: string;
  icon: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <nav className="flex px-4" aria-label="Tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all
            ${
              activeTab === tab.id
                ? 'border-[#0b7f7b] text-[#0b7f7b] bg-[#f0fafa]'
                : 'border-transparent text-gray-500 hover:text-[#0b7f7b] hover:bg-gray-50'
            }
          `}
        >
          <span className="material-symbols-outlined text-xl">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

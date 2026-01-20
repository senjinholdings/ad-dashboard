'use client';

import { SummaryData } from '@/types';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/csvParser';

interface SummaryCardsProps {
  data: SummaryData;
}

export default function SummaryCards({ data }: SummaryCardsProps) {
  const cards = [
    {
      label: '広告セット数',
      value: formatNumber(data.adSetCount),
      unit: '件',
      icon: 'folder_open',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      label: '広告数',
      value: formatNumber(data.adCount),
      unit: '件',
      icon: 'campaign',
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
    },
    {
      label: 'CR本数',
      value: formatNumber(data.creativeCount),
      unit: '件',
      icon: 'brush',
      iconBg: 'bg-pink-100',
      iconColor: 'text-pink-600',
    },
    {
      label: '総CV',
      value: formatNumber(data.totalCV),
      unit: '件',
      icon: 'conversion_path',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
    {
      label: '総売上',
      value: formatCurrency(data.totalRevenue),
      unit: '',
      icon: 'payments',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      label: '総利益',
      value: formatCurrency(data.totalProfit),
      unit: '',
      icon: 'trending_up',
      iconBg: data.totalProfit >= 0 ? 'bg-green-100' : 'bg-red-100',
      iconColor: data.totalProfit >= 0 ? 'text-green-600' : 'text-red-600',
      valueColor: data.totalProfit >= 0 ? 'text-green-600' : 'text-red-600',
    },
    {
      label: '平均ROAS',
      value: formatPercent(data.averageROAS),
      unit: '',
      icon: 'analytics',
      iconBg: data.averageROAS >= 100 ? 'bg-teal-100' : 'bg-orange-100',
      iconColor: data.averageROAS >= 100 ? 'text-teal-600' : 'text-orange-600',
      valueColor: data.averageROAS >= 100 ? 'text-teal-600' : 'text-orange-600',
    },
  ];

  return (
    <div className="grid grid-cols-7 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-xl border border-[#cfe7e7] p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-3">
            <div className={`${card.iconBg} p-2 rounded-lg`}>
              <span className={`material-symbols-outlined ${card.iconColor}`}>
                {card.icon}
              </span>
            </div>
          </div>
          <div className="text-xs text-gray-500 mb-1">{card.label}</div>
          <div className={`text-2xl font-bold ${card.valueColor || 'text-gray-800'}`}>
            {card.value}
            {card.unit && <span className="text-base font-medium ml-0.5">{card.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

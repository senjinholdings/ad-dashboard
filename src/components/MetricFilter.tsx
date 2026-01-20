'use client';

import { useState, useRef, useEffect } from 'react';

// フィルター対象の種類
export type MetricFilterType = 'number' | 'percentage' | 'currency' | 'text';

// フィルター条件
export type FilterCondition = '>' | '>=' | '<' | '<=' | '=' | 'contains' | 'not_contains';

// フィルター設定
export interface MetricFilterConfig {
  condition: FilterCondition;
  value: number | string;
}

interface MetricFilterProps {
  isActive: boolean;
  onFilterChange: (filter: MetricFilterConfig | null) => void;
  metricType: MetricFilterType;
}

// 条件オプション
const NUMBER_CONDITIONS: { value: FilterCondition; label: string }[] = [
  { value: '>', label: 'より大きい' },
  { value: '>=', label: '以上' },
  { value: '<', label: 'より小さい' },
  { value: '<=', label: '以下' },
  { value: '=', label: '等しい' },
];

const TEXT_CONDITIONS: { value: FilterCondition; label: string }[] = [
  { value: 'contains', label: '含む' },
  { value: 'not_contains', label: '含まない' },
  { value: '=', label: '一致' },
];

export default function MetricFilter({ isActive, onFilterChange, metricType }: MetricFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [condition, setCondition] = useState<FilterCondition>(
    metricType === 'text' ? 'contains' : '>='
  );
  const [value, setValue] = useState<string>('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const conditions = metricType === 'text' ? TEXT_CONDITIONS : NUMBER_CONDITIONS;

  // 外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleApply = () => {
    if (value === '') {
      onFilterChange(null);
    } else {
      const filterValue = metricType === 'text' ? value : Number(value);
      if (metricType !== 'text' && isNaN(filterValue as number)) {
        return;
      }
      onFilterChange({ condition, value: filterValue });
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    setValue('');
    setCondition(metricType === 'text' ? 'contains' : '>=');
    onFilterChange(null);
    setIsOpen(false);
  };

  const getPlaceholder = () => {
    switch (metricType) {
      case 'percentage':
        return '例: 100 (100%の場合)';
      case 'currency':
        return '例: 10000';
      case 'text':
        return 'テキストを入力';
      default:
        return '値を入力';
    }
  };

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1 rounded hover:bg-gray-200 transition-colors ${
          isActive ? 'text-blue-600' : 'text-gray-400'
        }`}
        title="フィルター"
      >
        <span className="material-symbols-outlined text-sm">filter_alt</span>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 min-w-[220px]"
        >
          <p className="text-xs font-medium text-gray-600 mb-2">フィルター条件</p>

          <div className="space-y-2">
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as FilterCondition)}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {conditions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <input
              type={metricType === 'text' ? 'text' : 'number'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={getPlaceholder()}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApply();
              }}
            />

            {metricType === 'percentage' && (
              <p className="text-xs text-gray-400">※ パーセントは数値で入力</p>
            )}
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={handleClear}
              className="flex-1 text-xs px-2 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              クリア
            </button>
            <button
              onClick={handleApply}
              className="flex-1 text-xs px-2 py-1.5 bg-[#0b7f7b] text-white rounded hover:bg-[#096b68] transition-colors"
            >
              適用
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// フィルター適用関数
export function applyFilter(
  value: number | string,
  filter: MetricFilterConfig | null,
  metricType: MetricFilterType
): boolean {
  if (!filter) return true;

  if (metricType === 'text') {
    const strValue = String(value).toLowerCase();
    const filterValue = String(filter.value).toLowerCase();

    switch (filter.condition) {
      case 'contains':
        return strValue.includes(filterValue);
      case 'not_contains':
        return !strValue.includes(filterValue);
      case '=':
        return strValue === filterValue;
      default:
        return true;
    }
  }

  // 数値フィルター
  const numValue = typeof value === 'number' ? value : Number(value);
  const filterValue = typeof filter.value === 'number' ? filter.value : Number(filter.value);

  if (!Number.isFinite(filterValue)) return true;

  switch (filter.condition) {
    case '>':
      return numValue > filterValue;
    case '>=':
      return numValue >= filterValue;
    case '<':
      return numValue < filterValue;
    case '<=':
      return numValue <= filterValue;
    case '=':
      return numValue === filterValue;
    default:
      return true;
  }
}

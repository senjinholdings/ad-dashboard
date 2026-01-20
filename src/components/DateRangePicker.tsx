'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker, DateRange } from 'react-day-picker';
import { format, isSameDay, isBefore, startOfDay, subMonths, addMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  DateRangePreset,
  SelectedDateRange,
  PRESET_LABELS,
  calculateDateRange,
} from '@/contexts/ReportDateRangeContext';

import 'react-day-picker/style.css';

interface DateRangePickerProps {
  value: DateRangePreset;
  customRange?: SelectedDateRange;
  onChange: (preset: DateRangePreset, customRange?: SelectedDateRange) => void;
}

const PRESET_OPTIONS: DateRangePreset[] = [
  'today',
  'yesterday',
  'last7days',
  'last14days',
  'last30days',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
  'allTime',
  'custom',
];

export default function DateRangePicker({ value, customRange, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempPreset, setTempPreset] = useState<DateRangePreset>(value);
  const [tempRange, setTempRange] = useState<DateRange | undefined>(
    customRange ? { from: customRange.from, to: customRange.to } : undefined
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [modalPosition, setModalPosition] = useState({ top: 0, left: 0 });
  const [displayMonth, setDisplayMonth] = useState(new Date());

  // 現在の日付範囲を計算
  const currentRange = calculateDateRange(value, customRange);

  // 表示フォーマット
  const formatDateRange = (range: SelectedDateRange) => {
    if (isSameDay(range.from, range.to)) {
      return format(range.from, 'M/d', { locale: ja });
    }
    return `${format(range.from, 'M/d', { locale: ja })}〜${format(range.to, 'M/d', { locale: ja })}`;
  };

  // モーダル位置を計算
  const updateModalPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const modalHeight = 380;
    const modalWidth = 400;

    let top = rect.bottom + 8;
    let left = rect.left;

    // 下にはみ出る場合は上に表示
    if (top + modalHeight > window.innerHeight) {
      top = rect.top - modalHeight - 8;
    }

    // 右にはみ出る場合は調整
    if (left + modalWidth > window.innerWidth) {
      left = window.innerWidth - modalWidth - 16;
    }

    setModalPosition({ top, left });
  }, []);

  const openModal = useCallback(() => {
    updateModalPosition();
    setTempPreset(value);
    setTempRange(customRange ? { from: customRange.from, to: customRange.to } : undefined);
    // 開いた時は今月を表示
    setDisplayMonth(new Date());
    setIsOpen(true);
  }, [updateModalPosition, value, customRange]);

  // ESCキーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // プリセット選択
  const handlePresetClick = (preset: DateRangePreset) => {
    setTempPreset(preset);
    if (preset !== 'custom') {
      const range = calculateDateRange(preset);
      setTempRange({ from: range.from, to: range.to });
    }
  };

  // 日付選択
  const handleDayClick = (day: Date) => {
    setTempPreset('custom');

    if (!tempRange?.from || (tempRange.from && tempRange.to)) {
      // 新しい選択開始
      setTempRange({ from: startOfDay(day), to: undefined });
    } else {
      // 終了日を設定
      if (isBefore(day, tempRange.from)) {
        // 開始日より前をクリックした場合は開始日を再設定
        setTempRange({ from: startOfDay(day), to: undefined });
      } else {
        setTempRange({ from: tempRange.from, to: startOfDay(day) });
      }
    }
  };

  // 適用
  const handleApply = () => {
    if (tempPreset === 'custom' && tempRange?.from && tempRange?.to) {
      onChange(tempPreset, { from: tempRange.from, to: tempRange.to });
    } else if (tempPreset !== 'custom') {
      onChange(tempPreset);
    }
    setIsOpen(false);
  };

  // キャンセル
  const handleCancel = () => {
    setIsOpen(false);
  };

  const today = new Date();

  // 月の切り替え
  const handlePrevMonth = () => {
    setDisplayMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    const nextMonth = addMonths(displayMonth, 1);
    // 今月より先には進めない
    if (nextMonth <= today) {
      setDisplayMonth(nextMonth);
    }
  };

  // 次月ボタンを無効にするかどうか
  const isNextDisabled = addMonths(displayMonth, 1) > today;

  return (
    <>
      {/* トリガーボタン（コンパクト版） */}
      <button
        ref={buttonRef}
        onClick={openModal}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-300 rounded-md hover:border-[#0b7f7b] transition-all text-xs"
      >
        <Calendar className="w-3.5 h-3.5 text-gray-400" />
        <span className="font-medium text-gray-600">
          {formatDateRange(currentRange)}
        </span>
        <ChevronDown className="w-3 h-3 text-gray-400" />
      </button>

      {/* モーダル */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <>
          {/* オーバーレイ */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={handleCancel}
          />

          {/* モーダル本体（コンパクト版） */}
          <div
            ref={modalRef}
            className="fixed z-[9999] bg-white rounded-xl border border-gray-200 shadow-lg flex overflow-hidden"
            style={{
              top: modalPosition.top,
              left: modalPosition.left,
              maxWidth: '90vw',
            }}
          >
            {/* サイドバー（プリセット） */}
            <div className="w-[100px] py-2 border-r border-gray-200 bg-gray-50">
              <div className="space-y-0.5">
                {PRESET_OPTIONS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handlePresetClick(preset)}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      tempPreset === preset
                        ? 'bg-[#0b7f7b] text-white'
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {PRESET_LABELS[preset]}
                  </button>
                ))}
              </div>
            </div>

            {/* カレンダー領域 */}
            <div className="flex flex-col">
              {/* 入力フィールド */}
              <div className="px-3 py-2 border-b border-gray-200">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500 mb-0.5 block">開始日</label>
                    <div className="px-2 py-1 text-xs border border-gray-200 rounded bg-gray-50 text-center">
                      {tempRange?.from ? format(tempRange.from, 'M/d') : '選択'}
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500 mb-0.5 block">終了日</label>
                    <div className="px-2 py-1 text-xs border border-gray-200 rounded bg-gray-50 text-center">
                      {tempRange?.to ? format(tempRange.to, 'M/d') : '選択'}
                    </div>
                  </div>
                </div>
              </div>

              {/* カレンダーヘッダー（月切り替え） */}
              <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100">
                <button
                  onClick={handlePrevMonth}
                  className="p-1 rounded hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <span className="text-sm font-medium text-gray-700">
                  {format(displayMonth, 'yyyy年 M月', { locale: ja })}
                </span>
                <button
                  onClick={handleNextMonth}
                  disabled={isNextDisabled}
                  className="p-1 rounded hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {/* カレンダー */}
              <div className="px-3 py-2">
                <DayPicker
                  mode="range"
                  locale={ja}
                  selected={tempRange}
                  onDayClick={handleDayClick}
                  month={displayMonth}
                  onMonthChange={setDisplayMonth}
                  disabled={{ after: today }}
                  showOutsideDays={false}
                  hideNavigation
                  classNames={{
                    months: '',
                    month: '',
                    month_caption: 'hidden',
                    weekdays: 'grid grid-cols-7 text-[10px] text-gray-500 mb-0.5',
                    weekday: 'text-center py-0.5',
                    month_grid: 'w-full',
                    week: 'grid grid-cols-7',
                    day: 'p-0',
                    day_button: 'w-7 h-7 text-xs rounded-full hover:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-transparent',
                    selected: 'bg-[#0b7f7b] text-white hover:bg-[#0a6966]',
                    range_start: 'bg-[#0b7f7b] text-white rounded-l-full',
                    range_end: 'bg-[#0b7f7b] text-white rounded-r-full',
                    range_middle: 'bg-[#e6f4f4] text-gray-800',
                    today: 'font-bold text-[#0b7f7b]',
                    outside: 'text-gray-300',
                    disabled: 'text-gray-300',
                  }}
                />
              </div>

              {/* フッター */}
              <div className="px-3 py-2 border-t border-gray-200 flex justify-end gap-2">
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleApply}
                  disabled={!tempRange?.from || !tempRange?.to}
                  className="px-3 py-1.5 text-xs bg-[#0b7f7b] text-white rounded hover:bg-[#0a6966] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  適用
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

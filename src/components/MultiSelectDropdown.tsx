'use client';

import { useState, useRef, useEffect } from 'react';

interface MultiSelectDropdownProps {
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  allLabel?: string;
  width?: string;
}

export default function MultiSelectDropdown({
  options,
  selectedValues,
  onChange,
  placeholder = '選択してください',
  searchPlaceholder = '検索...',
  allLabel = 'すべて',
  width = 'w-[180px]',
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingValues, setPendingValues] = useState<string[]>(selectedValues);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 外部からの値変更を反映
  useEffect(() => {
    if (!isOpen) {
      setPendingValues(selectedValues);
    }
  }, [selectedValues, isOpen]);

  // ドロップダウンを開いたときに内部状態を初期化
  useEffect(() => {
    if (isOpen) {
      setPendingValues(selectedValues);
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  }, [isOpen, selectedValues]);

  // フィルタリングされたオプション
  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 表示用テキスト
  const displayText = selectedValues.length === 0
    ? allLabel
    : selectedValues.length === 1
      ? selectedValues[0]
      : `${selectedValues.length}件選択`;

  // 全選択/全解除（内部状態のみ更新）
  const handleSelectAll = () => {
    setPendingValues([...options]);
  };

  const handleClearAll = () => {
    setPendingValues([]);
  };

  // 個別トグル（内部状態のみ更新）
  const handleToggle = (option: string) => {
    if (pendingValues.includes(option)) {
      setPendingValues(pendingValues.filter(v => v !== option));
    } else {
      setPendingValues([...pendingValues, option]);
    }
  };

  // OK押下で確定
  const handleConfirm = () => {
    onChange(pendingValues);
    setIsOpen(false);
    setSearchQuery('');
  };

  // キャンセル押下で元に戻す
  const handleCancel = () => {
    setPendingValues(selectedValues);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={`relative ${width}`} ref={dropdownRef}>
      {/* トリガーボタン */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={selectedValues.length === 0 ? allLabel : selectedValues.join(', ')}
        className="w-full appearance-none bg-white border border-[#cfe7e7] rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 hover:border-[#0b7f7b] focus:outline-none focus:ring-2 focus:ring-[#0b7f7b]/20 focus:border-[#0b7f7b] transition-colors cursor-pointer truncate text-left"
      >
        {displayText}
      </button>
      <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-lg">
        expand_more
      </span>

      {/* ドロップダウンメニュー */}
      {isOpen && (
        <div className="absolute z-50 mt-1 min-w-full w-max max-w-[320px] bg-white border border-[#cfe7e7] rounded-lg shadow-lg overflow-hidden">
          {/* 検索欄 */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                search
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0b7f7b]/30 focus:border-[#0b7f7b]"
              />
            </div>
          </div>

          {/* 全選択/全解除ボタン */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 text-xs">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-[#0b7f7b] hover:text-[#0a6966] font-medium"
            >
              全選択
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-gray-500 hover:text-gray-700 font-medium"
            >
              全解除
            </button>
          </div>

          {/* オプションリスト */}
          <div className="max-h-[200px] overflow-y-auto overscroll-contain">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                該当なし
              </div>
            ) : (
              filteredOptions.map(option => (
                <label
                  key={option}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={pendingValues.includes(option)}
                    onChange={() => handleToggle(option)}
                    className="w-4 h-4 rounded border-gray-300 text-[#0b7f7b] focus:ring-[#0b7f7b]/30"
                  />
                  <span className="text-sm text-gray-700">
                    {option}
                  </span>
                </label>
              ))
            )}
          </div>

          {/* キャンセル / OK ボタン */}
          <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-gray-100 bg-gray-50">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-1.5 text-sm font-medium text-white bg-[#0b7f7b] rounded-md hover:bg-[#0a6966] transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

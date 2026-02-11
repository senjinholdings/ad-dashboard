'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ColumnDef {
  key: string;
  label: string;
}

interface ColumnPickerModalProps {
  allColumns: ColumnDef[];
  visibleColumns: string[];
  fixedColumns: string[];
  onApply: (columns: string[]) => void;
  onClose: () => void;
}

export default function ColumnPickerModal({
  allColumns,
  visibleColumns,
  fixedColumns,
  onApply,
  onClose,
}: ColumnPickerModalProps) {
  const [selected, setSelected] = useState<string[]>(visibleColumns);
  const [searchQuery, setSearchQuery] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const dropTargetRef = useRef<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // dropTargetをrefでも同期（イベントハンドラ内で最新値を参照するため）
  useEffect(() => {
    dropTargetRef.current = dropTarget;
  }, [dropTarget]);

  const selectableColumns = allColumns.filter(c => !fixedColumns.includes(c.key));
  const defaultColumns = allColumns.map(c => c.key);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const filteredColumns = selectableColumns.filter(col => {
    if (searchQuery && !col.label.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const toggleColumn = useCallback((key: string) => {
    setSelected(prev => {
      if (prev.includes(key)) {
        const remaining = prev.filter(k => k !== key);
        const nonFixed = remaining.filter(k => !fixedColumns.includes(k));
        if (nonFixed.length === 0) return prev;
        return remaining;
      }
      return [...prev, key];
    });
  }, [fixedColumns]);

  const orderedSelected = selected.filter(k => !fixedColumns.includes(k));

  // ドラッグ開始時に各アイテムの中心Y座標を記録（ギャップ挿入前の位置）
  const itemRectsRef = useRef<{ midY: number }[]>([]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    setDropTarget(null);
    e.dataTransfer.effectAllowed = 'move';

    // 全アイテムの中心座標を記録
    const container = (e.currentTarget as HTMLElement).parentElement?.parentElement;
    if (container) {
      const items = container.querySelectorAll<HTMLElement>('[data-drag-item]');
      itemRectsRef.current = Array.from(items).map(el => {
        const rect = el.getBoundingClientRect();
        return { midY: rect.top + rect.height / 2 };
      });
    }
  }, []);

  // ドラッグ中の位置判定（コンテナレベルで処理、アイテム個別では処理しない）
  const handleContainerDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex === null) return;

    const mouseY = e.clientY;
    const rects = itemRectsRef.current;

    if (rects.length === 0) return;

    // マウス位置から挿入位置を決定（記録済みの初期位置を基準に判定）
    let insertAt = rects.length; // デフォルト: 末尾
    for (let i = 0; i < rects.length; i++) {
      if (mouseY < rects[i].midY) {
        insertAt = i;
        break;
      }
    }

    // 自分自身の位置なら無効
    if (insertAt === dragIndex || insertAt === dragIndex + 1) {
      if (dropTargetRef.current !== null) setDropTarget(null);
    } else {
      if (dropTargetRef.current !== insertAt) setDropTarget(insertAt);
    }
  }, [dragIndex]);

  const handleDrop = useCallback(() => {
    if (dragIndex === null || dropTarget === null) {
      setDragIndex(null);
      setDropTarget(null);
      return;
    }

    setSelected(prev => {
      const fixed = prev.filter(k => fixedColumns.includes(k));
      const movable = prev.filter(k => !fixedColumns.includes(k));

      const item = movable[dragIndex];
      const newMovable = [...movable];
      newMovable.splice(dragIndex, 1);
      const adjustedTarget = dropTarget > dragIndex ? dropTarget - 1 : dropTarget;
      newMovable.splice(adjustedTarget, 0, item);

      return [...fixed, ...newMovable];
    });

    setDragIndex(null);
    setDropTarget(null);
  }, [dragIndex, dropTarget, fixedColumns]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropTarget(null);
    itemRectsRef.current = [];
  }, []);

  const removeColumn = useCallback((key: string) => {
    setSelected(prev => {
      const remaining = prev.filter(k => k !== key);
      const nonFixed = remaining.filter(k => !fixedColumns.includes(k));
      if (nonFixed.length === 0) return prev;
      return remaining;
    });
  }, [fixedColumns]);

  const handleReset = useCallback(() => {
    setSelected(defaultColumns);
  }, [defaultColumns]);

  const handleApply = useCallback(() => {
    onApply(selected);
    onClose();
  }, [selected, onApply, onClose]);

  const getLabel = useCallback((key: string) => {
    return allColumns.find(c => c.key === key)?.label ?? key;
  }, [allColumns]);

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/40" />

      <div
        ref={modalRef}
        className="relative bg-white rounded-2xl shadow-2xl w-[720px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#0b7f7b]">view_column</span>
            <h2 className="text-base font-semibold text-gray-800">表示項目の変更</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-gray-400 text-xl">close</span>
          </button>
        </div>

        {/* コンテンツ: 2パネル */}
        <div className="flex flex-1 min-h-0">
          {/* 左パネル */}
          <div className="w-[360px] border-r border-gray-200 flex flex-col">
            <div className="px-4 pt-4 pb-2">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="項目名で検索..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b7f7b]/30 focus:border-[#0b7f7b]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {filteredColumns.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">該当する項目がありません</p>
              ) : (
                <div className="space-y-0.5">
                  {filteredColumns.map(col => {
                    const isChecked = selected.includes(col.key);
                    return (
                      <label
                        key={col.key}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleColumn(col.key)}
                          className="w-4 h-4 rounded border-gray-300 text-[#0b7f7b] focus:ring-[#0b7f7b] accent-[#0b7f7b]"
                        />
                        <span className="text-sm text-gray-700">{col.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 右パネル */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-4 pt-4 pb-2">
              <p className="text-xs font-semibold text-gray-500">
                選択した表示項目
                <span className="text-gray-400 font-normal ml-2">ドラッグで並べ替え</span>
              </p>
            </div>

            <div
              className="flex-1 overflow-y-auto px-4 pb-4"
              onDragOver={handleContainerDragOver}
              onDrop={handleDrop}
            >
              {/* 固定カラム */}
              {fixedColumns.filter(k => selected.includes(k)).map(key => (
                <div
                  key={key}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 mb-1 opacity-60"
                >
                  <span className="text-gray-300 text-sm select-none">⠿</span>
                  <span className="text-sm text-gray-500 flex-1">{getLabel(key)}</span>
                  <span className="text-[10px] text-gray-400">固定</span>
                </div>
              ))}

              {/* 並び替え可能な項目 */}
              {orderedSelected.map((key, index) => (
                <div key={key}>
                  {/* 挿入ギャップ（この要素の前） */}
                  <div
                    className="overflow-hidden transition-all duration-200 ease-out"
                    style={{ height: dropTarget === index ? 36 : 0, pointerEvents: 'none' }}
                  >
                    <div className="h-[36px] mx-1 rounded-lg border-2 border-dashed border-[#0b7f7b]/40 bg-[#0b7f7b]/5" />
                  </div>
                  <div
                    data-drag-item
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-1 transition-all duration-150 cursor-grab active:cursor-grabbing ${
                      dragIndex === index
                        ? 'bg-[#0b7f7b]/10 opacity-40 scale-[0.97]'
                        : 'bg-white hover:bg-gray-50 border border-gray-100'
                    }`}
                    style={dragIndex !== null && dragIndex !== index ? { pointerEvents: 'none' } : undefined}
                  >
                    <span className="text-gray-400 text-sm select-none cursor-grab">⠿</span>
                    <span className="text-sm text-gray-700 flex-1">{getLabel(key)}</span>
                    <button
                      onClick={() => removeColumn(key)}
                      className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                    >
                      <span className="material-symbols-outlined text-gray-400 text-base">close</span>
                    </button>
                  </div>
                  {/* 挿入ギャップ（最後の要素の後） */}
                  {index === orderedSelected.length - 1 && (
                    <div
                      className="overflow-hidden transition-all duration-200 ease-out"
                      style={{ height: dropTarget === orderedSelected.length ? 36 : 0, pointerEvents: 'none' }}
                    >
                      <div className="h-[36px] mx-1 rounded-lg border-2 border-dashed border-[#0b7f7b]/40 bg-[#0b7f7b]/5" />
                    </div>
                  )}
                </div>
              ))}

              {orderedSelected.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  左のパネルから項目を選択してください
                </p>
              )}
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
          <button
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            リセット
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 text-sm font-medium text-white bg-[#0b7f7b] hover:bg-[#0a6966] rounded-lg transition-colors"
            >
              適用
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

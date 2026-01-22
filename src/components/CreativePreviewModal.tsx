'use client';

import { useEffect, useCallback } from 'react';

interface CreativePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title?: string;
}

// GoogleドライブのURLをプレビュー用に変換
function convertToPreviewUrl(url: string): string {
  if (!url) return '';

  // Google Drive file URL
  // https://drive.google.com/file/d/{FILE_ID}/view?usp=sharing
  // → https://drive.google.com/file/d/{FILE_ID}/preview
  const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFileMatch) {
    return `https://drive.google.com/file/d/${driveFileMatch[1]}/preview`;
  }

  // Google Drive open URL
  // https://drive.google.com/open?id={FILE_ID}
  // → https://drive.google.com/file/d/{FILE_ID}/preview
  const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (driveOpenMatch) {
    return `https://drive.google.com/file/d/${driveOpenMatch[1]}/preview`;
  }

  // Google Drive uc URL (direct download link)
  // https://drive.google.com/uc?id={FILE_ID}
  // → https://drive.google.com/file/d/{FILE_ID}/preview
  const driveUcMatch = url.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
  if (driveUcMatch) {
    return `https://drive.google.com/file/d/${driveUcMatch[1]}/preview`;
  }

  // 画像URLの場合はそのまま返す（imgタグで表示）
  if (/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url)) {
    return url;
  }

  // その他のURLはそのまま返す（iframe埋め込み試行）
  return url;
}

// URLが画像かどうかを判定
function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);
}

// GoogleドライブURLかどうかを判定
function isGoogleDriveUrl(url: string): boolean {
  return url.includes('drive.google.com');
}

export default function CreativePreviewModal({ isOpen, onClose, url, title }: CreativePreviewModalProps) {
  const previewUrl = convertToPreviewUrl(url);
  const isImage = isImageUrl(url);

  // ESCキーで閉じる
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl w-[90vw] h-[85vh] max-w-5xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[#0b7f7b]">image</span>
            <span className="font-medium text-gray-800 truncate">{title || 'プレビュー'}</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-lg">open_in_new</span>
              新しいタブで開く
            </a>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-gray-600">close</span>
            </button>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-hidden bg-gray-100">
          {isImage ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img
                src={previewUrl}
                alt={title || 'Preview'}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              />
            </div>
          ) : (
            <iframe
              src={previewUrl}
              className="w-full h-full border-0"
              allow="autoplay"
              title={title || 'Preview'}
            />
          )}
        </div>

        {/* フッター（Googleドライブの場合は注意書き） */}
        {isGoogleDriveUrl(url) && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">info</span>
            表示されない場合は、Googleドライブの共有設定を「リンクを知っている全員」に変更してください
          </div>
        )}
      </div>
    </div>
  );
}

// エクスポート用のヘルパー関数
export { convertToPreviewUrl, isImageUrl, isGoogleDriveUrl };

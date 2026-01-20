'use client';

import { useState, useEffect } from 'react';
import { StrategyData, defaultStrategyData } from '@/types';
import { loadStrategy, saveStrategy } from '@/utils/storage';

const MEDIA_OPTIONS = ['Meta', 'TikTok', 'YouTube', 'Google', 'X (Twitter)', 'LINE'];

export default function Tab3Strategy() {
  const [data, setData] = useState<StrategyData>(defaultStrategyData);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setData(loadStrategy());
  }, []);

  const handleChange = (field: keyof StrategyData, value: unknown) => {
    setData(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleMediaToggle = (media: string) => {
    const current = data.focusMedia || [];
    const updated = current.includes(media)
      ? current.filter(m => m !== media)
      : [...current, media];

    // 新しく追加された場合はデフォルト配分を設定
    const newAllocation = { ...data.mediaAllocation };
    if (!current.includes(media)) {
      newAllocation[media] = 0;
    } else {
      delete newAllocation[media];
    }

    setData(prev => ({
      ...prev,
      focusMedia: updated,
      mediaAllocation: newAllocation,
    }));
    setSaved(false);
  };

  const handleAllocationChange = (media: string, value: number) => {
    setData(prev => ({
      ...prev,
      mediaAllocation: {
        ...prev.mediaAllocation,
        [media]: value,
      },
    }));
    setSaved(false);
  };

  const handleSave = () => {
    saveStrategy(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const totalAllocation = Object.values(data.mediaAllocation || {}).reduce((sum, v) => sum + v, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span>🎯</span>
          今週の方針
        </h2>
        <button
          onClick={handleSave}
          className={`px-6 py-2 rounded-md transition-colors ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {saved ? '✓ 保存しました' : '保存'}
        </button>
      </div>

      <div className="space-y-6">
        {/* 媒体戦略 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>📺</span>
            媒体戦略
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                注力媒体
              </label>
              <div className="flex flex-wrap gap-2">
                {MEDIA_OPTIONS.map(media => (
                  <button
                    key={media}
                    type="button"
                    onClick={() => handleMediaToggle(media)}
                    className={`px-4 py-2 rounded-full text-sm transition-colors ${
                      data.focusMedia?.includes(media)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {media}
                  </button>
                ))}
              </div>
            </div>

            {data.focusMedia && data.focusMedia.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  媒体別配分
                  <span className={`ml-2 ${totalAllocation === 100 ? 'text-green-600' : 'text-orange-600'}`}>
                    （合計: {totalAllocation}%）
                  </span>
                </label>
                <div className="space-y-2">
                  {data.focusMedia.map(media => (
                    <div key={media} className="flex items-center gap-4">
                      <span className="w-24 text-sm">{media}</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={data.mediaAllocation?.[media] || 0}
                        onChange={(e) => handleAllocationChange(media, parseInt(e.target.value))}
                        className="flex-1"
                      />
                      <div className="w-20 flex items-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={data.mediaAllocation?.[media] || 0}
                          onChange={(e) => handleAllocationChange(media, parseInt(e.target.value) || 0)}
                          className="w-14 px-2 py-1 text-sm border border-gray-300 rounded text-right"
                        />
                        <span className="ml-1 text-sm text-gray-600">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                理由・背景
              </label>
              <textarea
                value={data.strategyReason || ''}
                onChange={(e) => handleChange('strategyReason', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="なぜこの媒体に注力するのか、背景を記入"
              />
            </div>
          </div>
        </div>

        {/* クリエイティブ方針 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>🎨</span>
            クリエイティブ方針
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                方向性
              </label>
              <textarea
                value={data.creativeDirection || ''}
                onChange={(e) => handleChange('creativeDirection', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="どんなクリエイティブの方向性で勝負するか記入"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                作成予定本数
              </label>
              <div className="flex items-center">
                <input
                  type="number"
                  value={data.plannedCreatives || ''}
                  onChange={(e) => handleChange('plannedCreatives', parseInt(e.target.value) || 0)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
                <span className="ml-2 text-gray-600">本</span>
              </div>
            </div>
          </div>
        </div>

        {/* アイディア・仮説 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>💡</span>
            アイディア・仮説
          </h3>

          <textarea
            value={data.ideas || ''}
            onChange={(e) => handleChange('ideas', e.target.value)}
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="今週試したいアイディアや仮説を記入"
          />
        </div>
      </div>
    </div>
  );
}

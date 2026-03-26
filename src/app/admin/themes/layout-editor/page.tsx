/**
 * 레이아웃 에디터 페이지
 * 헤더, 푸터, 상품카드 등 레이아웃 컴포넌트를 선택합니다.
 */

'use client';

import { useState, Suspense, lazy } from 'react';
import { Check, Eye, Save, RotateCcw } from 'lucide-react';
import {
  COMPONENT_META,
  DEFAULT_THEME_CONFIG,
  type ThemeLayoutConfig,
  type HeaderStyle,
  type FooterStyle,
  type ProductCardStyle,
  type ProductGridStyle,
} from '@/lib/theme';

// 미리보기 컴포넌트 lazy load
const PreviewPanel = lazy(() => import('./preview-panel'));

type ComponentCategory = 'headers' | 'footers' | 'productCards' | 'productGrids';

interface LayoutOption {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
}

export default function LayoutEditorPage() {
  const [config, setConfig] = useState<ThemeLayoutConfig>(DEFAULT_THEME_CONFIG);
  const [activeCategory, setActiveCategory] = useState<ComponentCategory>('headers');
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const categories: { id: ComponentCategory; label: string }[] = [
    { id: 'headers', label: '헤더' },
    { id: 'footers', label: '푸터' },
    { id: 'productCards', label: '상품 카드' },
    { id: 'productGrids', label: '상품 그리드' },
  ];

  const getOptions = (category: ComponentCategory): LayoutOption[] => {
    return COMPONENT_META[category] as LayoutOption[];
  };

  const getSelectedValue = (category: ComponentCategory): string => {
    const mapping: Record<ComponentCategory, keyof ThemeLayoutConfig> = {
      headers: 'header',
      footers: 'footer',
      productCards: 'productCard',
      productGrids: 'productGrid',
    };
    return config[mapping[category]] as string;
  };

  const handleSelect = (category: ComponentCategory, value: string) => {
    const mapping: Record<ComponentCategory, keyof ThemeLayoutConfig> = {
      headers: 'header',
      footers: 'footer',
      productCards: 'productCard',
      productGrids: 'productGrid',
    };
    setConfig({
      ...config,
      [mapping[category]]: value,
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // localStorage에 저장 (추후 Supabase 연동)
      localStorage.setItem('freecart_theme_config', JSON.stringify(config));
      alert('레이아웃 설정이 저장되었습니다.');
    } catch (error) {
      console.error('Failed to save:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('기본 설정으로 초기화하시겠습니까?')) {
      setConfig(DEFAULT_THEME_CONFIG);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">레이아웃 에디터</h1>
            <p className="text-sm text-gray-500">헤더, 푸터, 상품 카드 스타일을 선택하세요</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                showPreview
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Eye className="h-4 w-4" />
              미리보기
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              초기화
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* 사이드바 - 카테고리 */}
          <aside className="w-48 flex-shrink-0">
            <nav className="sticky top-24 space-y-1">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`w-full px-4 py-3 text-left rounded-lg font-medium transition-colors ${
                    activeCategory === category.id
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* 메인 - 옵션 선택 */}
          <main className="flex-1">
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6">
                {categories.find((c) => c.id === activeCategory)?.label} 스타일
              </h2>

              <div className="grid grid-cols-2 gap-4">
                {getOptions(activeCategory).map((option) => {
                  const isSelected = getSelectedValue(activeCategory) === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleSelect(activeCategory, option.id)}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* 썸네일 placeholder */}
                      <div className="aspect-[16/9] bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                        <span className="text-gray-400 text-sm">{option.name}</span>
                      </div>

                      <h3 className="font-medium text-gray-900">{option.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{option.description}</p>

                      {/* 선택 표시 */}
                      {isSelected && (
                        <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 추가 설정 */}
            <div className="bg-white rounded-xl border p-6 mt-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6">추가 설정</h2>

              <div className="space-y-4">
                {/* 헤더 고정 */}
                <label className="flex items-center justify-between">
                  <span className="text-gray-700">헤더 상단 고정</span>
                  <input
                    type="checkbox"
                    checked={config.settings.headerFixed}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        settings: { ...config.settings, headerFixed: e.target.checked },
                      })
                    }
                    className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                  />
                </label>

                {/* 브레드크럼 */}
                <label className="flex items-center justify-between">
                  <span className="text-gray-700">경로 표시 (Breadcrumb)</span>
                  <input
                    type="checkbox"
                    checked={config.settings.showBreadcrumb}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        settings: { ...config.settings, showBreadcrumb: e.target.checked },
                      })
                    }
                    className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                  />
                </label>

                {/* 이미지 비율 */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">상품 이미지 비율</span>
                  <select
                    value={config.settings.productImageRatio}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        settings: {
                          ...config.settings,
                          productImageRatio: e.target.value as '1:1' | '4:3' | '3:4',
                        },
                      })
                    }
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1:1">1:1 (정사각형)</option>
                    <option value="4:3">4:3 (가로형)</option>
                    <option value="3:4">3:4 (세로형)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 현재 설정 JSON */}
            <div className="bg-gray-800 rounded-xl p-6 mt-6">
              <h3 className="text-sm font-medium text-gray-400 mb-3">현재 설정 (JSON)</h3>
              <pre className="text-sm text-green-400 overflow-x-auto">
                {JSON.stringify(config, null, 2)}
              </pre>
            </div>
          </main>

          {/* 미리보기 패널 */}
          {showPreview && (
            <aside className="w-96 flex-shrink-0">
              <div className="sticky top-24 bg-white rounded-xl border overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b">
                  <h3 className="font-medium text-gray-900">미리보기</h3>
                </div>
                <div className="h-[600px] overflow-y-auto">
                  <Suspense fallback={<div className="p-4 text-center text-gray-500">로딩 중...</div>}>
                    <PreviewPanel config={config} />
                  </Suspense>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

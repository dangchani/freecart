import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

interface ContentPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  type: string;
  excerpt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export default function ContentPageView() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<ContentPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchPage(slug);
    }
  }, [slug]);

  async function fetchPage(pageSlug: string) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('content_pages')
        .select('*')
        .eq('slug', pageSlug)
        .eq('is_visible', true)
        .single();

      if (error || !data) {
        setNotFound(true);
        return;
      }

      setPage(data);

      // SEO 메타 태그 설정
      if (data.seo_title || data.title) {
        document.title = data.seo_title || data.title;
      }
      if (data.seo_description) {
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
          metaDesc = document.createElement('meta');
          metaDesc.setAttribute('name', 'description');
          document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', data.seo_description);
      }
      if (data.seo_keywords) {
        let metaKeywords = document.querySelector('meta[name="keywords"]');
        if (!metaKeywords) {
          metaKeywords = document.createElement('meta');
          metaKeywords.setAttribute('name', 'keywords');
          document.head.appendChild(metaKeywords);
        }
        metaKeywords.setAttribute('content', data.seo_keywords);
      }

      // 조회수 증가
      await supabase
        .from('content_pages')
        .update({ view_count: (data.view_count || 0) + 1 })
        .eq('id', data.id);
    } catch (err) {
      console.error('페이지 로딩 실패:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="container py-8 text-center text-gray-500">로딩 중...</div>;
  }

  if (notFound || !page) {
    return (
      <div className="container py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold text-gray-800">페이지를 찾을 수 없습니다</h1>
        <p className="mb-6 text-gray-500">요청하신 페이지가 존재하지 않거나 비공개 상태입니다.</p>
        <Link to="/" className="text-blue-600 hover:underline">
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* 브레드크럼 */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link to="/" className="hover:text-gray-700">
          홈
        </Link>
        <span>/</span>
        <span className="text-gray-800">{page.title}</span>
      </nav>

      <Card className="p-6 sm:p-8">
        <h1 className="mb-6 text-3xl font-bold">{page.title}</h1>

        {page.excerpt && (
          <p className="mb-6 text-gray-600 border-l-4 border-gray-200 pl-4 italic">
            {page.excerpt}
          </p>
        )}

        <div
          className="prose prose-gray max-w-none"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />

        <div className="mt-8 border-t pt-4 text-xs text-gray-400">
          최종 수정일: {new Date(page.updated_at || page.created_at).toLocaleDateString('ko-KR')}
        </div>
      </Card>
    </div>
  );
}

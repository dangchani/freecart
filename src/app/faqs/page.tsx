import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export default function FAQsPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetchFAQs();
  }, []);

  async function fetchFAQs() {
    try {
      const res = await fetch('/api/faqs');
      const json = await res.json();
      if (json.success) {
        const data: FAQ[] = json.data || [];
        setFaqs(data);
        const cats = Array.from(new Set(data.map((f) => f.category)));
        setCategories(cats);
      }
    } catch (err) {
      console.error('FAQ 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredFaqs = activeCategory === 'all' ? faqs : faqs.filter((f) => f.category === activeCategory);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const categoryLabels: Record<string, string> = {
    order: '주문',
    shipping: '배송',
    payment: '결제',
    refund: '환불/교환',
    account: '계정',
    product: '상품',
    other: '기타',
  };

  function getCategoryLabel(cat: string) {
    return categoryLabels[cat] || cat;
  }

  if (loading) {
    return (
      <div className="container py-8">
        <div className="p-8 text-center text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">자주 묻는 질문</h1>
        <p className="mt-2 text-gray-500">궁금하신 점을 빠르게 확인해보세요.</p>
      </div>

      {/* 카테고리 탭 */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          variant={activeCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveCategory('all')}
        >
          전체
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={activeCategory === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory(cat)}
          >
            {getCategoryLabel(cat)}
          </Button>
        ))}
      </div>

      {filteredFaqs.length === 0 ? (
        <Card className="p-12 text-center">
          <HelpCircle className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <p className="text-gray-500">해당 카테고리의 FAQ가 없습니다.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredFaqs.map((faq) => (
            <Card key={faq.id} className="overflow-hidden">
              <button
                className="flex w-full items-start justify-between p-5 text-left hover:bg-gray-50"
                onClick={() => toggleExpand(faq.id)}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                    Q
                  </span>
                  <span className="font-medium">{faq.question}</span>
                </div>
                {expandedId === faq.id ? (
                  <ChevronUp className="ml-3 h-5 w-5 shrink-0 text-gray-400" />
                ) : (
                  <ChevronDown className="ml-3 h-5 w-5 shrink-0 text-gray-400" />
                )}
              </button>
              {expandedId === faq.id && (
                <div className="border-t bg-gray-50 p-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-600">
                      A
                    </span>
                    <p className="whitespace-pre-wrap text-gray-700 leading-relaxed">{faq.answer}</p>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

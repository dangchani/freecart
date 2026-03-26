import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getRecentlyViewedIds } from '@/services/recentlyViewed';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { X } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  slug: string;
  salePrice: number;
  regularPrice: number;
  imageUrl: string | null;
}

interface RecentlyViewedProps {
  currentProductId?: string;
  maxItems?: number;
  layout?: 'horizontal' | 'vertical';
}

export function RecentlyViewed({
  currentProductId,
  maxItems = 5,
  layout = 'horizontal',
}: RecentlyViewedProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProducts() {
      const ids = getRecentlyViewedIds()
        .filter((id) => id !== currentProductId)
        .slice(0, maxItems);

      if (ids.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { data } = await supabase
        .from('products')
        .select('id, name, slug, sale_price, regular_price, product_images(url, is_primary)')
        .in('id', ids)
        .eq('status', 'active');

      if (data) {
        // 원래 순서 유지
        const productMap = new Map(
          data.map((p: any) => {
            const primaryImage = p.product_images?.find((img: any) => img.is_primary) || p.product_images?.[0];
            return [
              p.id,
              {
                id: p.id,
                name: p.name,
                slug: p.slug,
                salePrice: p.sale_price,
                regularPrice: p.regular_price,
                imageUrl: primaryImage?.url || null,
              },
            ];
          })
        );

        setProducts(ids.map((id) => productMap.get(id)).filter(Boolean) as Product[]);
      }

      setLoading(false);
    }

    loadProducts();
  }, [currentProductId, maxItems]);

  if (loading) {
    return (
      <div className="flex gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-24 animate-pulse">
            <div className="aspect-square rounded-lg bg-gray-200" />
            <div className="mt-2 h-3 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  if (layout === 'vertical') {
    return (
      <div className="space-y-3">
        {products.map((product) => (
          <Link
            key={product.id}
            to={`/products/${product.slug}`}
            className="flex items-center gap-3 rounded-lg border p-2 transition-colors hover:bg-gray-50"
          >
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-gray-100">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-gray-400">No Image</div>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
              <p className="mt-1 text-sm font-bold">{formatCurrency(product.salePrice)}</p>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {products.map((product) => (
        <Link
          key={product.id}
          to={`/products/${product.slug}`}
          className="w-24 shrink-0 group"
        >
          <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-gray-400">No Image</div>
            )}
          </div>
          <p className="mt-2 line-clamp-2 text-xs font-medium group-hover:text-blue-600">
            {product.name}
          </p>
          <p className="text-xs font-bold">{formatCurrency(product.salePrice)}</p>
        </Link>
      ))}
    </div>
  );
}

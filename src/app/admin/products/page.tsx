import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Copy,
  Download,
  Upload,
  Check,
  X,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// =============================================================================
// Detail Types
// =============================================================================

interface ProductDetailOption {
  name: string;
  isRequired: boolean;
  values: string[];
}

interface ProductDetailVariant {
  label: string;
  sku: string | null;
  stock: number;
  isActive: boolean;
  minPurchaseQuantity: number | null;
  maxPurchaseQuantity: number | null;
}

interface ProductDetailQtyDiscount {
  minQuantity: number;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  isActive: boolean;
}

interface ProductDetailGiftSet {
  name: string;
  giftType: string;
  isActive: boolean;
  tiers: { minQuantity: number; freeCount: number }[];
}

interface ProductDetailBundleItem {
  productName: string;
  imageUrl: string | null;
  quantity: number;
}

interface ProductDetailTimeSale {
  name: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  endsAt: string;
}

interface ProductDetail {
  images: { url: string; isPrimary: boolean }[];
  summary: string | null;
  description: string | null;
  categoryName: string | null;
  brandName: string | null;
  regularPrice: number;
  salePrice: number;
  costPrice: number | null;
  pointRate: number | null;
  manufacturer: string | null;
  origin: string | null;
  weight: number | null;
  shippingType: string;
  shippingFee: number | null;
  minPurchaseQuantity: number | null;
  maxPurchaseQuantity: number | null;
  dailyPurchaseLimit: number | null;
  tags: string[];
  hasOptions: boolean;
  productType: 'single' | 'bundle';
  options: ProductDetailOption[];
  variants: ProductDetailVariant[];
  quantityDiscounts: ProductDetailQtyDiscount[];
  giftSets: ProductDetailGiftSet[];
  bundleItems: ProductDetailBundleItem[];
  activeTimeSale: ProductDetailTimeSale | null;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  regularPrice: number;
  stock: number;
  thumbnail: string;
  isActive: boolean;
  categoryId: string | null;
  sku: string | null;
  productType: 'single' | 'bundle';
}

interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

/** 플랫 카테고리 배열 → DFS 순서로 정렬된 {id, name, level} 배열 */
function flattenCategoryTree(cats: Category[]): { id: string; name: string; level: number }[] {
  const childrenMap: Record<string, Category[]> = {};
  const roots: Category[] = [];
  cats.forEach((c) => {
    if (c.parentId) {
      if (!childrenMap[c.parentId]) childrenMap[c.parentId] = [];
      childrenMap[c.parentId].push(c);
    } else {
      roots.push(c);
    }
  });
  const result: { id: string; name: string; level: number }[] = [];
  function walk(list: Category[], level: number) {
    list.forEach((c) => {
      result.push({ id: c.id, name: c.name, level });
      if (childrenMap[c.id]) walk(childrenMap[c.id], level + 1);
    });
  }
  walk(roots, 0);
  return result;
}

export default function AdminProductsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // 선택 관련
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);

  // 일괄 편집 폼
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');
  const [bulkPriceAction, setBulkPriceAction] = useState<string>('');
  const [bulkPriceValue, setBulkPriceValue] = useState<string>('');

  // 엑셀 처리
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // 아코디언 상세 보기
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [productDetails, setProductDetails] = useState<Record<string, ProductDetail>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadProducts();
      loadCategories();
    }
  }, [user, authLoading, navigate]);

  async function loadProducts() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('products')
        .select('id, name, slug, sale_price, regular_price, stock_quantity, stock_alert_quantity, has_options, product_type, status, category_id, sku, product_images(url), product_variants(stock_quantity, is_active)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProducts(
        (data || []).map((p: any) => {
          const hasOptions = p.has_options;
          const isBundle = p.product_type === 'bundle';
          const variantStock = hasOptions
            ? ((p.product_variants || []) as any[])
                .filter((v: any) => v.is_active)
                .reduce((sum: number, v: any) => sum + (v.stock_quantity || 0), 0)
            : p.stock_quantity;
          return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: p.sale_price,
            regularPrice: p.regular_price,
            stock: variantStock,
            stockAlertQuantity: p.stock_alert_quantity ?? 10,
            hasOptions,
            thumbnail: p.product_images?.[0]?.url || '',
            isActive: p.status === 'active',
            categoryId: p.category_id,
            sku: p.sku,
            productType: (isBundle ? 'bundle' : 'single') as 'single' | 'bundle',
          };
        })
      );
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('product_categories')
        .select('id, name, parent_id')
        .order('sort_order', { ascending: true });
      setCategories(
        (data || []).map((c: any) => ({ id: c.id, name: c.name, parentId: c.parent_id ?? null }))
      );
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }

  async function toggleProductDetail(productId: string) {
    // 같은 행 다시 클릭 → 닫기
    if (expandedProductId === productId) {
      setExpandedProductId(null);
      return;
    }

    setExpandedProductId(productId);

    // 이미 캐시된 경우 재조회 생략
    if (productDetails[productId]) return;

    setLoadingDetailId(productId);
    try {
      const supabase = createClient();

      // 1. 메인 상품 상세 조회
      const { data: p } = await supabase
        .from('products')
        .select(`
          summary, description, sku,
          regular_price, sale_price, cost_price, point_rate,
          has_options, product_type, tags,
          manufacturer, origin, weight,
          shipping_type, shipping_fee,
          min_purchase_quantity, max_purchase_quantity, daily_purchase_limit,
          category:product_categories!products_category_id_fkey(name),
          brand:product_brands!products_brand_id_fkey(name),
          product_images(url, is_primary, sort_order),
          product_options(name, is_required, sort_order, product_option_values(value, sort_order)),
          product_variants(sku, option_values, stock_quantity, is_active, min_purchase_quantity, max_purchase_quantity),
          product_quantity_discounts(min_quantity, discount_type, discount_value, is_active),
          product_gift_sets(name, gift_type, is_active, product_gift_tiers(min_quantity, free_count))
        `)
        .eq('id', productId)
        .single();

      if (!p) return;

      // 2. 세트상품이면 구성상품 조회
      let bundleItems: ProductDetailBundleItem[] = [];
      if ((p as any).product_type === 'bundle') {
        const { data: items } = await supabase
          .from('bundle_items')
          .select(`
            quantity,
            product:products!bundle_items_product_id_fkey(
              name,
              product_images(url, is_primary)
            )
          `)
          .eq('bundle_product_id', productId)
          .order('sort_order', { ascending: true });

        bundleItems = (items || []).map((item: any) => {
          const prod = item.product;
          const img = (prod?.product_images || []).find((i: any) => i.is_primary) || prod?.product_images?.[0];
          return { productName: prod?.name ?? '', imageUrl: img?.url ?? null, quantity: item.quantity };
        });
      }

      // 3. 진행 중인 타임세일 조회
      const now = new Date().toISOString();
      const { data: timeSaleData } = await supabase
        .from('product_time_sales')
        .select('name, discount_type, discount_value, ends_at')
        .eq('product_id', productId)
        .eq('is_active', true)
        .lte('starts_at', now)
        .gte('ends_at', now)
        .limit(1)
        .maybeSingle();

      // 옵션 정리
      const options: ProductDetailOption[] = ((p as any).product_options || [])
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((opt: any) => ({
          name: opt.name,
          isRequired: opt.is_required ?? true,
          values: (opt.product_option_values || [])
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((v: any) => v.value),
        }));

      // variant 정리 (valueIdToText 없이 option_values 배열의 텍스트만 join)
      const variants: ProductDetailVariant[] = ((p as any).product_variants || []).map((v: any) => ({
        label: ((v.option_values as any[]) || []).map((o: any) => o.valueId || '').join(' / '),
        sku: v.sku || null,
        stock: v.stock_quantity,
        isActive: v.is_active,
        minPurchaseQuantity: v.min_purchase_quantity ?? null,
        maxPurchaseQuantity: v.max_purchase_quantity ?? null,
      }));

      setProductDetails((prev) => ({
        ...prev,
        [productId]: {
          images: ((p as any).product_images || [])
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((img: any) => ({ url: img.url, isPrimary: img.is_primary })),
          summary: (p as any).summary || null,
          description: (p as any).description || null,
          categoryName: (p as any).category?.name ?? null,
          brandName: (p as any).brand?.name ?? null,
          regularPrice: (p as any).regular_price,
          salePrice: (p as any).sale_price,
          costPrice: (p as any).cost_price ?? null,
          pointRate: (p as any).point_rate ?? null,
          manufacturer: (p as any).manufacturer ?? null,
          origin: (p as any).origin ?? null,
          weight: (p as any).weight ?? null,
          shippingType: (p as any).shipping_type || 'default',
          shippingFee: (p as any).shipping_fee ?? null,
          minPurchaseQuantity: (p as any).min_purchase_quantity ?? null,
          maxPurchaseQuantity: (p as any).max_purchase_quantity ?? null,
          dailyPurchaseLimit: (p as any).daily_purchase_limit ?? null,
          tags: (p as any).tags || [],
          hasOptions: (p as any).has_options,
          productType: (p as any).product_type || 'single',
          options,
          variants,
          quantityDiscounts: ((p as any).product_quantity_discounts || []).map((d: any) => ({
            minQuantity: d.min_quantity,
            discountType: d.discount_type,
            discountValue: d.discount_value,
            isActive: d.is_active,
          })),
          giftSets: ((p as any).product_gift_sets || []).map((s: any) => ({
            name: s.name,
            giftType: s.gift_type,
            isActive: s.is_active,
            tiers: (s.product_gift_tiers || []).map((t: any) => ({
              minQuantity: t.min_quantity,
              freeCount: t.free_count,
            })),
          })),
          bundleItems,
          activeTimeSale: timeSaleData
            ? { name: timeSaleData.name, discountType: timeSaleData.discount_type, discountValue: timeSaleData.discount_value, endsAt: timeSaleData.ends_at }
            : null,
        },
      }));
    } catch (error) {
      console.error('Failed to load product detail:', error);
    } finally {
      setLoadingDetailId(null);
    }
  }

  async function handleDelete(productId: string) {
    if (!confirm('상품을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      alert('상품이 삭제되었습니다.');
      await loadProducts();
    } catch (error) {
      console.error('Failed to delete product:', error);
      alert(error instanceof Error ? error.message : '상품 삭제 중 오류가 발생했습니다.');
    }
  }

  // 상품 복사
  async function handleDuplicate(product: Product) {
    if (!confirm(`"${product.name}" 상품을 복사하시겠습니까?`)) {
      return;
    }

    try {
      const supabase = createClient();

      // 원본 상품 데이터 가져오기
      const { data: original, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', product.id)
        .single();

      if (fetchError) throw fetchError;

      // 새 슬러그 생성
      const newSlug = `${original.slug}-copy-${Date.now()}`;

      // 복사본 생성
      const { id, created_at, updated_at, ...productData } = original;
      const { data: newProduct, error: insertError } = await supabase
        .from('products')
        .insert({
          ...productData,
          name: `${original.name} (복사본)`,
          slug: newSlug,
          status: 'draft',
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // 이미지 복사
      const { data: images } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', product.id);

      if (images && images.length > 0) {
        const imageInserts = images.map(({ id, product_id, created_at, ...img }) => ({
          ...img,
          product_id: newProduct.id,
        }));
        await supabase.from('product_images').insert(imageInserts);
      }

      // 옵션 복사
      const { data: options } = await supabase
        .from('product_options')
        .select('*, product_option_values(*)')
        .eq('product_id', product.id);

      if (options && options.length > 0) {
        for (const option of options) {
          const { data: newOption } = await supabase
            .from('product_options')
            .insert({
              product_id: newProduct.id,
              name: option.name,
              sort_order: option.sort_order,
            })
            .select('id')
            .single();

          if (newOption && option.product_option_values) {
            const valueInserts = option.product_option_values.map((v: any) => ({
              option_id: newOption.id,
              value: v.value,
              additional_price: v.additional_price,
              sort_order: v.sort_order,
            }));
            await supabase.from('product_option_values').insert(valueInserts);
          }
        }
      }

      alert('상품이 복사되었습니다.');
      await loadProducts();
    } catch (error) {
      console.error('Failed to duplicate product:', error);
      alert('상품 복사 중 오류가 발생했습니다.');
    }
  }

  // 전체 선택/해제
  function toggleSelectAll() {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  }

  // 개별 선택
  function toggleSelect(id: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  }

  // 일괄 편집 적용
  async function handleBulkEdit() {
    if (selectedIds.size === 0) return;

    try {
      const supabase = createClient();
      const updates: any = {};

      if (bulkStatus) {
        updates.status = bulkStatus;
      }
      if (bulkCategoryId) {
        updates.category_id = bulkCategoryId;
      }

      // 가격 조정
      if (bulkPriceAction && bulkPriceValue) {
        const value = parseFloat(bulkPriceValue);
        if (!isNaN(value)) {
          const selectedProducts = products.filter((p) => selectedIds.has(p.id));

          for (const product of selectedProducts) {
            let newPrice = product.price;

            if (bulkPriceAction === 'increase_percent') {
              newPrice = Math.round(product.price * (1 + value / 100));
            } else if (bulkPriceAction === 'decrease_percent') {
              newPrice = Math.round(product.price * (1 - value / 100));
            } else if (bulkPriceAction === 'increase_fixed') {
              newPrice = product.price + value;
            } else if (bulkPriceAction === 'decrease_fixed') {
              newPrice = Math.max(0, product.price - value);
            } else if (bulkPriceAction === 'set') {
              newPrice = value;
            }

            await supabase
              .from('products')
              .update({ ...updates, sale_price: newPrice })
              .eq('id', product.id);
          }
        }
      } else if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('products')
          .update(updates)
          .in('id', Array.from(selectedIds));

        if (error) throw error;
      }

      alert('선택한 상품이 수정되었습니다.');
      setShowBulkEditModal(false);
      setSelectedIds(new Set());
      setBulkStatus('');
      setBulkCategoryId('');
      setBulkPriceAction('');
      setBulkPriceValue('');
      await loadProducts();
    } catch (error) {
      console.error('Failed to bulk edit:', error);
      alert('일괄 수정 중 오류가 발생했습니다.');
    }
  }

  // 일괄 삭제
  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}개 상품을 삭제하시겠습니까?`)) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      alert('선택한 상품이 삭제되었습니다.');
      setSelectedIds(new Set());
      await loadProducts();
    } catch (error) {
      console.error('Failed to bulk delete:', error);
      alert('일괄 삭제 중 오류가 발생했습니다.');
    }
  }

  // 엑셀 내보내기
  async function handleExport() {
    try {
      setExporting(true);
      const supabase = createClient();

      const { data, error } = await supabase
        .from('products')
        .select(`
          id, name, slug, sku, summary, description,
          regular_price, sale_price, cost_price,
          stock_quantity, status,
          category:product_categories(name),
          brand:product_brands(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // CSV 생성
      const headers = ['ID', '상품명', 'SKU', '슬러그', '카테고리', '브랜드', '정가', '판매가', '원가', '재고', '상태'];
      const rows = (data || []).map((p: any) => [
        p.id,
        p.name,
        p.sku || '',
        p.slug,
        p.category?.name || '',
        p.brand?.name || '',
        p.regular_price,
        p.sale_price,
        p.cost_price || '',
        p.stock_quantity,
        p.status,
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');

      // BOM 추가 (한글 깨짐 방지)
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `products_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      alert('상품 목록이 다운로드되었습니다.');
    } catch (error) {
      console.error('Failed to export:', error);
      alert('내보내기 중 오류가 발생했습니다.');
    } finally {
      setExporting(false);
    }
  }

  // 엑셀 가져오기
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기가 5MB를 초과합니다.');
      return;
    }

    try {
      setImporting(true);
      const text = await file.text();
      const lines = text.split('\n').filter((line) => line.trim());

      if (lines.length < 2) {
        alert('유효한 데이터가 없습니다.');
        return;
      }

      // 최대 행 수 제한 (1000행)
      if (lines.length > 1001) {
        alert('한 번에 최대 1,000개 상품만 가져올 수 있습니다.');
        return;
      }

      // 헤더 파싱
      const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim());

      // 필수 컬럼 확인
      const nameIdx = headers.findIndex((h) => h === '상품명');
      const slugIdx = headers.findIndex((h) => h === '슬러그');
      const priceIdx = headers.findIndex((h) => h === '판매가');
      const stockIdx = headers.findIndex((h) => h === '재고');

      if (nameIdx === -1 || slugIdx === -1 || priceIdx === -1) {
        alert('필수 컬럼이 없습니다. (상품명, 슬러그, 판매가)');
        return;
      }

      const supabase = createClient();
      let created = 0;
      let updated = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < headers.length) continue;

        const id = headers.includes('ID') ? values[headers.indexOf('ID')] : null;
        const name = values[nameIdx];
        const slug = values[slugIdx];
        const salePrice = parseFloat(values[priceIdx]) || 0;
        const regularPrice = headers.includes('정가') ? parseFloat(values[headers.indexOf('정가')]) || salePrice : salePrice;
        const stock = stockIdx !== -1 ? parseInt(values[stockIdx]) || 0 : 0;
        const sku = headers.includes('SKU') ? values[headers.indexOf('SKU')] : null;
        const status = headers.includes('상태') ? values[headers.indexOf('상태')] : 'draft';

        if (!name || !slug) continue;

        if (id) {
          // 업데이트
          const { error } = await supabase
            .from('products')
            .update({
              name,
              slug,
              sale_price: salePrice,
              regular_price: regularPrice,
              stock_quantity: stock,
              sku: sku || null,
              status: ['draft', 'active', 'inactive'].includes(status) ? status : 'draft',
            })
            .eq('id', id);

          if (!error) updated++;
        } else {
          // 새로 생성 (카테고리 필요)
          const { data: defaultCategory } = await supabase
            .from('product_categories')
            .select('id')
            .limit(1)
            .single();

          if (defaultCategory) {
            const { error } = await supabase.from('products').insert({
              name,
              slug: `${slug}-${Date.now()}`,
              sale_price: salePrice,
              regular_price: regularPrice,
              stock_quantity: stock,
              sku: sku || null,
              status: 'draft',
              category_id: defaultCategory.id,
            });

            if (!error) created++;
          }
        }
      }

      alert(`가져오기 완료: ${created}개 생성, ${updated}개 업데이트`);
      await loadProducts();
    } catch (error) {
      console.error('Failed to import:', error);
      alert('가져오기 중 오류가 발생했습니다.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  // CSV 라인 파싱 (따옴표 처리)
  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  // 필터링된 상품 목록
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      !searchQuery ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.sku && product.sku.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && product.isActive) ||
      (statusFilter === 'inactive' && !product.isActive);

    const matchesCategory = (() => {
      if (categoryFilter === 'all') return true;
      if (product.categoryId === categoryFilter) return true;
      // 선택한 카테고리의 하위 카테고리 상품도 포함
      const childIds = categories
        .filter((c) => c.parentId === categoryFilter)
        .map((c) => c.id);
      return childIds.includes(product.categoryId ?? '');
    })();

    return matchesSearch && matchesStatus && matchesCategory;
  });

  if (authLoading || loading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  return (
    <div className="container py-8">
      <Link to="/admin" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        대시보드로 돌아가기
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">상품 관리</h1>
        <div className="flex gap-2">
          {/* 엑셀 가져오기/내보내기 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleImport}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <Upload className="mr-2 h-4 w-4" />
            {importing ? '처리중...' : '가져오기'}
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? '처리중...' : '내보내기'}
          </Button>
          <Link to="/admin/bundles/new">
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              세트상품 등록
            </Button>
          </Link>
          <Link to="/admin/products/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              상품 등록
            </Button>
          </Link>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="상품명 또는 SKU로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="전체 카테고리" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 카테고리</SelectItem>
              {flattenCategoryTree(categories).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.level > 0 ? `${'　'.repeat(c.level)}↳ ${c.name}` : c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="active">판매중</SelectItem>
              <SelectItem value="inactive">판매중지</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* 선택된 항목 액션바 */}
      {selectedIds.size > 0 && (
        <Card className="mb-4 p-3 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-700">
              {selectedIds.size}개 상품 선택됨
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowBulkEditModal(true)}>
                <Edit className="mr-1 h-4 w-4" />
                일괄 편집
              </Button>
              <Button size="sm" variant="outline" className="text-red-600" onClick={handleBulkDelete}>
                <Trash2 className="mr-1 h-4 w-4" />
                일괄 삭제
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {filteredProducts.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="mb-4 text-gray-500">
            {products.length === 0 ? '등록된 상품이 없습니다.' : '검색 결과가 없습니다.'}
          </p>
          {products.length === 0 && (
            <Link to="/admin/products/new">
              <Button>첫 상품 등록하기</Button>
            </Link>
          )}
        </Card>
      ) : (
        <Card>
          {/* 테이블 헤더 */}
          <div className="flex items-center gap-4 p-4 border-b bg-gray-50">
            <input
              type="checkbox"
              checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded"
            />
            <div className="w-16"></div>
            <div className="flex-1 font-medium text-sm text-gray-600">상품명</div>
            <div className="w-24 text-center font-medium text-sm text-gray-600">가격</div>
            <div className="w-20 text-center font-medium text-sm text-gray-600">재고</div>
            <div className="w-20 text-center font-medium text-sm text-gray-600">상태</div>
            <div className="w-36"></div>
          </div>

          <div className="divide-y">
            {filteredProducts.map((product) => {
              const isExpanded = expandedProductId === product.id;
              const detail = productDetails[product.id];
              const isLoadingDetail = loadingDetailId === product.id;

              return (
              <div key={product.id}>
                {/* ── 목록 행 ── */}
                <div className={`flex items-center gap-4 p-4 hover:bg-gray-50 ${isExpanded ? 'bg-blue-50 border-b border-blue-100' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(product.id)}
                    onChange={() => toggleSelect(product.id)}
                    className="h-4 w-4 rounded"
                  />
                  <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-gray-100 shrink-0">
                    <img
                      src={product.thumbnail || '/placeholder.png'}
                      alt={product.name}
                      className="object-cover w-full h-full"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold truncate">{product.name}</h3>
                      {product.productType === 'bundle' && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-semibold">세트</span>
                      )}
                    </div>
                    {product.sku && (
                      <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                    )}
                  </div>

                  <div className="w-24 text-center">
                    <p className="font-medium">{formatCurrency(product.price)}</p>
                    {product.regularPrice > product.price && (
                      <p className="text-xs text-gray-400 line-through">
                        {formatCurrency(product.regularPrice)}
                      </p>
                    )}
                  </div>

                  <div className="w-20 text-center">
                    <span className={product.stock <= (product as any).stockAlertQuantity ? 'text-red-500 font-medium' : ''}>
                      {product.productType === 'bundle' ? '자동계산' : `${product.stock}개`}
                    </span>
                    {product.productType === 'bundle' ? (
                      <p className="text-xs text-gray-400">구성재고</p>
                    ) : (product as any).hasOptions ? (
                      <p className="text-xs text-gray-400">옵션합산</p>
                    ) : null}
                  </div>

                  <div className="w-20 text-center">
                    <Badge variant={product.isActive ? 'default' : 'secondary'}>
                      {product.isActive ? '판매중' : '판매중지'}
                    </Badge>
                  </div>

                  <div className="flex gap-1 w-36 justify-end">
                    <Button
                      size="sm"
                      variant={isExpanded ? 'secondary' : 'ghost'}
                      onClick={() => toggleProductDetail(product.id)}
                      title={isExpanded ? '접기' : '상세 보기'}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    {product.productType !== 'bundle' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDuplicate(product)}
                        title="복사"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    <Link to={product.productType === 'bundle' ? `/admin/bundles/${product.id}/edit` : `/admin/products/${product.slug}/edit`}>
                      <Button size="sm" variant="ghost" title="편집">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(product.id)}
                      title="삭제"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>

                {/* ── 아코디언 상세 영역 ── */}
                {isExpanded && (
                  <div className="border-b bg-gray-50">
                    {isLoadingDetail ? (
                      <div className="flex items-center justify-center py-10 text-sm text-gray-400">
                        <svg className="animate-spin h-5 w-5 mr-2 text-gray-400" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        불러오는 중...
                      </div>
                    ) : detail ? (
                      <div className="p-5 space-y-5">

                        {/* 이미지 */}
                        {detail.images.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {detail.images.map((img, idx) => (
                              <div key={idx} className={`relative h-20 w-20 rounded-lg overflow-hidden border-2 shrink-0 ${img.isPrimary ? 'border-blue-400' : 'border-gray-200'}`}>
                                <img src={img.url} alt="" className="w-full h-full object-cover" />
                                {img.isPrimary && (
                                  <span className="absolute bottom-0 left-0 right-0 text-center bg-blue-500 text-white text-[9px] font-bold py-0.5">대표</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 기본정보 + 가격정보 2단 */}
                        <div className="grid grid-cols-2 gap-5">
                          {/* 기본 정보 */}
                          <div className="space-y-1.5 text-sm">
                            <p className="font-semibold text-gray-700 mb-2">기본 정보</p>
                            {detail.categoryName && <p className="text-gray-600"><span className="text-gray-400 w-20 inline-block">카테고리</span>{detail.categoryName}</p>}
                            {detail.brandName && <p className="text-gray-600"><span className="text-gray-400 w-20 inline-block">브랜드</span>{detail.brandName}</p>}
                            {detail.manufacturer && <p className="text-gray-600"><span className="text-gray-400 w-20 inline-block">제조사</span>{detail.manufacturer}</p>}
                            {detail.origin && <p className="text-gray-600"><span className="text-gray-400 w-20 inline-block">원산지</span>{detail.origin}</p>}
                            {detail.weight != null && <p className="text-gray-600"><span className="text-gray-400 w-20 inline-block">무게</span>{detail.weight}kg</p>}
                            {detail.summary && <p className="text-gray-600"><span className="text-gray-400 w-20 inline-block">요약</span><span className="text-gray-600">{detail.summary}</span></p>}
                            {detail.tags.length > 0 && (
                              <div className="flex items-start gap-1 flex-wrap">
                                <span className="text-gray-400 w-20 inline-block shrink-0">태그</span>
                                {detail.tags.map((tag) => (
                                  <span key={tag} className="px-1.5 py-0.5 bg-gray-200 rounded text-xs text-gray-600">#{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 가격 정보 */}
                          <div className="space-y-1.5 text-sm">
                            <p className="font-semibold text-gray-700 mb-2">가격 정보</p>
                            <p className="text-gray-600"><span className="text-gray-400 w-20 inline-block">정가</span>{formatCurrency(detail.regularPrice)}</p>
                            <p className="text-gray-600"><span className="text-gray-400 w-20 inline-block">판매가</span><span className="font-semibold text-blue-600">{formatCurrency(detail.salePrice)}</span></p>
                            {detail.costPrice != null && <p className="text-gray-600"><span className="text-gray-400 w-20 inline-block">원가</span>{formatCurrency(detail.costPrice)}</p>}
                            {detail.pointRate != null && <p className="text-gray-600"><span className="text-gray-400 w-20 inline-block">적립률</span>{detail.pointRate}%</p>}
                            {detail.activeTimeSale && (
                              <div className="mt-2 rounded-md bg-orange-50 border border-orange-200 px-3 py-2">
                                <p className="text-xs font-semibold text-orange-600">🔥 타임세일 진행 중</p>
                                <p className="text-xs text-orange-500 mt-0.5">
                                  {detail.activeTimeSale.name} —&nbsp;
                                  {detail.activeTimeSale.discountType === 'percent'
                                    ? `${detail.activeTimeSale.discountValue}% 할인`
                                    : `${formatCurrency(detail.activeTimeSale.discountValue)} 할인`}
                                </p>
                                <p className="text-xs text-orange-400 mt-0.5">
                                  종료: {new Date(detail.activeTimeSale.endsAt).toLocaleString('ko-KR')}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 재고 / 옵션 / 구성상품 */}
                        <div className="space-y-3">
                          {detail.productType === 'bundle' ? (
                            /* 세트상품: 구성상품 목록 */
                            detail.bundleItems.length > 0 && (
                              <div>
                                <p className="text-sm font-semibold text-gray-700 mb-2">구성 상품</p>
                                <div className="rounded-lg border divide-y bg-white">
                                  {detail.bundleItems.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-3 px-3 py-2 text-sm">
                                      {item.imageUrl && <img src={item.imageUrl} className="h-8 w-8 rounded object-cover flex-shrink-0" alt="" />}
                                      <span className="flex-1 truncate">{item.productName}</span>
                                      <span className="text-gray-400 text-xs shrink-0">×{item.quantity}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          ) : detail.hasOptions && detail.variants.length > 0 ? (
                            /* 옵션상품: variant 테이블 */
                            <div>
                              <p className="text-sm font-semibold text-gray-700 mb-2">옵션 조합 재고</p>
                              <div className="rounded-lg border overflow-hidden bg-white">
                                <table className="w-full text-xs">
                                  <thead className="bg-gray-50 border-b">
                                    <tr>
                                      <th className="text-left px-3 py-1.5 text-gray-500 font-medium">옵션</th>
                                      <th className="text-left px-3 py-1.5 text-gray-500 font-medium w-24">SKU</th>
                                      <th className="text-center px-3 py-1.5 text-gray-500 font-medium w-16">재고</th>
                                      <th className="text-center px-3 py-1.5 text-gray-500 font-medium w-16">상태</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {detail.variants.map((v, idx) => (
                                      <tr key={idx} className={!v.isActive ? 'opacity-40' : ''}>
                                        <td className="px-3 py-1.5">{v.label || '—'}</td>
                                        <td className="px-3 py-1.5 text-gray-400">{v.sku || '—'}</td>
                                        <td className="px-3 py-1.5 text-center">{v.stock}</td>
                                        <td className="px-3 py-1.5 text-center">
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${v.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {v.isActive ? '활성' : '비활성'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            /* 단일상품: 옵션 목록만 */
                            detail.options.length > 0 && (
                              <div>
                                <p className="text-sm font-semibold text-gray-700 mb-2">상품 옵션</p>
                                <div className="space-y-1">
                                  {detail.options.map((opt, idx) => (
                                    <div key={idx} className="text-sm">
                                      <span className="font-medium text-gray-700">{opt.name}</span>
                                      {!opt.isRequired && <span className="ml-1 text-xs text-gray-400">(선택)</span>}
                                      <span className="text-gray-400 mx-1">:</span>
                                      <span className="text-gray-600">{opt.values.join(', ')}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          )}
                        </div>

                        {/* 구매수량 / 배송 / 수량할인 / 사은품 — 2단 */}
                        <div className="grid grid-cols-2 gap-5">
                          {/* 구매수량 + 배송 */}
                          <div className="space-y-3 text-sm">
                            {(detail.minPurchaseQuantity != null || detail.maxPurchaseQuantity != null || detail.dailyPurchaseLimit != null) && (
                              <div>
                                <p className="font-semibold text-gray-700 mb-1.5">구매 수량 설정</p>
                                {detail.minPurchaseQuantity != null && detail.minPurchaseQuantity > 1 && (
                                  <p className="text-gray-600"><span className="text-gray-400 w-20 inline-block">최소</span>{detail.minPurchaseQuantity}개</p>
                                )}
                                {detail.maxPurchaseQuantity != null && (
                                  <p className="text-gray-600"><span className="text-gray-400 w-20 inline-block">최대</span>{detail.maxPurchaseQuantity}개</p>
                                )}
                                {detail.dailyPurchaseLimit != null && (
                                  <p className="text-gray-600"><span className="text-gray-400 w-20 inline-block">1일제한</span>{detail.dailyPurchaseLimit}개</p>
                                )}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-gray-700 mb-1.5">배송 정보</p>
                              <p className="text-gray-600">
                                {{default: '기본 배송비 적용', free: '무료 배송', custom: `개별 배송비 (${formatCurrency(detail.shippingFee ?? 0)})`}[detail.shippingType] ?? detail.shippingType}
                              </p>
                            </div>
                          </div>

                          {/* 수량별 할인 + 사은품 */}
                          <div className="space-y-3 text-sm">
                            {detail.quantityDiscounts.filter((d) => d.isActive).length > 0 && (
                              <div>
                                <p className="font-semibold text-gray-700 mb-1.5">수량별 할인</p>
                                <div className="space-y-1">
                                  {detail.quantityDiscounts.filter((d) => d.isActive).map((d, idx) => (
                                    <p key={idx} className="text-gray-600">
                                      {d.minQuantity}개 이상 →&nbsp;
                                      <span className="text-blue-600 font-medium">
                                        {d.discountType === 'percent' ? `${d.discountValue}% 할인` : `${formatCurrency(d.discountValue)} 할인`}
                                      </span>
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                            {detail.giftSets.filter((s) => s.isActive).length > 0 && (
                              <div>
                                <p className="font-semibold text-gray-700 mb-1.5">사은품 설정</p>
                                <div className="space-y-1">
                                  {detail.giftSets.filter((s) => s.isActive).map((s, idx) => (
                                    <div key={idx} className="text-gray-600">
                                      <span className="font-medium">{s.name}</span>
                                      <span className="ml-1 text-xs text-gray-400">
                                        ({s.giftType === 'select' ? '고객선택' : s.giftType === 'auto_same' ? '동일상품자동' : '특정상품자동'})
                                      </span>
                                      {s.tiers.length > 0 && (
                                        <div className="ml-2 mt-0.5 space-y-0.5">
                                          {s.tiers.map((t, ti) => (
                                            <p key={ti} className="text-xs text-gray-500">{t.minQuantity}개 이상 → {t.freeCount}개 증정</p>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 편집 버튼 */}
                        <div className="flex justify-end pt-1">
                          <Link to={product.productType === 'bundle' ? `/admin/bundles/${product.id}/edit` : `/admin/products/${product.slug}/edit`}>
                            <Button size="sm">
                              <Edit className="h-4 w-4 mr-1.5" />
                              편집하기
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 일괄 편집 모달 */}
      {showBulkEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">일괄 편집</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowBulkEditModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p className="mb-4 text-sm text-gray-500">
              {selectedIds.size}개 상품에 적용됩니다. 변경하지 않을 항목은 비워두세요.
            </p>

            <div className="space-y-4">
              <div>
                <Label>상태 변경</Label>
                <Select value={bulkStatus} onValueChange={setBulkStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="선택 안함" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">판매중</SelectItem>
                    <SelectItem value="inactive">판매중지</SelectItem>
                    <SelectItem value="draft">임시저장</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>카테고리 변경</Label>
                <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="선택 안함" />
                  </SelectTrigger>
                  <SelectContent>
                    {flattenCategoryTree(categories).map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.level > 0 ? `${'　'.repeat(cat.level)}↳ ${cat.name}` : cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>가격 조정</Label>
                <div className="flex gap-2">
                  <Select value={bulkPriceAction} onValueChange={setBulkPriceAction}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="선택 안함" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="increase_percent">% 인상</SelectItem>
                      <SelectItem value="decrease_percent">% 인하</SelectItem>
                      <SelectItem value="increase_fixed">원 인상</SelectItem>
                      <SelectItem value="decrease_fixed">원 인하</SelectItem>
                      <SelectItem value="set">가격 지정</SelectItem>
                    </SelectContent>
                  </Select>
                  {bulkPriceAction && (
                    <Input
                      type="number"
                      value={bulkPriceValue}
                      onChange={(e) => setBulkPriceValue(e.target.value)}
                      placeholder={bulkPriceAction.includes('percent') ? '10' : '1000'}
                      className="w-28"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <Button className="flex-1" onClick={handleBulkEdit}>
                <Check className="mr-2 h-4 w-4" />
                적용
              </Button>
              <Button variant="outline" onClick={() => setShowBulkEditModal(false)}>
                취소
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

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
  MoreHorizontal,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

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
}

interface Category {
  id: string;
  name: string;
  depth: number;
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
        .select('id, name, slug, sale_price, regular_price, stock_quantity, status, category_id, sku, product_images(url)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProducts(
        (data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.sale_price,
          regularPrice: p.regular_price,
          stock: p.stock_quantity,
          thumbnail: p.product_images?.[0]?.url || '',
          isActive: p.status === 'active',
          categoryId: p.category_id,
          sku: p.sku,
        }))
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
        .select('id, name, depth')
        .order('sort_order', { ascending: true });
      setCategories(data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
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

    try {
      setImporting(true);
      const text = await file.text();
      const lines = text.split('\n').filter((line) => line.trim());

      if (lines.length < 2) {
        alert('유효한 데이터가 없습니다.');
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

    return matchesSearch && matchesStatus;
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
            <div className="w-32"></div>
          </div>

          <div className="divide-y">
            {filteredProducts.map((product) => (
              <div key={product.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
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
                  <h3 className="font-bold truncate">{product.name}</h3>
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
                  <span className={product.stock <= 10 ? 'text-red-500 font-medium' : ''}>
                    {product.stock}개
                  </span>
                </div>

                <div className="w-20 text-center">
                  <Badge variant={product.isActive ? 'default' : 'secondary'}>
                    {product.isActive ? '판매중' : '판매중지'}
                  </Badge>
                </div>

                <div className="flex gap-1 w-32 justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDuplicate(product)}
                    title="복사"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Link to={`/admin/products/${product.slug}/edit`}>
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
            ))}
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
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {'─'.repeat(cat.depth || 0)} {cat.name}
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

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
  Upload,
  Download,
  Check,
  Package,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type TabType = 'bulk-update' | 'import-export';

interface Product {
  id: string;
  name: string;
  salePrice: number;
  stock: number;
  isActive: boolean;
}

interface ImportRow {
  name: string;
  slug: string;
  sale_price: number;
  original_price: number;
  stock: number;
  is_active: boolean;
}

export default function AdminProductsBulkPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabType>('bulk-update');

  // Tab 1: Bulk Update
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>('');
  const [priceMode, setPriceMode] = useState<string>('fixed');
  const [priceValue, setPriceValue] = useState<string>('');
  const [stockValue, setStockValue] = useState<string>('');
  const [activateValue, setActivateValue] = useState<string>('');
  const [applying, setApplying] = useState(false);

  // Tab 2: Import/Export
  const [exporting, setExporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importFileName, setImportFileName] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadProducts();
    }
  }, [user, authLoading, navigate]);

  async function loadProducts() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sale_price, stock_quantity, status')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProducts(
        (data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          salePrice: p.sale_price,
          stock: p.stock_quantity,
          isActive: p.status === 'active',
        }))
      );
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  }

  // Selection helpers
  function toggleSelectAll() {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  }

  function toggleSelect(id: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  }

  // Bulk update apply
  async function handleApplyBulkUpdate() {
    if (selectedIds.size === 0) {
      alert('상품을 선택해주세요.');
      return;
    }

    if (!bulkAction) {
      alert('일괄 작업을 선택해주세요.');
      return;
    }

    setApplying(true);

    try {
      const supabase = createClient();
      const ids = Array.from(selectedIds);

      if (bulkAction === 'price') {
        const value = parseFloat(priceValue);
        if (isNaN(value) || value === 0) {
          alert('유효한 가격 값을 입력해주세요.');
          setApplying(false);
          return;
        }

        const selectedProducts = products.filter((p) => selectedIds.has(p.id));

        for (const product of selectedProducts) {
          let newPrice: number;

          if (priceMode === 'fixed') {
            newPrice = product.salePrice + value;
          } else {
            newPrice = Math.round(product.salePrice * (1 + value / 100));
          }

          newPrice = Math.max(0, newPrice);

          await supabase
            .from('products')
            .update({ sale_price: newPrice })
            .eq('id', product.id);
        }
      } else if (bulkAction === 'stock') {
        const value = parseInt(stockValue);
        if (isNaN(value)) {
          alert('유효한 재고 수량을 입력해주세요.');
          setApplying(false);
          return;
        }

        const { error } = await supabase
          .from('products')
          .update({ stock_quantity: value })
          .in('id', ids);

        if (error) throw error;
      } else if (bulkAction === 'activate') {
        if (!activateValue) {
          alert('활성/비활성 상태를 선택해주세요.');
          setApplying(false);
          return;
        }

        const newStatus = activateValue === 'active' ? 'active' : 'inactive';

        const { error } = await supabase
          .from('products')
          .update({ status: newStatus })
          .in('id', ids);

        if (error) throw error;
      }

      alert(`선택한 ${selectedIds.size}개 상품이 수정되었습니다.`);
      setSelectedIds(new Set());
      setBulkAction('');
      setPriceValue('');
      setStockValue('');
      setActivateValue('');
      await loadProducts();
    } catch (error) {
      console.error('Failed to apply bulk update:', error);
      alert('일괄 수정 중 오류가 발생했습니다.');
    } finally {
      setApplying(false);
    }
  }

  // CSV Export
  async function handleExport() {
    try {
      setExporting(true);
      const supabase = createClient();

      const { data, error } = await supabase
        .from('products')
        .select(`
          name, slug, sale_price, regular_price, stock_quantity, status,
          category:product_categories(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const headers = ['name', 'slug', 'sale_price', 'original_price', 'stock', 'category', 'is_active'];
      const rows = (data || []).map((p: any) => [
        p.name,
        p.slug,
        p.sale_price,
        p.regular_price,
        p.stock_quantity,
        p.category?.name || '',
        p.status === 'active' ? 'true' : 'false',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');

      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `products_bulk_${new Date().toISOString().split('T')[0]}.csv`;
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

  // CSV parsing helper
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

  // CSV Import - parse and preview
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').filter((line) => line.trim());
      if (lines.length < 2) {
        alert('유효한 데이터가 없습니다.');
        return;
      }

      const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/"/g, '').trim());

      const nameIdx = headers.indexOf('name');
      const slugIdx = headers.indexOf('slug');
      const salePriceIdx = headers.indexOf('sale_price');
      const originalPriceIdx = headers.indexOf('original_price');
      const stockIdx = headers.indexOf('stock');
      const isActiveIdx = headers.indexOf('is_active');

      if (nameIdx === -1 || slugIdx === -1 || salePriceIdx === -1) {
        alert('필수 컬럼이 없습니다. (name, slug, sale_price)');
        return;
      }

      const rows: ImportRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < 3) continue;

        const name = values[nameIdx]?.replace(/"/g, '');
        const slug = values[slugIdx]?.replace(/"/g, '');
        if (!name || !slug) continue;

        rows.push({
          name,
          slug,
          sale_price: parseFloat(values[salePriceIdx]?.replace(/"/g, '')) || 0,
          original_price: originalPriceIdx !== -1 ? parseFloat(values[originalPriceIdx]?.replace(/"/g, '')) || 0 : 0,
          stock: stockIdx !== -1 ? parseInt(values[stockIdx]?.replace(/"/g, '')) || 0 : 0,
          is_active: isActiveIdx !== -1 ? values[isActiveIdx]?.replace(/"/g, '').toLowerCase() === 'true' : false,
        });
      }

      setImportPreview(rows);
    };

    reader.readAsText(file);
  }

  // Confirm import
  async function handleConfirmImport() {
    if (importPreview.length === 0) return;

    setImporting(true);

    try {
      const supabase = createClient();
      let created = 0;
      let updated = 0;
      let failed = 0;

      for (const row of importPreview) {
        // Check if product with this slug exists
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('slug', row.slug)
          .maybeSingle();

        if (existing) {
          // Update
          const { error } = await supabase
            .from('products')
            .update({
              name: row.name,
              sale_price: row.sale_price,
              regular_price: row.original_price || row.sale_price,
              stock_quantity: row.stock,
              status: row.is_active ? 'active' : 'inactive',
            })
            .eq('id', existing.id);

          if (error) {
            failed++;
          } else {
            updated++;
          }
        } else {
          // Get default category
          const { data: defaultCategory } = await supabase
            .from('product_categories')
            .select('id')
            .limit(1)
            .single();

          if (defaultCategory) {
            const { error } = await supabase
              .from('products')
              .insert({
                name: row.name,
                slug: row.slug,
                sale_price: row.sale_price,
                regular_price: row.original_price || row.sale_price,
                stock_quantity: row.stock,
                status: row.is_active ? 'active' : 'draft',
                category_id: defaultCategory.id,
              });

            if (error) {
              failed++;
            } else {
              created++;
            }
          } else {
            failed++;
          }
        }
      }

      alert(`가져오기 완료: ${created}개 생성, ${updated}개 업데이트${failed > 0 ? `, ${failed}개 실패` : ''}`);
      setImportPreview([]);
      setImportFileName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await loadProducts();
    } catch (error) {
      console.error('Failed to import:', error);
      alert('가져오기 중 오류가 발생했습니다.');
    } finally {
      setImporting(false);
    }
  }

  if (authLoading || loading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  return (
    <div className="container py-8">
      <Link to="/admin/products" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        상품 관리로 돌아가기
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">상품 일괄 관리</h1>
        <p className="mt-1 text-gray-500">상품을 일괄로 수정하거나 CSV로 가져오기/내보내기할 수 있습니다.</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'bulk-update'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('bulk-update')}
        >
          <Package className="mr-2 inline h-4 w-4" />
          일괄 수정
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'import-export'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('import-export')}
        >
          <Download className="mr-2 inline h-4 w-4" />
          가져오기/내보내기
        </button>
      </div>

      {/* Tab 1: Bulk Update */}
      {activeTab === 'bulk-update' && (
        <div className="space-y-4">
          {/* Action panel */}
          <Card className="p-4">
            <h2 className="mb-4 text-lg font-bold">일괄 작업 설정</h2>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <Label>작업 유형</Label>
                <Select value={bulkAction} onValueChange={setBulkAction}>
                  <SelectTrigger className="mt-1 w-[180px]">
                    <SelectValue placeholder="작업 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price">가격 변경</SelectItem>
                    <SelectItem value="stock">재고 수정</SelectItem>
                    <SelectItem value="activate">활성/비활성</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {bulkAction === 'price' && (
                <>
                  <div>
                    <Label>변경 방식</Label>
                    <Select value={priceMode} onValueChange={setPriceMode}>
                      <SelectTrigger className="mt-1 w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">고정 금액 (원)</SelectItem>
                        <SelectItem value="percent">비율 (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>
                      값 {priceMode === 'fixed' ? '(양수: 인상, 음수: 인하)' : '(양수: 인상, 음수: 인하)'}
                    </Label>
                    <Input
                      type="number"
                      value={priceValue}
                      onChange={(e) => setPriceValue(e.target.value)}
                      placeholder={priceMode === 'fixed' ? '1000 또는 -1000' : '10 또는 -10'}
                      className="mt-1 w-[200px]"
                    />
                  </div>
                </>
              )}

              {bulkAction === 'stock' && (
                <div>
                  <Label>재고 수량 (일괄 설정)</Label>
                  <Input
                    type="number"
                    value={stockValue}
                    onChange={(e) => setStockValue(e.target.value)}
                    placeholder="재고 수량 입력"
                    className="mt-1 w-[200px]"
                  />
                </div>
              )}

              {bulkAction === 'activate' && (
                <div>
                  <Label>상태</Label>
                  <Select value={activateValue} onValueChange={setActivateValue}>
                    <SelectTrigger className="mt-1 w-[150px]">
                      <SelectValue placeholder="상태 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">판매중 (활성)</SelectItem>
                      <SelectItem value="inactive">판매중지 (비활성)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button onClick={handleApplyBulkUpdate} disabled={applying || selectedIds.size === 0}>
                <Check className="mr-2 h-4 w-4" />
                {applying ? '적용 중...' : `적용 (${selectedIds.size}개 선택)`}
              </Button>
            </div>
          </Card>

          {/* Product list */}
          <Card>
            <div className="flex items-center gap-4 p-4 border-b bg-gray-50">
              <input
                type="checkbox"
                checked={selectedIds.size === products.length && products.length > 0}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded"
              />
              <div className="flex-1 font-medium text-sm text-gray-600">상품명</div>
              <div className="w-28 text-center font-medium text-sm text-gray-600">판매가</div>
              <div className="w-20 text-center font-medium text-sm text-gray-600">재고</div>
              <div className="w-20 text-center font-medium text-sm text-gray-600">상태</div>
            </div>

            {products.length === 0 ? (
              <div className="p-12 text-center text-gray-500">등록된 상품이 없습니다.</div>
            ) : (
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {products.map((product) => (
                  <div key={product.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(product.id)}
                      onChange={() => toggleSelect(product.id)}
                      className="h-4 w-4 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{product.name}</p>
                    </div>
                    <div className="w-28 text-center">
                      <p className="font-medium">{formatCurrency(product.salePrice)}</p>
                    </div>
                    <div className="w-20 text-center">
                      <span className={product.stock <= 10 ? 'text-red-500 font-medium' : ''}>
                        {product.stock}개
                      </span>
                    </div>
                    <div className="w-20 text-center">
                      <Badge variant={product.isActive ? 'default' : 'secondary'}>
                        {product.isActive ? '판매중' : '중지'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: Import/Export */}
      {activeTab === 'import-export' && (
        <div className="space-y-6">
          {/* Export */}
          <Card className="p-6">
            <h2 className="mb-2 text-lg font-bold">내보내기 (CSV)</h2>
            <p className="mb-4 text-sm text-gray-500">
              모든 상품 정보를 CSV 파일로 다운로드합니다.
              컬럼: name, slug, sale_price, original_price, stock, category, is_active
            </p>
            <Button onClick={handleExport} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />
              {exporting ? '다운로드 중...' : 'CSV 다운로드'}
            </Button>
          </Card>

          {/* Import */}
          <Card className="p-6">
            <h2 className="mb-2 text-lg font-bold">가져오기 (CSV)</h2>
            <p className="mb-4 text-sm text-gray-500">
              CSV 파일을 업로드하여 상품을 일괄 등록/수정합니다.
              필수 컬럼: name, slug, sale_price, original_price, stock, is_active
            </p>

            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                CSV 파일 선택
              </Button>
              {importFileName && (
                <span className="text-sm text-gray-600">{importFileName}</span>
              )}
            </div>

            {/* Import preview */}
            {importPreview.length > 0 && (
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-medium">
                    미리보기 ({importPreview.length}개 상품)
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setImportPreview([]);
                        setImportFileName('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      취소
                    </Button>
                    <Button onClick={handleConfirmImport} disabled={importing}>
                      <Check className="mr-2 h-4 w-4" />
                      {importing ? '처리 중...' : '가져오기 확인'}
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-600">상품명</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-600">슬러그</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-600">판매가</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-600">원래가</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-600">재고</th>
                        <th className="px-4 py-2 text-center font-medium text-gray-600">활성</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importPreview.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-2">{row.name}</td>
                          <td className="px-4 py-2 font-mono text-xs text-gray-500">{row.slug}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(row.sale_price)}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(row.original_price)}</td>
                          <td className="px-4 py-2 text-right">{row.stock}</td>
                          <td className="px-4 py-2 text-center">
                            <Badge variant={row.is_active ? 'default' : 'secondary'}>
                              {row.is_active ? '활성' : '비활성'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

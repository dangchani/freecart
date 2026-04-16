import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Plus, X, Trash2, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { saveBundleItems, type BundleItemDraft } from '@/services/bundles';
import { saveGiftSets, type GiftSetDraft, type GiftSetItemDraft, type GiftTierDraft, type GiftType } from '@/services/giftSets';
import { getContrastColor, isValidHex } from '@/lib/utils';
import { saveQuantityDiscounts, type QuantityDiscountDraft } from '@/services/discounts';

interface UploadedImage {
  id: string;
  url: string;
  file?: File;
  isPrimary: boolean;
  sortOrder: number;
}

// =============================================================================
// Schema
// =============================================================================

const bundleSchema = z.object({
  name: z.string().min(1, '상품명을 입력해주세요'),
  slug: z.string().min(1, 'URL 슬러그를 입력해주세요').regex(/^[a-z0-9-]+$/, '영문 소문자, 숫자, 하이픈만 가능합니다'),
  summary: z.string().max(500).optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid('카테고리를 선택해주세요'),
  brandId: z.string().uuid().optional().nullable(),
  regularPrice: z.number().min(0, '정가를 입력해주세요'),
  salePrice: z.number().min(0, '판매가를 입력해주세요'),
  costPrice: z.preprocess((v) => (typeof v === 'number' && isNaN(v) ? undefined : v), z.number().min(0).optional()),
  pointRate: z.preprocess((v) => (typeof v === 'number' && isNaN(v) ? undefined : v), z.number().min(0).max(100).optional()),
  stockAlertQuantity: z.number().int().min(0).default(10),
  minPurchaseQuantity: z.number().int().min(1).default(1),
  maxPurchaseQuantity: z.preprocess((v) => (typeof v === 'number' && isNaN(v) ? undefined : v), z.number().int().min(1).optional().nullable()),
  dailyPurchaseLimit: z.preprocess((v) => (typeof v === 'number' && isNaN(v) ? undefined : v), z.number().int().min(1).optional().nullable()),
  sku: z.string().optional(),
  manufacturer: z.string().optional(),
  origin: z.string().optional(),
  weight: z.preprocess((v) => (typeof v === 'number' && isNaN(v) ? undefined : v), z.number().min(0).optional()),
  status: z.enum(['draft', 'active', 'inactive']).default('active'),
  isFeatured: z.boolean().default(false),
  isNew: z.boolean().default(false),
  isBest: z.boolean().default(false),
  isSale: z.boolean().default(false),
  shippingType: z.enum(['default', 'free', 'custom']).default('default'),
  shippingFee: z.preprocess((v) => (typeof v === 'number' && isNaN(v) ? undefined : v), z.number().min(0).optional()),
  seoTitle: z.string().max(255).optional(),
  seoDescription: z.string().max(500).optional(),
  seoKeywords: z.string().max(255).optional(),
  tags: z.array(z.string()).optional(),
});

type BundleForm = z.infer<typeof bundleSchema>;

// =============================================================================
// Component
// =============================================================================

export default function NewBundlePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    price: true,
    stock: true,
    bundleItems: true,
    purchaseQty: false,
    qtyDiscount: false,
    giftSets: false,
    shipping: false,
    seo: false,
  });

  // 구성상품
  const [bundleItemDrafts, setBundleItemDrafts] = useState<BundleItemDraft[]>([]);
  const [bundleParentCat, setBundleParentCat] = useState('');
  const [bundleChildCat, setBundleChildCat] = useState('');
  const [bundleCategoryProducts, setBundleCategoryProducts] = useState<any[]>([]);

  // 수량별 할인
  const [qtyDiscountDrafts, setQtyDiscountDrafts] = useState<QuantityDiscountDraft[]>([]);

  // 사은품
  const [giftSetDrafts, setGiftSetDrafts] = useState<GiftSetDraft[]>([]);
  const [giftProductParentCat, setGiftProductParentCat] = useState<Record<string, string>>({});
  const [giftProductChildCat, setGiftProductChildCat] = useState<Record<string, string>>({});
  const [giftProductResults, setGiftProductResults] = useState<Record<string, any[]>>({});

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BundleForm>({
    resolver: zodResolver(bundleSchema),
    defaultValues: {
      slug: String(Math.floor(Date.now() / 1000)),
      status: 'active',
      shippingType: 'default',
      stockAlertQuantity: 10,
      minPurchaseQuantity: 1,
      isFeatured: false,
      isNew: false,
      isBest: false,
      isSale: false,
      tags: [],
    },
  });

  const shippingType = watch('shippingType');
  const tags = watch('tags') || [];

  useEffect(() => {
    if (!authLoading) {
      if (!user) { navigate('/auth/login'); return; }
      loadCategories();
      loadBrands();
    }
  }, [user, authLoading, navigate]);

  async function loadCategories() {
    const supabase = createClient();
    const { data } = await supabase
      .from('product_categories')
      .select('id, name, slug, parent_id, depth')
      .eq('is_visible', true)
      .order('sort_order', { ascending: true });
    setCategories(data || []);
  }

  async function loadBrands() {
    const supabase = createClient();
    const { data } = await supabase
      .from('product_brands')
      .select('id, name')
      .eq('is_visible', true)
      .order('name', { ascending: true });
    setBrands(data || []);
  }

  // ---------------- Bundle Items ----------------

  async function loadBundleProductsByCategory(categoryId: string) {
    if (!categoryId) { setBundleCategoryProducts([]); return; }
    const supabase = createClient();
    const { data } = await supabase
      .from('products')
      .select('id, name, sale_price, product_images(url, is_primary)')
      .neq('product_type', 'bundle')
      .eq('status', 'active')
      .eq('category_id', categoryId)
      .order('name', { ascending: true });
    setBundleCategoryProducts(data || []);
  }

  function addBundleItem(product: any) {
    if (bundleItemDrafts.some((d) => d.productId === product.id)) return;
    const primaryImg = (product.product_images || []).find((i: any) => i.is_primary) || product.product_images?.[0];
    setBundleItemDrafts((prev) => [
      ...prev,
      { localId: crypto.randomUUID(), dbId: null, productId: product.id, productName: product.name, productImageUrl: primaryImg?.url ?? null, variantId: null, variantLabel: null, quantity: 1 },
    ]);
  }

  function updateBundleItem(localId: string, patch: Partial<BundleItemDraft>) {
    setBundleItemDrafts((prev) => prev.map((d) => (d.localId === localId ? { ...d, ...patch } : d)));
  }

  function removeBundleItem(localId: string) {
    setBundleItemDrafts((prev) => prev.filter((d) => d.localId !== localId));
  }

  // ---------------- Qty Discount ----------------

  function addQtyDiscount() {
    setQtyDiscountDrafts((prev) => [...prev, { localId: crypto.randomUUID(), dbId: null, minQuantity: 1, discountType: 'percent', discountValue: 10, isActive: true }]);
  }

  function updateQtyDiscount(localId: string, patch: Partial<QuantityDiscountDraft>) {
    setQtyDiscountDrafts((prev) => prev.map((d) => (d.localId === localId ? { ...d, ...patch } : d)));
  }

  function removeQtyDiscount(localId: string) {
    setQtyDiscountDrafts((prev) => prev.filter((d) => d.localId !== localId));
  }

  // ---------------- Gift Sets ----------------

  function newGiftSetDraft(): GiftSetDraft {
    return { localId: crypto.randomUUID(), dbId: null, name: '', giftType: 'select', isActive: true, startsAt: '', endsAt: '', badgeText: '', badgeColor: '#ef4444', tiers: [], items: [] };
  }

  function updateGiftSet(localId: string, patch: Partial<GiftSetDraft>) {
    setGiftSetDrafts((prev) => prev.map((s) => (s.localId === localId ? { ...s, ...patch } : s)));
  }

  function removeGiftSet(localId: string) {
    setGiftSetDrafts((prev) => prev.filter((s) => s.localId !== localId));
  }

  function addGiftTier(setLocalId: string) {
    const newTier: GiftTierDraft = { localId: crypto.randomUUID(), dbId: null, minQuantity: 1, freeCount: 1 };
    setGiftSetDrafts((prev) => prev.map((s) => s.localId === setLocalId ? { ...s, tiers: [...s.tiers, newTier] } : s));
  }

  function updateGiftTier(setLocalId: string, tierLocalId: string, patch: Partial<GiftTierDraft>) {
    setGiftSetDrafts((prev) => prev.map((s) => s.localId === setLocalId ? { ...s, tiers: s.tiers.map((t) => t.localId === tierLocalId ? { ...t, ...patch } : t) } : s));
  }

  function removeGiftTier(setLocalId: string, tierLocalId: string) {
    setGiftSetDrafts((prev) => prev.map((s) => s.localId === setLocalId ? { ...s, tiers: s.tiers.filter((t) => t.localId !== tierLocalId) } : s));
  }

  function addGiftItem(setLocalId: string, product: any) {
    const img = (product.product_images || []).find((i: any) => i.is_primary) || product.product_images?.[0];
    const newItem: GiftSetItemDraft = { localId: crypto.randomUUID(), dbId: null, giftProductId: product.id, giftProductName: product.name, giftProductImageUrl: img?.url ?? null, giftProductSalePrice: product.sale_price };
    setGiftSetDrafts((prev) => prev.map((s) => s.localId === setLocalId ? { ...s, items: [...s.items, newItem] } : s));
    setGiftProductResults((prev) => ({ ...prev, [setLocalId]: [] }));
  }

  function removeGiftItem(setLocalId: string, itemLocalId: string) {
    setGiftSetDrafts((prev) => prev.map((s) => s.localId === setLocalId ? { ...s, items: s.items.filter((i) => i.localId !== itemLocalId) } : s));
  }

  async function loadGiftProductsByCategory(setLocalId: string, categoryId: string) {
    if (!categoryId) { setGiftProductResults((prev) => ({ ...prev, [setLocalId]: [] })); return; }
    const supabase = createClient();
    const { data } = await supabase.from('products').select('id, name, sale_price, product_images(url, is_primary)').eq('status', 'active').eq('category_id', categoryId).order('name', { ascending: true });
    setGiftProductResults((prev) => ({ ...prev, [setLocalId]: data || [] }));
  }

  // ---------------- Images ----------------

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingImages(true);
    try {
      const supabase = createClient();
      const newImages: UploadedImage[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `products/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('products').upload(filePath, file);
        if (uploadError) { console.error('Upload error:', uploadError); continue; }
        const { data: publicUrlData } = supabase.storage.from('products').getPublicUrl(filePath);
        newImages.push({ id: `temp-${Date.now()}-${i}`, url: publicUrlData.publicUrl, file, isPrimary: images.length === 0 && i === 0, sortOrder: images.length + i });
      }
      setImages((prev) => [...prev, ...newImages]);
    } catch (error) {
      console.error('Failed to upload images:', error);
      alert('이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploadingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeImage(imageId: string) {
    setImages((prev) => {
      const filtered = prev.filter((img) => img.id !== imageId);
      if (filtered.length > 0 && !filtered.some((img) => img.isPrimary)) filtered[0].isPrimary = true;
      return filtered;
    });
  }

  function setPrimaryImage(imageId: string) {
    setImages((prev) => prev.map((img) => ({ ...img, isPrimary: img.id === imageId })));
  }

  // ---------------- Tags ----------------

  function addTag() {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) { setValue('tags', [...tags, trimmed]); setTagInput(''); }
  }

  function removeTag(tag: string) {
    setValue('tags', tags.filter((t) => t !== tag));
  }

  function toggleSection(section: keyof typeof expandedSections) {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  // =============================================================================
  // Submit
  // =============================================================================

  async function onSubmit(data: BundleForm) {
    if (bundleItemDrafts.length === 0) {
      alert('구성 상품을 최소 1개 이상 추가해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      const supabase = createClient();

      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          name: data.name,
          slug: data.slug,
          summary: data.summary || null,
          description: data.description || null,
          category_id: data.categoryId,
          brand_id: data.brandId || null,
          regular_price: data.regularPrice,
          sale_price: data.salePrice,
          cost_price: data.costPrice || null,
          point_rate: data.pointRate || null,
          stock_quantity: 0,
          stock_alert_quantity: data.stockAlertQuantity,
          min_purchase_quantity: data.minPurchaseQuantity,
          max_purchase_quantity: data.maxPurchaseQuantity || null,
          daily_purchase_limit: data.dailyPurchaseLimit || null,
          sku: data.sku || null,
          manufacturer: data.manufacturer || null,
          origin: data.origin || null,
          weight: data.weight || null,
          status: data.status,
          is_featured: data.isFeatured,
          is_new: data.isNew,
          is_best: data.isBest,
          is_sale: data.isSale,
          shipping_type: data.shippingType,
          shipping_fee: data.shippingFee || null,
          seo_title: data.seoTitle || null,
          seo_description: data.seoDescription || null,
          seo_keywords: data.seoKeywords || null,
          has_options: false,
          product_type: 'bundle',
          tags: data.tags || [],
        })
        .select('id')
        .single();

      if (productError) throw productError;

      const productId = product.id;

      if (images.length > 0) {
        const imageInserts = images.map((img, idx) => ({
          product_id: productId,
          url: img.url,
          is_primary: img.isPrimary,
          sort_order: idx,
        }));
        const { error: imageError } = await supabase.from('product_images').insert(imageInserts);
        if (imageError) throw imageError;
      }

      if (data.tags && data.tags.length > 0) {
        await supabase.from('product_tags').insert(data.tags.map((tag) => ({ product_id: productId, tag })));
      }

      await saveBundleItems(productId, bundleItemDrafts);
      await saveQuantityDiscounts(productId, qtyDiscountDrafts);
      if (giftSetDrafts.length > 0) await saveGiftSets(productId, giftSetDrafts);

      alert('세트상품이 등록되었습니다.');
      navigate('/admin/products');
    } catch (error) {
      console.error('Failed to create bundle:', error);
      alert(error instanceof Error ? error.message : '세트상품 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  // =============================================================================
  // Render
  // =============================================================================

  if (authLoading) return <div className="p-8 text-center">로딩 중...</div>;

  const SectionHeader = ({ title, section, required }: { title: string; section: keyof typeof expandedSections; required?: boolean }) => (
    <button
      type="button"
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
    >
      <span className="font-semibold text-gray-900">
        {title}{required && <span className="text-red-500 ml-1">*</span>}
      </span>
      {expandedSections[section] ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
    </button>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link to="/admin/products" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        상품 관리로 돌아가기
      </Link>

      <div className="mb-8 flex items-center gap-3">
        <h1 className="text-2xl font-bold">세트상품 등록</h1>
        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-semibold">세트</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* ============================================= */}
        {/* 상품 이미지 */}
        {/* ============================================= */}
        <Card className="overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <span className="font-semibold text-gray-900">상품 이미지</span>
          </div>
          <div className="p-4">
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
            <div className="flex flex-wrap gap-4">
              {images.map((image) => (
                <div key={image.id} className={`relative group w-32 h-32 rounded-lg overflow-hidden border-2 ${image.isPrimary ? 'border-blue-500' : 'border-gray-200'}`}>
                  <img src={image.url} alt="상품 이미지" className="w-full h-full object-cover" />
                  {image.isPrimary && (
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded">대표</span>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {!image.isPrimary && (
                      <button type="button" onClick={() => setPrimaryImage(image.id)} className="p-1.5 bg-white rounded-full text-blue-600 hover:bg-blue-50" title="대표 이미지로 설정">
                        <ImageIcon className="h-4 w-4" />
                      </button>
                    )}
                    <button type="button" onClick={() => removeImage(image.id)} className="p-1.5 bg-white rounded-full text-red-600 hover:bg-red-50" title="삭제">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImages}
                className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors disabled:opacity-50">
                {uploadingImages ? (
                  <span className="text-xs">업로드 중...</span>
                ) : (
                  <>
                    <Plus className="h-8 w-8 mb-1" />
                    <span className="text-xs">이미지 추가</span>
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">첫 번째 이미지가 대표 이미지로 설정됩니다. 이미지를 클릭하여 대표 이미지를 변경할 수 있습니다.</p>
          </div>
        </Card>

        {/* ============================================= */}
        {/* 기본 정보 */}
        {/* ============================================= */}
        <Card className="overflow-hidden">
          <SectionHeader title="기본 정보" section="basic" required />
          {expandedSections.basic && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">상품명 <span className="text-red-500">*</span></Label>
                  <Input id="name" {...register('name')} placeholder="세트상품명을 입력해주세요" />
                  {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
                </div>
                <div>
                  <Label htmlFor="slug">URL 슬러그 <span className="text-red-500">*</span></Label>
                  <Input id="slug" {...register('slug')} placeholder="bundle-slug" />
                  {errors.slug && <p className="mt-1 text-sm text-red-500">{errors.slug.message}</p>}
                </div>
                <div>
                  <Label htmlFor="sku">SKU (품목코드)</Label>
                  <Input id="sku" {...register('sku')} placeholder="SKU-B001" />
                </div>
              </div>

              <div>
                <Label htmlFor="summary">요약 설명</Label>
                <Input id="summary" {...register('summary')} placeholder="세트상품 한 줄 요약" />
              </div>

              <div>
                <Label htmlFor="description">상세 설명</Label>
                <Textarea id="description" {...register('description')} placeholder="세트상품 상세 설명을 입력해주세요" rows={6} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="categoryId">카테고리 <span className="text-red-500">*</span></Label>
                  <Select value={watch('categoryId') || ''} onValueChange={(value) => setValue('categoryId', value)}>
                    <SelectTrigger><SelectValue placeholder="카테고리 선택" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{'─'.repeat(c.depth || 0)} {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.categoryId && <p className="mt-1 text-sm text-red-500">{errors.categoryId.message}</p>}
                </div>
                <div>
                  <Label htmlFor="brandId">브랜드</Label>
                  <Select value={watch('brandId') || ''} onValueChange={(value) => setValue('brandId', value)}>
                    <SelectTrigger><SelectValue placeholder="브랜드 선택 (선택사항)" /></SelectTrigger>
                    <SelectContent>
                      {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="manufacturer">제조사</Label>
                  <Input id="manufacturer" {...register('manufacturer')} placeholder="제조사명" />
                </div>
                <div>
                  <Label htmlFor="origin">원산지</Label>
                  <Input id="origin" {...register('origin')} placeholder="대한민국" />
                </div>
              </div>

              <div>
                <Label htmlFor="weight">무게 (kg)</Label>
                <Input id="weight" type="number" step="0.01" {...register('weight', { valueAsNumber: true })} placeholder="0.5" />
              </div>

              <div>
                <Label>태그</Label>
                <div className="flex gap-2">
                  <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); }}} placeholder="태그 입력 후 Enter" />
                  <Button type="button" variant="outline" onClick={addTag}>추가</Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-sm">
                        #{tag}
                        <button type="button" onClick={() => removeTag(tag)} className="text-gray-500 hover:text-red-500"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label>표시 설정</Label>
                <div className="flex flex-wrap gap-4 mt-2">
                  {([['isNew', '신상품'], ['isBest', '베스트'], ['isFeatured', '추천상품'], ['isSale', '세일']] as const).map(([field, label]) => (
                    <label key={field} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" {...register(field)} className="rounded" />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="status">상태</Label>
                <Select defaultValue="active" onValueChange={(value: 'draft' | 'active' | 'inactive') => setValue('status', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">임시저장</SelectItem>
                    <SelectItem value="active">판매중</SelectItem>
                    <SelectItem value="inactive">판매중지</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </Card>

        {/* ============================================= */}
        {/* 구성 상품 설정 */}
        {/* ============================================= */}
        <Card className="overflow-hidden">
          <SectionHeader title="구성 상품 설정" section="bundleItems" required />
          {expandedSections.bundleItems && (
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-500">카테고리를 선택하여 구성 상품을 추가하세요.</p>

              {/* 카테고리 선택 */}
              <div className="flex gap-2">
                <select
                  value={bundleParentCat}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBundleParentCat(val);
                    setBundleChildCat('');
                    const hasChildren = categories.some((c) => (c.depth ?? 0) === 1 && c.parent_id === val);
                    if (val && !hasChildren) loadBundleProductsByCategory(val);
                    else setBundleCategoryProducts([]);
                  }}
                  className="h-9 rounded-md border border-input bg-white px-2 text-sm flex-1 min-w-0"
                >
                  <option value="">대분류 선택</option>
                  {categories.filter((c) => (c.depth ?? 0) === 0).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {bundleParentCat && (() => {
                  const children = categories.filter((c) => (c.depth ?? 0) === 1 && c.parent_id === bundleParentCat);
                  return children.length > 0 ? (
                    <select
                      value={bundleChildCat}
                      onChange={(e) => { const val = e.target.value; setBundleChildCat(val); loadBundleProductsByCategory(val); }}
                      className="h-9 rounded-md border border-input bg-white px-2 text-sm flex-1 min-w-0"
                    >
                      <option value="">중분류 선택</option>
                      {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : null;
                })()}
              </div>

              {/* 카테고리 상품 목록 */}
              {bundleCategoryProducts.length > 0 && (
                <div className="rounded-md border bg-white overflow-y-auto" style={{ maxHeight: '220px' }}>
                  {bundleCategoryProducts.map((p) => {
                    const alreadyAdded = bundleItemDrafts.some((d) => d.productId === p.id);
                    const primaryImg = (p.product_images || []).find((i: any) => i.is_primary) || p.product_images?.[0];
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => addBundleItem(p)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm border-b last:border-b-0 hover:bg-gray-50 ${alreadyAdded ? 'opacity-40 cursor-not-allowed bg-gray-50' : ''}`}
                      >
                        {primaryImg && <img src={primaryImg.url} className="h-8 w-8 rounded object-cover flex-shrink-0" alt="" />}
                        <span className="flex-1 truncate">{p.name}</span>
                        <span className="text-xs text-gray-400 shrink-0">{(p.sale_price || 0).toLocaleString()}원</span>
                        {alreadyAdded && <span className="text-xs text-green-600 shrink-0">추가됨</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {bundleParentCat && bundleCategoryProducts.length === 0 && (() => {
                const hasChildren = categories.some((c) => (c.depth ?? 0) === 1 && c.parent_id === bundleParentCat);
                const childSelected = !!bundleChildCat;
                return (!hasChildren || childSelected) ? (
                  <p className="text-xs text-gray-400 py-1">해당 카테고리에 상품이 없습니다.</p>
                ) : null;
              })()}

              {bundleItemDrafts.length > 0 ? (
                <div className="border rounded-lg divide-y">
                  {bundleItemDrafts.map((item) => (
                    <div key={item.localId} className="flex items-center gap-3 px-3 py-2">
                      {item.productImageUrl && <img src={item.productImageUrl} className="h-8 w-8 rounded object-cover" alt="" />}
                      <span className="flex-1 text-sm font-medium">{item.productName}</span>
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-gray-500">수량</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateBundleItem(item.localId, { quantity: Math.max(1, Number(e.target.value)) })}
                          className="h-8 w-20 text-sm"
                        />
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeBundleItem(item.localId)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">구성 상품이 없습니다. 위에서 검색하여 추가하세요.</p>
              )}
            </div>
          )}
        </Card>

        {/* ============================================= */}
        {/* 가격 정보 */}
        {/* ============================================= */}
        <Card className="overflow-hidden">
          <SectionHeader title="가격 정보" section="price" required />
          {expandedSections.price && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="regularPrice">정가 <span className="text-red-500">*</span></Label>
                  <Input id="regularPrice" type="number" {...register('regularPrice', { valueAsNumber: true })} placeholder="0" />
                  {errors.regularPrice && <p className="mt-1 text-sm text-red-500">{errors.regularPrice.message}</p>}
                </div>
                <div>
                  <Label htmlFor="salePrice">판매가 <span className="text-red-500">*</span></Label>
                  <Input id="salePrice" type="number" {...register('salePrice', { valueAsNumber: true })} placeholder="0" />
                  {errors.salePrice && <p className="mt-1 text-sm text-red-500">{errors.salePrice.message}</p>}
                </div>
                <div>
                  <Label htmlFor="costPrice">원가 (선택)</Label>
                  <Input id="costPrice" type="number" {...register('costPrice', { valueAsNumber: true })} placeholder="0" />
                </div>
                <div>
                  <Label htmlFor="pointRate">적립률 (%)</Label>
                  <Input id="pointRate" type="number" step="0.1" {...register('pointRate', { valueAsNumber: true })} placeholder="1.0" />
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* ============================================= */}
        {/* 재고 정보 (읽기 전용 — 구성 상품에서 자동 계산) */}
        {/* ============================================= */}
        <Card className="overflow-hidden">
          <SectionHeader title="재고 정보" section="stock" />
          {expandedSections.stock && (
            <div className="p-4 space-y-4">
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
                세트상품 재고는 구성 상품의 재고를 기반으로 자동 계산됩니다.
                <br />
                <strong>계산식:</strong> MIN(구성상품재고 ÷ 구성수량) — 구성 상품 중 하나라도 재고가 부족하면 품절 처리됩니다.
              </div>
              <div className="max-w-xs">
                <Label htmlFor="stockAlertQuantity">재고 알림 수량</Label>
                <Input id="stockAlertQuantity" type="number" {...register('stockAlertQuantity', { valueAsNumber: true })} placeholder="10" />
                <p className="mt-1 text-xs text-gray-500">유효 재고가 이 값 이하가 되면 알림이 발송됩니다.</p>
              </div>
            </div>
          )}
        </Card>

        {/* ============================================= */}
        {/* 구매 수량 설정 */}
        {/* ============================================= */}
        <Card className="overflow-hidden">
          <SectionHeader title="구매 수량 설정" section="purchaseQty" />
          {expandedSections.purchaseQty && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minPurchaseQuantity">최소 구매 수량</Label>
                  <Input id="minPurchaseQuantity" type="number" min={1} {...register('minPurchaseQuantity', { valueAsNumber: true })} placeholder="1" />
                  <p className="mt-1 text-xs text-gray-500">1회 주문 시 최소 구매 수량</p>
                </div>
                <div>
                  <Label htmlFor="maxPurchaseQuantity">최대 구매 수량 (선택)</Label>
                  <Input id="maxPurchaseQuantity" type="number" min={1} {...register('maxPurchaseQuantity', { valueAsNumber: true })} placeholder="제한 없음" />
                  <p className="mt-1 text-xs text-gray-500">1회 주문 시 최대 구매 수량</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="max-w-xs">
                  <Label htmlFor="dailyPurchaseLimit">1일 최대 구매 수량 (선택)</Label>
                  <Input id="dailyPurchaseLimit" type="number" min={1} {...register('dailyPurchaseLimit', { valueAsNumber: true })} placeholder="제한 없음" />
                  <p className="mt-1 text-xs text-gray-500">동일 계정이 하루에 구매할 수 있는 최대 수량</p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* ============================================= */}
        {/* 수량별 할인 설정 */}
        {/* ============================================= */}
        <Card className="overflow-hidden">
          <SectionHeader title="수량별 할인 설정" section="qtyDiscount" />
          {expandedSections.qtyDiscount && (
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-500">구매 수량에 따라 단가를 할인합니다.</p>
              {qtyDiscountDrafts.map((draft) => (
                <div key={draft.localId} className="flex items-center gap-2 rounded-lg border bg-gray-50 p-3">
                  <span className="text-sm text-gray-600 whitespace-nowrap">구매</span>
                  <Input type="number" min={1} value={draft.minQuantity} onChange={(e) => updateQtyDiscount(draft.localId, { minQuantity: Number(e.target.value) || 1 })} className="w-20" />
                  <span className="text-sm text-gray-600 whitespace-nowrap">개 이상 →</span>
                  <Input type="number" min={1} value={draft.discountValue} onChange={(e) => updateQtyDiscount(draft.localId, { discountValue: Number(e.target.value) || 1 })} className="w-20" />
                  <select value={draft.discountType} onChange={(e) => updateQtyDiscount(draft.localId, { discountType: e.target.value as 'percent' | 'fixed' })} className="h-9 rounded-md border border-input bg-white px-2 text-sm">
                    <option value="percent">% 할인</option>
                    <option value="fixed">원 할인</option>
                  </select>
                  <label className="flex items-center gap-1 text-sm cursor-pointer whitespace-nowrap">
                    <input type="checkbox" checked={draft.isActive} onChange={(e) => updateQtyDiscount(draft.localId, { isActive: e.target.checked })} className="rounded" />
                    활성
                  </label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeQtyDiscount(draft.localId)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addQtyDiscount}>
                <Plus className="h-3 w-3 mr-1" />구간 추가
              </Button>
            </div>
          )}
        </Card>

        {/* ============================================= */}
        {/* 사은품 설정 */}
        {/* ============================================= */}
        <Card className="overflow-hidden">
          <SectionHeader title="사은품 설정" section="giftSets" />
          {expandedSections.giftSets && (
            <div className="p-4 space-y-4">
              {giftSetDrafts.map((giftSet) => (
                <div key={giftSet.localId} className="rounded-lg border border-gray-200 p-4 space-y-4 bg-gray-50">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <Label>세트명</Label>
                      <Input value={giftSet.name} onChange={(e) => updateGiftSet(giftSet.localId, { name: e.target.value })} placeholder="예: 3+1 사은품 이벤트" />
                    </div>
                    <div className="w-44">
                      <Label>증정 유형</Label>
                      <select value={giftSet.giftType} onChange={(e) => updateGiftSet(giftSet.localId, { giftType: e.target.value as GiftType, items: [] })} className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="select">고객 선택</option>
                        <option value="auto_same">동일상품 자동</option>
                        <option value="auto_specific">특정상품 자동</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <label className="flex items-center gap-1 text-sm cursor-pointer">
                        <input type="checkbox" checked={giftSet.isActive} onChange={(e) => updateGiftSet(giftSet.localId, { isActive: e.target.checked })} className="rounded" />
                        활성
                      </label>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeGiftSet(giftSet.localId)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label>사은품 구간</Label>
                    <p className="mb-2 text-xs text-gray-500">구매 수량에 따라 증정 개수를 설정합니다.</p>
                    <div className="space-y-2">
                      {giftSet.tiers.map((tier) => (
                        <div key={tier.localId} className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 whitespace-nowrap">구매</span>
                          <Input type="number" min={1} value={tier.minQuantity} onChange={(e) => updateGiftTier(giftSet.localId, tier.localId, { minQuantity: Number(e.target.value) || 1 })} className="w-20" />
                          <span className="text-sm text-gray-600 whitespace-nowrap">개 이상 →</span>
                          <Input type="number" min={1} value={tier.freeCount} onChange={(e) => updateGiftTier(giftSet.localId, tier.localId, { freeCount: Number(e.target.value) || 1 })} className="w-20" />
                          <span className="text-sm text-gray-600 whitespace-nowrap">개 증정</span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeGiftTier(giftSet.localId, tier.localId)}><X className="h-3 w-3" /></Button>
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={() => addGiftTier(giftSet.localId)}>
                        <Plus className="h-3 w-3 mr-1" />구간 추가
                      </Button>
                    </div>
                  </div>

                  {giftSet.giftType === 'auto_same' ? (
                    <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
                      구매 수량 충족 시 <strong>구매한 상품과 동일한 상품</strong>이 자동으로 증정됩니다.
                    </div>
                  ) : (
                    <div>
                      <Label>{giftSet.giftType === 'auto_specific' ? '증정 상품 (1개 선택)' : '사은품 상품 목록'}</Label>
                      <div className="space-y-2 mt-2">
                        {giftSet.items.map((item) => (
                          <div key={item.localId} className="flex items-center gap-2 rounded border bg-white p-2">
                            {item.giftProductImageUrl && <img src={item.giftProductImageUrl} alt={item.giftProductName} className="h-8 w-8 rounded object-cover flex-shrink-0" />}
                            <span className="flex-1 text-sm truncate">{item.giftProductName}</span>
                            <span className="text-xs text-gray-400 flex-shrink-0">{item.giftProductSalePrice.toLocaleString()}원 → <span className="text-blue-600 font-medium">0원</span></span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeGiftItem(giftSet.localId, item.localId)}><X className="h-3 w-3" /></Button>
                          </div>
                        ))}
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <select value={giftProductParentCat[giftSet.localId] ?? ''} onChange={(e) => {
                              const val = e.target.value;
                              setGiftProductParentCat((prev) => ({ ...prev, [giftSet.localId]: val }));
                              setGiftProductChildCat((prev) => ({ ...prev, [giftSet.localId]: '' }));
                              const hasChildren = categories.some((c) => (c.depth ?? 0) === 1 && c.parent_id === val);
                              if (val && !hasChildren) loadGiftProductsByCategory(giftSet.localId, val);
                              else setGiftProductResults((prev) => ({ ...prev, [giftSet.localId]: [] }));
                            }} className="h-9 rounded-md border border-input bg-white px-2 text-sm flex-1 min-w-0">
                              <option value="">대분류 선택</option>
                              {categories.filter((c) => (c.depth ?? 0) === 0).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            {giftProductParentCat[giftSet.localId] && (() => {
                              const children = categories.filter((c) => (c.depth ?? 0) === 1 && c.parent_id === giftProductParentCat[giftSet.localId]);
                              return children.length > 0 ? (
                                <select value={giftProductChildCat[giftSet.localId] ?? ''} onChange={(e) => { const val = e.target.value; setGiftProductChildCat((prev) => ({ ...prev, [giftSet.localId]: val })); loadGiftProductsByCategory(giftSet.localId, val); }} className="h-9 rounded-md border border-input bg-white px-2 text-sm flex-1 min-w-0">
                                  <option value="">중분류 선택</option>
                                  {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              ) : null;
                            })()}
                          </div>
                          {(giftProductResults[giftSet.localId] || []).length > 0 && (
                            <div className="rounded-md border bg-white overflow-y-auto" style={{ maxHeight: '250px' }}>
                              {(giftProductResults[giftSet.localId] || []).map((p: any) => {
                                const alreadyAdded = giftSet.items.some((i) => i.giftProductId === p.id);
                                return (
                                  <button key={p.id} type="button" disabled={alreadyAdded || (giftSet.giftType === 'auto_specific' && giftSet.items.length >= 1 && !alreadyAdded)} onClick={() => addGiftItem(giftSet.localId, p)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm border-b last:border-b-0 hover:bg-gray-50 ${(alreadyAdded || (giftSet.giftType === 'auto_specific' && giftSet.items.length >= 1 && !alreadyAdded)) ? 'opacity-40 cursor-not-allowed bg-gray-50' : ''}`}>
                                    <span className="flex-1 truncate">{p.name}</span>
                                    <span className="text-xs text-gray-400 shrink-0">{(p.sale_price || 0).toLocaleString()}원</span>
                                    {alreadyAdded && <span className="text-xs text-green-600 shrink-0">추가됨</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>시작일시 (선택)</Label>
                      <Input type="datetime-local" value={giftSet.startsAt} onChange={(e) => updateGiftSet(giftSet.localId, { startsAt: e.target.value })} />
                    </div>
                    <div>
                      <Label>종료일시 (선택)</Label>
                      <Input type="datetime-local" value={giftSet.endsAt} onChange={(e) => updateGiftSet(giftSet.localId, { endsAt: e.target.value })} />
                    </div>
                  </div>

                  {/* 띠지 설정 */}
                  <div className="flex items-end gap-2 flex-wrap">
                    <div className="flex-1 min-w-[160px]">
                      <Label>썸네일 띠지 텍스트 <span className="text-xs font-normal text-gray-400">(최대 20자, 비우면 미표시)</span></Label>
                      <Input
                        value={giftSet.badgeText}
                        onChange={(e) => updateGiftSet(giftSet.localId, { badgeText: e.target.value.slice(0, 20) })}
                        placeholder="예: 3+1, 기획전, 증정행사"
                        maxLength={20}
                      />
                    </div>
                    <div className="shrink-0">
                      <Label>띠지 색상</Label>
                      <div className="flex items-center gap-1.5 pt-1">
                        {(['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#000000'] as string[]).map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => updateGiftSet(giftSet.localId, { badgeColor: hex })}
                            className={`h-7 w-7 rounded-full border-2 transition-transform ${giftSet.badgeColor === hex ? 'border-gray-700 scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                            style={{ backgroundColor: hex }}
                            title={hex}
                          />
                        ))}
                        <Input
                          value={giftSet.badgeColor}
                          onChange={(e) => {
                            const val = e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value;
                            updateGiftSet(giftSet.localId, { badgeColor: val });
                          }}
                          placeholder="#ef4444"
                          className="w-24 font-mono text-xs"
                          maxLength={7}
                        />
                      </div>
                    </div>
                    {giftSet.badgeText && isValidHex(giftSet.badgeColor) && (
                      <div className="shrink-0 pb-0.5">
                        <Label className="invisible">미리보기</Label>
                        <div
                          className="rounded px-3 py-1 text-xs font-bold"
                          style={{ backgroundColor: giftSet.badgeColor, color: getContrastColor(giftSet.badgeColor) }}
                        >
                          {giftSet.badgeText}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => setGiftSetDrafts((prev) => [...prev, newGiftSetDraft()])}>
                <Plus className="h-4 w-4 mr-2" />사은품 세트 추가
              </Button>
            </div>
          )}
        </Card>

        {/* ============================================= */}
        {/* 배송 설정 */}
        {/* ============================================= */}
        <Card className="overflow-hidden">
          <SectionHeader title="배송 설정" section="shipping" />
          {expandedSections.shipping && (
            <div className="p-4 space-y-4">
              <div>
                <Label>배송비 유형</Label>
                <Select defaultValue="default" onValueChange={(value: 'default' | 'free' | 'custom') => setValue('shippingType', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">기본 배송비 적용</SelectItem>
                    <SelectItem value="free">무료 배송</SelectItem>
                    <SelectItem value="custom">개별 배송비</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {shippingType === 'custom' && (
                <div>
                  <Label htmlFor="shippingFee">배송비</Label>
                  <Input id="shippingFee" type="number" {...register('shippingFee', { valueAsNumber: true })} placeholder="3000" />
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ============================================= */}
        {/* SEO 설정 */}
        {/* ============================================= */}
        <Card className="overflow-hidden">
          <SectionHeader title="SEO 설정" section="seo" />
          {expandedSections.seo && (
            <div className="p-4 space-y-4">
              <div>
                <Label htmlFor="seoTitle">SEO 제목</Label>
                <Input id="seoTitle" {...register('seoTitle')} placeholder="검색 엔진에 표시될 제목" />
              </div>
              <div>
                <Label htmlFor="seoDescription">SEO 설명</Label>
                <Textarea id="seoDescription" {...register('seoDescription')} placeholder="검색 엔진에 표시될 설명 (최대 500자)" rows={3} />
              </div>
              <div>
                <Label htmlFor="seoKeywords">SEO 키워드</Label>
                <Input id="seoKeywords" {...register('seoKeywords')} placeholder="키워드1, 키워드2, 키워드3" />
              </div>
            </div>
          )}
        </Card>

        {/* ============================================= */}
        {/* 저장 */}
        {/* ============================================= */}
        <div className="flex gap-4 sticky bottom-0 bg-white py-4 border-t">
          <Button type="submit" disabled={submitting} className="flex-1">
            {submitting ? '등록 중...' : '세트상품 등록'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/admin/products')}>취소</Button>
        </div>
      </form>
    </div>
  );
}

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
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
import {
  ArrowLeft,
  Plus,
  X,
  Upload,
  Image as ImageIcon,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { generateVariantCombinations, type VariantRow } from '@/utils/variants';
import { saveGiftSets, getGiftSetsAdmin, type GiftSetDraft, type GiftSetItemDraft, type GiftTierDraft, type GiftType } from '@/services/giftSets';
import { saveBundleItems, getBundleItems, type BundleItemDraft } from '@/services/bundles';
import { saveQuantityDiscounts, getQuantityDiscountsAdmin, type QuantityDiscountDraft } from '@/services/discounts';

// =============================================================================
// Schema
// =============================================================================

const optionValueSchema = z.object({
  value: z.string().min(1, '옵션값을 입력하세요'),
  additionalPrice: z.number().default(0),
});

const optionSchema = z.object({
  name: z.string().min(1, '옵션명을 입력하세요'),
  isRequired: z.boolean().default(true),
  values: z.array(optionValueSchema).min(1, '최소 1개의 옵션값이 필요합니다'),
});

const productSchema = z.object({
  name: z.string().min(1, '상품명을 입력해주세요'),
  slug: z.string().min(1, 'URL 슬러그를 입력해주세요').regex(/^[a-z0-9-]+$/, '영문 소문자, 숫자, 하이픈만 가능합니다'),
  summary: z.string().max(500).optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid('카테고리를 선택해주세요'),
  brandId: z.string().uuid().optional().nullable(),
  regularPrice: z.number().min(0, '정가를 입력해주세요'),
  salePrice: z.number().min(0, '판매가를 입력해주세요'),
  costPrice: z.number().min(0).optional(),
  pointRate: z.number().min(0).max(100).optional(),
  stockQuantity: z.number().int().min(0).default(0),
  stockAlertQuantity: z.number().int().min(0).default(10),
  minPurchaseQuantity: z.number().int().min(1).default(1),
  maxPurchaseQuantity: z.number().int().min(1).optional().nullable(),
  dailyPurchaseLimit: z.number().int().min(1).optional().nullable(),
  sku: z.string().optional(),
  manufacturer: z.string().optional(),
  origin: z.string().optional(),
  weight: z.number().min(0).optional(),
  status: z.enum(['draft', 'active', 'inactive']).default('active'),
  isFeatured: z.boolean().default(false),
  isNew: z.boolean().default(false),
  isBest: z.boolean().default(false),
  isSale: z.boolean().default(false),
  shippingType: z.enum(['default', 'free', 'custom']).default('default'),
  shippingFee: z.number().min(0).optional(),
  seoTitle: z.string().max(255).optional(),
  seoDescription: z.string().max(500).optional(),
  seoKeywords: z.string().max(255).optional(),
  hasOptions: z.boolean().default(false),
  options: z.array(optionSchema).optional(),
  tags: z.array(z.string()).optional(),
});

type ProductForm = z.infer<typeof productSchema>;

interface UploadedImage {
  id: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
}

// =============================================================================
// Component
// =============================================================================

export default function EditProductPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [isBundle, setIsBundle] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    price: true,
    stock: true,
    purchaseQty: true,
    options: false,
    bundleItems: true,
    qtyDiscount: false,
    giftSets: false,
    shipping: false,
    seo: false,
  });

  // 묶음상품 구성 로컬 상태
  const [bundleItemDrafts, setBundleItemDrafts] = useState<BundleItemDraft[]>([]);
  const [bundleSearchQuery, setBundleSearchQuery] = useState('');
  const [bundleSearchResults, setBundleSearchResults] = useState<any[]>([]);
  const [bundleSearchLoading, setBundleSearchLoading] = useState(false);

  async function searchBundleProducts(query: string) {
    if (!query.trim()) { setBundleSearchResults([]); return; }
    setBundleSearchLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('products')
        .select('id, name, product_type, product_images(url, is_primary)')
        .neq('product_type', 'bundle')
        .ilike('name', `%${query}%`)
        .eq('status', 'active')
        .limit(20);
      setBundleSearchResults(data || []);
    } finally {
      setBundleSearchLoading(false);
    }
  }

  function addBundleItem(product: any) {
    if (bundleItemDrafts.some((d) => d.productId === product.id)) return;
    const primaryImg = (product.product_images || []).find((i: any) => i.is_primary) || product.product_images?.[0];
    setBundleItemDrafts((prev) => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        dbId: null,
        productId: product.id,
        productName: product.name,
        productImageUrl: primaryImg?.url ?? null,
        variantId: null,
        variantLabel: null,
        quantity: 1,
      },
    ]);
    setBundleSearchQuery('');
    setBundleSearchResults([]);
  }

  function updateBundleItem(localId: string, patch: Partial<BundleItemDraft>) {
    setBundleItemDrafts((prev) => prev.map((d) => (d.localId === localId ? { ...d, ...patch } : d)));
  }

  function removeBundleItem(localId: string) {
    setBundleItemDrafts((prev) => prev.filter((d) => d.localId !== localId));
  }

  // 수량별 할인 로컬 상태
  const [qtyDiscountDrafts, setQtyDiscountDrafts] = useState<QuantityDiscountDraft[]>([]);

  function addQtyDiscount() {
    setQtyDiscountDrafts((prev) => [
      ...prev,
      { localId: crypto.randomUUID(), dbId: null, minQuantity: 1, discountType: 'percent', discountValue: 10, isActive: true },
    ]);
  }

  function updateQtyDiscount(localId: string, patch: Partial<QuantityDiscountDraft>) {
    setQtyDiscountDrafts((prev) => prev.map((d) => (d.localId === localId ? { ...d, ...patch } : d)));
  }

  function removeQtyDiscount(localId: string) {
    setQtyDiscountDrafts((prev) => prev.filter((d) => d.localId !== localId));
  }

  // 사은품 세트 로컬 상태
  const [giftSetDrafts, setGiftSetDrafts] = useState<GiftSetDraft[]>([]);
  const [giftProductParentCat, setGiftProductParentCat] = useState<Record<string, string>>({});
  const [giftProductChildCat, setGiftProductChildCat] = useState<Record<string, string>>({});
  const [giftProductResults, setGiftProductResults] = useState<Record<string, any[]>>({});

  function newGiftSetDraft(): GiftSetDraft {
    return {
      localId: crypto.randomUUID(),
      dbId: null,
      name: '',
      giftType: 'select',
      isActive: true,
      startsAt: '',
      endsAt: '',
      tiers: [],
      items: [],
    };
  }

  function updateGiftSet(localId: string, patch: Partial<GiftSetDraft>) {
    setGiftSetDrafts((prev) =>
      prev.map((s) => (s.localId === localId ? { ...s, ...patch } : s))
    );
  }

  function removeGiftSet(localId: string) {
    setGiftSetDrafts((prev) => prev.filter((s) => s.localId !== localId));
  }

  function addGiftTier(setLocalId: string) {
    const newTier: GiftTierDraft = {
      localId: crypto.randomUUID(),
      dbId: null,
      minQuantity: 1,
      freeCount: 1,
    };
    setGiftSetDrafts((prev) =>
      prev.map((s) =>
        s.localId === setLocalId ? { ...s, tiers: [...s.tiers, newTier] } : s
      )
    );
  }

  function updateGiftTier(setLocalId: string, tierLocalId: string, patch: Partial<GiftTierDraft>) {
    setGiftSetDrafts((prev) =>
      prev.map((s) =>
        s.localId === setLocalId
          ? { ...s, tiers: s.tiers.map((t) => (t.localId === tierLocalId ? { ...t, ...patch } : t)) }
          : s
      )
    );
  }

  function removeGiftTier(setLocalId: string, tierLocalId: string) {
    setGiftSetDrafts((prev) =>
      prev.map((s) =>
        s.localId === setLocalId
          ? { ...s, tiers: s.tiers.filter((t) => t.localId !== tierLocalId) }
          : s
      )
    );
  }

  function addGiftItem(setLocalId: string, product: any) {
    const img = (product.product_images || []).find((i: any) => i.is_primary) || product.product_images?.[0];
    const newItem: GiftSetItemDraft = {
      localId: crypto.randomUUID(),
      dbId: null,
      giftProductId: product.id,
      giftProductName: product.name,
      giftProductImageUrl: img?.url ?? null,
      giftProductSalePrice: product.sale_price,
    };
    setGiftSetDrafts((prev) =>
      prev.map((s) =>
        s.localId === setLocalId ? { ...s, items: [...s.items, newItem] } : s
      )
    );
    setGiftProductResults((prev) => ({ ...prev, [setLocalId]: [] }));
  }

  function removeGiftItem(setLocalId: string, itemLocalId: string) {
    setGiftSetDrafts((prev) =>
      prev.map((s) =>
        s.localId === setLocalId
          ? { ...s, items: s.items.filter((i) => i.localId !== itemLocalId) }
          : s
      )
    );
  }

  async function loadGiftProductsByCategory(setLocalId: string, categoryId: string) {
    if (!categoryId) {
      setGiftProductResults((prev) => ({ ...prev, [setLocalId]: [] }));
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from('products')
      .select('id, name, sale_price, product_images(url, is_primary)')
      .eq('status', 'active')
      .eq('category_id', categoryId)
      .order('name', { ascending: true });
    setGiftProductResults((prev) => ({ ...prev, [setLocalId]: data || [] }));
  }

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
  });

  const { fields: optionFields, append: appendOption, remove: removeOption } = useFieldArray({
    control,
    name: 'options',
  });

  const hasOptions = watch('hasOptions');
  const shippingType = watch('shippingType');
  const tags = watch('tags') || [];
  const categoryId = watch('categoryId');
  const brandId = watch('brandId');
  const status = watch('status');
  const watchedOptions = watch('options') || [];

  // =============================================================================
  // Effects
  // =============================================================================

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadCategories();
      loadBrands();
      loadProduct();
    }
  }, [user, authLoading, navigate]);

  // 옵션 변경 시 variant 조합 자동 재생성 (초기 로딩 후에만 적용)
  useEffect(() => {
    if (loading) return; // 상품 로딩 중엔 실행 안 함
    if (hasOptions && watchedOptions.length > 0) {
      setVariants((prev) => generateVariantCombinations(watchedOptions, prev));
    } else {
      setVariants([]);
    }
  }, [JSON.stringify(watchedOptions), hasOptions]);

  // =============================================================================
  // Data Loading
  // =============================================================================

  async function loadCategories() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('product_categories')
        .select('id, name, slug, parent_id, depth')
        .eq('is_visible', true)
        .order('sort_order', { ascending: true });
      if (!error) setCategories(data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }

  async function loadBrands() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('product_brands')
        .select('id, name, slug')
        .eq('is_visible', true)
        .order('name', { ascending: true });
      if (!error) setBrands(data || []);
    } catch (error) {
      console.error('Failed to load brands:', error);
    }
  }

  async function loadProduct() {
    try {
      const supabase = createClient();
      const { data: product, error } = await supabase
        .from('products')
        .select(`
          id, name, slug, summary, description,
          category_id, brand_id, sku, manufacturer, origin, weight,
          regular_price, sale_price, cost_price, point_rate,
          stock_quantity, stock_alert_quantity, min_purchase_quantity, max_purchase_quantity, daily_purchase_limit,
          status, is_featured, is_new, is_best, is_sale,
          shipping_type, shipping_fee,
          seo_title, seo_description, seo_keywords,
          has_options, tags,
          product_images(id, url, is_primary, sort_order),
          product_options(id, name, sort_order, product_option_values(id, value, additional_price, sort_order)),
          product_variants(id, sku, option_values, additional_price, stock_quantity, is_active)
        `)
        .eq('slug', slug!)
        .single();

      if (error || !product) throw new Error('상품을 찾을 수 없습니다.');

      setProductId(product.id);
      const productIsBundle = (product as any).product_type === 'bundle';
      setIsBundle(productIsBundle);

      // 묶음상품이면 구성 아이템 로드
      if (productIsBundle) {
        const existingBundleItems = await getBundleItems(product.id);
        setBundleItemDrafts(existingBundleItems.map((b) => ({
          localId: crypto.randomUUID(),
          dbId: b.id,
          productId: b.productId,
          productName: b.productName,
          productImageUrl: b.productImageUrl,
          variantId: b.variantId,
          variantLabel: b.variantLabel,
          quantity: b.quantity,
        })));
      }

      // 이미지
      const existingImages: UploadedImage[] = ((product.product_images as any[]) || [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((img) => ({
          id: img.id,
          url: img.url,
          isPrimary: img.is_primary,
          sortOrder: img.sort_order,
        }));
      setImages(existingImages);

      // 옵션
      const existingOptions = ((product.product_options as any[]) || [])
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((opt: any) => ({
          name: opt.name,
          isRequired: opt.is_required ?? true,
          values: (opt.product_option_values || [])
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((v: any) => ({ value: v.value, additionalPrice: v.additional_price ?? 0 })),
        }));

      // valueId → 텍스트값 맵 구성 (variant label 복원에 사용)
      const valueIdToText: Record<string, string> = {};
      ((product.product_options as any[]) || []).forEach((opt: any) => {
        (opt.product_option_values || []).forEach((v: any) => {
          valueIdToText[v.id] = v.value;
        });
      });

      // 기존 variant를 VariantRow 형태로 변환
      if (product.has_options && (product.product_variants as any[])?.length > 0) {
        const dbVariants: VariantRow[] = ((product.product_variants as any[]) || []).map((v: any) => {
          // option_values: [{ optionId: UUID, valueId: UUID }] → 텍스트 레이블
          const label = ((v.option_values as any[]) || [])
            .map((o: any) => valueIdToText[o.valueId] || '')
            .filter(Boolean)
            .join(' / ');
          return {
            label,
            combination: [],
            sku: v.sku || '',
            stockQuantity: v.stock_quantity,
            additionalPrice: v.additional_price ?? 0,
            isActive: v.is_active,
            minPurchaseQuantity: v.min_purchase_quantity ?? null,
            maxPurchaseQuantity: v.max_purchase_quantity ?? null,
            dailyPurchaseLimit: v.daily_purchase_limit ?? null,
          };
        });
        // label 매칭으로 기존 값 보존하면서 combination 재생성
        const regenerated = generateVariantCombinations(existingOptions, dbVariants);
        setVariants(regenerated);
      }

      reset({
        name: product.name,
        slug: product.slug,
        summary: product.summary || '',
        description: product.description || '',
        categoryId: product.category_id,
        brandId: product.brand_id || null,
        sku: product.sku || '',
        manufacturer: product.manufacturer || '',
        origin: product.origin || '',
        weight: product.weight || undefined,
        regularPrice: product.regular_price,
        salePrice: product.sale_price,
        costPrice: product.cost_price || undefined,
        pointRate: product.point_rate || undefined,
        stockQuantity: product.stock_quantity,
        stockAlertQuantity: product.stock_alert_quantity ?? 10,
        minPurchaseQuantity: product.min_purchase_quantity ?? 1,
        maxPurchaseQuantity: product.max_purchase_quantity || null,
        dailyPurchaseLimit: product.daily_purchase_limit || null,
        status: product.status as 'draft' | 'active' | 'inactive',
        isFeatured: product.is_featured,
        isNew: product.is_new,
        isBest: product.is_best,
        isSale: product.is_sale,
        shippingType: (['default', 'free', 'custom'].includes(product.shipping_type) ? product.shipping_type : 'default') as 'default' | 'free' | 'custom',
        shippingFee: product.shipping_fee || undefined,
        seoTitle: product.seo_title || '',
        seoDescription: product.seo_description || '',
        seoKeywords: product.seo_keywords || '',
        hasOptions: product.has_options,
        options: existingOptions.length > 0 ? existingOptions : [],
        tags: product.tags || [],
      });

      // 기존 수량별 할인 로드
      const existingDiscounts = await getQuantityDiscountsAdmin(product.id);
      setQtyDiscountDrafts(existingDiscounts.map((d) => ({
        localId: crypto.randomUUID(),
        dbId: d.id,
        minQuantity: d.minQuantity,
        discountType: d.discountType,
        discountValue: d.discountValue,
        isActive: d.isActive,
      })));

      // 기존 사은품 세트 로드
      const existingSets = await getGiftSetsAdmin(product.id);
      setGiftSetDrafts(existingSets.map((s) => ({
        localId: crypto.randomUUID(),
        dbId: s.id,
        name: s.name,
        giftType: s.giftType,
        isActive: s.isActive,
        startsAt: s.startsAt ?? '',
        endsAt: s.endsAt ?? '',
        tiers: s.tiers.map((t) => ({
          localId: crypto.randomUUID(),
          dbId: t.id,
          minQuantity: t.minQuantity,
          freeCount: t.freeCount,
        })),
        items: s.items.map((i) => ({
          localId: crypto.randomUUID(),
          dbId: i.id,
          giftProductId: i.giftProductId,
          giftProductName: i.giftProductName,
          giftProductImageUrl: i.giftProductImageUrl,
          giftProductSalePrice: i.giftProductSalePrice,
        })),
      })));
    } catch (error) {
      console.error('Failed to load product:', error);
      alert('상품을 불러오는 중 오류가 발생했습니다.');
      navigate('/admin/products');
    } finally {
      setLoading(false);
    }
  }

  // =============================================================================
  // Image Handling
  // =============================================================================

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

        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: publicUrlData } = supabase.storage
          .from('products')
          .getPublicUrl(filePath);

        newImages.push({
          id: `new-${Date.now()}-${i}`,
          url: publicUrlData.publicUrl,
          isPrimary: images.length === 0 && i === 0,
          sortOrder: images.length + i,
        });
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
      if (filtered.length > 0 && !filtered.some((img) => img.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    });
  }

  function setPrimaryImage(imageId: string) {
    setImages((prev) =>
      prev.map((img) => ({ ...img, isPrimary: img.id === imageId }))
    );
  }

  // =============================================================================
  // Options Handling
  // =============================================================================

  function addOption() {
    appendOption({ name: '', isRequired: true, values: [{ value: '', additionalPrice: 0 }] });
  }

  function addOptionValue(optionIndex: number) {
    const currentOptions = watch('options') || [];
    const currentOption = currentOptions[optionIndex];
    if (currentOption) {
      setValue(`options.${optionIndex}.values`, [
        ...currentOption.values,
        { value: '', additionalPrice: 0 },
      ]);
    }
  }

  function removeOptionValue(optionIndex: number, valueIndex: number) {
    const currentOptions = watch('options') || [];
    const currentOption = currentOptions[optionIndex];
    if (currentOption && currentOption.values.length > 1) {
      setValue(
        `options.${optionIndex}.values`,
        currentOption.values.filter((_, i) => i !== valueIndex)
      );
    }
  }

  function updateVariant(index: number, field: keyof VariantRow, value: any) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  }

  // =============================================================================
  // Tags Handling
  // =============================================================================

  function addTag() {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setValue('tags', [...tags, trimmed]);
      setTagInput('');
    }
  }

  function removeTag(tag: string) {
    setValue('tags', tags.filter((t) => t !== tag));
  }

  // =============================================================================
  // Section Toggle
  // =============================================================================

  function toggleSection(section: keyof typeof expandedSections) {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  // =============================================================================
  // Submit
  // =============================================================================

  async function onSubmit(data: ProductForm) {
    if (images.length === 0) {
      alert('최소 1개의 상품 이미지를 등록해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      const supabase = createClient();

      const totalStock = data.hasOptions
        ? variants.filter((v) => v.isActive).reduce((sum, v) => sum + v.stockQuantity, 0)
        : data.stockQuantity;

      // 1. 상품 기본 정보 업데이트
      const { error: productError } = await supabase
        .from('products')
        .update({
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
          stock_quantity: totalStock,
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
          has_options: data.hasOptions,
          tags: data.tags || [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId!);

      if (productError) throw productError;

      // 2. 이미지 업데이트
      await supabase.from('product_images').delete().eq('product_id', productId!);
      const { error: imageError } = await supabase.from('product_images').insert(
        images.map((img, idx) => ({
          product_id: productId!,
          url: img.url,
          is_primary: img.isPrimary,
          sort_order: idx,
        }))
      );
      if (imageError) throw imageError;

      // 3. 기존 옵션 + variant 전체 삭제 후 재생성
      await supabase.from('product_variants').delete().eq('product_id', productId!);
      await supabase.from('product_options').delete().eq('product_id', productId!);

      if (data.hasOptions && data.options && data.options.length > 0) {
        const optionIdMap: { optionIndex: number; valueIndex: number; optionId: string; valueId: string }[] = [];

        for (let i = 0; i < data.options.length; i++) {
          const option = data.options[i];
          const { data: optionData, error: optionError } = await supabase
            .from('product_options')
            .insert({ product_id: productId!, name: option.name, is_required: option.isRequired ?? true, sort_order: i })
            .select('id')
            .single();
          if (optionError) throw optionError;

          for (let j = 0; j < option.values.length; j++) {
            const { data: valueData, error: valueError } = await supabase
              .from('product_option_values')
              .insert({
                option_id: optionData.id,
                value: option.values[j].value,
                additional_price: 0,
                sort_order: j,
              })
              .select('id')
              .single();
            if (valueError) throw valueError;
            optionIdMap.push({ optionIndex: i, valueIndex: j, optionId: optionData.id, valueId: valueData.id });
          }
        }

        // variant 저장
        if (variants.length > 0) {
          const variantInserts = variants.map((variant) => {
            // valueIndex === -1은 "선택 안 함" (선택 옵션 미선택) → option_values에서 제외
            const optionValues = variant.combination
              .filter(({ valueIndex }) => valueIndex !== -1)
              .map(({ optionIndex, valueIndex }) => {
                const found = optionIdMap.find(
                  (m) => m.optionIndex === optionIndex && m.valueIndex === valueIndex
                );
                return { optionId: found?.optionId, valueId: found?.valueId };
              });
            return {
              product_id: productId!,
              sku: variant.sku || null,
              option_values: optionValues,
              additional_price: variant.additionalPrice,
              stock_quantity: variant.stockQuantity,
              is_active: variant.isActive,
              min_purchase_quantity: variant.minPurchaseQuantity || null,
              max_purchase_quantity: variant.maxPurchaseQuantity || null,
              daily_purchase_limit: variant.dailyPurchaseLimit || null,
            };
          });
          const { error: variantError } = await supabase.from('product_variants').insert(variantInserts);
          if (variantError) throw variantError;
        }
      }

      // 수량별 할인 저장
      await saveQuantityDiscounts(productId!, qtyDiscountDrafts);

      // 사은품 세트 저장
      await saveGiftSets(productId!, giftSetDrafts);

      // 묶음상품 구성 저장
      if (isBundle) {
        await saveBundleItems(productId!, bundleItemDrafts);
      }

      alert('상품이 수정되었습니다.');
      navigate('/admin/products');
    } catch (error) {
      console.error('Failed to update product:', error);
      alert(error instanceof Error ? error.message : '상품 수정 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  // =============================================================================
  // Render
  // =============================================================================

  if (authLoading || loading) {
    return <div className="p-8 text-center">로딩 중...</div>;
  }

  const SectionHeader = ({
    title,
    section,
    required,
  }: {
    title: string;
    section: keyof typeof expandedSections;
    required?: boolean;
  }) => (
    <button
      type="button"
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
    >
      <span className="font-semibold text-gray-900">
        {title}
        {required && <span className="text-red-500 ml-1">*</span>}
      </span>
      {expandedSections[section] ? (
        <ChevronUp className="h-5 w-5 text-gray-500" />
      ) : (
        <ChevronDown className="h-5 w-5 text-gray-500" />
      )}
    </button>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link
        to="/admin/products"
        className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        상품 관리로 돌아가기
      </Link>

      <h1 className="mb-8 text-2xl font-bold">상품 수정</h1>

      <form onSubmit={handleSubmit(onSubmit, (errors) => {
        console.error('Validation errors:', errors);
        const firstError = Object.values(errors)[0];
        const msg = (firstError as any)?.message || '입력값을 확인해주세요.';
        alert(`저장 실패: ${msg}`);
      })} className="space-y-6">

        {/* 이미지 업로드 */}
        <Card className="overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <span className="font-semibold text-gray-900">
              상품 이미지 <span className="text-red-500">*</span>
            </span>
          </div>
          <div className="p-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />
            <div className="flex flex-wrap gap-4">
              {images.map((image) => (
                <div
                  key={image.id}
                  className={`relative group w-32 h-32 rounded-lg overflow-hidden border-2 ${
                    image.isPrimary ? 'border-blue-500' : 'border-gray-200'
                  }`}
                >
                  <img src={image.url} alt="상품 이미지" className="w-full h-full object-cover" />
                  {image.isPrimary && (
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded">
                      대표
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {!image.isPrimary && (
                      <button
                        type="button"
                        onClick={() => setPrimaryImage(image.id)}
                        className="p-1.5 bg-white rounded-full text-blue-600 hover:bg-blue-50"
                        title="대표 이미지로 설정"
                      >
                        <ImageIcon className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(image.id)}
                      className="p-1.5 bg-white rounded-full text-red-600 hover:bg-red-50"
                      title="삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImages}
                className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors disabled:opacity-50"
              >
                {uploadingImages ? (
                  <span className="text-sm">업로드 중...</span>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mb-2" />
                    <span className="text-xs">이미지 추가</span>
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              첫 번째 이미지가 대표 이미지로 설정됩니다. 클릭하여 대표 이미지를 변경할 수 있습니다.
            </p>
          </div>
        </Card>

        {/* 기본 정보 */}
        <Card className="overflow-hidden">
          <SectionHeader title="기본 정보" section="basic" required />
          {expandedSections.basic && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">상품명 <span className="text-red-500">*</span></Label>
                  <Input id="name" {...register('name')} placeholder="상품명을 입력해주세요" />
                  {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
                </div>
                <div>
                  <Label htmlFor="slug">URL 슬러그 <span className="text-red-500">*</span></Label>
                  <Input id="slug" {...register('slug')} placeholder="product-slug" />
                  {errors.slug && <p className="mt-1 text-sm text-red-500">{errors.slug.message}</p>}
                </div>
                <div>
                  <Label htmlFor="sku">SKU (품목코드)</Label>
                  <Input id="sku" {...register('sku')} placeholder="SKU-001" />
                </div>
              </div>

              <div>
                <Label htmlFor="summary">요약 설명</Label>
                <Input id="summary" {...register('summary')} placeholder="상품 한 줄 요약" />
              </div>

              <div>
                <Label htmlFor="description">상세 설명</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder="상품 상세 설명을 입력해주세요"
                  rows={6}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="categoryId">카테고리 <span className="text-red-500">*</span></Label>
                  <Select
                    value={categoryId || ''}
                    onValueChange={(value) => setValue('categoryId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="카테고리 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {'─'.repeat(category.depth || 0)} {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.categoryId && (
                    <p className="mt-1 text-sm text-red-500">{errors.categoryId.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="brandId">브랜드</Label>
                  <Select
                    value={brandId || ''}
                    onValueChange={(value) => setValue('brandId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="브랜드 선택 (선택사항)" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </SelectItem>
                      ))}
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
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  {...register('weight', { valueAsNumber: true })}
                  placeholder="0.5"
                />
              </div>

              {/* 태그 */}
              <div>
                <Label>태그</Label>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="태그 입력 후 Enter"
                  />
                  <Button type="button" variant="outline" onClick={addTag}>추가</Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-sm"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="text-gray-500 hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 표시 설정 */}
              <div>
                <Label>표시 설정</Label>
                <div className="flex flex-wrap gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...register('isNew')} className="rounded" />
                    <span className="text-sm">신상품</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...register('isBest')} className="rounded" />
                    <span className="text-sm">베스트</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...register('isFeatured')} className="rounded" />
                    <span className="text-sm">추천상품</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...register('isSale')} className="rounded" />
                    <span className="text-sm">세일</span>
                  </label>
                </div>
              </div>

              <div>
                <Label htmlFor="status">상태</Label>
                <Select
                  value={status || 'active'}
                  onValueChange={(value: 'draft' | 'active' | 'inactive') => setValue('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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

        {/* 가격 정보 */}
        <Card className="overflow-hidden">
          <SectionHeader title="가격 정보" section="price" required />
          {expandedSections.price && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="regularPrice">정가 <span className="text-red-500">*</span></Label>
                  <Input
                    id="regularPrice"
                    type="number"
                    {...register('regularPrice', { valueAsNumber: true })}
                    placeholder="0"
                  />
                  {errors.regularPrice && (
                    <p className="mt-1 text-sm text-red-500">{errors.regularPrice.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="salePrice">판매가 <span className="text-red-500">*</span></Label>
                  <Input
                    id="salePrice"
                    type="number"
                    {...register('salePrice', { valueAsNumber: true })}
                    placeholder="0"
                  />
                  {errors.salePrice && (
                    <p className="mt-1 text-sm text-red-500">{errors.salePrice.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="costPrice">원가 (선택)</Label>
                  <Input
                    id="costPrice"
                    type="number"
                    {...register('costPrice', { valueAsNumber: true })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="pointRate">적립률 (%)</Label>
                  <Input
                    id="pointRate"
                    type="number"
                    step="0.1"
                    {...register('pointRate', { valueAsNumber: true })}
                    placeholder="1.0"
                  />
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* 재고 정보 */}
        <Card className="overflow-hidden">
          <SectionHeader title="재고 정보" section="stock" required />
          {expandedSections.stock && (
            <div className="p-4 space-y-4">
              {hasOptions ? (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
                  옵션 사용 시 재고는 아래 <strong>옵션 섹션</strong>의 각 조합별로 관리됩니다.
                </div>
              ) : (
                <div>
                  <Label htmlFor="stockQuantity">재고 수량 <span className="text-red-500">*</span></Label>
                  <Input
                    id="stockQuantity"
                    type="number"
                    {...register('stockQuantity', { valueAsNumber: true })}
                    placeholder="0"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="stockAlertQuantity">재고 알림 수량</Label>
                  <Input
                    id="stockAlertQuantity"
                    type="number"
                    {...register('stockAlertQuantity', { valueAsNumber: true })}
                    placeholder="10"
                  />
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* 구성 상품 설정 (세트상품 전용) */}
        {isBundle && (
          <Card className="overflow-hidden">
            <SectionHeader title="구성 상품 설정" section="bundleItems" />
            {expandedSections.bundleItems && (
              <div className="p-4 space-y-4">
                <p className="text-sm text-gray-500">세트에 포함할 상품을 검색하여 추가하세요.</p>
                <div className="flex gap-2">
                  <Input
                    value={bundleSearchQuery}
                    onChange={(e) => setBundleSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchBundleProducts(bundleSearchQuery); }}}
                    placeholder="상품명으로 검색"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={() => searchBundleProducts(bundleSearchQuery)} disabled={bundleSearchLoading}>
                    {bundleSearchLoading ? '검색 중...' : '검색'}
                  </Button>
                </div>
                {bundleSearchResults.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {bundleSearchResults.map((p) => {
                      const alreadyAdded = bundleItemDrafts.some((d) => d.productId === p.id);
                      const primaryImg = (p.product_images || []).find((i: any) => i.is_primary) || p.product_images?.[0];
                      return (
                        <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                          {primaryImg && <img src={primaryImg.url} className="h-8 w-8 rounded object-cover" />}
                          <span className="flex-1 text-sm">{p.name}</span>
                          <Button type="button" size="sm" variant="outline" disabled={alreadyAdded} onClick={() => addBundleItem(p)}>
                            {alreadyAdded ? '추가됨' : '추가'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {bundleItemDrafts.length > 0 && (
                  <div className="border rounded-lg divide-y">
                    {bundleItemDrafts.map((item) => (
                      <div key={item.localId} className="flex items-center gap-3 px-3 py-2">
                        {item.productImageUrl && <img src={item.productImageUrl} className="h-8 w-8 rounded object-cover" />}
                        <span className="flex-1 text-sm font-medium">{item.productName}</span>
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-gray-500">수량</Label>
                          <Input
                            type="number" min={1}
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
                )}
                {bundleItemDrafts.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">구성 상품이 없습니다.</p>
                )}
              </div>
            )}
          </Card>
        )}

        {/* 상품 옵션 (단일상품 전용) */}
        {!isBundle && <Card className="overflow-hidden">
          <SectionHeader title="상품 옵션" section="options" />
          {expandedSections.options && (
            <div className="p-4 space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('hasOptions')} className="rounded" />
                <span className="text-sm font-medium">옵션 사용</span>
              </label>
              {hasOptions && (
                <div className="space-y-4">
                  {optionFields.map((field, optionIndex) => (
                    <div key={field.id} className="p-4 border rounded-lg bg-gray-50">
                      <div className="flex items-center gap-2 mb-3">
                        <GripVertical className="h-4 w-4 text-gray-400" />
                        <Input
                          {...register(`options.${optionIndex}.name`)}
                          placeholder="옵션명 (예: 색상, 사이즈)"
                          className="flex-1"
                        />
                        <label className="flex items-center gap-1 text-sm whitespace-nowrap cursor-pointer">
                          <input
                            type="checkbox"
                            {...register(`options.${optionIndex}.isRequired`)}
                            className="rounded"
                          />
                          필수
                        </label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeOption(optionIndex)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                      <div className="space-y-2 pl-6">
                        {(watch(`options.${optionIndex}.values`) || []).map((_, valueIndex) => (
                          <div key={valueIndex} className="flex items-center gap-2">
                            <Input
                              {...register(`options.${optionIndex}.values.${valueIndex}.value`)}
                              placeholder="옵션값 (예: 빨강, L)"
                              className="flex-1"
                            />
                            <Button
                              type="button" variant="ghost" size="sm"
                              onClick={() => removeOptionValue(optionIndex, valueIndex)}
                              disabled={(watch(`options.${optionIndex}.values`) || []).length <= 1}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={() => addOptionValue(optionIndex)}>
                          <Plus className="h-4 w-4 mr-1" />옵션값 추가
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={addOption}>
                    <Plus className="h-4 w-4 mr-2" />옵션 추가
                  </Button>

                  {/* variant 재고 테이블 */}
                  {variants.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        조합별 재고 관리 ({variants.length}개 조합)
                      </p>
                      <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium text-gray-600">옵션 조합</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-600 w-32">SKU</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-600 w-24">추가금액</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-600 w-20">재고</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-600 w-20">최소수량</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-600 w-20">최대수량</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-600 w-20">1일제한</th>
                              <th className="text-center px-3 py-2 font-medium text-gray-600 w-16">활성</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {variants.map((variant, idx) => (
                              <tr key={idx} className={!variant.isActive ? 'opacity-40' : ''}>
                                <td className="px-3 py-2 font-medium">{variant.label}</td>
                                <td className="px-3 py-2">
                                  <Input value={variant.sku} onChange={(e) => updateVariant(idx, 'sku', e.target.value)} placeholder="SKU-001" className="h-8 text-sm" />
                                </td>
                                <td className="px-3 py-2">
                                  <Input type="number" value={variant.additionalPrice} onChange={(e) => updateVariant(idx, 'additionalPrice', Number(e.target.value))} placeholder="0" className="h-8 text-sm" />
                                </td>
                                <td className="px-3 py-2">
                                  <Input type="number" value={variant.stockQuantity} onChange={(e) => updateVariant(idx, 'stockQuantity', Number(e.target.value))} placeholder="0" className="h-8 text-sm" />
                                </td>
                                <td className="px-3 py-2">
                                  <Input type="number" value={variant.minPurchaseQuantity ?? ''} onChange={(e) => updateVariant(idx, 'minPurchaseQuantity', e.target.value ? Number(e.target.value) : null)} placeholder="-" min={1} className="h-8 text-sm" />
                                </td>
                                <td className="px-3 py-2">
                                  <Input type="number" value={variant.maxPurchaseQuantity ?? ''} onChange={(e) => updateVariant(idx, 'maxPurchaseQuantity', e.target.value ? Number(e.target.value) : null)} placeholder="-" min={1} className="h-8 text-sm" />
                                </td>
                                <td className="px-3 py-2">
                                  <Input type="number" value={variant.dailyPurchaseLimit ?? ''} onChange={(e) => updateVariant(idx, 'dailyPurchaseLimit', e.target.value ? Number(e.target.value) : null)} placeholder="-" min={1} className="h-8 text-sm" />
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <input type="checkbox" checked={variant.isActive} onChange={(e) => updateVariant(idx, 'isActive', e.target.checked)} className="rounded" />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 border-t">
                            <tr>
                              <td colSpan={3} className="px-3 py-2 text-sm text-gray-500">총 재고</td>
                              <td className="px-3 py-2 font-bold text-sm">
                                {variants.filter((v) => v.isActive).reduce((s, v) => s + v.stockQuantity, 0)}
                              </td>
                              <td colSpan={4} />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>}

        {/* 사은품 설정 */}
        <Card className="overflow-hidden">
          <SectionHeader title="사은품 설정" section="giftSets" />
          {expandedSections.giftSets && (
            <div className="p-4 space-y-4">
              {giftSetDrafts.map((giftSet) => (
                <div key={giftSet.localId} className="rounded-lg border border-gray-200 p-4 space-y-4 bg-gray-50">
                  {/* 세트명 + 증정유형 + 활성 + 삭제 */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <Label>세트명</Label>
                      <Input
                        value={giftSet.name}
                        onChange={(e) => updateGiftSet(giftSet.localId, { name: e.target.value })}
                        placeholder="예: 3+1 사은품 이벤트"
                      />
                    </div>
                    <div className="w-44">
                      <Label>증정 유형</Label>
                      <select
                        value={giftSet.giftType}
                        onChange={(e) => updateGiftSet(giftSet.localId, { giftType: e.target.value as GiftType, items: [] })}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="select">고객 선택</option>
                        <option value="auto_same">동일상품 자동</option>
                        <option value="auto_specific">특정상품 자동</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <label className="flex items-center gap-1 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={giftSet.isActive}
                          onChange={(e) => updateGiftSet(giftSet.localId, { isActive: e.target.checked })}
                          className="rounded"
                        />
                        활성
                      </label>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeGiftSet(giftSet.localId)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  {/* 사은품 구간 (tier) */}
                  <div>
                    <Label>사은품 구간</Label>
                    <p className="mb-2 text-xs text-gray-500">
                      {giftSet.giftType === 'select'
                        ? '구매 수량에 따라 고객이 선택 가능한 사은품 개수를 설정합니다.'
                        : '구매 수량에 따라 자동으로 증정될 사은품 개수를 설정합니다.'}
                    </p>
                    <div className="space-y-2">
                      {giftSet.tiers.map((tier) => (
                        <div key={tier.localId} className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 whitespace-nowrap">구매</span>
                          <Input
                            type="number"
                            min={1}
                            value={tier.minQuantity}
                            onChange={(e) => updateGiftTier(giftSet.localId, tier.localId, { minQuantity: Number(e.target.value) || 1 })}
                            className="w-20"
                          />
                          <span className="text-sm text-gray-600 whitespace-nowrap">개 이상 →</span>
                          <Input
                            type="number"
                            min={1}
                            value={tier.freeCount}
                            onChange={(e) => updateGiftTier(giftSet.localId, tier.localId, { freeCount: Number(e.target.value) || 1 })}
                            className="w-20"
                          />
                          <span className="text-sm text-gray-600 whitespace-nowrap">개 선택 가능</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeGiftTier(giftSet.localId, tier.localId)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addGiftTier(giftSet.localId)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        구간 추가
                      </Button>
                    </div>
                  </div>

                  {/* 사은품 풀 — auto_same이면 숨김 */}
                  {giftSet.giftType === 'auto_same' ? (
                    <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
                      구매 수량 충족 시 <strong>구매한 상품과 동일한 상품</strong>이 자동으로 증정됩니다.
                    </div>
                  ) : (
                  <div>
                    <Label>
                      {giftSet.giftType === 'auto_specific' ? '증정 상품 (1개 선택)' : '사은품 상품 목록'}
                    </Label>
                    <p className="mb-2 text-xs text-gray-500">
                      {giftSet.giftType === 'auto_specific'
                        ? '구매 수량 충족 시 자동으로 증정할 특정 상품 1개를 등록합니다.'
                        : '고객이 선택할 수 있는 사은품 상품을 등록합니다. (실제 가격과 무관하게 0원 처리)'}
                    </p>
                    <div className="space-y-2">
                      {giftSet.items.map((item) => (
                        <div key={item.localId} className="flex items-center gap-2 rounded border bg-white p-2">
                          {item.giftProductImageUrl && (
                            <img src={item.giftProductImageUrl} alt={item.giftProductName} className="h-8 w-8 rounded object-cover flex-shrink-0" />
                          )}
                          <span className="flex-1 text-sm truncate">{item.giftProductName}</span>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {item.giftProductSalePrice.toLocaleString()}원 → <span className="text-blue-600 font-medium">0원</span>
                          </span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeGiftItem(giftSet.localId, item.localId)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {/* 카테고리 선택으로 상품 추가 */}
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          {/* 대분류 */}
                          <select
                            value={giftProductParentCat[giftSet.localId] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setGiftProductParentCat((prev) => ({ ...prev, [giftSet.localId]: val }));
                              setGiftProductChildCat((prev) => ({ ...prev, [giftSet.localId]: '' }));
                              const hasChildren = categories.some(
                                (c) => (c.depth ?? 0) === 1 && c.parent_id === val
                              );
                              if (val && !hasChildren) {
                                loadGiftProductsByCategory(giftSet.localId, val);
                              } else {
                                setGiftProductResults((prev) => ({ ...prev, [giftSet.localId]: [] }));
                              }
                            }}
                            className="h-9 rounded-md border border-input bg-white px-2 text-sm flex-1 min-w-0"
                          >
                            <option value="">대분류 선택</option>
                            {categories.filter((c) => (c.depth ?? 0) === 0).map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          {/* 중분류 */}
                          {giftProductParentCat[giftSet.localId] && (() => {
                            const children = categories.filter(
                              (c) => (c.depth ?? 0) === 1 && c.parent_id === giftProductParentCat[giftSet.localId]
                            );
                            return children.length > 0 ? (
                              <select
                                value={giftProductChildCat[giftSet.localId] ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setGiftProductChildCat((prev) => ({ ...prev, [giftSet.localId]: val }));
                                  loadGiftProductsByCategory(giftSet.localId, val);
                                }}
                                className="h-9 rounded-md border border-input bg-white px-2 text-sm flex-1 min-w-0"
                              >
                                <option value="">중분류 선택</option>
                                {children.map((c) => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            ) : null;
                          })()}
                        </div>
                        {/* 상품 목록 */}
                        {(giftProductResults[giftSet.localId] || []).length > 0 && (
                          <div className="rounded-md border bg-white overflow-y-auto" style={{ maxHeight: '250px' }}>
                            {(giftProductResults[giftSet.localId] || []).map((p: any) => {
                              const alreadyAdded = giftSet.items.some((i) => i.giftProductId === p.id);
                              return (
                                <button
                                  key={p.id} type="button"
                                  disabled={alreadyAdded || (giftSet.giftType === 'auto_specific' && giftSet.items.length >= 1 && !alreadyAdded)}
                                  onClick={() => addGiftItem(giftSet.localId, p)}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm border-b last:border-b-0 hover:bg-gray-50 ${(alreadyAdded || (giftSet.giftType === 'auto_specific' && giftSet.items.length >= 1 && !alreadyAdded)) ? 'opacity-40 cursor-not-allowed bg-gray-50' : ''}`}
                                >
                                  <span className="flex-1 truncate">{p.name}</span>
                                  <span className="text-xs text-gray-400 shrink-0">{(p.sale_price || 0).toLocaleString()}원</span>
                                  {alreadyAdded && <span className="text-xs text-green-600 shrink-0">추가됨</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {giftProductParentCat[giftSet.localId] && (giftProductResults[giftSet.localId] || []).length === 0 && (() => {
                          const hasChildren = categories.some(
                            (c) => (c.depth ?? 0) === 1 && c.parent_id === giftProductParentCat[giftSet.localId]
                          );
                          const childSelected = !!giftProductChildCat[giftSet.localId];
                          return (!hasChildren || childSelected) ? (
                            <p className="text-xs text-gray-400 py-1">해당 카테고리에 상품이 없습니다.</p>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  </div>
                  )}

                  {/* 기간 설정 */}
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
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => setGiftSetDrafts((prev) => [...prev, newGiftSetDraft()])}>
                <Plus className="h-4 w-4 mr-2" />
                사은품 세트 추가
              </Button>
            </div>
          )}
        </Card>

        {/* 구매 수량 설정 */}
        <Card className="overflow-hidden">
          <SectionHeader title="구매 수량 설정" section="purchaseQty" />
          {expandedSections.purchaseQty && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minPurchaseQuantity">최소 구매 수량</Label>
                  <Input
                    id="minPurchaseQuantity"
                    type="number"
                    min={1}
                    {...register('minPurchaseQuantity', { valueAsNumber: true })}
                    placeholder="1"
                  />
                  <p className="mt-1 text-xs text-gray-500">1회 주문 시 최소 구매 수량</p>
                </div>
                <div>
                  <Label htmlFor="maxPurchaseQuantity">최대 구매 수량 (선택)</Label>
                  <Input
                    id="maxPurchaseQuantity"
                    type="number"
                    min={1}
                    {...register('maxPurchaseQuantity', { valueAsNumber: true })}
                    placeholder="제한 없음"
                  />
                  <p className="mt-1 text-xs text-gray-500">1회 주문 시 최대 구매 수량</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="max-w-xs">
                  <Label htmlFor="dailyPurchaseLimit">1일 최대 구매 수량 (선택)</Label>
                  <Input
                    id="dailyPurchaseLimit"
                    type="number"
                    min={1}
                    {...register('dailyPurchaseLimit', { valueAsNumber: true })}
                    placeholder="제한 없음"
                  />
                  <p className="mt-1 text-xs text-gray-500">동일 계정이 하루에 구매할 수 있는 최대 수량</p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* 수량별 할인 설정 */}
        <Card className="overflow-hidden">
          <SectionHeader title="수량별 할인 설정" section="qtyDiscount" />
          {expandedSections.qtyDiscount && (
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-500">
                구매 수량에 따라 단가를 할인합니다. 여러 구간을 추가하면 해당 수량에서 가장 높은 구간이 자동 적용됩니다.
              </p>
              {qtyDiscountDrafts.map((draft) => (
                <div key={draft.localId} className="flex items-center gap-2 rounded-lg border bg-gray-50 p-3">
                  <span className="text-sm text-gray-600 whitespace-nowrap">구매</span>
                  <Input
                    type="number"
                    min={1}
                    value={draft.minQuantity}
                    onChange={(e) => updateQtyDiscount(draft.localId, { minQuantity: Number(e.target.value) || 1 })}
                    className="w-20"
                  />
                  <span className="text-sm text-gray-600 whitespace-nowrap">개 이상 →</span>
                  <Input
                    type="number"
                    min={1}
                    value={draft.discountValue}
                    onChange={(e) => updateQtyDiscount(draft.localId, { discountValue: Number(e.target.value) || 1 })}
                    className="w-20"
                  />
                  <select
                    value={draft.discountType}
                    onChange={(e) => updateQtyDiscount(draft.localId, { discountType: e.target.value as 'percent' | 'fixed' })}
                    className="h-9 rounded-md border border-input bg-white px-2 text-sm"
                  >
                    <option value="percent">% 할인</option>
                    <option value="fixed">원 할인</option>
                  </select>
                  <label className="flex items-center gap-1 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(e) => updateQtyDiscount(draft.localId, { isActive: e.target.checked })}
                      className="rounded"
                    />
                    활성
                  </label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeQtyDiscount(draft.localId)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addQtyDiscount}>
                <Plus className="h-3 w-3 mr-1" />
                구간 추가
              </Button>
            </div>
          )}
        </Card>

        {/* 배송 설정 */}
        <Card className="overflow-hidden">
          <SectionHeader title="배송 설정" section="shipping" />
          {expandedSections.shipping && (
            <div className="p-4 space-y-4">
              <div>
                <Label>배송비 유형</Label>
                <Select
                  value={shippingType || 'default'}
                  onValueChange={(value: 'default' | 'free' | 'custom') => setValue('shippingType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                  <Input
                    id="shippingFee"
                    type="number"
                    {...register('shippingFee', { valueAsNumber: true })}
                    placeholder="3000"
                  />
                </div>
              )}
            </div>
          )}
        </Card>

        {/* SEO 설정 */}
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
                <Textarea
                  id="seoDescription"
                  {...register('seoDescription')}
                  placeholder="검색 엔진에 표시될 설명 (최대 500자)"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="seoKeywords">SEO 키워드</Label>
                <Input
                  id="seoKeywords"
                  {...register('seoKeywords')}
                  placeholder="키워드1, 키워드2, 키워드3"
                />
              </div>
            </div>
          )}
        </Card>

        {/* 저장 버튼 */}
        <div className="flex gap-4 sticky bottom-0 bg-white py-4 border-t">
          <Button type="submit" disabled={submitting} className="flex-1">
            {submitting ? '수정 중...' : '수정하기'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            취소
          </Button>
        </div>

      </form>
    </div>
  );
}

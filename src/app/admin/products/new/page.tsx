import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { saveGiftSets, type GiftSetDraft, type GiftSetItemDraft, type GiftTierDraft, type GiftType } from '@/services/giftSets';
import { getContrastColor, isValidHex } from '@/lib/utils';
import { saveBundleItems, syncBundleStock, type BundleItemDraft } from '@/services/bundles';
import { saveQuantityDiscounts, type QuantityDiscountDraft } from '@/services/discounts';

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
  // 기본 정보
  name: z.string().min(1, '상품명을 입력해주세요'),
  slug: z.string().min(1, 'URL 슬러그를 입력해주세요').regex(/^[a-z0-9-]+$/, '영문 소문자, 숫자, 하이픈만 가능합니다'),
  summary: z.string().max(500).optional(),
  description: z.string().optional(),
  bundleDescription: z.string().optional(),
  categoryId: z.string().uuid('카테고리를 선택해주세요'),
  brandId: z.string().uuid().optional().nullable(),

  // 가격
  regularPrice: z.number().min(0, '정가를 입력해주세요'),
  salePrice: z.number().min(0, '판매가를 입력해주세요'),
  costPrice: z.preprocess((v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && isNaN(v)) ? undefined : Number(v)), z.number().min(0).optional()),
  pointRate: z.preprocess((v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && isNaN(v)) ? undefined : Number(v)), z.number().min(0).max(100).optional()),

  // 재고 (옵션 없는 상품만 필수, 옵션 있으면 variant에서 관리)
  stockQuantity: z.number().int().min(0).default(0),
  stockAlertQuantity: z.number().int().min(0).default(10),

  // 구매 수량 설정
  minPurchaseQuantity: z.number().int().min(1).default(1),
  maxPurchaseQuantity: z.number().int().min(1).optional().nullable(),
  dailyPurchaseLimit: z.number().int().min(1).optional().nullable(),

  // 상품 정보
  sku: z.string().optional(),
  manufacturer: z.string().optional(),
  origin: z.string().optional(),
  weight: z.preprocess((v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && isNaN(v)) ? undefined : Number(v)), z.number().min(0).optional()),

  // 표시 설정
  status: z.enum(['draft', 'active', 'inactive']).default('active'),
  isFeatured: z.boolean().default(false),
  isNew: z.boolean().default(false),
  isBest: z.boolean().default(false),
  isSale: z.boolean().default(false),

  // 배송
  shippingType: z.enum(['default', 'free', 'custom']).default('default'),
  shippingFee: z.number().min(0).optional(),
  shippingNotice: z.string().optional(),
  returnNotice: z.string().optional(),

  // SEO
  seoTitle: z.string().max(255).optional(),
  seoDescription: z.string().max(500).optional(),
  seoKeywords: z.string().max(255).optional(),

  // 옵션
  hasOptions: z.boolean().default(false),
  options: z.array(optionSchema).optional(),

  // 태그
  tags: z.array(z.string()).optional(),

  // 재고 표시 설정
  showStock: z.boolean().default(true),
  showGiftStock: z.boolean().default(true),
});

type ProductForm = z.infer<typeof productSchema>;

interface UploadedImage {
  id: string;
  url: string;
  file?: File;
  isPrimary: boolean;
  sortOrder: number;
}

// =============================================================================
// Component
// =============================================================================

export default function NewProductPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isBundle = searchParams.get('type') === 'bundle';
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedRootCat, setSelectedRootCat] = useState('');
  const [brands, setBrands] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [variants, setVariants] = useState<VariantRow[]>([]);
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
      badgeText: '',
      badgeColor: '#ef4444',
      hideWhenSoldout: false,
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
        s.localId === setLocalId
          ? { ...s, items: [...s.items, newItem] }
          : s
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
    control,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      slug: String(Math.floor(Date.now() / 1000)),
      status: 'active',
      hasOptions: false,
      shippingType: 'default',
      stockAlertQuantity: 10,
      minPurchaseQuantity: 1,
      isFeatured: false,
      isNew: false,
      isBest: false,
      isSale: false,
      options: [],
      tags: [],
    },
  });

  const { fields: optionFields, append: appendOption, remove: removeOption } = useFieldArray({
    control,
    name: 'options',
  });

  const hasOptions = watch('hasOptions');
  const shippingType = watch('shippingType');
  const tags = watch('tags') || [];
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
    }
  }, [user, authLoading, navigate]);

  // 옵션 항목이 모두 삭제되면 hasOptions 자동 해제
  useEffect(() => {
    if (optionFields.length === 0 && hasOptions) {
      setValue('hasOptions', false);
    }
  }, [optionFields.length]);

  // 옵션 변경 시 variant 조합 자동 재생성
  useEffect(() => {
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

      if (!error) {
        setCategories(data || []);
      }
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

      if (!error) {
        setBrands(data || []);
      }
    } catch (error) {
      console.error('Failed to load brands:', error);
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
          id: `temp-${Date.now()}-${i}`,
          url: publicUrlData.publicUrl,
          file,
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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function removeImage(imageId: string) {
    setImages((prev) => {
      const filtered = prev.filter((img) => img.id !== imageId);
      // 대표 이미지가 삭제되면 첫 번째 이미지를 대표로
      if (filtered.length > 0 && !filtered.some((img) => img.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    });
  }

  function setPrimaryImage(imageId: string) {
    setImages((prev) =>
      prev.map((img) => ({
        ...img,
        isPrimary: img.id === imageId,
      }))
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

      // 옵션 있는 경우 variant 재고 합산, 없으면 폼 입력값 사용
      const totalStock = data.hasOptions
        ? variants.filter((v) => v.isActive).reduce((sum, v) => sum + v.stockQuantity, 0)
        : data.stockQuantity;

      // 1. 상품 생성
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          name: data.name,
          slug: data.slug,
          summary: data.summary || null,
          description: data.description || null,
          bundle_description: isBundle ? (data.bundleDescription || null) : null,
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
          shipping_notice: data.shippingNotice || null,
          return_notice: data.returnNotice || null,
          seo_title: data.seoTitle || null,
          seo_description: data.seoDescription || null,
          seo_keywords: data.seoKeywords || null,
          has_options: isBundle ? false : data.hasOptions,
          product_type: isBundle ? 'bundle' : 'single',
          show_stock: data.showStock,
          show_gift_stock: data.showGiftStock,
          tags: data.tags || [],
        })
        .select('id')
        .single();

      if (productError) throw productError;

      const productId = product.id;

      // 2. 이미지 저장
      const imageInserts = images.map((img, idx) => ({
        product_id: productId,
        url: img.url,
        is_primary: img.isPrimary,
        sort_order: idx,
      }));

      const { error: imageError } = await supabase
        .from('product_images')
        .insert(imageInserts);

      if (imageError) throw imageError;

      // 3. 옵션 + variant 저장
      if (data.hasOptions && data.options && data.options.length > 0) {
        // 옵션 정의 저장 후 ID 수집
        const optionIdMap: { optionIndex: number; valueIndex: number; optionId: string; valueId: string }[] = [];

        for (let i = 0; i < data.options.length; i++) {
          const option = data.options[i];

          const { data: optionData, error: optionError } = await supabase
            .from('product_options')
            .insert({ product_id: productId, name: option.name, is_required: option.isRequired ?? true, sort_order: i })
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

        // variant 저장 (각 조합별 SKU, 재고)
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
              product_id: productId,
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

          const { error: variantError } = await supabase
            .from('product_variants')
            .insert(variantInserts);

          if (variantError) throw variantError;
        }
      }

      // 4. 태그 저장 (별도 테이블)
      if (data.tags && data.tags.length > 0) {
        const tagInserts = data.tags.map((tag) => ({
          product_id: productId,
          tag,
        }));

        await supabase.from('product_tags').insert(tagInserts);
      }

      // 5. 수량별 할인 저장
      await saveQuantityDiscounts(productId, qtyDiscountDrafts);

      // 6. 사은품 세트 저장
      if (giftSetDrafts.length > 0) {
        await saveGiftSets(productId, giftSetDrafts);
      }

      // 7. 묶음상품 구성 저장 + 실효 재고 동기화
      if (isBundle && bundleItemDrafts.length > 0) {
        await saveBundleItems(productId, bundleItemDrafts);
        await syncBundleStock(productId);
      }

      alert('상품이 등록되었습니다.');
      navigate('/admin/products');
    } catch (error) {
      console.error('Failed to create product:', error);
      alert(error instanceof Error ? error.message : '상품 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  // =============================================================================
  // Render
  // =============================================================================

  if (authLoading) {
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

      <h1 className="mb-8 text-2xl font-bold">{isBundle ? '세트상품 등록' : '상품 등록'}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ============================================= */}
        {/* 이미지 업로드 */}
        {/* ============================================= */}
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
              {/* 업로드된 이미지들 */}
              {images.map((image) => (
                <div
                  key={image.id}
                  className={`relative group w-32 h-32 rounded-lg overflow-hidden border-2 ${
                    image.isPrimary ? 'border-blue-500' : 'border-gray-200'
                  }`}
                >
                  <img
                    src={image.url}
                    alt="상품 이미지"
                    className="w-full h-full object-cover"
                  />
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

              {/* 업로드 버튼 */}
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

        {/* ============================================= */}
        {/* 기본 정보 */}
        {/* ============================================= */}
        <Card className="overflow-hidden">
          <SectionHeader title="기본 정보" section="basic" required />
          {expandedSections.basic && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">
                    상품명 <span className="text-red-500">*</span>
                  </Label>
                  <Input id="name" {...register('name')} placeholder="상품명을 입력해주세요" />
                  {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
                </div>

                <div>
                  <Label htmlFor="slug">
                    URL 슬러그 <span className="text-red-500">*</span>
                  </Label>
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
                  <Label>카테고리 <span className="text-red-500">*</span></Label>
                  <div className="flex gap-2 mt-1">
                    {/* 상위 카테고리 */}
                    <Select
                      value={selectedRootCat}
                      onValueChange={(rootId) => {
                        setSelectedRootCat(rootId);
                        const hasSub = categories.some(c => c.parent_id === rootId);
                        setValue('categoryId', hasSub ? '' : rootId, { shouldValidate: true });
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="상위 카테고리" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.filter(c => !c.parent_id).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* 하위 카테고리 (상위 선택 후 하위가 있을 때만) */}
                    {selectedRootCat && categories.some(c => c.parent_id === selectedRootCat) && (
                      <Select
                        value={watch('categoryId') || ''}
                        onValueChange={(subId) => setValue('categoryId', subId, { shouldValidate: true })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="하위 카테고리" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.filter(c => c.parent_id === selectedRootCat).map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  {errors.categoryId && (
                    <p className="mt-1 text-sm text-red-500">{errors.categoryId.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="brandId">브랜드</Label>
                  <Select value={watch('brandId') || ''} onValueChange={(value) => setValue('brandId', value)}>
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
                  <Button type="button" variant="outline" onClick={addTag}>
                    추가
                  </Button>
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
                  defaultValue="draft"
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

        {/* ============================================= */}
        {/* 가격 정보 */}
        {/* ============================================= */}
        <Card className="overflow-hidden">
          <SectionHeader title="가격 정보" section="price" required />
          {expandedSections.price && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="regularPrice">
                    정가 <span className="text-red-500">*</span>
                  </Label>
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
                  <Label htmlFor="salePrice">
                    판매가 <span className="text-red-500">*</span>
                  </Label>
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

        {/* ============================================= */}
        {/* 재고 정보 */}
        {/* ============================================= */}
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
                  <Label htmlFor="stockQuantity">
                    재고 수량 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="stockQuantity"
                    type="number"
                    {...register('stockQuantity', { valueAsNumber: true })}
                    placeholder="0"
                  />
                  {errors.stockQuantity && (
                    <p className="mt-1 text-sm text-red-500">{errors.stockQuantity.message}</p>
                  )}
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

              {/* 재고 표시 설정 */}
              <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm font-medium text-gray-700">재고 표시 설정</p>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    {...register('showStock')}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  상품 재고 수량 사용자에게 표시
                  <span className="text-xs text-gray-400">(해제 시 수량 숨김, 품절 여부만 표시)</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    {...register('showGiftStock')}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  사은품 품절 정보 표시
                  <span className="text-xs text-gray-400">(해제 시 품절 사은품도 선택 가능한 것처럼 표시)</span>
                </label>
              </div>

            </div>
          )}
        </Card>

        {/* ============================================= */}
        {/* 구성 상품 설정 (세트상품 전용) */}
        {/* ============================================= */}
        {isBundle && (
          <Card className="overflow-hidden">
            <SectionHeader title="구성 상품 설정" section="bundleItems" />
            {expandedSections.bundleItems && (
              <div className="p-4 space-y-4">
                {/* 세트 구성 설명 */}
              <div>
                <Label htmlFor="bundleDescription">세트 구성 설명 (선택)</Label>
                <Textarea
                  id="bundleDescription"
                  {...register('bundleDescription')}
                  placeholder="세트 구성에 대한 설명을 입력해주세요 (예: A상품 1개 + B상품 2개로 구성된 세트입니다)"
                  rows={3}
                  className="mt-1"
                />
              </div>
              <p className="text-sm text-gray-500">세트에 포함할 상품을 검색하여 추가하세요. 옵션은 구성 상품에서 이미 결정됩니다.</p>

                {/* 상품 검색 */}
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

                {/* 검색 결과 */}
                {bundleSearchResults.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {bundleSearchResults.map((p) => {
                      const alreadyAdded = bundleItemDrafts.some((d) => d.productId === p.id);
                      const primaryImg = (p.product_images || []).find((i: any) => i.is_primary) || p.product_images?.[0];
                      return (
                        <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                          {primaryImg && <img src={primaryImg.url} className="h-8 w-8 rounded object-cover" />}
                          <span className="flex-1 text-sm">{p.name}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={alreadyAdded}
                            onClick={() => addBundleItem(p)}
                          >
                            {alreadyAdded ? '추가됨' : '추가'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 구성 상품 목록 */}
                {bundleItemDrafts.length > 0 && (
                  <div className="border rounded-lg divide-y">
                    {bundleItemDrafts.map((item) => (
                      <div key={item.localId} className="flex items-center gap-3 px-3 py-2">
                        {item.productImageUrl && (
                          <img src={item.productImageUrl} className="h-8 w-8 rounded object-cover" />
                        )}
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
                )}

                {bundleItemDrafts.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">구성 상품이 없습니다. 위에서 검색하여 추가하세요.</p>
                )}
              </div>
            )}
          </Card>
        )}

        {/* ============================================= */}
        {/* 상품 옵션 (단일상품 전용) */}
        {/* ============================================= */}
        {!isBundle && <Card className="overflow-hidden">
          <SectionHeader title="상품 옵션" section="options" />
          {expandedSections.options && (
            <div className="p-4 space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('hasOptions')}
                  className="rounded"
                />
                <span className="text-sm font-medium">옵션 사용</span>
              </label>

              {hasOptions && (
                <div className="space-y-4">
                  {/* 옵션 정의 */}
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(optionIndex)}
                        >
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
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeOptionValue(optionIndex, valueIndex)}
                              disabled={(watch(`options.${optionIndex}.values`) || []).length <= 1}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addOptionValue(optionIndex)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          옵션값 추가
                        </Button>
                      </div>
                    </div>
                  ))}

                  <Button type="button" variant="outline" onClick={addOption}>
                    <Plus className="h-4 w-4 mr-2" />
                    옵션 추가
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
                                  <Input
                                    value={variant.sku}
                                    onChange={(e) => updateVariant(idx, 'sku', e.target.value)}
                                    placeholder="SKU-001"
                                    className="h-8 text-sm"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    type="number"
                                    value={variant.additionalPrice}
                                    onChange={(e) => updateVariant(idx, 'additionalPrice', Number(e.target.value))}
                                    placeholder="0"
                                    className="h-8 text-sm"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    type="number"
                                    value={variant.stockQuantity}
                                    onChange={(e) => updateVariant(idx, 'stockQuantity', Number(e.target.value))}
                                    placeholder="0"
                                    className="h-8 text-sm"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    type="number"
                                    value={variant.minPurchaseQuantity ?? ''}
                                    onChange={(e) => updateVariant(idx, 'minPurchaseQuantity', e.target.value ? Number(e.target.value) : null)}
                                    placeholder="-"
                                    min={1}
                                    className="h-8 text-sm"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    type="number"
                                    value={variant.maxPurchaseQuantity ?? ''}
                                    onChange={(e) => updateVariant(idx, 'maxPurchaseQuantity', e.target.value ? Number(e.target.value) : null)}
                                    placeholder="-"
                                    min={1}
                                    className="h-8 text-sm"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    type="number"
                                    value={variant.dailyPurchaseLimit ?? ''}
                                    onChange={(e) => updateVariant(idx, 'dailyPurchaseLimit', e.target.value ? Number(e.target.value) : null)}
                                    placeholder="-"
                                    min={1}
                                    className="h-8 text-sm"
                                  />
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={variant.isActive}
                                    onChange={(e) => updateVariant(idx, 'isActive', e.target.checked)}
                                    className="rounded"
                                  />
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

        {/* ============================================= */}
        {/* 사은품 설정 */}
        {/* ============================================= */}
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeGiftSet(giftSet.localId)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
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

                  {/* 품절 시 자동 숨김 */}
                  <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
                    <input
                      type="checkbox"
                      id={`hide-soldout-${giftSet.localId}`}
                      checked={giftSet.hideWhenSoldout}
                      onChange={(e) => updateGiftSet(giftSet.localId, { hideWhenSoldout: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <label htmlFor={`hide-soldout-${giftSet.localId}`} className="text-sm cursor-pointer select-none">
                      모든 사은품 품절 시 해당 세트 자동 숨김
                    </label>
                    <span className="ml-auto text-xs text-gray-400">
                      (체크 해제 시 품절 안내와 함께 세트가 계속 표시됩니다)
                    </span>
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
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeGiftItem(giftSet.localId, item.localId)}
                          >
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
                              // 중분류가 없는 대분류라면 바로 상품 로드
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
                          {/* 중분류 — 해당 대분류에 자식이 있을 때만 표시 */}
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
                                  key={p.id}
                                  type="button"
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
                      <Input
                        type="datetime-local"
                        value={giftSet.startsAt}
                        onChange={(e) => updateGiftSet(giftSet.localId, { startsAt: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>종료일시 (선택)</Label>
                      <Input
                        type="datetime-local"
                        value={giftSet.endsAt}
                        onChange={(e) => updateGiftSet(giftSet.localId, { endsAt: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() => setGiftSetDrafts((prev) => [...prev, newGiftSetDraft()])}
              >
                <Plus className="h-4 w-4 mr-2" />
                사은품 세트 추가
              </Button>
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

        {/* ============================================= */}
        {/* 수량별 할인 설정 */}
        {/* ============================================= */}
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

        {/* ============================================= */}
        {/* 배송 설정 */}
        {/* ============================================= */}
        <Card className="overflow-hidden">
          <SectionHeader title="배송 설정" section="shipping" />
          {expandedSections.shipping && (
            <div className="p-4 space-y-4">
              <div>
                <Label>배송비 유형</Label>
                <Select
                  defaultValue="default"
                  onValueChange={(value: 'default' | 'free' | 'custom') =>
                    setValue('shippingType', value)
                  }
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

              <div>
                <Label htmlFor="shippingNotice">배송 안내 (상품별)</Label>
                <p className="mb-1 text-xs text-gray-500">비워두면 관리자 설정의 기본 배송 안내가 표시됩니다. HTML 태그 사용 가능.</p>
                <textarea
                  id="shippingNotice"
                  {...register('shippingNotice')}
                  rows={4}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={"배송 기간: 결제 후 1~3 영업일 이내 출고됩니다.\n기본 배송비: 3,000원 (50,000원 이상 구매 시 무료)"}
                />
              </div>

              <div>
                <Label htmlFor="returnNotice">환불·교환 안내 (상품별)</Label>
                <p className="mb-1 text-xs text-gray-500">비워두면 관리자 설정의 기본 환불·교환 안내가 표시됩니다. HTML 태그 사용 가능.</p>
                <textarea
                  id="returnNotice"
                  {...register('returnNotice')}
                  rows={4}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={"교환/반품 신청 기간: 상품 수령 후 7일 이내\n상품 불량·오배송 시: 무료 교환 또는 전액 환불"}
                />
              </div>
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
                <Input
                  id="seoTitle"
                  {...register('seoTitle')}
                  placeholder="검색 엔진에 표시될 제목"
                />
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

        {/* ============================================= */}
        {/* 저장 버튼 */}
        {/* ============================================= */}
        <div className="flex gap-4 sticky bottom-0 bg-white py-4 border-t">
          <Button type="submit" disabled={submitting} className="flex-1">
            {submitting ? '등록 중...' : '상품 등록'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            취소
          </Button>
        </div>
      </form>
    </div>
  );
}

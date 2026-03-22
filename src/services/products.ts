import { createClient } from '@/lib/supabase/client';
import type { Product, PaginatedResponse } from '@/types';

export async function getProducts(params?: {
  page?: number;
  limit?: number;
  categoryId?: string;
  search?: string;
}): Promise<PaginatedResponse<Product>> {
  const supabase = createClient();
  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (params?.categoryId) {
    query = query.eq('category_id', params.categoryId);
  }

  if (params?.search) {
    query = query.ilike('name', `%${params.search}%`);
  }

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    success: true,
    data: data?.map((p) => ({
      id: p.id,
      categoryId: p.category_id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: parseFloat(p.price),
      comparePrice: p.compare_price ? parseFloat(p.compare_price) : undefined,
      cost: p.cost ? parseFloat(p.cost) : undefined,
      stock: p.stock,
      sku: p.sku,
      barcode: p.barcode,
      images: p.images || [],
      thumbnail: p.thumbnail,
      isActive: p.is_active,
      isFeatured: p.is_featured,
      options: p.options,
      variants: p.variants,
      metadata: p.metadata,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    })),
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    categoryId: data.category_id,
    name: data.name,
    slug: data.slug,
    description: data.description,
    price: parseFloat(data.price),
    comparePrice: data.compare_price ? parseFloat(data.compare_price) : undefined,
    cost: data.cost ? parseFloat(data.cost) : undefined,
    stock: data.stock,
    sku: data.sku,
    barcode: data.barcode,
    images: data.images || [],
    thumbnail: data.thumbnail,
    isActive: data.is_active,
    isFeatured: data.is_featured,
    options: data.options,
    variants: data.variants,
    metadata: data.metadata,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getFeaturedProducts(limit = 10): Promise<Product[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .eq('is_featured', true)
    .limit(limit);

  if (error) throw error;

  return (
    data?.map((p) => ({
      id: p.id,
      categoryId: p.category_id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: parseFloat(p.price),
      comparePrice: p.compare_price ? parseFloat(p.compare_price) : undefined,
      cost: p.cost ? parseFloat(p.cost) : undefined,
      stock: p.stock,
      sku: p.sku,
      barcode: p.barcode,
      images: p.images || [],
      thumbnail: p.thumbnail,
      isActive: p.is_active,
      isFeatured: p.is_featured,
      options: p.options,
      variants: p.variants,
      metadata: p.metadata,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    })) || []
  );
}

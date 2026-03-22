// 공통 타입
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 사용자 타입
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'admin' | 'user';
  createdAt: string;
  updatedAt: string;
}

// 상품 타입
export interface Product {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  comparePrice?: number;
  cost?: number;
  stock: number;
  sku?: string;
  barcode?: string;
  images: string[];
  thumbnail?: string;
  isActive: boolean;
  isFeatured: boolean;
  options?: ProductOption[];
  variants?: ProductVariant[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProductOption {
  name: string;
  values: string[];
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  price: number;
  stock: number;
  options: Record<string, string>;
}

// 카테고리 타입
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  image?: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 장바구니 타입
export interface CartItem {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  options?: Record<string, string>;
  product?: Product;
  createdAt: string;
  updatedAt: string;
}

// 주문 타입
export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  shippingAddress: string;
  shippingPhone: string;
  shippingName: string;
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  options?: Record<string, string>;
}

// 리뷰 타입
export interface Review {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  title: string;
  content: string;
  images?: string[];
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, 'id' | 'name'>;
}

// 게시판 타입
export interface Board {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  id: string;
  boardId: string;
  userId: string;
  title: string;
  content: string;
  views: number;
  isPinned: boolean;
  isNotice: boolean;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, 'id' | 'name'>;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, 'id' | 'name'>;
}

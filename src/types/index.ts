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
  nickname?: string;
  phone?: string | null;
  profileImage?: string;
  role: 'admin' | 'user';
  points?: number;
  deposit?: number;
  createdAt: string;
  updatedAt: string;
}

// 상품 타입
export interface Product {
  id: string;
  categoryId: string;
  brandId?: string;
  name: string;
  slug: string;
  summary?: string;
  description?: string;
  regularPrice: number;
  salePrice: number;
  costPrice?: number;
  stockQuantity: number;
  stockAlertQuantity?: number;
  minPurchaseQuantity?: number;
  maxPurchaseQuantity?: number;
  status: 'draft' | 'active' | 'inactive' | 'soldout';
  isFeatured: boolean;
  isNew: boolean;
  isBest: boolean;
  isSale: boolean;
  viewCount?: number;
  salesCount?: number;
  reviewCount?: number;
  reviewAvg?: number;
  hasOptions: boolean;
  shippingType?: string;
  shippingFee?: number;
  tags?: string[];
  videoUrl?: string;
  sku?: string;
  images?: ProductImage[];
  options?: ProductOption[];
  variants?: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt?: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductOption {
  id: string;
  name: string;
  sortOrder: number;
  values?: ProductOptionValue[];
}

export interface ProductOptionValue {
  id: string;
  value: string;
  additionalPrice: number;
  sortOrder: number;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku?: string;
  optionValues: Record<string, string>;
  additionalPrice: number;
  stockQuantity: number;
  imageUrl?: string;
  isActive: boolean;
}

// 카테고리 타입
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  imageUrl?: string;
  depth: number;
  sortOrder: number;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

// 장바구니 타입
export interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  selected: boolean;
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
  discountAmount: number;
  couponDiscount: number;
  shippingFee: number;
  usedPoints: number;
  usedDeposit: number;
  totalAmount: number;
  ordererName: string;
  ordererPhone: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address1: string;
  address2?: string;
  shippingMessage?: string;
  paymentMethod?: string;
  pgProvider?: string;
  paidAt?: string;
  confirmedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  earnedPoints?: number;
  isGift?: boolean;
  giftMessage?: string;
  adminMemo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId?: string;
  productName: string;
  optionText?: string;
  productImage?: string;
  unitPrice: number;
  quantity: number;
  discountAmount: number;
  totalPrice: number;
  status: string;
}

// 리뷰 타입
export interface Review {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  content: string;
  isVisible: boolean;
  likeCount: number;
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
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  id: string;
  boardId: string;
  userId: string;
  title: string;
  content: string;
  viewCount: number;
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

// 쿠폰 타입
export interface Coupon {
  id: string;
  name: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  totalQuantity?: number;
  usedQuantity: number;
  startsAt?: string;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserCoupon {
  id: string;
  userId: string;
  couponId: string;
  coupon?: Coupon;
  usedAt?: string;
  orderId?: string;
  createdAt: string;
}

// 찜 목록 타입
export interface Wishlist {
  id: string;
  userId: string;
  productId: string;
  product?: Product;
  createdAt: string;
}

// 상품 Q&A 타입
export interface ProductQNA {
  id: string;
  productId: string;
  userId: string;
  question: string;
  answer?: string;
  isSecret: boolean;
  answeredAt?: string;
  answeredBy?: string;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, 'id' | 'name'>;
}

// 알림 설정 타입
export interface NotificationSettings {
  id: string;
  userId: string;
  emailOrder: boolean;
  emailPromotion: boolean;
  emailReview: boolean;
  smsOrder: boolean;
  smsPromotion: boolean;
  pushOrder: boolean;
  pushPromotion: boolean;
  createdAt: string;
  updatedAt: string;
}

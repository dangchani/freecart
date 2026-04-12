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
  loginId?: string;
  name: string;
  nickname?: string;
  phone?: string | null;
  profileImage?: string;
  role: 'super_admin' | 'admin' | 'user';
  points?: number;
  deposit?: number;
  isApproved?: boolean;
  permissions?: string[];
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
  dailyPurchaseLimit?: number | null;
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

export type GiftMode = 'auto' | 'select';

export interface ProductGiftSetItem {
  id: string;
  giftProductId: string;
  giftProductName: string;
  giftProductImageUrl: string | null;
  giftProductSalePrice: number;
  maxPerItem: number | null;
  sortOrder: number;
}

export interface ProductGiftSet {
  id: string;
  productId: string;
  name: string;
  giftMode: GiftMode;
  triggerQuantity: number;
  maxGiftQuantity: number;
  maxDistinctItems: number | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  items: ProductGiftSetItem[];
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
  optionText?: string;
  variantAdditionalPrice?: number;
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
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'confirmed' | 'cancelled' | 'return_requested' | 'returned';
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
  // Phase 1: 자동 처리 타임스탬프
  paymentDeadline?: string;   // 무통장/가상계좌 입금 마감 시각
  autoConfirmAt?: string;     // 자동 구매확정 예정 시각
  isAdminOrder?: boolean;     // 관리자 직접 생성 주문
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
  itemType?: 'purchase' | 'gift' | 'bundle_component';
}

export interface OrderTimeline {
  id: string;
  orderId: string;
  orderItemId?: string;
  fromStatus?: string;
  toStatus: string;
  changedBy?: string;
  note?: string;
  createdAt: string;
}

export interface CashReceipt {
  id: string;
  orderId: string;
  userId?: string;
  receiptType: 'income_deduction' | 'business_expense';
  identifierType: 'phone' | 'business_number' | 'card';
  identifier: string;
  amount: number;
  pgProvider?: string;
  pgReceiptId?: string;
  issuedAt?: string;
  cancelledAt?: string;
  status: 'pending' | 'issued' | 'cancelled' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface TaxInvoice {
  id: string;
  orderId: string;
  userId?: string;
  businessName: string;
  businessNumber: string;
  ceoName?: string;
  businessAddress?: string;
  businessType?: string;
  businessItem?: string;
  managerName?: string;
  managerEmail?: string;
  supplyAmount: number;
  taxAmount: number;
  totalAmount: number;
  ntsResultCode?: string;
  ntsIssuedAt?: string;
  invoiceNumber?: string;
  issueType: 'electronic' | 'manual';
  status: 'requested' | 'issued' | 'cancelled' | 'failed';
  adminMemo?: string;
  createdAt: string;
  updatedAt: string;
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

// 알림 설정 타입 (DB 스키마와 일치)
export interface NotificationSettings {
  id: string;
  userId: string;
  emailOrder: boolean;
  emailShipping: boolean;
  emailMarketing: boolean;
  smsOrder: boolean;
  smsShipping: boolean;
  smsMarketing: boolean;
  pushEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// 회원 등급 시스템
// =============================================================================
export interface UserLevel {
  id: string;
  level: number;
  name: string;
  discountRate: number;
  pointRate: number;
  minPurchaseAmount: number;
  minPurchaseCount: number;
  description?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// 배송지 관리
// =============================================================================
export interface UserAddress {
  id: string;
  userId: string;
  name: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address1: string;
  address2?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// 포인트/예치금 내역
// =============================================================================
export interface PointHistory {
  id: string;
  userId: string;
  amount: number;
  balance: number;
  type: 'earn' | 'use' | 'expire' | 'admin';
  description: string;
  referenceType?: string;
  referenceId?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface DepositHistory {
  id: string;
  userId: string;
  amount: number;
  balance: number;
  type: 'charge' | 'use' | 'refund' | 'admin';
  description: string;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
}

// =============================================================================
// 출석 체크
// =============================================================================
export interface UserAttendance {
  id: string;
  userId: string;
  attendedDate: string;
  pointsEarned: number;
  createdAt: string;
}

// =============================================================================
// 브랜드
// =============================================================================
export interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// 리뷰 이미지/동영상
// =============================================================================
export interface ReviewImage {
  id: string;
  reviewId: string;
  url: string;
  sortOrder: number;
  createdAt: string;
}

export interface ReviewVideo {
  id: string;
  reviewId: string;
  url: string;
  thumbnailUrl?: string;
  createdAt: string;
}

// =============================================================================
// 배송 관련
// =============================================================================
export interface ShippingCompany {
  id: string;
  name: string;
  code: string;
  trackingUrl?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface Shipment {
  id: string;
  orderId: string;
  shippingCompanyId?: string;
  shippingCompany?: ShippingCompany;
  trackingNumber?: string;
  status: 'pending' | 'shipped' | 'in_transit' | 'delivered';
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// 반품/교환/환불
// =============================================================================
export interface Return {
  id: string;
  orderId: string;
  userId: string;
  itemIds: string[];
  reason: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  adminMemo?: string;
  createdAt: string;
}

export interface Exchange {
  id: string;
  orderId: string;
  userId: string;
  itemIds: string[];
  reason: string;
  exchangeVariantId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  adminMemo?: string;
  createdAt: string;
}

export interface Refund {
  id: string;
  orderId: string;
  orderItemId?: string;
  paymentId?: string;
  userId: string;
  type: 'cancel' | 'return' | 'partial';
  amount: number;
  pointsReturned: number;
  depositReturned: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  pgTid?: string;
  approvedBy?: string;
  approvedAt?: string;
  processedAt?: string;
  completedAt?: string;
  rejectedReason?: string;
  adminMemo?: string;
  createdAt: string;
}

// =============================================================================
// 결제
// =============================================================================
export interface Payment {
  id: string;
  orderId: string;
  pgProvider: string;
  method: string;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  pgTid?: string;
  paymentKey?: string;
  receiptUrl?: string;
  cardCompany?: string;
  cardNumber?: string;
  installmentMonths?: number;
  vbankName?: string;
  vbankNumber?: string;
  vbankHolder?: string;
  vbankExpiresAt?: string;
  paidAt?: string;
  failedAt?: string;
  failReason?: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// 공지사항 / FAQ / 1:1 문의
// =============================================================================
export interface Notice {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
  sortOrder: number;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Inquiry {
  id: string;
  userId: string;
  orderId?: string;
  category: string;
  title: string;
  content: string;
  status: 'pending' | 'answered' | 'closed';
  answer?: string;
  answeredBy?: string;
  answeredAt?: string;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, 'id' | 'name'>;
}

// =============================================================================
// 배너 / 팝업 / 이벤트
// =============================================================================
export interface Banner {
  id: string;
  name: string;
  position: string;
  title?: string;
  subtitle?: string;
  imageUrl: string;
  mobileImageUrl?: string;
  linkUrl?: string;
  linkTarget: '_self' | '_blank';
  sortOrder: number;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Popup {
  id: string;
  name: string;
  content?: string;
  imageUrl?: string;
  linkUrl?: string;
  position: 'center' | 'left' | 'right';
  width: number;
  height?: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  showTodayClose: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  title: string;
  slug: string;
  summary?: string;
  content: string;
  thumbnailUrl?: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// 정기배송 구독
// =============================================================================
export interface Subscription {
  id: string;
  userId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  cycle: 'weekly' | 'biweekly' | 'monthly';
  intervalCount: number;
  deliveryDay?: number;
  nextDeliveryDate: string;
  pricePerDelivery: number;
  discountRate?: number;
  status: 'active' | 'paused' | 'cancelled';
  deliveryCount: number;
  shippingAddressId?: string;
  paymentMethodId?: string;
  pauseUntil?: string;
  pausedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
  product?: Product;
}

export interface SubscriptionDelivery {
  id: string;
  subscriptionId: string;
  deliveryNumber: number;
  scheduledDate: string;
  deliveredDate?: string;
  orderId?: string;
  status: 'scheduled' | 'processing' | 'delivered' | 'skipped' | 'failed';
  skipReason?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// 알림
// =============================================================================
export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  linkUrl?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

// =============================================================================
// 검색
// =============================================================================
export interface SearchKeyword {
  id: string;
  keyword: string;
  count: number;
  searchCount: number;
  lastSearchedAt: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// 설정
// =============================================================================
export interface Setting {
  id: string;
  key: string;
  value: string;
  description?: string;
  updatedAt: string;
}

// =============================================================================
// 메뉴
// =============================================================================
export type MenuType =
  | 'category'
  | 'board'
  | 'notice'
  | 'faq'
  | 'inquiry'
  | 'product_qna'
  | 'review'
  | 'link';

export interface Menu {
  id: string;
  parentId?: string;
  position: 'header' | 'footer' | 'sidebar';
  menuType: MenuType;
  name: string;
  url?: string;
  categoryId?: string;
  boardId?: string;
  isSystem: boolean;
  sortOrder: number;
  isVisible: boolean;
  target: '_self' | '_blank';
  children?: Menu[];
  createdAt: string;
  updatedAt: string;
}

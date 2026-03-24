import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { useAuth } from './hooks/useAuth';

// Pages
import HomePage from './app/page';
import SetupPage from './app/setup/page';
import NotFoundPage from './app/not-found';

// Auth
import LoginPage from './app/auth/login/page';
import SignupPage from './app/auth/signup/page';
import ForgotPasswordPage from './app/auth/forgot-password/page';
import ResetPasswordPage from './app/auth/reset-password/page';

// Products
import ProductsPage from './app/products/page';
import ProductDetailPage from './app/products/[slug]/page';
import ProductSearchPage from './app/products/search/page';
import ProductComparePage from './app/products/compare/page';

// Cart & Checkout
import CartPage from './app/cart/page';
import CheckoutPage from './app/checkout/page';
import CheckoutSuccessPage from './app/checkout/success/page';
import CheckoutFailPage from './app/checkout/fail/page';

// Mypage
import MypageLayout from './app/mypage/layout';
import MypagePage from './app/mypage/page';
import MypageProfilePage from './app/mypage/profile/page';
import MypageOrdersPage from './app/mypage/orders/page';
import MypageOrderDetailPage from './app/mypage/orders/[orderNumber]/page';
import MypageAddressesPage from './app/mypage/addresses/page';
import MypagePointsPage from './app/mypage/points/page';
import MypageCouponsPage from './app/mypage/coupons/page';
import MypageDepositsPage from './app/mypage/deposits/page';
import MypageWishlistPage from './app/mypage/wishlist/page';
import MypageReviewsPage from './app/mypage/reviews/page';
import MypageSubscriptionsPage from './app/mypage/subscriptions/page';
import MypageInquiriesPage from './app/mypage/inquiries/page';
import MypageNotificationsPage from './app/mypage/notifications/page';
import MypageAttendancePage from './app/mypage/attendance/page';

// Boards
import BoardsPage from './app/boards/page';
import BoardDetailPage from './app/boards/[slug]/page';
import NewPostPage from './app/boards/[slug]/posts/new/page';
import PostDetailPage from './app/boards/[slug]/posts/[id]/page';
import EditPostPage from './app/boards/[slug]/posts/[id]/edit/page';

// Content
import NoticesPage from './app/notices/page';
import NoticeDetailPage from './app/notices/[id]/page';
import FAQsPage from './app/faqs/page';
import BrandsPage from './app/brands/page';
import BrandDetailPage from './app/brands/[id]/page';
import NewInquiryPage from './app/inquiries/new/page';

// Admin
import AdminLayout from './app/admin/layout';
import AdminDashboardPage from './app/admin/page';
import AdminProductsPage from './app/admin/products/page';
import AdminNewProductPage from './app/admin/products/new/page';
import AdminEditProductPage from './app/admin/products/[slug]/edit/page';
import AdminCategoriesPage from './app/admin/categories/page';
import AdminOrdersPage from './app/admin/orders/page';
import AdminUsersPage from './app/admin/users/page';
import AdminUserDetailPage from './app/admin/users/[userId]/page';
import AdminReviewsPage from './app/admin/reviews/page';
import AdminCouponsPage from './app/admin/coupons/page';
import AdminBoardsPage from './app/admin/boards/page';
import AdminNoticesPage from './app/admin/notices/page';
import AdminBannersPage from './app/admin/banners/page';
import AdminProductQnAPage from './app/admin/product-qna/page';
import AdminInquiriesPage from './app/admin/inquiries/page';
import AdminSubscriptionsPage from './app/admin/subscriptions/page';
import AdminRefundsPage from './app/admin/refunds/page';
import AdminSettingsPage from './app/admin/settings/page';
import AdminStatisticsPage from './app/admin/statistics/page';
import AdminThemesPage from './app/admin/themes/page';
import AdminSkinsPage from './app/admin/skins/page';
import AdminMenusPage from './app/admin/menus/page';
import AdminTermsPage from './app/admin/terms/page';
import AdminUserLevelsPage from './app/admin/user-levels/page';
import AdminExternalConnectionsPage from './app/admin/external-connections/page';

function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">로딩 중...</div>;
  if (!user) return <Navigate to="/auth/login" replace />;
  return <Outlet />;
}

function RequireAdmin() {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">로딩 중...</div>;
  if (!user) return <Navigate to="/auth/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 설정 페이지 */}
        <Route path="/setup" element={<SetupPage />} />

        {/* 메인 레이아웃 */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />

          {/* 인증 */}
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/signup" element={<SignupPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

          {/* 상품 */}
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/search" element={<ProductSearchPage />} />
          <Route path="/products/compare" element={<ProductComparePage />} />
          <Route path="/products/:slug" element={<ProductDetailPage />} />

          {/* 장바구니 & 결제 */}
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
          <Route path="/checkout/fail" element={<CheckoutFailPage />} />

          {/* 게시판 */}
          <Route path="/boards" element={<BoardsPage />} />
          <Route path="/boards/:slug" element={<BoardDetailPage />} />
          <Route path="/boards/:slug/posts/new" element={<NewPostPage />} />
          <Route path="/boards/:slug/posts/:id" element={<PostDetailPage />} />
          <Route path="/boards/:slug/posts/:id/edit" element={<EditPostPage />} />

          {/* 공지/FAQ/브랜드 */}
          <Route path="/notices" element={<NoticesPage />} />
          <Route path="/notices/:id" element={<NoticeDetailPage />} />
          <Route path="/faqs" element={<FAQsPage />} />
          <Route path="/brands" element={<BrandsPage />} />
          <Route path="/brands/:id" element={<BrandDetailPage />} />
          <Route path="/inquiries/new" element={<NewInquiryPage />} />

          {/* 마이페이지 (인증 필요) */}
          <Route element={<RequireAuth />}>
            <Route element={<MypageLayout />}>
              <Route path="/mypage" element={<MypagePage />} />
              <Route path="/mypage/profile" element={<MypageProfilePage />} />
              <Route path="/mypage/orders" element={<MypageOrdersPage />} />
              <Route path="/mypage/orders/:orderNumber" element={<MypageOrderDetailPage />} />
              <Route path="/mypage/addresses" element={<MypageAddressesPage />} />
              <Route path="/mypage/points" element={<MypagePointsPage />} />
              <Route path="/mypage/coupons" element={<MypageCouponsPage />} />
              <Route path="/mypage/deposits" element={<MypageDepositsPage />} />
              <Route path="/mypage/wishlist" element={<MypageWishlistPage />} />
              <Route path="/mypage/reviews" element={<MypageReviewsPage />} />
              <Route path="/mypage/subscriptions" element={<MypageSubscriptionsPage />} />
              <Route path="/mypage/inquiries" element={<MypageInquiriesPage />} />
              <Route path="/mypage/notifications" element={<MypageNotificationsPage />} />
              <Route path="/mypage/attendance" element={<MypageAttendancePage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* 어드민 (관리자 인증 필요) */}
        <Route element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/products" element={<AdminProductsPage />} />
            <Route path="/admin/products/new" element={<AdminNewProductPage />} />
            <Route path="/admin/products/:slug/edit" element={<AdminEditProductPage />} />
            <Route path="/admin/categories" element={<AdminCategoriesPage />} />
            <Route path="/admin/orders" element={<AdminOrdersPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/users/:userId" element={<AdminUserDetailPage />} />
            <Route path="/admin/reviews" element={<AdminReviewsPage />} />
            <Route path="/admin/coupons" element={<AdminCouponsPage />} />
            <Route path="/admin/boards" element={<AdminBoardsPage />} />
            <Route path="/admin/notices" element={<AdminNoticesPage />} />
            <Route path="/admin/banners" element={<AdminBannersPage />} />
            <Route path="/admin/product-qna" element={<AdminProductQnAPage />} />
            <Route path="/admin/inquiries" element={<AdminInquiriesPage />} />
            <Route path="/admin/subscriptions" element={<AdminSubscriptionsPage />} />
            <Route path="/admin/refunds" element={<AdminRefundsPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            <Route path="/admin/statistics" element={<AdminStatisticsPage />} />
            <Route path="/admin/themes" element={<AdminThemesPage />} />
            <Route path="/admin/skins" element={<AdminSkinsPage />} />
            <Route path="/admin/menus" element={<AdminMenusPage />} />
            <Route path="/admin/terms" element={<AdminTermsPage />} />
            <Route path="/admin/user-levels" element={<AdminUserLevelsPage />} />
            <Route path="/admin/external-connections" element={<AdminExternalConnectionsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

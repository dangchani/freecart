import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ThemeProvider } from './components/theme-provider';
import ThemeLayout from './components/themes/ThemeLayout';
import { useAuth } from './hooks/useAuth';
import { getSiteInfo } from './services/settings';

// Pages
import HomePage from './app/page';
import SetupPage from './app/setup/page';
import NotFoundPage from './app/not-found';

// Auth
import LoginPage from './app/auth/login/page';
import ClosedMallLoginPage from './app/auth/closed-mall/page';
import SignupPage from './app/auth/signup/page';
import ForgotPasswordPage from './app/auth/forgot-password/page';
import ForgotIdPage from './app/auth/forgot-id/page';
import ResetPasswordPage from './app/auth/reset-password/page';
import AuthCallbackPage from './app/auth/callback/page';

// Products
import ProductsPage from './app/products/page';
import CategoryPage from './app/categories/[slug]/page';
import ProductDetailPage from './app/products/[slug]/page';
import ProductSearchPage from './app/products/search/page';
import ProductComparePage from './app/products/compare/page';
import NewReviewPage from './app/products/[slug]/reviews/new/page';

// Cart & Checkout
import CartPage from './app/cart/page';
import CheckoutPage from './app/checkout/page';
import CheckoutSuccessPage from './app/checkout/success/page';
import CheckoutFailPage from './app/checkout/fail/page';
import BankTransferPage from './app/checkout/bank-transfer/page';
import KiwoomMockPage from './app/checkout/kiwoom-mock/page';

// Mypage
import MypageLayout from './app/mypage/layout';
import MypagePage from './app/mypage/page';
import MypageProfilePage from './app/mypage/profile/page';
import MypageOrdersPage from './app/mypage/orders/page';
import MypageOrderDetailPage from './app/mypage/orders/[orderNumber]/page';
import MypageReturnRequestPage from './app/mypage/orders/[orderNumber]/return/page';
import MypageExchangeRequestPage from './app/mypage/orders/[orderNumber]/exchange/page';
import MypageAddressesPage from './app/mypage/addresses/page';
import MypagePointsPage from './app/mypage/points/page';
import MypageCouponsPage from './app/mypage/coupons/page';
import MypageDepositsPage from './app/mypage/deposits/page';
import MypageWishlistPage from './app/mypage/wishlist/page';
import MypageReviewsPage from './app/mypage/reviews/page';
import MypageEditReviewPage from './app/mypage/reviews/[id]/edit/page';
import MypageSubscriptionsPage from './app/mypage/subscriptions/page';
import MypageQnAPage from './app/mypage/qna/page';
import MypageInquiriesPage from './app/mypage/inquiries/page';
import MypageInquiryNewPage from './app/mypage/inquiries/new/page';
import MypageNotificationsPage from './app/mypage/notifications/page';
import MypageAttendancePage from './app/mypage/attendance/page';
import MypageCashReceiptsPage from './app/mypage/cash-receipts/page';
import MypageTaxInvoicesPage from './app/mypage/tax-invoices/page';

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
import AdminOrderDetailPage from './app/admin/orders/[id]/page';
import AdminUsersPage from './app/admin/users/page';
import AdminUserDetailPage from './app/admin/users/[userId]/page';
import AdminReviewsPage from './app/admin/reviews/page';
import AdminCouponsPage from './app/admin/coupons/page';
import AdminNewCouponPage from './app/admin/coupons/new/page';
import AdminBoardsPage from './app/admin/boards/page';
import AdminNoticesPage from './app/admin/notices/page';
import AdminNewNoticePage from './app/admin/notices/new/page';
import AdminEditNoticePage from './app/admin/notices/[id]/edit/page';
import AdminFAQsPage from './app/admin/faqs/page';
import AdminBannersPage from './app/admin/banners/page';
import AdminPopupsPage from './app/admin/popups/page';
import AdminProductQnAPage from './app/admin/product-qna/page';
import AdminInquiriesPage from './app/admin/inquiries/page';
import AdminSubscriptionsPage from './app/admin/subscriptions/page';
import AdminRefundsPage from './app/admin/refunds/page';
import AdminSettingsPage from './app/admin/settings/page';
import AdminStatisticsPage from './app/admin/statistics/page';
import AdminThemesPage from './app/admin/themes/page';
import AdminLayoutEditorPage from './app/admin/themes/layout-editor/page';
import AdminThemeEditorPage from './app/admin/themes/editor/page';
import AdminSkinsPage from './app/admin/skins/page';
import AdminMenusPage from './app/admin/menus/page';
import AdminTermsPage from './app/admin/terms/page';
import AdminUserLevelsPage from './app/admin/user-levels/page';
import AdminExternalConnectionsPage from './app/admin/external-connections/page';
import AdminPaymentGatewaysPage from './app/admin/payment-gateways/page';
import AdminShippingSettingsPage from './app/admin/settings/shipping/page';
import AdminRolesPage from './app/admin/settings/roles/page';
import AdminPendingApprovalPage from './app/admin/users/pending/page';
import AdminSignupFieldsPage from './app/admin/settings/signup-fields/page';
import AdminProductsBulkPage from './app/admin/products/bulk/page';
import AdminNewBundlePage from './app/admin/bundles/new/page';
import AdminEditBundlePage from './app/admin/bundles/[id]/edit/page';
import AdminOrdersBulkShipmentPage from './app/admin/orders/bulk-shipment/page';
import AdminOrderInvoicePage from './app/admin/orders/[id]/invoice/page';
import AdminLogsPage from './app/admin/logs/page';
import AdminIpBlocksPage from './app/admin/ip-blocks/page';
import AdminVisitorsPage from './app/admin/visitors/page';
import AdminWebhooksPage from './app/admin/webhooks/page';
import AdminPagesPage from './app/admin/pages/page';
import ContentPage from './app/pages/[slug]/page';
import OAuthCallbackPage from './app/admin/oauth/callback/page';
import PendingApprovalPage from './app/auth/pending-approval/page';
import { PrivateMallGuard } from './components/private-mall-guard';
import PopupManager from './components/popup/PopupManager';

// 테마 레이아웃 (DB layout_config 기반 헤더/푸터 동적 렌더링)
function MainLayout() {
  const [siteInfo, setSiteInfo] = useState<Awaited<ReturnType<typeof getSiteInfo>> | null>(null);

  useEffect(() => {
    getSiteInfo().then(setSiteInfo);
  }, []);

  const companyInfo = siteInfo ? {
    name: siteInfo.companyName,
    ceo: siteInfo.companyCeo,
    address: siteInfo.companyAddress,
    tel: siteInfo.companyPhone,
    email: siteInfo.companyEmail,
    businessNumber: siteInfo.companyBusinessNumber,
  } : undefined;

  return (
    <ThemeLayout siteName={siteInfo?.siteName} companyInfo={companyInfo}>
      <PopupManager />
      <Outlet />
    </ThemeLayout>
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
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {/* ThemeProvider: DB에서 활성 테마 로드 + CSS/JS 주입 + Context 제공 */}
      <ThemeProvider>
        <Routes>
          {/* 설정 페이지 */}
          <Route path="/setup" element={<SetupPage />} />

          {/* 폐쇄몰 전용 로그인 (헤더/푸터 없음) */}
          <Route path="/auth/closed-mall" element={<ClosedMallLoginPage />} />

          {/* 메인 레이아웃 (테마 적용) */}
          <Route element={<MainLayout />}>

            {/* 인증 */}
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/signup" element={<SignupPage />} />
            <Route path="/auth/forgot-id" element={<ForgotIdPage />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/auth/pending-approval" element={<PendingApprovalPage />} />

            {/* 폐쇄몰 */}
            <Route element={<PrivateMallGuard scope="site" />}>

              <Route path="/" element={<HomePage />} />
              <Route path="/categories/:slug" element={<CategoryPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/products/search" element={<ProductSearchPage />} />
              <Route path="/products/compare" element={<ProductComparePage />} />

              <Route element={<PrivateMallGuard scope="content" />}>
                <Route path="/products/:slug" element={<ProductDetailPage />} />
                <Route path="/products/:slug/reviews/new" element={<NewReviewPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
                <Route path="/checkout/fail" element={<CheckoutFailPage />} />
                <Route path="/checkout/bank-transfer" element={<BankTransferPage />} />
                <Route path="/checkout/kiwoom-mock" element={<KiwoomMockPage />} />
              </Route>

              <Route path="/boards" element={<BoardsPage />} />
              <Route path="/boards/:slug" element={<BoardDetailPage />} />
              <Route path="/boards/:slug/posts/new" element={<NewPostPage />} />
              <Route path="/boards/:slug/posts/:id" element={<PostDetailPage />} />
              <Route path="/boards/:slug/posts/:id/edit" element={<EditPostPage />} />

              <Route path="/notices" element={<NoticesPage />} />
              <Route path="/notices/:id" element={<NoticeDetailPage />} />
              <Route path="/faqs" element={<FAQsPage />} />
              <Route path="/brands" element={<BrandsPage />} />
              <Route path="/brands/:id" element={<BrandDetailPage />} />
              <Route path="/inquiries/new" element={<NewInquiryPage />} />
              <Route path="/pages/:slug" element={<ContentPage />} />

              <Route element={<RequireAuth />}>
                <Route element={<MypageLayout />}>
                  <Route path="/mypage" element={<MypagePage />} />
                  <Route path="/mypage/profile" element={<MypageProfilePage />} />
                  <Route path="/mypage/orders" element={<MypageOrdersPage />} />
                  <Route path="/mypage/orders/:orderNumber" element={<MypageOrderDetailPage />} />
                  <Route path="/mypage/orders/:orderNumber/return" element={<MypageReturnRequestPage />} />
                  <Route path="/mypage/orders/:orderNumber/exchange" element={<MypageExchangeRequestPage />} />
                  <Route path="/mypage/addresses" element={<MypageAddressesPage />} />
                  <Route path="/mypage/points" element={<MypagePointsPage />} />
                  <Route path="/mypage/coupons" element={<MypageCouponsPage />} />
                  <Route path="/mypage/deposits" element={<MypageDepositsPage />} />
                  <Route path="/mypage/wishlist" element={<MypageWishlistPage />} />
                  <Route path="/mypage/reviews" element={<MypageReviewsPage />} />
                  <Route path="/mypage/reviews/:id/edit" element={<MypageEditReviewPage />} />
                  <Route path="/mypage/subscriptions" element={<MypageSubscriptionsPage />} />
                  <Route path="/mypage/qna" element={<MypageQnAPage />} />
                  <Route path="/mypage/inquiries" element={<MypageInquiriesPage />} />
                  <Route path="/mypage/inquiries/new" element={<MypageInquiryNewPage />} />
                  <Route path="/mypage/notifications" element={<MypageNotificationsPage />} />
                  <Route path="/mypage/attendance" element={<MypageAttendancePage />} />
                  <Route path="/mypage/cash-receipts" element={<MypageCashReceiptsPage />} />
                  <Route path="/mypage/tax-invoices" element={<MypageTaxInvoicesPage />} />
                </Route>
              </Route>

            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* OAuth 콜백 (팝업용, 레이아웃 없음) */}
          <Route path="/admin/oauth/callback" element={<OAuthCallbackPage />} />

          {/* 테마 비주얼 에디터 (풀페이지, 어드민 사이드바 없음) */}
          <Route element={<RequireAdmin />}>
            <Route path="/admin/themes/editor" element={<AdminThemeEditorPage />} />
          </Route>

          {/* 거래명세서 (인쇄 전용, 어드민 사이드바 없음) */}
          <Route element={<RequireAdmin />}>
            <Route path="/admin/orders/:id/invoice" element={<AdminOrderInvoicePage />} />
          </Route>

          {/* 어드민 */}
          <Route element={<RequireAdmin />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/products" element={<AdminProductsPage />} />
              <Route path="/admin/products/new" element={<AdminNewProductPage />} />
              <Route path="/admin/products/:slug/edit" element={<AdminEditProductPage />} />
              <Route path="/admin/products/bulk" element={<AdminProductsBulkPage />} />
              <Route path="/admin/bundles/new" element={<AdminNewBundlePage />} />
              <Route path="/admin/bundles/:id/edit" element={<AdminEditBundlePage />} />
              <Route path="/admin/categories" element={<AdminCategoriesPage />} />
              <Route path="/admin/orders" element={<AdminOrdersPage />} />
              <Route path="/admin/orders/bulk-shipment" element={<AdminOrdersBulkShipmentPage />} />
              <Route path="/admin/orders/:id" element={<AdminOrderDetailPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/users/pending" element={<AdminPendingApprovalPage />} />
              <Route path="/admin/users/:userId" element={<AdminUserDetailPage />} />
              <Route path="/admin/reviews" element={<AdminReviewsPage />} />
              <Route path="/admin/coupons" element={<AdminCouponsPage />} />
              <Route path="/admin/coupons/new" element={<AdminNewCouponPage />} />
              <Route path="/admin/boards" element={<AdminBoardsPage />} />
              <Route path="/admin/notices" element={<AdminNoticesPage />} />
              <Route path="/admin/notices/new" element={<AdminNewNoticePage />} />
              <Route path="/admin/notices/:id/edit" element={<AdminEditNoticePage />} />
              <Route path="/admin/faqs" element={<AdminFAQsPage />} />
              <Route path="/admin/banners" element={<AdminBannersPage />} />
              <Route path="/admin/popups" element={<AdminPopupsPage />} />
              <Route path="/admin/product-qna" element={<AdminProductQnAPage />} />
              <Route path="/admin/inquiries" element={<AdminInquiriesPage />} />
              <Route path="/admin/subscriptions" element={<AdminSubscriptionsPage />} />
              <Route path="/admin/refunds" element={<AdminRefundsPage />} />
              <Route path="/admin/settings" element={<AdminSettingsPage />} />
              <Route path="/admin/settings/shipping" element={<AdminShippingSettingsPage />} />
              <Route path="/admin/settings/roles" element={<AdminRolesPage />} />
              <Route path="/admin/settings/signup-fields" element={<AdminSignupFieldsPage />} />
              <Route path="/admin/statistics" element={<AdminStatisticsPage />} />
              <Route path="/admin/themes" element={<AdminThemesPage />} />
              <Route path="/admin/themes/layout-editor" element={<AdminLayoutEditorPage />} />
              <Route path="/admin/skins" element={<AdminSkinsPage />} />
              <Route path="/admin/menus" element={<AdminMenusPage />} />
              <Route path="/admin/terms" element={<AdminTermsPage />} />
              <Route path="/admin/user-levels" element={<AdminUserLevelsPage />} />
              <Route path="/admin/external-connections" element={<AdminExternalConnectionsPage />} />
              <Route path="/admin/payment-gateways" element={<AdminPaymentGatewaysPage />} />
              <Route path="/admin/logs" element={<AdminLogsPage />} />
              <Route path="/admin/ip-blocks" element={<AdminIpBlocksPage />} />
              <Route path="/admin/visitors" element={<AdminVisitorsPage />} />
              <Route path="/admin/webhooks" element={<AdminWebhooksPage />} />
              <Route path="/admin/pages" element={<AdminPagesPage />} />
            </Route>
          </Route>
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  );
}

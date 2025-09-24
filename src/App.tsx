import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";

// Critical pages loaded immediately
import Index from "./pages/Index";
const EmailConfirmationPage = lazy(() => import("./pages/EmailConfirmationPage"));
const AuthRedirect = lazy(() => import("./pages/AuthRedirect"));

// Non-critical pages loaded lazily
const ClientLogin = lazy(() => import("./pages/ClientLogin"));
const SportsFacilityLogin = lazy(() => import("./pages/SportsFacilityLogin"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const FacilitiesPage = lazy(() => import("./pages/FacilitiesPage"));
const BookingPage = lazy(() => import("./pages/BookingPage"));
const PaymentPage = lazy(() => import("./pages/PaymentPage"));
const FacilityRegister = lazy(() => import("./pages/FacilityRegister"));
const AddFacilityPage = lazy(() => import("./pages/AddFacilityPage"));
const EditFacilityPage = lazy(() => import("./pages/EditFacilityPage"));
const EditSportsComplexPage = lazy(() => import("./pages/EditSportsComplexPage"));
const AdminEditSportsComplexPage = lazy(() => import("./pages/AdminEditSportsComplexPage"));
const EditSportsComplexSettingsPage = lazy(() => import("./pages/EditSportsComplexSettingsPage"));
const ManageFacilitiesPage = lazy(() => import("./pages/ManageFacilitiesPage"));
const ClientRegister = lazy(() => import("./pages/ClientRegister"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const MyReservationsPage = lazy(() => import("./pages/MyReservationsPage"));
const FacilityCalendarPage = lazy(() => import("./pages/FacilityCalendarPage"));
const FacilityCalendarSelectPage = lazy(() => import("./pages/FacilityCalendarSelectPage"));
const FacilityOwnerProfilePage = lazy(() => import("./pages/FacilityOwnerProfilePage"));
const ClientProfilePage = lazy(() => import("./pages/ClientProfilePage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ArticlesPage = lazy(() => import("./pages/ArticlesPage"));
const PaymentSuccessPage = lazy(() => import("./pages/PaymentSuccessPage"));
const PlatformPaymentsPage = lazy(() => import("./pages/PlatformPaymentsPage"));
const FacilityOwnerIncomePage = lazy(() => import("./pages/FacilityOwnerIncomePage"));

const queryClient = new QueryClient();

// Loading component for lazy loaded pages
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
 );
 
// Redirect auth tokens in hash or query to proper routes
const AuthHashRedirect = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const { hash, search, pathname } = window.location;

    const hasRecoveryParams = /type=recovery|token_hash=/.test(hash) || /type=recovery|token_hash=/.test(search);
    const hasSignupParams = /(type=signup|access_token=|code=|token_hash=)/.test(hash) || /(type=signup|code=|token_hash=)/.test(search);

    // Password recovery -> Reset Password page
    if (hasRecoveryParams && pathname !== '/reset-password') {
      navigate('/reset-password' + (search || '') + (hash || ''), { replace: true });
      return;
    }

    // Email confirmation -> Email Confirmation page
    if (hasSignupParams && pathname !== '/email-confirmation') {
      navigate('/email-confirmation' + (search || '') + (hash || ''), { replace: true });
    }
  }, [navigate]);
  return null;
};
 

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
<AuthHashRedirect />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/client/login" element={<ClientLogin />} />
            <Route path="/client/register" element={<ClientRegister />} />
            <Route path="/facility/login" element={<SportsFacilityLogin />} />
            <Route path="/facility/register" element={<FacilityRegister />} />
            <Route path="/add-facility" element={<AddFacilityPage />} />
            <Route path="/edit-facility/:id" element={<EditFacilityPage />} />
            <Route path="/admin/edit-sports-complex/:ownerId" element={<AdminEditSportsComplexPage />} />
            <Route path="/edit-sports-complex-settings" element={<EditSportsComplexSettingsPage />} />
            <Route path="/manage-facilities" element={<ManageFacilitiesPage />} />
            <Route path="/facility-calendar" element={<FacilityCalendarSelectPage />} />
            <Route path="/facility-calendar/:facilityId" element={<FacilityCalendarPage />} />
            <Route path="/facility-owner-profile" element={<FacilityOwnerProfilePage />} />
            <Route path="/client-profile" element={<ClientProfilePage />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/facilities" element={<FacilitiesPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/articles" element={<ArticlesPage />} />
            <Route path="/email-confirmation" element={<EmailConfirmationPage />} />
            <Route path="/verify" element={<AuthRedirect />} />
            <Route path="/auth/*" element={<AuthRedirect />} />
            <Route path="/auth/v1/verify" element={<AuthRedirect />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/my-reservations" element={<MyReservationsPage />} />
            <Route path="/booking/:facilityId" element={<BookingPage />} />
            <Route path="/payment/:facilityId" element={<PaymentPage />} />
            <Route path="/payment-success" element={<PaymentSuccessPage />} />
            <Route path="/platform-payments" element={<PlatformPaymentsPage />} />
            <Route path="/facility-owner-income" element={<FacilityOwnerIncomePage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

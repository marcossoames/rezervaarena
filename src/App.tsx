import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";

// Critical pages loaded immediately
import Index from "./pages/Index";

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
const EditSportsComplexSettingsPage = lazy(() => import("./pages/EditSportsComplexSettingsPage"));
const ManageFacilitiesPage = lazy(() => import("./pages/ManageFacilitiesPage"));
const ClientRegister = lazy(() => import("./pages/ClientRegister"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const MyReservationsPage = lazy(() => import("./pages/MyReservationsPage"));
const FacilityCalendarPage = lazy(() => import("./pages/FacilityCalendarPage"));
const FacilityOwnerProfilePage = lazy(() => import("./pages/FacilityOwnerProfilePage"));
const ClientProfilePage = lazy(() => import("./pages/ClientProfilePage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ArticlesPage = lazy(() => import("./pages/ArticlesPage"));
const PaymentSuccessPage = lazy(() => import("./pages/PaymentSuccessPage"));
const PlatformPaymentsPage = lazy(() => import("./pages/PlatformPaymentsPage"));

const queryClient = new QueryClient();

// Loading component for lazy loaded pages
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/client/login" element={<ClientLogin />} />
            <Route path="/client/register" element={<ClientRegister />} />
            <Route path="/facility/login" element={<SportsFacilityLogin />} />
            <Route path="/facility/register" element={<FacilityRegister />} />
            <Route path="/add-facility" element={<AddFacilityPage />} />
            <Route path="/edit-facility/:id" element={<EditFacilityPage />} />
            <Route path="/admin/edit-sports-complex/:ownerId" element={<EditSportsComplexPage />} />
            <Route path="/edit-sports-complex-settings" element={<EditSportsComplexSettingsPage />} />
            <Route path="/manage-facilities" element={<ManageFacilitiesPage />} />
            <Route path="/facility-calendar/:facilityId" element={<FacilityCalendarPage />} />
            <Route path="/facility-owner-profile" element={<FacilityOwnerProfilePage />} />
            <Route path="/client-profile" element={<ClientProfilePage />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/facilities" element={<FacilitiesPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/articles" element={<ArticlesPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/my-reservations" element={<MyReservationsPage />} />
            <Route path="/booking/:facilityId" element={<BookingPage />} />
            <Route path="/payment/:facilityId" element={<PaymentPage />} />
            <Route path="/payment-success" element={<PaymentSuccessPage />} />
            <Route path="/platform-payments" element={<PlatformPaymentsPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import ClientLogin from "./pages/ClientLogin";
import SportsFacilityLogin from "./pages/SportsFacilityLogin";
import AdminLogin from "./pages/AdminLogin";
import FacilitiesPage from "./pages/FacilitiesPage";
import BookingPage from "./pages/BookingPage";
import PaymentPage from "./pages/PaymentPage";
import FacilityRegister from "./pages/FacilityRegister";
import AddFacilityPage from "./pages/AddFacilityPage";
import EditFacilityPage from "./pages/EditFacilityPage";
import EditSportsComplexPage from "./pages/EditSportsComplexPage";
import EditSportsComplexSettingsPage from "./pages/EditSportsComplexSettingsPage";
import ManageFacilitiesPage from "./pages/ManageFacilitiesPage";
import ClientRegister from "./pages/ClientRegister";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import AdminDashboard from "./pages/AdminDashboard";
import MyReservationsPage from "./pages/MyReservationsPage";
import FacilityCalendarPage from "./pages/FacilityCalendarPage";
import FacilityOwnerProfilePage from "./pages/FacilityOwnerProfilePage";
import ClientProfilePage from "./pages/ClientProfilePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/my-reservations" element={<MyReservationsPage />} />
          <Route path="/booking/:facilityId" element={<BookingPage />} />
          <Route path="/payment/:facilityId" element={<PaymentPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

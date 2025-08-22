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
import FacilityRegister from "./pages/FacilityRegister";
import ClientRegister from "./pages/ClientRegister";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import AdminDashboard from "./pages/AdminDashboard";
import MyReservationsPage from "./pages/MyReservationsPage";
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
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/facilities" element={<FacilitiesPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/my-reservations" element={<MyReservationsPage />} />
          <Route path="/booking/:facilityId" element={<BookingPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

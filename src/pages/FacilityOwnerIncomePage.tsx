import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ResponsiveHeader from "@/components/ResponsiveHeader";
import Footer from "@/components/Footer";
import FacilityIncomeManagement from "@/components/facility/FacilityIncomeManagement";

const FacilityOwnerIncomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <ResponsiveHeader />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/facility-owner-profile')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Înapoi la profil
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Venituri Baza Sportivă</h1>
          <p className="text-muted-foreground mt-2">
            Vizualizează veniturile din rezervări și comisioanele platformei
          </p>
        </div>

        <FacilityIncomeManagement />
      </main>
      
      <Footer />
    </div>
  );
};

export default FacilityOwnerIncomePage;
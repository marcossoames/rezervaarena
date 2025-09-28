import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Info, CreditCard, Percent } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FacilityIncomeManagement from "@/components/facility/FacilityIncomeManagement";

const FacilityOwnerIncomePage = () => {
  const navigate = useNavigate();
  const [showPricingInfo, setShowPricingInfo] = useState(true);

  const handleClosePricingInfo = () => {
    setShowPricingInfo(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/facility-owner-profile')}
            className="mb-4 hover:bg-primary/5 border-2 border-primary/20 hover:border-primary hover:text-primary transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Înapoi la profil
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Venituri Baza Sportivă</h1>
          <p className="text-muted-foreground mt-2">
            Vizualizează veniturile din rezervări și comisioanele platformei
          </p>
        </div>

        {/* Pricing Information Dialog */}
        <Dialog open={showPricingInfo} onOpenChange={setShowPricingInfo}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Info className="h-5 w-5 text-blue-600" />
                Informații importante despre comisioane
              </DialogTitle>
              <DialogDescription className="text-base">
                Notificare privind structura de comisioane a platformei
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Current Pricing */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CreditCard className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-2">Comision actual (în vigoare)</h3>
                    <p className="text-blue-800 text-sm">
                      Pentru plățile online cu cardul se percepe în prezent un comision de <span className="font-bold">1,5%</span> din valoarea rezervării, care acoperă costul procesatorului de plăți.
                    </p>
                  </div>
                </div>
              </div>

              {/* Future Pricing */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Percent className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-amber-900 mb-2">Comision viitor</h3>
                    <p className="text-amber-800 text-sm mb-2">
                      Va fi implementat un comision de <span className="font-bold">10%</span> pentru toate tipurile de plăți (cash și online), la o dată ulterioară. Veți fi informați în avans despre această modificare.
                    </p>
                    <p className="text-amber-700 text-xs">
                      <strong>Notă:</strong> Calculele din secțiunea de venituri iau în considerare acest comision de 10%, deși acesta nu se aplică încă.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  onClick={handleClosePricingInfo}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Am înțeles
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <FacilityIncomeManagement />
      </main>
      
      <Footer />
    </div>
  );
};

export default FacilityOwnerIncomePage;
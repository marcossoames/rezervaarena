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
  const [showPricingInfo, setShowPricingInfo] = useState(false);

  useEffect(() => {
    // Check if user has already seen the pricing info popup
    const hasSeenPricingInfo = localStorage.getItem('facility-pricing-info-seen');
    if (!hasSeenPricingInfo) {
      setShowPricingInfo(true);
    }
  }, []);

  const handleClosePricingInfo = () => {
    setShowPricingInfo(false);
    localStorage.setItem('facility-pricing-info-seen', 'true');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
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
                    <p className="text-blue-800 text-sm mb-2">
                      Pentru plățile online cu cardul se percepe în prezent un comision redus de doar <span className="font-bold">1,5%</span> din valoarea rezervării.
                    </p>
                    <p className="text-blue-700 text-xs">
                      Acest comision acoperă costurile de procesare a plăților și administrarea platformei.
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
                      Începând cu <span className="font-bold">1 martie 2025</span>, comisionul standard va fi de <span className="font-bold">10%</span> pentru toate rezervările (cash și online).
                    </p>
                    <p className="text-amber-700 text-xs">
                      Veți fi notificați cu cel puțin 30 de zile înainte de această modificare prin email și pe platformă.
                    </p>
                  </div>
                </div>
              </div>

              {/* Benefits */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-2">Ce includem în comision:</h3>
                <ul className="text-green-800 text-sm space-y-1">
                  <li>• Procesarea plăților online securizate</li>
                  <li>• Gestionarea rezervărilor și a calendarului</li>
                  <li>• Promovarea facilității pe platformă</li>
                  <li>• Suport tehnic și pentru clienți</li>
                  <li>• Rapoarte financiare detaliate</li>
                </ul>
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
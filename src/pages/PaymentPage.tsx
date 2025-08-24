import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  Banknote, 
  MapPin, 
  Clock, 
  ChevronLeft,
  CheckCircle
} from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Facility {
  id: string;
  name: string;
  description: string;
  facility_type: string;
  city: string;
  address: string;
  price_per_hour: number;
  capacity: number;
  amenities: string[];
  images: string[];
}

const PaymentPage = () => {
  const { facilityId } = useParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  // Get booking details from URL params
  const selectedDate = searchParams.get('date');
  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');
  const totalPrice = searchParams.get('totalPrice');
  const duration = searchParams.get('duration');
  
  const [facility, setFacility] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'card' | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    const loadFacility = async () => {
      if (!facilityId) return;

      try {
        const { data, error } = await supabase
          .from('facilities')
          .select('*')
          .eq('id', facilityId)
          .eq('is_active', true)
          .single();

        if (error || !data) {
          toast({
            title: "Eroare",
            description: "Facilitatea nu a fost găsită",
            variant: "destructive"
          });
          return;
        }

        setFacility(data);
      } catch (error) {
        console.error('Error loading facility:', error);
        toast({
          title: "Eroare",
          description: "Nu s-a putut încărca facilitatea",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadFacility();
  }, [facilityId, toast]);

  const handleCashPayment = async () => {
    if (!facility || !selectedDate || !startTime || !endTime) return;
    
    setProcessingPayment(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Eroare",
          description: "Trebuie să fiți autentificat pentru a face o rezervare",
          variant: "destructive"
        });
        return;
      }

      // Create booking with cash payment
      const { error } = await supabase
        .from('bookings')
        .insert({
          facility_id: facilityId,
          client_id: user.id,
          booking_date: selectedDate,
          start_time: startTime,
          end_time: endTime,
          total_price: parseFloat(totalPrice || '0'),
          total_amount: parseFloat(totalPrice || '0'),
          status: 'pending',
          payment_method: 'cash',
          notes: 'Plată cu numerar la fața locului'
        });

      if (error) {
        toast({
          title: "Eroare",
          description: "Nu s-a putut crea rezervarea",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Rezervare confirmată!",
        description: "Rezervarea a fost creată cu succes. Veți plăti cu numerar la fața locului.",
      });

      // Redirect to bookings page or success page
      setTimeout(() => {
        window.location.href = '/my-reservations';
      }, 2000);

    } catch (error) {
      console.error('Error creating booking:', error);
      toast({
        title: "Eroare",
        description: "A apărut o eroare la procesarea rezervării",
        variant: "destructive"
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleCardPayment = async () => {
    if (!facility || !selectedDate || !startTime || !endTime) return;
    
    setProcessingPayment(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Eroare",
          description: "Trebuie să fiți autentificat pentru a face o rezervare",
          variant: "destructive"
        });
        return;
      }

      // Create Stripe checkout session
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          facilityId,
          date: selectedDate,
          time: startTime,
          totalPrice: parseFloat(totalPrice || '0'),
          duration: parseInt(duration || '60')
        }
      });

      if (error || !data?.url) {
        console.error('Error creating payment session:', error);
        toast({
          title: "Eroare",
          description: "Nu s-a putut inițializa plata cu cardul",
          variant: "destructive"
        });
        return;
      }

      // Redirect to Stripe Checkout
      window.open(data.url, '_blank');
      
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Eroare",
        description: "A apărut o eroare la procesarea plății",
        variant: "destructive"
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  if (loading || !facility) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg text-muted-foreground">Se încarcă...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link 
            to={`/booking/${facilityId}`} 
            className="text-primary hover:underline flex items-center mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Înapoi la rezervare
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Opțiuni de Plată</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Booking Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Sumar Rezervare</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Teren:</span>
                    <span className="font-medium">{facility.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Locație:</span>
                    <span className="font-medium">{facility.address}, {facility.city}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data:</span>
                    <span className="font-medium">
                      {selectedDate && format(new Date(selectedDate), 'dd MMM yyyy', { locale: ro })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ora:</span>
                    <span className="font-medium">{startTime} - {endTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Durată:</span>
                    <span className="font-medium">{duration}</span>
                  </div>
                </div>
                
                <div className="border-t border-border pt-4">
                  <div className="flex justify-between text-xl font-bold">
                    <span>Total de plată:</span>
                    <span className="text-primary">{totalPrice} RON</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Options */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Selectează metoda de plată</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Cash Payment Option */}
                <Card 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedPaymentMethod === 'cash' 
                      ? 'ring-2 ring-primary border-primary' 
                      : 'border-border'
                  }`}
                  onClick={() => setSelectedPaymentMethod('cash')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <Banknote className="h-8 w-8 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">Plată cu numerar</h3>
                        <p className="text-sm text-muted-foreground">
                          Plătești la fața locului când ajungi la baza sportivă
                        </p>
                      </div>
                      {selectedPaymentMethod === 'cash' && (
                        <CheckCircle className="h-6 w-6 text-primary" />
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Card Payment Option */}
                <Card 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedPaymentMethod === 'card' 
                      ? 'ring-2 ring-primary border-primary' 
                      : 'border-border'
                  }`}
                  onClick={() => setSelectedPaymentMethod('card')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <CreditCard className="h-8 w-8 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">Plată cu cardul</h3>
                         <p className="text-sm text-muted-foreground">
                           Plătești online cu cardul bancar (securizat prin Stripe)
                         </p>
                      </div>
                      {selectedPaymentMethod === 'card' && (
                        <CheckCircle className="h-6 w-6 text-primary" />
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="pt-4 space-y-3">
                  {selectedPaymentMethod === 'cash' && (
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={handleCashPayment}
                      disabled={processingPayment}
                    >
                      {processingPayment ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Se procesează...
                        </>
                      ) : (
                        'Confirmă rezervarea (Plată numerar)'
                      )}
                    </Button>
                  )}
                  
                   {selectedPaymentMethod === 'card' && (
                     <Button 
                       className="w-full" 
                       size="lg"
                       onClick={handleCardPayment}
                       disabled={processingPayment}
                     >
                       {processingPayment ? (
                         <>
                           <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                           Se procesează...
                         </>
                       ) : (
                         'Plătește cu cardul online'
                       )}
                     </Button>
                   )}
                  
                  {!selectedPaymentMethod && (
                    <Button 
                      className="w-full" 
                      size="lg"
                      disabled
                      variant="outline"
                    >
                      Selectează o metodă de plată
                    </Button>
                  )}
                </div>

                <div className="text-xs text-muted-foreground text-center pt-2">
                  Rezervarea poate fi anulată cu 24 de ore înainte de începere
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default PaymentPage;
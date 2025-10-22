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
import { getFacilityTypeLabel } from "@/utils/facilityTypes";

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
  owner_id: string;
  // Sports complex information
  sports_complex_name?: string;
  sports_complex_address?: string;
  phone_number?: string;
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
          .rpc('get_facility_for_payment_secure', { facility_id_param: facilityId })
          .maybeSingle();

        if (error || !data) {
          toast({
            title: "Eroare",
            description: "Facilitatea nu a fost găsită",
            variant: "destructive"
          });
          return;
        }

        // The function already provides all needed data including owner_id
        const facilityWithSportsComplex = {
          id: data.id,
          name: data.name,
          description: '', // Not needed for payment page
          facility_type: data.facility_type,
          city: data.city,
          address: data.address || data.city, // Use full address from DB
          price_per_hour: data.price_per_hour,
          capacity: data.capacity,
          amenities: data.amenities,
          images: data.images,
          owner_id: data.owner_id,
          sports_complex_name: data.sports_complex_name,
          sports_complex_address: data.sports_complex_address || data.address || data.city, // Use full address
          phone_number: '' // Don't expose phone for security
        };

        // Owner ID is already included in the response
        setFacility(facilityWithSportsComplex);
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

      // Use the secure server-side booking function
      const { data: bookingId, error } = await supabase.rpc('create_cash_booking_secure', {
        p_facility_id: facilityId,
        p_booking_date: selectedDate,
        p_start_time: startTime,
        p_end_time: endTime
      });

      if (error) {
        // Provide specific error messages for common validation failures
        let errorMessage = error.message || "Nu s-a putut crea rezervarea";
        
        if (error.message?.includes('overlaps')) {
          errorMessage = "Intervalul selectat este deja rezervat. Vă rugăm să selectați alt interval orar.";
        } else if (error.message?.includes('blocked') || error.message?.includes('blocat')) {
          errorMessage = "Intervalul selectat este blocat. Vă rugăm să selectați alt interval orar.";
        } else if (error.message?.includes('past')) {
          errorMessage = "Nu puteți rezerva în trecut. Vă rugăm să selectați o dată viitoare.";
        } else if (error.message?.includes('operating hours')) {
          errorMessage = "Intervalul selectat este în afara orelor de funcționare.";
        }
        
        toast({
          title: "Rezervarea nu poate fi procesată",
          description: errorMessage,
          variant: "destructive"
        });
        return;
      }

      // Send booking confirmation emails for cash bookings
      if (bookingId) {
        try {
          console.log('Sending booking confirmation emails for cash booking:', bookingId);
          const emailResponse = await supabase.functions.invoke('send-booking-confirmation', {
            body: { bookingId: bookingId }
          });
          
          console.log('Email response:', emailResponse);
          
          if (emailResponse.error) {
            console.error('Error sending confirmation emails:', emailResponse.error);
          } else {
            console.log('Confirmation emails sent successfully for cash booking');
          }
        } catch (emailError) {
          console.error('Failed to send confirmation emails:', emailError);
          // Don't show error to user as booking was successful
        }
      }

      toast({
        title: "Rezervare confirmată!",
        description: "Rezervarea a fost creată cu succes. Veți plăti cu numerar la fața locului. Veți primi un email de confirmare în scurt timp.",
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
      console.log('Creating platform payment with data:', {
        facilityId: facility.id,
        bookingDate: selectedDate,
        startTime,
        endTime
      });

      const { data, error } = await supabase.functions.invoke('create-platform-payment', {
        body: {
          facilityId: facility.id,
          bookingDate: selectedDate,
          startTime,
          endTime
        },
      });

      if (error) {
        console.error('Payment creation error:', error);
        toast({
          title: "Eroare la procesarea plății",
          description: (error as any)?.message || "A apărut o eroare la crearea sesiunii de plată.",
          variant: "destructive",
        });
        return;
      }

      if (data?.error) {
        console.warn('Payment creation server message:', data.error);
        toast({
          title: "Plata nu poate fi inițiată",
          description: String(data.error),
          variant: "destructive",
        });
        return;
      }

      if (data?.url) {
        console.log('Redirecting to Stripe checkout:', data.url);
        // Redirect to Stripe checkout in the same tab for proper return flow
        window.location.href = data.url;
      } else {
        throw new Error('Nu s-a primit URL-ul de checkout');
      }
    } catch (error) {
      console.error('Error during payment:', error);
      toast({
        title: "Eroare",
        description: "A apărut o eroare neașteptată.",
        variant: "destructive",
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
            className="text-primary hover:underline hover:bg-primary/5 border-2 border-primary/20 hover:border-primary rounded-md px-3 py-2 transition-all duration-200 flex items-center mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Înapoi la rezervare
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Opțiuni de Plată</h1>
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
                  {/* Sports Complex Info */}
                  <div className="pb-3 border-b border-border">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Baza sportivă:</span>
                        <span className="font-medium text-right">{facility.sports_complex_name || 'Baza Sportivă'}</span>
                      </div>
                      {facility.sports_complex_address && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Adresa:</span>
                          <span className="font-medium text-right text-sm">{facility.sports_complex_address}</span>
                        </div>
                      )}
                      {facility.phone_number && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Telefon:</span>
                          <span className="font-medium text-right">
                            <a href={`tel:${facility.phone_number}`} className="text-primary hover:underline">
                              {facility.phone_number}
                            </a>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Booking Details */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Teren:</span>
                      <span className="font-medium">{facility.name}</span>
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

                {/* Card Payment Option - Always available now */}
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
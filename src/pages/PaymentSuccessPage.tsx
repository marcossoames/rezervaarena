import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PaymentSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const sessionId = searchParams.get('session_id');
  
  const [paymentStatus, setPaymentStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [isLoading, setIsLoading] = useState(true);
  const [bookingId, setBookingId] = useState<string | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId) {
        setPaymentStatus('failed');
        setIsLoading(false);
        return;
      }

      try {
        console.log('Verifying payment for session:', sessionId);

        const { data, error } = await supabase.functions.invoke('verify-platform-payment', {
          body: { sessionId }
        });

        if (error) {
          console.error('Error verifying payment:', error);
          toast({
            title: "Eroare",
            description: "Eroare la verificarea plății",
            variant: "destructive"
          });
          setPaymentStatus('failed');
          return;
        }

        console.log('Payment verification result:', data);

        if (data.status === 'success') {
          setPaymentStatus('success');
          setBookingId(data.bookingId);
          
          toast({
            title: "Plată reușită!",
            description: "Plata a fost procesată cu succes! Rezervarea dumneavoastră a fost confirmată. Veți primi un email de confirmare în scurt timp.",
          });
          
          // Redirect to the specific booking after successful payment without logging out
          setTimeout(() => {
            window.location.href = `/my-reservations?highlight=${data.bookingId || 'latest'}`;
          }, 2000);
        } else {
          setPaymentStatus('failed');
          toast({
            title: "Plată nereușită",
            description: "Plata nu a fost finalizată",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Error:', error);
        setPaymentStatus('failed');
        toast({
          title: "Eroare",
          description: "Eroare la verificarea plății",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    verifyPayment();
  }, [sessionId, toast]);

  const getStatusIcon = () => {
    switch (paymentStatus) {
      case 'success':
        return <CheckCircle className="h-16 w-16 text-green-500" />;
      case 'failed':
        return <XCircle className="h-16 w-16 text-red-500" />;
      default:
        return <Clock className="h-16 w-16 text-yellow-500 animate-pulse" />;
    }
  };

  const getStatusTitle = () => {
    switch (paymentStatus) {
      case 'success':
        return 'Plată reușită!';
      case 'failed':
        return 'Plată nereușită';
      default:
        return 'Se verifică plata...';
    }
  };

  const getStatusMessage = () => {
    switch (paymentStatus) {
      case 'success':
        return 'Rezervarea a fost confirmată cu succes. Vă așteptăm la baza sportivă!';
      case 'failed':
        return 'Plata nu a putut fi procesată. Vă rugăm să încercați din nou sau să alegeți plata cu numerar.';
      default:
        return 'Vă rugăm să așteptați...';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Status Plată</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="flex justify-center">
                {getStatusIcon()}
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">{getStatusTitle()}</h2>
                <p className="text-muted-foreground">{getStatusMessage()}</p>
              </div>

              {sessionId && (
                <div className="text-xs text-muted-foreground">
                  ID Sesiune: {sessionId}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {paymentStatus === 'success' && (
                  <>
                    <p className="text-sm text-muted-foreground mb-2">
                      Veți fi redirectionat automat către rezervarea dumneavoastră în 2 secunde...
                    </p>
                    <Link to={`/my-reservations?highlight=${bookingId || 'latest'}`}>
                      <Button className="w-full sm:w-auto">
                        Vezi rezervarea făcută
                      </Button>
                    </Link>
                  </>
                )}
                
                <Link to="/">
                  <Button variant="outline" className="w-full sm:w-auto">
                    Înapoi la pagina principală
                  </Button>
                </Link>
                
                {paymentStatus === 'failed' && (
                  <Link to="/facilities">
                    <Button variant="outline" className="w-full sm:w-auto">
                      Încearcă din nou
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default PaymentSuccessPage;
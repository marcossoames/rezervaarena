import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, Clock, XCircle, Banknote, CreditCard } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ro } from "date-fns/locale";

interface PlatformPayment {
  id: string;
  total_amount: number;
  platform_fee_amount: number;
  facility_owner_amount: number;
  payment_status: string;
  distributed_status: string;
  created_at: string;
  distributed_at?: string;
  // Related data
  facility_name: string;
  facility_owner_name: string;
  client_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
}

const PlatformPaymentsPage = () => {
  const { toast } = useToast();
  const [payments, setPayments] = useState<PlatformPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Eroare",
          description: "Trebuie să fiți autentificat",
          variant: "destructive"
        });
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        toast({
          title: "Acces interzis",
          description: "Nu aveți permisiunea să accesați această pagină",
          variant: "destructive"
        });
        return;
      }

      setUserRole(profile.role);
      loadPayments();
    } catch (error) {
      console.error('Error checking user role:', error);
      toast({
        title: "Eroare",
        description: "A apărut o eroare la verificarea permisiunilor",
        variant: "destructive"
      });
    }
  };

  const loadPayments = async () => {
    try {
      setLoading(true);

      // Get platform payments with booking details
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('platform_payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (paymentsError) {
        throw paymentsError;
      }

      // Get related data for each payment
      const formattedPayments = [];
      
      for (const payment of paymentsData) {
        // Get booking details
        const { data: booking } = await supabase
          .from('bookings')
          .select(`
            booking_date,
            start_time,
            end_time,
            client_id,
            facility_id
          `)
          .eq('id', payment.booking_id)
          .single();

        if (!booking) continue;

        // Get facility details
        const { data: facility } = await supabase
          .from('facilities')
          .select('name')
          .eq('id', booking.facility_id)
          .single();

        // Get client details
        const { data: client } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', booking.client_id)
          .single();

        // Get facility owner details
        const { data: owner } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', payment.facility_owner_id)
          .single();

        formattedPayments.push({
          id: payment.id,
          total_amount: payment.total_amount,
          platform_fee_amount: payment.platform_fee_amount,
          facility_owner_amount: payment.facility_owner_amount,
          payment_status: payment.payment_status,
          distributed_status: payment.distributed_status,
          created_at: payment.created_at,
          distributed_at: payment.distributed_at,
          facility_name: facility?.name || 'Necunoscut',
          facility_owner_name: owner?.full_name || 'Necunoscut',
          client_name: client?.full_name || 'Necunoscut',
          booking_date: booking.booking_date,
          start_time: booking.start_time,
          end_time: booking.end_time
        });
      }

      setPayments(formattedPayments);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca plățile",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsDistributed = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from('platform_payments')
        .update({
          distributed_status: 'distributed',
          distributed_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      if (error) {
        throw error;
      }

      toast({
        title: "Succes",
        description: "Plata a fost marcată ca distribuită"
      });

      // Reload payments
      loadPayments();
    } catch (error) {
      console.error('Error marking payment as distributed:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut actualiza statusul plății",
        variant: "destructive"
      });
    }
  };

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getDistributedStatusBadge = (status: string) => {
    switch (status) {
      case 'distributed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Distribuit</Badge>;
      case 'failed':
        return <Badge variant="destructive">Eșuat</Badge>;
      default:
        return <Badge variant="secondary">În așteptare</Badge>;
    }
  };

  const getTotalStats = () => {
    const paidPayments = payments.filter(p => p.payment_status === 'paid');
    const pendingDistribution = paidPayments.filter(p => p.distributed_status === 'pending');
    
    return {
      totalCollected: paidPayments.reduce((sum, p) => sum + p.total_amount, 0),
      totalFees: paidPayments.reduce((sum, p) => sum + p.platform_fee_amount, 0),
      pendingDistribution: pendingDistribution.reduce((sum, p) => sum + p.facility_owner_amount, 0),
      pendingCount: pendingDistribution.length
    };
  };

  if (userRole !== 'admin') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Acces interzis</h1>
            <p className="text-muted-foreground">Nu aveți permisiunea să accesați această pagină.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (loading) {
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

  const stats = getTotalStats();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard Plăți Platformă</h1>
          <p className="text-muted-foreground">
            Urmărește și gestionează toate plățile și distribuirile către bazele sportive
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total colectat</CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCollected.toFixed(2)} RON</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comisioane platformă</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalFees.toFixed(2)} RON</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">De distribuit</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingDistribution.toFixed(2)} RON</div>
              <p className="text-xs text-muted-foreground">{stats.pendingCount} plăți</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total plăți</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{payments.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Istoric Plăți</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Facilitate</TableHead>
                  <TableHead>Proprietar</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Comision</TableHead>
                  <TableHead>De distribuit</TableHead>
                  <TableHead>Status Plată</TableHead>
                  <TableHead>Status Distribuire</TableHead>
                  <TableHead>Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(payment.created_at), 'dd MMM yyyy', { locale: ro })}
                        <br />
                        <span className="text-muted-foreground text-xs">
                          {payment.booking_date} {payment.start_time}-{payment.end_time}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{payment.client_name}</TableCell>
                    <TableCell>{payment.facility_name}</TableCell>
                    <TableCell>{payment.facility_owner_name}</TableCell>
                    <TableCell className="font-mono">{payment.total_amount.toFixed(2)} RON</TableCell>
                    <TableCell className="font-mono">{payment.platform_fee_amount.toFixed(2)} RON</TableCell>
                    <TableCell className="font-mono">{payment.facility_owner_amount.toFixed(2)} RON</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getPaymentStatusIcon(payment.payment_status)}
                        <span className="capitalize">{payment.payment_status}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getDistributedStatusBadge(payment.distributed_status)}
                    </TableCell>
                    <TableCell>
                      {payment.payment_status === 'paid' && payment.distributed_status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => markAsDistributed(payment.id)}
                          className="text-xs"
                        >
                          Marchează distribuit
                        </Button>
                      )}
                      {payment.distributed_status === 'distributed' && payment.distributed_at && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(payment.distributed_at), 'dd MMM yyyy', { locale: ro })}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {payments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nu există plăți înregistrate încă.
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
};

export default PlatformPaymentsPage;
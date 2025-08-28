import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, MapPin, CreditCard, Banknote, CheckCircle, XCircle, AlertTriangle, RefreshCw, User, Building2 } from "lucide-react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  total_price: number;
  status: string;
  payment_method: string;
  notes?: string;
  created_at: string;
  facility?: {
    name: string;
    facility_type: string;
    city: string;
    address: string;
  };
}

interface UserBookingsDialogProps {
  userId: string;
  userName: string;
  userEmail: string;
  isOpen: boolean;
  onClose: () => void;
}

const UserBookingsDialog = ({ userId, userName, userEmail, isOpen, onClose }: UserBookingsDialogProps) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0,
    totalValue: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserBookings();
    }
  }, [isOpen, userId]);

  const fetchUserBookings = async () => {
    try {
      setIsLoading(true);
      
      const { data: bookingsData, error } = await supabase
        .from('bookings')
        .select(`
          *,
          facility:facilities!bookings_facility_id_fkey (
            name,
            facility_type,
            city,
            address
          )
        `)
        .eq('client_id', userId)
        .order('booking_date', { ascending: false });

      if (error) throw error;

      setBookings(bookingsData || []);

      // Calculate stats
      const bookingsList = bookingsData || [];
      const stats = {
        total: bookingsList.length,
        confirmed: bookingsList.filter(b => b.status === 'confirmed').length,
        completed: bookingsList.filter(b => b.status === 'completed').length,
        cancelled: bookingsList.filter(b => b.status === 'cancelled').length,
        no_show: bookingsList.filter(b => b.status === 'no_show').length,
        totalValue: bookingsList.reduce((sum, b) => sum + (b.total_price || 0), 0)
      };
      setStats(stats);

    } catch (error: any) {
      console.error('Error fetching user bookings:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca rezervările utilizatorului",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="default" className="bg-blue-100 text-blue-800"><CheckCircle className="w-3 h-3 mr-1" />Confirmată</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Finalizată</Badge>;
      case 'cancelled':
        return <Badge variant="destructive" className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Anulată</Badge>;
      case 'no_show':
        return <Badge variant="destructive" className="bg-orange-100 text-orange-800"><AlertTriangle className="w-3 h-3 mr-1" />Lipsă</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    return method === 'cash' ? <Banknote className="w-4 h-4 text-orange-600" /> : <CreditCard className="w-4 h-4 text-blue-600" />;
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd MMM yyyy', { locale: ro });
  };

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5); // Format HH:MM
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-xl font-bold">Rezervările utilizatorului</div>
              <div className="text-sm text-muted-foreground font-normal">
                {userName} • {userEmail}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <p className="text-muted-foreground">Se încarcă rezervările...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{stats.total}</div>
                    <div className="text-xs text-muted-foreground">Total rezervări</div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                    <div className="text-xs text-muted-foreground">Finalizate</div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-l-4 border-l-red-500">
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{stats.cancelled + stats.no_show}</div>
                    <div className="text-xs text-muted-foreground">Problematice</div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-l-4 border-l-purple-500">
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{stats.totalValue.toFixed(0)} RON</div>
                    <div className="text-xs text-muted-foreground">Valoare totală</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Bookings Table */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Istoric Rezervări ({bookings.length})
              </h3>
              
              {bookings.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">
                    Utilizatorul nu are rezervări
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data și ora</TableHead>
                        <TableHead>Facilitate</TableHead>
                        <TableHead>Locație</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Plată</TableHead>
                        <TableHead>Preț</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookings.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 font-medium">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {formatDate(booking.booking_date)}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">{booking.facility?.name}</div>
                                <div className="text-sm text-muted-foreground capitalize">
                                  {booking.facility?.facility_type}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">{booking.facility?.city}</div>
                                <div className="text-sm text-muted-foreground">
                                  {booking.facility?.address}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(booking.status)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getPaymentMethodIcon(booking.payment_method)}
                              <span className="capitalize">{booking.payment_method === 'cash' ? 'Numerar' : 'Card'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{booking.total_price} RON</span>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              {booking.notes ? (
                                <div className="text-sm text-muted-foreground truncate" title={booking.notes}>
                                  {booking.notes}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UserBookingsDialog;
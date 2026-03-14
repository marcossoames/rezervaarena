import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  DollarSign, 
  CreditCard, 
  Banknote, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Building2,
  Phone,
  Mail,
  Save,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import ClientBehaviorStats from "@/components/admin/ClientBehaviorStats";
import { getFacilityTypeLabel } from "@/utils/facilityTypes";

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  total_price: number;
  payment_method: string;
  notes?: string;
  created_at: string;
  client_id: string;
  facility_id: string;
}

interface BookingDetailsDialogProps {
  bookingId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const BookingDetailsDialog = ({ bookingId, isOpen, onClose, onUpdate }: BookingDetailsDialogProps) => {
  const [booking, setBooking] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [facility, setFacility] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchBookingDetails();
    }
  }, [isOpen, bookingId]);

  const fetchBookingDetails = async () => {
    if (!bookingId) return;
    
    try {
      setIsLoading(true);
      
      // Fetch booking details
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (bookingError) throw bookingError;

      setBooking(bookingData);
      setNewStatus(bookingData.status as string);
      setNewNotes(bookingData.notes || '');

      // Fetch client details
      const { data: clientData, error: clientError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', bookingData.client_id)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);

      // Fetch facility details
      const { data: facilityData, error: facilityError } = await supabase
        .from('facilities')
        .select('*')
        .eq('id', bookingData.facility_id)
        .single();

      if (facilityError) throw facilityError;
      setFacility(facilityData);

    } catch (error: any) {
      console.error('Error fetching booking details:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca detaliile rezervării",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateBooking = async () => {
    if (!booking) return;

    try {
      setIsUpdating(true);

      const { error } = await supabase
        .from('bookings')
        .update({
           status: newStatus as any,
          notes: newNotes
        })
        .eq('id', booking.id);

      if (error) throw error;

      toast({
        title: "Succes",
        description: "Rezervarea a fost actualizată cu succes",
      });

      onUpdate();
      onClose();

    } catch (error: any) {
      console.error('Error updating booking:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut actualiza rezervarea",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteBooking = async () => {
    if (!booking) return;

    if (!confirm('Ești sigur că vrei să ștergi această rezervare? Această acțiune nu poate fi anulată.')) {
      return;
    }

    try {
      setIsUpdating(true);

      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', booking.id);

      if (error) throw error;

      toast({
        title: "Succes",
        description: "Rezervarea a fost ștearsă cu succes",
      });

      onUpdate();
      onClose();

    } catch (error: any) {
      console.error('Error deleting booking:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut șterge rezervarea",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
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

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-xl font-bold">Detalii Rezervare</div>
              <div className="text-sm text-muted-foreground font-normal">
                {booking && format(new Date(booking.booking_date), 'dd MMMM yyyy', { locale: ro })}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Calendar className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
              <p className="text-muted-foreground">Se încarcă detaliile...</p>
            </div>
          </div>
        ) : booking && client && facility ? (
          <div className="space-y-6">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusBadge(booking.status)}
                <div className="flex items-center gap-2">
                  {getPaymentMethodIcon(booking.payment_method)}
                  <span className="text-sm text-muted-foreground capitalize">
                    {booking.payment_method === 'cash' ? 'Numerar' : 'Card'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">{booking.total_price} RON</div>
                <div className="text-sm text-muted-foreground">Preț total</div>
              </div>
            </div>

            <Separator />

            {/* Main Details Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Booking Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Detalii Rezervare
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{facility.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {getFacilityTypeLabel(facility.facility_type)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <MapPin className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium">{facility.city}</div>
                        <div className="text-sm text-muted-foreground">{facility.address}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                        <Calendar className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {format(new Date(booking.booking_date), 'dd MMMM yyyy', { locale: ro })}
                        </div>
                        <div className="text-sm text-muted-foreground">Data rezervării</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center">
                        <Clock className="h-4 w-4 text-orange-600" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                        </div>
                        <div className="text-sm text-muted-foreground">Interval orar</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Client Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Detalii Client
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <div className="font-medium">{client.full_name}</div>
                        <div className="text-sm text-muted-foreground">Nume complet</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <Mail className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium">{client.email}</div>
                        <div className="text-sm text-muted-foreground">Email</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                        <Phone className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium">{client.phone || 'Nu este specificat'}</div>
                        <div className="text-sm text-muted-foreground">Telefon</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-500/20 rounded-full flex items-center justify-center">
                        <Calendar className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {format(new Date(booking.created_at), 'dd/MM/yyyy HH:mm', { locale: ro })}
                        </div>
                        <div className="text-sm text-muted-foreground">Data rezervării</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Client Behavior Stats */}
            {client && (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Statistici Client
                </h3>
                <ClientBehaviorStats 
                  stats={{
                    user_id: client.user_id,
                    full_name: client.full_name,
                    email: client.email,
                    total_bookings: client.total_bookings || 0,
                    completed_bookings: client.completed_bookings || 0,
                    no_show_bookings: client.no_show_bookings || 0,
                    cancelled_bookings: client.cancelled_bookings || 0
                  }}
                  showDetailed={true}
                />
              </div>
            )}

            <Separator />

            {/* Update Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Actualizare Rezervare</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confirmed">Confirmată</SelectItem>
                      <SelectItem value="completed">Finalizată</SelectItem>
                      <SelectItem value="cancelled">Anulată</SelectItem>
                      <SelectItem value="no_show">Lipsă</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Note</label>
                <Textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Adaugă note despre rezervare..."
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <Button onClick={updateBooking} disabled={isUpdating}>
                  <Save className="h-4 w-4 mr-2" />
                  {isUpdating ? 'Se salvează...' : 'Salvează modificările'}
                </Button>
                
                <Button variant="destructive" onClick={deleteBooking} disabled={isUpdating}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Șterge rezervarea
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Nu s-au putut încărca detaliile rezervării.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BookingDetailsDialog;
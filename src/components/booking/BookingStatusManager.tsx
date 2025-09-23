import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Clock, AlertTriangle, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  total_price: number;
  payment_method: string;
  notes?: string;
  client_id: string;
}

interface BookingStatusManagerProps {
  booking: Booking;
  onStatusUpdate: () => void;
  showStatusUpdate?: boolean;
}

const BookingStatusManager: React.FC<BookingStatusManagerProps> = ({ 
  booking, 
  onStatusUpdate, 
  showStatusUpdate = true 
}) => {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedStatus, setSelectedStatus] = React.useState<'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'>(booking.status);
  const [notes, setNotes] = React.useState(booking.notes || "");
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [availableStatuses, setAvailableStatuses] = React.useState<Array<{value: string, label: string, description: string}>>([]);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { 
          label: 'În așteptare', 
          variant: 'secondary' as const, 
          icon: <Clock className="h-4 w-4" />,
          description: 'Rezervarea așteaptă confirmarea' 
        };
      case 'confirmed':
        return { 
          label: 'Confirmată', 
          variant: 'default' as const, 
          icon: <CheckCircle className="h-4 w-4" />,
          description: 'Rezervarea a fost confirmată' 
        };
      case 'completed':
        return { 
          label: 'Finalizată', 
          variant: 'default' as const, 
          icon: <CheckCircle className="h-4 w-4" />,
          description: 'Clientul a venit și a plătit' 
        };
      case 'no_show':
        return { 
          label: 'Lipsă', 
          variant: 'destructive' as const, 
          icon: <AlertTriangle className="h-4 w-4" />,
          description: 'Clientul nu s-a prezentat' 
        };
      case 'cancelled':
        return { 
          label: 'Anulată', 
          variant: 'outline' as const, 
          icon: <XCircle className="h-4 w-4" />,
          description: 'Rezervarea a fost anulată' 
        };
      default:
        return { 
          label: status, 
          variant: 'outline' as const, 
          icon: <Clock className="h-4 w-4" />,
          description: 'Status necunoscut' 
        };
    }
  };

  const handleStatusUpdate = async () => {
    if (selectedStatus === booking.status && notes === (booking.notes || "")) {
      setIsDialogOpen(false);
      return;
    }

    setIsUpdating(true);
    
    try {
      // Use secure RPC function for facility owners
      const { data, error } = await supabase.rpc('update_booking_status_owner', {
        p_booking_id: booking.id,
        p_new_status: selectedStatus,
        p_notes: notes.trim() || null
      });

      if (error) {
        console.error('RPC error:', error);
        throw new Error(error.message || 'Nu s-a putut actualiza statusul rezervării');
      }

      if (!data) {
        throw new Error('Nu s-a putut actualiza statusul rezervării');
      }

      // Send cancellation email if booking was cancelled
      if (selectedStatus === 'cancelled' && booking.status !== 'cancelled') {
        try {
          console.log('Sending cancellation email for booking:', booking.id);
          
          // Get booking and facility details for the email
          const { data: bookingData, error: bookingError } = await supabase
            .from('bookings')
            .select(`
              id,
              booking_date,
              start_time,
              end_time,
              total_price,
              client_id,
              facility_id,
              facilities (name)
            `)
            .eq('id', booking.id)
            .single();

          if (!bookingError && bookingData) {
            // Get client email
            const { data: profileData } = await supabase
              .from('profiles')
              .select('email')
              .eq('user_id', bookingData.client_id)
              .single();

            if (profileData?.email) {
              const facilityName = (bookingData.facilities as any)?.name || 'Baza sportivă';
              const bookingDetails = {
                date: new Date(bookingData.booking_date).toLocaleDateString('ro-RO'),
                time: `${bookingData.start_time.slice(0, 5)} - ${bookingData.end_time.slice(0, 5)}`,
                price: bookingData.total_price
              };

              const response = await supabase.functions.invoke('send-booking-cancellation-email', {
                body: {
                  bookingIds: [booking.id],
                  clientEmails: [profileData.email],
                  facilityName,
                  reason: notes.trim() || 'Rezervarea a fost anulată de către baza sportivă.',
                  bookingDetails
                }
              });

              console.log('Email function response:', response);
              
              if (response.error) {
                console.error('Email function error:', response.error);
                toast({
                  title: "Avertisment",
                  description: "Statusul a fost actualizat, dar nu s-a putut trimite emailul de notificare.",
                  variant: "destructive"
                });
              } else {
                console.log('Cancellation email sent successfully');
                toast({
                  title: "Email trimis",
                  description: "Clientul a fost notificat prin email despre anulare.",
                });
              }
            }
          }
        } catch (emailError) {
          console.error('Error sending cancellation email:', emailError);
          // Don't block the status update if email fails
        }
      }

      // Only show the main success toast if no specific email toast was shown
      if (selectedStatus !== 'cancelled' || booking.status === 'cancelled') {
        toast({
          title: "Status actualizat",
          description: `Rezervarea a fost marcată ca "${getStatusInfo(selectedStatus).label.toLowerCase()}"`,
        });
      }

      setIsDialogOpen(false);
      onStatusUpdate();
    } catch (error: any) {
      console.error('Error updating booking status:', error);
      toast({
        title: "Eroare",
        description: error.message || "Nu s-a putut actualiza statusul rezervării",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getAvailableStatuses = async () => {
    // Always exclude pending status since we simplified the booking flow
    // Cash bookings are immediately confirmed, card payments are handled via Stripe
    return [
      { value: 'confirmed', label: 'Confirmată', description: 'Rezervarea este confirmată' },
      { value: 'completed', label: 'Finalizată', description: 'Serviciul a fost prestat' },
      { value: 'no_show', label: 'Lipsă', description: 'Clientul nu s-a prezentat' },
      { value: 'cancelled', label: 'Anulată', description: 'Rezervarea a fost anulată' }
    ];
  };

  const statusInfo = getStatusInfo(booking.status);

  return (
    <div className="flex items-center gap-2">
      <Badge variant={statusInfo.variant} className="flex items-center gap-1">
        {statusInfo.icon}
        {statusInfo.label}
      </Badge>
      
      {showStatusUpdate && (
        <Dialog open={isDialogOpen} onOpenChange={async (open) => {
          if (open) {
            const statuses = await getAvailableStatuses();
            setAvailableStatuses(statuses);
          }
          setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <Edit className="h-3 w-3" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Actualizează Status Rezervare</DialogTitle>
              <DialogDescription>
                Modifică statusul rezervării și adaugă notițe dacă e necesar.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status nou</Label>
                <Select 
                  value={selectedStatus} 
                  onValueChange={(value: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show') => setSelectedStatus(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selectează statusul" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStatuses.map(status => (
                      <SelectItem key={status.value} value={status.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{status.label}</span>
                          <span className="text-xs text-muted-foreground">{status.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Notițe (opțional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Adaugă notițe despre rezervare..."
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isUpdating}
                >
                  Anulează
                </Button>
                <Button 
                  onClick={handleStatusUpdate}
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Se actualizează...' : 'Actualizează'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default BookingStatusManager;
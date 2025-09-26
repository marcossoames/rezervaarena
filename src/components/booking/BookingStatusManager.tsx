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
      // For cancellations, use the secure Edge Function which also sends emails and handles refunds
      if (selectedStatus === 'cancelled' && booking.status !== 'cancelled') {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) throw new Error('Nu sunteți autentificat');

        const { data, error } = await supabase.functions.invoke('cancel-booking', {
          body: { bookingId: booking.id },
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (error || (data && (data as any).success === false)) {
          const message = (data as any)?.error || error?.message || 'Nu s-a putut anula rezervarea';
          throw new Error(message);
        }

        toast({
          title: 'Rezervare anulată',
          description: (data as any)?.message || 'Clientul a fost notificat prin email despre anulare.'
        });

        setIsDialogOpen(false);
        onStatusUpdate();
        return;
      }

      // For other status changes, use the RPC
      const { data, error } = await supabase.rpc('update_booking_status_owner', {
        p_booking_id: booking.id,
        p_new_status: selectedStatus,
        p_notes: notes.trim() || null
      });

      if (error || !data) {
        throw new Error(error?.message || 'Nu s-a putut actualiza statusul rezervării');
      }

      toast({
        title: 'Status actualizat',
        description: `Rezervarea a fost marcată ca "${getStatusInfo(selectedStatus).label.toLowerCase()}"`,
      });

      setIsDialogOpen(false);
      onStatusUpdate();
    } catch (error: any) {
      console.error('Error updating booking status:', error);
      toast({
        title: 'Eroare',
        description: error.message || 'A apărut o eroare',
        variant: 'destructive'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getAvailableStatuses = async () => {
    const bookingDate = new Date(booking.booking_date);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const bookingDateStr = bookingDate.toISOString().split('T')[0];
    
    // Base statuses that are always available
    const baseStatuses = [
      { value: 'confirmed', label: 'Confirmată', description: 'Rezervarea este confirmată' },
      { value: 'cancelled', label: 'Anulată', description: 'Rezervarea a fost anulată' }
    ];
    
    // Only allow 'completed' and 'no_show' after booking date has passed
    const postBookingStatuses = [];
    if (bookingDateStr <= todayStr) {
      postBookingStatuses.push(
        { value: 'completed', label: 'Finalizată', description: 'Serviciul a fost prestat' },
        { value: 'no_show', label: 'Lipsă', description: 'Clientul nu s-a prezentat' }
      );
    }
    
    return [...baseStatuses, ...postBookingStatuses];
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
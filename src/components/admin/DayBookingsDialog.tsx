import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, User, DollarSign, Building2 } from "lucide-react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  total_price: number;
  notes?: string;
  created_at: string;
  client_id: string;
  facility_id: string;
  facility_name: string;
  facility_type: string;
  facility_city: string;
  client_name: string;
  client_email: string;
}

interface DayBookingsDialogProps {
  date: Date | null;
  bookings: Booking[];
  isOpen: boolean;
  onClose: () => void;
  onSelectBooking: (bookingId: string) => void;
}

const DayBookingsDialog = ({ date, bookings, isOpen, onClose, onSelectBooking }: DayBookingsDialogProps) => {
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      confirmed: { label: "Confirmată", variant: "default" as const },
      cancelled: { label: "Anulată", variant: "destructive" as const },
      completed: { label: "Finalizată", variant: "outline" as const },
      no_show: { label: "Lipsă", variant: "destructive" as const }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.confirmed;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getFacilityTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      'football': 'Fotbal',
      'tennis': 'Tenis',
      'padel': 'Padel',
      'squash': 'Squash',
      'basketball': 'Baschet',
      'volleyball': 'Volei',
      'foot_tennis': 'Tenis de Picior',
      'ping_pong': 'Ping Pong',
      'other': 'Altele'
    };
    return types[type] || type;
  };

  const getFacilityTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      'football': 'from-green-500 to-green-600',
      'tennis': 'from-orange-500 to-orange-600',
      'padel': 'from-pink-500 to-pink-600',
      'squash': 'from-cyan-500 to-cyan-600',
      'basketball': 'from-purple-500 to-purple-600',
      'volleyball': 'from-blue-500 to-blue-600',
      'foot_tennis': 'from-red-500 to-red-600',
      'ping_pong': 'from-yellow-500 to-yellow-600',
      'other': 'from-gray-500 to-gray-600'
    };
    return colors[type] || colors['other'];
  };

  if (!date) return null;

  const sortedBookings = [...bookings].sort((a, b) => {
    // Sort by time first
    const timeA = a.start_time;
    const timeB = b.start_time;
    if (timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }
    // Then by facility name
    return a.facility_name.localeCompare(b.facility_name);
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Rezervări pentru {format(date, 'dd MMMM yyyy', { locale: ro })}
            <Badge variant="outline">{bookings.length} rezervări</Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {sortedBookings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nu există rezervări pentru această dată.</p>
            </div>
          ) : (
            sortedBookings.map((booking, index) => (
              <div
                key={booking.id}
                className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => {
                  onSelectBooking(booking.id);
                  onClose();
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-8 h-8 bg-gradient-to-r ${getFacilityTypeColor(booking.facility_type)} rounded-full flex items-center justify-center`}>
                        <Building2 className="h-4 w-4 text-white" />
                      </div>
                      <h3 className="font-semibold">{booking.facility_name}</h3>
                      {getStatusBadge(booking.status)}
                      <Badge variant="outline" className="text-xs">
                        {getFacilityTypeLabel(booking.facility_type)}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">{booking.start_time} - {booking.end_time}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{booking.client_name}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        <span className="font-medium">{booking.total_price} RON</span>
                      </div>
                    </div>
                    
                    <div className="mt-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{booking.facility_city}</span>
                      </div>
                    </div>
                    
                    {booking.notes && (
                      <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                        <span className="font-medium">Note:</span> {booking.notes}
                      </div>
                    )}
                  </div>
                  
                  <Button variant="outline" size="sm" className="ml-4">
                    Vezi Detalii
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DayBookingsDialog;
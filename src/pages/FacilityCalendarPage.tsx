import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Calendar as CalendarIcon, Ban, Edit, Eye, Clock, Users, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, startOfDay, endOfDay, isAfter, isBefore, isSameDay } from "date-fns";
import { ro } from "date-fns/locale";

interface Facility {
  id: string;
  name: string;
  facility_type: string;
  description: string;
  price_per_hour: number;
  capacity: number;
  images: string[];
  address: string;
  city: string;
}

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  total_price: number;
  notes?: string;
  client_id: string;
}

interface BlockedDate {
  id: string;
  date: string;
  reason: string;
}

const FacilityCalendarPage = () => {
  const { facilityId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [facility, setFacility] = useState<Facility | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [blockReason, setBlockReason] = useState("");
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  
  // Restricții pentru proprietarii de facilități: modificări doar de la astăzi înainte
  const today = startOfDay(new Date());

  useEffect(() => {
    const loadData = async () => {
      if (!facilityId) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/facility/login");
        return;
      }

      // Load facility details
      const { data: facilityData, error: facilityError } = await supabase
        .from('facilities')
        .select('*')
        .eq('id', facilityId)
        .eq('owner_id', user.id)
        .single();

      if (facilityError || !facilityData) {
        toast({
          title: "Eroare",
          description: "Facilitatea nu a fost găsită sau nu aveți acces",
          variant: "destructive"
        });
        navigate("/manage-facilities");
        return;
      }

      setFacility(facilityData);

      // Load bookings for next 3 months
      const startDate = startOfDay(new Date());
      const endDate = endOfDay(addDays(new Date(), 90));

      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('*')
        .eq('facility_id', facilityId)
        .gte('booking_date', format(startDate, 'yyyy-MM-dd'))
        .lte('booking_date', format(endDate, 'yyyy-MM-dd'))
        .order('booking_date', { ascending: true });

      setBookings(bookingsData || []);
      setIsLoading(false);
    };

    loadData();
  }, [facilityId]);

  const getBookingsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return bookings.filter(booking => booking.booking_date === dateStr);
  };

  const isDateBlocked = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return blockedDates.some(blocked => blocked.date === dateStr);
  };

  const blockDate = async () => {
    if (!selectedDate || !blockReason.trim()) return;
    
    // Verifică că data este de la astăzi înainte
    if (isBefore(selectedDate, today)) {
      toast({
        title: "Eroare",
        description: "Nu poți bloca date din trecut",
        variant: "destructive"
      });
      return;
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    // For now, we'll store blocked dates in local state
    // In a real app, you'd want a blocked_dates table
    const newBlockedDate: BlockedDate = {
      id: Date.now().toString(),
      date: dateStr,
      reason: blockReason
    };

    setBlockedDates([...blockedDates, newBlockedDate]);
    setBlockReason("");
    setIsBlockDialogOpen(false);
    
    toast({
      title: "Data blocată",
      description: `Data de ${format(selectedDate, 'dd MMMM yyyy', { locale: ro })} a fost blocată`
    });
  };

  const unblockDate = (date: Date) => {
    // Verifică că data este de la astăzi înainte
    if (isBefore(date, today)) {
      toast({
        title: "Eroare", 
        description: "Nu poți debloca date din trecut",
        variant: "destructive"
      });
      return;
    }
    const dateStr = format(date, 'yyyy-MM-dd');
    setBlockedDates(blockedDates.filter(blocked => blocked.date !== dateStr));
    
    toast({
      title: "Data deblocată",
      description: `Data de ${format(date, 'dd MMMM yyyy', { locale: ro })} a fost deblocată`
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'confirmed': return 'default';
      case 'pending': return 'secondary';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmată';
      case 'pending': return 'În așteptare';
      case 'cancelled': return 'Anulată';
      case 'completed': return 'Finalizată';
      default: return status;
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Se încarcă...</div>;
  }

  if (!facility) {
    return <div className="flex items-center justify-center min-h-screen">Facilitatea nu a fost găsită</div>;
  }

  const selectedDateBookings = selectedDate ? getBookingsForDate(selectedDate) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <Link to="/manage-facilities" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-4">
            <ArrowLeft className="h-4 w-4" />
            Înapoi la facilitățile mele
          </Link>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{facility.name}</h1>
              <div className="flex items-center gap-4 text-muted-foreground mt-2">
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {facility.address}, {facility.city}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {facility.capacity} persoane
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {facility.price_per_hour} RON/h
                </div>
              </div>
            </div>
            
            <Link to={`/edit-facility/${facility.id}`}>
              <Button className="flex items-center gap-2">
                <Edit className="h-4 w-4" />
                Editează Facilitatea
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Calendar Rezervări
              </CardTitle>
              <CardDescription>
                Selectează o dată pentru a vedea rezervările sau pentru a o bloca
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border p-3 pointer-events-auto"
                disabled={(date) => isBefore(date, today)} // Dezactivează datele din trecut
                modifiers={{
                  booked: (date) => getBookingsForDate(date).length > 0,
                  blocked: (date) => isDateBlocked(date),
                  past: (date) => isBefore(date, today)
                }}
                modifiersClassNames={{
                  booked: "bg-primary/20 text-primary-foreground font-semibold",
                  blocked: "bg-destructive/20 text-destructive-foreground line-through",
                  past: "text-muted-foreground opacity-50"
                }}
              />
              
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-primary/20 rounded border"></div>
                  <span>Zile cu rezervări</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-destructive/20 rounded border"></div>
                  <span>Zile blocate</span>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground text-center">
                    ⚠️ Poți modifica calendarul doar de la data curentă înainte
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selected Date Details */}
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedDate ? format(selectedDate, 'dd MMMM yyyy', { locale: ro }) : 'Selectează o dată'}
              </CardTitle>
              <CardDescription>
                {selectedDate && selectedDateBookings.length > 0 
                  ? `${selectedDateBookings.length} rezervări`
                  : selectedDate && isDateBlocked(selectedDate)
                    ? 'Dată blocată'
                    : selectedDate 
                      ? 'Nicio rezervare'
                      : 'Vezi detaliile pentru data selectată'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedDate && (
                <>
                  {/* Block/Unblock Date - doar pentru datele de astăzi înainte */}
                  {selectedDate && !isBefore(selectedDate, today) ? (
                    isDateBlocked(selectedDate) ? (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => unblockDate(selectedDate)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Deblochează Data
                      </Button>
                    ) : (
                    <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full">
                          <Ban className="h-4 w-4 mr-2" />
                          Blochează Data
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Blochează Data</DialogTitle>
                          <DialogDescription>
                            Blochează data de {format(selectedDate, 'dd MMMM yyyy', { locale: ro })} pentru rezervări noi
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="reason">Motivul blocării</Label>
                            <Textarea
                              id="reason"
                              value={blockReason}
                              onChange={(e) => setBlockReason(e.target.value)}
                              placeholder="ex: Lucrări de mentenanță, eveniment privat, etc."
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={blockDate} disabled={!blockReason.trim()}>
                              Blochează
                            </Button>
                            <Button variant="outline" onClick={() => setIsBlockDialogOpen(false)}>
                              Anulează
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )) : selectedDate && isBefore(selectedDate, today) ? (
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">
                        Nu poți modifica datele din trecut
                      </p>
                    </div>
                  ) : null}

                  {/* Bookings for selected date */}
                  {selectedDateBookings.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">Rezervări</h4>
                      {selectedDateBookings.map((booking) => (
                        <div key={booking.id} className="p-3 border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">
                              {booking.start_time} - {booking.end_time}
                            </span>
                            <Badge variant={getStatusBadgeVariant(booking.status)}>
                              {getStatusLabel(booking.status)}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {booking.total_price} RON
                          </div>
                          {booking.notes && (
                            <div className="text-xs text-muted-foreground">
                              {booking.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Bookings */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Rezervări Recente</CardTitle>
            <CardDescription>
              Ultimele rezervări pentru această facilitate
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nu există rezervări pentru această facilitate
              </p>
            ) : (
              <div className="space-y-3">
                {bookings.slice(0, 10).map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {format(new Date(booking.booking_date), 'dd MMMM yyyy', { locale: ro })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {booking.start_time} - {booking.end_time}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge variant={getStatusBadgeVariant(booking.status)}>
                        {getStatusLabel(booking.status)}
                      </Badge>
                      <div className="text-sm font-medium">
                        {booking.total_price} RON
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FacilityCalendarPage;
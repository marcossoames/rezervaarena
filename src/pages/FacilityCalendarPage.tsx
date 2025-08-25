import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Calendar as CalendarIcon, Ban, Edit, Eye, Clock, Users, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, startOfDay, endOfDay, isAfter, isBefore, isSameDay } from "date-fns";
import { ro } from "date-fns/locale";
import { isBlockingTimeAllowed } from "@/utils/dateTimeValidation";

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
  operating_hours_start?: string;
  operating_hours_end?: string;
}

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  total_price: number;
  notes?: string;
  client_id: string;
}

interface BlockedDate {
  id: string;
  blocked_date: string;
  start_time?: string;
  end_time?: string;
  reason?: string;
}

const FacilityCalendarPage = () => {
  const { facilityId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [facility, setFacility] = useState<Facility | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [blockStartTime, setBlockStartTime] = useState("");
  const [blockEndTime, setBlockEndTime] = useState("");
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

      // Load blocked dates
      const { data: blockedDatesData } = await supabase
        .from('blocked_dates')
        .select('*')
        .eq('facility_id', facilityId)
        .gte('blocked_date', format(startDate, 'yyyy-MM-dd'));

      setBookings(bookingsData || []);
      setBlockedDates(blockedDatesData || []);
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
    return blockedDates.some(blocked => blocked.blocked_date === dateStr);
  };

  const getTimeOptions = () => {
    const times = [];
    const startHour = facility?.operating_hours_start ? parseInt(facility.operating_hours_start.split(':')[0]) : 8;
    const endHour = facility?.operating_hours_end ? parseInt(facility.operating_hours_end.split(':')[0]) : 22;
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        times.push({ value: timeString, label: timeString });
      }
    }
    times.push({ value: `${endHour.toString().padStart(2, '0')}:00`, label: `${endHour.toString().padStart(2, '0')}:00` });
    return times;
  };

  const getTimeSlots = () => {
    const slots = [];
    const startHour = facility?.operating_hours_start ? parseInt(facility.operating_hours_start.split(':')[0]) : 8;
    const endHour = facility?.operating_hours_end ? parseInt(facility.operating_hours_end.split(':')[0]) : 22;
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const endTime = minute === 30 
          ? `${(hour + 1).toString().padStart(2, '0')}:00`
          : `${hour.toString().padStart(2, '0')}:30`;
        slots.push(`${startTime} - ${endTime}`);
      }
    }
    return slots;
  };

  const blockDate = async () => {
    if (!selectedDate) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    // Validate date and time restrictions
    if (!isBlockingTimeAllowed(dateStr, blockStartTime)) {
      toast({
        title: "Eroare",
        description: "Nu puteți bloca date/ore din trecut sau ore care au trecut deja astăzi",
        variant: "destructive"
      });
      return;
    }

    if (!blockReason.trim()) {
      toast({
        title: "Eroare",
        description: "Te rugăm să completezi motivul blocării",
        variant: "destructive"
      });
      return;
    }

    // Validare interval orar
    if (blockStartTime && blockEndTime && blockStartTime >= blockEndTime) {
      toast({
        title: "Eroare",
        description: "Ora de sfârșit trebuie să fie după ora de început",
        variant: "destructive"
      });
      return;
    }

    let startTime = null;
    let endTime = null;
    
    if (blockStartTime && blockEndTime) {
      startTime = blockStartTime;
      endTime = blockEndTime;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('blocked_dates')
      .insert({
        facility_id: facilityId,
        blocked_date: dateStr,
        start_time: startTime,
        end_time: endTime,
        reason: blockReason,
        created_by: user.id
      });

    if (error) {
      toast({
        title: "Eroare",
        description: "Nu s-a putut bloca data",
        variant: "destructive"
      });
      return;
    }

    // Reload blocked dates
    const { data: blockedDatesData } = await supabase
      .from('blocked_dates')
      .select('*')
      .eq('facility_id', facilityId);

    setBlockedDates(blockedDatesData || []);
    setBlockReason("");
    setBlockStartTime("");
    setBlockEndTime("");
    setIsBlockDialogOpen(false);
    
    const timeInfo = startTime && endTime ? ` între ${startTime} - ${endTime}` : '';
    toast({
      title: "Data blocată",
      description: `Data de ${format(selectedDate, 'dd MMMM yyyy', { locale: ro })}${timeInfo} a fost blocată`
    });
  };

  const unblockDate = async (date: Date) => {
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
    
    const { error } = await supabase
      .from('blocked_dates')
      .delete()
      .eq('facility_id', facilityId)
      .eq('blocked_date', dateStr);

    if (error) {
      toast({
        title: "Eroare",
        description: "Nu s-a putut debloca data",
        variant: "destructive"
      });
      return;
    }

    // Reload blocked dates
    const { data: blockedDatesData } = await supabase
      .from('blocked_dates')
      .select('*')
      .eq('facility_id', facilityId);

    setBlockedDates(blockedDatesData || []);
    
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
                            <Label htmlFor="timeRange">Interval orar (opțional)</Label>
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <Select value={blockStartTime} onValueChange={setBlockStartTime}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="De la" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-background border shadow-lg z-50">
                                    {getTimeOptions().filter(time => !blockEndTime || time.value < blockEndTime).map((time) => (
                                      <SelectItem key={time.value} value={time.value}>
                                        {time.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex-1">
                                <Select value={blockEndTime} onValueChange={setBlockEndTime} disabled={!blockStartTime}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Până la" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-background border shadow-lg z-50">
                                    {getTimeOptions().filter(time => blockStartTime && time.value > blockStartTime).map((time) => (
                                      <SelectItem key={time.value} value={time.value}>
                                        {time.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Lasă gol pentru a bloca toată ziua
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="reason">Motivul blocării *</Label>
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
                            <Button variant="outline" onClick={() => {
                              setIsBlockDialogOpen(false);
                              setBlockStartTime("");
                              setBlockEndTime("");
                              setBlockReason("");
                            }}>
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
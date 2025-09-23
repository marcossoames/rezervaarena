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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Calendar as CalendarIcon, Ban, Edit, Eye, Clock, Users, MapPin, Repeat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, addWeeks, addMonths, startOfDay, endOfDay, isAfter, isBefore, isSameDay, getDay } from "date-fns";
import { ro } from "date-fns/locale";
import { isBlockingTimeAllowed } from "@/utils/dateTimeValidation";
import BookingStatusManager from "@/components/booking/BookingStatusManager";
import AddManualBookingDialog from "@/components/facility/AddManualBookingDialog";

interface Facility {
  id: string;
  name: string;
  facility_type: string;
  description: string;
  price_per_hour: number;
  capacity: number;
  capacity_max?: number; // For capacity ranges
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
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  total_price: number;
  payment_method: string;
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
  
  // Stati pentru blocarea recurentă
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState<'weekly'>('weekly');
  const [recurringEndDate, setRecurringEndDate] = useState<Date>();
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  
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
        .select('id, booking_date, start_time, end_time, status, total_price, payment_method, notes, client_id')
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

      setBookings((bookingsData || []).map(booking => ({
        ...booking,
        status: booking.status === 'pending' ? 'confirmed' : booking.status
      })) as Booking[]);
      setBlockedDates(blockedDatesData || []);
      setIsLoading(false);
    };

    loadData();
  }, [facilityId]);

  const getBookingsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return bookings.filter(booking => booking.booking_date === dateStr);
  };

  // Verifică dacă o dată este blocată complet (toată ziua)
  const isDateFullyBlocked = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return blockedDates.some(blocked => 
      blocked.blocked_date === dateStr && 
      (!blocked.start_time || !blocked.end_time) // Blocată toată ziua dacă nu are ore specifice
    );
  };

  // Verifică dacă o dată are blocări parțiale (anumite ore)
  const hasPartialBlockings = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return blockedDates.some(blocked => 
      blocked.blocked_date === dateStr && 
      blocked.start_time && blocked.end_time // Are ore specifice
    );
  };

  // Verifică dacă o dată este blocată (orice tip de blocare)
  const isDateBlocked = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return blockedDates.some(blocked => blocked.blocked_date === dateStr);
  };

  const refreshBookings = async () => {
    if (!facilityId) return;
    
    const startDate = startOfDay(new Date());
    const endDate = endOfDay(addDays(new Date(), 90));

    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('id, booking_date, start_time, end_time, status, total_price, payment_method, notes, client_id')
      .eq('facility_id', facilityId)
      .gte('booking_date', format(startDate, 'yyyy-MM-dd'))
      .lte('booking_date', format(endDate, 'yyyy-MM-dd'))
      .order('booking_date', { ascending: true });

    setBookings((bookingsData || []).map(booking => ({
      ...booking,
      status: booking.status === 'pending' ? 'confirmed' : booking.status
    })) as Booking[]);
  };

  const selectedDateBookings = selectedDate ? getBookingsForDate(selectedDate) : [];

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'confirmed': return 'default';
      case 'cancelled': return 'destructive';
      case 'completed': return 'secondary';
      case 'no_show': return 'outline';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmată';
      case 'cancelled': return 'Anulată';
      case 'completed': return 'Completată';
      case 'no_show': return 'Lipsă';
      default: return status;
    }
  };

  // Blocarea anumitor ore
  const blockPartialHours = async () => {
    if (!selectedDate || !blockReason.trim() || !blockStartTime || !blockEndTime) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    if (!isBlockingTimeAllowed(dateStr, blockStartTime)) {
      toast({
        title: "Eroare", 
        description: "Nu puteți bloca ore din trecut",
        variant: "destructive"
      });
      return;
    }

    // Check for existing bookings in the selected time range
    const existingBookings = getBookingsForDate(selectedDate);
    const hasConflict = existingBookings.some(booking => {
      const bookingStart = booking.start_time;
      const bookingEnd = booking.end_time;
      
      // Check if blocking time overlaps with existing booking
      return (blockStartTime < bookingEnd && blockEndTime > bookingStart);
    });
    
    if (hasConflict) {
      toast({
        title: "Eroare",
        description: "Nu poți bloca ore care au rezervări existente. Verifică rezervările pentru această dată.",
        variant: "destructive"
      });
      return;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('blocked_dates')
        .insert({
          facility_id: facilityId,
          blocked_date: dateStr,
          start_time: blockStartTime,
          end_time: blockEndTime,
          reason: blockReason,
          created_by: user.id
        });

      if (error) {
        toast({
          title: "Eroare",
          description: "Nu s-au putut bloca orele",
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
      
      toast({
        title: "Ore blocate",
        description: `Orele ${blockStartTime} - ${blockEndTime} au fost blocate`
      });
    } catch (error) {
      console.error('Error blocking partial hours:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut bloca orele",
        variant: "destructive"
      });
    }
  };
  // Blocarea întregii zile
  const blockFullDay = async () => {
    if (!selectedDate || !blockReason.trim()) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    if (!isBlockingTimeAllowed(dateStr, '00:00')) {
      toast({
        title: "Eroare", 
        description: "Nu puteți bloca date din trecut",
        variant: "destructive"
      });
      return;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('blocked_dates')
        .insert({
          facility_id: facilityId,
          blocked_date: dateStr,
          start_time: null, // Toată ziua
          end_time: null,   // Toată ziua
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
      
      toast({
        title: "Zi blocată complet",
        description: "Ziua a fost blocată complet"
      });
    } catch (error) {
      console.error('Error blocking full day:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut bloca ziua",
        variant: "destructive"
      });
    }
  };

  // Deblocare în masă pentru blocări recurente
  const unblockRecurringDates = async () => {
    if (!selectedDate) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const selectedBlock = blockedDates.find(block => block.blocked_date === dateStr);
    
    if (!selectedBlock) return;
    
    const { error } = await supabase
      .from('blocked_dates')
      .delete()
      .eq('id', selectedBlock.id);
        
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
      title: "Dată deblocată",
      description: "Data a fost deblocată cu succes"
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Se încarcă calendarul...</div>
        </div>
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium text-destructive">Facilitatea nu a fost găsită</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/manage-facilities" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
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
                  {facility.capacity_max 
                    ? `${facility.capacity}-${facility.capacity_max} persoane`
                    : `${facility.capacity} persoane`
                  }
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

        {/* Main Calendar Card */}
        <Card>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Calendar Section - Left */}
              <div className="space-y-4">
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border pointer-events-auto w-fit"
                    disabled={(date) => isBefore(date, today)}
                    modifiers={{
                      booked: (date) => getBookingsForDate(date).length > 0 || hasPartialBlockings(date),
                      fullyBlocked: (date) => isDateFullyBlocked(date),
                      past: (date) => isBefore(date, today)
                    }}
                    modifiersClassNames={{
                      booked: "bg-primary/20 text-primary-foreground font-semibold",
                      fullyBlocked: "bg-pink-200 text-pink-800 font-semibold relative after:content-['×'] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:text-lg after:font-bold after:pointer-events-none",
                      past: "text-muted-foreground opacity-50"
                    }}
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 bg-primary/20 rounded border"></div>
                    <span>Zile cu rezervări / ore blocate</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 bg-pink-200 rounded border flex items-center justify-center">
                      <span className="text-xs font-bold text-pink-800 leading-none">×</span>
                    </div>
                    <span>Zile blocate complet</span>
                  </div>
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground text-center">
                      ⚠️ Poți modifica calendarul doar de la data curentă înainte
                    </p>
                  </div>
                </div>
              </div>

              {/* Day View Section - Right */}
              <div className="border-l pl-6 min-h-[400px]">
                {selectedDate ? (
                  <div className="space-y-4">
                    <div className="border-b pb-4">
                      <h3 className="text-lg font-semibold mb-2">
                        {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: ro })}
                      </h3>
                      <div className="text-sm text-muted-foreground">
                        Program: {facility?.operating_hours_start || '08:00'} - {facility?.operating_hours_end || '22:00'}
                      </div>
                      {selectedDate && selectedDateBookings.length > 0 && (
                        <div className="text-sm text-muted-foreground">
                          {selectedDateBookings.length} rezervări active
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    {selectedDate && !isBefore(selectedDate, today) && !isDateFullyBlocked(selectedDate) && facility && (
                      <div className="space-y-2">
                        <AddManualBookingDialog 
                          facilityId={facilityId!}
                          facility={facility}
                          onBookingAdded={refreshBookings}
                          selectedDate={selectedDate}
                        />
                      </div>
                    )}

                    {/* Bookings for selected date */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-base flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Rezervări
                      </h4>
                      {selectedDateBookings.length > 0 ? (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {selectedDateBookings.map((booking) => (
                            <div key={booking.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border">
                              <div className="flex items-center gap-3">
                                <Clock className="h-4 w-4 text-blue-600" />
                                <div>
                                  <div className="font-medium text-sm">
                                    {booking.start_time} - {booking.end_time}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {booking.total_price} RON • {booking.payment_method}
                                  </div>
                                </div>
                              </div>
                              <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
                                {booking.status === 'confirmed' ? 'Confirmată' : 
                                 booking.status === 'cancelled' ? 'Anulată' :
                                 booking.status === 'completed' ? 'Completată' : 'Lipsă'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground italic">
                          Nu există rezervări pentru această dată
                        </div>
                      )}
                    </div>

                    {/* Blocked hours for selected date */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-base flex items-center gap-2">
                        <Ban className="h-4 w-4" />
                        Ore blocate
                      </h4>
                      {blockedDates.filter(blocked => blocked.blocked_date === format(selectedDate, 'yyyy-MM-dd')).length > 0 ? (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {blockedDates
                            .filter(blocked => blocked.blocked_date === format(selectedDate, 'yyyy-MM-dd'))
                            .map((blocked) => (
                              <div key={blocked.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border">
                                <div className="flex items-center gap-3">
                                  <Ban className="h-4 w-4 text-red-600" />
                                  <div>
                                    <div className="font-medium text-sm">
                                      {blocked.start_time && blocked.end_time 
                                        ? `${blocked.start_time} - ${blocked.end_time}`
                                        : 'Toată ziua'
                                      }
                                    </div>
                                    {blocked.reason && (
                                      <div className="text-xs text-muted-foreground">
                                        {blocked.reason}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <Badge variant="destructive">
                                  Blocată
                                </Badge>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground italic">
                          Nu există ore blocate pentru această dată
                        </div>
                      )}
                    </div>

                    {/* Block/Unblock Actions */}
                    {selectedDate && !isBefore(selectedDate, today) ? (
                       <div className="space-y-2 border-t pt-4">
                         {/* Buton pentru blocarea întregii zile */}
                         {!isDateFullyBlocked(selectedDate) && (
                           <Dialog>
                             <DialogTrigger asChild>
                               <Button variant="outline" className="w-full">
                                 <Ban className="h-4 w-4 mr-2" />
                                 Blochează Întreaga Zi
                               </Button>
                             </DialogTrigger>
                             <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                               <DialogHeader>
                                 <DialogTitle>Blochează Întreaga Zi</DialogTitle>
                                 <DialogDescription>
                                   Blochează complet ziua de {selectedDate && format(selectedDate, 'dd MMMM yyyy', { locale: ro })} - nu se vor putea face rezervări
                                 </DialogDescription>
                               </DialogHeader>
                               <div className="space-y-4">
                                 <div className="space-y-2">
                                   <Label htmlFor="reason-full">Motivul blocării *</Label>
                                   <Textarea
                                     id="reason-full"
                                     value={blockReason}
                                     onChange={(e) => setBlockReason(e.target.value)}
                                     placeholder="ex: Întreținere, eveniment privat, etc."
                                   />
                                 </div>
                                 
                                 <div className="flex gap-2">
                                   <Button 
                                     onClick={blockFullDay} 
                                     disabled={!blockReason.trim()}
                                   >
                                     Blochează Ziua
                                   </Button>
                                   <Button variant="outline" onClick={() => {
                                     setBlockReason("");
                                   }}>
                                     Anulează
                                   </Button>
                                 </div>
                               </div>
                             </DialogContent>
                           </Dialog>
                         )}

                         {/* Buton pentru blocarea anumitor ore */}
                         {!isDateFullyBlocked(selectedDate) && (
                           <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
                             <DialogTrigger asChild>
                               <Button variant="outline" className="w-full">
                                 <Clock className="h-4 w-4 mr-2" />
                                 Blochează Anumite Ore
                               </Button>
                             </DialogTrigger>
                             <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                               <DialogHeader>
                                 <DialogTitle>Blochează Anumite Ore</DialogTitle>
                                 <DialogDescription>
                                   Selectează intervalul orar pe care vrei să îl blochezi pentru {selectedDate && format(selectedDate, 'dd MMMM yyyy', { locale: ro })}
                                 </DialogDescription>
                               </DialogHeader>
                               <div className="space-y-4">
                                 <div className="grid grid-cols-2 gap-4">
                                   <div className="space-y-2">
                                     <Label>Ora de început *</Label>
                                     <Select value={blockStartTime} onValueChange={setBlockStartTime}>
                                       <SelectTrigger>
                                         <SelectValue placeholder="Selectează ora" />
                                       </SelectTrigger>
                                       <SelectContent>
                                         {(() => {
                                           const startHour = facility?.operating_hours_start ? parseInt(facility.operating_hours_start.split(':')[0]) : 8;
                                           const endHour = facility?.operating_hours_end ? parseInt(facility.operating_hours_end.split(':')[0]) : 22;
                                           const times = [];
                                           
                                           for (let hour = startHour; hour < endHour; hour++) {
                                             for (let minute = 0; minute < 60; minute += 30) {
                                               const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                                               
                                               // Skip past times for today
                                               if (selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
                                                 const now = new Date();
                                                 const currentHour = now.getHours();
                                                 const currentMinute = now.getMinutes();
                                                 const timeHour = parseInt(timeValue.split(':')[0]);
                                                 const timeMinute = parseInt(timeValue.split(':')[1]);
                                                 
                                                 if (timeHour < currentHour || (timeHour === currentHour && timeMinute <= currentMinute)) {
                                                   continue;
                                                 }
                                               }
                                               
                                               // Check if this time conflicts with existing bookings
                                               const dayBookings = selectedDate ? getBookingsForDate(selectedDate) : [];
                                               const hasConflict = dayBookings.some(booking => {
                                                 const bookingStart = booking.start_time;
                                                 const bookingEnd = booking.end_time;
                                                 return timeValue >= bookingStart && timeValue < bookingEnd;
                                               });
                                               
                                               // Check if this time conflicts with existing blocked hours
                                               const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
                                               const dayBlockedHours = blockedDates.filter(blocked => 
                                                 blocked.blocked_date === dateStr && blocked.start_time && blocked.end_time
                                               );
                                               const hasBlockConflict = dayBlockedHours.some(blocked => {
                                                 return timeValue >= (blocked.start_time || '') && timeValue < (blocked.end_time || '');
                                               });
                                               
                                               if (!hasConflict && !hasBlockConflict) {
                                                 times.push(timeValue);
                                               }
                                             }
                                           }
                                           
                                           return times.map(timeValue => (
                                             <SelectItem key={timeValue} value={timeValue}>
                                               {timeValue}
                                             </SelectItem>
                                           ));
                                         })()}
                                       </SelectContent>
                                     </Select>
                                   </div>
                                   
                                   <div className="space-y-2">
                                     <Label>Ora de sfârșit *</Label>
                                     <Select value={blockEndTime} onValueChange={setBlockEndTime}>
                                       <SelectTrigger>
                                         <SelectValue placeholder="Selectează ora" />
                                       </SelectTrigger>
                                       <SelectContent>
                                         {(() => {
                                           if (!blockStartTime) return [];
                                           
                                           const startHour = facility?.operating_hours_start ? parseInt(facility.operating_hours_start.split(':')[0]) : 8;
                                           const endHour = facility?.operating_hours_end ? parseInt(facility.operating_hours_end.split(':')[0]) : 22;
                                           const times = [];
                                           
                                           for (let hour = startHour; hour <= endHour; hour++) {
                                             for (let minute = 0; minute < 60; minute += 30) {
                                               if (hour === endHour && minute > 0) break; // Don't go past end hour
                                               
                                               const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                                               
                                               // Only show times after start time
                                               if (timeValue <= blockStartTime) {
                                                 continue;
                                               }
                                               
                                               // Check if this end time would conflict with existing bookings
                                               const dayBookings = selectedDate ? getBookingsForDate(selectedDate) : [];
                                               const hasConflict = dayBookings.some(booking => {
                                                 const bookingStart = booking.start_time;
                                                 const bookingEnd = booking.end_time;
                                                 // Check if the proposed blocking period overlaps with any booking
                                                 return (blockStartTime < bookingEnd && timeValue > bookingStart);
                                               });
                                               
                                               // Check if this end time would conflict with existing blocked hours
                                               const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
                                               const dayBlockedHours = blockedDates.filter(blocked => 
                                                 blocked.blocked_date === dateStr && blocked.start_time && blocked.end_time
                                               );
                                               const hasBlockConflict = dayBlockedHours.some(blocked => {
                                                 // Check if the proposed blocking period overlaps with any existing block
                                                 return (blockStartTime < (blocked.end_time || '') && timeValue > (blocked.start_time || ''));
                                               });
                                               
                                               if (!hasConflict && !hasBlockConflict) {
                                                 times.push(timeValue);
                                               }
                                             }
                                           }
                                           
                                           return times.map(timeValue => (
                                             <SelectItem key={timeValue} value={timeValue}>
                                               {timeValue}
                                             </SelectItem>
                                           ));
                                         })()}
                                       </SelectContent>
                                     </Select>
                                   </div>
                                 </div>
                                 
                                 <div className="space-y-2">
                                   <Label htmlFor="reason-partial">Motivul blocării *</Label>
                                   <Textarea
                                     id="reason-partial"
                                     value={blockReason}
                                     onChange={(e) => setBlockReason(e.target.value)}
                                     placeholder="ex: Antrenament echipă, întreținere, etc."
                                   />
                                 </div>
                                 
                                 <div className="flex gap-2">
                                   <Button 
                                     onClick={blockPartialHours} 
                                     disabled={!blockReason.trim() || !blockStartTime || !blockEndTime}
                                   >
                                     Blochează Orele
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
                         )}
                        
                        {/* Buton pentru deblocare */}
                        {isDateBlocked(selectedDate) && (
                          <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={() => unblockRecurringDates()}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {isDateFullyBlocked(selectedDate) ? 'Deblochează Ziua' : 'Deblochează Orele'}
                          </Button>
                        )}
                      </div>
                    ) : selectedDate && isBefore(selectedDate, today) ? (
                      <div className="p-3 bg-muted/50 rounded-lg text-center border-t pt-4">
                        <p className="text-sm text-muted-foreground">
                          Nu poți modifica datele din trecut
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    <div className="text-center">
                      <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Selectează o dată din calendar pentru a vedea detaliile</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

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
                        {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge variant={getStatusBadgeVariant(booking.status)}>
                        {getStatusLabel(booking.status)}
                      </Badge>
                      <div className="text-sm font-medium">
                        {booking.total_price} RON
                      </div>
                      <BookingStatusManager 
                        booking={booking}
                        onStatusUpdate={refreshBookings}
                        showStatusUpdate={true}
                      />
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

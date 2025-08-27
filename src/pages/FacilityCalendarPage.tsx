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
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
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
  const [recurringType, setRecurringType] = useState<'weekly' | 'monthly'>('weekly');
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

  const getTimeOptions = () => {
    const times = [];
    const startHour = facility?.operating_hours_start ? parseInt(facility.operating_hours_start.split(':')[0]) : 8;
    const endHour = facility?.operating_hours_end ? parseInt(facility.operating_hours_end.split(':')[0]) : 22;
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        // Check if this time is allowed for the selected date
        if (selectedDate && !isBlockingTimeAllowed(format(selectedDate, 'yyyy-MM-dd'), timeString)) {
          continue; // Skip past times for today
        }
        
        times.push({ value: timeString, label: timeString });
      }
    }
    
    // Add end hour if it's allowed
    const endTimeString = `${endHour.toString().padStart(2, '0')}:00`;
    if (!selectedDate || isBlockingTimeAllowed(format(selectedDate, 'yyyy-MM-dd'), endTimeString)) {
      times.push({ value: endTimeString, label: endTimeString });
    }
    
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

  // Helper pentru zilele săptămânii
  const weekdayLabels = [
    { value: 1, label: 'Luni' },
    { value: 2, label: 'Marți' },
    { value: 3, label: 'Miercuri' },
    { value: 4, label: 'Joi' },
    { value: 5, label: 'Vineri' },
    { value: 6, label: 'Sâmbătă' },
    { value: 0, label: 'Duminică' }
  ];

  // Generare date recurente
  const generateRecurringDates = (startDate: Date, endDate: Date, type: 'weekly' | 'monthly', selectedDays?: number[]) => {
    const dates = [];
    let currentDate = new Date(startDate);
    
    if (type === 'weekly' && selectedDays && selectedDays.length > 0) {
      while (currentDate <= endDate) {
        const dayOfWeek = getDay(currentDate);
        if (selectedDays.includes(dayOfWeek)) {
          dates.push(new Date(currentDate));
        }
        currentDate = addDays(currentDate, 1);
      }
    } else if (type === 'monthly') {
      const startDay = startDate.getDate();
      while (currentDate <= endDate) {
        if (currentDate.getDate() === startDay) {
          dates.push(new Date(currentDate));
        }
        currentDate = addDays(currentDate, 1);
      }
    } else if (type === 'weekly') {
      // Weekly pentru aceeași zi din săptămână ca startDate
      const startDayOfWeek = getDay(startDate);
      while (currentDate <= endDate) {
        if (getDay(currentDate) === startDayOfWeek) {
          dates.push(new Date(currentDate));
        }
        currentDate = addDays(currentDate, 1);
      }
    }
    
    return dates;
  };

  // Deblocare în masă pentru blocări recurente
  const unblockRecurringDates = async () => {
    if (!selectedDate) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const selectedBlock = blockedDates.find(block => block.blocked_date === dateStr);
    
    if (!selectedBlock) return;
    
    // Găsește toate blocările cu același motiv și interval orar
    const relatedBlocks = blockedDates.filter(block => 
      block.reason === selectedBlock.reason &&
      block.start_time === selectedBlock.start_time &&
      block.end_time === selectedBlock.end_time
    );
    
    if (relatedBlocks.length > 1) {
      const confirmed = window.confirm(
        `S-au găsit ${relatedBlocks.length} blocări similare (același motiv și interval orar). Doriți să le deblocați pe toate?`
      );
      
      if (confirmed) {
        const blockIds = relatedBlocks.map(block => block.id);
        
        const { error } = await supabase
          .from('blocked_dates')
          .delete()
          .in('id', blockIds);
          
        if (error) {
          toast({
            title: "Eroare",
            description: "Nu s-au putut debloca toate datele",
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
          title: "Date deblocate",
          description: `${relatedBlocks.length} date au fost deblocate cu succes`
        });
        return;
      }
    }
    
    // Deblocare normală pentru o singură dată
    unblockDate(selectedDate);
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
      let datesToBlock = [selectedDate];
      
      if (isRecurring && recurringEndDate) {
        if (recurringType === 'weekly') {
          // Dacă sunt selectate zile specifice, folosește-le, altfel folosește ziua selectată inițial
          const daysToUse = weeklyDays.length > 0 ? weeklyDays : [getDay(selectedDate)];
          datesToBlock = generateRecurringDates(selectedDate, recurringEndDate, 'weekly', daysToUse);
        } else {
          datesToBlock = generateRecurringDates(selectedDate, recurringEndDate, 'monthly');
        }
      }

      const blocksToInsert = datesToBlock.map(date => ({
        facility_id: facilityId,
        blocked_date: format(date, 'yyyy-MM-dd'),
        start_time: null, // Toată ziua
        end_time: null,   // Toată ziua
        reason: blockReason,
        created_by: user.id
      }));

      const { error } = await supabase
        .from('blocked_dates')
        .insert(blocksToInsert);

      if (error) {
        toast({
          title: "Eroare",
          description: "Nu s-au putut bloca datele",
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
      setIsRecurring(false);
      setRecurringEndDate(undefined);
      setWeeklyDays([]);
      
      const countInfo = datesToBlock.length > 1 ? ` (${datesToBlock.length} date)` : '';
      
      toast({
        title: "Zile blocate complet",
        description: `${datesToBlock.length === 1 ? 'Ziua' : 'Zilele'} ${datesToBlock.length === 1 ? 'a fost blocată' : 'au fost blocate'} complet${countInfo}`
      });
    } catch (error) {
      console.error('Error blocking full days:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut bloca zilele",
        variant: "destructive"
      });
    }
  };

  const blockDate = async () => {
    if (!selectedDate) return;
    
    // Validare date recurente
    if (isRecurring) {
      if (!recurringEndDate) {
        toast({
          title: "Eroare",
          description: "Te rugăm să selectezi data de sfârșit pentru blocarea recurentă",
          variant: "destructive"
        });
        return;
      }
    }
    
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

    try {
      let datesToBlock = [selectedDate];
      
      // Generare date recurente dacă este cazul
      if (isRecurring && recurringEndDate) {
        if (recurringType === 'weekly') {
          // Dacă sunt selectate zile specifice, folosește-le, altfel folosește ziua selectată inițial
          const daysToUse = weeklyDays.length > 0 ? weeklyDays : [getDay(selectedDate)];
          datesToBlock = generateRecurringDates(selectedDate, recurringEndDate, 'weekly', daysToUse);
        } else {
          datesToBlock = generateRecurringDates(selectedDate, recurringEndDate, 'monthly');
        }
      }

      // Inserare pentru toate datele
      const blocksToInsert = datesToBlock.map(date => ({
        facility_id: facilityId,
        blocked_date: format(date, 'yyyy-MM-dd'),
        start_time: startTime,
        end_time: endTime,
        reason: blockReason,
        created_by: user.id
      }));

      const { error } = await supabase
        .from('blocked_dates')
        .insert(blocksToInsert);

      if (error) {
        toast({
          title: "Eroare",
          description: "Nu s-au putut bloca datele",
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
      setIsRecurring(false);
      setRecurringEndDate(undefined);
      setWeeklyDays([]);
      setIsBlockDialogOpen(false);
      
      const timeInfo = startTime && endTime ? ` între ${startTime} - ${endTime}` : '';
      const countInfo = datesToBlock.length > 1 ? ` (${datesToBlock.length} date)` : '';
      
      toast({
        title: "Date blocate",
        description: `${datesToBlock.length === 1 ? 'Data' : 'Datele'} ${timeInfo} ${datesToBlock.length === 1 ? 'a fost blocată' : 'au fost blocate'}${countInfo}`
      });
    } catch (error) {
      console.error('Error blocking dates:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut bloca datele",
        variant: "destructive"
      });
    }
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
      case 'completed': return 'default';
      case 'no_show': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmată';
      case 'pending': return 'În așteptare';
      case 'cancelled': return 'Anulată';
      case 'completed': return 'Finalizată';
      case 'no_show': return 'Nu s-a prezentat';
      default: return status;
    }
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

    setBookings(bookingsData || []);
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
              
               <div className="mt-4 space-y-2">
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
                   : selectedDate && isDateFullyBlocked(selectedDate)
                     ? 'Zi blocată complet'
                     : selectedDate && hasPartialBlockings(selectedDate)
                       ? 'Are ore blocate'
                       : selectedDate 
                         ? 'Nicio rezervare'
                         : 'Vezi detaliile pentru data selectată'
                 }
               </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedDate && (
                <>
                   {/* Block/Unblock Date Actions */}
                   {selectedDate && !isBefore(selectedDate, today) ? (
                     <div className="space-y-2">
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
                                 Blochează complet ziua de {format(selectedDate, 'dd MMMM yyyy', { locale: ro })} - nu se vor putea face rezervări
                               </DialogDescription>
                             </DialogHeader>
                             <div className="space-y-4">
                               {/* Blocarea recurentă pentru zi întreagă */}
                               <div className="space-y-3">
                                 <div className="flex items-center space-x-2">
                                   <Checkbox 
                                     id="recurring-full" 
                                     checked={isRecurring}
                                     onCheckedChange={(checked) => setIsRecurring(!!checked)}
                                   />
                                   <Label htmlFor="recurring-full" className="flex items-center gap-2">
                                     <Repeat className="h-4 w-4" />
                                     Blocare recurentă
                                   </Label>
                                 </div>
                                 
                                 {isRecurring && (
                                   <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                                     <div className="space-y-2">
                                       <Label>Tip recurență</Label>
                                       <Select value={recurringType} onValueChange={(value: 'weekly' | 'monthly') => setRecurringType(value)}>
                                         <SelectTrigger>
                                           <SelectValue />
                                         </SelectTrigger>
                                         <SelectContent>
                                           <SelectItem value="weekly">Săptămânal</SelectItem>
                                           <SelectItem value="monthly">Lunar</SelectItem>
                                         </SelectContent>
                                       </Select>
                                     </div>
                                     
                                     {recurringType === 'weekly' && (
                                       <div className="space-y-2">
                                         <Label>Zilele săptămânii (opțional)</Label>
                                         <div className="p-3 bg-blue-50 rounded-lg mb-3">
                                           <p className="text-sm text-blue-700">
                                             💡 Implicit se va bloca <strong>{weekdayLabels.find(day => day.value === getDay(selectedDate))?.label}</strong> 
                                             {recurringEndDate && (
                                               <span> până la {format(recurringEndDate, 'dd.MM.yyyy', { locale: ro })}</span>
                                             )}
                                           </p>
                                           <p className="text-xs text-blue-600 mt-1">
                                             Selectează alte zile doar dacă vrei să blochezi zile suplimentare
                                           </p>
                                         </div>
                                         <div className="grid grid-cols-2 gap-2">
                                           {weekdayLabels.map((day) => (
                                             <div key={day.value} className="flex items-center space-x-2">
                                               <Checkbox
                                                 id={`day-full-${day.value}`}
                                                 checked={weeklyDays.includes(day.value)}
                                                 onCheckedChange={(checked) => {
                                                   if (checked) {
                                                     setWeeklyDays([...weeklyDays, day.value]);
                                                   } else {
                                                     setWeeklyDays(weeklyDays.filter(d => d !== day.value));
                                                   }
                                                 }}
                                               />
                                               <Label htmlFor={`day-full-${day.value}`} className="text-sm">
                                                 {day.label}
                                               </Label>
                                             </div>
                                           ))}
                                         </div>
                                       </div>
                                     )}
                                     
                                     <div className="space-y-2">
                                       <Label>Data de sfârșit</Label>
                                       <Calendar
                                         mode="single"
                                         selected={recurringEndDate}
                                         onSelect={setRecurringEndDate}
                                         disabled={(date) => isBefore(date, selectedDate) || isBefore(date, today)}
                                         className="rounded-md border p-3 pointer-events-auto"
                                       />
                                     </div>
                                   </div>
                                 )}
                               </div>
                               
                               <div className="space-y-2">
                                 <Label htmlFor="reason-full">Motivul blocării *</Label>
                                 <Textarea
                                   id="reason-full"
                                   value={blockReason}
                                   onChange={(e) => setBlockReason(e.target.value)}
                                   placeholder="ex: Lucrări de mentenanță, eveniment privat, etc."
                                 />
                               </div>
                               
                               <div className="flex gap-2">
                                 <Button onClick={blockFullDay} disabled={!blockReason.trim()}>
                                   {isRecurring ? 'Blochează Zilele' : 'Blochează Ziua'}
                                 </Button>
                                 <Button variant="outline" onClick={() => {
                                   setBlockReason("");
                                   setIsRecurring(false);
                                   setRecurringEndDate(undefined);
                                   setWeeklyDays([]);
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
                                <Ban className="h-4 w-4 mr-2" />
                                Blochează Data/Ora
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Blochează Data/Ora</DialogTitle>
                                <DialogDescription>
                                  Blochează data de {format(selectedDate, 'dd MMMM yyyy', { locale: ro })} pentru rezervări noi
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="timeRange">Interval orar *</Label>
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
                                  <p className="text-xs text-red-500">
                                    * Intervalul orar este obligatoriu pentru blocarea parțială
                                  </p>
                                </div>
                                
                                {/* Blocarea recurentă pentru ore specifice */}
                                <div className="space-y-3">
                                  <div className="flex items-center space-x-2">
                                    <Checkbox 
                                      id="recurring-partial" 
                                      checked={isRecurring}
                                      onCheckedChange={(checked) => setIsRecurring(!!checked)}
                                    />
                                    <Label htmlFor="recurring-partial" className="flex items-center gap-2">
                                      <Repeat className="h-4 w-4" />
                                      Blocare recurentă
                                    </Label>
                                  </div>
                                  
                                  {isRecurring && (
                                    <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                                      <div className="space-y-2">
                                        <Label>Tip recurență</Label>
                                        <Select value={recurringType} onValueChange={(value: 'weekly' | 'monthly') => setRecurringType(value)}>
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="weekly">Săptămânal</SelectItem>
                                            <SelectItem value="monthly">Lunar</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      
                                      {recurringType === 'weekly' && (
                                        <div className="space-y-2">
                                          <Label>Zilele săptămânii (opțional)</Label>
                                          <div className="p-3 bg-blue-50 rounded-lg mb-3">
                                            <p className="text-sm text-blue-700">
                                              💡 Implicit se va bloca <strong>{weekdayLabels.find(day => day.value === getDay(selectedDate))?.label}</strong> 
                                              {recurringEndDate && (
                                                <span> până la {format(recurringEndDate, 'dd.MM.yyyy', { locale: ro })}</span>
                                              )}
                                            </p>
                                            <p className="text-xs text-blue-600 mt-1">
                                              Selectează alte zile doar dacă vrei să blochezi zile suplimentare
                                            </p>
                                          </div>
                                          <div className="grid grid-cols-2 gap-2">
                                            {weekdayLabels.map((day) => (
                                              <div key={day.value} className="flex items-center space-x-2">
                                                <Checkbox
                                                  id={`day-partial-${day.value}`}
                                                  checked={weeklyDays.includes(day.value)}
                                                  onCheckedChange={(checked) => {
                                                    if (checked) {
                                                      setWeeklyDays([...weeklyDays, day.value]);
                                                    } else {
                                                      setWeeklyDays(weeklyDays.filter(d => d !== day.value));
                                                    }
                                                  }}
                                                />
                                                <Label htmlFor={`day-partial-${day.value}`} className="text-sm">
                                                  {day.label}
                                                </Label>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      
                                      <div className="space-y-2">
                                        <Label>Data de sfârșit</Label>
                                        <Calendar
                                          mode="single"
                                          selected={recurringEndDate}
                                          onSelect={setRecurringEndDate}
                                          disabled={(date) => isBefore(date, selectedDate) || isBefore(date, today)}
                                          className="rounded-md border p-3 pointer-events-auto"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="space-y-2">
                                  <Label htmlFor="reason-partial">Motivul blocării *</Label>
                                  <Textarea
                                    id="reason-partial"
                                    value={blockReason}
                                    onChange={(e) => setBlockReason(e.target.value)}
                                    placeholder="ex: Rezervări recurente pentru echipa locală, antrenamente, etc."
                                  />
                                </div>
                                
                                <div className="flex gap-2">
                                  <Button 
                                    onClick={blockDate} 
                                    disabled={!blockReason.trim() || !blockStartTime || !blockEndTime}
                                  >
                                    {isRecurring 
                                      ? 'Blochează Datele/Orele'
                                      : 'Blochează Data/Ora'
                                    }
                                  </Button>
                                  <Button variant="outline" onClick={() => {
                                    setIsBlockDialogOpen(false);
                                    setBlockStartTime("");
                                    setBlockEndTime("");
                                    setBlockReason("");
                                    setIsRecurring(false);
                                    setRecurringEndDate(undefined);
                                    setWeeklyDays([]);
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
                         <div className="space-y-2">
                           <Button 
                             variant="outline" 
                             className="w-full"
                             onClick={() => unblockRecurringDates()}
                           >
                             <Eye className="h-4 w-4 mr-2" />
                             {isDateFullyBlocked(selectedDate) ? 'Deblochează Ziua' : 'Deblochează Orele'}
                           </Button>
                         </div>
                       )}
                     </div>
                   ) : selectedDate && isBefore(selectedDate, today) ? (
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
                          <BookingStatusManager 
                            booking={booking}
                            onStatusUpdate={refreshBookings}
                          />
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
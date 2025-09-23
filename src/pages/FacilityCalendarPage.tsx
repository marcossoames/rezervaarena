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
import { ArrowLeft, Calendar as CalendarIcon, Ban, Edit, Eye, Clock, Users, MapPin, Repeat, CalendarOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, addWeeks, addMonths, startOfDay, endOfDay, isAfter, isBefore, isSameDay, getDay } from "date-fns";
import { ro } from "date-fns/locale";
import { isBlockingTimeAllowed } from "@/utils/dateTimeValidation";
import BookingStatusManager from "@/components/booking/BookingStatusManager";
import AddManualBookingDialog from "@/components/facility/AddManualBookingDialog";
import CombinedBlockDialog from "@/components/facility/CombinedBlockDialog";
import UnblockRecurringDialog from "@/components/facility/UnblockRecurringDialog";

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
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'pending';
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
          description: "Nu s-a putut încărca facilitatea sau nu aveți permisiune să o vizualizați",
          variant: "destructive"
        });
        navigate("/manage-facilities");
        return;
      }

      setFacility(facilityData);

      // Load bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('facility_id', facilityId)
        .gte('booking_date', format(new Date(), 'yyyy-MM-dd'))
        .order('booking_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
      } else {
        setBookings(bookingsData || []);
      }

      // Load blocked dates
      const { data: blockedData, error: blockedError } = await supabase
        .from('blocked_dates')
        .select('*')
        .eq('facility_id', facilityId)
        .gte('blocked_date', format(new Date(), 'yyyy-MM-dd'))
        .order('blocked_date', { ascending: true });

      if (blockedError) {
        console.error('Error fetching blocked dates:', blockedError);
      } else {
        setBlockedDates(blockedData || []);
      }

      setIsLoading(false);
    };

    loadData();
  }, [facilityId, navigate, toast]);

  // Real-time updates for blocked dates and recurring blocked dates
  useEffect(() => {
    if (!facilityId) return;

    const channel = supabase
      .channel('facility-blocks-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blocked_dates',
          filter: `facility_id=eq.${facilityId}`
        },
        () => {
          console.log('Blocked dates changed, refreshing...');
          // Refresh blocked dates data
          supabase
            .from('blocked_dates')
            .select('*')
            .eq('facility_id', facilityId)
            .gte('blocked_date', format(new Date(), 'yyyy-MM-dd'))
            .order('blocked_date', { ascending: true })
            .then(({ data, error }) => {
              if (!error) {
                setBlockedDates(data || []);
              }
            });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recurring_blocked_dates',
          filter: `facility_id=eq.${facilityId}`
        },
        () => {
          console.log('Recurring blocked dates changed, refreshing...');
          // Refresh blocked dates data to include new recurring blocks
          supabase
            .from('blocked_dates')
            .select('*')
            .eq('facility_id', facilityId)
            .gte('blocked_date', format(new Date(), 'yyyy-MM-dd'))
            .order('blocked_date', { ascending: true })
            .then(({ data, error }) => {
              if (!error) {
                setBlockedDates(data || []);
              }
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [facilityId]);

  const getBookingsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return bookings.filter(booking => booking.booking_date === dateStr);
  };

  const isDateFullyBlocked = (date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return blockedDates.some(blocked => 
      blocked.blocked_date === dateStr && !blocked.start_time && !blocked.end_time
    );
  };

  const hasPartialBlockings = (date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return blockedDates.some(blocked => 
      blocked.blocked_date === dateStr && blocked.start_time && blocked.end_time
    );
  };

  const isDateBlocked = (date: Date): boolean => {
    return isDateFullyBlocked(date) || hasPartialBlockings(date);
  };

  const refreshBookings = async () => {
    if (!facilityId) return;

    const { data: bookingsData, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .eq('facility_id', facilityId)
      .gte('booking_date', format(new Date(), 'yyyy-MM-dd'))
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (!bookingsError) {
      setBookings(bookingsData || []);
    }
  };

  const blockPartialHours = async () => {
    if (!selectedDate || !blockStartTime || !blockEndTime || !blockReason.trim()) {
      toast({
        title: "Date incomplete",
        description: "Completează toate câmpurile obligatorii",
        variant: "destructive"
      });
      return;
    }

    if (!isBlockingTimeAllowed(blockStartTime, blockEndTime)) {
      toast({
        title: "Interval invalid",
        description: "Intervalul de timp selectat nu este valid",
        variant: "destructive"
      });
      return;
    }

    // Check for conflicts with existing bookings
    const dayBookings = getBookingsForDate(selectedDate);
    const hasBookingConflict = dayBookings.some(booking => {
      const bookingStart = booking.start_time.slice(0, 5);
      const bookingEnd = booking.end_time.slice(0, 5);
      return (
        (blockStartTime >= bookingStart && blockStartTime < bookingEnd) ||
        (blockEndTime > bookingStart && blockEndTime <= bookingEnd) ||
        (blockStartTime <= bookingStart && blockEndTime >= bookingEnd)
      );
    });

    if (hasBookingConflict) {
      toast({
        title: "Conflict detectat",
        description: "Intervalul selectat se suprapune cu rezervări existente",
        variant: "destructive"
      });
      return;
    }

    // Check for conflicts with existing blocked hours
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayBlocks = blockedDates.filter(blocked => 
      blocked.blocked_date === dateStr && blocked.start_time && blocked.end_time
    );
    
    const hasBlockConflict = dayBlocks.some(blocked => {
      const blockedStart = (blocked.start_time || '').slice(0, 5);
      const blockedEnd = (blocked.end_time || '').slice(0, 5);
      return (
        (blockStartTime >= blockedStart && blockStartTime < blockedEnd) ||
        (blockEndTime > blockedStart && blockEndTime <= blockedEnd) ||
        (blockStartTime <= blockedStart && blockEndTime >= blockedEnd)
      );
    });

    if (hasBlockConflict) {
      toast({
        title: "Conflict detectat",
        description: "Intervalul selectat se suprapune cu alte blocări existente",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('blocked_dates')
        .insert({
          facility_id: facilityId,
          created_by: user?.id,
          blocked_date: dateStr,
          start_time: blockStartTime,
          end_time: blockEndTime,
          reason: blockReason
        });

      if (error) throw error;

      toast({
        title: "Succes",
        description: `Orele ${blockStartTime} - ${blockEndTime} au fost blocate pentru ${format(selectedDate, 'dd MMMM yyyy', { locale: ro })}`
      });

      // Refresh blocked dates
      const { data: blockedData } = await supabase
        .from('blocked_dates')
        .select('*')
        .eq('facility_id', facilityId)
        .gte('blocked_date', format(new Date(), 'yyyy-MM-dd'))
        .order('blocked_date', { ascending: true });

      if (blockedData) {
        setBlockedDates(blockedData);
      }

      // Reset form
      setIsBlockDialogOpen(false);
      setBlockStartTime("");
      setBlockEndTime("");
      setBlockReason("");
      
    } catch (error) {
      console.error('Error blocking hours:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut bloca orele",
        variant: "destructive"
      });
    }
  };

  const blockFullDay = async () => {
    if (!selectedDate || !blockReason.trim()) {
      toast({
        title: "Date incomplete",
        description: "Completează motivul blocării",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('blocked_dates')
        .insert({
          facility_id: facilityId,
          created_by: user?.id,
          blocked_date: format(selectedDate, 'yyyy-MM-dd'),
          reason: blockReason
        });

      if (error) throw error;

      toast({
        title: "Succes",
        description: `Ziua de ${format(selectedDate, 'dd MMMM yyyy', { locale: ro })} a fost blocată complet`
      });

      // Refresh blocked dates
      const { data: blockedData } = await supabase
        .from('blocked_dates')
        .select('*')
        .eq('facility_id', facilityId)
        .gte('blocked_date', format(new Date(), 'yyyy-MM-dd'))
        .order('blocked_date', { ascending: true });

      if (blockedData) {
        setBlockedDates(blockedData);
      }

      setBlockReason("");
      
    } catch (error) {
      console.error('Error blocking full day:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut bloca ziua",
        variant: "destructive"
      });
    }
  };

  const unblockRecurringDates = async () => {
    if (!selectedDate) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    try {
      const { error } = await supabase
        .from('blocked_dates')
        .delete()
        .eq('facility_id', facilityId)
        .eq('blocked_date', dateStr);

      if (error) throw error;

      toast({
        title: "Succes",
        description: `Blocarea pentru ${format(selectedDate, 'dd MMMM yyyy', { locale: ro })} a fost eliminată`
      });

      // Refresh blocked dates
      const { data: blockedData } = await supabase
        .from('blocked_dates')
        .select('*')
        .eq('facility_id', facilityId)
        .gte('blocked_date', format(new Date(), 'yyyy-MM-dd'))
        .order('blocked_date', { ascending: true });

      if (blockedData) {
        setBlockedDates(blockedData);
      }
      
    } catch (error) {
      console.error('Error unblocking dates:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut elimina blocarea",
        variant: "destructive"
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'default';
      case 'cancelled':
        return 'secondary';
      case 'completed':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'Confirmată';
      case 'cancelled':
        return 'Anulată';
      case 'completed':
        return 'Finalizată';
      case 'no_show':
        return 'Nu s-a prezentat';
      default:
        return status;
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Se încarcă...</div>;
  }

  if (!facility) {
    return <div className="min-h-screen flex items-center justify-center">Facilitatea nu a fost găsită</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/manage-facilities" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" />
            Înapoi la terenurile mele
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
                  Capacitate: {facility.capacity} {facility.capacity_max ? `- ${facility.capacity_max}` : ''} persoane
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {facility.price_per_hour} RON/oră
                </div>
              </div>
            </div>
            
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Calendar */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Calendar Rezervări
              </CardTitle>
              <CardDescription>
                Selectează o dată pentru a vizualiza rezervările și a gestiona blocările
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={ro}
                className="rounded-md border"
                modifiers={{
                  hasBookings: (date) => getBookingsForDate(date).length > 0,
                  partiallyBlocked: (date) => hasPartialBlockings(date),
                  fullyBlocked: (date) => isDateFullyBlocked(date)
                }}
                modifiersClassNames={{
                  hasBookings: "bg-blue-100 text-blue-900",
                  partiallyBlocked: "bg-yellow-100 text-yellow-900",
                  fullyBlocked: "bg-red-100 text-red-900 line-through"
                }}
                disabled={(date) => isBefore(date, startOfDay(new Date()))}
              />
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-100 rounded border"></div>
                  <span>Zile cu rezervări</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-100 rounded border"></div>
                  <span>Zile parțial blocate</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-100 rounded border"></div>
                  <span>Zile complet blocate</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selected Date Details */}
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedDate ? format(selectedDate, 'EEEE, d MMMM yyyy', { locale: ro }) : 'Selectează o dată'}
              </CardTitle>
              <CardDescription>
                {selectedDate && (
                  <>
                    Program: {facility.operating_hours_start?.slice(0, 5) || '08:00'} - {facility.operating_hours_end?.slice(0, 5) || '22:00'}
                    <br />
                    {getBookingsForDate(selectedDate).length} rezervări active
                  </>
                )}
              </CardDescription>
              {/* Add Manual Booking Button - Fixed position */}
              <div className="pt-4 border-t">
                <AddManualBookingDialog 
                  facilityId={facilityId!}
                  onBookingAdded={refreshBookings}
                  facility={facility}
                  selectedDate={selectedDate}
                />
              </div>
            </CardHeader>
            <CardContent>
              {selectedDate ? (
                <div className="space-y-6">
                  {/* Existing Bookings */}
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold mb-3">
                      <CalendarIcon className="h-4 w-4" />
                      Rezervări
                    </h3>
                    {getBookingsForDate(selectedDate).length === 0 ? (
                      <p className="text-muted-foreground text-sm">Nu există rezervări pentru această dată</p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {getBookingsForDate(selectedDate).map((booking) => (
                          <div key={booking.id} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex-1">
                              <div className="font-medium mb-1">{booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}</div>
                              <div className="text-muted-foreground text-sm">
                                {booking.total_price} RON • {booking.payment_method === 'card' ? 'Card' : 'Cash'}
                              </div>
                              {booking.notes && (
                                <div className="text-xs text-muted-foreground mt-1 p-2 bg-muted rounded">
                                  {booking.notes}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-3">
                              <Badge variant={getStatusBadgeVariant(booking.status)}>
                                {getStatusLabel(booking.status)}
                              </Badge>
                              <Button variant="outline" size="sm">
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Blocked Hours */}
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold mb-3">
                      <Ban className="h-4 w-4" />
                      Ore blocate
                    </h3>
                    {(() => {
                      const dateStr = format(selectedDate, 'yyyy-MM-dd');
                      const dayBlocks = blockedDates.filter(blocked => blocked.blocked_date === dateStr);
                      
                      if (dayBlocks.length === 0) {
                        return <p className="text-muted-foreground text-sm">Nu există ore blocate pentru această dată</p>;
                      }
                      
                      return (
                        <div className="space-y-2">
                          {dayBlocks.map((block) => (
                            <div key={block.id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                              <div className="font-medium text-red-900">
                                {block.start_time && block.end_time ? 
                                  `${block.start_time.slice(0, 5)} - ${block.end_time.slice(0, 5)}` : 
                                  'Întreaga zi'
                                }
                              </div>
                              {block.reason && (
                                <div className="text-sm text-red-700 mt-1">{block.reason}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Block/Unblock Actions */}
                  {selectedDate && !isBefore(selectedDate, today) ? (
                    <div className="space-y-2 border-t pt-4">
                       {/* Combined Block Dialog */}
                       {(() => {
                         const dayBookings = getBookingsForDate(selectedDate);
                         const hasExistingBookings = dayBookings.length > 0;
                         
                         if (isDateFullyBlocked(selectedDate)) {
                           return null;
                         }
                         
                         return (
                           <CombinedBlockDialog
                             facilityId={facilityId}
                             selectedDate={selectedDate}
                             onBlockingAdded={refreshBookings}
                             hasExistingBookings={hasExistingBookings}
                           />
                         );
                       })()}

                      {/* Block Specific Hours Button */}
                      {!isDateFullyBlocked(selectedDate) && (() => {
                        const startHour = facility?.operating_hours_start ? parseInt(facility.operating_hours_start.split(':')[0]) : 8;
                        const endHour = facility?.operating_hours_end ? parseInt(facility.operating_hours_end.split(':')[0]) : 22;
                        const dayBookings = getBookingsForDate(selectedDate);
                        const dateStr = format(selectedDate, 'yyyy-MM-dd');
                        const dayBlockedHours = blockedDates.filter(blocked => 
                          blocked.blocked_date === dateStr && blocked.start_time && blocked.end_time
                        );
                        
                        let availableSlots = 0;
                        for (let hour = startHour; hour < endHour; hour++) {
                          for (let minute = 0; minute < 60; minute += 30) {
                            const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                            
                            const hasBookingConflict = dayBookings.some(booking => {
                              const bookingStart = booking.start_time.slice(0, 5);
                              const bookingEnd = booking.end_time.slice(0, 5);
                              return timeValue >= bookingStart && timeValue < bookingEnd;
                            });
                            const hasBlockConflict = dayBlockedHours.some(blocked => {
                              if (!blocked.start_time || !blocked.end_time) return false;
                              const blockedStart = blocked.start_time.slice(0, 5);
                              const blockedEnd = blocked.end_time.slice(0, 5);
                              return timeValue >= blockedStart && timeValue < blockedEnd;
                            });
                            
                            if (!hasBookingConflict && !hasBlockConflict) {
                              availableSlots++;
                            }
                          }
                        }
                        
                        if (availableSlots < 2) {
                          return (
                            <div className="p-3 bg-muted/50 rounded-lg border border-dashed">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span>Nu există ore disponibile pentru blocare (toate orele sunt rezervate sau deja blocate)</span>
                              </div>
                            </div>
                          );
                        }
                        
                        return (
                          <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" className="w-full">
                                <Clock className="h-4 w-4 mr-2" />
                                Blochează Anumite Ore ({availableSlots} intervale disponibile)
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Blochează Anumite Ore</DialogTitle>
                                <DialogDescription>
                                  Selectează intervalul orar pe care vrei să îl blochezi pentru {format(selectedDate, 'dd MMMM yyyy', { locale: ro })}
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
                                          const options = [];
                                          for (let hour = startHour; hour < endHour; hour++) {
                                            for (let minute = 0; minute < 60; minute += 30) {
                                              const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                                              const timeDisplay = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                                              
                                               const hasBookingConflict = dayBookings.some(booking => {
                                                 const bookingStart = booking.start_time.slice(0, 5);
                                                 const bookingEnd = booking.end_time.slice(0, 5);
                                                 return timeValue >= bookingStart && timeValue < bookingEnd;
                                               });
                                               const hasBlockConflict = dayBlockedHours.some(blocked => {
                                                 if (!blocked.start_time || !blocked.end_time) return false;
                                                 const blockedStart = blocked.start_time.slice(0, 5);
                                                 const blockedEnd = blocked.end_time.slice(0, 5);
                                                 return timeValue >= blockedStart && timeValue < blockedEnd;
                                               });
                                               
                                               if (!hasBookingConflict && !hasBlockConflict) {
                                                options.push(
                                                  <SelectItem key={timeValue} value={timeValue}>
                                                    {timeDisplay}
                                                  </SelectItem>
                                                );
                                              }
                                            }
                                          }
                                          return options;
                                        })()}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label>Ora de sfârșit *</Label>
                                    <Select value={blockEndTime} onValueChange={setBlockEndTime}>
                                      <SelectTrigger>
                                        <SelectValue placeholder={blockStartTime ? "Selectează ora de sfârșit" : "Alege mai întâi ora de început"} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {blockStartTime && (() => {
                                          const options = [];
                                          const startHourNum = parseInt(blockStartTime.split(':')[0]);
                                          const startMinuteNum = parseInt(blockStartTime.split(':')[1]);
                                          
                                          for (let hour = startHourNum; hour <= endHour; hour++) {
                                            const startMinute = hour === startHourNum ? startMinuteNum + 30 : 0;
                                            for (let minute = startMinute; minute < 60; minute += 30) {
                                              if (hour === endHour && minute > 0) break;
                                              
                                              const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                                              const timeDisplay = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                                              
                                              const hasBookingConflict = dayBookings.some(booking => {
                                                return (timeValue > booking.start_time && timeValue <= booking.end_time) ||
                                                       (blockStartTime < booking.end_time && timeValue > booking.start_time);
                                              });
                                              const hasBlockConflict = dayBlockedHours.some(blocked => {
                                                return (timeValue > (blocked.start_time || '') && timeValue <= (blocked.end_time || '')) ||
                                                       (blockStartTime < (blocked.end_time || '') && timeValue > (blocked.start_time || ''));
                                              });
                                              
                                              if (!hasBookingConflict && !hasBlockConflict) {
                                                options.push(
                                                  <SelectItem key={timeValue} value={timeValue}>
                                                    {timeDisplay}
                                                  </SelectItem>
                                                );
                                              }
                                            }
                                          }
                                          return options;
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
                                    placeholder="ex: Întreținere, eveniment privat, etc."
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
                        );
                      })()}
                      
                       {/* Enhanced Unblock Button */}
                       {isDateBlocked(selectedDate) && (
                         <UnblockRecurringDialog
                           facilityId={facilityId}
                           selectedDate={selectedDate}
                           blockedDates={blockedDates}
                           onUnblockComplete={refreshBookings}
                         />
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
                          {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                        </div>
                    </div>
                    <div className="text-right space-y-1">
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

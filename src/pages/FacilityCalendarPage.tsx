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
import SelectiveUnblockDialog from "@/components/facility/SelectiveUnblockDialog";
import DayScheduleCalendar from "@/components/admin/DayScheduleCalendar";

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
  created_at?: string;
  client_info?: {
    full_name: string;
    phone: string;
    email: string;
  };
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
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [blockStartTime, setBlockStartTime] = useState("");
  const [blockEndTime, setBlockEndTime] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const today = startOfDay(new Date());

  useEffect(() => {
    const loadData = async () => {
      if (!facilityId) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/facility/login");
        return;
      }

      // Check user role for admin permissions
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      const userIsAdmin = profileData?.role === 'admin';
      setIsAdmin(userIsAdmin);

      // Load facility details - admin can view any facility, owner only their own
      const facilityQuery = supabase
        .from('facilities')
        .select('*')
        .eq('id', facilityId);

      if (!userIsAdmin) {
        facilityQuery.eq('owner_id', user.id);
      }

      const { data: facilityData, error: facilityError } = await facilityQuery.maybeSingle();

      if (facilityError || !facilityData) {
        toast({
          title: "Eroare",
          description: userIsAdmin 
            ? "Nu s-a putut încărca facilitatea" 
            : "Nu s-a putut încărca facilitatea sau nu aveți permisiune să o vizualizați",
          variant: "destructive"
        });
        navigate(userIsAdmin ? "/admin" : "/manage-facilities");
        return;
      }

      setFacility(facilityData);

      // Load bookings with client information
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
        // Load client information for bookings
        let completeBookings = [];
        if (bookingsData && bookingsData.length > 0) {
          const { data: clientsInfo } = await supabase
            .rpc('get_client_info_for_facility_bookings', { facility_owner_id: user.id });

          completeBookings = bookingsData.map((booking: any) => {
            // Check if this is a manual booking
            const isManualBooking = booking.notes && booking.notes.includes('REZERVARE MANUALĂ');
            let clientInfo = null;
            
            if (isManualBooking) {
              // Parse client info from notes for manual bookings
              const notesMatch = booking.notes.match(/Client: ([^(|]+)(?:\s*\(Tel: ([^)]+)\))?/);
              if (notesMatch) {
                clientInfo = {
                  full_name: notesMatch[1].trim(),
                  phone: notesMatch[2] || 'Nr de tel necunoscut',
                  email: 'Manual booking'
                };
              }
            } else {
              // For regular bookings, find client info
              clientInfo = clientsInfo?.find((c: any) => c.client_id === booking.client_id);
              if (clientInfo) {
                clientInfo = {
                  full_name: clientInfo.client_name,
                  phone: clientInfo.client_phone,
                  email: clientInfo.client_email
                };
              }
            }

            return {
              ...booking,
              client_info: clientInfo || {
                full_name: 'Client neidentificat',
                phone: 'Contact indisponibil',
                email: 'Email nedisponibil'
              }
            };
          });
        }
        setBookings(completeBookings);
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

  const getAllBookingsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return bookings.filter(booking => booking.booking_date === dateStr);
  };

  const getActiveBookingsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return bookings.filter(booking => 
      booking.booking_date === dateStr && (booking.status === 'confirmed' || booking.status === 'pending')
    );
  };

  const getBlockedHoursForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return blockedDates.filter(blocked => blocked.blocked_date === dateStr);
  };

  const getBlockedSlotsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return blockedDates.filter(blocked => blocked.blocked_date === dateStr);
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: bookingsData, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .eq('facility_id', facilityId)
      .gte('booking_date', format(new Date(), 'yyyy-MM-dd'))
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (!bookingsError && bookingsData) {
      // Load client information for bookings
      const { data: clientsInfo } = await supabase
        .rpc('get_client_info_for_facility_bookings', { facility_owner_id: user.id });

      const completeBookings = bookingsData.map((booking: any) => {
        // Check if this is a manual booking
        const isManualBooking = booking.notes && booking.notes.includes('REZERVARE MANUALĂ');
        let clientInfo = null;
        
        if (isManualBooking) {
          // Parse client info from notes for manual bookings
          const notesMatch = booking.notes.match(/Client: ([^(|]+)(?:\s*\(Tel: ([^)]+)\))?/);
          if (notesMatch) {
            clientInfo = {
              full_name: notesMatch[1].trim(),
              phone: notesMatch[2] || 'Nr de tel necunoscut',
              email: 'Manual booking'
            };
          }
        } else {
          // For regular bookings, find client info
          clientInfo = clientsInfo?.find((c: any) => c.client_id === booking.client_id);
          if (clientInfo) {
            clientInfo = {
              full_name: clientInfo.client_name,
              phone: clientInfo.client_phone,
              email: clientInfo.client_email
            };
          }
        }

        return {
          ...booking,
          client_info: clientInfo || {
            full_name: 'Client neidentificat',
            phone: 'Contact indisponibil',
            email: 'Email nedisponibil'
          }
        };
      });

      setBookings(completeBookings);
    }
  };

  const refreshBlockedDates = async () => {
    if (!facilityId) return;
    
    const { data: blockedData, error: blockedError } = await supabase
      .from('blocked_dates')
      .select('*')
      .eq('facility_id', facilityId)
      .gte('blocked_date', format(new Date(), 'yyyy-MM-dd'))
      .order('blocked_date', { ascending: true });

    if (!blockedError) {
      setBlockedDates(blockedData || []);
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

    // Check for conflicts with existing active bookings (excluding cancelled)
    const dayBookings = getActiveBookingsForDate(selectedDate);
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

  const getStatusLabel = (status: string, paymentMethod?: string) => {
    switch (status) {
      case 'confirmed':
        return 'Confirmată';
      case 'cancelled':
        return 'Anulată';
      case 'completed':
        return 'Finalizată';
      case 'no_show':
        return 'Nu s-a prezentat';
      case 'pending':
        // For card payments, display as confirmed in calendar view
        return paymentMethod === 'card' ? 'Confirmată' : 'În așteptare';
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
                  hasBookings: (date) => getActiveBookingsForDate(date).length > 0 && !hasPartialBlockings(date) && !isDateFullyBlocked(date),
                  partiallyBlocked: (date) => hasPartialBlockings(date) && getActiveBookingsForDate(date).length === 0,
                  fullyBlocked: (date) => isDateFullyBlocked(date),
                  hasBookingsAndPartialBlocks: (date) => getActiveBookingsForDate(date).length > 0 && hasPartialBlockings(date)
                }}
                modifiersStyles={{
                  hasBookings: { 
                    backgroundColor: '#3b82f6', 
                    color: 'white',
                    fontWeight: 'bold'
                  },
                  partiallyBlocked: { 
                    backgroundColor: '#eab308', 
                    color: 'white',
                    fontWeight: 'bold'
                  },
                  fullyBlocked: { 
                    backgroundColor: '#ef4444', 
                    color: 'white',
                    fontWeight: 'bold'
                  },
                  hasBookingsAndPartialBlocks: {
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    fontWeight: 'bold',
                    border: '2px solid #eab308',
                    borderRadius: '6px'
                  }
                }}
                disabled={(date) => isBefore(date, startOfDay(new Date()))}
              />
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border" style={{ backgroundColor: '#3b82f6' }}></div>
                  <span>Zile cu rezervări</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border" style={{ backgroundColor: '#eab308' }}></div>
                  <span>Zile parțial blocate</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border-2" style={{ backgroundColor: '#3b82f6', borderColor: '#eab308' }}></div>
                  <span>Zile cu rezervări și blocări parțiale</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border" style={{ backgroundColor: '#ef4444' }}></div>
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
                    {getActiveBookingsForDate(selectedDate).length} rezervări active
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedDate ? (
                <div className="space-y-4">
                  {/* Add Manual Booking Button */}
                  <AddManualBookingDialog 
                    facilityId={facilityId!}
                    onBookingAdded={refreshBookings}
                    facility={facility}
                    selectedDate={selectedDate}
                  />

                  {/* Blocking Options */}
                  {!isBefore(selectedDate, today) ? (
                    <div className="space-y-3">
                       {(() => {
                         const existingBookings = getActiveBookingsForDate(selectedDate);
                         const hasExistingBookings = existingBookings.length > 0;
                         
                         if (isDateFullyBlocked(selectedDate)) {
                           return (
                             <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-center">
                               <p className="text-sm text-red-800 font-medium">
                                 ⛔ Ziua este complet blocată
                               </p>
                             </div>
                           );
                         }
                         
                         return (
                           <>
                             <CombinedBlockDialog
                               facilityId={facilityId}
                               selectedDate={selectedDate}
                                onBlockingAdded={() => {
                                  refreshBookings();
                                  refreshBlockedDates();
                                }}
                               hasExistingBookings={hasExistingBookings}
                             />
                             
                             {/* Block Specific Hours Button */}
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
                                 
                                 <div className="grid gap-4">
                                   <div className="grid grid-cols-2 gap-4">
                                     <div className="space-y-2">
                                       <Label htmlFor="start-time">Ora de început</Label>
                                       <Select value={blockStartTime} onValueChange={setBlockStartTime}>
                                         <SelectTrigger>
                                           <SelectValue placeholder="Selectează ora" />
                                         </SelectTrigger>
                                         <SelectContent className="max-h-[200px] overflow-y-auto">
                                            {(() => {
                                              const options = [];
                                              const facilityStart = facility?.operating_hours_start || '08:00';
                                              const facilityEnd = facility?.operating_hours_end || '22:00';
                                              
                                              // Parse facility hours properly with minutes
                                              const [startHour, startMin] = facilityStart.split(':').map(Number);
                                              const [endHour, endMin] = facilityEnd.split(':').map(Number);
                                              const facilityStartMinutes = startHour * 60 + startMin;
                                              const facilityEndMinutes = endHour * 60 + endMin;
                                              
                                              // Generate time slots in 30-minute intervals within operating hours
                                              for (let totalMinutes = facilityStartMinutes; totalMinutes < facilityEndMinutes; totalMinutes += 30) {
                                                const hour = Math.floor(totalMinutes / 60);
                                                const minute = totalMinutes % 60;
                                                const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                                                
                                                // Check if this time slot has any booking conflicts
                                                const existingBookings = selectedDate ? getActiveBookingsForDate(selectedDate) : [];
                                                const hasBookingConflict = existingBookings.some(booking => {
                                                  const bookingStart = booking.start_time.slice(0, 5);
                                                  const bookingEnd = booking.end_time.slice(0, 5);
                                                  return timeString >= bookingStart && timeString < bookingEnd;
                                                });
                                                
                                                // Check if this time slot overlaps with any blocked time
                                                const existingBlocks = selectedDate ? getBlockedHoursForDate(selectedDate) : [];
                                                const hasBlockConflict = existingBlocks.some(block => {
                                                  if (!block.start_time || !block.end_time) return true; // Full day block
                                                  const blockStart = block.start_time.slice(0, 5);
                                                  const blockEnd = block.end_time.slice(0, 5);
                                                  return timeString >= blockStart && timeString < blockEnd;
                                                });
                                                
                                                options.push(
                                                  <SelectItem 
                                                    key={timeString} 
                                                    value={timeString}
                                                    disabled={hasBookingConflict || hasBlockConflict}
                                                  >
                                                    {timeString} {hasBookingConflict ? '(rezervat)' : hasBlockConflict ? '(blocat)' : ''}
                                                  </SelectItem>
                                                );
                                              }
                                              return options;
                                           })()}
                                         </SelectContent>
                                       </Select>
                                     </div>
                                     
                                     <div className="space-y-2">
                                       <Label htmlFor="end-time">Ora de sfârșit</Label>
                                       <Select value={blockEndTime} onValueChange={setBlockEndTime}>
                                         <SelectTrigger>
                                           <SelectValue placeholder="Selectează ora" />
                                         </SelectTrigger>
                                         <SelectContent className="max-h-[200px] overflow-y-auto">
                                            {(() => {
                                              const options = [];
                                              const facilityStart = facility?.operating_hours_start || '08:00';
                                              const facilityEnd = facility?.operating_hours_end || '22:00';
                                              
                                              // Parse facility hours properly with minutes
                                              const [startHour, startMin] = facilityStart.split(':').map(Number);
                                              const [endHour, endMin] = facilityEnd.split(':').map(Number);
                                              const facilityStartMinutes = startHour * 60 + startMin;
                                              const facilityEndMinutes = endHour * 60 + endMin;
                                              
                                              // Generate time slots in 30-minute intervals, including end time
                                              for (let totalMinutes = facilityStartMinutes + 30; totalMinutes <= facilityEndMinutes; totalMinutes += 30) {
                                                const hour = Math.floor(totalMinutes / 60);
                                                const minute = totalMinutes % 60;
                                                const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                                                
                                                // Only show end times that are after the selected start time
                                                const isAfterStartTime = !blockStartTime || timeString > blockStartTime;
                                                
                                                options.push(
                                                  <SelectItem 
                                                    key={timeString} 
                                                    value={timeString}
                                                    disabled={!isAfterStartTime}
                                                  >
                                                    {timeString}
                                                  </SelectItem>
                                                );
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
                           </>
                         );
                       })()}
                       
                         {/* Enhanced Unblock Buttons */}
                         {isDateBlocked(selectedDate) && (
                           <div className="space-y-2">
                             {/* Use selective unblock if there are multiple blocked intervals */}
                             {getBlockedSlotsForDate(selectedDate).length > 1 ? (
                               <SelectiveUnblockDialog
                                 facilityId={facilityId}
                                 selectedDate={selectedDate}
                                 blockedTimeSlots={blockedDates}
                                 isAdmin={isAdmin}
                                 onUnblockComplete={() => {
                                   refreshBookings();
                                   refreshBlockedDates();
                                 }}
                               />
                             ) : (
                               <UnblockRecurringDialog
                                 facilityId={facilityId}
                                 selectedDate={selectedDate}
                                 blockedDates={blockedDates}
                                 onUnblockComplete={() => {
                                   refreshBookings();
                                   refreshBlockedDates();
                                 }}
                               />
                             )}
                           </div>
                          )}
                    </div>
                  ) : (
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">
                        Nu poți modifica datele din trecut
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <div className="text-center">
                    <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Selectează o dată din calendar</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Day-Specific Reservations */}
        {selectedDate && (
          <>
            {/* Day Schedule Calendar */}
            <DayScheduleCalendar
              selectedDate={selectedDate}
              bookings={bookings.map(booking => ({
                ...booking,
                facility_name: facility?.name || 'Facilitate',
                facility_type: facility?.facility_type || 'unknown',
                facility_city: facility?.city || '',
                client_name: 'Client',
                client_email: '',
                created_at: booking.created_at || new Date().toISOString(),
                facility_id: facilityId || ''
              }))}
              facilities={facility ? [{
                id: facility.id,
                name: facility.name,
                facility_type: facility.facility_type,
                city: facility.city,
                operating_hours_start: facility.operating_hours_start,
                operating_hours_end: facility.operating_hours_end,
                price_per_hour: facility.price_per_hour
              }] : []}
              selectedFacility={facility?.id || 'all'}
              onBookingClick={(bookingId) => {
                console.log('Clicked booking:', bookingId);
                // Scroll to specific booking in the list
                setTimeout(() => {
                  const bookingElement = document.getElementById(`booking-${bookingId}`);
                  if (bookingElement) {
                    bookingElement.scrollIntoView({ 
                      behavior: 'smooth',
                      block: 'center'
                    });
                    // Add highlight effect
                    bookingElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                    setTimeout(() => {
                      bookingElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
                    }, 3000);
                  }
                }, 100);
              }}
              blockedDates={blockedDates.map(b => ({ ...b, facility_id: facilityId || '' })) as any}
            />

            <Card className="mt-6" id="reservations-section">
              <CardHeader>
                <CardTitle>Rezervări pentru {format(selectedDate, 'd MMMM yyyy', { locale: ro })}</CardTitle>
                <CardDescription>
                  Toate rezervările, blocările și rezervările manuale pentru data selectată
                </CardDescription>
              </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Existing Bookings */}
                <div>
                  <h3 className="flex items-center gap-2 font-semibold mb-3">
                    <CalendarIcon className="h-4 w-4" />
                    Rezervări ({getAllBookingsForDate(selectedDate).length})
                  </h3>
                  {getAllBookingsForDate(selectedDate).length === 0 ? (
                    <p className="text-muted-foreground text-sm p-3 bg-muted/30 rounded-lg">Nu există rezervări pentru această dată</p>
                  ) : (
                    <div className="space-y-3">
                      {getAllBookingsForDate(selectedDate).map((booking) => (
                        <div 
                          key={booking.id} 
                          id={`booking-${booking.id}`}
                          className="flex items-start justify-between p-4 border rounded-lg bg-card transition-all duration-300"
                        >
                          <div className="flex-1">
                            <div className="font-medium mb-1">{booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}</div>
                            <div className="text-muted-foreground text-sm mb-2">
                              {booking.total_price} RON • {booking.payment_method === 'card' ? 'Plată cu cardul' : 'Plată cash'}
                            </div>
                            
                            {/* Client Information */}
                            <div className="text-sm text-muted-foreground mb-2">
                              <div className="font-medium text-foreground">{booking.client_info?.full_name || 'Client neidentificat'}</div>
                              <div className="flex gap-4 text-xs mt-1">
                                <span>📞 {booking.client_info?.phone || 'Telefon nedisponibil'}</span>
                                <span>✉️ {booking.client_info?.email || 'Email nedisponibil'}</span>
                              </div>
                            </div>
                            
                            {booking.notes && (
                              <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
                                <strong>Notă:</strong> {booking.notes}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
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
                </div>

                {/* Blocked Hours */}
                <div>
                  <h3 className="flex items-center gap-2 font-semibold mb-3">
                    <Clock className="h-4 w-4" />
                    Ore Blocate ({getBlockedHoursForDate(selectedDate).length})
                  </h3>
                  {getBlockedHoursForDate(selectedDate).length === 0 ? (
                    <p className="text-muted-foreground text-sm p-3 bg-muted/30 rounded-lg">Nu există ore blocate pentru această dată</p>
                  ) : (
                    <div className="space-y-2">
                      {getBlockedHoursForDate(selectedDate).map((block) => (
                        <div key={block.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div>
                            <div className="font-medium text-red-800">
                              {block.start_time ? `${block.start_time.slice(0, 5)} - ${block.end_time?.slice(0, 5)}` : 'Toată ziua'}
                            </div>
                            {block.reason && (
                              <div className="text-sm text-red-600">{block.reason}</div>
                            )}
                          </div>
                          <Badge variant="destructive" className="text-xs">Blocat</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default FacilityCalendarPage;

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
import GeneralScheduleCalendar from "@/components/admin/GeneralScheduleCalendar";

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
  facility_id: string;
  created_at: string;
  facility_name: string;
  facility_type: string;
  facility_city: string;
  client_name: string;
  client_email: string;
  stripe_session_id?: string;
}

interface BlockedDate {
  id: string;
  facility_id: string;
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
  const [blockFullDayOpen, setBlockFullDayOpen] = useState(false);
  const [blockStartTime, setBlockStartTime] = useState("");
  const [blockEndTime, setBlockEndTime] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // New state for general calendar view
  const [viewMode, setViewMode] = useState<'individual' | 'general'>('general');
  const [allFacilities, setAllFacilities] = useState<Facility[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [allBlockedDates, setAllBlockedDates] = useState<BlockedDate[]>([]);
  
  
  const today = startOfDay(new Date());

  // Sport type color mapping
  const sportColors: Record<string, string> = {
    'football': 'bg-green-600',
    'tennis': 'bg-blue-600', 
    'basketball': 'bg-orange-600',
    'volleyball': 'bg-purple-600',
    'padel': 'bg-pink-600',
    'squash': 'bg-yellow-600',
    'swimming': 'bg-cyan-600',
    'ping_pong': 'bg-red-600',
    'badminton': 'bg-indigo-600',
    'handball': 'bg-emerald-600'
  };

  // Get sport color for booking
  const getSportColor = (facilityType: string) => {
    return sportColors[facilityType] || 'bg-gray-600';
  };

  const handleBookingClick = (bookingId: string) => {
    const bookingElement = document.getElementById(`booking-${bookingId}`);
    if (bookingElement) {
      bookingElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      bookingElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
      setTimeout(() => {
        bookingElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
      }, 2000);
    }
  };

  // Load owner facilities for general calendar
  const loadAllFacilities = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate('/facility-owner-login');
        return;
      }

      const { data: facilitiesData, error } = await supabase
        .from('facilities')
        .select('*')
        .eq('owner_id', userData.user.id)
        .eq('is_active', true);

      if (error) {
        console.error('Error loading facilities:', error);
        toast({
          title: 'Eroare',
          description: 'Nu s-au putut încărca facilitățile.',
          variant: 'destructive'
        });
        return;
      }

      setAllFacilities(facilitiesData || []);
      
      // Load all bookings for all facilities
      if (facilitiesData && facilitiesData.length > 0) {
        const facilityIds = facilitiesData.map(f => f.id);
        
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select('*')
          .in('facility_id', facilityIds)
          .gte('booking_date', format(new Date(), 'yyyy-MM-dd'))
          .order('booking_date', { ascending: true })
          .order('start_time', { ascending: true });

        if (bookingsError) {
          console.error('Error loading bookings:', bookingsError);
        } else {
          // Transform bookings to match the expected interface
          const transformedBookings = await Promise.all(
            (bookingsData || []).map(async (booking) => {
              // Get facility details
              const facility = facilitiesData.find(f => f.id === booking.facility_id);
              
              // Get client details
              const { data: clientProfile } = await supabase
                .from('profiles')
                .select('full_name, email')
                .eq('user_id', booking.client_id)
                .single();

              return {
                ...booking,
                created_at: booking.created_at || new Date().toISOString(),
                facility_name: facility?.name || 'Necunoscut',
                facility_type: facility?.facility_type || 'unknown',
                facility_city: facility?.city || 'Necunoscut',
                client_name: clientProfile?.full_name || 'Necunoscut',
                client_email: clientProfile?.email || 'necunoscut@email.com'
              };
            })
          );
          setAllBookings(transformedBookings);
        }

        // Load all blocked dates
        const { data: blockedData, error: blockedError } = await supabase
          .from('blocked_dates')
          .select('*')
          .in('facility_id', facilityIds)
          .gte('blocked_date', format(new Date(), 'yyyy-MM-dd'));

        if (blockedError) {
          console.error('Error loading blocked dates:', blockedError);
        } else {
          setAllBlockedDates(blockedData || []);
        }
      }
    } catch (error) {
      console.error('Error in loadAllFacilities:', error);
    }
  };

  // Load all facilities when switching to general view
  useEffect(() => {
    if (viewMode === 'general') {
      loadAllFacilities();
    }
  }, [viewMode]);

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
        // Transform bookings to match interface for individual view
        const transformedBookings = (bookingsData || []).map(booking => ({
          ...booking,
          created_at: booking.created_at || new Date().toISOString(),
          facility_name: facility?.name || 'Necunoscut',
          facility_type: facility?.facility_type || 'unknown',
          facility_city: facility?.city || 'Necunoscut',
          client_name: 'Client',
          client_email: 'client@email.com'
        }));
        setBookings(transformedBookings);
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

  
  // Functions for general calendar view
  const getAllBookingsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const bookingsToUse = viewMode === 'general' ? allBookings : bookings;
    return bookingsToUse.filter(booking => booking.booking_date === dateStr);
  };

  const getActiveBookingsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const bookingsToUse = viewMode === 'general' ? allBookings : bookings;
    return bookingsToUse.filter(booking => 
      booking.booking_date === dateStr && (booking.status === 'confirmed' || booking.status === 'pending')
    );
  };

  const getBlockedHoursForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const blockedToUse = viewMode === 'general' ? allBlockedDates : blockedDates;
    return blockedToUse.filter(block => block.blocked_date === dateStr);
  };

  // Get overlapping bookings (same time, different or same facilities)
  const getBookingOverlaps = (date: Date) => {
    const dayBookings = getActiveBookingsForDate(date);
    const overlaps: Array<{timeSlot: string, bookings: typeof dayBookings, sameType: boolean}> = [];

    // Group bookings by time slots
    const timeSlotMap = new Map<string, typeof dayBookings>();
    
    dayBookings.forEach(booking => {
      const startTime = booking.start_time.slice(0, 5);
      if (!timeSlotMap.has(startTime)) {
        timeSlotMap.set(startTime, []);
      }
      timeSlotMap.get(startTime)!.push(booking);
    });

    // Find overlaps
    timeSlotMap.forEach((bookingsInSlot, timeSlot) => {
      if (bookingsInSlot.length > 1) {
        // Check if they're the same sport type
        const facilityTypes = new Set();
        bookingsInSlot.forEach(booking => {
          const facility = allFacilities.find(f => f.id === booking.facility_id);
          if (facility) facilityTypes.add(facility.facility_type);
        });
        
        overlaps.push({
          timeSlot,
          bookings: bookingsInSlot,
          sameType: facilityTypes.size === 1
        });
      }
    });

    return overlaps;
  };


  const isDateBlocked = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const blockedToUse = viewMode === 'general' ? allBlockedDates : blockedDates;
    return blockedToUse.some(block => block.blocked_date === dateStr);
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
      // Transform bookings to match interface for individual view
      const transformedBookings = (bookingsData || []).map(booking => ({
        ...booking,
        created_at: booking.created_at || new Date().toISOString(),
        facility_name: facility?.name || 'Necunoscut',
        facility_type: facility?.facility_type || 'unknown',
        facility_city: facility?.city || 'Necunoscut',
        client_name: 'Client',
        client_email: 'client@email.com'
      }));
      setBookings(transformedBookings);
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

  if (!facility && viewMode === 'individual') {
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
          
          <div className="flex flex-col gap-4">
            {/* View Mode Selector */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant={viewMode === 'general' ? 'default' : 'outline'}
                  onClick={() => setViewMode('general')}
                  className="flex items-center gap-2"
                >
                  <CalendarIcon className="h-4 w-4" />
                  Calendar General
                </Button>
                <Button 
                  variant={viewMode === 'individual' ? 'default' : 'outline'}
                  onClick={() => setViewMode('individual')}
                  className="flex items-center gap-2"
                >
                  <CalendarIcon className="h-4 w-4" />
                  Calendar Individual
                </Button>
              </div>
            </div>
            
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {viewMode === 'individual' ? facility?.name : 'Calendar General'}
              </h1>
              {viewMode === 'individual' && facility ? (
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
              ) : (
                <div className="text-muted-foreground mt-2">
                  Toate terenurile - {allFacilities.length} facilități
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Render the correct calendar based on view mode */}
        {viewMode === 'general' ? (
          <GeneralScheduleCalendar 
            selectedDate={selectedDate}
            facilities={allFacilities}
            bookings={allBookings}
            blockedDates={allBlockedDates}
            onBookingClick={handleBookingClick}
            sportColors={sportColors}
          />
        ) : (
          <>
            {/* Main Content - Individual Calendar */}
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
                      hasBookings: (date) => getActiveBookingsForDate(date).length > 0,
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
                    {selectedDate && facility && (
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
                        facility={facility!}
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
                                                 
                                                 // Generate time slots in 30-minute intervals within operating hours
                                                 // For end time, start from 30 minutes after the facility start
                                                 for (let totalMinutes = facilityStartMinutes + 30; totalMinutes <= facilityEndMinutes; totalMinutes += 30) {
                                                   const hour = Math.floor(totalMinutes / 60);
                                                   const minute = totalMinutes % 60;
                                                   const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                                                   
                                                   // Only show times after the selected start time
                                                   if (blockStartTime && timeString <= blockStartTime) {
                                                     continue;
                                                   }
                                                   
                                                   // Check if this time slot has any booking conflicts
                                                   const existingBookings = selectedDate ? getActiveBookingsForDate(selectedDate) : [];
                                                   const hasBookingConflict = existingBookings.some(booking => {
                                                     const bookingStart = booking.start_time.slice(0, 5);
                                                     const bookingEnd = booking.end_time.slice(0, 5);
                                                     return timeString > bookingStart && timeString <= bookingEnd;
                                                   });
                                                   
                                                   // Check if this time slot overlaps with any blocked time
                                                   const existingBlocks = selectedDate ? getBlockedHoursForDate(selectedDate) : [];
                                                   const hasBlockConflict = existingBlocks.some(block => {
                                                     if (!block.start_time || !block.end_time) return true; // Full day block
                                                     const blockStart = block.start_time.slice(0, 5);
                                                     const blockEnd = block.end_time.slice(0, 5);
                                                     return timeString > blockStart && timeString <= blockEnd;
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
                                       </div>
                                       <div className="space-y-2">
                                         <Label htmlFor="reason">Motivul blocării</Label>
                                         <Textarea
                                           id="reason"
                                           placeholder="De ex: Întreținere, Eveniment privat, etc."
                                           value={blockReason}
                                           onChange={(e) => setBlockReason(e.target.value)}
                                         />
                                       </div>
                                       <div className="flex gap-2">
                                         <Button onClick={blockPartialHours} className="flex-1">
                                           Blochează Orele
                                         </Button>
                                         <Button variant="outline" onClick={() => setIsBlockDialogOpen(false)}>
                                           Anulează
                                         </Button>
                                       </div>
                                     </div>
                                   </DialogContent>
                                 </Dialog>

                                 {/* Full Day Block Button */}
                                 <Dialog open={blockFullDayOpen} onOpenChange={setBlockFullDayOpen}>
                                   <DialogTrigger asChild>
                                     <Button variant="outline" className="w-full">
                                       <Ban className="h-4 w-4 mr-2" />
                                       Blochează Întreaga Zi
                                     </Button>
                                   </DialogTrigger>
                                   <DialogContent>
                                     <DialogHeader>
                                       <DialogTitle>Blochează Întreaga Zi</DialogTitle>
                                       <DialogDescription>
                                         Vei bloca {selectedDate && format(selectedDate, 'dd MMMM yyyy', { locale: ro })} pentru orice tip de rezervare
                                       </DialogDescription>
                                     </DialogHeader>
                                     
                                     <div className="space-y-4">
                                       <div className="space-y-2">
                                         <Label htmlFor="full-day-reason">Motivul blocării</Label>
                                         <Textarea
                                           id="full-day-reason"
                                           placeholder="De ex: Sărbătoare, Renovări, Indisponibil"
                                           value={blockReason}
                                           onChange={(e) => setBlockReason(e.target.value)}
                                         />
                                       </div>
                                       <div className="flex gap-2">
                                         <Button 
                                           onClick={() => {
                                             blockFullDay();
                                             setBlockFullDayOpen(false);
                                           }} 
                                           className="flex-1"
                                         >
                                           Blochează Ziua
                                         </Button>
                                         <Button variant="outline" onClick={() => setBlockFullDayOpen(false)}>
                                           Anulează
                                         </Button>
                                       </div>
                                     </div>
                                   </DialogContent>
                                 </Dialog>
                               </>
                             );
                           })()}
                        </div>
                      ) : (
                        <div className="p-3 bg-muted/30 rounded-lg text-center">
                          <p className="text-sm text-muted-foreground">
                            Nu poți gestiona blocări pentru zilele din trecut
                          </p>
                        </div>
                      )}

                      {/* Existing Blocked Hours for Selected Date */}
                      {selectedDate && getBlockedSlotsForDate(selectedDate).length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm">Blocări Existente:</h4>
                          {getBlockedSlotsForDate(selectedDate).map((block) => (
                            <div key={block.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <CalendarOff className="h-4 w-4 text-red-600" />
                                  <span className="font-medium text-red-800">
                                    {block.start_time && block.end_time 
                                      ? `${block.start_time.slice(0, 5)} - ${block.end_time.slice(0, 5)}`
                                      : 'Întreaga zi'
                                    }
                                  </span>
                                </div>
                                {block.reason && (
                                  <p className="text-sm text-red-600 mt-1">{block.reason}</p>
                                )}
                              </div>
                              
                              {/* Unblock options */}
                              {!isBefore(selectedDate, today) && (
                                <div className="flex gap-2">
                                  {block.start_time && block.end_time ? (
                                    <SelectiveUnblockDialog
                                      facilityId={facilityId!}
                                      selectedDate={selectedDate}
                                      blockedTimeSlots={getBlockedSlotsForDate(selectedDate)}
                                      onUnblockComplete={refreshBlockedDates}
                                    />
                                  ) : (
                                    <UnblockRecurringDialog
                                      facilityId={facilityId!}
                                      selectedDate={selectedDate}
                                      blockedDates={getBlockedSlotsForDate(selectedDate)}
                                      onUnblockComplete={refreshBlockedDates}
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Display active bookings for the selected date */}
                      {selectedDate && getAllBookingsForDate(selectedDate).length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm">Rezervări pentru această zi:</h4>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {getAllBookingsForDate(selectedDate)
                              .sort((a, b) => a.start_time.localeCompare(b.start_time))
                              .map((booking) => {
                                const isActive = booking.status === 'confirmed' || booking.status === 'pending';
                                return (
                                  <div 
                                    key={booking.id} 
                                    id={`booking-${booking.id}`}
                                    className={`p-3 rounded-lg border transition-all duration-500 ${
                                      isActive 
                                        ? 'bg-emerald-50 border-emerald-200' 
                                        : 'bg-gray-50 border-gray-200 opacity-60'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <Clock className={`h-4 w-4 ${isActive ? 'text-emerald-600' : 'text-gray-500'}`} />
                                          <span className={`font-medium ${isActive ? 'text-emerald-800' : 'text-gray-600'}`}>
                                            {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                                          </span>
                                          <Badge variant={getStatusBadgeVariant(booking.status)}>
                                            {getStatusLabel(booking.status, booking.payment_method)}
                                          </Badge>
                                        </div>
                                        <p className={`text-sm mt-1 ${isActive ? 'text-emerald-600' : 'text-gray-500'}`}>
                                          {booking.total_price} RON • {booking.payment_method === 'cash' ? 'Plată la fața locului' : 'Plată cu cardul'}
                                        </p>
                                        {booking.notes && (
                                          <p className="text-xs text-muted-foreground mt-1 italic">
                                            {booking.notes}
                                          </p>
                                        )}
                                      </div>
                                      
                                      <div className="flex items-center gap-2">
                                        <BookingStatusManager
                                          booking={booking}
                                          onStatusUpdate={refreshBookings}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Selectează o dată din calendar pentru a vedea rezervările și a gestiona blocările
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FacilityCalendarPage;

import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Calendar as CalendarIcon, Clock, Users, MapPin, Ban, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay, isSameDay, isBefore } from "date-fns";
import { ro } from "date-fns/locale";
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
  price_per_hour: number;
  operating_hours_start?: string;
  operating_hours_end?: string;
  address?: string;
  city: string;
  capacity?: number;
  capacity_max?: number;
}

interface Booking {
  id: string;
  facility_id: string;
  facility_name?: string;
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
  facility_id: string;
  blocked_date: string;
  start_time?: string;
  end_time?: string;
  reason?: string;
}

const UniversalCalendarPage = () => {
  const [searchParams] = useSearchParams();
  const facilityIdParam = searchParams.get('facilityId');
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(facilityIdParam || "general");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [highlightedBookings, setHighlightedBookings] = useState<string[]>([]);
  const [highlightedBlockedDates, setHighlightedBlockedDates] = useState<string[]>([]);
  
  // Block specific hours dialog state
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [blockStartTime, setBlockStartTime] = useState("");
  const [blockEndTime, setBlockEndTime] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const visualCalendarRef = useRef<HTMLDivElement>(null);
  const today = startOfDay(new Date());

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (selectedFacilityId !== "general") {
      loadFacilitySpecificData(selectedFacilityId);
    } else {
      const facilityIds = facilities.map(f => f.id);
      if (facilityIds.length > 0) {
        loadBookingsForFacilities(facilityIds);
        loadBlockedDatesForFacilities(facilityIds);
      }
    }
  }, [selectedFacilityId]);

  const loadAllData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/facility/login");
      return;
    }

    const { data: facilitiesData, error: facilitiesError } = await supabase
      .from('facilities')
      .select('*')
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .order('name');

    if (facilitiesError) {
      console.error('Error fetching facilities:', facilitiesError);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca facilitățile",
        variant: "destructive"
      });
      setIsLoading(false);
      return;
    }

    setFacilities(facilitiesData || []);

    const facilityIds = facilitiesData?.map(f => f.id) || [];
    if (facilityIds.length > 0) {
      await loadBookingsForFacilities(facilityIds);
      await loadBlockedDatesForFacilities(facilityIds);
    }

    setIsLoading(false);
  };

  const loadBookingsForFacilities = async (facilityIds: string[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: bookingsData, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .in('facility_id', facilityIds)
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      return;
    }

    let completeBookings = [];
    if (bookingsData && bookingsData.length > 0) {
      const { data: clientsInfo } = await supabase
        .rpc('get_client_info_for_facility_bookings', { facility_owner_id: user.id });

      const { data: facilitiesInfo } = await supabase
        .from('facilities')
        .select('id, name')
        .in('id', facilityIds);

      completeBookings = bookingsData.map((booking: any) => {
        const facilityInfo = facilitiesInfo?.find(f => f.id === booking.facility_id);
        const isManualBooking = booking.notes?.toUpperCase().includes('REZERVARE MANUALĂ');
        
        let clientInfo = null;
        if (isManualBooking && booking.facility_name && booking.facility_address) {
          clientInfo = {
            full_name: booking.facility_name,
            phone: booking.facility_address || 'Telefon neadăugat',
            email: null // No email for manual bookings
          };
        } else {
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
          facility_name: facilityInfo?.name || 'Teren necunoscut',
          client_info: clientInfo || {
            full_name: 'Client neidentificat',
            phone: 'Contact indisponibil',
            email: 'Email nedisponibil'
          }
        };
      });
    }
    setBookings(completeBookings);
  };

  const loadBlockedDatesForFacilities = async (facilityIds: string[]) => {
    const { data: blockedData, error: blockedError } = await supabase
      .from('blocked_dates')
      .select('*')
      .in('facility_id', facilityIds)
      .order('blocked_date', { ascending: true });

    if (blockedError) {
      console.error('Error fetching blocked dates:', blockedError);
    } else {
      setBlockedDates(blockedData || []);
    }
  };

  const loadFacilitySpecificData = async (facilityId: string) => {
    const facilityIds = [facilityId];
    await loadBookingsForFacilities(facilityIds);
    await loadBlockedDatesForFacilities(facilityIds);
  };

  const handleFacilityChange = (value: string) => {
    setSelectedFacilityId(value);
    setHighlightedBookings([]);
    setHighlightedBlockedDates([]);
  };

  const getAllBookingsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    return bookings.filter(booking => {
      if (booking.booking_date !== dateStr) return false;
      if (booking.status === 'cancelled') return false;
      
      if (booking.status === 'pending') {
        const bookingCreatedAt = new Date(booking.created_at || Date.now());
        if (bookingCreatedAt < tenMinutesAgo) return false;
      }
      
      if (selectedFacilityId !== "general" && booking.facility_id !== selectedFacilityId) {
        return false;
      }
      
      return true;
    });
  };

  const getActiveBookingsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    return bookings.filter(booking => {
      if (booking.booking_date !== dateStr) return false;
      if (booking.status !== 'confirmed' && booking.status !== 'pending') return false;
      
      if (booking.status === 'pending') {
        const bookingCreatedAt = new Date(booking.created_at || Date.now());
        if (bookingCreatedAt < tenMinutesAgo) return false;
      }
      
      if (selectedFacilityId !== "general" && booking.facility_id !== selectedFacilityId) {
        return false;
      }
      
      return true;
    });
  };

  const getBlockedSlotsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    return blockedDates.filter(block => {
      if (block.blocked_date !== dateStr) return false;
      
      if (selectedFacilityId !== "general" && block.facility_id !== selectedFacilityId) {
        return false;
      }
      
      return true;
    });
  };

  const isDateFullyBlocked = (date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    if (selectedFacilityId === "general") {
      // For general calendar, check if ALL facilities are blocked for this date
      if (facilities.length === 0) return false;
      
      const blockedFacilitiesCount = facilities.filter(facility =>
        blockedDates.some(blocked =>
          blocked.blocked_date === dateStr &&
          blocked.facility_id === facility.id &&
          !blocked.start_time && 
          !blocked.end_time
        )
      ).length;
      
      return blockedFacilitiesCount === facilities.length;
    }
    
    return blockedDates.some(blocked => 
      blocked.blocked_date === dateStr && 
      blocked.facility_id === selectedFacilityId &&
      !blocked.start_time && 
      !blocked.end_time
    );
  };

  const hasPartialBlockings = (date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    if (selectedFacilityId === "general") {
      return false;
    }
    
    return blockedDates.some(blocked => 
      blocked.blocked_date === dateStr && 
      blocked.facility_id === selectedFacilityId &&
      blocked.start_time && 
      blocked.end_time
    );
  };

  const isDateBlocked = (date: Date): boolean => {
    return isDateFullyBlocked(date) || hasPartialBlockings(date);
  };

  const refreshData = async () => {
    const facilityIds = selectedFacilityId === "general"
      ? facilities.map(f => f.id)
      : [selectedFacilityId];
    
    if (facilityIds.length > 0) {
      await loadBookingsForFacilities(facilityIds);
      await loadBlockedDatesForFacilities(facilityIds);
    }
  };

  const handleDeleteBlockedDate = async (blockedDateId: string) => {
    try {
      const { error } = await supabase
        .from('blocked_dates')
        .delete()
        .eq('id', blockedDateId);

      if (error) throw error;

      toast({
        title: "Succes",
        description: "Blocajul a fost șters cu succes"
      });

      await refreshData();
    } catch (error) {
      console.error('Error deleting blocked date:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut șterge blocajul",
        variant: "destructive"
      });
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
        return paymentMethod === 'card' ? 'Confirmată' : 'În așteptare';
      default:
        return status;
    }
  };

  const selectedFacility = selectedFacilityId !== "general" 
    ? facilities.find(f => f.id === selectedFacilityId)
    : null;

  const hasExistingBookingsForDate = getActiveBookingsForDate(selectedDate).length > 0;

  const calendarModifiers = {
    past: (date: Date) => isBefore(date, today),
    hasBookings: (date: Date) => {
      if (selectedFacilityId === "general") {
        return getAllBookingsForDate(date).length > 0;
      }
      return getActiveBookingsForDate(date).length > 0 && !hasPartialBlockings(date) && !isDateFullyBlocked(date);
    },
    partiallyBlocked: (date: Date) => hasPartialBlockings(date) && getActiveBookingsForDate(date).length === 0,
    fullyBlocked: (date: Date) => isDateFullyBlocked(date),
    hasBookingsAndPartialBlocks: (date: Date) => getActiveBookingsForDate(date).length > 0 && hasPartialBlockings(date)
  };

  const calendarModifierStyles = {
    past: {
      opacity: '0.4',
      color: 'hsl(var(--muted-foreground))',
      fontWeight: 'normal'
    },
    hasBookings: { 
      backgroundColor: '#3b82f6', 
      color: 'white',
      fontWeight: 'bold',
      opacity: '1'
    },
    partiallyBlocked: { 
      backgroundColor: '#eab308', 
      color: 'white',
      fontWeight: 'bold',
      opacity: '1'
    },
    fullyBlocked: { 
      backgroundColor: '#ef4444', 
      color: 'white',
      fontWeight: 'bold',
      opacity: '1'
    },
    hasBookingsAndPartialBlocks: {
      backgroundColor: '#3b82f6',
      color: 'white',
      fontWeight: 'bold',
      border: '2px solid #eab308',
      borderRadius: '6px',
      opacity: '1'
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Se încarcă...</div>;
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Link to="/facility-owner-profile" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary hover:bg-primary/5 border-2 border-primary/20 hover:border-primary rounded-md px-3 py-2 transition-all duration-200">
              <ArrowLeft className="h-4 w-4" />
              Înapoi
            </Link>
            
            <div className="flex-1 flex justify-center">
              <Select value={selectedFacilityId} onValueChange={handleFacilityChange}>
                <SelectTrigger className="w-full max-w-md h-12 text-base font-medium">
                  <SelectValue placeholder="Selectează calendarul" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="general">📅 Calendar General</SelectItem>
                  {facilities.map(facility => (
                    <SelectItem key={facility.id} value={facility.id}>
                      {facility.name}
                    </SelectItem>
                  ))
                  }
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-[100px]"></div> {/* Spacer for balance */}
          </div>
          
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-foreground">
              {selectedFacilityId === "general" ? "Calendar General" : selectedFacility?.name}
            </h1>
            
            {/* Facility details - show only address for general calendar */}
            {selectedFacilityId === "general" ? (
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {facilities.length > 0 && `${facilities[0].address}, ${facilities[0].city}`}
              </div>
            ) : selectedFacility && (
              <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {selectedFacility.address}, {selectedFacility.city}
                </div>
                {selectedFacility.capacity && (
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Capacitate: {selectedFacility.capacity} {selectedFacility.capacity_max ? `- ${selectedFacility.capacity_max}` : ''} persoane
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {selectedFacility.price_per_hour} RON/oră
                </div>
              </div>
            )}
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
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    // Smooth scroll to visual calendar section after render
                    requestAnimationFrame(() => {
                      requestAnimationFrame(() => {
                        const el = document.getElementById('visual-calendar-section') || visualCalendarRef.current;
                        const found = !!el;
                        console.info('Calendar onSelect -> scroll', { found, date: date.toISOString() });
                        if (el) {
                          const y = el.getBoundingClientRect().top + window.scrollY - 80;
                          window.scrollTo({ top: y, behavior: 'smooth' });
                        }
                      });
                    });
                  }
                }}
                locale={ro}
                className="rounded-md border"
                modifiers={calendarModifiers}
                modifiersStyles={calendarModifierStyles}
              />
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border" style={{ backgroundColor: '#3b82f6' }}></div>
                  <span>Zile cu rezervări</span>
                </div>
                {selectedFacilityId === "general" ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border" style={{ backgroundColor: '#ef4444' }}></div>
                    <span>Toată baza blocată</span>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Selected Date Details */}
          <Card>
            <CardHeader>
              <CardTitle>
                {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: ro })}
              </CardTitle>
              <CardDescription>
                {selectedFacility && (
                  <>
                    Program: {selectedFacility.operating_hours_start?.slice(0, 5) || '08:00'} - {selectedFacility.operating_hours_end?.slice(0, 5) || '22:00'}
                    <br />
                  </>
                )}
                {getActiveBookingsForDate(selectedDate).length} rezervări active
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Add Manual Booking Button - only for specific facility */}
                {selectedFacilityId !== "general" && selectedFacility && (
                  <AddManualBookingDialog 
                    facilityId={selectedFacilityId}
                    onBookingAdded={refreshData}
                    facility={{
                      operating_hours_start: selectedFacility.operating_hours_start,
                      operating_hours_end: selectedFacility.operating_hours_end,
                      price_per_hour: selectedFacility.price_per_hour
                    }}
                    selectedDate={selectedDate}
                  />
                )}

                {/* Block/Unblock all facilities - only for general calendar on future dates */}
                {selectedFacilityId === "general" && !isBefore(selectedDate, today) && (
                  <div className="space-y-3">
                    {isDateFullyBlocked(selectedDate) ? (
                      <Button
                        variant="outline"
                        className="w-full border-green-500 text-green-700 hover:bg-green-50"
                        onClick={async () => {
                          try {
                            const dateStr = format(selectedDate, 'yyyy-MM-dd');
                            
                            // Unblock all facilities for this date
                            const { error } = await supabase
                              .from('blocked_dates')
                              .delete()
                              .eq('blocked_date', dateStr)
                              .is('start_time', null)
                              .is('end_time', null);

                            if (error) throw error;

                            toast({
                              title: "Succes",
                              description: `Toate terenurile au fost deblocate pentru ${format(selectedDate, 'dd MMMM yyyy', { locale: ro })}`,
                            });

                            await refreshData();
                          } catch (error) {
                            console.error('Error unblocking all facilities:', error);
                            toast({
                              title: "Eroare",
                              description: "Nu s-au putut debloca terenurile",
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        Deblochează Toată Baza
                      </Button>
                    ) : getActiveBookingsForDate(selectedDate).length === 0 ? (
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={async () => {
                          try {
                            const { data: { user } } = await supabase.auth.getUser();
                            const dateStr = format(selectedDate, 'yyyy-MM-dd');
                            
                            // Block all facilities
                            const blocksToInsert = facilities.map(facility => ({
                              facility_id: facility.id,
                              created_by: user?.id,
                              blocked_date: dateStr,
                              reason: 'Baza închisă - blocare completă'
                            }));

                            const { error } = await supabase
                              .from('blocked_dates')
                              .insert(blocksToInsert);

                            if (error) throw error;

                            toast({
                              title: "Succes",
                              description: `Toate terenurile au fost blocate pentru ${format(selectedDate, 'dd MMMM yyyy', { locale: ro })}`,
                            });

                            await refreshData();
                          } catch (error) {
                            console.error('Error blocking all facilities:', error);
                            toast({
                              title: "Eroare",
                              description: "Nu s-au putut bloca terenurile",
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        Blochează Toată Baza
                      </Button>
                    ) : (
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">
                          Nu poți bloca baza într-o zi cu rezervări existente
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Blocking Options - only for specific facility and future dates */}
                {selectedFacilityId !== "general" && !isBefore(selectedDate, today) && (
                  <div className="space-y-3">
                    {(() => {
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
                            facilityId={selectedFacilityId}
                            selectedDate={selectedDate}
                            onBlockingAdded={refreshData}
                            hasExistingBookings={hasExistingBookingsForDate}
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
                                  Selectează intervalul orar pe care vrei să îl blochezi pentru {format(selectedDate, 'dd MMMM yyyy', { locale: ro })}
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
                                           const facilityStart = selectedFacility?.operating_hours_start || '08:00';
                                           const facilityEnd = selectedFacility?.operating_hours_end || '22:00';
                                           
                                           const [startHour, startMin] = facilityStart.split(':').map(Number);
                                           const [endHour, endMin] = facilityEnd.split(':').map(Number);
                                           const facilityStartMinutes = startHour * 60 + startMin;
                                           const facilityEndMinutes = endHour * 60 + endMin;
                                           
                                           for (let totalMinutes = facilityStartMinutes; totalMinutes < facilityEndMinutes; totalMinutes += 30) {
                                             const hour = Math.floor(totalMinutes / 60);
                                             const minute = totalMinutes % 60;
                                             const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                                             
                                             const existingBookings = getActiveBookingsForDate(selectedDate);
                                             const hasBookingConflict = existingBookings.some(booking => {
                                               const bookingStart = booking.start_time.slice(0, 5);
                                               const bookingEnd = booking.end_time.slice(0, 5);
                                               return timeString >= bookingStart && timeString < bookingEnd;
                                             });
                                             
                                             const existingBlocks = getBlockedSlotsForDate(selectedDate);
                                             const hasBlockConflict = existingBlocks.some(block => {
                                               if (!block.start_time || !block.end_time) return true;
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
                                           const facilityStart = selectedFacility?.operating_hours_start || '08:00';
                                           const facilityEnd = selectedFacility?.operating_hours_end || '22:00';
                                           
                                           const [startHour, startMin] = facilityStart.split(':').map(Number);
                                           const [endHour, endMin] = facilityEnd.split(':').map(Number);
                                           const facilityStartMinutes = startHour * 60 + startMin;
                                           const facilityEndMinutes = endHour * 60 + endMin;
                                           
                                           for (let totalMinutes = facilityStartMinutes + 30; totalMinutes <= facilityEndMinutes; totalMinutes += 30) {
                                             const hour = Math.floor(totalMinutes / 60);
                                             const minute = totalMinutes % 60;
                                             const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                                             
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
                                    onClick={async () => {
                                      if (!blockReason.trim() || !blockStartTime || !blockEndTime) {
                                        toast({
                                          title: "Date incomplete",
                                          description: "Completează toate câmpurile",
                                          variant: "destructive"
                                        });
                                        return;
                                      }

                                      try {
                                        const { data: { user } } = await supabase.auth.getUser();
                                        const dateStr = format(selectedDate, 'yyyy-MM-dd');
                                        
                                        const { error } = await supabase
                                          .from('blocked_dates')
                                          .insert({
                                            facility_id: selectedFacilityId,
                                            created_by: user?.id,
                                            blocked_date: dateStr,
                                            start_time: blockStartTime,
                                            end_time: blockEndTime,
                                            reason: blockReason
                                          });

                                        if (error) throw error;

                                        toast({
                                          title: "Succes",
                                          description: `Orele ${blockStartTime} - ${blockEndTime} au fost blocate`
                                        });

                                        await refreshData();
                                        setIsBlockDialogOpen(false);
                                        setBlockStartTime("");
                                        setBlockEndTime("");
                                        setBlockReason("");
                                      } catch (error) {
                                        console.error('Error:', error);
                                        toast({
                                          title: "Eroare",
                                          description: "Nu s-au putut bloca orele",
                                          variant: "destructive"
                                        });
                                      }
                                    }}
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
                        {getBlockedSlotsForDate(selectedDate).length > 1 ? (
                          <SelectiveUnblockDialog
                            facilityId={selectedFacilityId}
                            selectedDate={selectedDate}
                            blockedTimeSlots={blockedDates}
                            isAdmin={false}
                            onUnblockComplete={refreshData}
                          />
                        ) : (
                          <UnblockRecurringDialog
                            facilityId={selectedFacilityId}
                            selectedDate={selectedDate}
                            blockedDates={blockedDates}
                            onUnblockComplete={refreshData}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Past date notice */}
                {isBefore(selectedDate, today) && selectedFacilityId !== "general" && (
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">
                      Nu poți modifica datele din trecut
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Day Schedule Calendar */}
        {selectedDate && (
          <div id="visual-calendar-section" ref={visualCalendarRef}>
            <DayScheduleCalendar
              selectedDate={selectedDate}
              bookings={getAllBookingsForDate(selectedDate).map(booking => ({
                ...booking,
                facility_name: booking.facility_name || 'Facilitate',
                facility_type: 'unknown',
                facility_city: '',
                client_name: booking.client_info?.full_name || 'Client',
                client_email: booking.client_info?.email || '',
                created_at: booking.created_at || new Date().toISOString()
              }))}
              facilities={selectedFacilityId === "general" ? facilities : (selectedFacility ? [selectedFacility] : [])}
              selectedFacility={selectedFacilityId === "general" ? "all" : selectedFacilityId}
              isGeneralCalendar={selectedFacilityId === "general"}
              isFullyBlocked={isDateFullyBlocked(selectedDate)}
              onBookingClick={(bookingIdsJson) => {
                try {
                  const bookingIds = JSON.parse(bookingIdsJson);
                  setHighlightedBookings(bookingIds);
                  setTimeout(() => {
                    if (bookingIds.length > 0) {
                      const bookingElement = document.getElementById(`booking-${bookingIds[0]}`);
                      if (bookingElement) {
                        bookingElement.scrollIntoView({ 
                          behavior: 'smooth',
                          block: 'center'
                        });
                      }
                    }
                  }, 100);
                } catch {
                  // Fallback for single booking ID
                  setHighlightedBookings([bookingIdsJson]);
                  setTimeout(() => {
                    const bookingElement = document.getElementById(`booking-${bookingIdsJson}`);
                    if (bookingElement) {
                      bookingElement.scrollIntoView({ 
                        behavior: 'smooth',
                        block: 'center'
                      });
                    }
                  }, 100);
                }
              }}
              highlightedBookings={highlightedBookings}
              onBlockedDateClick={(blockedDateId) => {
                setHighlightedBlockedDates([blockedDateId]);
                setTimeout(() => {
                  const blockedElement = document.getElementById(`blocked-${blockedDateId}`);
                  if (blockedElement) {
                    blockedElement.scrollIntoView({ 
                      behavior: 'smooth',
                      block: 'center'
                    });
                  }
                }, 100);
              }}
              highlightedBlockedDates={highlightedBlockedDates}
              blockedDates={getBlockedSlotsForDate(selectedDate).map(b => ({ 
                ...b, 
                facility_id: b.facility_id 
              })) as any}
            />

            {/* Reservations and Blockings List */}
            <Card className="mt-6" id="reservations-section">
              <CardHeader>
                <CardTitle>Rezervări și Blocaje pentru {format(selectedDate, 'd MMMM yyyy', { locale: ro })}</CardTitle>
                <CardDescription>
                  Toate rezervările și blocajele {selectedFacilityId === "general" ? "de pe toate terenurile" : ""} pentru data selectată
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Bookings Section */}
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
                            className={`flex flex-wrap items-start justify-between gap-3 p-4 border rounded-lg bg-card transition-all duration-300 ${
                              highlightedBookings.includes(booking.id) ? 'ring-2 ring-primary ring-offset-2' : ''
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              {selectedFacilityId === "general" && (
                                <div className="flex items-center gap-2 mb-2 text-sm font-medium text-primary">
                                  <MapPin className="h-4 w-4" />
                                  {booking.facility_name}
                                </div>
                              )}
                              <div className="font-medium mb-1">{booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}</div>
                              <div className="text-muted-foreground text-sm mb-2">
                                {booking.total_price} RON • {booking.payment_method === 'card' ? 'Plată cu cardul' : 'Plată cash'}
                              </div>
                              
                              <div className="text-sm text-muted-foreground mb-2">
                                <div className="font-medium text-foreground">{booking.client_info?.full_name || 'Client neidentificat'}</div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1 min-w-0">
                                  <span className="min-w-0 break-words">📞 {booking.client_info?.phone || 'Telefon nedisponibil'}</span>
                                  {booking.client_info?.email && (
                                    <span className="min-w-0 break-words">✉️ {booking.client_info.email}</span>
                                  )}
                                </div>
                              </div>

                              {booking.notes && (
                                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded mt-2">
                                  <span className="font-medium">Note:</span> {booking.notes}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex flex-col gap-2">
                              <Badge variant={
                                booking.status === 'confirmed' ? 'default' :
                                booking.status === 'cancelled' ? 'secondary' :
                                booking.status === 'completed' ? 'outline' : 'secondary'
                              }>
                                {getStatusLabel(booking.status, booking.payment_method)}
                              </Badge>
                              <BookingStatusManager
                                booking={booking}
                                onStatusUpdate={refreshData}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Blocked Slots Section */}
                  {getBlockedSlotsForDate(selectedDate).length > 0 && (
                    <div className="border-t pt-6">
                      <h3 className="flex items-center gap-2 font-semibold mb-3">
                        <Ban className="h-4 w-4 text-yellow-600" />
                        Blocaje ({getBlockedSlotsForDate(selectedDate).length})
                      </h3>
                      <div className="space-y-3">
                        {getBlockedSlotsForDate(selectedDate).map((blocked) => {
                          const facility = facilities.find(f => f.id === blocked.facility_id);
                          const isFullDayBlock = !blocked.start_time || !blocked.end_time;
                          
                            return (
                              <div 
                                key={blocked.id}
                                id={`blocked-${blocked.id}`}
                                className={`flex flex-wrap items-start justify-between gap-3 p-4 border border-yellow-200 dark:border-yellow-900 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 transition-all duration-300 ${
                                  highlightedBlockedDates.includes(blocked.id) ? 'ring-2 ring-primary ring-offset-2' : ''
                                }`}
                              >
                              <div className="min-w-0 flex-1">
                                {selectedFacilityId === "general" && facility && (
                                  <div className="flex items-center gap-2 mb-2 text-sm font-medium text-yellow-700 dark:text-yellow-500">
                                    <MapPin className="h-4 w-4" />
                                    {facility.name}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 mb-1">
                                  <Ban className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                                  <span className="font-medium text-yellow-900 dark:text-yellow-100">
                                    {isFullDayBlock ? 'Zi Complet Blocată' : `${blocked.start_time?.slice(0, 5)} - ${blocked.end_time?.slice(0, 5)}`}
                                  </span>
                                </div>
                                {blocked.reason && (
                                  <div className="text-sm text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded mt-2">
                                    <span className="font-medium">Motiv:</span> {blocked.reason}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex flex-col gap-2">
                                <Badge variant="outline" className="bg-yellow-500 text-white border-yellow-600">
                                  BLOCAT
                                </Badge>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteBlockedDate(blocked.id)}
                                  className="gap-2"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Șterge
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default UniversalCalendarPage;

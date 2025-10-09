import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calendar as CalendarIcon, Clock, Users, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay, isSameDay } from "date-fns";
import { ro } from "date-fns/locale";
import BookingStatusManager from "@/components/booking/BookingStatusManager";
import AddManualBookingDialog from "@/components/facility/AddManualBookingDialog";
import CombinedBlockDialog from "@/components/facility/CombinedBlockDialog";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface Facility {
  id: string;
  name: string;
  facility_type: string;
  price_per_hour: number;
  operating_hours_start?: string;
  operating_hours_end?: string;
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
  const bookingRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const today = startOfDay(new Date());

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (selectedFacilityId !== "general") {
      loadFacilitySpecificData(selectedFacilityId);
    }
  }, [selectedFacilityId]);

  const loadAllData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/facility/login");
      return;
    }

    // Load all facilities owned by the user
    const { data: facilitiesData, error: facilitiesError } = await supabase
      .from('facilities')
      .select('id, name, facility_type, price_per_hour, operating_hours_start, operating_hours_end')
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

    // Load all bookings for all facilities
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

    // Load facility names and client information
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
        const isManualBooking = booking.notes?.includes('Rezervare manuală');
        
        let clientInfo = null;
        if (isManualBooking && booking.facility_name && booking.facility_address) {
          clientInfo = {
            full_name: booking.facility_name,
            phone: booking.facility_address || 'Telefon neadăugat',
            email: 'Email indisponibil (rezervare manuală)'
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
    
    if (value === "general") {
      // Reload all data
      const facilityIds = facilities.map(f => f.id);
      if (facilityIds.length > 0) {
        loadBookingsForFacilities(facilityIds);
        loadBlockedDatesForFacilities(facilityIds);
      }
    }
  };

  const getBookingsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    let filteredBookings = bookings.filter(booking => {
      if (booking.booking_date !== dateStr) return false;
      if (booking.status === 'cancelled') return false;
      
      if (booking.status === 'pending') {
        const bookingCreatedAt = new Date(booking.created_at || Date.now());
        if (bookingCreatedAt < tenMinutesAgo) return false;
      }
      
      // Filter by facility if not general calendar
      if (selectedFacilityId !== "general" && booking.facility_id !== selectedFacilityId) {
        return false;
      }
      
      return true;
    });

    return filteredBookings;
  };

  const getBlockedTimesForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    return blockedDates.filter(block => {
      if (block.blocked_date !== dateStr) return false;
      
      // Filter by facility if not general calendar
      if (selectedFacilityId !== "general" && block.facility_id !== selectedFacilityId) {
        return false;
      }
      
      return true;
    });
  };

  const generateTimeSlots = () => {
    const slots: string[] = [];
    const selectedFacility = selectedFacilityId !== "general" 
      ? facilities.find(f => f.id === selectedFacilityId)
      : null;
    
    const startHour = selectedFacility?.operating_hours_start 
      ? parseInt(selectedFacility.operating_hours_start.split(':')[0]) 
      : 8;
    const endHour = selectedFacility?.operating_hours_end 
      ? parseInt(selectedFacility.operating_hours_end.split(':')[0]) 
      : 22;

    for (let hour = startHour; hour < endHour; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const getSlotStatus = (slot: string) => {
    const bookingsForDate = getBookingsForDate(selectedDate);
    const blockedTimes = getBlockedTimesForDate(selectedDate);
    
    const [hour, minute] = slot.split(':').map(Number);
    const slotTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;

    // Check if slot is blocked
    const isBlocked = blockedTimes.some(block => {
      const blockStart = block.start_time || '00:00:00';
      const blockEnd = block.end_time || '23:59:59';
      return slotTime >= blockStart && slotTime < blockEnd;
    });

    if (isBlocked) return 'blocked';

    // Check if slot has bookings
    const bookingsInSlot = bookingsForDate.filter(booking => {
      return slotTime >= booking.start_time && slotTime < booking.end_time;
    });

    if (bookingsInSlot.length > 0) {
      if (selectedFacilityId === "general") {
        return 'booked';
      } else {
        // Check if it's a manual booking
        const hasManualBooking = bookingsInSlot.some(b => b.notes?.includes('Rezervare manuală'));
        if (hasManualBooking) return 'manual';
        return 'online';
      }
    }

    return 'free';
  };

  const handleSlotClick = (slot: string) => {
    const bookingsForDate = getBookingsForDate(selectedDate);
    const [hour, minute] = slot.split(':').map(Number);
    const slotTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;

    const bookingsInSlot = bookingsForDate.filter(booking => {
      return slotTime >= booking.start_time && slotTime < booking.end_time;
    });

    if (bookingsInSlot.length > 0) {
      const bookingIds = bookingsInSlot.map(b => b.id);
      setHighlightedBookings(bookingIds);
      
      // Scroll to first booking
      if (bookingRefs.current[bookingIds[0]]) {
        bookingRefs.current[bookingIds[0]]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  };

  const getDayModifiers = () => {
    const daysWithBookings: Date[] = [];
    const daysBlocked: Date[] = [];

    if (selectedFacilityId === "general") {
      // For general calendar
      const allFacilityIds = facilities.map(f => f.id);
      
      // Mark days with any booking
      bookings.forEach(booking => {
        if (booking.status !== 'cancelled') {
          const date = new Date(booking.booking_date);
          if (!daysWithBookings.some(d => isSameDay(d, date))) {
            daysWithBookings.push(date);
          }
        }
      });

      // Mark days when ALL facilities are blocked
      const uniqueDates = [...new Set(blockedDates.map(b => b.blocked_date))];
      uniqueDates.forEach(dateStr => {
        const blocksForDate = blockedDates.filter(b => b.blocked_date === dateStr);
        
        // Check if all day blocks exist for all facilities
        const allDayBlocks = blocksForDate.filter(b => !b.start_time && !b.end_time);
        if (allDayBlocks.length === allFacilityIds.length) {
          const date = new Date(dateStr);
          daysBlocked.push(date);
        }
      });
    } else {
      // For specific facility
      bookings.forEach(booking => {
        if (booking.facility_id === selectedFacilityId && booking.status !== 'cancelled') {
          const date = new Date(booking.booking_date);
          if (!daysWithBookings.some(d => isSameDay(d, date))) {
            daysWithBookings.push(date);
          }
        }
      });

      blockedDates.forEach(block => {
        if (block.facility_id === selectedFacilityId) {
          const date = new Date(block.blocked_date);
          if (!daysBlocked.some(d => isSameDay(d, date))) {
            daysBlocked.push(date);
          }
        }
      });
    }

    return {
      withBookings: daysWithBookings,
      blocked: daysBlocked
    };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Confirmată</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">În așteptare</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Anulată</Badge>;
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Finalizată</Badge>;
      case 'no_show':
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Lipsă</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleRefreshBookings = async () => {
    const facilityIds = selectedFacilityId === "general"
      ? facilities.map(f => f.id)
      : [selectedFacilityId];
    
    if (facilityIds.length > 0) {
      await loadBookingsForFacilities(facilityIds);
    }
  };

  const dayModifiers = getDayModifiers();
  const selectedFacility = selectedFacilityId !== "general" 
    ? facilities.find(f => f.id === selectedFacilityId)
    : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg text-muted-foreground">Se încarcă...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const hasExistingBookingsForDate = getBookingsForDate(selectedDate).length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/facility-owner-profile" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary mb-4">
            <ArrowLeft className="h-4 w-4" />
            Înapoi la profil
          </Link>
          
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Calendar Rezervări</h1>
              <p className="text-muted-foreground">Vizualizează și gestionează rezervările</p>
            </div>
            
            <div className="flex gap-2 items-center">
              <Select value={selectedFacilityId} onValueChange={handleFacilityChange}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Selectează calendarul" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="general">📅 Calendar General</SelectItem>
                  {facilities.map(facility => (
                    <SelectItem key={facility.id} value={facility.id}>
                      {facility.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedFacilityId !== "general" && selectedFacility && (
                <>
                  <AddManualBookingDialog 
                    facilityId={selectedFacilityId}
                    facility={{
                      operating_hours_start: selectedFacility.operating_hours_start,
                      operating_hours_end: selectedFacility.operating_hours_end,
                      price_per_hour: selectedFacility.price_per_hour
                    }}
                    selectedDate={selectedDate}
                    onBookingAdded={handleRefreshBookings}
                  />
                  <CombinedBlockDialog 
                    facilityId={selectedFacilityId}
                    selectedDate={selectedDate}
                    onBlockingAdded={async () => {
                      await loadBlockedDatesForFacilities([selectedFacilityId]);
                    }}
                    hasExistingBookings={hasExistingBookingsForDate}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Section */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Selectează Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <style>{`
                .calendar-with-bookings .rdp-day_selected {
                  background-color: hsl(var(--primary)) !important;
                  color: white !important;
                }
                .calendar-with-bookings .has-bookings {
                  background-color: hsl(217, 91%, 60%) !important;
                  color: white !important;
                  font-weight: 600;
                }
                .calendar-with-bookings .is-blocked {
                  background-color: hsl(0, 84%, 60%) !important;
                  color: white !important;
                  font-weight: 600;
                }
              `}</style>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    setHighlightedBookings([]);
                  }
                }}
                locale={ro}
                className="calendar-with-bookings"
                modifiers={{
                  withBookings: dayModifiers.withBookings,
                  blocked: dayModifiers.blocked
                }}
                modifiersClassNames={{
                  withBookings: 'has-bookings',
                  blocked: 'is-blocked'
                }}
              />
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(217, 91%, 60%)' }}></div>
                  <span>Zile cu rezervări</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(0, 84%, 60%)' }}></div>
                  <span>Zile blocate</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time Slots Section */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>
                Program: {format(selectedDate, 'd MMMM yyyy', { locale: ro })}
              </CardTitle>
              <CardDescription>
                Click pe un slot pentru a vedea rezervările
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {generateTimeSlots().map((slot) => {
                  const status = getSlotStatus(slot);
                  let bgColor = 'bg-muted/30';
                  let textColor = 'text-foreground';
                  let cursor = 'cursor-default';

                  if (status === 'blocked') {
                    bgColor = 'bg-yellow-200';
                    textColor = 'text-yellow-900';
                  } else if (status === 'booked') {
                    bgColor = 'bg-blue-200';
                    textColor = 'text-blue-900';
                    cursor = 'cursor-pointer hover:bg-blue-300';
                  } else if (status === 'manual') {
                    bgColor = 'bg-gray-800';
                    textColor = 'text-white';
                    cursor = 'cursor-pointer hover:bg-gray-700';
                  } else if (status === 'online') {
                    bgColor = 'bg-blue-500';
                    textColor = 'text-white';
                    cursor = 'cursor-pointer hover:bg-blue-600';
                  }

                  return (
                    <div
                      key={slot}
                      onClick={() => handleSlotClick(slot)}
                      className={`p-2 rounded-md text-center text-sm font-medium ${bgColor} ${textColor} ${cursor} transition-colors`}
                    >
                      {slot}
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-4 flex flex-wrap gap-4 text-xs">
                {selectedFacilityId === "general" ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-blue-200"></div>
                      <span>Rezervări</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-muted/30"></div>
                      <span>Liber</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-gray-800"></div>
                      <span>Rezervare manuală</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-blue-500"></div>
                      <span>Rezervare online</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-yellow-200"></div>
                      <span>Blocat</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-muted/30"></div>
                      <span>Liber</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bookings List */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Rezervări pentru {format(selectedDate, 'd MMMM yyyy', { locale: ro })}</CardTitle>
            <CardDescription>
              {getBookingsForDate(selectedDate).length} rezervări găsite
            </CardDescription>
          </CardHeader>
          <CardContent>
            {getBookingsForDate(selectedDate).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nu există rezervări pentru această dată</p>
              </div>
            ) : (
              <div className="space-y-4">
                {getBookingsForDate(selectedDate).map((booking) => (
                  <div
                    key={booking.id}
                    ref={(el) => bookingRefs.current[booking.id] = el}
                    className={`border rounded-lg p-4 transition-all ${
                      highlightedBookings.includes(booking.id)
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        {selectedFacilityId === "general" && (
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <MapPin className="h-4 w-4 text-primary" />
                            {booking.facility_name}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4" />
                          <span className="font-medium">
                            {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4" />
                          <span>{booking.client_info?.full_name}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Tel: {booking.client_info?.phone}
                        </div>
                        <div className="text-sm font-semibold text-primary">
                          {booking.total_price} RON
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {getStatusBadge(booking.status)}
                        <BookingStatusManager
                          booking={booking}
                          onStatusUpdate={handleRefreshBookings}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default UniversalCalendarPage;

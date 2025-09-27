import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay } from "date-fns";
import { ro } from "date-fns/locale";
import { getFacilityTypeLabel } from "@/utils/facilityTypes";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface Facility {
  id: string;
  name: string;
  facility_type: string;
  description: string;
  price_per_hour: number;
  capacity: number;
  capacity_max?: number;
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
  facility: Facility;
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
  facility: Facility;
}

// Color mapping for different sports
const SPORT_COLORS = {
  football: { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-800', accent: 'bg-green-500' },
  basketball: { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-800', accent: 'bg-orange-500' },
  tennis: { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-800', accent: 'bg-blue-500' },
  volleyball: { bg: 'bg-purple-100', border: 'border-purple-500', text: 'text-purple-800', accent: 'bg-purple-500' },
  padel: { bg: 'bg-cyan-100', border: 'border-cyan-500', text: 'text-cyan-800', accent: 'bg-cyan-500' },
  squash: { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-800', accent: 'bg-red-500' },
  ping_pong: { bg: 'bg-yellow-100', border: 'border-yellow-500', text: 'text-yellow-800', accent: 'bg-yellow-500' },
  swimming: { bg: 'bg-teal-100', border: 'border-teal-500', text: 'text-teal-800', accent: 'bg-teal-500' },
  foot_tennis: { bg: 'bg-indigo-100', border: 'border-indigo-500', text: 'text-indigo-800', accent: 'bg-indigo-500' },
  default: { bg: 'bg-gray-100', border: 'border-gray-500', text: 'text-gray-800', accent: 'bg-gray-500' }
};

const getSportColor = (facilityType: string) => {
  return SPORT_COLORS[facilityType as keyof typeof SPORT_COLORS] || SPORT_COLORS.default;
};

const GeneralCalendarPage = () => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/facility/login');
        return;
      }

      await loadAllData(user.id);
    } catch (error) {
      console.error('Auth check error:', error);
      navigate('/facility/login');
    }
  };

  const loadAllData = async (userId: string) => {
    setIsLoading(true);
    try {
      // Load all facilities owned by this user
      const { data: facilitiesData, error: facilitiesError } = await supabase
        .from('facilities')
        .select('*')
        .eq('owner_id', userId)
        .eq('is_active', true);

      if (facilitiesError) throw facilitiesError;
      setFacilities(facilitiesData || []);

      if (!facilitiesData || facilitiesData.length === 0) {
        setIsLoading(false);
        return;
      }

      const facilityIds = facilitiesData.map(f => f.id);

      // Load all bookings for all facilities
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .in('facility_id', facilityIds)
        .in('status', ['confirmed', 'pending']);

      if (bookingsError) throw bookingsError;

      // Load client information for bookings and facility data
      let completeBookings = [];
      if (bookingsData && bookingsData.length > 0) {
        const { data: clientsInfo } = await supabase
          .rpc('get_client_info_for_facility_bookings', { facility_owner_id: userId });

        // Get facility data for each booking
        const facilitiesMap = facilitiesData.reduce((map, facility) => {
          map[facility.id] = facility;
          return map;
        }, {} as Record<string, Facility>);

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

          // Get facility info from our loaded facilities
          const facility = facilitiesMap[booking.facility_id];

          return {
            ...booking,
            facility: facility || {
              id: booking.facility_id,
              name: booking.facility_name || 'Facility Unknown',
              facility_type: 'default',
              description: '',
              price_per_hour: 0,
              capacity: 1,
              images: [],
              address: booking.facility_address || '',
              city: 'Unknown'
            },
            client_info: clientInfo || {
              full_name: 'Client neidentificat',
              phone: 'Contact indisponibil',
              email: 'Email nedisponibil'
            }
          };
        });
      }

      setBookings(completeBookings);

      // Load blocked dates for all facilities
      const { data: blockedData, error: blockedError } = await supabase
        .from('blocked_dates')
        .select('*')
        .in('facility_id', facilityIds);

      if (blockedError) throw blockedError;
      
      // Get facility data for blocked dates
      const blockedWithFacilities = blockedData?.map((blocked: any) => {
        const facility = facilitiesData.find(f => f.id === blocked.facility_id);
        return {
          ...blocked,
          facility: facility || {
            id: blocked.facility_id,
            name: 'Unknown Facility',
            facility_type: 'default',
            description: '',
            price_per_hour: 0,
            capacity: 1,
            images: [],
            address: '',
            city: 'Unknown'
          }
        };
      }) || [];
      
      setBlockedDates(blockedWithFacilities);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca datele calendarului",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getBookingsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return bookings.filter(booking => booking.booking_date === dateStr);
  };

  const getBlockedDatesForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return blockedDates.filter(blocked => blocked.blocked_date === dateStr);
  };

  const hasBookingsOnDate = (date: Date) => {
    return getBookingsForDate(date).length > 0;
  };

  const hasBlockedDatesOnDate = (date: Date) => {
    return getBlockedDatesForDate(date).length > 0;
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeStr);
      }
    }
    return slots;
  };

  const renderDaySchedule = () => {
    const selectedBookings = getBookingsForDate(selectedDate);
    const selectedBlocked = getBlockedDatesForDate(selectedDate);
    const timeSlots = generateTimeSlots();

    const scrollToBooking = (bookingId: string) => {
      const element = document.getElementById(`booking-${bookingId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-primary');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-primary');
        }, 2000);
      }
    };

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">
          Calendar Vizual - {format(selectedDate, 'dd MMMM yyyy', { locale: ro })}
        </h3>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-2 p-4 bg-muted rounded-lg">
          <div className="text-sm font-medium text-muted-foreground mb-2 w-full">Tipuri rezervări:</div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-black rounded"></div>
            <span className="text-xs">Manual</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-xs">Website</span>
          </div>
          <div className="text-sm font-medium text-muted-foreground mb-2 w-full mt-2">Sporturi:</div>
          {facilities.map(facility => {
            const colors = getSportColor(facility.facility_type);
            return (
              <div key={facility.id} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded ${colors.accent}`}></div>
                <span className="text-xs">{getFacilityTypeLabel(facility.facility_type)}</span>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1 text-xs">
          {timeSlots.map(timeSlot => {
            const [hour, minute] = timeSlot.split(':').map(Number);
            const slotBookings = selectedBookings.filter(booking => {
              const startTime = booking.start_time.slice(0, 5);
              const endTime = booking.end_time.slice(0, 5);
              return timeSlot >= startTime && timeSlot < endTime;
            });

            return (
              <div key={timeSlot} className="relative">
                <div className="text-center font-medium text-muted-foreground mb-1">
                  {timeSlot}
                </div>
                <div className="h-16 border rounded overflow-hidden">
                  {slotBookings.length > 0 ? (
                    <div className="h-full overflow-y-auto">
                      {slotBookings.map((booking, index) => {
                        const colors = getSportColor(booking.facility.facility_type);
                        return (
                          <div
                            key={`${booking.id}-${index}`}
                            className={`${colors.bg} ${colors.border} border-l-4 px-1 py-1 mb-px cursor-pointer hover:opacity-80 transition-opacity`}
                            onClick={() => scrollToBooking(booking.id)}
                            title={`${booking.facility.name} - ${booking.client_info?.full_name}`}
                          >
                            <div className={`w-full h-3 ${colors.accent} rounded-sm`}></div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      Liber
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Booking List */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold">Rezervări pentru {format(selectedDate, 'dd MMMM yyyy', { locale: ro })}</h4>
          {selectedBookings.length > 0 ? (
            <div className="space-y-3">
              {selectedBookings
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                .map((booking) => {
                  const colors = getSportColor(booking.facility.facility_type);
                  const isManual = booking.notes && booking.notes.includes('REZERVARE MANUALĂ');
                  return (
                    <Card key={booking.id} id={`booking-${booking.id}`} className="transition-all duration-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded ${colors.accent}`}></div>
                            <div>
                              <div className="font-medium text-sm">
                                {booking.facility.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {getFacilityTypeLabel(booking.facility.facility_type)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-sm">
                              {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {booking.total_price} LEI
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isManual ? 'bg-black' : 'bg-blue-500'}`}></div>
                            <span className="text-sm text-muted-foreground">
                              {booking.client_info?.full_name || 'Client necunoscut'}
                            </span>
                            {booking.client_info?.phone && (
                              <span className="text-xs text-muted-foreground">
                                • {booking.client_info.phone}
                              </span>
                            )}
                          </div>
                          <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
                            {booking.status === 'confirmed' ? 'Confirmată' : 
                             booking.status === 'pending' ? 'În așteptare' : booking.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nu există rezervări pentru această dată</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg text-muted-foreground">Se încarcă calendarul...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/my-reservations')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Înapoi la Rezervări
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Calendar General</h1>
            <p className="text-muted-foreground">
              Vezi toate rezervările pentru toate facilitățile din complexul tău sportiv
            </p>
          </div>
        </div>

        {facilities.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <CalendarIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                Nu ai facilități active
              </h3>
              <p className="text-muted-foreground mb-6">
                Pentru a vedea calendarul general, trebuie să ai cel puțin o facilitate activă.
              </p>
              <Button asChild>
                <Link to="/add-facility">Adaugă o Facilitate</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Calendar */}
            <div className="lg:col-span-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    Selectează Data
                  </CardTitle>
                  <CardDescription>
                    Alege o dată pentru a vedea detaliile rezervărilor
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    modifiers={{
                      hasBookings: (date) => hasBookingsOnDate(date),
                      hasBlocked: (date) => hasBlockedDatesOnDate(date)
                    }}
                    modifiersStyles={{
                      hasBookings: { 
                        backgroundColor: 'hsl(var(--primary))', 
                        color: 'white',
                        fontWeight: 'bold'
                      },
                      hasBlocked: { 
                        backgroundColor: 'hsl(var(--destructive))', 
                        color: 'white' 
                      }
                    }}
                    locale={ro}
                    className="rounded-md border"
                  />
                  
                  {/* Legend */}
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-primary rounded"></div>
                      <span>Zile cu rezervări</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                      <span>Zile parțial blocate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded"></div>
                      <span>Zile complet blocate</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Daily view */}
            <div className="lg:col-span-8">
              <Card>
                <CardHeader>
                  <CardTitle>Programul zilei</CardTitle>
                  <CardDescription>
                    Rezervări și blocări pentru {format(selectedDate, 'dd MMMM yyyy', { locale: ro })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderDaySchedule()}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
};

export default GeneralCalendarPage;
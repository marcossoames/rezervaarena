import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Calendar as CalendarIcon, Edit, Clock, Ban, Plus } from "lucide-react";
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
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showManualBookingDialog, setShowManualBookingDialog] = useState(false);
  const [blockType, setBlockType] = useState<'full_day' | 'time_range'>('full_day');
  const [blockStartTime, setBlockStartTime] = useState('08:00');
  const [blockEndTime, setBlockEndTime] = useState('09:00');
  const [blockReason, setBlockReason] = useState('');
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('');
  const [manualBookingData, setManualBookingData] = useState({
    clientName: '',
    clientPhone: '',
    startTime: '08:00',
    endTime: '09:00',
    facilityId: '',
    notes: ''
  });
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const updateBookingStatus = async (bookingId: string, newStatus: 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'pending') => {
    try {
      // Get booking details for time validation
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) return;

      // Check if trying to set completed/no_show before booking time has passed
      if ((newStatus === 'completed' || newStatus === 'no_show')) {
        const bookingDateTime = new Date(`${booking.booking_date}T${booking.end_time}`);
        const now = new Date();
        
        if (bookingDateTime > now) {
          toast({
            title: "Eroare",
            description: "Nu poți marca rezervarea ca finalizată înainte ca timpul rezervării să fi trecut",
            variant: "destructive"
          });
          return;
        }
      }

      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId);

      if (error) throw error;

      // Update local state
      setBookings(prev => prev.map(booking => 
        booking.id === bookingId ? { ...booking, status: newStatus } : booking
      ));

      toast({
        title: "Succes",
        description: `Statusul rezervării a fost actualizat la: ${newStatus === 'confirmed' ? 'Confirmată' : 
          newStatus === 'pending' ? 'În așteptare' :
          newStatus === 'cancelled' ? 'Anulată' :
          newStatus === 'completed' ? 'Completată' :
          newStatus === 'no_show' ? 'Nu s-a prezentat' : newStatus}`,
      });
    } catch (error) {
      console.error('Error updating booking status:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut actualiza statusul rezervării",
        variant: "destructive"
      });
    }
  };

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

  const createBlockedDate = async () => {
    if (!selectedFacilityId) {
      toast({
        title: "Eroare",
        description: "Te rog selectează o facilitate",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('blocked_dates')
        .insert({
          facility_id: selectedFacilityId,
          blocked_date: format(selectedDate, 'yyyy-MM-dd'),
          start_time: blockType === 'time_range' ? blockStartTime : null,
          end_time: blockType === 'time_range' ? blockEndTime : null,
          reason: blockReason || 'Blocked by admin',
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      toast({
        title: "Succes",
        description: "Intervalul a fost blocat cu succes"
      });

      setShowBlockDialog(false);
      setBlockReason('');
      setSelectedFacilityId('');
      
      // Reload data
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await loadAllData(user.id);
      }
    } catch (error) {
      console.error('Error creating blocked date:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut crea blocarea",
        variant: "destructive"
      });
    }
  };

  const createManualBooking = async () => {
    if (!manualBookingData.facilityId || !manualBookingData.clientName) {
      toast({
        title: "Eroare",
        description: "Te rog completează toate câmpurile obligatorii",
        variant: "destructive"
      });
      return;
    }

    try {
      const facility = facilities.find(f => f.id === manualBookingData.facilityId);
      if (!facility) throw new Error('Facility not found');

      // Calculate duration and price
      const start = new Date(`2000-01-01T${manualBookingData.startTime}`);
      const end = new Date(`2000-01-01T${manualBookingData.endTime}`);
      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      const totalPrice = durationHours * facility.price_per_hour;

      const { error } = await supabase
        .from('bookings')
        .insert({
          client_id: (await supabase.auth.getUser()).data.user?.id,
          facility_id: manualBookingData.facilityId,
          booking_date: format(selectedDate, 'yyyy-MM-dd'),
          start_time: manualBookingData.startTime,
          end_time: manualBookingData.endTime,
          total_price: totalPrice,
          status: 'confirmed',
          payment_method: 'cash',
          notes: `REZERVARE MANUALĂ - Client: ${manualBookingData.clientName} (Tel: ${manualBookingData.clientPhone}). ${manualBookingData.notes}`
        });

      if (error) throw error;

      toast({
        title: "Succes",
        description: "Rezervarea manuală a fost creată cu succes"
      });

      setShowManualBookingDialog(false);
      setManualBookingData({
        clientName: '',
        clientPhone: '',
        startTime: '08:00',
        endTime: '09:00',
        facilityId: '',
        notes: ''
      });

      // Reload data
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await loadAllData(user.id);
      }
    } catch (error) {
      console.error('Error creating manual booking:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut crea rezervarea manuală",
        variant: "destructive"
      });
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

  const hasPartialBlockOnDate = (date: Date) => {
    const bookings = getBookingsForDate(date).length > 0;
    const blocked = getBlockedDatesForDate(date).length > 0;
    return bookings && blocked;
  };

  const generateTimeSlots = () => {
    const slots = [];
    // Extended hours from 7:30 to 22:15 to cover all facility operating hours
    const startHour = 7;
    const startMinute = 30;
    const endHour = 22;
    const endMinute = 15;
    
    let currentHour = startHour;
    let currentMinute = startMinute;
    
    while (currentHour < endHour || (currentHour === endHour && currentMinute <= endMinute)) {
      const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
      slots.push(timeStr);
      
      currentMinute += 30;
      if (currentMinute >= 60) {
        currentMinute = 0;
        currentHour++;
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
          
          <div className="text-sm font-medium text-muted-foreground mb-2 w-full mt-2">Blocări:</div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span className="text-xs">Blocat</span>
          </div>
          
          <div className="text-sm font-medium text-muted-foreground mb-2 w-full mt-2">Status rezervări:</div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-xs">Anulat</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-xs">Finalizat</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded"></div>
            <span className="text-xs">Nu s-a prezentat</span>
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

            // Check for blocked intervals
            const slotBlocked = selectedBlocked.filter(blocked => {
              // If no specific time range, it's blocked all day
              if (!blocked.start_time || !blocked.end_time) {
                return true;
              }
              const startTime = blocked.start_time.slice(0, 5);
              const endTime = blocked.end_time.slice(0, 5);
              return timeSlot >= startTime && timeSlot < endTime;
            });

            const isBlocked = slotBlocked.length > 0;
            const hasBookings = slotBookings.length > 0;

            return (
              <div key={timeSlot} className="relative">
                <div className="text-center font-medium text-muted-foreground mb-1">
                  {timeSlot}
                </div>
                <div className="h-16 border rounded overflow-hidden">
                  {isBlocked ? (
                    <div className="h-full bg-yellow-500 flex items-center justify-center text-white text-xs font-medium">
                      BLOCAT
                    </div>
                  ) : hasBookings ? (
                    <div className="h-full overflow-y-auto">
                      {slotBookings.map((booking, index) => {
                        const colors = getSportColor(booking.facility.facility_type);
                        let statusColor = colors.accent;
                        
                        // Override color based on status
                        if (booking.status === 'cancelled') {
                          statusColor = 'bg-red-500';
                        } else if (booking.status === 'completed') {
                          statusColor = 'bg-green-500';
                        } else if (booking.status === 'no_show') {
                          statusColor = 'bg-orange-500';
                        }
                        
                        return (
                          <div
                            key={`${booking.id}-${index}`}
                            className={`${colors.bg} ${colors.border} border-l-4 px-1 py-1 mb-px cursor-pointer hover:opacity-80 transition-opacity`}
                            onClick={() => scrollToBooking(booking.id)}
                            title={`${booking.facility.name} - ${booking.client_info?.full_name} - ${booking.status}`}
                          >
                            <div className={`w-full h-3 ${statusColor} rounded-sm`}></div>
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
          <h4 className="text-lg font-semibold">Rezervări și blocări pentru {format(selectedDate, 'dd MMMM yyyy', { locale: ro })}</h4>
          
          {/* Show blocked intervals first */}
          {selectedBlocked.length > 0 && (
            <div className="space-y-2">
              <h5 className="font-medium text-sm text-muted-foreground">Intervale blocate:</h5>
              {selectedBlocked.map((blocked) => (
                <Card key={blocked.id} className="border-yellow-200 bg-yellow-50">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded bg-yellow-500"></div>
                        <div>
                          <div className="font-medium text-sm">
                            {blocked.facility.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {getFacilityTypeLabel(blocked.facility.facility_type)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-sm">
                          {blocked.start_time && blocked.end_time 
                            ? `${blocked.start_time.slice(0, 5)} - ${blocked.end_time.slice(0, 5)}`
                            : 'Toată ziua'
                          }
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Blocat
                        </div>
                      </div>
                    </div>
                    {blocked.reason && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Motiv: {blocked.reason}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

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
                          <div className="flex items-center gap-2">
                            <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
                              {booking.status === 'confirmed' ? 'Confirmată' : 
                               booking.status === 'pending' ? 'În așteptare' : 
                               booking.status === 'cancelled' ? 'Anulată' :
                               booking.status === 'completed' ? 'Completată' :
                               booking.status === 'no_show' ? 'Nu s-a prezentat' : booking.status}
                            </Badge>
                            <Select
                              value={booking.status}
                              onValueChange={(newStatus) => updateBookingStatus(booking.id, newStatus as 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'pending')}
                            >
                              <SelectTrigger className="w-8 h-8 p-0">
                                <Edit className="h-3 w-3" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">În așteptare</SelectItem>
                                <SelectItem value="confirmed">Confirmată</SelectItem>
                                <SelectItem value="completed">Completată</SelectItem>
                                <SelectItem value="cancelled">Anulată</SelectItem>
                                <SelectItem value="no_show">Nu s-a prezentat</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          ) : (
            selectedBlocked.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nu există rezervări sau blocări pentru această dată</p>
                </CardContent>
              </Card>
            )
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
                      hasBookings: (date) => hasBookingsOnDate(date) && !hasBlockedDatesOnDate(date),
                      hasBlocked: (date) => hasBlockedDatesOnDate(date) && !hasBookingsOnDate(date),
                      hasPartialBlock: (date) => hasPartialBlockOnDate(date)
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
                      },
                      hasPartialBlock: {
                        backgroundColor: 'hsl(var(--primary))',
                        color: 'white',
                        fontWeight: 'bold',
                        border: '2px solid #eab308',
                        borderRadius: '6px'
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
                      <div className="w-3 h-3 bg-primary rounded border-2 border-yellow-500"></div>
                      <span>Zile parțial blocate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded"></div>
                      <span>Zile complet blocate</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-6 space-y-2">
                    <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full">
                          <Ban className="h-4 w-4 mr-2" />
                          Blochează Interval
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Blochează Interval</DialogTitle>
                          <DialogDescription>
                            Blochează un interval pentru {format(selectedDate, 'dd MMMM yyyy', { locale: ro })}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="facility-select">Facilitate</Label>
                            <Select value={selectedFacilityId} onValueChange={setSelectedFacilityId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selectează facilitatea" />
                              </SelectTrigger>
                              <SelectContent>
                                {facilities.map(facility => (
                                  <SelectItem key={facility.id} value={facility.id}>
                                    {facility.name} - {getFacilityTypeLabel(facility.facility_type)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label>Tip blocare</Label>
                            <Select value={blockType} onValueChange={(value: 'full_day' | 'time_range') => setBlockType(value)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="full_day">Toată ziua</SelectItem>
                                <SelectItem value="time_range">Interval orar</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {blockType === 'time_range' && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="start-time">Ora start</Label>
                                <Input
                                  id="start-time"
                                  type="time"
                                  value={blockStartTime}
                                  onChange={(e) => setBlockStartTime(e.target.value)}
                                />
                              </div>
                              <div>
                                <Label htmlFor="end-time">Ora sfârșit</Label>
                                <Input
                                  id="end-time"
                                  type="time"
                                  value={blockEndTime}
                                  onChange={(e) => setBlockEndTime(e.target.value)}
                                />
                              </div>
                            </div>
                          )}

                          <div>
                            <Label htmlFor="block-reason">Motiv (opțional)</Label>
                            <Textarea
                              id="block-reason"
                              value={blockReason}
                              onChange={(e) => setBlockReason(e.target.value)}
                              placeholder="Motivul blocării..."
                            />
                          </div>

                          <div className="flex gap-2">
                            <Button onClick={createBlockedDate} className="flex-1">
                              Blochează
                            </Button>
                            <Button variant="outline" onClick={() => setShowBlockDialog(false)} className="flex-1">
                              Anulează
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={showManualBookingDialog} onOpenChange={setShowManualBookingDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full">
                          <Plus className="h-4 w-4 mr-2" />
                          Rezervare Manuală
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Creează Rezervare Manuală</DialogTitle>
                          <DialogDescription>
                            Creează o rezervare manuală pentru {format(selectedDate, 'dd MMMM yyyy', { locale: ro })}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="facility-booking">Facilitate</Label>
                            <Select value={manualBookingData.facilityId} onValueChange={(value) => setManualBookingData(prev => ({...prev, facilityId: value}))}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selectează facilitatea" />
                              </SelectTrigger>
                              <SelectContent>
                                {facilities.map(facility => (
                                  <SelectItem key={facility.id} value={facility.id}>
                                    {facility.name} - {getFacilityTypeLabel(facility.facility_type)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="client-name">Nume Client *</Label>
                              <Input
                                id="client-name"
                                value={manualBookingData.clientName}
                                onChange={(e) => setManualBookingData(prev => ({...prev, clientName: e.target.value}))}
                                placeholder="Numele clientului"
                              />
                            </div>
                            <div>
                              <Label htmlFor="client-phone">Telefon</Label>
                              <Input
                                id="client-phone"
                                value={manualBookingData.clientPhone}
                                onChange={(e) => setManualBookingData(prev => ({...prev, clientPhone: e.target.value}))}
                                placeholder="Numărul de telefon"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="booking-start-time">Ora start</Label>
                              <Input
                                id="booking-start-time"
                                type="time"
                                value={manualBookingData.startTime}
                                onChange={(e) => setManualBookingData(prev => ({...prev, startTime: e.target.value}))}
                              />
                            </div>
                            <div>
                              <Label htmlFor="booking-end-time">Ora sfârșit</Label>
                              <Input
                                id="booking-end-time"
                                type="time"
                                value={manualBookingData.endTime}
                                onChange={(e) => setManualBookingData(prev => ({...prev, endTime: e.target.value}))}
                              />
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="booking-notes">Notițe (opțional)</Label>
                            <Textarea
                              id="booking-notes"
                              value={manualBookingData.notes}
                              onChange={(e) => setManualBookingData(prev => ({...prev, notes: e.target.value}))}
                              placeholder="Notițe suplimentare..."
                            />
                          </div>

                          <div className="flex gap-2">
                            <Button onClick={createManualBooking} className="flex-1">
                              Creează Rezervarea
                            </Button>
                            <Button variant="outline" onClick={() => setShowManualBookingDialog(false)} className="flex-1">
                              Anulează
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
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
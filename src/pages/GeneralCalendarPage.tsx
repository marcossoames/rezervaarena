import { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TimePicker } from "@/components/ui/time-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Calendar as CalendarIcon, Edit, Clock, Ban, Plus, X, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay } from "date-fns";
import { ro } from "date-fns/locale";
import { getFacilityTypeLabel } from "@/utils/facilityTypes";
import BookingStatusManager from "@/components/booking/BookingStatusManager";
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
  created_at: string;
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
  const calendarSectionRef = useRef<HTMLDivElement>(null);
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
  const location = useLocation();
  const { toast } = useToast();

  // Detect where the user came from
  const cameFromFacilityCalendar = location.state?.from === 'facility-calendar';
  const cameFromFacilityCalendarSelect = location.state?.from === 'facility-calendar-select';
  const facilityId = location.state?.facilityId;

  const getBackButtonText = () => {
    if (cameFromFacilityCalendar) return 'Înapoi la Calendar Facilitate';
    if (cameFromFacilityCalendarSelect) return 'Înapoi la Calendar Facilități';
    return 'Înapoi la Rezervări';
  };

  const getBackButtonAction = () => {
    if (cameFromFacilityCalendar && facilityId) {
      return () => navigate(`/facility-calendar/${facilityId}`);
    }
    if (cameFromFacilityCalendarSelect) {
      return () => navigate('/facility-calendar');
    }
    return () => navigate('/my-reservations');
  };

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

    // Check if there are existing bookings for this facility on this date
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const existingBookings = bookings.filter(
      booking => booking.facility_id === selectedFacilityId && 
                booking.booking_date === dateStr &&
                booking.status !== 'cancelled'
    );

    // If blocking full day and there are existing bookings, prevent blocking
    if (blockType === 'full_day' && existingBookings.length > 0) {
      toast({
        title: "Eroare",
        description: "Nu poți bloca toată ziua pentru acest teren deoarece există deja rezervări active. Te rog selectează 'Interval orar' și blochează doar intervalele libere.",
        variant: "destructive"
      });
      return;
    }

    // If blocking time range, check for overlaps with existing bookings
    if (blockType === 'time_range' && existingBookings.length > 0) {
      const hasOverlap = existingBookings.some(booking => {
        const bookingStart = booking.start_time.slice(0, 5);
        const bookingEnd = booking.end_time.slice(0, 5);
        
        // Check if the blocking time overlaps with any booking
        return (blockStartTime < bookingEnd && blockEndTime > bookingStart);
      });

      if (hasOverlap) {
        toast({
          title: "Eroare", 
          description: "Intervalul selectat se suprapune cu rezervări existente. Te rog selectează un interval liber.",
          variant: "destructive"
        });
        return;
      }
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
          notes: `Creat manual de proprietarul facilității${manualBookingData.notes ? `. ${manualBookingData.notes}` : ''}`
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

      // Load all bookings for all facilities (include completed and no_show)
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .in('facility_id', facilityIds)
        .in('status', ['confirmed', 'pending', 'completed', 'no_show']);

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
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    return bookings.filter(booking => {
      if (booking.booking_date !== dateStr) return false;
      
      // Filter out expired pending bookings (any payment method)
      if (booking.status === 'pending') {
        const bookingCreatedAt = new Date(booking.created_at);
        if (bookingCreatedAt < tenMinutesAgo) return false;
      }
      
      return true;
    });
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

  const handleUnblockDate = async (blockedDateId: string) => {
    try {
      const { error } = await supabase
        .from('blocked_dates')
        .delete()
        .eq('id', blockedDateId);

      if (error) throw error;

      toast({
        title: "Succes",
        description: "Blocarea a fost eliminată cu succes"
      });

      checkAuthAndLoadData();
    } catch (error) {
      console.error('Error unblocking date:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut elimina blocarea",
        variant: "destructive"
      });
    }
  };

  const generateFacilityTimeSlots = (facilityId: string) => {
    const facility = facilities.find(f => f.id === facilityId);
    if (!facility) return [];
    
    const slots = [];
    let startHour = 8;
    let endHour = 22;
    
    if (facility.operating_hours_start) {
      const [hour] = facility.operating_hours_start.split(':').map(Number);
      startHour = hour;
    }
    
    if (facility.operating_hours_end) {
      const [hour] = facility.operating_hours_end.split(':').map(Number);
      endHour = hour;
    }
    
    let currentHour = startHour;
    let currentMinute = 0;
    
    while (currentHour < endHour || (currentHour === endHour && currentMinute === 0)) {
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

  const generateTimeSlots = () => {
    const slots = [];
    
    // Calculate dynamic time range based on facility operating hours
    let earliestStart = '08:00'; // Default fallback
    let latestEnd = '22:00'; // Default fallback
    
    if (facilities.length > 0) {
      const operatingHours = facilities
        .filter(f => f.operating_hours_start && f.operating_hours_end)
        .map(f => ({
          start: f.operating_hours_start!,
          end: f.operating_hours_end!
        }));
      
      if (operatingHours.length > 0) {
        // Find earliest opening time
        earliestStart = operatingHours.reduce((earliest, hours) => 
          hours.start < earliest ? hours.start : earliest, 
          operatingHours[0].start
        );
        
        // Find latest closing time
        latestEnd = operatingHours.reduce((latest, hours) => 
          hours.end > latest ? hours.end : latest, 
          operatingHours[0].end
        );
      }
    }
    
    // Parse start time
    const [startHour, startMinute] = earliestStart.split(':').map(Number);
    // Parse end time
    const [endHour, endMinute] = latestEnd.split(':').map(Number);
    
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
            <div className="w-3 h-3 bg-amber-600 rounded"></div>
            <span className="text-xs">Blocat</span>
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
              // Include end boundary to mark the ending slot as blocked as well
              return (timeSlot >= startTime && timeSlot < endTime) || timeSlot === endTime;
            });

            const isBlocked = slotBlocked.length > 0;
            const hasBookings = slotBookings.length > 0;

            return (
              <div key={timeSlot} className="relative">
                <div className="text-left font-medium text-muted-foreground mb-1 pl-2">
                  {timeSlot}
                </div>
                <div className="h-16 border rounded overflow-hidden">
                  <div className="flex flex-col h-full">
                    {isBlocked && (
                      <div className="shrink-0 bg-amber-600 text-white text-[10px] font-semibold px-1 py-0.5 text-center">
                        BLOCAT
                      </div>
                    )}
                    {hasBookings ? (
                      <div className="flex-1 overflow-y-auto px-1 py-1">
                        {slotBookings.map((booking, index) => {
                          const colors = getSportColor(booking.facility.facility_type);
                          
                          // Determine color: manual (black) vs website (blue)
                          const notes = booking.notes?.toUpperCase() || '';
                          const isManual = notes.includes('REZERVARE MANUALĂ') || notes.includes('REZERVARE MANUALA') || notes.includes('BLOCAJ') || notes.includes('BLOCARE');
                          const statusColor = isManual ? 'bg-gray-800' : 'bg-blue-600';
                          
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
                    ) : !isBlocked ? (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        Liber
                      </div>
                    ) : null}
                  </div>
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
                <Card key={blocked.id} className="border-amber-200 bg-amber-50">
                  <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded bg-amber-600"></div>
                          <div>
                            <div className="font-medium text-sm">
                              {blocked.facility.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {getFacilityTypeLabel(blocked.facility.facility_type)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnblockDate(blocked.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
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
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                              <div className={`w-2 h-2 rounded-full ${isManual ? 'bg-black' : 'bg-blue-500'}`}></div>
                              <span className="text-sm leading-none text-muted-foreground">
                                {booking.client_info?.full_name || 'Client necunoscut'}
                              </span>
                              {booking.client_info?.phone && (
                                <span className="inline-flex items-center gap-1 text-sm leading-none text-muted-foreground">
                                  <span aria-hidden="true">•</span>
                                  <a
                                    href={`tel:${(booking.client_info.phone || '').replace(/\s+/g, '')}`}
                                    className="no-underline hover:underline break-words"
                                  >
                                    {booking.client_info.phone}
                                  </a>
                                </span>
                              )}
                            </div>
                            <div className="flex-shrink-0">
                              <BookingStatusManager
                                booking={booking}
                                onStatusUpdate={async () => {
                                  // Reload data to get updated booking
                                  const { data: { user } } = await supabase.auth.getUser();
                                  if (user) {
                                    await loadAllData(user.id);
                                  }
                                }}
                                showStatusUpdate={true}
                              />
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
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={getBackButtonAction()}
            className="mb-4 hover:bg-primary/5 border-2 border-primary/20 hover:border-primary hover:text-primary transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {getBackButtonText()}
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
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(date);
                        // Scroll to calendar section
                        setTimeout(() => {
                          calendarSectionRef.current?.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'center' 
                          });
                        }, 200);
                      }
                    }}
                    modifiers={{
                      hasBookings: (date) => hasBookingsOnDate(date) && !hasBlockedDatesOnDate(date),
                      hasBlocked: (date) => hasBlockedDatesOnDate(date) && !hasBookingsOnDate(date) && getBlockedDatesForDate(date).some(blocked => !blocked.start_time && !blocked.end_time),
                      hasOnlyPartialBlocks: (date) => hasBlockedDatesOnDate(date) && !hasBookingsOnDate(date) && !getBlockedDatesForDate(date).some(blocked => !blocked.start_time && !blocked.end_time),
                      hasPartialBlock: (date) => hasPartialBlockOnDate(date)
                    }}
                    modifiersStyles={{
                      hasBookings: { 
                        backgroundColor: '#3b82f6', 
                        color: 'white',
                        fontWeight: 'bold'
                      },
                      hasBlocked: { 
                        backgroundColor: '#ef4444', 
                        color: 'white',
                        fontWeight: 'bold'
                      },
                      hasOnlyPartialBlocks: {
                        backgroundColor: '#eab308',
                        color: 'white',
                        fontWeight: 'bold'
                      },
                      hasPartialBlock: {
                        backgroundColor: '#3b82f6',
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
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
                      <span>Zile cu rezervări</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: '#eab308' }}></div>
                      <span>Zile parțial blocate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded border-2" style={{ backgroundColor: '#3b82f6', borderColor: '#eab308' }}></div>
                      <span>Zile cu rezervări și blocări parțiale</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }}></div>
                      <span>Zile complet blocate</span>
                    </div>
                  </div>

                  {/* Action Buttons - Reordered to match individual facility calendar */}
                  <div className="mt-6 space-y-2">
                    <Dialog open={showManualBookingDialog} onOpenChange={setShowManualBookingDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full">
                          <Users className="h-4 w-4 mr-2" />
                          Adaugă Rezervare Manuală
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
                              <TimePicker
                                label="Ora start"
                                value={manualBookingData.startTime}
                                onChange={(value) => setManualBookingData(prev => ({...prev, startTime: value}))}
                                placeholder="Selectează ora de start"
                              />
                            </div>
                            <div>
                              <TimePicker
                                label="Ora sfârșit"
                                value={manualBookingData.endTime}
                                onChange={(value) => setManualBookingData(prev => ({...prev, endTime: value}))}
                                placeholder="Selectează ora de sfârșit"
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

                    <Button variant="outline" className="w-full" disabled>
                      <Ban className="h-4 w-4 mr-2" />
                      Blochează Ziua
                    </Button>

                    <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full">
                          <Clock className="h-4 w-4 mr-2" />
                          Blochează Anumite Ore
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

                          {blockType === 'time_range' && selectedFacilityId && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <TimePicker
                                  label="Ora start"
                                  value={blockStartTime}
                                  onChange={setBlockStartTime}
                                  placeholder="Selectează ora de start"
                                />
                              </div>
                              <div>
                                <TimePicker
                                  label="Ora sfârșit"
                                  value={blockEndTime}
                                  onChange={setBlockEndTime}
                                  placeholder="Selectează ora de sfârșit"
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
                        <Button variant="outline" className="w-full" style={{ display: 'none' }}>
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
                              <TimePicker
                                label="Ora start"
                                value={manualBookingData.startTime}
                                onChange={(value) => setManualBookingData(prev => ({...prev, startTime: value}))}
                                placeholder="Selectează ora de start"
                              />
                            </div>
                            <div>
                              <TimePicker
                                label="Ora sfârșit"
                                value={manualBookingData.endTime}
                                onChange={(value) => setManualBookingData(prev => ({...prev, endTime: value}))}
                                placeholder="Selectează ora de sfârșit"
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
            <div className="lg:col-span-8" ref={calendarSectionRef}>
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
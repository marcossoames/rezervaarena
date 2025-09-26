import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, addMinutes, startOfDay, parse, isSameMinute } from "date-fns";
import { ro } from "date-fns/locale";
import { Clock, MapPin } from "lucide-react";

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'pending';
  total_price: number;
  notes?: string;
  created_at: string;
  client_id: string;
  facility_id: string;
  facility_name: string;
  facility_type: string;
  facility_city: string;
  client_name: string;
  client_email: string;
  payment_method?: string;
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

interface Facility {
  id: string;
  name: string;
  facility_type: string;
  city: string;
  operating_hours_start?: string;
  operating_hours_end?: string;
  price_per_hour: number;
}

interface DayScheduleCalendarProps {
  selectedDate: Date | undefined;
  bookings: Booking[];
  facilities: Facility[];
  selectedFacility: string;
  onBookingClick: (bookingId: string) => void;
  blockedDates?: BlockedDate[];
}

const DayScheduleCalendar = ({ 
  selectedDate, 
  bookings, 
  facilities, 
  selectedFacility,
  onBookingClick,
  blockedDates = []
}: DayScheduleCalendarProps) => {

  // Get booking color based on priority: status > booking type
  const getBookingColor = (booking: Booking) => {
    // Priority 1: Status colors override everything
    if (booking.status === 'cancelled') return 'bg-red-500';
    if (booking.status === 'completed') return 'bg-green-600';
    if (booking.status === 'no_show') return 'bg-orange-600';
    
    // Priority 2: Booking type - Manual vs Website
    const notes = booking.notes?.toUpperCase() || '';
    const isManual = notes.includes('REZERVARE MANUALĂ') || notes.includes('REZERVARE MANUALA') || notes.includes('BLOCAJ') || notes.includes('BLOCARE');
    if (isManual) {
      return 'bg-gray-800'; // Dark gray for manual bookings
    }
    
    // Website bookings: all reservations made through the website (any payment method)
    return 'bg-blue-600';
  };

  // Get operating hours for selected facility
  const getOperatingHours = () => {
    if (selectedFacility === 'all') {
      // For all facilities, use the widest range
      const startTimes = facilities.map(f => f.operating_hours_start || '06:00');
      const endTimes = facilities.map(f => f.operating_hours_end || '22:00');
      const earliestStart = startTimes.reduce((earliest, current) => current < earliest ? current : earliest);
      const latestEnd = endTimes.reduce((latest, current) => current > latest ? current : latest);
      return { start: earliestStart, end: latestEnd };
    } else {
      const facility = facilities.find(f => f.id === selectedFacility);
      return {
        start: facility?.operating_hours_start || '06:00',
        end: facility?.operating_hours_end || '22:00'
      };
    }
  };

  // Generate time slots for the day (30-minute intervals)
  const generateTimeSlots = () => {
    const { start, end } = getOperatingHours();
    const slots: string[] = [];

    // Parse start and end times to minutes
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    let currentMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

  // Generate 30-min slots strictly before the closing time (end is exclusive)
  while (currentMinutes < endMinutes) {
    const h = Math.floor(currentMinutes / 60).toString().padStart(2, '0');
    const m = (currentMinutes % 60).toString().padStart(2, '0');
    slots.push(`${h}:${m}`);
    currentMinutes += 30;
  }

  // Add a final non-bookable closing time label for clarity (e.g., 22:00)
  const endLabel = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
  if (slots[slots.length - 1] !== endLabel) {
    slots.push(endLabel);
  }

  return slots;
  };

  // Filter bookings for selected date and facility
  const getDayBookings = () => {
    if (!selectedDate) return [];
    
    return bookings.filter(booking => {
      const matchesDate = format(new Date(booking.booking_date), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
      const matchesFacility = selectedFacility === 'all' || booking.facility_id === selectedFacility;
      return matchesDate && matchesFacility;
    });
  };

  // Check if a time slot is occupied by any booking
  const getSlotBooking = (timeSlot: string) => {
    const dayBookings = getDayBookings();
    
    return dayBookings.find(booking => {
      const startTime = booking.start_time.substring(0, 5);
      const endTime = booking.end_time.substring(0, 5);
      
      // Convert times to minutes for easier comparison
      const slotMinutes = timeToMinutes(timeSlot);
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);
      
      // Check if slot is within booking range (inclusive of end to fill the last slot)
      return slotMinutes >= startMinutes && slotMinutes <= endMinutes;
    });
  };

  // Check if this slot is the start of a booking
  const isBookingStart = (timeSlot: string, booking: Booking) => {
    const startTime = booking.start_time.substring(0, 5);
    return timeSlot === startTime;
  };

  // Check if this slot is the end of a booking
  const isBookingEnd = (timeSlot: string, booking: Booking) => {
    const endTime = booking.end_time.substring(0, 5);
    const slotMinutes = timeToMinutes(timeSlot);
    const endMinutes = timeToMinutes(endTime);
    
    // This is the end if this slot + 30 minutes would go past the booking end
    const nextSlotMinutes = slotMinutes + 30;
    return nextSlotMinutes > endMinutes;
  };

  // Check if a time slot is blocked
  const getSlotBlocking = (timeSlot: string) => {
    if (!selectedDate || blockedDates.length === 0) return null;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    return blockedDates.find(blocked => {
      if (blocked.blocked_date !== dateStr) return false;
      if (blocked.facility_id !== selectedFacility && selectedFacility !== 'all') return false;
      
      // If no specific times, entire day is blocked
      if (!blocked.start_time || !blocked.end_time) return true;
      
      const slotMinutes = timeToMinutes(timeSlot);
      const startMinutes = timeToMinutes(blocked.start_time.substring(0, 5));
      const endMinutes = timeToMinutes(blocked.end_time.substring(0, 5));
      
      return slotMinutes >= startMinutes && slotMinutes <= endMinutes;
    });
  };

  // Helper function to convert HH:MM to minutes
  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Handle booking click with scroll to reservations section
  const handleBookingClick = (bookingId: string) => {
    onBookingClick(bookingId);
    
    // Scroll to reservations section
    setTimeout(() => {
      const reservationsSection = document.getElementById('reservations-section');
      if (reservationsSection) {
        reservationsSection.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, 100);
  };

  if (!selectedDate) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Calendar Vizual Rezervări
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Selectează o dată pentru a vizualiza calendarul rezervărilor
          </p>
        </CardContent>
      </Card>
    );
  }

  const timeSlots = generateTimeSlots();
  const { start, end } = getOperatingHours();
  const facilityName = selectedFacility === 'all' ? 'Toate facilitățile' : facilities.find(f => f.id === selectedFacility)?.name;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Calendar Vizual - {format(selectedDate, 'dd MMMM yyyy', { locale: ro })}
        </CardTitle>
        <div className="text-sm text-muted-foreground mb-4">
          {facilityName} • Program: {start} - {end}
        </div>
        
        {/* Color Legend */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Tipuri rezervări:</div>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-800 rounded"></div>
              <span>Manual</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-600 rounded"></div>
              <span>Website</span>
            </div>
          </div>
          
          <div className="text-sm font-medium mt-3">Blocări:</div>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span>Blocat</span>
            </div>
          </div>
          
          <div className="text-sm font-medium mt-3">Status rezervări:</div>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span>Anulat</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-600 rounded"></div>
              <span>Finalizat</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-orange-600 rounded"></div>
              <span>Lipsă</span>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <div className="grid grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-0">
          {timeSlots.map((timeSlot) => {
            const isClosingSlot = timeSlot === end.substring(0, 5);
            const booking = !isClosingSlot ? getSlotBooking(timeSlot) : undefined;
            const blocking = !isClosingSlot && !booking ? getSlotBlocking(timeSlot) : null;
            
            return (
              <div key={timeSlot} className="relative border-r border-muted last:border-r-0">
                {/* Time slot header */}
                <div className="text-xs font-mono text-center text-muted-foreground p-1 border-b bg-muted/20">
                  {timeSlot}
                </div>
                
                {/* Booking/Blocking slot */}
                <div className="h-16">
                  {booking ? (
                    (() => {
                      const isStart = isBookingStart(timeSlot, booking);
                      const isEnd = isBookingEnd(timeSlot, booking);
                      
                      return (
                        <button
                          onClick={() => handleBookingClick(booking.id)}
                          className={`w-full h-full ${getBookingColor(booking)} cursor-pointer hover:opacity-80 transition-opacity`}
                          title={`${booking.start_time.substring(0, 5)}-${booking.end_time.substring(0, 5)}`}
                           style={{
                             position: 'relative',
                             zIndex: 1,
                             borderTop: '2px solid rgba(255,255,255,0.25)',
                             borderBottom: '2px solid rgba(255,255,255,0.25)',
                             borderLeft: isStart ? '2px solid rgba(255,255,255,0.35)' : '0',
                             borderRight: isEnd ? '2px solid rgba(255,255,255,0.35)' : '0',
                             marginLeft: isStart ? 0 : -1,
                             marginRight: isEnd ? 0 : -1,
                             borderRadius: isStart && isEnd
                               ? '6px'
                               : isStart
                                 ? '6px 0 0 6px'
                                 : isEnd
                                   ? '0 6px 6px 0'
                                   : '0'
                           }}
                        />
                      );
                    })()
                  ) : blocking ? (
                    <div 
                      className="w-full h-full bg-red-500 flex items-center justify-center border-2 border-white/20 rounded"
                      title={blocking.reason || 'Interval blocat'}
                    >
                      <span className="text-xs text-white font-medium">BLOCAT</span>
                    </div>
                  ) : isClosingSlot ? (
                    <div className="w-full h-full bg-muted/50 flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">Închidere</span>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-background hover:bg-muted/50 transition-colors flex items-center justify-center">
                      <span className="text-xs text-muted-foreground/70">Liber</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {getDayBookings().length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nu există rezervări pentru această dată
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DayScheduleCalendar;
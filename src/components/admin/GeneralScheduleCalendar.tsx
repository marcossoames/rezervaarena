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

interface GeneralScheduleCalendarProps {
  selectedDate: Date | undefined;
  bookings: Booking[];
  facilities: Facility[];
  onBookingClick: (bookingId: string) => void;
  blockedDates?: BlockedDate[];
  sportColors: Record<string, string>;
}

const GeneralScheduleCalendar = ({ 
  selectedDate, 
  bookings, 
  facilities, 
  onBookingClick,
  blockedDates = [],
  sportColors
}: GeneralScheduleCalendarProps) => {

  // Get booking color based on facility type and overlaps
  const getBookingColor = (booking: Booking, overlaps: Booking[] = []) => {
    // Priority 1: Status colors override everything
    if (booking.status === 'cancelled') return 'bg-red-500';
    if (booking.status === 'completed') return 'bg-green-600';
    if (booking.status === 'no_show') return 'bg-orange-600';
    
    // Priority 2: Manual bookings
    const notes = booking.notes?.toUpperCase() || '';
    const isManual = notes.includes('REZERVARE MANUALĂ') || notes.includes('REZERVARE MANUALA') || notes.includes('BLOCAJ') || notes.includes('BLOCARE');
    if (isManual) {
      return 'bg-gray-800';
    }
    
    // Priority 3: Sport type colors with overlap patterns
    const facility = facilities.find(f => f.id === booking.facility_id);
    if (facility) {
      const baseColor = sportColors[facility.facility_type] || 'bg-gray-600';
      
      // If there are overlapping bookings, add visual indication
      if (overlaps.length > 1) {
        const sameTypeOverlaps = overlaps.filter(b => {
          const overlapFacility = facilities.find(f => f.id === b.facility_id);
          return overlapFacility?.facility_type === facility.facility_type;
        });
        
        // Multiple bookings of same type = striped pattern
        if (sameTypeOverlaps.length > 1) {
          return baseColor + ' ring-2 ring-yellow-400 ring-offset-1';
        }
      }
      
      return baseColor;
    }
    
    return 'bg-blue-600';
  };

  // Get operating hours for all facilities
  const getOperatingHours = () => {
    if (facilities.length === 0) return { start: '06:00', end: '22:00' };
    
    const startTimes = facilities.map(f => f.operating_hours_start || '06:00');
    const endTimes = facilities.map(f => f.operating_hours_end || '22:00');
    const earliestStart = startTimes.reduce((earliest, current) => current < earliest ? current : earliest);
    const latestEnd = endTimes.reduce((latest, current) => current > latest ? current : latest);
    return { start: earliestStart, end: latestEnd };
  };

  // Generate time slots for the day (30-minute intervals)
  const generateTimeSlots = () => {
    const { start, end } = getOperatingHours();
    const slots: string[] = [];

    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    let currentMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    while (currentMinutes < endMinutes) {
      const h = Math.floor(currentMinutes / 60).toString().padStart(2, '0');
      const m = (currentMinutes % 60).toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
      currentMinutes += 30;
    }

    const endLabel = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
    if (slots[slots.length - 1] !== endLabel) {
      slots.push(endLabel);
    }

    return slots;
  };

  // Filter bookings for selected date
  const getDayBookings = () => {
    if (!selectedDate) return [];
    
    return bookings.filter(booking => {
      const matchesDate = format(new Date(booking.booking_date), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
      return matchesDate;
    });
  };

  // Get bookings for a specific time slot with overlap detection
  const getSlotBookings = (timeSlot: string) => {
    const dayBookings = getDayBookings();
    const slotBookings: Booking[] = [];
    
    dayBookings.forEach(booking => {
      const startTime = booking.start_time.substring(0, 5);
      const endTime = booking.end_time.substring(0, 5);
      
      const slotMinutes = timeToMinutes(timeSlot);
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);
      
      if (slotMinutes >= startMinutes && slotMinutes <= endMinutes) {
        slotBookings.push(booking);
      }
    });
    
    return slotBookings;
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
    
    const nextSlotMinutes = slotMinutes + 30;
    return nextSlotMinutes > endMinutes;
  };

  // Check if a time slot is blocked
  const getSlotBlocking = (timeSlot: string) => {
    if (!selectedDate || blockedDates.length === 0) return null;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    return blockedDates.find(blocked => {
      if (blocked.blocked_date !== dateStr) return false;
      
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
            Calendar General Rezervări
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Selectează o dată pentru a vizualiza calendarul general
          </p>
        </CardContent>
      </Card>
    );
  }

  const timeSlots = generateTimeSlots();
  const { start, end } = getOperatingHours();

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Calendar General - {format(selectedDate, 'dd MMMM yyyy', { locale: ro })}
        </CardTitle>
        <div className="text-sm text-muted-foreground mb-4">
          Toate facilitățile • Program: {start} - {end}
        </div>
        
        {/* Color Legend */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Tipuri rezervări:</div>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-800 rounded"></div>
              <span>Manual</span>
            </div>
          </div>
          
          <div className="text-sm font-medium mt-3">Sporturi:</div>
          <div className="flex flex-wrap gap-3 text-xs">
            {Object.entries(sportColors).map(([sport, color]) => (
              <div key={sport} className="flex items-center gap-1">
                <div className={`w-3 h-3 ${color} rounded`}></div>
                <span className="capitalize">{sport.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
          
          <div className="text-sm font-medium mt-3">Overlap indicator:</div>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-600 ring-2 ring-yellow-400 ring-offset-1 rounded"></div>
              <span>Multiple rezervări același sport</span>
            </div>
          </div>
          
          <div className="text-sm font-medium mt-3">Blocări:</div>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
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
            const slotBookings = !isClosingSlot ? getSlotBookings(timeSlot) : [];
            const blocking = !isClosingSlot && slotBookings.length === 0 ? getSlotBlocking(timeSlot) : null;
            
            return (
              <div key={timeSlot} className="relative border-r border-muted last:border-r-0">
                {/* Time slot header */}
                <div className="text-xs font-mono text-center text-muted-foreground p-1 border-b bg-muted/20">
                  {timeSlot}
                </div>
                
                {/* Booking/Blocking slot */}
                <div className="h-20 relative">
                  {slotBookings.length > 0 ? (
                    <div className="h-full">
                      {slotBookings.map((booking, index) => {
                        const isStart = isBookingStart(timeSlot, booking);
                        const isEnd = isBookingEnd(timeSlot, booking);
                        const facility = facilities.find(f => f.id === booking.facility_id);
                        
                        return (
                          <button
                            key={booking.id}
                            onClick={() => handleBookingClick(booking.id)}
                            className={`absolute inset-x-0 cursor-pointer hover:opacity-80 transition-opacity ${getBookingColor(booking, slotBookings)}`}
                            style={{
                              top: `${index * (80 / slotBookings.length)}px`,
                              height: `${80 / slotBookings.length}px`,
                              borderTop: '1px solid rgba(255,255,255,0.25)',
                              borderBottom: '1px solid rgba(255,255,255,0.25)',
                              borderLeft: isStart ? '2px solid rgba(255,255,255,0.35)' : '0',
                              borderRight: isEnd ? '2px solid rgba(255,255,255,0.35)' : '0',
                              borderRadius: isStart && isEnd
                                ? '4px'
                                : isStart
                                  ? '4px 0 0 4px'
                                  : isEnd
                                    ? '0 4px 4px 0'
                                    : '0'
                            }}
                            title={`${facility?.name || 'Teren'} (${booking.start_time.substring(0, 5)}-${booking.end_time.substring(0, 5)})`}
                          >
                            {slotBookings.length === 1 && (
                              <span className="text-xs text-white font-medium">
                                {facility?.name?.substring(0, 6) || 'Teren'}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : blocking ? (
                    <div 
                      className="w-full h-full bg-yellow-500 flex items-center justify-center hover:opacity-90 transition-opacity"
                      title={blocking.reason || 'Interval blocat'}
                      style={{
                        borderTop: '2px solid rgba(255,255,255,0.25)',
                        borderBottom: '2px solid rgba(255,255,255,0.25)',
                        borderRadius: '4px'
                      }}
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

export default GeneralScheduleCalendar;
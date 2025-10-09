import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, addMinutes, startOfDay, parse, isSameMinute } from "date-fns";
import { ro } from "date-fns/locale";
import { Clock, MapPin, Ban } from "lucide-react";

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
  isGeneralCalendar?: boolean;
  isFullyBlocked?: boolean;
  highlightedBookings?: string[];
  onBlockedDateClick?: (blockedDateId: string) => void;
  highlightedBlockedDates?: string[];
}

const DayScheduleCalendar = ({ 
  selectedDate, 
  bookings, 
  facilities, 
  selectedFacility,
  onBookingClick,
  blockedDates = [],
  isGeneralCalendar = false,
  isFullyBlocked = false,
  highlightedBookings = [],
  onBlockedDateClick,
  highlightedBlockedDates = []
}: DayScheduleCalendarProps) => {

  // Get booking color: manual (black) vs website (blue) - single color for general calendar
  const getBookingColor = (booking: Booking) => {
    if (isGeneralCalendar) {
      return 'bg-blue-600'; // Single blue color for general calendar
    }
    
    const notes = booking.notes?.toUpperCase() || '';
    const isManual = notes.includes('REZERVARE MANUALĂ') || notes.includes('REZERVARE MANUALA') || notes.includes('BLOCAJ') || notes.includes('BLOCARE');
    
    if (isManual) {
      return 'bg-gray-800'; // Black for manual bookings
    }
    
    return 'bg-blue-600'; // Blue for website bookings
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

  // Filter bookings for selected date and facility (exclude cancelled bookings)
  const getDayBookings = () => {
    if (!selectedDate) return [];

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    return bookings.filter(booking => {
      const matchesDate = format(new Date(booking.booking_date), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
      const matchesFacility = selectedFacility === 'all' || booking.facility_id === selectedFacility;
      const isNotCancelled = booking.status !== 'cancelled';
      const isExpiredPending = booking.status === 'pending' && new Date(booking.created_at) < tenMinutesAgo;
      return matchesDate && matchesFacility && isNotCancelled && !isExpiredPending;
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
      
      // Check if slot is within booking range (exclusive of end time)
      return slotMinutes >= startMinutes && slotMinutes < endMinutes;
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

  // Check if a time slot is blocked - don't show for general calendar
  const getSlotBlocking = (timeSlot: string) => {
    if (isGeneralCalendar) return null; // Don't show blocked slots in general calendar
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

  // Get all overlapping bookings for a given time slot
  const getOverlappingBookings = (timeSlot: string): Booking[] => {
    const dayBookings = getDayBookings();
    const slotMinutes = timeToMinutes(timeSlot);
    
    return dayBookings.filter(booking => {
      const startTime = booking.start_time.substring(0, 5);
      const endTime = booking.end_time.substring(0, 5);
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);
      
      return slotMinutes >= startMinutes && slotMinutes < endMinutes;
    });
  };

  // Handle booking click with scroll to reservations section
  const handleBookingClick = (bookingId: string) => {
    // Get the clicked booking's time range
    const clickedBooking = bookings.find(b => b.id === bookingId);
    if (!clickedBooking) {
      onBookingClick(bookingId);
      return;
    }
    
    // Find all bookings that overlap with the clicked booking's time range
    const clickedStartMinutes = timeToMinutes(clickedBooking.start_time.substring(0, 5));
    const clickedEndMinutes = timeToMinutes(clickedBooking.end_time.substring(0, 5));
    
    const dayBookings = getDayBookings();
    const overlappingIds = dayBookings
      .filter(booking => {
        const startMinutes = timeToMinutes(booking.start_time.substring(0, 5));
        const endMinutes = timeToMinutes(booking.end_time.substring(0, 5));
        
        // Check if there's any time overlap
        return !(endMinutes <= clickedStartMinutes || startMinutes >= clickedEndMinutes);
      })
      .map(b => b.id);
    
    onBookingClick(JSON.stringify(overlappingIds));
    
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

  // If the day is fully blocked, show a simple message instead of the grid
  if (isFullyBlocked) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Calendar Vizual - {format(selectedDate, 'dd MMMM yyyy', { locale: ro })}
          </CardTitle>
          <div className="text-sm text-muted-foreground mb-4">
            {facilityName}
          </div>
        </CardHeader>
        
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <Ban className="h-10 w-10 text-red-600 dark:text-red-400" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold text-foreground">
                Zi Complet Blocată
              </h3>
              <p className="text-muted-foreground max-w-md">
                {isGeneralCalendar 
                  ? "Toate terenurile sunt blocate pentru această zi"
                  : "Acest teren este blocat pentru toată ziua"
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

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
        
        {/* Color Legend - hide for general calendar */}
        {!isGeneralCalendar && (
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
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span>Blocat</span>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="p-4">
        <div className="grid grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-0">
          {timeSlots.map((timeSlot) => {
            const isClosingSlot = timeSlot === end.substring(0, 5);
            const booking = !isClosingSlot ? getSlotBooking(timeSlot) : undefined;
            const blocking = !isClosingSlot && !booking ? getSlotBlocking(timeSlot) : null;
            
            // compute boundaries for merged blocks
            const isStartBooking = booking ? isBookingStart(timeSlot, booking) : false;
            const isEndBooking = booking ? isBookingEnd(timeSlot, booking) : false;
            const blockStart = blocking ? (blocking.start_time ? timeSlot === blocking.start_time.substring(0,5) : timeSlot === start.substring(0,5)) : false;
            const blockEnd = blocking ? (() => { const endStr = blocking.end_time ? blocking.end_time.substring(0,5) : end.substring(0,5); const slotM = timeToMinutes(timeSlot); return slotM + 30 > timeToMinutes(endStr); })() : false;
            
            return (
              <div key={timeSlot} className={`relative border-muted ${ (booking && !isEndBooking) || (blocking && !blockEnd) ? 'border-r-0' : 'border-r' } last:border-r-0`}>
                {/* Time slot header */}
                <div className="text-xs font-medium text-left text-muted-foreground p-1 pl-2 border-b bg-muted/20">
                  {timeSlot}
                </div>
                
                {/* Booking/Blocking slot */}
                <div className="h-16">
                  {booking ? (
                    (() => {
                      const isStart = isBookingStart(timeSlot, booking);
                      const isEnd = isBookingEnd(timeSlot, booking);
                      
                      const isHighlighted = highlightedBookings.includes(booking.id);
                      
                      return (
                        <button
                          onClick={() => handleBookingClick(booking.id)}
                          className={`w-full h-full ${getBookingColor(booking)} cursor-pointer hover:opacity-80 transition-opacity ${isHighlighted ? 'ring-4 ring-primary ring-inset' : ''}`}
                          title={`${booking.start_time.substring(0, 5)}-${booking.end_time.substring(0, 5)}`}
                           style={{
                             position: 'relative',
                             zIndex: isHighlighted ? 10 : 1,
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
                    <button 
                      className={`w-full h-full bg-yellow-500 flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer ${highlightedBlockedDates.includes(blocking.id) ? 'ring-4 ring-primary ring-inset' : ''}`}
                      title={blocking.reason || 'Interval blocat'}
                      onClick={() => onBlockedDateClick?.(blocking.id)}
                      style={{
                        position: 'relative',
                        zIndex: highlightedBlockedDates.includes(blocking.id) ? 10 : 1,
                        borderTop: '2px solid rgba(255,255,255,0.25)',
                        borderBottom: '2px solid rgba(255,255,255,0.25)',
                        borderLeft: blockStart ? '2px solid rgba(255,255,255,0.35)' : '0',
                        borderRight: blockEnd ? '2px solid rgba(255,255,255,0.35)' : '0',
                        marginLeft: blockStart ? 0 : -1,
                        marginRight: blockEnd ? 0 : -1,
                        borderRadius: blockStart && blockEnd
                          ? '6px'
                          : blockStart
                            ? '6px 0 0 6px'
                            : blockEnd
                              ? '0 6px 6px 0'
                              : '0'
                      }}
                    >
                      <span className="text-xs text-white font-medium">BLOCAT</span>
                    </button>
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
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
}

const DayScheduleCalendar = ({ 
  selectedDate, 
  bookings, 
  facilities, 
  selectedFacility,
  onBookingClick 
}: DayScheduleCalendarProps) => {

  // Get booking color based on priority: status > booking type
  const getBookingColor = (booking: Booking) => {
    // Priority 1: Status colors override everything
    if (booking.status === 'cancelled') return 'bg-red-500';
    if (booking.status === 'completed') return 'bg-green-600';
    if (booking.status === 'no_show') return 'bg-orange-600';
    
    // Priority 2: Booking type - Manual vs Website
    // Manual bookings: made by facility owners/admins to block time slots (no stripe session)
    if (!booking.stripe_session_id && booking.payment_method === 'cash') {
      return 'bg-gray-800'; // Dark gray for manual bookings
    }
    
    // Website bookings: all reservations made through the website
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

  // Filter bookings for selected date and facility
  const getDayBookings = () => {
    if (!selectedDate) return [];
    
    return bookings.filter(booking => {
      const matchesDate = format(new Date(booking.booking_date), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
      const matchesFacility = selectedFacility === 'all' || booking.facility_id === selectedFacility;
      return matchesDate && matchesFacility;
    });
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
  const dayBookings = getDayBookings();
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
        <div className="grid grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
          {timeSlots.map((timeSlot) => {
            const isClosingSlot = timeSlot === end.substring(0, 5);
            // Find booking that starts at this time slot (exclude closing label)
            const booking = !isClosingSlot
              ? dayBookings.find(b => b.start_time.substring(0, 5) === timeSlot)
              : undefined;
            
            return (
              <div key={timeSlot} className="relative">
                {/* Time slot header */}
                <div className="text-xs font-mono text-center text-muted-foreground p-1 border rounded-t">
                  {timeSlot}
                </div>
                
                {/* Booking slot */}
                <div className="h-16 border border-t-0 rounded-b p-1">
                  {booking ? (
                    <button
                      onClick={() => handleBookingClick(booking.id)}
                      className={`w-full h-full ${getBookingColor(booking)} text-white text-xs p-1 rounded cursor-pointer hover:opacity-80 transition-opacity flex flex-col justify-center items-center text-center leading-tight`}
                    >
                      <div className="font-medium truncate w-full">{booking.facility_name}</div>
                      <div className="text-xs opacity-90 truncate w-full">{booking.client_name}</div>
                      <div className="text-xs opacity-75">{booking.start_time.substring(0, 5)}-{booking.end_time.substring(0, 5)}</div>
                    </button>
                  ) : isClosingSlot ? (
                    <div className="w-full h-full bg-muted/50 border-dashed border rounded flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">Închidere</span>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-muted/30 border-dashed border rounded flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">Liber</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {dayBookings.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nu există rezervări pentru această dată
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DayScheduleCalendar;
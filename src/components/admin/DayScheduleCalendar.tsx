import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  // Generate time slots (every 30 minutes from 6:00 to 24:00)
  const generateTimeSlots = () => {
    const slots = [];
    let currentTime = parse("06:00", "HH:mm", new Date());
    const endTime = parse("24:00", "HH:mm", new Date());

    while (currentTime < endTime) {
      slots.push(format(currentTime, "HH:mm"));
      currentTime = addMinutes(currentTime, 30);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Filter bookings for selected date and facility
  const filteredBookings = bookings.filter(booking => {
    const matchesDate = selectedDate && 
      format(new Date(booking.booking_date), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
    const matchesFacility = selectedFacility === 'all' || booking.facility_id === selectedFacility;
    return matchesDate && matchesFacility;
  });

  // Get booking for a specific time slot
  const getBookingForTimeSlot = (timeSlot: string) => {
    return filteredBookings.find(booking => {
      const bookingStart = booking.start_time.substring(0, 5); // Get HH:MM format
      const bookingEnd = booking.end_time.substring(0, 5);
      return timeSlot >= bookingStart && timeSlot < bookingEnd;
    });
  };

  // Get booking type color
  const getBookingColor = (booking: Booking) => {
    const isManual = booking.payment_method === 'cash';
    const baseClasses = "text-white text-xs font-medium p-2 rounded-md cursor-pointer transition-all hover:shadow-lg";
    
    if (booking.status === 'cancelled') {
      return `${baseClasses} bg-red-500 hover:bg-red-600`;
    }
    if (booking.status === 'completed') {
      return `${baseClasses} bg-green-600 hover:bg-green-700`;
    }
    if (booking.status === 'no_show') {
      return `${baseClasses} bg-orange-600 hover:bg-orange-700`;
    }
    
    // Active bookings - different colors for manual vs online
    if (isManual) {
      return `${baseClasses} bg-blue-600 hover:bg-blue-700`; // Manual bookings - blue
    } else {
      return `${baseClasses} bg-purple-600 hover:bg-purple-700`; // Online bookings - purple
    }
  };

  // Check if a time slot spans multiple slots for a booking
  const getBookingSpan = (booking: Booking, currentSlot: string) => {
    const startTime = booking.start_time.substring(0, 5);
    const endTime = booking.end_time.substring(0, 5);
    
    if (currentSlot === startTime) {
      // Calculate how many 30-minute slots this booking spans
      const start = parse(startTime, "HH:mm", new Date());
      const end = parse(endTime, "HH:mm", new Date());
      const diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      return Math.ceil(diffMinutes / 30);
    }
    return 0;
  };

  if (!selectedDate) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Calendar Rezervări
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Selectează o dată pentru a vizualiza programul rezervărilor
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedFacilityData = facilities.find(f => f.id === selectedFacility);
  const facilityName = selectedFacility === 'all' ? 'Toate facilitățile' : selectedFacilityData?.name;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Calendar Rezervări - {format(selectedDate, 'dd MMMM yyyy', { locale: ro })}
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          {facilityName} • Program: 06:00 - 24:00
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-600 rounded"></div>
            <span>Rezervări Online</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-600 rounded"></div>
            <span>Rezervări Manuale</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-600 rounded"></div>
            <span>Finalizate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>Anulate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-600 rounded"></div>
            <span>Lipsă</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {timeSlots.map((timeSlot, index) => {
            const booking = getBookingForTimeSlot(timeSlot);
            const span = booking ? getBookingSpan(booking, timeSlot) : 0;
            
            // Skip rendering if this slot is part of a multi-slot booking that started earlier
            if (booking && span === 0) {
              return null;
            }

            return (
              <div 
                key={timeSlot} 
                className={`min-h-[60px] border rounded-md p-2 ${
                  booking ? '' : 'bg-muted/30 border-dashed'
                }`}
                style={span > 1 ? { gridColumn: `span ${Math.min(span, 4)}` } : {}}
              >
                <div className="text-xs font-mono text-muted-foreground mb-1">
                  {timeSlot}
                </div>
                
                {booking ? (
                  <div 
                    className={getBookingColor(booking)}
                    onClick={() => onBookingClick(booking.id)}
                  >
                    <div className="font-medium truncate">
                      {booking.facility_name}
                    </div>
                    <div className="text-xs opacity-90 truncate">
                      {booking.client_name}
                    </div>
                    <div className="text-xs opacity-75">
                      {booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)}
                    </div>
                    <div className="text-xs opacity-75">
                      {booking.total_price} RON
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    Liber
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {filteredBookings.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Nu există rezervări pentru această dată
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DayScheduleCalendar;
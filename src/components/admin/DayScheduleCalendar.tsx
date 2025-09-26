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
  // Generate time slots based on facility operating hours
  const generateTimeSlots = () => {
    const slots: string[] = [];
    const selectedFacilityData = facilities.find(f => f.id === selectedFacility) || facilities[0];
    
    // Use facility operating hours or default to 08:00-22:00
    const startHour = selectedFacilityData?.operating_hours_start 
      ? parseInt(selectedFacilityData.operating_hours_start.substring(0, 2)) 
      : 8;
    const endHour = selectedFacilityData?.operating_hours_end 
      ? parseInt(selectedFacilityData.operating_hours_end.substring(0, 2)) 
      : 22;
    
    for (let minutes = startHour * 60; minutes < endHour * 60; minutes += 30) {
      const h = Math.floor(minutes / 60).toString().padStart(2, '0');
      const m = (minutes % 60).toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
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

  // Get booking type color based on sport and status
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
    
    // Manual bookings are always black
    if (isManual) {
      return `${baseClasses} bg-black hover:bg-gray-900`;
    }
    
    // Online bookings - different colors for each sport type
    const sportColors = {
      'football': 'bg-emerald-500 hover:bg-emerald-600',
      'tennis': 'bg-blue-500 hover:bg-blue-600', 
      'basketball': 'bg-orange-600 hover:bg-orange-700',
      'volleyball': 'bg-purple-500 hover:bg-purple-600',
      'padel': 'bg-pink-500 hover:bg-pink-600',
      'squash': 'bg-yellow-500 hover:bg-yellow-600',
      'swimming': 'bg-cyan-500 hover:bg-cyan-600',
      'fotbal': 'bg-emerald-500 hover:bg-emerald-600',
      'tenis': 'bg-blue-500 hover:bg-blue-600',
      'baschet': 'bg-orange-600 hover:bg-orange-700',
      'volei': 'bg-purple-500 hover:bg-purple-600',
      'inot': 'bg-cyan-500 hover:bg-cyan-600',
    };
    
    const sportType = booking.facility_type?.toLowerCase() || 'fotbal';
    const colorClass = sportColors[sportType as keyof typeof sportColors] || 'bg-emerald-500 hover:bg-emerald-600';
    
    return `${baseClasses} ${colorClass}`;
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
            <div className="w-4 h-4 bg-emerald-500 rounded"></div>
            <span>Fotbal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>Tenis</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-600 rounded"></div>
            <span>Baschet</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-500 rounded"></div>
            <span>Volei</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-pink-500 rounded"></div>
            <span>Padel</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span>Squash</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-cyan-500 rounded"></div>
            <span>Înot</span>
          </div>
        </div>
        
        {/* Status Legend */}
        <div className="flex flex-wrap gap-4 text-xs mt-2 pt-2 border-t">
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
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Negru = Manual</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 min-h-[400px]">
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
      </CardContent>
    </Card>
  );
};

export default DayScheduleCalendar;
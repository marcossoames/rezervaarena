import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarDays, 
  MapPin, 
  Star, 
  Clock, 
  Users, 
  Wifi, 
  Car, 
  Coffee,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import tennisImage from "@/assets/tennis-court.jpg";
import { useState, useEffect } from "react";
import { addDays, format, isSameDay, isAfter, isBefore } from "date-fns";
import { ro } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";

interface Facility {
  id: string;
  name: string;
  description: string;
  facility_type: string;
  city: string;
  price_per_hour: number;
  capacity: number;
  amenities: string[];
  images: string[];
  operating_hours_start?: string;
  operating_hours_end?: string;
}

const generateTimeSlots = (facilityPrice: number, operatingStart = "08:00", operatingEnd = "22:00") => {
  const slots = [];
  const [startHour, startMinute] = operatingStart.split(':').map(Number);
  const [endHour, endMinute] = operatingEnd.split(':').map(Number);
  
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;
  
  for (let time = startTime; time < endTime; time += 30) {
    const hours = Math.floor(time / 60);
    const minutes = time % 60;
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    
    // Peak hours pricing (12:00-15:00)
    const isPeakHour = hours >= 12 && hours < 15;
    const price = isPeakHour ? facilityPrice * 1.2 : facilityPrice;
    
    slots.push({
      time: timeString,
      available: true, // Will be updated based on actual bookings and blocked dates
      price: price
    });
  }
  
  return slots;
};

const BookingPage = () => {
  const { facilityId } = useParams();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [facility, setFacility] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeSlots, setTimeSlots] = useState<Array<{time: string, available: boolean, price: number}>>([]);
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  
  // Restricții temporale pentru clienți: doar următoarele 2 săptămâni
  const today = new Date();
  const maxBookingDate = addDays(today, 14); // 2 săptămâni de la astăzi

  // Load facility data
  useEffect(() => {
    const loadFacility = async () => {
      if (!facilityId) {
        toast({
          title: "Eroare",
          description: "ID-ul facilității nu a fost găsit",
          variant: "destructive"
        });
        return;
      }

      try {
        const { data, error } = await supabase
          .from('facilities')
          .select('*')
          .eq('id', facilityId)
          .eq('is_active', true)
          .single();

        if (error || !data) {
          toast({
            title: "Eroare",
            description: "Facilitatea nu a fost găsită",
            variant: "destructive"
          });
          return;
        }

        setFacility(data);
      } catch (error) {
        console.error('Error loading facility:', error);
        toast({
          title: "Eroare",
          description: "Nu s-a putut încărca facilitatea",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadFacility();
  }, [facilityId, toast]);

  // Load blocked dates
  useEffect(() => {
    const loadBlockedDates = async () => {
      if (!facilityId) return;

      try {
        const { data } = await supabase
          .from('blocked_dates')
          .select('blocked_date')
          .eq('facility_id', facilityId);

        if (data) {
          const dates = new Set(data.map(item => item.blocked_date));
          setBlockedDates(dates);
        }
      } catch (error) {
        console.error('Error loading blocked dates:', error);
      }
    };

    loadBlockedDates();
  }, [facilityId]);

  // Load time slots based on selected date
  useEffect(() => {
    const loadTimeSlots = async () => {
      if (!facility || !selectedDate) return;

      const dateString = format(selectedDate, 'yyyy-MM-dd');
      const slots = generateTimeSlots(facility.price_per_hour, facility.operating_hours_start, facility.operating_hours_end);

      try {
        // Get existing bookings for the selected date
        const { data: bookings } = await supabase
          .from('bookings')
          .select('start_time, end_time')
          .eq('facility_id', facilityId)
          .eq('booking_date', dateString)
          .neq('status', 'cancelled');

        // Get blocked time slots for the selected date
        const { data: blockedTimes } = await supabase
          .from('blocked_dates')
          .select('start_time, end_time')
          .eq('facility_id', facilityId)
          .eq('blocked_date', dateString);

        // Mark unavailable slots
        const updatedSlots = slots.map(slot => {
          let available = true;

          // Check against bookings
          if (bookings) {
            available = !bookings.some(booking => {
              const bookingStart = booking.start_time;
              const bookingEnd = booking.end_time;
              return slot.time >= bookingStart && slot.time < bookingEnd;
            });
          }

          // Check against blocked times
          if (available && blockedTimes) {
            available = !blockedTimes.some(blocked => {
              if (!blocked.start_time || !blocked.end_time) return false;
              return slot.time >= blocked.start_time && slot.time < blocked.end_time;
            });
          }

          return { ...slot, available };
        });

        setTimeSlots(updatedSlots);
      } catch (error) {
        console.error('Error loading time slots:', error);
        setTimeSlots(slots);
      }
    };

    loadTimeSlots();
  }, [facility, selectedDate, facilityId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg text-muted-foreground">Se încarcă...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Facilitatea nu a fost găsită</h1>
            <Link to="/facilities" className="text-primary hover:underline">
              Înapoi la facilități
            </Link>
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
          <Link to="/facilities" className="text-primary hover:underline flex items-center mb-4">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Înapoi la facilități
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Rezervare Teren</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Facility Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="animate-fade-in">
              <CardContent className="p-0">
                <div className="relative">
                  <img 
                    src={facility.images?.[0] || tennisImage} 
                    alt={facility.name}
                    className="w-full h-64 object-cover rounded-t-lg"
                  />
                  <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground">
                    {facility.facility_type}
                  </Badge>
                </div>
                
                <div className="p-6">
                  <h2 className="text-2xl font-bold text-foreground mb-2">{facility.name}</h2>
                  <div className="flex items-center text-muted-foreground mb-4">
                    <MapPin className="h-4 w-4 mr-2" />
                    {facility.city} area
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {facility.amenities?.map((amenity, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Wifi className="h-5 w-5 text-primary" />
                        <span className="text-sm">{amenity}</span>
                      </div>
                    ))}
                  </div>
                  
                  <p className="text-muted-foreground">
                    {facility.description}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Date Selection */}
            <Card className="animate-fade-in" style={{animationDelay: '0.1s'}}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CalendarDays className="h-5 w-5 mr-2" />
                  Selectează Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date && !isBefore(date, today) && !isAfter(date, maxBookingDate)) {
                      setSelectedDate(date);
                    }
                  }}
                  disabled={(date) => {
                    const dateString = format(date, 'yyyy-MM-dd');
                    return isBefore(date, today) || 
                           isAfter(date, maxBookingDate) || 
                           blockedDates.has(dateString);
                  }}
                  initialFocus
                  className="rounded-md border pointer-events-auto"
                />
                
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground text-center">
                    📅 Poți rezerva pentru următoarele 14 zile
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Time Slots */}
            <Card className="animate-fade-in" style={{animationDelay: '0.2s'}}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Ore Disponibile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {timeSlots.map((slot) => (
                    <Button
                      key={slot.time}
                      variant={slot.available ? "outline" : "secondary"}
                      disabled={!slot.available}
                      className={`h-16 flex flex-col ${slot.available ? 'hover:bg-primary hover:text-primary-foreground' : ''}`}
                    >
                      <span className="font-semibold">{slot.time}</span>
                      <span className="text-xs">
                        {slot.available ? `${Math.round(slot.price)} RON` : 'Ocupat'}
                      </span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Booking Summary */}
          <div className="space-y-6">
            <Card className="sticky top-8 animate-fade-in" style={{animationDelay: '0.3s'}}>
              <CardHeader>
                <CardTitle>Sumar Rezervare</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Teren:</span>
                      <span className="font-medium">{facility.name}</span>
                    </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data:</span>
                    <span className="font-medium">
                      {format(selectedDate, 'dd MMM yyyy', { locale: ro })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ora:</span>
                    <span className="font-medium">Nu este selectată</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Durată:</span>
                    <span className="font-medium">1 oră</span>
                  </div>
                </div>
                
                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-primary">{facility.price_per_hour} RON</span>
                    </div>
                  </div>
                
                <Button className="w-full" size="lg" variant="sport" disabled>
                  Selectează ora pentru a continua
                </Button>
                
                <p className="text-xs text-muted-foreground text-center">
                  Rezervarea poate fi anulată cu 2 ore înainte de începere
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default BookingPage;
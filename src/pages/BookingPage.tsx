import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { EnhancedCalendar } from "@/components/ui/enhanced-calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, MapPin, Wifi, Users, DollarSign, CalendarDays, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { format, addDays, isBefore, isAfter, startOfDay, isSameDay } from "date-fns";
import { ro } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { filterAllowedTimeSlots, getMinimumAllowedTime } from "@/utils/dateTimeValidation";
import { getFacilityTypeLabel } from "@/utils/facilityTypes";
import tennisImage from "@/assets/tennis-court.jpg";

interface Facility {
  id: string;
  name: string;
  description: string;
  facility_type: string;
  city: string;
  address: string;
  price_per_hour: number;
  capacity: number;
  amenities: string[];
  images: string[];
  operating_hours_start?: string;
  operating_hours_end?: string;
  // Sports complex information
  sports_complex_name?: string;
  sports_complex_address?: string;
  phone_number?: string;
}

const generateTimeSlots = (facilityPrice: number, operatingStart = "08:00", operatingEnd = "22:00", isForStartTime = false) => {
  const slots = [];
  const [startHour, startMinute] = operatingStart.split(':').map(Number);
  const [endHour, endMinute] = operatingEnd.split(':').map(Number);
  
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;
  
  // For start time: exclude closing time (22:00), for end time: include closing time
  const maxTime = isForStartTime ? endTime - 30 : endTime;
  
  for (let time = startTime; time <= maxTime; time += 30) {
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [facility, setFacility] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(true);
  const [startTimeSlots, setStartTimeSlots] = useState<Array<{time: string, available: boolean, price: number}>>([]);
  const [endTimeSlots, setEndTimeSlots] = useState<Array<{time: string, available: boolean, price: number}>>([]);
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [partiallyBlockedDates, setPartiallyBlockedDates] = useState<Set<string>>(new Set());
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(null);
  const [selectedEndTime, setSelectedEndTime] = useState<string | null>(null);
  
  // Restricții temporale pentru clienți: doar următoarele 2 săptămâni
  const today = startOfDay(new Date()); // Normalize to start of day
  const maxBookingDate = addDays(today, 14); // 2 săptămâni de la astăzi

  // Calculate total booking price and duration
  const calculateBookingDetails = () => {
    if (!selectedStartTime || !selectedEndTime || !facility) {
      return { duration: 0, totalPrice: 0, formattedDuration: "Nu este selectată" };
    }

    const [startHour, startMinute] = selectedStartTime.split(':').map(Number);
    const [endHour, endMinute] = selectedEndTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    if (endMinutes <= startMinutes) {
      return { duration: 0, totalPrice: 0, formattedDuration: "Interval invalid" };
    }

    const durationMinutes = endMinutes - startMinutes;
    const durationHours = durationMinutes / 60;
    
    // Simple calculation: base price * duration hours
    const totalPrice = facility.price_per_hour * durationHours;

    // Format duration
    const hours = Math.floor(durationHours);
    const minutes = durationMinutes % 60;
    let formattedDuration = "";
    if (hours > 0) formattedDuration += `${hours}h`;
    if (minutes > 0) formattedDuration += `${minutes}min`;
    if (formattedDuration === "") formattedDuration = "0min";

    return { 
      duration: durationHours, 
      totalPrice: Math.round(totalPrice), 
      formattedDuration 
    };
  };

  const bookingDetails = calculateBookingDetails();

  const handleContinueToPayment = () => {
    if (!selectedStartTime || !selectedEndTime || !facility) return;
    
    const params = new URLSearchParams({
      date: format(selectedDate, 'yyyy-MM-dd'),
      startTime: selectedStartTime,
      endTime: selectedEndTime,
      totalPrice: bookingDetails.totalPrice.toString(),
      duration: bookingDetails.formattedDuration
    });
    
    navigate(`/payment/${facilityId}?${params.toString()}`);
  };

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
        // Use the secure RPC function to get facility data with sports complex info
        const { data, error } = await supabase
          .rpc('get_facilities_for_authenticated_users')
          .eq('id', facilityId)
          .single();

        if (error || !data) {
          toast({
            title: "Eroare",
            description: "Facilitatea nu a fost găsită",
            variant: "destructive"
          });
          return;
        }

        // The RPC function already provides complete facility information
        // Map from RPC response to Facility interface
        const facilityWithSportsComplex: Facility = {
          id: data.id,
          name: data.name,
          description: data.description,
          facility_type: data.facility_type,
          city: data.city,
          address: data.sports_complex_address?.split(', ')[0] || data.city,
          price_per_hour: data.price_per_hour,
          capacity: data.capacity,
          amenities: data.amenities,
          images: data.images,
          operating_hours_start: "08:00", // Default value
          operating_hours_end: "22:00", // Default value
          sports_complex_name: data.sports_complex_name,
          sports_complex_address: data.sports_complex_address,
          phone_number: data.phone_number
        };

        setFacility(facilityWithSportsComplex);
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
      if (!facilityId || !facility) return;

      try {
        const { data } = await supabase
          .from('blocked_dates')
          .select('blocked_date, start_time, end_time')
          .eq('facility_id', facilityId);

        if (data) {
          const fullyBlocked = new Set<string>();
          const partiallyBlocked = new Set<string>();
          
          data.forEach(item => {
            // If no start_time and end_time, it's a full day block
            if (!item.start_time && !item.end_time) {
              fullyBlocked.add(item.blocked_date);
            } else if (item.start_time && item.end_time && facility) {
              // Check if blocked time covers the entire operating hours
              // Convert time strings to comparable format (HH:MM:SS)
              const blockedStart = item.start_time;
              const blockedEnd = item.end_time;
              const facilityStart = facility.operating_hours_start;
              const facilityEnd = facility.operating_hours_end;
              
              // Check if blocked period equals or exceeds facility operating hours
              const isFullDayBlock = 
                blockedStart <= facilityStart && 
                blockedEnd >= facilityEnd;
              
              if (isFullDayBlock) {
                fullyBlocked.add(item.blocked_date);
              } else {
                partiallyBlocked.add(item.blocked_date);
              }
            } else {
              // If has specific times but facility not loaded, treat as partial
              partiallyBlocked.add(item.blocked_date);
            }
          });
          
          setBlockedDates(fullyBlocked);
          setPartiallyBlockedDates(partiallyBlocked);
        }
      } catch (error) {
        console.error('Error loading blocked dates:', error);
      }
    };

    loadBlockedDates();
  }, [facilityId, facility]);

  // Load time slots based on selected date
  useEffect(() => {
    const loadTimeSlots = async () => {
      if (!facility || !selectedDate) return;

      const dateString = format(selectedDate, 'yyyy-MM-dd');
      
      // Generate separate slots for start and end times
      const startSlots = generateTimeSlots(facility.price_per_hour, facility.operating_hours_start, facility.operating_hours_end, true);
      const endSlots = generateTimeSlots(facility.price_per_hour, facility.operating_hours_start, facility.operating_hours_end, false);

      try {
        // Use secure RPC to get availability data without exposing booking details
        const { data: unavailableSlots } = await supabase
          .rpc('get_facility_availability_secure', {
            facility_id_param: facilityId,
            booking_date_param: dateString
          });

        // Function to mark unavailable slots based on secure RPC data
        const markUnavailableSlots = (slots: typeof startSlots) => {
          return slots.map(slot => {
            let available = true;

            // Check against unavailable slots from secure RPC
            if (unavailableSlots) {
              available = !unavailableSlots.some((unavailable: any) => {
                // If no start_time and end_time, it's a full day block
                if (unavailable.unavailable_type === 'blocked' && !unavailable.start_time && !unavailable.end_time) {
                  return true; // Block all time slots for this date
                }
                // Check if slot falls within unavailable range
                if (unavailable.start_time && unavailable.end_time) {
                  return slot.time >= unavailable.start_time && slot.time < unavailable.end_time;
                }
                return false;
              });
            }

            return { ...slot, available };
          });
        };

        // Apply time-based restrictions and mark unavailable slots
        const filteredStartSlots = filterAllowedTimeSlots(markUnavailableSlots(startSlots).map(slot => ({
          time: slot.time,
          available: slot.available,
          label: slot.time
        })), selectedDate);
        
        const filteredEndSlots = filterAllowedTimeSlots(markUnavailableSlots(endSlots).map(slot => ({
          time: slot.time,
          available: slot.available,
          label: slot.time
        })), selectedDate);
        
        // Convert back to original format
        setStartTimeSlots(filteredStartSlots.map(slot => ({
          time: slot.time,
          available: slot.available,
          price: startSlots.find(s => s.time === slot.time)?.price || facility.price_per_hour
        })));
        
        setEndTimeSlots(filteredEndSlots.map(slot => ({
          time: slot.time,
          available: slot.available,
          price: endSlots.find(s => s.time === slot.time)?.price || facility.price_per_hour
        })));
      } catch (error) {
        console.error('Error loading time slots:', error);
        setStartTimeSlots(startSlots);
        setEndTimeSlots(endSlots);
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
                    loading="lazy"
                    width="800"
                    height="264"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 66vw, 880px"
                    style={{ aspectRatio: '800/264' }}
                  />
                  <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground">
                    {getFacilityTypeLabel(facility.facility_type)}
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
                <EnhancedCalendar
                  mode="single"
                  selected={selectedDate}
                  blockedDates={blockedDates}
                  partiallyBlockedDates={partiallyBlockedDates}
                  onSelect={(date) => {
                    if (date) {
                      const normalizedDate = startOfDay(date);
                      const normalizedToday = startOfDay(new Date());
                      const normalizedMaxDate = startOfDay(maxBookingDate);
                      
                      if (!isBefore(normalizedDate, normalizedToday) && !isAfter(normalizedDate, normalizedMaxDate)) {
                        setSelectedDate(normalizedDate);
                        // Reset time selection when date changes
                        setSelectedStartTime(null);
                        setSelectedEndTime(null);
                      }
                    }
                  }}
                  disabled={(date) => {
                    const normalizedDate = startOfDay(date);
                    const normalizedToday = startOfDay(new Date());
                    const normalizedMaxDate = startOfDay(maxBookingDate);
                    
                    return isBefore(normalizedDate, normalizedToday) || 
                           isAfter(normalizedDate, normalizedMaxDate);
                  }}
                  initialFocus
                  className="rounded-md border pointer-events-auto"
                />
                
                {/* Add "Go to Today" button */}
                <div className="mt-6 mb-4 flex justify-center">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const today = startOfDay(new Date());
                      setSelectedDate(today);
                      setSelectedStartTime(null);
                      setSelectedEndTime(null);
                    }}
                    disabled={selectedDate && isSameDay(selectedDate, startOfDay(new Date()))}
                  >
                    🏠 Mergi la Azi
                  </Button>
                </div>
                
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
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">Selectează ora de început:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {startTimeSlots.map((slot) => (
                      <Button
                        key={`start-${slot.time}`}
                        variant={selectedStartTime === slot.time ? "default" : "outline"}
                        disabled={!slot.available}
                        size="sm"
                        onClick={() => {
                          setSelectedStartTime(slot.time);
                          setSelectedEndTime(null); // Reset end time when start time changes
                        }}
                      >
                        {slot.time}
                      </Button>
                    ))}
                  </div>
                </div>

                {selectedStartTime && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium mb-2">Selectează ora de sfârșit:</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {endTimeSlots
                        .filter(slot => {
                          const [startHour, startMinute] = selectedStartTime.split(':').map(Number);
                          const [slotHour, slotMinute] = slot.time.split(':').map(Number);
                          const startMinutes = startHour * 60 + startMinute;
                          const slotMinutes = slotHour * 60 + slotMinute;
                          return slotMinutes > startMinutes && slot.available;
                        })
                        .map((slot) => (
                          <Button
                            key={`end-${slot.time}`}
                            variant={selectedEndTime === slot.time ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedEndTime(slot.time)}
                          >
                            {slot.time}
                          </Button>
                        ))}
                    </div>
                  </div>
                )}

                {selectedStartTime && selectedEndTime && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>Interval:</span>
                        <span className="font-medium">{selectedStartTime} - {selectedEndTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Durată:</span>
                        <span className="font-medium">{bookingDetails.formattedDuration}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Preț total:</span>
                        <span className="font-medium text-primary">{bookingDetails.totalPrice} RON</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Booking Summary */}
          <div className="space-y-6">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
              <Card className="animate-fade-in" style={{animationDelay: '0.3s'}}>
              <CardHeader>
                <CardTitle>Sumar Rezervare</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {/* Sports Complex Info */}
                  <div className="pb-3 border-b border-border">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Baza sportivă:</span>
                        <span className="font-medium text-right">{facility.sports_complex_name || 'Baza Sportivă'}</span>
                      </div>
                      {facility.sports_complex_address && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Adresa:</span>
                          <span className="font-medium text-right text-sm">{facility.sports_complex_address}</span>
                        </div>
                      )}
                      {facility.phone_number && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Telefon:</span>
                          <span className="font-medium text-right">
                            <a href={`tel:${facility.phone_number}`} className="text-primary hover:underline">
                              {facility.phone_number}
                            </a>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Booking Details */}
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
                      <span className="font-medium">
                        {selectedStartTime && selectedEndTime 
                          ? `${selectedStartTime} - ${selectedEndTime}` 
                          : "Nu este selectată"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Durată:</span>
                      <span className="font-medium">{bookingDetails.formattedDuration}</span>
                    </div>
                  </div>
                </div>
                
                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-primary">{bookingDetails.totalPrice} RON</span>
                    </div>
                  </div>
                
                <Button 
                  className="w-full" 
                  size="lg" 
                  variant="sport" 
                  disabled={!selectedStartTime || !selectedEndTime}
                  onClick={handleContinueToPayment}
                >
                  {selectedStartTime && selectedEndTime ? "Continuă cu plata" : "Selectează intervalul pentru a continua"}
                </Button>
                
                <p className="text-xs text-muted-foreground text-center">
                  Rezervarea poate fi anulată cu 24 de ore înainte de începere
                </p>
              </CardContent>
            </Card>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default BookingPage;
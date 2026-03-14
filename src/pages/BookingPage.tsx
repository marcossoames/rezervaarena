import { useState, useEffect } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
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
import { getImagePublicUrl } from "@/utils/imageUtils";
import ImageCarousel from "@/components/ImageCarousel";
import { openExternal } from "@/utils/openExternal";
import { FormattedDescription } from "@/components/ui/formatted-description";

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


const BookingPage = () => {
  const { facilityId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  
  const buildLocationQuery = (address: string, city: string): string => {
    return `${address}, ${city}`;
  };

  const getMapsOpenUrl = (address: string, city: string): string => {
    const query = buildLocationQuery(address, city);
    const q = encodeURIComponent(query);
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  };
  
  // Check if date is passed in URL and use it, otherwise use today
  const getInitialDate = () => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      try {
        const parsedDate = new Date(dateParam);
        // Validate the date is not in the past and within booking window
        const normalizedParsed = startOfDay(parsedDate);
        const normalizedToday = startOfDay(new Date());
        const maxDate = addDays(normalizedToday, 14);
        
        if (!isBefore(normalizedParsed, normalizedToday) && !isAfter(normalizedParsed, maxDate)) {
          return parsedDate;
        }
      } catch (e) {
        console.error('Invalid date in URL:', e);
      }
    }
    return new Date();
  };
  
  const [selectedDate, setSelectedDate] = useState<Date>(getInitialDate());
  const [facility, setFacility] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(true);
  const [startTimeSlots, setStartTimeSlots] = useState<Array<{time: string, available: boolean, price: number}>>([]);
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [partiallyBlockedDates, setPartiallyBlockedDates] = useState<Set<string>>(new Set());
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<60 | 90 | 120 | null>(null);
  const [allowedDurations, setAllowedDurations] = useState<number[]>([60, 90, 120]);
  
  // Restricții temporale pentru clienți: doar următoarele 2 săptămâni
  const today = startOfDay(new Date()); // Normalize to start of day
  const maxBookingDate = addDays(today, 14); // 2 săptămâni de la astăzi

  // Calculate total booking price and duration
  const calculateBookingDetails = () => {
    if (!selectedStartTime || !selectedDuration || !facility) {
      return { duration: 0, totalPrice: 0, formattedDuration: "Nu este selectată", endTime: "" };
    }

    const [startHour, startMinute] = selectedStartTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = startMinutes + selectedDuration;
    
    const endHour = Math.floor(endMinutes / 60);
    const endMinute = endMinutes % 60;
    const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
    
    const durationHours = selectedDuration / 60;
    
    // Calculate price based on duration
    const totalPrice = facility.price_per_hour * durationHours;

    // Format duration
    const formattedDuration = selectedDuration === 60 ? "1h" : 
                             selectedDuration === 90 ? "1h 30min" : 
                             selectedDuration === 120 ? "2h" : `${selectedDuration}min`;

    return { 
      duration: durationHours, 
      totalPrice: totalPrice, 
      formattedDuration,
      endTime
    };
  };

  const bookingDetails = calculateBookingDetails();

  const handleContinueToPayment = () => {
    if (!selectedStartTime || !selectedDuration || !facility) return;
    
    const bookingDetails = calculateBookingDetails();
    
    const params = new URLSearchParams({
      date: format(selectedDate, 'yyyy-MM-dd'),
      startTime: selectedStartTime,
      endTime: bookingDetails.endTime,
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
        // Get facility data directly to include allowed_durations and promotion_only
        const { data: facilityData, error: facilityError } = await supabase
          .from('facilities')
          .select('*, allowed_durations, promotion_only')
          .eq('id', facilityId)
          .eq('is_active', true)
          .single();

        if (facilityError || !facilityData) {
          toast({
            title: "Eroare",
            description: "Facilitatea nu a fost găsită",
            variant: "destructive"
          });
          return;
        }

        // Redirect to promotion page if facility is promotion-only
        if (facilityData.promotion_only) {
          toast({
            title: "Rezervări doar telefonic",
            description: "Această facilitate acceptă doar rezervări telefonice. Vei fi redirecționat către pagina cu detalii de contact."
          });
          navigate(`/facility-promotion/${facilityId}`);
          return;
        }

        // Get sports complex info
        const { data: sportsComplexData } = await supabase
          .from('sports_complexes')
          .select('name, address')
          .eq('owner_id', facilityData.owner_id)
          .single();

        // Map to Facility interface
        const facilityWithSportsComplex: Facility = {
          id: facilityData.id,
          name: facilityData.name,
          description: facilityData.description,
          facility_type: facilityData.facility_type,
          city: facilityData.city,
          address: sportsComplexData?.address?.split(', ')[0] || facilityData.city,
          price_per_hour: facilityData.price_per_hour,
          capacity: facilityData.capacity,
          amenities: facilityData.amenities || [],
          images: facilityData.images || [],
          operating_hours_start: facilityData.operating_hours_start || "08:00",
          operating_hours_end: facilityData.operating_hours_end || "22:00",
          sports_complex_name: sportsComplexData?.name,
          sports_complex_address: sportsComplexData?.address,
        };

        setFacility(facilityWithSportsComplex);
        
        // Set allowed durations from facility data
        const durations = facilityData.allowed_durations;
        setAllowedDurations(durations && durations.length > 0 ? durations : [60, 90, 120]);
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
      
      // Generate simple time slots without complex pricing logic
      const startSlots = [];
      const [startHour, startMinute] = facility.operating_hours_start?.split(':').map(Number) || [8, 0];
      const [endHour, endMinute] = facility.operating_hours_end?.split(':').map(Number) || [22, 0];
      
      const startTime = startHour * 60 + startMinute;
      const endTime = endHour * 60 + endMinute;
      
      // Generate 30-minute slots, excluding the closing time for start times
      for (let time = startTime; time < endTime; time += 30) {
        const hours = Math.floor(time / 60);
        const minutes = time % 60;
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        startSlots.push({
          time: timeString,
          available: true,
          price: facility.price_per_hour
        });
      }

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

            // Check if this time slot would conflict with any bookings for both 60 and 90 minute durations
            if (unavailableSlots && selectedDuration) {
              const [slotHour, slotMinute] = slot.time.split(':').map(Number);
              const slotMinutes = slotHour * 60 + slotMinute;
              const endMinutes = slotMinutes + selectedDuration;

              
              const toMinutes = (t: string) => {
                const parts = t.split(':').map(Number);
                const h = parts[0] || 0;
                const m = parts[1] || 0;
                return h * 60 + m;
              };

              // Check against all unavailable slots
              let available = true;
              for (const unavailable of unavailableSlots as any[]) {
                // Full day block detection (either nulls or 00:00:00-23:59:59)
                const isFullDayBlocked =
                  unavailable.unavailable_type === 'blocked' &&
                  ((!unavailable.start_time && !unavailable.end_time) ||
                   (unavailable.start_time === '00:00:00' && unavailable.end_time === '23:59:59'));
                if (isFullDayBlocked) {
                  available = false;
                  break;
                }

                if (unavailable.start_time && unavailable.end_time) {
                  const unStart = toMinutes(unavailable.start_time as string);
                  const unEnd = toMinutes(unavailable.end_time as string);
                  // Our booking interval [slotMinutes, endMinutes)
                  // Overlap if: start < otherEnd && otherStart < end
                  if (slotMinutes < unEnd && unStart < endMinutes) {
                    available = false;
                    break;
                  }
                }
              }

              // Also check if end time exceeds facility operating hours
              if (available && facility.operating_hours_end) {
                const [opEndHour, opEndMinute] = facility.operating_hours_end.split(':').map(Number);
                const opEndMinutes = opEndHour * 60 + opEndMinute;
                if (endMinutes > opEndMinutes) {
                  available = false;
                }
              }

              return { ...slot, available };
            }

            return { ...slot, available: slot.available };
          });
        };

        // Apply time-based restrictions and mark unavailable slots
        const filteredStartSlots = filterAllowedTimeSlots(markUnavailableSlots(startSlots).map(slot => ({
          time: slot.time,
          available: slot.available,
          label: slot.time
        })), selectedDate);
        
        // Convert to the format expected by setStartTimeSlots
        setStartTimeSlots(filteredStartSlots.map(slot => ({
          time: slot.time,
          available: slot.available,
          price: facility.price_per_hour
        })));
        
      } catch (error) {
        console.error('Error loading time slots:', error);
        // Fallback to simple slots if RPC fails
        const fallbackSlots = [];
        for (let time = startTime; time < endTime; time += 30) {
          const hours = Math.floor(time / 60);
          const minutes = time % 60;
          const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          
          fallbackSlots.push({
            time: timeString,
            available: true,
            price: facility.price_per_hour
          });
        }
        setStartTimeSlots(fallbackSlots);
      }
    };

    loadTimeSlots();
  }, [facility, selectedDate, facilityId, selectedDuration]);

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
          <Link to="/facilities" className="text-primary hover:underline hover:bg-primary/5 border-2 border-primary/20 hover:border-primary rounded-md px-3 py-2 transition-all duration-200 flex items-center mb-4">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Înapoi la facilități
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Rezervare Teren</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Facility Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="animate-fade-in">
              <CardContent className="p-0">
                <div className="relative h-64 rounded-t-lg overflow-hidden">
                  <ImageCarousel 
                    images={facility.images || []}
                    facilityName={facility.name}
                    facilityType={facility.facility_type}
                    className="w-full h-64 rounded-t-lg"
                  />
                </div>
                
                <div className="p-6">
                  <h2 className="text-2xl font-bold text-foreground mb-2">{facility.name}</h2>
                  <div className="flex items-center text-muted-foreground mb-4">
                    <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                    <a
                      href={getMapsOpenUrl(facility.address, facility.city)}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openExternal(getMapsOpenUrl(facility.address, facility.city));
                      }}
                      className="text-left hover:text-primary hover:underline cursor-pointer transition-colors"
                    >
                      {facility.address}, {facility.city}
                    </a>
                  </div>
                  
                  {/* Operating Hours */}
                  {facility.operating_hours_start && facility.operating_hours_end && (
                    <div className="flex items-center text-muted-foreground mb-4">
                      <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="text-left">
                        Orar: {facility.operating_hours_start?.slice(0, 5)} - {facility.operating_hours_end?.slice(0, 5)}
                      </span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {facility.amenities?.map((amenity, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Wifi className="h-5 w-5 text-primary" />
                        <span className="text-sm">{amenity}</span>
                      </div>
                    ))}
                  </div>
                  
                  <FormattedDescription 
                    text={facility.description}
                    className="mt-4"
                  />
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
                        // Reset time and duration selection when date changes
                        setSelectedStartTime(null);
                        setSelectedDuration(null);
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
                      setSelectedDuration(null);
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

            {/* Duration and Time Selection */}
            <Card className="animate-fade-in" style={{animationDelay: '0.2s'}}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Selectează Durata și Ora
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Duration Selection */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium mb-3">Selectează durata rezervării:</h4>
                  <div className={`grid gap-4 ${allowedDurations.length === 1 ? 'grid-cols-1' : allowedDurations.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'}`}>
                    {allowedDurations.map((duration) => (
                      <div 
                        key={duration}
                        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                          selectedDuration === duration 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => {
                          setSelectedDuration(duration as 60 | 90 | 120);
                          setSelectedStartTime(null); // Reset start time when duration changes
                        }}
                      >
                        <div className="text-center">
                          <div className="text-lg font-bold">{duration} minute</div>
                          <div className="text-sm text-muted-foreground">
                            {duration === 60 ? '1 oră standard' : 
                             duration === 90 ? '1 oră și 30 minute' : 
                             duration === 120 ? '2 ore' : `${duration} minute`}
                          </div>
                          <div className="text-lg font-bold text-primary mt-2">
                            {facility ? (facility.price_per_hour * (duration / 60)).toFixed(2).replace(/\.00$/, '') : 0} RON
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Time Selection - only show when duration is selected */}
                {selectedDuration && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium mb-2">Selectează ora de început:</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {startTimeSlots.map((slot) => (
                        <Button
                          key={`start-${slot.time}`}
                          variant={selectedStartTime === slot.time ? "default" : "outline"}
                          disabled={!slot.available}
                          size="sm"
                          onClick={() => setSelectedStartTime(slot.time)}
                        >
                          {slot.time}
                        </Button>
                      ))}
                    </div>
                    {startTimeSlots.filter(slot => slot.available).length === 0 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Nu există ore disponibile pentru această durată în data selectată.
                      </p>
                    )}
                  </div>
                )}

                {selectedStartTime && selectedDuration && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>Interval:</span>
                        <span className="font-medium">{selectedStartTime} - {calculateBookingDetails().endTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Durată:</span>
                        <span className="font-medium">{calculateBookingDetails().formattedDuration}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Preț total:</span>
                        <span className="font-medium text-primary">{calculateBookingDetails().totalPrice} RON</span>
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
                        {selectedStartTime && selectedDuration 
                          ? `${selectedStartTime} - ${calculateBookingDetails().endTime}` 
                          : "Nu este selectată"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Durată:</span>
                      <span className="font-medium">{calculateBookingDetails().formattedDuration}</span>
                    </div>
                  </div>
                </div>
                
                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-primary">{calculateBookingDetails().totalPrice} RON</span>
                    </div>
                  </div>
                
                <Button 
                  className="w-full" 
                  size="lg" 
                  variant="sport" 
                  disabled={!selectedStartTime || !selectedDuration}
                  onClick={handleContinueToPayment}
                >
                  {selectedStartTime && selectedDuration ? "Continuă cu plata" : "Selectează durata și ora pentru a continua"}
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
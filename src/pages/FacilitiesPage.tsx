import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Clock, Filter, Search, LogIn, CalendarIcon, Users, ArrowUpDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ImageCarousel from "@/components/ImageCarousel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { EnhancedCalendar } from "@/components/ui/enhanced-calendar";
import { format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { getFacilityTypeLabel } from "@/utils/facilityTypes";
import { isBookingTimeAllowed } from "@/utils/dateTimeValidation";
interface Facility {
  id: string;
  name: string;
  description?: string;
  basic_description?: string; // For older public browsing data
  facility_type: string;
  address?: string; // For admin/owner view
  area_info?: string; // For client/public view - general area only
  general_area?: string; // For legacy public browsing
  city: string;
  price_per_hour?: number;
  base_price_info?: string;
  price_range?: string;
  capacity?: number;
  capacity_max?: number; // For capacity ranges
  capacity_info?: string;
  amenities?: string[];
  available_amenities?: string[];
  images?: string[];
  main_image_url?: string;
  has_images?: boolean;
  rating_display?: string;
  created_at?: string;
  sports_complex_name?: string;
  sports_complex_address?: string;
  phone_number?: string;
  operating_hours_start?: string;
  operating_hours_end?: string;
}
interface UserProfile {
  role: 'client' | 'facility_owner' | 'admin';
}
const FacilitiesPage = () => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
  const [allFacilities, setAllFacilities] = useState<Facility[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [partiallyBlockedDates, setPartiallyBlockedDates] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<string>('newest');
  const navigate = useNavigate();
  
  // Check if user came from homepage
  const fromHome = searchParams.get('from') === 'home';
  useEffect(() => {
    // Check authentication status
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setSession(session);
      setAuthChecked(true);

      // Get user profile if authenticated
      if (session) {
        fetchUserProfile(session.user.id);
      }
    });

    // Listen for auth changes
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setAuthChecked(true);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setUserProfile(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  const fetchUserProfile = async (userId: string) => {
    try {
      const {
        data,
        error
      } = await supabase.from('profiles').select('role').eq('user_id', userId).single();
      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };
  useEffect(() => {
    // Get search parameters from URL
    const typeParam = searchParams.get('type');
    const dateParam = searchParams.get('date');
    const locationParam = searchParams.get('location');
    const searchParam = searchParams.get('search');
    const startTimeParam = searchParams.get('startTime');
    const durationParam = searchParams.get('duration');
    setSelectedType(typeParam);
    setLocationFilter(locationParam || '');
    setSearchTerm(searchParam || '');
    setStartTime(startTimeParam || '');
    setDuration(durationParam || '');
    // Handle date parameter
    if (dateParam) {
      const date = new Date(dateParam);
      if (!isNaN(date.getTime())) {
        setSelectedDate(date);
      }
    }
  }, [searchParams]);
  useEffect(() => {
    // If user is facility owner, redirect to management page
    if (userProfile?.role === 'facility_owner') {
      navigate('/manage-facilities');
      return;
    }

    // Wait for auth check to complete
    if (!authChecked) {
      return;
    }
    const fetchFacilities = async () => {
      try {
        let allFacilities;
        let error;

        // Use different functions based on user authentication status
        if (session && userProfile?.role === 'client') {
          // Authenticated clients get exact data with sports complex info
          const {
            data: facilitiesData,
            error: facilitiesError
          } = await supabase.rpc('get_facilities_for_authenticated_users');
          allFacilities = facilitiesData;
          error = facilitiesError;
        } else if (session && userProfile?.role === 'admin') {
          // Admins should also see sports complex name
          const {
            data: adminFacilities,
            error: rpcError
          } = await supabase.rpc('get_facilities_for_authenticated_users');
          allFacilities = adminFacilities;
          error = rpcError;
        } else if (session) {
          // Authenticated users get enhanced data with contact info
          const {
            data,
            error: rpcError
          } = await supabase.rpc('get_facilities_for_authenticated_users');
          allFacilities = data;
          error = rpcError;
        } else {
          // Non-authenticated users get safe public facility data with proper address and complex name
          const {
            data,
            error: rpcError
          } = await supabase.rpc('get_facilities_for_public_browsing_safe');
          allFacilities = data;
          error = rpcError;
        }
        if (error) {
          console.error('Error fetching facilities:', error);
          throw error;
        }

        // Store all facilities for filtering
        setAllFacilities(allFacilities || []);
      } catch (error) {
        console.error('Error:', error);
        setAllFacilities([]);
      }
    };
    fetchFacilities();

    // Load blocked dates for general calendar display
    const loadBlockedDates = async () => {
      try {
        const { data: blockedDatesData } = await supabase
          .from('blocked_dates')
          .select('blocked_date, start_time, end_time');

        if (blockedDatesData) {
          const fullyBlocked = new Set<string>();
          const partiallyBlocked = new Set<string>();
          
          blockedDatesData.forEach(item => {
            // If no start_time and end_time, it's a full day block
            if (!item.start_time && !item.end_time) {
              fullyBlocked.add(item.blocked_date);
            } else {
              // If has specific times, it's a partial block
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
  }, [session, authChecked, userProfile, navigate]);

  // Apply filters whenever filters change
  useEffect(() => {
    const applyFilters = async () => {
      let filteredFacilities = [...allFacilities];

      // Apply type filter
      if (selectedType) {
        filteredFacilities = filteredFacilities.filter(f => f.facility_type === selectedType);
      }

      // Apply location filter
      if (locationFilter) {
        filteredFacilities = filteredFacilities.filter(f => f.city.toLowerCase().includes(locationFilter.toLowerCase()) || f.address && f.address.toLowerCase().includes(locationFilter.toLowerCase()));
      }

      // Apply search term filter
      if (searchTerm) {
        filteredFacilities = filteredFacilities.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.description && f.description.toLowerCase().includes(searchTerm.toLowerCase()) || f.sports_complex_name && f.sports_complex_name.toLowerCase().includes(searchTerm.toLowerCase()));
      }

      // Apply date and time slot filter - check availability
      if (selectedDate) {
        try {
          const dateString = format(selectedDate, 'yyyy-MM-dd');

          // Use secure RPC to get unavailable time slots for each facility
          const facilityAvailabilityPromises = filteredFacilities.map(async (facility) => {
            const { data: unavailableSlots, error } = await supabase
              .rpc('get_facility_availability_secure', {
                facility_id_param: facility.id,
                booking_date_param: dateString
              });
            
            if (error) {
              console.error('Error fetching availability for facility:', facility.id, error);
              return { facilityId: facility.id, unavailableSlots: [] };
            }
            
            return { facilityId: facility.id, unavailableSlots: unavailableSlots || [] };
          });

          const facilityAvailabilities = await Promise.all(facilityAvailabilityPromises);
          
          // Convert to the expected format for backward compatibility
          const bookings = facilityAvailabilities.flatMap(({ facilityId, unavailableSlots }) => 
            unavailableSlots
              .filter(slot => slot.unavailable_type === 'booking')
              .map(slot => ({
                facility_id: facilityId,
                start_time: slot.start_time,
                end_time: slot.end_time
              }))
          );

          const blockedDates = facilityAvailabilities.flatMap(({ facilityId, unavailableSlots }) => 
            unavailableSlots
              .filter(slot => slot.unavailable_type === 'blocked')
              .map(slot => ({
                facility_id: facilityId,
                start_time: slot.start_time,
                end_time: slot.end_time
              }))
          );
          const unavailableFacilities = new Set();
          if (startTime && duration) {
            // Calculate end time from start time and duration
            const [startHour, startMinute] = startTime.split(':').map(Number);
            const startMinutes = startHour * 60 + startMinute;
            const endMinutes = startMinutes + parseInt(duration);
            const endHour = Math.floor(endMinutes / 60);
            const endMinute = endMinutes % 60;
            const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

            // Check which facilities are booked or blocked during this time range
            const bookingsInTimeRange = bookings?.filter(booking => {
              const bookingStart = booking.start_time;
              const bookingEnd = booking.end_time;
              // Check for overlap: booking overlaps if it starts before our range ends and ends after our range starts
              return bookingStart < endTime && bookingEnd > startTime;
            }) || [];
            const blockedInTimeRange = blockedDates?.filter(blocked => {
              // If no specific time, entire day is blocked
              if (!blocked.start_time || !blocked.end_time) return true;
              // Check for overlap with specific blocked time
              return blocked.start_time < endTime && blocked.end_time > startTime;
            }) || [];

            // Mark facilities as unavailable if they have bookings or are blocked during this time range
            bookingsInTimeRange.forEach(booking => unavailableFacilities.add(booking.facility_id));
            blockedInTimeRange.forEach(blocked => unavailableFacilities.add(blocked.facility_id));
          } else {
            // No specific time slot - show facilities with some availability
            const facilityBookings = bookings?.reduce((acc: any, booking) => {
              if (!acc[booking.facility_id]) acc[booking.facility_id] = [];
              acc[booking.facility_id].push({
                start: booking.start_time,
                end: booking.end_time
              });
              return acc;
            }, {}) || {};

            // Check for full day blocks
            const fullyBlockedFacilities = blockedDates?.filter(blocked => !blocked.start_time || !blocked.end_time).map(blocked => blocked.facility_id) || [];
            fullyBlockedFacilities.forEach(facilityId => unavailableFacilities.add(facilityId));

            // Check if facility is completely booked (simplified - assume 8-22 operating hours)
            Object.keys(facilityBookings).forEach(facilityId => {
              const bookingsForFacility = facilityBookings[facilityId];
              // Simple check: if more than 10 hours booked, consider unavailable
              const totalBookedHours = bookingsForFacility.reduce((total: number, booking: any) => {
                const start = new Date(`1970-01-01T${booking.start}`);
                const end = new Date(`1970-01-01T${booking.end}`);
                return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
              }, 0);
              if (totalBookedHours >= 10) {
                unavailableFacilities.add(facilityId);
              }
            });
          }

      // Filter out unavailable facilities
      filteredFacilities = filteredFacilities.filter(f => !unavailableFacilities.has(f.id));
    } catch (error) {
      console.error('Error checking availability:', error);
    }
  }

  // Apply sorting
  filteredFacilities.sort((a, b) => {
    switch (sortBy) {
      case 'price-low':
        return (a.price_per_hour || 0) - (b.price_per_hour || 0);
      case 'price-high':
        return (b.price_per_hour || 0) - (a.price_per_hour || 0);
      case 'name-az':
        return a.name.localeCompare(b.name);
      case 'name-za':
        return b.name.localeCompare(a.name);
      case 'capacity-high':
        return (b.capacity || 0) - (a.capacity || 0);
      case 'capacity-low':
        return (a.capacity || 0) - (b.capacity || 0);
      case 'complex-az':
        return (a.sports_complex_name || 'Zzz').localeCompare(b.sports_complex_name || 'Zzz');
      case 'complex-za':
        return (b.sports_complex_name || 'Zzz').localeCompare(a.sports_complex_name || 'Zzz');
      case 'oldest':
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      case 'newest':
      default:
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    }
  });

  setFacilities(filteredFacilities);
  setLoading(false);
};
applyFilters();
}, [allFacilities, selectedType, locationFilter, searchTerm, selectedDate, startTime, duration, sortBy]);
  const getTimeOptions = () => {
    const times = [];
    const dateToCheck = selectedDate || new Date(); // Use today if no date selected
    
    for (let hour = 8; hour <= 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        // Apply time validation for the selected date or today
        if (!isBookingTimeAllowed(dateToCheck, timeString)) {
          continue; // Skip past times for today
        }
        
        times.push({
          value: timeString,
          label: timeString
        });
      }
    }
    return times;
  };
  const handleTypeFilter = (type: string | null) => {
    setSelectedType(type);
    if (type) {
      setSearchParams({
        type
      });
    } else {
      setSearchParams({});
    }
  };
  if (loading || !authChecked || session && !userProfile) {
    return <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg text-muted-foreground">Se încarcă...</p>
          </div>
        </main>
        <Footer />
      </div>;
  }
  return <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Highlight banner when coming from homepage */}
        {fromHome && (
          <div className="mb-6 p-4 bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-primary/20 rounded-full flex items-center justify-center">
                <span className="text-primary font-bold">🏠</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Bine ai venit!</h3>
                <p className="text-sm text-muted-foreground">
                  Acum poți explora toate terenurile disponibile și să faci rezervări în funcție de preferințele tale.
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Facilități <span className="text-primary">Sportive</span>
            </h1>
            <p className="text-xl text-muted-foreground">Descoperă cele mai bune baze sportive din apropiere și rezervă acum</p>
          </div>
        </div>

        {/* Search and Filters - Only for clients and admins */}
        {userProfile?.role !== 'facility_owner' && (
          <Card className="mb-8 animate-fade-in shadow-lg border-2 border-primary/20 bg-white">
            <CardContent className="p-6">
              {/* First Row: Search and Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Caută bază sportivă</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Caută nume bază sportivă" 
                      className="h-11 pl-10 bg-white border-2 border-primary/20 focus:border-primary shadow-sm"
                      value={searchTerm} 
                      onChange={(e) => setSearchTerm(e.target.value)} 
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Locație</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Locație..." 
                      className="h-11 pl-10 bg-white border-2 border-primary/20 focus:border-primary shadow-sm"
                      value={locationFilter} 
                      onChange={(e) => setLocationFilter(e.target.value)} 
                    />
                  </div>
                </div>
              </div>

              {/* Second Row: Date and Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Data rezervării</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className={cn(
                          "w-full h-11 justify-start text-left font-normal bg-white border-2 border-primary/20 hover:border-primary shadow-sm", 
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-3 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Selectează data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[1000]" align="start">
                      <EnhancedCalendar 
                        mode="single" 
                        selected={selectedDate} 
                         blockedDates={blockedDates}
                         partiallyBlockedDates={partiallyBlockedDates}
                        onSelect={(date) => {
                          setSelectedDate(date);
                          // Clear time selections when date changes to avoid past time selections
                          if (date) {
                            const timeOptions = [];
                            for (let hour = 8; hour <= 22; hour++) {
                              for (let minute = 0; minute < 60; minute += 30) {
                                const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                                if (isBookingTimeAllowed(date, timeString)) {
                                  timeOptions.push(timeString);
                                }
                              }
                            }
                            // Clear current time selections if they're no longer valid
                            if (startTime && !timeOptions.includes(startTime)) {
                              setStartTime('');
                            }
                            // Clear duration selection when date changes
                            setDuration('');
                          }
                        }} 
                        disabled={(date) => {
                          const today = new Date();
                          const twoWeeksFromNow = new Date();
                          twoWeeksFromNow.setDate(today.getDate() + 14);
                          return date < today || date > twoWeeksFromNow;
                        }}
                        initialFocus 
                        className="p-3 pointer-events-auto" 
                      />
                      
                      {/* Add "Go to Today" button */}
                      <div className="mt-6 mb-4 flex justify-center">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const today = new Date();
                            setSelectedDate(today);
                            // Clear time and duration selections when going to today
                            setStartTime('');
                            setDuration('');
                          }}
                          disabled={selectedDate && isSameDay(selectedDate, new Date())}
                        >
                          🏠 Mergi la Azi
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Interval rezervare</label>
                  <div className="grid grid-cols-1 gap-3">
                    {/* Duration Selection */}
                    <div className="space-y-2">
                      <Select value={duration} onValueChange={(value) => {
                        setDuration(value);
                        // Reset start time when duration changes
                        setStartTime('');
                      }}>
                        <SelectTrigger className="h-11 bg-background border-border focus:border-primary">
                          <SelectValue placeholder="Selectează durata" />
                        </SelectTrigger>
                        <SelectContent className="z-[100]">
                          <SelectItem value="60">60 minute (1 oră)</SelectItem>
                          <SelectItem value="90">90 minute (1.5 ore)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Start Time Selection - only show when duration is selected */}
                    {duration && (
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                        <Select value={startTime} onValueChange={setStartTime}>
                          <SelectTrigger className="h-11 pl-10 bg-background border-border focus:border-primary">
                            <SelectValue placeholder="Selectează ora de început" />
                          </SelectTrigger>
                          <SelectContent className="z-[100]">
                            {getTimeOptions().map(time => {
                              // Check if this start time + duration would exceed operating hours
                              const [hour, minute] = time.value.split(':').map(Number);
                              const startMinutes = hour * 60 + minute;
                              const endMinutes = startMinutes + parseInt(duration);
                              const endHour = Math.floor(endMinutes / 60);
                              
                              // Don't show times that would exceed 22:00 (operating hours end)
                              if (endHour > 22) return null;
                              
                              return (
                                <SelectItem key={time.value} value={time.value}>
                                  {time.label}
                                </SelectItem>
                              );
                            }).filter(Boolean)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <Button 
                  variant="secondary" 
                  size="lg"
                  className="px-8 py-3 border-2 border-border bg-background text-foreground hover:bg-secondary hover:text-secondary-foreground" 
                  onClick={() => {
                    setSearchTerm('');
                    setLocationFilter('');
                    setSelectedDate(undefined);
                    setStartTime('');
                    setDuration('');
                    setSelectedType(null);
                    setSortBy('newest');
                  }}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Resetează Filtrele
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Sport Type Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col space-y-4">
              {/* Sport Type Badges */}
              <div>
                <label className="text-sm font-medium text-foreground mb-3 block">Filtrează după tipul de sport</label>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={selectedType === null ? "default" : "outline"} className="cursor-pointer hover:bg-primary hover:text-primary-foreground" onClick={() => handleTypeFilter(null)}>
                    Toate
                  </Badge>
                  <Badge variant={selectedType === 'football' ? "default" : "outline"} className="cursor-pointer hover:bg-primary hover:text-primary-foreground" onClick={() => handleTypeFilter('football')}>
                    Fotbal
                  </Badge>
                  <Badge variant={selectedType === 'tennis' ? "default" : "outline"} className="cursor-pointer hover:bg-primary hover:text-primary-foreground" onClick={() => handleTypeFilter('tennis')}>
                    Tenis
                  </Badge>
                  <Badge variant={selectedType === 'padel' ? "default" : "outline"} className="cursor-pointer hover:bg-primary hover:text-primary-foreground" onClick={() => handleTypeFilter('padel')}>
                    Padel
                  </Badge>
                  <Badge variant={selectedType === 'squash' ? "default" : "outline"} className="cursor-pointer hover:bg-primary hover:text-primary-foreground" onClick={() => handleTypeFilter('squash')}>
                    Squash
                  </Badge>
                  <Badge variant={selectedType === 'basketball' ? "default" : "outline"} className="cursor-pointer hover:bg-primary hover:text-primary-foreground" onClick={() => handleTypeFilter('basketball')}>
                    Baschet
                  </Badge>
                  <Badge variant={selectedType === 'volleyball' ? "default" : "outline"} className="cursor-pointer hover:bg-primary hover:text-primary-foreground" onClick={() => handleTypeFilter('volleyball')}>
                    Volei
                  </Badge>
                  <Badge variant={selectedType === 'foot_tennis' ? "default" : "outline"} className="cursor-pointer hover:bg-primary hover:text-primary-foreground" onClick={() => handleTypeFilter('foot_tennis')}>
                    Tenis de picior
                  </Badge>
                  <Badge variant={selectedType === 'ping_pong' ? "default" : "outline"} className="cursor-pointer hover:bg-primary hover:text-primary-foreground" onClick={() => handleTypeFilter('ping_pong')}>
                    Ping Pong
                  </Badge>
                </div>
              </div>

              {/* Sorting Options */}
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-foreground">Sortează după:</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-64">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Selectează sortarea" />
                  </SelectTrigger>
                   <SelectContent className="z-[1000]">
                    <SelectItem value="newest">Cele mai noi adăugate</SelectItem>
                    <SelectItem value="oldest">Cele mai vechi adăugate</SelectItem>
                    <SelectItem value="price-low">Preț: Crescător</SelectItem>
                    <SelectItem value="price-high">Preț: Descrescător</SelectItem>
                    <SelectItem value="name-az">Nume: A-Z</SelectItem>
                    <SelectItem value="name-za">Nume: Z-A</SelectItem>
                    {session && (
                      <>
                        <SelectItem value="complex-az">Bază sportivă: A-Z</SelectItem>
                        <SelectItem value="complex-za">Bază sportivă: Z-A</SelectItem>
                      </>
                    )}
                    <SelectItem value="capacity-high">Capacitate: Mare-Mică</SelectItem>
                    <SelectItem value="capacity-low">Capacitate: Mică-Mare</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Facilities Grid */}
        {facilities.length === 0 ? <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Nu există facilități disponibile</h2>
            <p className="text-muted-foreground mb-6">
              În acest moment nu există facilități sportive înregistrate în platformă.
            </p>
            <Button variant="sport" asChild>
              <a href="/facility/register">Înregistrează prima facilitate</a>
            </Button>
          </div> : <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {facilities.map((facility, index) => <Card key={facility.id} className="group hover:shadow-elegant transition-all duration-300 animate-fade-in" style={{
          animationDelay: `${index * 0.1}s`
        }}>
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row h-full">
                    <div className="md:w-1/3 relative overflow-hidden rounded-l-lg md:rounded-l-lg md:rounded-r-none rounded-r-lg md:rounded-bl-lg">
                        <ImageCarousel 
                          images={facility.images || []}
                          facilityName={facility.name}
                          facilityType={facility.facility_type}
                          className="w-full h-48 md:h-full rounded-l-lg md:rounded-l-lg md:rounded-r-none rounded-r-lg md:rounded-bl-lg" 
                        />
                      <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground z-10">
                        {getFacilityTypeLabel(facility.facility_type)}
                      </Badge>
                    </div>
                    
                    <div className="md:w-2/3 p-6 flex flex-col">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-xl font-bold text-foreground mb-1">{facility.name}</h3>
                          {/* Show sports complex name */}
                          {facility.sports_complex_name && <div className="text-sm font-medium text-primary mb-1">
                              {facility.sports_complex_name}
                            </div>}
                            <div className="flex items-center text-muted-foreground text-sm mb-1">
                              <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                              <span className="text-left">
                                {facility.address || facility.sports_complex_address || `${facility.city}`}
                              </span>
                            </div>
                            {/* Operating Hours */}
                            {(facility.operating_hours_start && facility.operating_hours_end) && (
                              <div className="flex items-center text-muted-foreground text-sm mb-1">
                                <Clock className="h-4 w-4 mr-1 flex-shrink-0" />
                                <span className="text-left">
                                  Orar: {facility.operating_hours_start?.slice(0, 5)} - {facility.operating_hours_end?.slice(0, 5)}
                                </span>
                              </div>
                            )}
                        </div>
                      </div>
                      
                      <div className="flex-1 space-y-4">
                        {(facility.description || facility.basic_description) && <p className="text-sm text-muted-foreground">
                            {facility.description || facility.basic_description}
                          </p>}
                        
                        <div className="min-h-[2rem]">
                          {(facility.amenities || facility.available_amenities) && (facility.amenities?.length > 0 || facility.available_amenities?.length > 0) && <div className="flex flex-wrap gap-1">
                              {(facility.amenities || facility.available_amenities)?.map(amenity => <Badge key={amenity} variant="secondary" className="text-xs">
                                  {amenity}
                                </Badge>)}
                            </div>}
                        </div>
                      </div>
                       
                      <div className="mt-auto">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Users className="h-4 w-4 mr-1" />
                            <span>
                              {facility.capacity && facility.capacity_max 
                                ? `${facility.capacity}-${facility.capacity_max} persoane`
                                : facility.capacity 
                                  ? `${facility.capacity} persoane` 
                                  : facility.capacity_info || 'Disponibil'
                              }
                            </span>
                          </div>
                          <div className="text-lg font-bold text-primary">
                            {facility.price_per_hour ? `${facility.price_per_hour} RON/oră` : facility.price_range || facility.base_price_info || 'Preț la cerere'}
                          </div>
                        </div>
                       
                        <div className="flex gap-3">
                          {session ? (
                            <Button variant="sport" asChild className="flex-1 justify-center">
                              <Link to={`/booking/${facility.id}`} className="text-center">
                                Rezervă Acum
                              </Link>
                            </Button>
                          ) : (
                            <div className="flex-1">
                              <Button 
                                variant="outline" 
                                onClick={() => {
                                  sessionStorage.setItem('redirectAfterLogin', window.location.pathname + window.location.search);
                                  navigate('/client/login');
                                }} 
                                className="w-full text-sm justify-center"
                              >
                                <LogIn className="h-4 w-4 mr-2" />
                                Autentifică-te pentru rezervare
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>)}
          </div>}
      </main>
      
      <Footer />
    </div>;
};
export default FacilitiesPage;
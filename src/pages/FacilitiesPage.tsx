import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Clock, Star, Filter, Search, LogIn, Plus, Settings, Phone, CalendarIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ImageCarousel from "@/components/ImageCarousel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  price_per_hour?: number; // Now available for public browsing too
  base_price_info?: string; // For client view - generic pricing
  price_range?: string; // For legacy public browsing
  capacity?: number; // Now available for public browsing too
  capacity_info?: string; // For client view - generic capacity
  amenities?: string[]; // Now available for public browsing too
  available_amenities?: string[]; // For legacy public browsing
  images?: string[]; // Now available for public browsing too
  main_image_url?: string;
  has_images?: boolean; // For legacy public browsing
  rating_display?: string; // For legacy public browsing
  created_at?: string; // Optional for clients
  sports_complex_name?: string; // Sports complex name
  sports_complex_address?: string; // Sports complex address
  phone_number?: string; // Contact phone number
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
  const [endTime, setEndTime] = useState<string>('');
  const [allFacilities, setAllFacilities] = useState<Facility[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check authentication status
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecked(true);
      
      // Get user profile if authenticated
      if (session) {
        fetchUserProfile(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setAuthChecked(true);
        
        if (session) {
          fetchUserProfile(session.user.id);
        } else {
          setUserProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', userId)
        .single();

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
    const endTimeParam = searchParams.get('endTime');
    
    setSelectedType(typeParam);
    setLocationFilter(locationParam || '');
    setSearchTerm(searchParam || '');
    setStartTime(startTimeParam || '');
    setEndTime(endTimeParam || '');
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
          const { data: facilitiesData, error: facilitiesError } = await supabase
            .from('facilities')
            .select(`
              id, name, facility_type, city, description, price_per_hour, capacity, amenities, images, address,
              profiles!facilities_owner_id_fkey (user_type_comment, full_name, phone)
            `)
            .eq('is_active', true);
          
          allFacilities = facilitiesData?.map(f => {
            // Extract sports complex name from profile with improved logic
            let sportsComplexName = 'Baza Sportivă';
            if (f.profiles?.user_type_comment) {
              // Check for format: "Name - Proprietar bază sportivă"
              if (f.profiles.user_type_comment.match(/.+ - Proprietar bază sportivă$/)) {
                sportsComplexName = f.profiles.user_type_comment.replace(' - Proprietar bază sportivă', '');
              }
              // Check for format: "Proprietar bază sportivă - Name"
              else if (f.profiles.user_type_comment.match(/^Proprietar bază sportivă - .+/)) {
                sportsComplexName = f.profiles.user_type_comment.replace('Proprietar bază sportivă - ', '');
              }
              // If no standard format, use the whole comment if it doesn't contain standard text
              else if (!f.profiles.user_type_comment.includes('Proprietar bază sportivă')) {
                sportsComplexName = f.profiles.user_type_comment;
              }
            }
            
            // Fallback to owner name and city if still generic
            if (sportsComplexName === 'Baza Sportivă' && f.profiles?.full_name) {
              sportsComplexName = `Baza Sportivă ${f.profiles.full_name.split(' ')[0]} - ${f.city}`;
            }
            
            return {
              ...f,
              area_info: `${f.city} area`,
              sports_complex_name: sportsComplexName,
              sports_complex_address: f.address ? `${f.address}, ${f.city}` : `${f.city}`,
              phone_number: f.profiles?.phone
            };
          });
          error = facilitiesError;
        } else if (session && userProfile?.role === 'admin') {
          // Admins get full data
          const { data, error: rpcError } = await supabase
            .rpc('get_public_facilities');
          allFacilities = data;
          error = rpcError;
        } else if (session) {
          // Authenticated users get enhanced data with contact info
          const { data, error: rpcError } = await supabase
            .rpc('get_facilities_for_authenticated_users');
          allFacilities = data;
          error = rpcError;
        } else {
          // Non-authenticated users get safe public facility data
          const { data, error: rpcError } = await supabase
            .rpc('get_facilities_for_public_browsing_safe');
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
        filteredFacilities = filteredFacilities.filter(f => 
          f.city.toLowerCase().includes(locationFilter.toLowerCase()) ||
          (f.address && f.address.toLowerCase().includes(locationFilter.toLowerCase()))
        );
      }

      // Apply search term filter
      if (searchTerm) {
        filteredFacilities = filteredFacilities.filter(f =>
          f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (f.description && f.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (f.sports_complex_name && f.sports_complex_name.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }

      // Apply date and time slot filter - check availability
      if (selectedDate) {
        try {
          const dateString = format(selectedDate, 'yyyy-MM-dd');
          
          // Get bookings for the selected date
          const { data: bookings } = await supabase
            .from('bookings')
            .select('facility_id, start_time, end_time')
            .eq('booking_date', dateString)
            .in('status', ['confirmed', 'pending']);

          // Get blocked dates for the selected date
          const { data: blockedDates } = await supabase
            .from('blocked_dates')
            .select('facility_id, start_time, end_time')
            .eq('blocked_date', dateString);

          const unavailableFacilities = new Set();

          if (startTime && endTime) {
            // Specific time range selected - check exact availability
            
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
            const fullyBlockedFacilities = blockedDates?.filter(blocked => 
              !blocked.start_time || !blocked.end_time
            ).map(blocked => blocked.facility_id) || [];

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
          filteredFacilities = filteredFacilities.filter(f => 
            !unavailableFacilities.has(f.id)
          );
        } catch (error) {
          console.error('Error checking availability:', error);
        }
      }

      setFacilities(filteredFacilities);
      setLoading(false);
    };

    applyFilters();
  }, [allFacilities, selectedType, locationFilter, searchTerm, selectedDate, startTime, endTime]);

  const getFacilityTypeLabel = (type: string) => {
    const typeMap: { [key: string]: string } = {
      tennis: "Tenis",
      football: "Fotbal", 
      padel: "Padel",
      swimming: "Înot",
      basketball: "Baschet",
      volleyball: "Volei"
    };
    return typeMap[type] || type;
  };

  const getTimeOptions = () => {
    const times = [];
    for (let hour = 8; hour < 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        times.push({ value: timeString, label: timeString });
      }
    }
    times.push({ value: "22:00", label: "22:00" });
    return times;
  };

  const handleTypeFilter = (type: string | null) => {
    setSelectedType(type);
    if (type) {
      setSearchParams({ type });
    } else {
      setSearchParams({});
    }
  };

  if (loading || !authChecked || (session && !userProfile)) {
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


  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Facilități <span className="text-primary">Sportive</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Descoperă cele mai bune baze sportive din București și rezervă acum
            </p>
          </div>
        </div>

        {/* Search and Filters - Only for clients and admins */}
        {userProfile?.role !== 'facility_owner' && (
          <Card className="mb-8 animate-fade-in">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Caută facilități..." 
                    className="pl-10" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Locație..." 
                    className="pl-10" 
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                  />
                </div>
                
                <div className="relative">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal pl-10",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        {selectedDate ? format(selectedDate, "dd/MM/yyyy") : <span>Selectează data</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => {
                          const today = new Date();
                          const twoWeeksFromNow = new Date();
                          twoWeeksFromNow.setDate(today.getDate() + 14);
                          return date < today || date > twoWeeksFromNow;
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Intervalul orar</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
                      <Select value={startTime} onValueChange={setStartTime}>
                        <SelectTrigger className="pl-10">
                          <SelectValue placeholder="De la" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-lg z-50">
                          {getTimeOptions().filter(time => !endTime || time.value < endTime).map((time) => (
                            <SelectItem key={time.value} value={time.value}>
                              {time.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="relative flex-1">
                      <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
                      <Select value={endTime} onValueChange={setEndTime} disabled={!startTime}>
                        <SelectTrigger className="pl-10">
                          <SelectValue placeholder="Până la" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-lg z-50">
                          {getTimeOptions().filter(time => startTime && time.value > startTime).map((time) => (
                            <SelectItem key={time.value} value={time.value}>
                              {time.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                <Button 
                  variant="sport" 
                  className="w-full"
                  onClick={() => {
                    setSearchTerm('');
                    setLocationFilter('');
                    setSelectedDate(undefined);
                    setStartTime('');
                    setEndTime('');
                    setSelectedType(null);
                  }}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Resetează
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <Badge 
                  variant={selectedType === null ? "default" : "outline"} 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => handleTypeFilter(null)}
                >
                  Toate
                </Badge>
                <Badge 
                  variant={selectedType === "tennis" ? "default" : "outline"} 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => handleTypeFilter("tennis")}
                >
                  Tenis
                </Badge>
                <Badge 
                  variant={selectedType === "football" ? "default" : "outline"} 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => handleTypeFilter("football")}
                >
                  Fotbal
                </Badge>
                <Badge 
                  variant={selectedType === "padel" ? "default" : "outline"} 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => handleTypeFilter("padel")}
                >
                  Padel
                </Badge>
                <Badge 
                  variant={selectedType === "swimming" ? "default" : "outline"} 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => handleTypeFilter("swimming")}
                >
                  Înot
                </Badge>
                <Badge 
                  variant={selectedType === "basketball" ? "default" : "outline"} 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => handleTypeFilter("basketball")}
                >
                  Baschet
                </Badge>
                <Badge 
                  variant={selectedType === "volleyball" ? "default" : "outline"} 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => handleTypeFilter("volleyball")}
                >
                  Volei
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Facilities Grid */}
        {facilities.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Nu există facilități disponibile</h2>
            <p className="text-muted-foreground mb-6">
              În acest moment nu există facilități sportive înregistrate în platformă.
            </p>
            <Button variant="sport" asChild>
              <a href="/facility/register">Înregistrează prima facilitate</a>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {facilities.map((facility, index) => (
              <Card key={facility.id} className="group hover:shadow-elegant transition-all duration-300 animate-fade-in" style={{animationDelay: `${index * 0.1}s`}}>
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    <div className="md:w-1/3 relative overflow-hidden">
                      <ImageCarousel
                        images={facility.images || []}
                        facilityName={facility.name}
                        className="w-full h-48 md:h-full"
                      />
                      <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground z-10">
                        {getFacilityTypeLabel(facility.facility_type)}
                      </Badge>
                    </div>
                    
                    <div className="md:w-2/3 p-6">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-xl font-bold text-foreground mb-1">{facility.name}</h3>
                          {/* Show sports complex name */}
                          {facility.sports_complex_name && (
                            <div className="text-sm font-medium text-primary mb-1">
                              {facility.sports_complex_name}
                            </div>
                          )}
                          <div className="flex items-center text-muted-foreground text-sm mb-1">
                            <MapPin className="h-4 w-4 mr-1" />
                            {/* Show sports complex address for better UX */}
                            {facility.sports_complex_address || 
                             facility.area_info || 
                             facility.general_area || 
                             (facility.address ? `${facility.address}, ${facility.city}` : `${facility.city} area`)
                            }
                          </div>
                          {/* Show contact phone number */}
                          {facility.phone_number && (
                            <div className="flex items-center text-muted-foreground text-sm">
                              <Phone className="h-4 w-4 mr-1" />
                              {facility.phone_number}
                            </div>
                          )}
                        </div>
                      </div>
                      
                       {(facility.description || facility.basic_description) && (
                         <p className="text-sm text-muted-foreground mb-4">
                           {facility.description || facility.basic_description}
                         </p>
                       )}
                      
                       {(facility.amenities || facility.available_amenities) && 
                        (facility.amenities?.length > 0 || facility.available_amenities?.length > 0) && (
                         <div className="flex flex-wrap gap-1 mb-4">
                           {(facility.amenities || facility.available_amenities)?.map((amenity) => (
                             <Badge key={amenity} variant="secondary" className="text-xs">
                               {amenity}
                             </Badge>
                           ))}
                         </div>
                       )}
                       
                        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                         <div className="flex items-center">
                           <span className="text-muted-foreground">
                             Capacitate: {facility.capacity ? `${facility.capacity} persoane` : 
                                         facility.capacity_info || 'Disponibil'}
                           </span>
                         </div>
                       </div>
                      
                       <div className="flex justify-between items-center">
                         <div className="text-2xl font-bold text-primary">
                           {facility.price_per_hour ? `${facility.price_per_hour} RON/oră` : 
                            facility.price_range || facility.base_price_info || 'Preț disponibil la rezervare'}
                         </div>
                         {session ? (
                           <Button variant="sport" asChild>
                             <Link to={`/booking/${facility.id}`}>
                               Rezervă Acum
                             </Link>
                           </Button>
                         ) : (
                          <Button variant="outline" onClick={() => navigate('/client/login')}>
                            <LogIn className="h-4 w-4 mr-2" />
                            Autentifică-te
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
};

export default FacilitiesPage;
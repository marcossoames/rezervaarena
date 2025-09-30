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
import { FacilitySportsComplexHoverCard } from "@/components/facility/FacilitySportsComplexHoverCard";
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
  general_services?: string[]; // Sports complex general services
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
  const calculateBlockedDatesForVisibleFacilities = async () => {
    if (!allFacilities.length) return { fullyBlocked: new Set(), partiallyBlocked: new Set() };
    
    // Get currently filtered facilities (before date filtering)
    let visibleFacilities = [...allFacilities];
    
    // Apply type filter
    if (selectedType) {
      visibleFacilities = visibleFacilities.filter(f => f.facility_type === selectedType);
    }
    
    // Apply location filter
    if (locationFilter) {
      visibleFacilities = visibleFacilities.filter(f => 
        f.city.toLowerCase().includes(locationFilter.toLowerCase()) || 
        (f.address && f.address.toLowerCase().includes(locationFilter.toLowerCase()))
      );
    }
    
    // Apply search term filter
    if (searchTerm) {
      visibleFacilities = visibleFacilities.filter(f => 
        f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (f.description && f.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (f.sports_complex_name && f.sports_complex_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    if (!visibleFacilities.length) return { fullyBlocked: new Set(), partiallyBlocked: new Set() };
    
    try {
      const facilityIds = visibleFacilities.map(f => f.id);
      const { data: blockedDatesData } = await supabase
        .from('blocked_dates')
        .select('facility_id, blocked_date, start_time, end_time')
        .in('facility_id', facilityIds);
      
      if (!blockedDatesData) return { fullyBlocked: new Set(), partiallyBlocked: new Set() };
      
      // Group blocks by date
      const blocksByDate = new Map<string, {fullDay: Set<string>, partial: Set<string>}>();
      
      blockedDatesData.forEach(item => {
        if (!blocksByDate.has(item.blocked_date)) {
          blocksByDate.set(item.blocked_date, { fullDay: new Set(), partial: new Set() });
        }
        
        const blocks = blocksByDate.get(item.blocked_date)!;
        
        // If no start_time and end_time, it's a full day block for this facility
        if (!item.start_time && !item.end_time) {
          blocks.fullDay.add(item.facility_id);
        } else {
          // If has specific times, it's a partial block for this facility
          blocks.partial.add(item.facility_id);
        }
      });
      
      const fullyBlocked = new Set<string>();
      const partiallyBlocked = new Set<string>();
      
      // A date is fully blocked only if ALL visible facilities are fully blocked on that date
      // A date is partially blocked if some (but not all) facilities have blocks
      blocksByDate.forEach((blocks, date) => {
        const totalVisibleFacilities = facilityIds.length;
        const fullyBlockedFacilities = blocks.fullDay.size;
        const hasPartialBlocks = blocks.partial.size > 0;
        
        if (fullyBlockedFacilities === totalVisibleFacilities) {
          // All visible facilities are fully blocked
          fullyBlocked.add(date);
        } else if (fullyBlockedFacilities > 0 || hasPartialBlocks) {
          // Some facilities have blocks (full or partial)
          partiallyBlocked.add(date);
        }
      });
      
      return { fullyBlocked, partiallyBlocked };
    } catch (error) {
      console.error('Error calculating blocked dates:', error);
      return { fullyBlocked: new Set(), partiallyBlocked: new Set() };
    }
  };
  
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

    // Initialize empty blocked dates - will be calculated dynamically based on visible facilities
    setBlockedDates(new Set());
    setPartiallyBlockedDates(new Set());
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

      // Update blocked dates for calendar based on currently visible facilities
      if (filteredFacilities.length > 0) {
        try {
          const facilityIds = filteredFacilities.map(f => f.id);
          const { data: blockedDatesData } = await supabase
            .from('blocked_dates')
            .select('facility_id, blocked_date, start_time, end_time')
            .in('facility_id', facilityIds);

          if (blockedDatesData) {
            const blocksByDate = new Map();
            
            blockedDatesData.forEach(item => {
              if (!blocksByDate.has(item.blocked_date)) {
                blocksByDate.set(item.blocked_date, { fullDay: new Set(), partial: new Set() });
              }
              
              const blocks = blocksByDate.get(item.blocked_date);
              if (!item.start_time && !item.end_time) {
                blocks.fullDay.add(item.facility_id);
              } else {
                blocks.partial.add(item.facility_id);
              }
            });
            
            const fullyBlocked = new Set<string>();
            const partiallyBlocked = new Set<string>();
            
            blocksByDate.forEach((blocks, date) => {
              const totalFacilities = facilityIds.length;
              const fullyBlockedCount = blocks.fullDay.size;
              
              if (fullyBlockedCount === totalFacilities) {
                fullyBlocked.add(date);
              } else if (fullyBlockedCount > 0 || blocks.partial.size > 0) {
                partiallyBlocked.add(date);
              }
            });
            
            setBlockedDates(fullyBlocked);
            setPartiallyBlockedDates(partiallyBlocked);
          }
        } catch (error) {
          console.error('Error updating blocked dates:', error);
        }
      } else {
        setBlockedDates(new Set());
        setPartiallyBlockedDates(new Set());
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
          if (startTime) {
            if (duration) {
              // Both start time and duration selected - check for exact time range availability
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
              // Only start time selected (no duration) - check if facility has ANY availability at this start time
              // We'll check for at least a 30-minute slot availability starting from this time
              const [startHour, startMinute] = startTime.split(':').map(Number);
              const startMinutes = startHour * 60 + startMinute;
              const checkEndMinutes = startMinutes + 30; // Check for at least 30 minutes
              const checkEndTime = `${Math.floor(checkEndMinutes / 60).toString().padStart(2, '0')}:${(checkEndMinutes % 60).toString().padStart(2, '0')}`;

              // Check if any facility has conflicts in this 30-minute window
              const conflictsInTimeSlot = bookings?.filter(booking => {
                const bookingStart = booking.start_time;
                const bookingEnd = booking.end_time;
                return bookingStart < checkEndTime && bookingEnd > startTime;
              }) || [];
              
              const blocksInTimeSlot = blockedDates?.filter(blocked => {
                if (!blocked.start_time || !blocked.end_time) return true; // Full day block
                return blocked.start_time < checkEndTime && blocked.end_time > startTime;
              }) || [];

              // Mark facilities as unavailable if they're booked/blocked in this time slot
              conflictsInTimeSlot.forEach(booking => unavailableFacilities.add(booking.facility_id));
              blocksInTimeSlot.forEach(blocked => unavailableFacilities.add(blocked.facility_id));
            }
          } else {
            // No specific time slot - check if facilities have any availability
            
            // Check for full day blocks first
            const fullyBlockedFacilities = blockedDates?.filter(blocked => !blocked.start_time || !blocked.end_time).map(blocked => blocked.facility_id) || [];
            fullyBlockedFacilities.forEach(facilityId => unavailableFacilities.add(facilityId));

            // For each facility, check if it's completely booked by examining coverage
            filteredFacilities.forEach(facility => {
              // Skip if already marked as unavailable due to full day block
              if (unavailableFacilities.has(facility.id)) return;
              
              // Get all bookings for this facility
              const facilityBookings = bookings?.filter(b => b.facility_id === facility.id) || [];
              
              // Get operating hours (default 8-22 if not specified)
              const opStart = facility.operating_hours_start || '08:00';
              const opEnd = facility.operating_hours_end || '22:00';
              
              // Convert to minutes for easier calculation
              const [startHour, startMin] = opStart.split(':').map(Number);
              const [endHour, endMin] = opEnd.split(':').map(Number);
              const operatingStartMinutes = startHour * 60 + startMin;
              const operatingEndMinutes = endHour * 60 + endMin;
              const totalOperatingMinutes = operatingEndMinutes - operatingStartMinutes;
              
              // Calculate total booked minutes
              let totalBookedMinutes = 0;
              const timeSlots = new Array(totalOperatingMinutes / 30).fill(false); // 30-minute slots
              
              facilityBookings.forEach(booking => {
                const [bStartHour, bStartMin] = booking.start_time.split(':').map(Number);
                const [bEndHour, bEndMin] = booking.end_time.split(':').map(Number);
                const bookingStartMinutes = bStartHour * 60 + bStartMin;
                const bookingEndMinutes = bEndHour * 60 + bEndMin;
                
                // Mark time slots as booked (convert to slot indices)
                const startSlot = Math.max(0, Math.floor((bookingStartMinutes - operatingStartMinutes) / 30));
                const endSlot = Math.min(timeSlots.length, Math.ceil((bookingEndMinutes - operatingStartMinutes) / 30));
                
                for (let i = startSlot; i < endSlot; i++) {
                  if (i >= 0 && i < timeSlots.length) {
                    timeSlots[i] = true;
                  }
                }
              });
              
              // Check partial time blocks for this facility
              const facilityPartialBlocks = blockedDates?.filter(blocked => 
                blocked.facility_id === facility.id && 
                blocked.start_time && 
                blocked.end_time
              ) || [];
              
              facilityPartialBlocks.forEach(blocked => {
                const [bStartHour, bStartMin] = blocked.start_time!.split(':').map(Number);
                const [bEndHour, bEndMin] = blocked.end_time!.split(':').map(Number);
                const blockStartMinutes = bStartHour * 60 + bStartMin;
                const blockEndMinutes = bEndHour * 60 + bEndMin;
                
                const startSlot = Math.max(0, Math.floor((blockStartMinutes - operatingStartMinutes) / 30));
                const endSlot = Math.min(timeSlots.length, Math.ceil((blockEndMinutes - operatingStartMinutes) / 30));
                
                for (let i = startSlot; i < endSlot; i++) {
                  if (i >= 0 && i < timeSlots.length) {
                    timeSlots[i] = true;
                  }
                }
              });
              
              // If more than 90% of time slots are booked/blocked, consider facility unavailable
              const bookedSlots = timeSlots.filter(slot => slot).length;
              const occupancyRate = bookedSlots / timeSlots.length;
              
              if (occupancyRate > 0.9) {
                unavailableFacilities.add(facility.id);
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

              {/* Second Row: Date, Start Time, Duration */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                  <label className="text-sm font-medium text-foreground">Ora de începere</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <Select value={startTime} onValueChange={setStartTime}>
                      <SelectTrigger className="h-11 pl-10 bg-white border-2 border-primary/20 focus:border-primary shadow-sm">
                        <SelectValue placeholder="Selectează ora" />
                      </SelectTrigger>
                      <SelectContent className="z-[1000]">
                        {getTimeOptions().map(time => (
                          <SelectItem key={time.value} value={time.value}>
                            {time.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Durata rezervării</label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger className="h-11 bg-white border-2 border-primary/20 focus:border-primary shadow-sm">
                      <SelectValue placeholder="Selectează durata" />
                    </SelectTrigger>
                    <SelectContent className="z-[1000]">
                      <SelectItem value="60">60 minute (1 oră)</SelectItem>
                      <SelectItem value="90">90 minute (1.5 ore)</SelectItem>
                      <SelectItem value="120">120 minute (2 ore)</SelectItem>
                    </SelectContent>
                  </Select>
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
          </div> : <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-stretch">
            {facilities.map((facility, index) => <Card key={facility.id} className="group h-full hover:shadow-elegant transition-all duration-300 animate-fade-in" style={{
          animationDelay: `${index * 0.1}s`
        }}>
                <CardContent className="p-0 h-full">
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
                    
                    <div className="md:w-2/3 p-6 flex flex-col flex-1">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-xl font-bold text-foreground mb-1">{facility.name}</h3>
                          {/* Show sports complex name with hover card */}
                          {facility.sports_complex_name && (
                            <FacilitySportsComplexHoverCard
                              sportsComplexName={facility.sports_complex_name}
                              sportsComplexAddress={facility.sports_complex_address}
                              generalServices={facility.general_services}
                              allSportsTypes={
                                // Get all unique sports types from facilities with the same sports complex name
                                Array.from(new Set(
                                  allFacilities
                                    .filter(f => f.sports_complex_name === facility.sports_complex_name)
                                    .map(f => f.facility_type)
                                ))
                              }
                              city={facility.city}
                            >
                              <div className="text-sm font-medium text-primary mb-1 cursor-pointer hover:underline">
                                {facility.sports_complex_name}
                              </div>
                            </FacilitySportsComplexHoverCard>
                          )}
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
                        
                         <div className="space-y-2 min-h-[3rem]">
                           {/* General Services (from sports complex) */}
                           {facility.general_services && facility.general_services.length > 0 && (
                             <div>
                               <p className="text-xs text-muted-foreground font-medium mb-1">Servicii generale:</p>
                               <div className="flex flex-wrap gap-1">
                                 {facility.general_services.map((service) => (
                                   <Badge key={service} variant="outline" className="text-xs">
                                     {service}
                                   </Badge>
                                 ))}
                               </div>
                             </div>
                           )}
                           
                           {/* Facility amenities */}
                           {(facility.amenities || facility.available_amenities) && (facility.amenities?.length > 0 || facility.available_amenities?.length > 0) && (
                             <div>
                               <p className="text-xs text-muted-foreground font-medium mb-1">Dotări teren:</p>
                               <div className="flex flex-wrap gap-1">
                                 {(facility.amenities || facility.available_amenities)?.map(amenity => (
                                   <Badge key={amenity} variant="secondary" className="text-xs">
                                     {amenity}
                                   </Badge>
                                 ))}
                               </div>
                             </div>
                           )}
                          
                          {/* Placeholder when neither general services nor amenities exist */}
                          {(!facility.general_services || facility.general_services.length === 0) && 
                           (!facility.amenities || facility.amenities.length === 0) && 
                           (!facility.available_amenities || facility.available_amenities.length === 0) && (
                            <div>
                              <p className="text-xs text-muted-foreground font-medium mb-1">Servicii și dotări:</p>
                              <p className="text-xs text-muted-foreground">Detalii în curs de actualizare</p>
                            </div>
                          )}
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
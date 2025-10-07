import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Clock, Filter, Search, LogIn, CalendarIcon, Users, ArrowUpDown, ChevronDown } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { FacilityCardCarousel } from "@/components/FacilityCardCarousel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { EnhancedCalendar } from "@/components/ui/enhanced-calendar";
import { format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { getFacilityTypeLabel } from "@/utils/facilityTypes";
import { isBookingTimeAllowed } from "@/utils/dateTimeValidation";
import { FacilitySportsComplexHoverCard } from "@/components/facility/FacilitySportsComplexHoverCard";
import { openExternal } from "@/utils/openExternal";
import { useIsMobile } from "@/hooks/use-mobile";
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
  sports_complex_description?: string; // Description of the sports complex
  phone_number?: string;
  operating_hours_start?: string;
  operating_hours_end?: string;
  allowed_durations?: number[]; // Array of allowed booking durations in minutes
  booking_count?: number; // Number of bookings for popularity sorting
}
interface UserProfile {
  role: string | null;
}
const FacilitiesPage = () => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date()); // Set today as default
  const [startTime, setStartTime] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
  const [allFacilities, setAllFacilities] = useState<Facility[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [partiallyBlockedDates, setPartiallyBlockedDates] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<string>('price-low');
  const [showSportsComplexDropdown, setShowSportsComplexDropdown] = useState(false);
  const [filteredSportsComplexes, setFilteredSportsComplexes] = useState<string[]>([]);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [filteredCities, setFilteredCities] = useState<string[]>([]);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const facilitiesRef = useRef<HTMLDivElement>(null);

  // Helper functions for Google Maps
  const buildLocationQuery = (address: string | undefined, city: string): string => {
    if (!address) return city;
    return `${address}, ${city}`;
  };


  const scrollToFacilities = () => {
    facilitiesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getMapsOpenUrl = (address: string | undefined, city: string): string => {
    const query = buildLocationQuery(address, city);
    const q = encodeURIComponent(query);
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  };
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
    // Handle date parameter - only override default if provided in URL
    if (dateParam) {
      const date = new Date(dateParam);
      if (!isNaN(date.getTime())) {
        setSelectedDate(date);
      }
    }
    // If no date param and selectedDate is not set, ensure it's today
    else if (!selectedDate) {
      setSelectedDate(new Date());
    }
  }, [searchParams]);

  // Extract unique sports complex names for autocomplete
  useEffect(() => {
    if (allFacilities.length > 0) {
      const uniqueNames = Array.from(
        new Set(
          allFacilities
            .map(f => f.sports_complex_name)
            .filter(name => name && name.trim() !== '')
        )
      ).sort();
      setFilteredSportsComplexes(uniqueNames);
      
      // Extract unique cities for autocomplete
      const uniqueCities = Array.from(
        new Set(
          allFacilities
            .map(f => f.city)
            .filter(city => city && city.trim() !== '')
        )
      ).sort();
      setFilteredCities(uniqueCities);
    }
  }, [allFacilities]);
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

        // Fetch booking counts using the secure function
        const { data: bookingCounts, error: bookingError } = await supabase
          .rpc('get_facility_booking_counts');

        if (!bookingError && bookingCounts) {
          // Create a map of facility_id to booking_count
          const countMap = new Map<string, number>();
          bookingCounts.forEach((item: { facility_id: string; booking_count: number }) => {
            countMap.set(item.facility_id, item.booking_count);
          });

          // Add booking count to facilities
          allFacilities = allFacilities?.map(facility => ({
            ...facility,
            booking_count: countMap.get(facility.id) || 0
          }));
        } else {
          // If there's an error, set booking_count to 0 for all facilities
          allFacilities = allFacilities?.map(facility => ({
            ...facility,
            booking_count: 0
          }));
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

      // Apply city filter (only search by city, not full address)
      if (locationFilter) {
        filteredFacilities = filteredFacilities.filter(f => 
          f.city.toLowerCase().includes(locationFilter.toLowerCase())
        );
      }

      // Apply search term filter
      if (searchTerm) {
        filteredFacilities = filteredFacilities.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.description && f.description.toLowerCase().includes(searchTerm.toLowerCase()) || f.sports_complex_name && f.sports_complex_name.toLowerCase().includes(searchTerm.toLowerCase()));
      }

      // Apply duration filter - only show facilities that allow the selected duration
      if (duration) {
        const durationInMinutes = parseInt(duration);
        filteredFacilities = filteredFacilities.filter(f => {
          // If facility has allowed_durations defined, check if the selected duration is allowed
          if (f.allowed_durations && f.allowed_durations.length > 0) {
            return f.allowed_durations.includes(durationInMinutes);
          }
          // If we still don't know the allowed durations, be permissive
          return true;
        });
      }

      // Update blocked dates for calendar based on currently visible facilities
      // Use secure public function to check availability without exposing sensitive data
      if (filteredFacilities.length > 0) {
        try {
          const facilityIds = filteredFacilities.map(f => f.id);
          const { data: availabilityData, error } = await supabase
            .rpc('get_fully_unavailable_dates_public', {
              facility_ids_param: facilityIds
            });

          if (error) {
            console.error('Error fetching availability data:', error);
          } else if (availabilityData) {
            const fullyBlocked = new Set<string>();
            const partiallyBlocked = new Set<string>();
            
            const totalFacilities = facilityIds.length;
            
            availabilityData.forEach((item: any) => {
              const { blocked_date, fully_blocked_count, partially_blocked_count } = item;
              
              // If all facilities are fully blocked on this date
              if (fully_blocked_count === totalFacilities) {
                fullyBlocked.add(blocked_date);
              } 
              // If some facilities are blocked (fully or partially)
              else if (fully_blocked_count > 0 || partially_blocked_count > 0) {
                partiallyBlocked.add(blocked_date);
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

          // Get unavailable time slots for each facility using public function
          const facilityAvailabilityPromises = filteredFacilities.map(async (facility) => {
            const { data: unavailableSlots, error } = await supabase
              .rpc('get_facility_unavailable_slots_public', {
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
          
          // Convert to the expected format
          const bookings = facilityAvailabilities.flatMap(({ facilityId, unavailableSlots }) => 
            unavailableSlots
              .filter((slot: any) => slot.unavailable_type === 'booking')
              .map((slot: any) => ({
                facility_id: facilityId,
                start_time: slot.start_time,
                end_time: slot.end_time
              }))
          );

          const blockedDates = facilityAvailabilities.flatMap(({ facilityId, unavailableSlots }) => 
            unavailableSlots
              .filter((slot: any) => slot.unavailable_type === 'blocked')
              .map((slot: any) => ({
                facility_id: facilityId,
                start_time: slot.start_time,
                end_time: slot.end_time
              }))
          );
          const unavailableFacilities = new Set();
          
          // Check availability based on selected time/duration filters
          if (startTime || duration) {
            // Filter facilities based on time slot availability
            filteredFacilities.forEach(facility => {
              const facilityBookings = bookings?.filter(b => b.facility_id === facility.id) || [];
              const facilityBlocks = blockedDates?.filter(b => b.facility_id === facility.id) || [];
              
              // Check if facility has full day block
              const hasFullDayBlock = facilityBlocks.some(blocked => !blocked.start_time || !blocked.end_time);
              if (hasFullDayBlock) {
                unavailableFacilities.add(facility.id);
                return;
              }
              
              if (startTime && duration) {
                // Both start time and duration selected - check for exact time range availability
                const [startHour, startMinute] = startTime.split(':').map(Number);
                const startMinutes = startHour * 60 + startMinute;
                const durationMinutes = parseInt(duration);
                const endMinutes = startMinutes + durationMinutes;
                const endHour = Math.floor(endMinutes / 60);
                const endMinute = endMinutes % 60;
                const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

                // Validate alignment with operating hours and step (min allowed duration)
                const opStart = facility.operating_hours_start || '08:00';
                const opEnd = facility.operating_hours_end || '22:00';
                const [opSH, opSM] = opStart.split(':').map(Number);
                const [opEH, opEM] = opEnd.split(':').map(Number);
                const opStartMinutes = opSH * 60 + opSM;
                const opEndMinutes = opEH * 60 + opEM;
                const minDuration = facility.allowed_durations && facility.allowed_durations.length > 0
                  ? Math.min(...facility.allowed_durations)
                  : 60;
                const step = minDuration; // start times must align to min allowed step from opening time
                const isAligned = ((startMinutes - opStartMinutes) % step) === 0;
                const withinOperating = startMinutes >= opStartMinutes && endMinutes <= opEndMinutes;

                // Enforce duration allowance
                const durationAllowed = !facility.allowed_durations || facility.allowed_durations.includes(durationMinutes);

                if (!isAligned || !withinOperating || !durationAllowed) {
                  unavailableFacilities.add(facility.id);
                  return;
                }

                // Check for booking conflicts
                const hasBookingConflict = facilityBookings.some(booking => {
                  return booking.start_time < endTime && booking.end_time > startTime;
                });
                
                // Check for block conflicts
                const hasBlockConflict = facilityBlocks.some(blocked => {
                  if (blocked.start_time && blocked.end_time) {
                    return blocked.start_time < endTime && blocked.end_time > startTime;
                  }
                  return false;
                });

                if (hasBookingConflict || hasBlockConflict) {
                  unavailableFacilities.add(facility.id);
                }
              } else if (startTime) {
                // Only start time selected - show facilities that are AVAILABLE at this time
                // A facility is considered available if the selected time is NOT inside an existing booking/block
                const minDuration = facility.allowed_durations && facility.allowed_durations.length > 0 
                  ? Math.min(...facility.allowed_durations) 
                  : 60;
                
                const [startHour, startMinute] = startTime.split(':').map(Number);
                const startMinutes = startHour * 60 + startMinute;
                const checkEndMinutes = startMinutes + minDuration;
                const checkEndTime = `${Math.floor(checkEndMinutes / 60).toString().padStart(2, '0')}:${(checkEndMinutes % 60).toString().padStart(2, '0')}`;

                // Check if the selected time + minimum duration would overlap with any booking
                const hasBookingConflict = facilityBookings.some(booking => {
                  return booking.start_time < checkEndTime && booking.end_time > startTime;
                });
                
                // Check if the selected time + minimum duration would overlap with any block
                const hasBlockConflict = facilityBlocks.some(blocked => {
                  if (blocked.start_time && blocked.end_time) {
                    return blocked.start_time < checkEndTime && blocked.end_time > startTime;
                  }
                  return false;
                });

                // Only hide facility if there's a conflict - otherwise keep it visible
                if (hasBookingConflict || hasBlockConflict) {
                  unavailableFacilities.add(facility.id);
                }
              } else if (duration) {
                // Only duration selected - check if facility has ANY continuous time slot of this duration available
                const durationInMinutes = parseInt(duration);
                const opStart = facility.operating_hours_start || '08:00';
                const opEnd = facility.operating_hours_end || '22:00';
                
                const [startHour, startMin] = opStart.split(':').map(Number);
                const [endHour, endMin] = opEnd.split(':').map(Number);
                const operatingStartMinutes = startHour * 60 + startMin;
                const operatingEndMinutes = endHour * 60 + endMin;
                
                // Check every 30-minute slot to see if we can fit the duration
                let hasAvailableSlot = false;
                
                for (let checkStartMinutes = operatingStartMinutes; checkStartMinutes + durationInMinutes <= operatingEndMinutes; checkStartMinutes += 30) {
                  const checkStartTime = `${Math.floor(checkStartMinutes / 60).toString().padStart(2, '0')}:${(checkStartMinutes % 60).toString().padStart(2, '0')}`;
                  const checkEndMinutes = checkStartMinutes + durationInMinutes;
                  const checkEndTime = `${Math.floor(checkEndMinutes / 60).toString().padStart(2, '0')}:${(checkEndMinutes % 60).toString().padStart(2, '0')}`;
                  
                  // Check if this slot is free
                  const hasConflict = facilityBookings.some(booking => {
                    return booking.start_time < checkEndTime && booking.end_time > checkStartTime;
                  }) || facilityBlocks.some(blocked => {
                    if (blocked.start_time && blocked.end_time) {
                      return blocked.start_time < checkEndTime && blocked.end_time > checkStartTime;
                    }
                    return false;
                  });
                  
                  if (!hasConflict) {
                    hasAvailableSlot = true;
                    break;
                  }
                }
                
                if (!hasAvailableSlot) {
                  unavailableFacilities.add(facility.id);
                }
              }
            });
          } else {
            // Only date selected (no time/duration) - hide facilities that are completely blocked or fully booked
            filteredFacilities.forEach(facility => {
              const facilityBookings = bookings?.filter(b => b.facility_id === facility.id) || [];
              const facilityBlocks = blockedDates?.filter(b => b.facility_id === facility.id) || [];
              
              // Check if facility has full day block (no start_time or end_time means entire day)
              const hasFullDayBlock = facilityBlocks.some(blocked => !blocked.start_time || !blocked.end_time);
              
              if (hasFullDayBlock) {
                unavailableFacilities.add(facility.id);
                return;
              }
              
              // Check if facility is fully booked for the entire operating hours
              const opStart = facility.operating_hours_start || '08:00';
              const opEnd = facility.operating_hours_end || '22:00';
              const [startHour, startMin] = opStart.split(':').map(Number);
              const [endHour, endMin] = opEnd.split(':').map(Number);
              const operatingStartMinutes = startHour * 60 + startMin;
              const operatingEndMinutes = endHour * 60 + endMin;
              
              // Check every 30-minute slot to see if there's at least one available slot
              const minDuration = facility.allowed_durations && facility.allowed_durations.length > 0 
                ? Math.min(...facility.allowed_durations) 
                : 60;
              
              let hasAnyAvailableSlot = false;
              
              for (let checkStartMinutes = operatingStartMinutes; checkStartMinutes + minDuration <= operatingEndMinutes; checkStartMinutes += 30) {
                const checkStartTime = `${Math.floor(checkStartMinutes / 60).toString().padStart(2, '0')}:${(checkStartMinutes % 60).toString().padStart(2, '0')}`;
                const checkEndMinutes = checkStartMinutes + minDuration;
                const checkEndTime = `${Math.floor(checkEndMinutes / 60).toString().padStart(2, '0')}:${(checkEndMinutes % 60).toString().padStart(2, '0')}`;
                
                // Check if this slot is free
                const hasConflict = facilityBookings.some(booking => {
                  return booking.start_time < checkEndTime && booking.end_time > checkStartTime;
                }) || facilityBlocks.some(blocked => {
                  if (blocked.start_time && blocked.end_time) {
                    return blocked.start_time < checkEndTime && blocked.end_time > checkStartTime;
                  }
                  return false;
                });
                
                if (!hasConflict) {
                  hasAnyAvailableSlot = true;
                  break;
                }
              }
              
              // If no available slots found, hide this facility
              if (!hasAnyAvailableSlot) {
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
      case 'complex-az':
        return (a.sports_complex_name || 'Zzz').localeCompare(b.sports_complex_name || 'Zzz');
      case 'complex-za':
        return (b.sports_complex_name || 'Zzz').localeCompare(a.sports_complex_name || 'Zzz');
      case 'popular':
        return (b.booking_count || 0) - (a.booking_count || 0);
      default:
        return (a.price_per_hour || 0) - (b.price_per_hour || 0);
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
    
    // Calculate min and max operating hours from currently filtered facilities
    let minHour = 8;
    let minMinute = 0;
    let maxHour = 22;
    let maxMinute = 0;
    
    if (facilities.length > 0) {
      // Get earliest start time
      const earliestStart = facilities.reduce((earliest, facility) => {
        if (!facility.operating_hours_start) return earliest;
        const [hour, minute] = facility.operating_hours_start.split(':').map(Number);
        const totalMinutes = hour * 60 + minute;
        return totalMinutes < earliest ? totalMinutes : earliest;
      }, 24 * 60); // Start with max possible value
      
      // Get latest possible start time considering minimum booking duration
      const latestPossibleStart = facilities.reduce((latest, facility) => {
        if (!facility.operating_hours_end || !facility.allowed_durations || facility.allowed_durations.length === 0) return latest;
        const [hour, minute] = facility.operating_hours_end.split(':').map(Number);
        const endTimeInMinutes = hour * 60 + minute;
        // Get minimum booking duration for this facility
        const minDuration = Math.min(...facility.allowed_durations);
        // Subtract minimum booking duration to get latest valid start time
        const maxStartTime = endTimeInMinutes - minDuration;
        return maxStartTime > latest ? maxStartTime : latest;
      }, 0); // Start with min possible value
      
      if (earliestStart < 24 * 60) {
        minHour = Math.floor(earliestStart / 60);
        minMinute = earliestStart % 60;
      }
      
      if (latestPossibleStart > 0) {
        maxHour = Math.floor(latestPossibleStart / 60);
        maxMinute = latestPossibleStart % 60;
      }
    }
    
    // Generate time slots from min to max
    for (let hour = minHour; hour <= maxHour; hour++) {
      const startMinute = (hour === minHour) ? minMinute : 0;
      const endMinute = (hour === maxHour) ? maxMinute : 59;
      
      for (let minute = startMinute; minute <= endMinute; minute += 30) {
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
              {/* Reset and Sort buttons at the top */}
              <div className="flex flex-col md:flex-row md:flex-wrap gap-4 md:justify-between md:items-center mb-6 pb-4 border-b border-border">
                <Button 
                  variant="secondary" 
                  size="lg"
                  className="px-8 py-3 border-2 border-border bg-background text-foreground hover:bg-secondary hover:text-secondary-foreground mx-auto md:mx-0" 
                  onClick={() => {
                    setSearchTerm('');
                    setLocationFilter('');
                    setSelectedDate(undefined);
                    setStartTime('');
                    setDuration('');
                    setSelectedType(null);
                    setSortBy('price-low');
                  }}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Resetează Filtrele
                </Button>

                <div className="flex flex-col md:flex-row items-center gap-3 mx-auto md:mx-0">
                  <label className="text-sm font-medium text-foreground text-center">Sortează:</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-56 h-11 border-2 border-primary/20 bg-white">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Selectează sortarea" />
                    </SelectTrigger>
                    <SelectContent className="z-[1000] bg-background">
                      <SelectItem value="price-low">Preț: Crescător</SelectItem>
                      <SelectItem value="price-high">Preț: Descrescător</SelectItem>
                      <SelectItem value="complex-az">Bază sportivă: A-Z</SelectItem>
                      <SelectItem value="complex-za">Bază sportivă: Z-A</SelectItem>
                      <SelectItem value="popular">Cele mai populare</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* First Row: Search and Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Caută bază sportivă</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <Input 
                      placeholder="Caută nume bază sportivă" 
                      className="h-11 pl-10 bg-white border-2 border-primary/20 focus:border-primary shadow-sm"
                      value={searchTerm} 
                      onChange={(e) => {
                        const value = e.target.value;
                        setSearchTerm(value);
                        
                        // Filter sports complexes based on search term
                        if (value.trim()) {
                          const filtered = Array.from(
                            new Set(
                              allFacilities
                                .map(f => f.sports_complex_name)
                                .filter(name => 
                                  name && 
                                  name.toLowerCase().includes(value.toLowerCase())
                                )
                            )
                          ).sort();
                          setFilteredSportsComplexes(filtered);
                          setShowSportsComplexDropdown(filtered.length > 0);
                        } else {
                          const uniqueNames = Array.from(
                            new Set(
                              allFacilities
                                .map(f => f.sports_complex_name)
                                .filter(name => name && name.trim() !== '')
                            )
                          ).sort();
                          setFilteredSportsComplexes(uniqueNames);
                          setShowSportsComplexDropdown(false);
                        }
                      }}
                      onFocus={() => {
                        if (searchTerm.trim()) {
                          setShowSportsComplexDropdown(filteredSportsComplexes.length > 0);
                        }
                      }}
                      onBlur={() => {
                        // Delay closing to allow click on dropdown item
                        setTimeout(() => setShowSportsComplexDropdown(false), 200);
                      }}
                    />
                    
                    {/* Autocomplete Dropdown */}
                    {showSportsComplexDropdown && filteredSportsComplexes.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-background border-2 border-primary/20 rounded-lg shadow-lg z-[100] max-h-60 overflow-y-auto">
                        <ul className="py-2">
                          {filteredSportsComplexes.map((name, index) => (
                            <li 
                              key={index}
                              className="px-4 py-2 hover:bg-primary/10 cursor-pointer transition-colors text-foreground"
                              onClick={() => {
                                setSearchTerm(name);
                                setShowSportsComplexDropdown(false);
                              }}
                            >
                              {name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Oraș</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <Input 
                      placeholder="Caută oraș..." 
                      className="h-11 pl-10 bg-white border-2 border-primary/20 focus:border-primary shadow-sm"
                      value={locationFilter} 
                      onChange={(e) => {
                        const value = e.target.value;
                        setLocationFilter(value);
                        
                        // Filter cities based on search term
                        if (value.trim()) {
                          const filtered = Array.from(
                            new Set(
                              allFacilities
                                .map(f => f.city)
                                .filter(city => 
                                  city && 
                                  city.toLowerCase().includes(value.toLowerCase())
                                )
                            )
                          ).sort();
                          setFilteredCities(filtered);
                          setShowCityDropdown(filtered.length > 0);
                        } else {
                          const uniqueCities = Array.from(
                            new Set(
                              allFacilities
                                .map(f => f.city)
                                .filter(city => city && city.trim() !== '')
                            )
                          ).sort();
                          setFilteredCities(uniqueCities);
                          setShowCityDropdown(false);
                        }
                      }}
                      onFocus={() => {
                        if (locationFilter.trim()) {
                          setShowCityDropdown(filteredCities.length > 0);
                        }
                      }}
                      onBlur={() => {
                        // Delay closing to allow click on dropdown item
                        setTimeout(() => setShowCityDropdown(false), 200);
                      }}
                    />
                    
                    {/* City Autocomplete Dropdown */}
                    {showCityDropdown && filteredCities.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-background border-2 border-primary/20 rounded-lg shadow-lg z-[100] max-h-60 overflow-y-auto">
                        <ul className="py-2">
                          {filteredCities.map((city, index) => (
                            <li 
                              key={index}
                              className="px-4 py-2 hover:bg-primary/10 cursor-pointer transition-colors text-foreground"
                              onClick={() => {
                                setLocationFilter(city);
                                setShowCityDropdown(false);
                              }}
                            >
                              {city}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Second Row: Sport Type and Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Tip sport</label>
                  <Select value={selectedType || "all"} onValueChange={(value) => handleTypeFilter(value === "all" ? null : value)}>
                    <SelectTrigger className="h-11 bg-white border-2 border-primary/20 focus:border-primary shadow-sm">
                      <SelectValue placeholder="Toate sporturile" />
                    </SelectTrigger>
                    <SelectContent className="z-[1000] bg-background">
                      <SelectItem value="all">Toate sporturile</SelectItem>
                      <SelectItem value="football">Fotbal</SelectItem>
                      <SelectItem value="tennis">Tenis</SelectItem>
                      <SelectItem value="padel">Padel</SelectItem>
                      <SelectItem value="squash">Squash</SelectItem>
                      <SelectItem value="basketball">Baschet</SelectItem>
                      <SelectItem value="volleyball">Volei</SelectItem>
                      <SelectItem value="foot_tennis">Tenis de picior</SelectItem>
                      <SelectItem value="ping_pong">Ping Pong</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
                          // Prevent selecting fully blocked dates (extra safety)
                          if (date) {
                            const dateStr = format(date, 'yyyy-MM-dd');
                            if ((blockedDates as Set<string>).has(dateStr)) {
                              return; // ignore selection for fully blocked days
                            }
                          }
                          setSelectedDate(date || undefined);
                          // Clear time selections when date changes to avoid past time selections
                          if (date) {
                            const timeOptions: string[] = [];
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
              </div>

              {/* Third Row: Time and Duration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Ora de începere</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <Select value={startTime} onValueChange={setStartTime}>
                      <SelectTrigger className="h-11 pl-10 bg-white border-2 border-primary/20 focus:border-primary shadow-sm">
                        <SelectValue placeholder="Selectează ora" />
                      </SelectTrigger>
                      <SelectContent className="z-[1000] bg-background">
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
                    <SelectContent className="z-[1000] bg-background">
                      <SelectItem value="60">60 minute (1 oră)</SelectItem>
                      <SelectItem value="90">90 minute (1.5 ore)</SelectItem>
                      <SelectItem value="120">120 minute (2 ore)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Mobile only: Apply Filters button */}
              {isMobile && (
                <div className="mt-6 flex justify-center">
                  <Button 
                    size="lg"
                    className="w-full max-w-md px-8 py-6 text-lg font-semibold"
                    onClick={scrollToFacilities}
                  >
                    <ChevronDown className="h-5 w-5 mr-2" />
                    Aplică Filtrele
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Facilities Grid */}
        <div ref={facilitiesRef}>
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
                        <FacilityCardCarousel 
                          images={facility.images || []}
                          facilityName={facility.name}
                          facilityType={facility.facility_type}
                          className="w-full h-48 md:h-full rounded-l-lg md:rounded-l-lg md:rounded-r-none rounded-r-lg md:rounded-bl-lg" 
                        />
                    </div>
                    
                    <div className="md:w-2/3 p-6 flex flex-col flex-1">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          {/* Show sports complex name first with hover card */}
                          {facility.sports_complex_name && (
                            <FacilitySportsComplexHoverCard
                              sportsComplexName={facility.sports_complex_name}
                              sportsComplexAddress={facility.sports_complex_address}
                              sportsComplexDescription={facility.sports_complex_description}
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
                              <h3 className="text-xl font-bold text-foreground mb-1 cursor-pointer hover:text-primary transition-colors">
                                {facility.sports_complex_name}
                              </h3>
                            </FacilitySportsComplexHoverCard>
                          )}
                          <div className="text-sm font-medium text-muted-foreground mb-1">
                            {facility.name}
                          </div>
                            <div className="flex items-center text-muted-foreground text-sm mb-1">
                              <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                              <a
                                href={getMapsOpenUrl(facility.address || facility.sports_complex_address, facility.city)}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openExternal(getMapsOpenUrl(facility.address || facility.sports_complex_address, facility.city));
                                }}
                                className="text-left hover:text-primary hover:underline cursor-pointer transition-colors"
                              >
                                {facility.address || facility.sports_complex_address || `${facility.city}`}
                              </a>
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
                              <Link 
                                to={`/booking/${facility.id}${selectedDate ? `?date=${format(selectedDate, 'yyyy-MM-dd')}` : ''}`} 
                                className="text-center"
                              >
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
        </div>
      </main>
      
      <Footer />
    </div>;
};
export default FacilitiesPage;
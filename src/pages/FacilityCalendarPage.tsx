import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import GeneralScheduleCalendar from "@/components/admin/GeneralScheduleCalendar";

interface Facility {
  id: string;
  name: string;
  facility_type: string;
  description: string;
  price_per_hour: number;
  capacity: number;
  capacity_max?: number;
  images: string[];
  address: string;
  city: string;
  operating_hours_start?: string;
  operating_hours_end?: string;
}

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'pending';
  total_price: number;
  payment_method: string;
  notes?: string;
  client_id: string;
  facility_id: string;
  created_at: string;
  facility_name: string;
  facility_type: string;
  facility_city: string;
  client_name: string;
  client_email: string;
  stripe_session_id?: string;
}

interface BlockedDate {
  id: string;
  facility_id: string;
  blocked_date: string;
  start_time?: string;
  end_time?: string;
  reason?: string;
}

const FacilityCalendarPage = () => {
  const { facilityId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [allFacilities, setAllFacilities] = useState<Facility[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [allBlockedDates, setAllBlockedDates] = useState<BlockedDate[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Sport type color mapping
  const sportColors: Record<string, string> = {
    'football': 'bg-green-600',
    'tennis': 'bg-blue-600', 
    'basketball': 'bg-orange-600',
    'volleyball': 'bg-purple-600',
    'padel': 'bg-pink-600',
    'squash': 'bg-yellow-600',
    'swimming': 'bg-cyan-600',
    'ping_pong': 'bg-red-600',
    'badminton': 'bg-indigo-600',
    'handball': 'bg-emerald-600'
  };

  const handleBookingClick = (bookingId: string) => {
    const bookingElement = document.getElementById(`booking-${bookingId}`);
    if (bookingElement) {
      bookingElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      bookingElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
      setTimeout(() => {
        bookingElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
      }, 2000);
    }
  };

  // Load owner facilities for general calendar
  const loadAllFacilities = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate('/facility-owner-login');
        return;
      }

      const { data: facilitiesData, error } = await supabase
        .from('facilities')
        .select('*')
        .eq('owner_id', userData.user.id)
        .eq('is_active', true);

      if (error) {
        console.error('Error loading facilities:', error);
        toast({
          title: 'Eroare',
          description: 'Nu s-au putut încărca facilitățile.',
          variant: 'destructive'
        });
        return;
      }

      setAllFacilities(facilitiesData || []);
      
      // Load all bookings for all facilities
      if (facilitiesData && facilitiesData.length > 0) {
        const facilityIds = facilitiesData.map(f => f.id);
        
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select('*')
          .in('facility_id', facilityIds)
          .gte('booking_date', format(new Date(), 'yyyy-MM-dd'))
          .order('booking_date', { ascending: true })
          .order('start_time', { ascending: true });

        if (bookingsError) {
          console.error('Error loading bookings:', bookingsError);
        } else {
          // Transform bookings to match the expected interface
          const transformedBookings = await Promise.all(
            (bookingsData || []).map(async (booking) => {
              // Get facility details
              const facility = facilitiesData.find(f => f.id === booking.facility_id);
              
              // Get client details
              const { data: clientProfile } = await supabase
                .from('profiles')
                .select('full_name, email')
                .eq('user_id', booking.client_id)
                .single();

              return {
                ...booking,
                created_at: booking.created_at || new Date().toISOString(),
                facility_name: facility?.name || 'Necunoscut',
                facility_type: facility?.facility_type || 'unknown',
                facility_city: facility?.city || 'Necunoscut',
                client_name: clientProfile?.full_name || 'Necunoscut',
                client_email: clientProfile?.email || 'necunoscut@email.com'
              };
            })
          );
          setAllBookings(transformedBookings);
        }

        // Load all blocked dates
        const { data: blockedData, error: blockedError } = await supabase
          .from('blocked_dates')
          .select('*')
          .in('facility_id', facilityIds)
          .gte('blocked_date', format(new Date(), 'yyyy-MM-dd'));

        if (blockedError) {
          console.error('Error loading blocked dates:', blockedError);
        } else {
          setAllBlockedDates(blockedData || []);
        }
      }
    } catch (error) {
      console.error('Error in loadAllFacilities:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!facilityId) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/facility/login");
        return;
      }

      // Check user role for admin permissions
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      const userIsAdmin = profileData?.role === 'admin';
      setIsAdmin(userIsAdmin);

      // Load all facilities
      await loadAllFacilities();
      setIsLoading(false);
    };

    loadData();
  }, [facilityId, navigate, toast]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Se încarcă...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/manage-facilities" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" />
            Înapoi la terenurile mele
          </Link>
          
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Calendar General
              </h1>
              <div className="text-muted-foreground mt-2">
                Toate terenurile - {allFacilities.length} facilități
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Only General Calendar */}
        <GeneralScheduleCalendar 
          selectedDate={selectedDate}
          facilities={allFacilities}
          bookings={allBookings}
          blockedDates={allBlockedDates}
          onBookingClick={handleBookingClick}
          sportColors={sportColors}
        />
      </div>
    </div>
  );
};

export default FacilityCalendarPage;
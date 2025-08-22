import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Clock, Star, Filter, Search, LogIn, Plus, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ImageCarousel from "@/components/ImageCarousel";

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
}

interface UserProfile {
  role: 'client' | 'facility_owner' | 'admin';
}

const FacilitiesPage = () => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
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
    
    setSelectedType(typeParam);
    // TODO: Handle other search parameters (date, location, search) for filtering
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
          // Authenticated clients get limited data through the secure function
          const { data, error: rpcError } = await supabase
            .rpc('get_facilities_for_booking');
          allFacilities = data;
          error = rpcError;
        } else if (session && userProfile?.role === 'admin') {
          // Admins get full data
          const { data, error: rpcError } = await supabase
            .rpc('get_public_facilities');
          allFacilities = data;
          error = rpcError;
        } else {
          // Non-authenticated users get public facility data for browsing
          const { data, error: rpcError } = await supabase
            .rpc('get_facilities_for_public_browsing');
          allFacilities = data;
          error = rpcError;
        }

        if (error) {
          console.error('Error fetching facilities:', error);
          throw error;
        }

        // Apply client-side filtering if type is selected
        const data = selectedType 
          ? allFacilities?.filter(f => f.facility_type === selectedType)
          : allFacilities;

        setFacilities(data || []);
      } catch (error) {
        console.error('Error:', error);
        setFacilities([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFacilities();
  }, [selectedType, session, authChecked, userProfile, navigate]);

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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Caută facilități..." className="pl-10" />
                </div>
                
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Locație..." className="pl-10" />
                </div>
                
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input type="date" className="pl-10" />
                </div>
                
                <Button variant="sport" className="w-full">
                  <Filter className="h-4 w-4 mr-2" />
                  Filtrează
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
                           <div className="flex items-center text-muted-foreground text-sm">
                               <MapPin className="h-4 w-4 mr-1" />
                               {/* Show appropriate location info based on data structure */}
                               {facility.area_info || facility.general_area || 
                                (facility.address ? `${facility.address}, ${facility.city}` : `${facility.city} area`)
                               }
                             </div>
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
                             {/* For authenticated clients, show exact capacity */}
                             Capacitate: {
                               session && userProfile?.role === 'client' && facility.capacity ? 
                                 `${facility.capacity} persoane` :
                                 facility.capacity ? `${facility.capacity} persoane` :
                                 facility.capacity_info || 'Disponibil'
                             }
                           </span>
                         </div>
                       </div>
                      
                       <div className="flex justify-between items-center">
                         <div className="text-2xl font-bold text-primary">
                           {/* For authenticated clients, show exact pricing */}
                           {session && userProfile?.role === 'client' && facility.price_per_hour ? 
                             `${facility.price_per_hour} RON/oră` :
                             facility.price_per_hour ? `${facility.price_per_hour} RON/oră` : 
                             facility.price_range || facility.base_price_info || 'Preț disponibil la rezervare'}
                         </div>
                         {session ? (
                           <Button variant="sport" asChild>
                             <Link to={`/booking?facility=${facility.id}`}>
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
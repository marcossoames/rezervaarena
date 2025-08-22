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
  description: string;
  facility_type: string;
  address?: string; // For admin/owner view
  area_info?: string; // For client view - general area only
  city: string;
  price_per_hour?: number; // For admin/owner view
  base_price_info?: string; // For client view - generic pricing
  capacity?: number; // For admin/owner view
  capacity_info?: string; // For client view - generic capacity
  amenities: string[];
  images: string[];
  main_image_url?: string;
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
    // Get the type parameter from URL
    const typeParam = searchParams.get('type');
    setSelectedType(typeParam);
  }, [searchParams]);

  useEffect(() => {
    // Only fetch facilities if user is authenticated and profile is loaded
    if (!authChecked || !session || !userProfile) {
      if (authChecked && !session) {
        setLoading(false);
      }
      return;
    }

    const fetchFacilities = async () => {
      try {
        let allFacilities;
        let error;

        // Use different functions based on user role
        if (userProfile.role === 'client') {
          // Clients get limited data through the secure function
          const { data, error: rpcError } = await supabase
            .rpc('get_facilities_for_booking');
          allFacilities = data;
          error = rpcError;
        } else {
          // Admins and facility owners get full data
          const { data, error: rpcError } = await supabase
            .rpc('get_public_facilities');
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
  }, [selectedType, session, authChecked, userProfile]);

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

  // Show login prompt if user is not authenticated
  if (!session) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-card border border-border rounded-lg p-8">
              <LogIn className="h-16 w-16 text-primary mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-foreground mb-4">
                Autentificare Necesară
              </h1>
              <p className="text-muted-foreground mb-6">
                Pentru a vizualiza facilitățile sportive disponibile și a face rezervări, 
                trebuie să te autentifici în aplicație.
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={() => navigate('/client/login')} 
                  className="w-full" 
                  size="lg"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Autentifică-te
                </Button>
                <Button 
                  onClick={() => navigate('/client/register')} 
                  variant="outline" 
                  className="w-full" 
                  size="lg"
                >
                  Creează cont nou
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Această măsură protejează informațiile sensibile ale facilităților sportive.
              </p>
            </div>
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
          
          {/* Show management button for facility owners */}
          {userProfile?.role === 'facility_owner' && (
            <div className="flex gap-2">
              <Link to="/manage-facilities">
                <Button variant="outline" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Gestionează Facilitățile
                </Button>
              </Link>
              <Link to="/add-facility">
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Adaugă Facilitate
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Search and Filters */}
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
            </div>
          </CardContent>
        </Card>

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
                             {/* Show different location info based on user role for security */}
                             {userProfile?.role === 'client' 
                               ? facility.area_info || `${facility.city} area`
                               : `${facility.address}, ${facility.city}`
                             }
                           </div>
                        </div>
                      </div>
                      
                      {facility.description && (
                        <p className="text-sm text-muted-foreground mb-4">{facility.description}</p>
                      )}
                      
                      {facility.amenities && facility.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {facility.amenities.map((amenity) => (
                            <Badge key={amenity} variant="secondary" className="text-xs">
                              {amenity}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                       <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                        <div className="flex items-center">
                          <span className="text-muted-foreground">
                            Capacitate: {facility.capacity_info || facility.capacity}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <div className="text-2xl font-bold text-primary">
                          {facility.base_price_info || `${facility.price_per_hour} RON/oră`}
                        </div>
                        <Button variant="sport">
                          Rezervă Acum
                        </Button>
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
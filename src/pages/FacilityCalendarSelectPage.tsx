import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getFacilityTypeLabel } from "@/utils/facilityTypes";

interface Facility {
  id: string;
  name: string;
  facility_type: string;
  city: string;
  address: string;
  is_active: boolean;
}

const FacilityCalendarSelectPage = () => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadFacilities();
  }, []);

  const loadFacilities = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/facility/login');
        return;
      }

      // Get user profile to check role
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      setUserProfile(profile);

      let facilitiesQuery;
      
      if (profile?.role === 'admin') {
        // Admins can see all facilities
        facilitiesQuery = supabase
          .from('facilities')
          .select('id, name, facility_type, city, address, is_active')
          .eq('is_active', true)
          .order('name');
      } else {
        // Facility owners see only their facilities
        facilitiesQuery = supabase
          .from('facilities')
          .select('id, name, facility_type, city, address, is_active')
          .eq('owner_id', user.id)
          .eq('is_active', true)
          .order('name');
      }

      const { data: facilitiesData, error } = await facilitiesQuery;

      if (error) {
        throw error;
      }

      setFacilities(facilitiesData || []);
    } catch (error) {
      console.error('Error loading facilities:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca facilitățile",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacilitySelect = (facilityId: string) => {
    navigate(`/facility-calendar/${facilityId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg text-muted-foreground">Se încarcă facilitățile...</p>
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
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => {
              if (userProfile?.role === 'admin') {
                navigate('/admin-dashboard');
              } else {
                navigate('/facility-owner-profile');
              }
            }}
            className="mb-4 hover:border-primary border border-transparent"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Înapoi
          </Button>
          
          <h1 className="text-3xl font-bold text-foreground mb-2">Calendar Facilități</h1>
          <p className="text-muted-foreground">
            Selectează facilitatea pentru a vedea calendarul și a gestiona rezervările
          </p>
        </div>

        {facilities.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nu ai facilități active</h3>
              <p className="text-muted-foreground mb-6">
                Pentru a accesa calendarul, trebuie să ai cel puțin o facilitate activă.
              </p>
              <Button asChild>
                <a href="/manage-facilities">Gestionează Facilități</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {facilities.map((facility) => (
              <Card 
                key={facility.id} 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleFacilitySelect(facility.id)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {facility.name}
                  </CardTitle>
                  <CardDescription>
                    <div className="space-y-1">
                      <div>{getFacilityTypeLabel(facility.facility_type)}</div>
                      <div className="text-sm text-muted-foreground">
                        {facility.city} • {facility.address}
                      </div>
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">
                    <Calendar className="h-4 w-4 mr-2" />
                    Vezi Calendar
                  </Button>
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

export default FacilityCalendarSelectPage;
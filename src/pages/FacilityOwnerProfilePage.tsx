import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Calendar, Building2, Settings, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const FacilityOwnerProfilePage = () => {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/facility/login");
          return;
        }

        // Get user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (!profile) {
          toast({
            title: "Eroare",
            description: "Nu s-a putut încărca profilul",
            variant: "destructive"
          });
          navigate("/");
          return;
        }

        setUserProfile(profile);
      } catch (error) {
        console.error('Error loading profile:', error);
        toast({
          title: "Eroare",
          description: "A apărut o eroare la încărcarea profilului",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadUserProfile();
  }, []);

  const extractSportsComplexName = (userTypeComment: string) => {
    if (!userTypeComment) return "Baza Sportivă";
    
    // Remove system registration text
    let cleanName = userTypeComment
      .replace(' - înregistrat prin sistem', '')
      .replace(' - Proprietar bază sportivă', '')
      .replace('Proprietar bază sportivă - ', '');
    
    // If we end up with just "Proprietar bază sportivă" or similar, return default
    if (cleanName === 'Proprietar bază sportivă' || cleanName.trim() === '') {
      return "Baza Sportivă";
    }
    
    return cleanName;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-8">Încărcare...</div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-8">Nu s-a putut încărca profilul</div>
        </div>
        <Footer />
      </div>
    );
  }

  const sportsComplexName = extractSportsComplexName(userProfile.user_type_comment);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {sportsComplexName}
            </h1>
            <p className="text-lg text-gray-600">
              {userProfile.full_name}
            </p>
            <p className="text-sm text-gray-500">
              {userProfile.email}
            </p>
            {userProfile.phone && (
              <p className="text-sm text-gray-500">
                {userProfile.phone}
              </p>
            )}
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Rezervări */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer group" 
                  onClick={() => navigate("/my-reservations")}>
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200 transition-colors">
                  <Calendar className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-xl">Rezervări</CardTitle>
                <CardDescription>
                  Vezi toate rezervările pentru facilitățile tale
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  Vezi Rezervările
                </Button>
              </CardContent>
            </Card>

            {/* Terenuri */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer group" 
                  onClick={() => navigate("/manage-facilities")}>
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-green-200 transition-colors">
                  <Building2 className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-xl">Terenuri</CardTitle>
                <CardDescription>
                  Gestionează facilitățile și terenurile tale
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  Gestionează Terenurile
                </Button>
              </CardContent>
            </Card>

            {/* Setări Bază */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer group" 
                  onClick={() => navigate("/edit-sports-complex-settings")}>
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-purple-200 transition-colors">
                  <Settings className="h-8 w-8 text-purple-600" />
                </div>
                <CardTitle className="text-xl">Setări Bază</CardTitle>
                <CardDescription>
                  Editează informațiile generale ale bazei sportive
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  Editează Setările
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Informații Rapide</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-primary">0</div>
                  <div className="text-sm text-gray-600">Rezervări Astăzi</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">0</div>
                  <div className="text-sm text-gray-600">Rezervări Luna</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">0</div>
                  <div className="text-sm text-gray-600">Terenuri Active</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">⭐ 5.0</div>
                  <div className="text-sm text-gray-600">Rating Mediu</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default FacilityOwnerProfilePage;
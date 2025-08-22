import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Building2, Calendar, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import UserManagement from "@/components/UserManagement";

const AdminDashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'facilities' | 'bookings'>('dashboard');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalFacilities: 0,
    todayBookings: 0
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAccess();
    loadStats();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/admin/login');
        return;
      }

      // Check if user has admin role
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error || profile?.role !== 'admin') {
        toast({
          title: "Acces interzis",
          description: "Nu aveți permisiuni de administrator",
          variant: "destructive"
        });
        navigate('/admin/login');
        return;
      }

      setUserRole(profile.role);
      toast({
        title: "Bun venit!",
        description: "Bun venit în panoul de administrare.",
      });
    } catch (error) {
      console.error('Error checking admin access:', error);
      navigate('/admin/login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Deconectare reușită",
        description: "Ați fost deconectat din panoul de administrare",
      });
      navigate('/admin/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const loadStats = async () => {
    try {
      // Get total users
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get total facilities
      const { count: facilitiesCount } = await supabase
        .from('facilities')
        .select('*', { count: 'exact', head: true });

      // Get today's bookings
      const today = new Date().toISOString().split('T')[0];
      const { count: bookingsCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('booking_date', today);

      setStats({
        totalUsers: usersCount || 0,
        totalFacilities: facilitiesCount || 0,
        todayBookings: bookingsCount || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
          <p className="text-muted-foreground">Se verifică accesul...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">SportBook Admin</h1>
                <p className="text-sm text-muted-foreground">Panou de administrare</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Deconectare
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Bun venit în panoul de administrare</h2>
          <p className="text-muted-foreground">Gestionați platforma SportBook din acest panou central</p>
        </div>

        {/* Dashboard Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilizatori</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">Utilizatori înregistrați</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Facilități</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalFacilities}</div>
              <p className="text-xs text-muted-foreground">Facilități active</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rezervări</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todayBookings}</div>
              <p className="text-xs text-muted-foreground">Rezervări astăzi</p>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-4 mb-6">
          <Button 
            variant={activeTab === 'dashboard' ? 'default' : 'outline'} 
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </Button>
          <Button 
            variant={activeTab === 'users' ? 'default' : 'outline'} 
            onClick={() => setActiveTab('users')}
          >
            <Users className="h-4 w-4 mr-2" />
            Utilizatori
          </Button>
          <Button 
            variant={activeTab === 'facilities' ? 'default' : 'outline'} 
            onClick={() => setActiveTab('facilities')}
          >
            <Building2 className="h-4 w-4 mr-2" />
            Facilități
          </Button>
          <Button 
            variant={activeTab === 'bookings' ? 'default' : 'outline'} 
            onClick={() => setActiveTab('bookings')}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Rezervări
          </Button>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'dashboard' && (
          <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Acțiuni rapide</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button variant="outline" className="h-20 flex-col" onClick={() => setActiveTab('users')}>
                  <Users className="h-6 w-6 mb-2" />
                  Gestionare Utilizatori
                </Button>
                <Button variant="outline" className="h-20 flex-col" onClick={() => setActiveTab('facilities')}>
                  <Building2 className="h-6 w-6 mb-2" />
                  Gestionare Facilități
                </Button>
                <Button variant="outline" className="h-20 flex-col" onClick={() => setActiveTab('bookings')}>
                  <Calendar className="h-6 w-6 mb-2" />
                  Vizualizare Rezervări
                </Button>
                <Button variant="outline" className="h-20 flex-col">
                  <Shield className="h-6 w-6 mb-2" />
                  Setări Sistem
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'users' && <UserManagement />}
        
        {activeTab === 'facilities' && (
          <Card>
            <CardHeader>
              <CardTitle>Gestionare Facilități</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Funcționalitatea pentru gestionarea facilităților va fi adăugată în curând.</p>
            </CardContent>
          </Card>
        )}

        {activeTab === 'bookings' && (
          <Card>
            <CardHeader>
              <CardTitle>Vizualizare Rezervări</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Funcționalitatea pentru vizualizarea rezervărilor va fi adăugată în curând.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
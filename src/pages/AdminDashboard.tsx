import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Building2, Calendar, LogOut, Settings, DollarSign, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { secureSignOut } from "@/utils/authCleanup";
import { useToast } from "@/hooks/use-toast";
import UserManagement from "@/components/UserManagement";
import FacilityManagement from "@/components/admin/FacilityManagement";
import BookingManagement from "@/components/admin/BookingManagement";
import IncomeManagement from "@/components/admin/IncomeManagement";
import ArticleManagement from "@/components/admin/ArticleManagement";
import BankDetailsManagement from "@/components/admin/BankDetailsManagement";

const AdminDashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'facilities' | 'bookings' | 'income' | 'articles' | 'bank' | 'settings'>('dashboard');
  const [stats, setStats] = useState({
    totalUsers: 0,
    clients: 0,
    facilityOwners: 0,
    admins: 0,
    totalFacilities: 0,
    todayBookings: 0
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAccess();
    loadStats();
  }, []);

  useEffect(() => {
    // Reload stats when switching tabs to ensure fresh data
    loadStats();
  }, [activeTab]);

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
    await secureSignOut(supabase);
  };

  const loadStats = async () => {
    try {
      // Get all users with roles
      const { data: usersData } = await supabase
        .from('profiles')
        .select('role');

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

      // Calculate user stats by role
      const userStats = {
        totalUsers: usersData?.length || 0,
        clients: usersData?.filter(user => user.role === 'client').length || 0,
        facilityOwners: usersData?.filter(user => user.role === 'facility_owner').length || 0,
        admins: usersData?.filter(user => user.role === 'admin').length || 0,
        totalFacilities: facilitiesCount || 0,
        todayBookings: bookingsCount || 0
      };

      setStats(userStats);
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
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clienți</CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.clients}</div>
              <p className="text-xs text-muted-foreground">Utilizatori care fac rezervări</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Proprietari Terenuri</CardTitle>
              <Building2 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.facilityOwners}</div>
              <p className="text-xs text-muted-foreground">Proprietari de terenuri</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm border-l-4 border-l-red-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Administratori</CardTitle>
              <Shield className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.admins}</div>
              <p className="text-xs text-muted-foreground">Administratori platformei</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Utilizatori</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">Utilizatori înregistrați</p>
            </CardContent>
          </Card>
        </div>

        {/* Additional Stats Row */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Terenuri</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalFacilities}</div>
              <p className="text-xs text-muted-foreground">Terenuri active</p>
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

        {/* Navigation Tabs - 2 rows of 4 buttons */}
        <div className="mb-6 space-y-4">
          {/* First row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button 
              variant={activeTab === 'dashboard' ? 'default' : 'outline'} 
              onClick={() => setActiveTab('dashboard')}
              className="h-12 flex items-center justify-center"
            >
              Dashboard
            </Button>
            <Button 
              variant={activeTab === 'users' ? 'default' : 'outline'} 
              onClick={() => setActiveTab('users')}
              className="h-12 flex items-center justify-center"
            >
              <Users className="h-4 w-4 mr-2" />
              Utilizatori
            </Button>
            <Button 
              variant={activeTab === 'facilities' ? 'default' : 'outline'} 
              onClick={() => setActiveTab('facilities')}
              className="h-12 flex items-center justify-center"
            >
              <Building2 className="h-4 w-4 mr-2" />
              Terenuri
            </Button>
            <Button 
              variant={activeTab === 'bookings' ? 'default' : 'outline'} 
              onClick={() => setActiveTab('bookings')}
              className="h-12 flex items-center justify-center"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Rezervări
            </Button>
          </div>
          
          {/* Second row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button 
              variant={activeTab === 'income' ? 'default' : 'outline'} 
              onClick={() => setActiveTab('income')}
              className="h-12 flex items-center justify-center"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Încasări
            </Button>
            <Button 
              variant={activeTab === 'articles' ? 'default' : 'outline'} 
              onClick={() => setActiveTab('articles')}
              className="h-12 flex items-center justify-center"
            >
              <FileText className="h-4 w-4 mr-2" />
              Articole
            </Button>
            <Button 
              variant={activeTab === 'bank' ? 'default' : 'outline'} 
              onClick={() => setActiveTab('bank')}
              className="h-12 flex items-center justify-center"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Conturi Bancare
            </Button>
            <Button 
              variant={activeTab === 'settings' ? 'default' : 'outline'} 
              onClick={() => setActiveTab('settings')}
              className="h-12 flex items-center justify-center"
            >
              <Settings className="h-4 w-4 mr-2" />
              Setări Sistem
            </Button>
          </div>
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
                  Gestionare Terenuri
                </Button>
                <Button variant="outline" className="h-20 flex-col" onClick={() => setActiveTab('bookings')}>
                  <Calendar className="h-6 w-6 mb-2" />
                  Vizualizare Rezervări
                </Button>
                <Button variant="outline" className="h-20 flex-col" onClick={() => setActiveTab('income')}>
                  <DollarSign className="h-6 w-6 mb-2" />
                  Rapoarte Încasări
                </Button>
                <Button variant="outline" className="h-20 flex-col" onClick={() => setActiveTab('articles')}>
                  <FileText className="h-6 w-6 mb-2" />
                  Gestionare Articole
                </Button>
                <Button variant="outline" className="h-20 flex-col" onClick={() => setActiveTab('settings')}>
                  <Settings className="h-6 w-6 mb-2" />
                  Setări Sistem
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'users' && <UserManagement />}
        
        {activeTab === 'facilities' && <FacilityManagement />}

        {activeTab === 'bookings' && <BookingManagement />}

        {activeTab === 'income' && <IncomeManagement />}

        {activeTab === 'articles' && <ArticleManagement />}

        {activeTab === 'bank' && <BankDetailsManagement />}

        {activeTab === 'settings' && (
          <Card>
            <CardHeader>
              <CardTitle>Setări Sistem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Configurare Generală</h3>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nume Platformă</label>
                    <p className="text-sm text-muted-foreground">SportBook</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Versiune</label>
                    <p className="text-sm text-muted-foreground">1.0.0</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Statistici Securitate</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Politici RLS</span>
                      <span className="text-sm text-green-600">✓ Active</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Audit Logs</span>
                      <span className="text-sm text-green-600">✓ Active</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Acces Securizat</span>
                      <span className="text-sm text-green-600">✓ Activ</span>
                    </div>
                  </div>
                </div>
              </div>
              
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
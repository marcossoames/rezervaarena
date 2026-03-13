import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Building2, Calendar, LogOut, Settings, Coins, FileText, Landmark, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { secureSignOut } from "@/utils/authCleanup";
import { useToast } from "@/hooks/use-toast";
import UserManagement from "@/components/UserManagement";
import FacilityManagement from "@/components/admin/FacilityManagement";
import BookingManagement from "@/components/admin/BookingManagement";
import IncomeManagement from "@/components/admin/IncomeManagement";
import ArticleManagement from "@/components/admin/ArticleManagement";
import BankDetailsManagement from "@/components/admin/BankDetailsManagement";
import BankAuditLogs from "@/components/admin/BankAuditLogs";
import BankingActivityLogs from "@/components/admin/BankingActivityLogs";

const AdminDashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'facilities' | 'bookings' | 'income' | 'articles' | 'bank' | 'audit' | 'security' | 'settings'>('dashboard');
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
    loadStats();
  }, [activeTab]);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/admin/login');
        return;
      }

      
      const { data: userRoles, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'super_admin']);

      if (error || !userRoles || userRoles.length === 0) {
        toast({
          title: "Acces interzis",
          description: "Nu aveți permisiuni de administrator",
          variant: "destructive"
        });
        navigate('/admin/login');
        return;
      }

      
      const hasRole = userRoles.find(r => r.role === 'super_admin') ? 'super_admin' : 'admin';
      setUserRole(hasRole);
      
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
      
      const { data: allUsers } = await supabase
        .from('profiles')
        .select('user_id');

      // Get unique user IDs for each role (un user poate avea multiple roluri)
      const { data: clientRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'client');

      const { data: facilityOwnerRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'facility_owner');

      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'super_admin']);

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

      // Numără utilizatori unici pentru fiecare rol (elimină duplicatele)
      const uniqueClients = new Set(clientRoles?.map(r => r.user_id) || []);
      const uniqueFacilityOwners = new Set(facilityOwnerRoles?.map(r => r.user_id) || []);
      const uniqueAdmins = new Set(adminRoles?.map(r => r.user_id) || []);

      const userStats = {
        totalUsers: allUsers?.length || 0,
        clients: uniqueClients.size,
        facilityOwners: uniqueFacilityOwners.size,
        admins: uniqueAdmins.size,
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 overflow-x-hidden">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
              <Button 
                onClick={() => navigate("/")} 
                variant="outline" 
                size="sm"
                className="hidden sm:flex items-center gap-2 hover:bg-primary/5 border-2 border-primary/20 hover:border-primary hover:text-primary transition-all duration-200 shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                Înapoi la Home
              </Button>
              <Button 
                onClick={() => navigate("/")} 
                variant="outline" 
                size="sm"
                className="sm:hidden p-2 hover:bg-primary/5 border-2 border-primary/20 hover:border-primary hover:text-primary transition-all duration-200 shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="w-8 h-8 md:w-10 md:h-10 bg-primary rounded-full flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 md:w-6 md:h-6 text-primary-foreground" />
              </div>
              <div className="hidden sm:block min-w-0">
                <h1 className="text-base md:text-xl font-bold text-foreground truncate">RezervaArena Admin</h1>
                <p className="text-xs md:text-sm text-muted-foreground">Panou de administrare</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="shrink-0">
              <LogOut className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Deconectare</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 md:py-8 max-w-full overflow-x-hidden">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Bun venit în panoul de administrare</h2>
          <p className="text-muted-foreground">Gestionați platforma RezervaArena din acest panou central</p>
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

        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-foreground mb-2">Panou de Control</h3>
            <p className="text-muted-foreground">Selectați secțiunea pe care doriți să o administrați</p>
          </div>
          
          <div className="space-y-4">
            {/* First row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
              <Button 
                variant={activeTab === 'dashboard' ? 'default' : 'outline'} 
                onClick={() => setActiveTab('dashboard')}
                className="h-16 flex flex-col items-center justify-center gap-1 md:gap-2 text-xs md:text-sm font-medium px-2"
              >
                <Shield className="h-4 w-4 md:h-5 md:w-5" />
                <span className="text-center">Dashboard</span>
              </Button>
              <Button 
                variant={activeTab === 'users' ? 'default' : 'outline'} 
                onClick={() => setActiveTab('users')}
                className="h-16 flex flex-col items-center justify-center gap-1 md:gap-2 text-xs md:text-sm font-medium px-2"
              >
                <Users className="h-4 w-4 md:h-5 md:w-5" />
                <span className="text-center">Utilizatori</span>
              </Button>
              <Button 
                variant={activeTab === 'facilities' ? 'default' : 'outline'} 
                onClick={() => setActiveTab('facilities')}
                className="h-16 flex flex-col items-center justify-center gap-1 md:gap-2 text-xs md:text-sm font-medium px-2"
              >
                <Building2 className="h-4 w-4 md:h-5 md:w-5" />
                <span className="text-center">Terenuri</span>
              </Button>
              <Button 
                variant={activeTab === 'bookings' ? 'default' : 'outline'} 
                onClick={() => setActiveTab('bookings')}
                className="h-16 flex flex-col items-center justify-center gap-1 md:gap-2 text-xs md:text-sm font-medium px-2"
              >
                <Calendar className="h-4 w-4 md:h-5 md:w-5" />
                <span className="text-center">Rezervări</span>
              </Button>
            </div>
            
            {/* Second row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
              <Button 
                variant={activeTab === 'articles' ? 'default' : 'outline'} 
                onClick={() => setActiveTab('articles')}
                className="h-16 flex flex-col items-center justify-center gap-1 md:gap-2 text-xs md:text-sm font-medium px-2"
              >
                <FileText className="h-4 w-4 md:h-5 md:w-5" />
                <span className="text-center">Articole</span>
              </Button>
              <Button 
                variant={activeTab === 'income' ? 'default' : 'outline'} 
                onClick={() => setActiveTab('income')}
                className="h-16 flex flex-col items-center justify-center gap-1 md:gap-2 text-xs md:text-sm font-medium px-2"
              >
                <Coins className="h-4 w-4 md:h-5 md:w-5" />
                <span className="text-center">Încasări</span>
              </Button>
              <Button 
                variant={activeTab === 'bank' ? 'default' : 'outline'} 
                onClick={() => setActiveTab('bank')}
                className="h-16 flex flex-col items-center justify-center gap-1 md:gap-2 text-xs md:text-sm font-medium px-2"
              >
                <Landmark className="h-4 w-4 md:h-5 md:w-5" />
                <span className="text-center leading-tight">Conturi Bancare</span>
              </Button>
              <Button 
                variant={activeTab === 'audit' ? 'default' : 'outline'} 
                onClick={() => setActiveTab('audit')}
                className="h-16 flex flex-col items-center justify-center gap-1 md:gap-2 text-xs md:text-sm font-medium px-2"
              >
                <Shield className="h-4 w-4 md:h-5 md:w-5" />
                <span className="text-center leading-tight">Audit Logs</span>
              </Button>
            </div>
            
            {/* Third row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
              <Button 
                variant={activeTab === 'settings' ? 'default' : 'outline'} 
                onClick={() => setActiveTab('settings')}
                className="h-16 flex flex-col items-center justify-center gap-1 md:gap-2 text-xs md:text-sm font-medium px-2"
              >
                <Settings className="h-4 w-4 md:h-5 md:w-5" />
                <span className="text-center">Setări Sistem</span>
              </Button>
            </div>
          </div>
        </div>

        {activeTab === 'dashboard' && (
          <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Statistici Generale</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Vizualizați statisticile de mai sus pentru o privire de ansamblu asupra platformei RezervaArena.
                Selectați una din secțiunile de administrare pentru a gestiona aspectele specifice ale platformei.
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === 'users' && <UserManagement />}
        
        {activeTab === 'facilities' && <FacilityManagement />}

        {activeTab === 'bookings' && <BookingManagement />}

        {activeTab === 'income' && <IncomeManagement />}

        {activeTab === 'articles' && <ArticleManagement />}

        {activeTab === 'bank' && <BankDetailsManagement />}

        {activeTab === 'audit' && (
          <div className="space-y-6">
            <BankAuditLogs />
            <BankingActivityLogs />
          </div>
        )}

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
                    <p className="text-sm text-muted-foreground">RezervaArena</p>
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
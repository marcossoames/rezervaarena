import { Button } from "@/components/ui/button";
import { User, Building2, Shield, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { secureSignOut } from "@/utils/authCleanup";
import { useToast } from "@/hooks/use-toast";

const Header = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
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
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (!error) {
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await secureSignOut(supabase);
    } catch (error) {
      toast({
        title: "Eroare la deconectare",
        description: "A apărut o problemă la deconectare.",
        variant: "destructive"
      });
    }
  };

  const handleClientClick = () => {
    if (session) {
      if (userProfile?.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (userProfile?.user_type_comment?.includes('Proprietar bază sportivă')) {
        navigate('/facility-owner-profile');
      } else {
        navigate('/client-profile');
      }
    } else {
      navigate('/client/login');
    }
  };

  return (
    <header className="bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
      <div className="w-full max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left side - Admin button and Logo */}
          <div className="flex items-center gap-6">
            {/* Admin button - moved to far left, only show when not logged in */}
            {!session && (
              <Link to="/admin/login">
                <Button variant="premium" size="sm" className="shrink-0">
                  <Shield className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              </Link>
            )}
            
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2 shrink-0">
              <div className="w-8 h-8 bg-gradient-hero rounded-md flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">S</span>
              </div>
              <h1 className="text-xl font-bold text-foreground">SportBook</h1>
            </Link>
          </div>
          
          {/* Center - Navigation */}
          <nav className="hidden lg:flex items-center space-x-6">
            <Link to="/facilities" className="text-sm font-medium text-muted-foreground hover:text-primary transition-smooth relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left px-2 py-1">
              Terenuri
            </Link>
            <Link to="/about" className="text-sm font-medium text-muted-foreground hover:text-primary transition-smooth relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left px-2 py-1">
              Despre noi
            </Link>
            <Link to="/contact" className="text-sm font-medium text-muted-foreground hover:text-primary transition-smooth relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left px-2 py-1">
              Contact
            </Link>
            <Link to="/articles" className="text-sm font-medium text-muted-foreground hover:text-primary transition-smooth relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left px-2 py-1">
              Articole
            </Link>
          </nav>

          {/* Right side - User actions */}
          <div className="flex items-center gap-2">
            {session ? (
              <>
                <Button onClick={handleClientClick} variant="ghost" size="sm" className="shrink-0">
                  <User className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">
                    {userProfile?.role === 'admin' ? 'Dashboard' : 
                     userProfile?.user_type_comment?.includes('Proprietar bază sportivă') ? 'Profil' : 'Profilul Meu'}
                  </span>
                </Button>
                <Button onClick={handleSignOut} variant="outline" size="sm" className="shrink-0">
                  <LogOut className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Deconectare</span>
                </Button>
              </>
            ) : (
              <>
                <Button onClick={handleClientClick} variant="ghost" size="sm" className="shrink-0">
                  <User className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Client</span>
                </Button>
                <Link to="/facility/login">
                  <Button variant="outline" size="sm" className="shrink-0">
                    <Building2 className="h-4 w-4 sm:mr-2" />
                    <span className="hidden md:inline">Bază Sportivă</span>
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
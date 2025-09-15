import { Button } from "@/components/ui/button";
import { User, Building2, Shield, LogOut, Menu, X } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { secureSignOut } from "@/utils/authCleanup";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

const Header = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Helper function to check if current route is active
  const isActiveRoute = (path: string) => {
    return location.pathname === path;
  };

  // Helper function to get navigation link classes with active state
  const getNavLinkClasses = (path: string) => {
    const baseClasses = "text-base font-medium transition-smooth relative after:content-[''] after:absolute after:w-full after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 px-2 py-1";
    
    if (isActiveRoute(path)) {
      return `${baseClasses} text-primary font-bold after:scale-x-100`;
    } else {
      return `${baseClasses} text-muted-foreground hover:text-primary after:scale-x-0 hover:after:scale-x-100 hover:after:origin-bottom-left`;
    }
  };

  // Helper function for mobile navigation classes
  const getMobileNavClasses = (path: string) => {
    const baseClasses = "block text-base font-medium py-2 px-2 rounded-md transition-smooth";
    
    if (isActiveRoute(path)) {
      return `${baseClasses} text-primary font-bold bg-secondary`;
    } else {
      return `${baseClasses} text-muted-foreground hover:text-primary hover:bg-secondary`;
    }
  };

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
      // Store current location before redirecting to login
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname + window.location.search);
      navigate('/client/login');
    }
  };

  return (
    <header className="bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center justify-between">
          {/* Left side - Logo */}
          <Link to="/" className="flex items-center space-x-1 sm:space-x-2 shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md flex items-center justify-center overflow-hidden">
              <img src="/logo-rezervaarena.png" alt="RezervaArena" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground">RezervaArena</h1>
          </Link>
          
          {/* Center - Navigation Desktop */}
          <nav className="hidden md:flex items-center justify-center space-x-8 flex-1">
            <Link to="/facilities" className={getNavLinkClasses("/facilities")}>
              Terenuri
            </Link>
            <Link to="/about" className={getNavLinkClasses("/about")}>
              Despre noi
            </Link>
            <Link to="/contact" className={getNavLinkClasses("/contact")}>
              Contact
            </Link>
            <Link to="/articles" className={getNavLinkClasses("/articles")}>
              Articole
            </Link>
          </nav>

          {/* Center - Mobile Menu Button */}
          <div className="flex-1 flex justify-center md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="px-2"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>

          {/* Right side - User actions */}
          <div className={`flex items-center ${isMobile ? 'space-x-1' : 'space-x-3'} shrink-0`}>
            {session ? (
              <>
                <Button onClick={handleClientClick} variant="ghost" size={isMobile ? "sm" : "sm"} className={isMobile ? "px-2" : ""}>
                  <User className="h-4 w-4" />
                  {!isMobile && (userProfile?.role === 'admin' ? 'Dashboard' : 
                   userProfile?.user_type_comment?.includes('Proprietar bază sportivă') ? 'Profil' : 'Profilul Meu')}
                </Button>
                <Button onClick={handleSignOut} variant="outline" size={isMobile ? "sm" : "sm"} className={isMobile ? "px-2" : ""}>
                  <LogOut className="h-4 w-4" />
                  {!isMobile && "Deconectare"}
                </Button>
              </>
            ) : (
              <>
                <Button onClick={handleClientClick} variant="ghost" size={isMobile ? "sm" : "sm"} className={isMobile ? "px-2" : ""}>
                  <User className="h-4 w-4" />
                  {!isMobile && "Client"}
                </Button>
                <Link to="/facility/login">
                  <Button variant="outline" size={isMobile ? "sm" : "sm"} className={isMobile ? "px-2" : ""}>
                    <Building2 className="h-4 w-4" />
                    {!isMobile && "Bază Sportivă"}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
        
        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-card border-b border-border shadow-lg z-50">
            <nav className="px-4 py-3 space-y-2">
              <Link 
                to="/facilities" 
                className={getMobileNavClasses("/facilities")}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Terenuri
              </Link>
              <Link 
                to="/about" 
                className={getMobileNavClasses("/about")}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Despre noi
              </Link>
              <Link 
                to="/contact" 
                className={getMobileNavClasses("/contact")}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Contact
              </Link>
              <Link 
                to="/articles" 
                className={getMobileNavClasses("/articles")}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Articole
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
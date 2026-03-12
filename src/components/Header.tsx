import { Button } from "@/components/ui/button";
import { User, Building2, Shield, LogOut, Menu, X } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { secureSignOut } from "@/utils/authCleanup";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNativeNotifications } from "@/hooks/useNativeNotifications";

const Header = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const headerRef = useRef<HTMLElement | null>(null);
  
  // Setup native notifications
  useNativeNotifications();

  useEffect(() => {
    document.documentElement.classList.remove('has-header');
    document.documentElement.style.removeProperty('--header-height');
  }, []);

  const isActiveRoute = (path: string) => {
    return location.pathname === path;
  };

  const getNavLinkClasses = (path: string) => {
    const baseClasses = "text-base font-medium transition-smooth relative after:content-[''] after:absolute after:w-full after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 px-2 py-1";
    
    if (isActiveRoute(path)) {
      return `${baseClasses} text-primary font-bold after:scale-x-100`;
    } else {
      return `${baseClasses} text-muted-foreground hover:text-primary after:scale-x-0 hover:after:scale-x-100 hover:after:origin-bottom-left`;
    }
  };

  const getMobileNavClasses = (path: string) => {
    const baseClasses = "block text-base font-medium py-2 px-2 rounded-md transition-smooth";
    
    if (isActiveRoute(path)) {
      return `${baseClasses} text-primary font-bold bg-secondary`;
    } else {
      return `${baseClasses} text-muted-foreground hover:text-primary hover:bg-secondary`;
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      }
    });

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
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (data) {
        setUserProfile(data);
        const hasValidPhone = data.phone && data.phone !== 'Telefon necompletat' && data.phone.trim() !== '';
        const onCompleteProfile = location.pathname === '/complete-profile';
        const onAuthRedirect = location.pathname.startsWith('/auth-redirect') || location.pathname.startsWith('/auth/');
        if (!hasValidPhone && !onCompleteProfile && !onAuthRedirect) {
          navigate('/complete-profile', { replace: true });
        }
      } else {
        const onCompleteProfile = location.pathname === '/complete-profile';
        const onAuthRedirect = location.pathname.startsWith('/auth-redirect') || location.pathname.startsWith('/auth/');
        if (!onCompleteProfile && !onAuthRedirect) {
          navigate('/complete-profile', { replace: true });
        }
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
    <>
      {/* iOS overlay to cover the safe area during overscroll */}
      <div className="pointer-events-none fixed top-0 left-0 right-0 h-[env(safe-area-inset-top)] bg-card z-[60]" />
      <header ref={headerRef} className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-b border-border/50 pt-[env(safe-area-inset-top)]">
        <div className="relative w-full py-3 px-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        {/* Full width flex container */}
        <div className="flex items-center justify-between w-full px-4 sm:px-6 lg:px-8">
          {/* Left side - Logo */}
          <div className="flex items-center space-x-1 sm:space-x-2">
            <Link to="/" className="flex items-center space-x-1 sm:space-x-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md flex items-center justify-center overflow-hidden bg-card">
                <img src="/logo-rezervaarena.png" alt="RezervaArena" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground">RezervaArena</h1>
            </Link>
          </div>

          {/* Right side - User actions */}
          <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-3'}`}>
            {/* Mobile menu toggle button */}
            {isMobile && (
              <Button 
                onClick={(e) => {
                  setIsMobileMenuOpen(!isMobileMenuOpen);
                  e.currentTarget.blur(); // Remove focus immediately
                }} 
                variant="ghost" 
                size="sm" 
                className="px-2 text-foreground hover:text-primary hover:bg-secondary/50 focus:outline-none focus:bg-transparent active:bg-transparent"
              >
                {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            )}
            
            {session ? (
              <>
                <Button onClick={handleClientClick} variant="ghost" size={isMobile ? "sm" : "sm"} className={isMobile ? "px-2" : ""}>
                  <User className="h-4 w-4" />
                  {!isMobile && (userProfile?.role === 'admin' ? 'Dashboard' : 'Profil')}
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

        {/* Absolutely centered navigation - hidden on mobile */}
        <nav className="hidden md:flex absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 items-center gap-4 lg:gap-8">
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

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <>
            {/* Overlay to close menu when clicking outside */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="md:hidden absolute top-full left-0 right-0 bg-card/95 backdrop-blur-sm border-b border-border shadow-lg z-[55] animate-slide-down">
              <nav className="px-4 py-3 space-y-2 text-center">
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
          </>
        )}
      </div>
    </header>
      {/* Fallback overlay for older iOS browsers where sticky may reveal white bounce */}
      <div className="pointer-events-none fixed top-0 left-0 right-0 h-[env(safe-area-inset-top)] bg-card z-[40]" />
    </>
  );
};

export default Header;

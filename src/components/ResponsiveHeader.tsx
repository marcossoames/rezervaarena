import { Button } from "@/components/ui/button";
import { User, Building2, Shield, LogOut, Menu, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { secureSignOut } from "@/utils/authCleanup";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

const ResponsiveHeader = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [session, setSession] = useState<Session | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    role: string;
    display_name?: string;
    user_type_comment?: string;
  } | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    const fetchUserProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single();
        
        if (!error) {
          setUserProfile(data);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, [session]);

  const handleSignOut = useCallback(async () => {
    try {
      await secureSignOut(supabase);
    } catch (error) {
      toast({
        title: "Eroare la deconectare",
        description: "A apărut o problemă la deconectare.",
        variant: "destructive"
      });
    }
  }, [toast]);

  const handleClientClick = useCallback(() => {
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
  }, [session, userProfile, navigate]);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen(prev => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  return (
    <header className="bg-card/90 backdrop-blur-md border-b border-border sticky top-0 z-50 optimize-rendering">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Logo - optimized for all screen sizes */}
          <Link to="/" className="flex items-center space-x-2 shrink-0 touch-target">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-hero rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground font-bold text-lg sm:text-xl">S</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">SportBook</h1>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center justify-center space-x-8 flex-1">
            <Link 
              to="/facilities" 
              className="relative text-base font-medium text-muted-foreground hover:text-primary transition-all duration-300 px-3 py-2 rounded-md hover:bg-secondary/50 after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left"
            >
              Terenuri
            </Link>
            <Link 
              to="/about" 
              className="relative text-base font-medium text-muted-foreground hover:text-primary transition-all duration-300 px-3 py-2 rounded-md hover:bg-secondary/50 after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left"
            >
              Despre noi
            </Link>
            <Link 
              to="/contact" 
              className="relative text-base font-medium text-muted-foreground hover:text-primary transition-all duration-300 px-3 py-2 rounded-md hover:bg-secondary/50 after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left"
            >
              Contact
            </Link>
            <Link 
              to="/articles" 
              className="relative text-base font-medium text-muted-foreground hover:text-primary transition-all duration-300 px-3 py-2 rounded-md hover:bg-secondary/50 after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left"
            >
              Articole
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex-1 flex justify-center lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMenu}
              className="px-3 py-2 touch-target"
              aria-label={isMenuOpen ? "Închide meniul" : "Deschide meniul"}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>

          {/* User Actions - responsive */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {session ? (
              <>
                <Button 
                  onClick={handleClientClick} 
                  variant="ghost" 
                  size="sm" 
                  className="touch-target px-2 sm:px-3"
                >
                  <User className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline-block ml-2">
                    {userProfile?.role === 'admin' ? 'Dashboard' : 
                     userProfile?.user_type_comment?.includes('Proprietar bază sportivă') ? 'Profil' : 'Profilul Meu'}
                  </span>
                </Button>
                <Button 
                  onClick={handleSignOut} 
                  variant="outline" 
                  size="sm" 
                  className="touch-target px-2 sm:px-3"
                >
                  <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline-block ml-2">Deconectare</span>
                </Button>
              </>
            ) : (
              <>
                <Button 
                  onClick={handleClientClick} 
                  variant="ghost" 
                  size="sm" 
                  className="touch-target px-2 sm:px-3"
                >
                  <User className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline-block ml-2">Client</span>
                </Button>
                <Link to="/facility/login">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="touch-target px-2 sm:px-3"
                  >
                    <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="hidden md:inline-block ml-2">Bază Sportivă</span>
                  </Button>
                </Link>
                <Link to="/admin/login">
                  <Button 
                    variant="premium" 
                    size="sm" 
                    className="touch-target px-2 sm:px-3"
                  >
                    <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="hidden lg:inline-block ml-2">Admin</span>
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
        
        {/* Mobile Navigation Menu - optimized for touch */}
        {isMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 bg-card/95 backdrop-blur-md border-b border-border shadow-xl z-50 optimize-rendering">
            <nav className="px-4 py-4 space-y-1">
              <Link 
                to="/facilities" 
                className="mobile-nav-item block text-base font-medium text-muted-foreground hover:text-primary hover:bg-secondary/80"
                onClick={closeMenu}
              >
                Terenuri
              </Link>
              <Link 
                to="/about" 
                className="mobile-nav-item block text-base font-medium text-muted-foreground hover:text-primary hover:bg-secondary/80"
                onClick={closeMenu}
              >
                Despre noi
              </Link>
              <Link 
                to="/contact" 
                className="mobile-nav-item block text-base font-medium text-muted-foreground hover:text-primary hover:bg-secondary/80"
                onClick={closeMenu}
              >
                Contact
              </Link>
              <Link 
                to="/articles" 
                className="mobile-nav-item block text-base font-medium text-muted-foreground hover:text-primary hover:bg-secondary/80"
                onClick={closeMenu}
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

export default ResponsiveHeader;
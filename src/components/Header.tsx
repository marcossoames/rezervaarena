import { Button } from "@/components/ui/button";
import { User, Building2, Shield, LogOut, Menu, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { secureSignOut } from "@/utils/authCleanup";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

const Header = () => {
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
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-hero rounded-md flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm sm:text-lg">S</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground">SportBook</h1>
          </Link>
          
          {/* Center - Navigation Desktop */}
          <nav className="hidden md:flex items-center justify-center space-x-8 flex-1">
            <Link to="/facilities" className="text-base font-medium text-muted-foreground hover:text-primary transition-smooth relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left px-2 py-1">
              Terenuri
            </Link>
            <Link to="/about" className="text-base font-medium text-muted-foreground hover:text-primary transition-smooth relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left px-2 py-1">
              Despre noi
            </Link>
            <Link to="/contact" className="text-base font-medium text-muted-foreground hover:text-primary transition-smooth relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left px-2 py-1">
              Contact
            </Link>
            <Link to="/articles" className="text-base font-medium text-muted-foreground hover:text-primary transition-smooth relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left px-2 py-1">
              Articole
            </Link>
          </nav>

          {/* Center - Mobile Menu Button */}
          <div className="flex-1 flex justify-center md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="px-2"
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
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
                <Link to="/admin/login">
                  <Button variant="premium" size={isMobile ? "sm" : "sm"} className={isMobile ? "px-2" : ""}>
                    <Shield className="h-4 w-4" />
                    {!isMobile && "Admin"}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
        
        {/* Mobile Navigation Menu */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-card border-b border-border shadow-lg z-50">
            <nav className="px-4 py-3 space-y-2">
              <Link 
                to="/facilities" 
                className="block text-base font-medium text-muted-foreground hover:text-primary py-2 px-2 rounded-md hover:bg-secondary transition-smooth"
                onClick={() => setIsMenuOpen(false)}
              >
                Terenuri
              </Link>
              <Link 
                to="/about" 
                className="block text-base font-medium text-muted-foreground hover:text-primary py-2 px-2 rounded-md hover:bg-secondary transition-smooth"
                onClick={() => setIsMenuOpen(false)}
              >
                Despre noi
              </Link>
              <Link 
                to="/contact" 
                className="block text-base font-medium text-muted-foreground hover:text-primary py-2 px-2 rounded-md hover:bg-secondary transition-smooth"
                onClick={() => setIsMenuOpen(false)}
              >
                Contact
              </Link>
              <Link 
                to="/articles" 
                className="block text-base font-medium text-muted-foreground hover:text-primary py-2 px-2 rounded-md hover:bg-secondary transition-smooth"
                onClick={() => setIsMenuOpen(false)}
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
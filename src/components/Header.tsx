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
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

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
      navigate('/my-reservations');
    } else {
      navigate('/client/login');
    }
  };

  return (
    <header className="bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-hero rounded-md flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">S</span>
            </div>
            <h1 className="text-xl font-bold text-foreground">SportBook</h1>
          </Link>
          
          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/facilities" className="text-base font-medium text-muted-foreground hover:text-primary transition-smooth relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">
              Terenuri
            </Link>
            <Link to="/about" className="text-base font-medium text-muted-foreground hover:text-primary transition-smooth relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">
              Despre noi
            </Link>
            <Link to="/contact" className="text-base font-medium text-muted-foreground hover:text-primary transition-smooth relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">
              Contact
            </Link>
          </nav>

          <div className="flex items-center space-x-3">
            {session ? (
              <>
                <Button onClick={handleClientClick} variant="ghost" size="sm">
                  <User className="h-4 w-4" />
                  Profilul Meu
                </Button>
                <Button onClick={handleSignOut} variant="outline" size="sm">
                  <LogOut className="h-4 w-4" />
                  Deconectare
                </Button>
              </>
            ) : (
              <>
                <Button onClick={handleClientClick} variant="ghost" size="sm">
                  <User className="h-4 w-4" />
                  Client
                </Button>
                <Link to="/facility/login">
                  <Button variant="outline" size="sm">
                    <Building2 className="h-4 w-4" />
                    Bază Sportivă
                  </Button>
                </Link>
                <Link to="/admin/login">
                  <Button variant="premium" size="sm">
                    <Shield className="h-4 w-4" />
                    Admin
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
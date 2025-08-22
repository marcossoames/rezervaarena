import { Button } from "@/components/ui/button";
import { User, Building2, Shield } from "lucide-react";
import { Link } from "react-router-dom";

const Header = () => {
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
          
          <nav className="hidden md:flex items-center space-x-6">
            <Link to="/facilities" className="text-muted-foreground hover:text-primary transition-smooth">
              Terenuri
            </Link>
            <Link to="/about" className="text-muted-foreground hover:text-primary transition-smooth">
              Despre noi
            </Link>
            <Link to="/contact" className="text-muted-foreground hover:text-primary transition-smooth">
              Contact
            </Link>
          </nav>

          <div className="flex items-center space-x-3">
            <Link to="/client/login">
              <Button variant="ghost" size="sm">
                <User className="h-4 w-4" />
                Client
              </Button>
            </Link>
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
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
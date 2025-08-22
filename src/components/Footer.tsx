import { Button } from "@/components/ui/button";
import { Facebook, Instagram, Twitter, Mail, Phone, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
const Footer = () => {
  return <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-6">
              <div className="w-8 h-8 bg-gradient-hero rounded-md flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">S</span>
              </div>
              <h3 className="text-xl font-bold text-foreground">SportBook</h3>
            </div>
            <p className="text-muted-foreground mb-6">
              Platforma numărul 1 din România pentru rezervarea terenurilor sportive. 
              Conectăm pasionații de sport cu cele mai bune facilități.
            </p>
            
          </div>

          <div>
            <h4 className="text-lg font-semibold text-foreground mb-6">Pentru Clienți</h4>
            <ul className="space-y-3">
              <li><Link to="/facilities" className="text-muted-foreground hover:text-primary transition-smooth">Caută Terenuri</Link></li>
              <li><Link to="/booking" className="text-muted-foreground hover:text-primary transition-smooth">Rezervările Mele</Link></li>
              <li><Link to="/client-register" className="text-muted-foreground hover:text-primary transition-smooth">Profil</Link></li>
              <li><Link to="/about" className="text-muted-foreground hover:text-primary transition-smooth">Ajutor</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-foreground mb-6">Pentru Baze Sportive</h4>
            <ul className="space-y-3">
              <li><Link to="/facility-register" className="text-muted-foreground hover:text-primary transition-smooth">Înregistrează Baza</Link></li>
              <li><Link to="/admin-dashboard" className="text-muted-foreground hover:text-primary transition-smooth">Dashboard</Link></li>
              <li><Link to="/booking" className="text-muted-foreground hover:text-primary transition-smooth">Gestionare Rezervări</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-foreground mb-6">Contact</h4>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-primary" />
                <a href="mailto:soamespaul@gmail.com" className="text-muted-foreground hover:text-primary transition-smooth">
                  soamespaul@gmail.com
                </a>
              </div>
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-primary" />
                <a href="tel:+40720059535" className="text-muted-foreground hover:text-primary transition-smooth">
                  +40720059535
                </a>
              </div>
              <div className="flex items-center space-x-3">
                <MapPin className="h-5 w-5 text-primary" />
                <a href="https://maps.google.com/?q=Str.+Magnoliei+nr.+21+Timisoara,+Timis" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-smooth">
                  Str. Magnoliei nr. 21, Timișoara
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-muted-foreground text-sm">© 2025 SportBook. Toate drepturile rezervate.</p>
            
          </div>
        </div>
      </div>
    </footer>;
};
export default Footer;
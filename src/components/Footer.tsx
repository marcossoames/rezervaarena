import { Button } from "@/components/ui/button";
import { Facebook, Instagram, Twitter, Mail, Phone, MapPin } from "lucide-react";
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
              <li><a href="#" className="text-muted-foreground hover:text-primary transition-smooth">Caută Terenuri</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-primary transition-smooth">Rezervările Mele</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-primary transition-smooth">Profil</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-primary transition-smooth">Ajutor</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-foreground mb-6">Pentru Baze Sportive</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-muted-foreground hover:text-primary transition-smooth">Înregistrează Baza</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-primary transition-smooth">Dashboard</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-primary transition-smooth">Gestionare Rezervări</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-primary transition-smooth">Statistici</a></li>
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
                <a 
                  href="https://maps.google.com/?q=Str.+Magnoliei+nr.+21+Timisoara,+Timis" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-smooth"
                >
                  Str. Magnoliei nr. 21, Timișoara
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-muted-foreground text-sm">
              © 2024 SportBook. Toate drepturile rezervate.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-muted-foreground hover:text-primary text-sm transition-smooth">
                Termeni și Condiții
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary text-sm transition-smooth">
                Politica de Confidențialitate
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary text-sm transition-smooth">
                GDPR
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>;
};
export default Footer;
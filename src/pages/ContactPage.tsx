import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Phone, MapPin, Clock } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
const ContactPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const {
    toast
  } = useToast();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate form submission
    setTimeout(() => {
      toast({
        title: "Mesaj trimis cu succes!",
        description: "Vă vom răspunde în cel mai scurt timp posibil."
      });
      setIsLoading(false);
    }, 1000);
  };
  return <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Header />
      
      <main className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Contact
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Avem întrebări? Suntem aici să vă ajutăm! Contactați-ne prin oricare dintre metodele de mai jos.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Contact Information */}
          <div className="space-y-8">
            <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl">Informații de contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">Email</h3>
                    <p className="text-muted-foreground">contact@sportbook.ro</p>
                    <p className="text-muted-foreground">support@sportbook.ro</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-medium">Telefon</h3>
                    <p className="text-muted-foreground">+40 721 234 567</p>
                    <p className="text-muted-foreground">+40 31 123 4567</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-medium">Adresă</h3>
                    <p className="text-muted-foreground">
                      Strada Sportului nr. 123<br />
                      Sector 1, București<br />
                      România
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-medium">Program</h3>
                    <p className="text-muted-foreground">
                      Luni - Vineri: 09:00 - 18:00<br />
                      Sâmbătă: 10:00 - 16:00<br />
                      Duminică: Închis
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            
          </div>
        </div>
      </main>

      <Footer />
    </div>;
};
export default ContactPage;
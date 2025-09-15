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
            Aveți întrebări? Suntem aici să vă ajutăm! Contactați-ne prin oricare dintre metodele de mai jos.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Contact Information */}
          <div className="space-y-8">
            <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
              
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Mail className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-lg">Email</h3>
                      <a href="mailto:soamespaul@gmail.com" className="text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                        soamespaul@gmail.com
                      </a>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Phone className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-lg">Telefon</h3>
                      <a href="tel:+40720059535" className="text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                        +40720059535
                      </a>
                    </div>
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
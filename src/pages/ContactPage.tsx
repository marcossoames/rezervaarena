import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Mail, Phone, MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ContactPage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        <section className="py-12 sm:py-16 lg:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
                  Contactează-ne
                </h1>
                <p className="text-lg text-muted-foreground">
                  Suntem aici pentru a te ajuta! Contactează-ne pentru orice întrebări sau informații.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-3 mb-12">
                <Card>
                  <CardHeader>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-center">Email</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-center">
                      <a href="mailto:contact@rezervaarena.com" className="text-primary hover:underline">
                        contact@rezervaarena.com
                      </a>
                    </CardDescription>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                      <Phone className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-center">Telefon</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-center">
                      <a href="tel:+40123456789" className="text-primary hover:underline">
                        +40 123 456 789
                      </a>
                    </CardDescription>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                      <MapPin className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-center">Locație</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-center">
                      România
                    </CardDescription>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Program de lucru</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="flex justify-between">
                      <span className="font-medium">Luni - Vineri:</span>
                      <span className="text-muted-foreground">09:00 - 18:00</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="font-medium">Sâmbătă:</span>
                      <span className="text-muted-foreground">10:00 - 14:00</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="font-medium">Duminică:</span>
                      <span className="text-muted-foreground">Închis</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ContactPage;

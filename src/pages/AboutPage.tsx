import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Users, Target, Award, Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AboutPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Header />
      
      <main className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Despre Noi
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            SportBook este platforma care conectează pasionații de sport cu cele mai bune facilități din România. 
            Misiunea noastră este să facem sportul accesibil pentru toți.
          </p>
        </div>

        {/* Values Section */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <Card className="text-center border-0 shadow-card bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-xl">Misiunea Noastră</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Să democratizăm accesul la sport prin tehnologie și să creăm o comunitate activă.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center border-0 shadow-card bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="mx-auto w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mb-4">
                <Award className="w-8 h-8 text-secondary" />
              </div>
              <CardTitle className="text-xl">Calitatea</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Oferim doar facilități verificate și de înaltă calitate pentru o experiență optimă.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center border-0 shadow-card bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="mx-auto w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-accent" />
              </div>
              <CardTitle className="text-xl">Comunitatea</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Construim o comunitate unită de pasiunea pentru sport și un stil de viață sănătos.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center border-0 shadow-card bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                <Heart className="w-8 h-8 text-destructive" />
              </div>
              <CardTitle className="text-xl">Pasiunea</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Suntem pasionați de sport și ne dedicăm să oferim cea mai bună experiență utilizatorilor.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Story Section */}
        <div className="max-w-4xl mx-auto">
          <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-center">Povestea Noastră</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-muted-foreground leading-relaxed">
                SportBook a început din dorința de a simplifica accesul la facilitățile sportive din România. 
                Am observat că multe persoane întâmpină dificultăți în găsirea și rezervarea terenurilor de sport, 
                iar proprietarii de facilități nu au o modalitate eficientă de a-și gestiona rezervările.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Platforma noastră conectează utilizatorii cu o gamă largă de facilități sportive - de la terenuri 
                de fotbal și tenis, până la piscine și săli de fitness. Oferim o experiență de rezervare simplă, 
                transparentă și sigură, atât pentru sportivi cât și pentru proprietarii de facilități.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Viziunea noastră este să devenim cea mai mare platformă de rezervări sportive din România, 
                promovând un stil de viață activ și sănătos în comunitatea noastră.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AboutPage;
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Users, Target, Award, Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
const AboutPage = () => {
  return <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Header />
      
      <main className="w-full px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Despre Noi
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">RezervaArena este platforma care conectează pasionații de sport cu cele mai bune facilități din Timișoara. Misiunea noastră este să facem sportul accesibil pentru toți.</p>
        </div>

        {/* Values Section */}
        

        {/* Story Section */}
        <div className="max-w-4xl mx-auto">
          <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-center">Povestea Noastră</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-muted-foreground leading-relaxed">RezervaArena a început din dorința de a simplifica accesul la facilitățile sportive din Timișoara. Ca tineri informaticieni și sportivi de ocazie, am observat că multe persoane întâmpină dificultăți în găsirea și rezervarea terenurilor de sport, iar proprietarii de facilități nu au o modalitate eficientă de a-și gestiona rezervările.</p>
              <p className="text-muted-foreground leading-relaxed">Platforma noastră conectează utilizatorii cu o gamă largă de facilități sportive - de la terenuri de fotbal și tenis, până la piscine și terenuri de padel. Oferim o experiență de rezervare simplă, transparentă și sigură, atât pentru sportivi cât și pentru proprietarii bazelor sportive.</p>
              <p className="text-muted-foreground leading-relaxed">
                Viziunea noastră este să devenim cea mai mare platformă de rezervări sportive din România, 
                promovând un stil de viață activ și sănătos în comunitatea noastră.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>;
};
export default AboutPage;
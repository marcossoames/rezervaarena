import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Users, Target, Award, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import FloatingShape from "@/components/FloatingShape";

const values = [
  {
    icon: Target,
    title: "Misiune",
    description: "Facem sportul accesibil tuturor prin tehnologie modernă și o platformă intuitivă.",
  },
  {
    icon: Users,
    title: "Comunitate",
    description: "Conectăm pasionații de sport cu facilitățile potrivite din întreaga țară.",
  },
  {
    icon: Award,
    title: "Calitate",
    description: "Verificăm fiecare facilitate pentru a asigura standarde ridicate.",
  },
  {
    icon: Sparkles,
    title: "Inovație",
    description: "Îmbunătățim constant platforma cu funcționalități noi și moderne.",
  },
];

const AboutPage = () => {
  const { ref: valuesRef, isVisible: valuesVisible } = useScrollAnimation(0.1);
  const { ref: storyRef, isVisible: storyVisible } = useScrollAnimation(0.1);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="w-full pt-20 pb-16">
        <section className="relative min-h-[50vh] flex items-center justify-center overflow-hidden px-4">
          <FloatingShape />

          <div className="relative z-10 text-center max-w-3xl mx-auto">
            <h1 className="hero-stagger-1 text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-foreground">
              Despre <span className="text-primary">Noi</span>
            </h1>
            <p className="hero-stagger-2 text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              RezervaArena este platforma care conectează pasionații de sport cu cele mai bune facilități din România.
            </p>
          </div>
        </section>

        {/* Values Grid */}
        <section className="py-16 px-4" ref={valuesRef}>
          <div className="max-w-5xl mx-auto">
            <h2 className={`text-2xl sm:text-3xl font-bold text-center mb-12 text-foreground animate-on-scroll ${valuesVisible ? 'visible' : ''}`}>
              Valorile <span className="text-primary">Noastre</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {values.map((value, index) => (
                <Card
                  key={index}
                  className={`group hover-lift border-border/30 bg-card/80 backdrop-blur-sm animate-on-scroll ${valuesVisible ? 'visible' : ''} stagger-${index + 1}`}
                >
                  <CardContent className="p-6 text-center">
                    <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors duration-300">
                      <value.icon className="h-7 w-7 text-primary group-hover-rotate" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{value.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{value.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Story Section */}
        <section className="py-16 px-4 bg-muted/30" ref={storyRef}>
          <div className="max-w-3xl mx-auto">
            <Card className={`border-0 shadow-elegant bg-card/90 backdrop-blur-sm animate-on-scroll ${storyVisible ? 'visible' : ''}`}>
              <CardContent className="p-8 sm:p-12">
                <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 text-foreground">
                  Povestea <span className="text-primary">Noastră</span>
                </h2>
                
                <div className="space-y-6">
                  <p className="text-muted-foreground leading-relaxed">
                    RezervaArena a început din dorința de a simplifica accesul la facilitățile sportive din România. 
                    Ca tineri informaticieni și sportivi de ocazie, am observat că multe persoane întâmpină dificultăți 
                    în găsirea și rezervarea terenurilor de sport, iar proprietarii de facilități nu au o modalitate 
                    eficientă de a-și gestiona rezervările.
                  </p>
                  
                  <div className="w-16 h-px bg-primary/30 mx-auto" />
                  
                  <p className="text-muted-foreground leading-relaxed">
                    Platforma noastră conectează utilizatorii cu o gamă largă de facilități sportive - de la terenuri 
                    de fotbal și tenis, până la piscine și terenuri de padel. Oferim o experiență de rezervare simplă, 
                    transparentă și sigură, atât pentru sportivi cât și pentru proprietarii bazelor sportive.
                  </p>
                  
                  <div className="w-16 h-px bg-primary/30 mx-auto" />
                  
                  <p className="text-muted-foreground leading-relaxed">
                    Viziunea noastră este să devenim cea mai mare platformă de rezervări sportive din România, 
                    promovând un stil de viață activ și sănătos în comunitatea noastră.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default AboutPage;

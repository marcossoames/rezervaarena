import { Card, CardContent } from "@/components/ui/card";
import { Calendar, CreditCard, Clock, Shield } from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Rezervare Instantanee & Program Flexibil",
    description: "Rezervă terenul în doar câteva click-uri pentru următoarele 2 săptămâni pe intervale de 60 sau 90 de minute, adaptate programului tău"
  },
  {
    icon: CreditCard,
    title: "Plată Securizată",
    description: "Sistem de plăți securizat cu confirmarea rezervării în timp real"
  },
  {
    icon: Shield,
    title: "Garantie & Suport",
    description: "Echipa noastră te ajută 24/7 pentru orice problemă"
  }
];

const FeaturesSection = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            De ce să alegi <span className="text-primary">RezervaArena</span>?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Simplificăm procesul de rezervare a terenurilor sportive pentru o experiență perfectă
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="group hover:shadow-card transition-all duration-300 bg-gradient-card border-border/50">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-gradient-accent rounded-full flex items-center justify-center mx-auto mb-6 group-hover:shadow-glow transition-all duration-300">
                  <feature.icon className="h-8 w-8 text-accent-foreground" />
                </div>
                
                <h3 className="text-xl font-bold text-foreground mb-4">
                  {feature.title}
                </h3>
                
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, CreditCard, Clock, Shield } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const features = [
  {
    icon: Calendar,
    title: "Rezervare Instantanee & Program Flexibil",
    description:
      "Rezervă terenul în doar câteva click-uri pentru următoarele 2 săptămâni pe intervale de 60, 90 sau 120 de minute, adaptate programului tău",
  },
  {
    icon: CreditCard,
    title: "Plată Securizată",
    description: "Sistem de plăți securizat cu confirmarea rezervării în timp real",
  },
  {
    icon: Shield,
    title: "Garantie & Suport",
    description: "Echipa noastră te ajută 24/7 pentru orice problemă",
  },
];

const FeaturesSection = () => {
  const { ref, isVisible } = useScrollAnimation(0.1);

  return (
    <section className="py-12 sm:py-16 lg:py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6" ref={ref}>
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-4">
            De ce să alegi <span className="text-primary">RezervaArena</span>?
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
            Simplificăm procesul de rezervare a terenurilor sportive pentru o experiență perfectă
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card
              key={index}
              className={`group hover-lift bg-gradient-card border-border/50 animate-on-scroll ${isVisible ? 'visible' : ''} stagger-${index + 1}`}
            >
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-gradient-accent rounded-full flex items-center justify-center mx-auto mb-6 group-hover:shadow-glow transition-all duration-300">
                  <feature.icon className="h-8 w-8 text-accent-foreground group-hover-rotate" />
                </div>

                <h3 className="text-xl font-bold text-foreground mb-4">{feature.title}</h3>

                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;

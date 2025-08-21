import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import tennisImage from "@/assets/tennis-court.jpg";
import footballImage from "@/assets/football-field.jpg";
import padelImage from "@/assets/padel-court.jpg";
import swimmingImage from "@/assets/swimming-pool.jpg";

const sportsData = [
  {
    id: 1,
    name: "Tenis",
    image: tennisImage,
    description: "Terenuri profesionale de tenis cu suprafețe moderne",
    facilities: 150,
    avgPrice: "80-150 RON/oră"
  },
  {
    id: 2,
    name: "Fotbal",
    image: footballImage,
    description: "Terenuri de fotbal cu gazon sintetic și natural",
    facilities: 200,
    avgPrice: "200-400 RON/oră"
  },
  {
    id: 3,
    name: "Padel",
    image: padelImage,
    description: "Terenuri moderne de padel cu echipament complet",
    facilities: 80,
    avgPrice: "100-180 RON/oră"
  },
  {
    id: 4,
    name: "Înot",
    image: swimmingImage,
    description: "Piscine profesionale pentru antrenament și relaxare",
    facilities: 60,
    avgPrice: "25-50 RON/oră"
  }
];

const SportsSection = () => {
  return (
    <section id="terenuri" className="py-20 bg-secondary/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Tipuri de <span className="text-primary">Terenuri Sportive</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Descoperă varietatea de facilități sportive disponibile pentru rezervare în întreaga țară
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {sportsData.map((sport) => (
            <Card key={sport.id} className="group hover:shadow-elegant transition-all duration-300 transform hover:scale-105 bg-gradient-card border-none">
              <CardContent className="p-0">
                <div className="relative overflow-hidden rounded-t-lg">
                  <img 
                    src={sport.image} 
                    alt={sport.name}
                    className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 via-transparent to-transparent"></div>
                  <div className="absolute bottom-4 left-4">
                    <h3 className="text-xl font-bold text-primary-foreground">{sport.name}</h3>
                  </div>
                </div>
                
                <div className="p-6">
                  <p className="text-muted-foreground mb-4">
                    {sport.description}
                  </p>
                  
                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Facilități disponibile:</span>
                      <span className="font-semibold text-primary">{sport.facilities}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Preț mediu:</span>
                      <span className="font-semibold text-accent">{sport.avgPrice}</span>
                    </div>
                  </div>
                  
                  <Button className="w-full" variant="default">
                    Vezi Terenurile
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SportsSection;
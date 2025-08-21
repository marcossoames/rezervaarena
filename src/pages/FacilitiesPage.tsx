import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Clock, Star, Filter, Search } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import tennisImage from "@/assets/tennis-court.jpg";
import footballImage from "@/assets/football-field.jpg";
import padelImage from "@/assets/padel-court.jpg";
import swimmingImage from "@/assets/swimming-pool.jpg";

const facilities = [
  {
    id: 1,
    name: "Tennis Club Elite",
    location: "Herastrau, București",
    image: tennisImage,
    rating: 4.8,
    price: 120,
    type: "Tenis",
    amenities: ["Vestiare", "Parcare", "Cafenea", "Pro Shop"],
    availableSlots: 8,
    courts: 4
  },
  {
    id: 2,
    name: "Arena Footbal Plus",
    location: "Floreasca, București",
    image: footballImage,
    rating: 4.6,
    price: 300,
    type: "Fotbal",
    amenities: ["Vestiare", "Parcare", "Tribună", "Gazon sintetic"],
    availableSlots: 12,
    courts: 2
  },
  {
    id: 3,
    name: "Padel Center Pro",
    location: "Pipera, București",
    image: padelImage,
    rating: 4.9,
    price: 150,
    type: "Padel",
    amenities: ["Vestiare", "Parcare", "Echipament rental", "Instructor"],
    availableSlots: 6,
    courts: 3
  },
  {
    id: 4,
    name: "AquaSport Complex",
    location: "Aviatorilor, București",
    image: swimmingImage,
    rating: 4.7,
    price: 35,
    type: "Înot",
    amenities: ["Vestiare", "Saună", "Parcare", "Instructor"],
    availableSlots: 15,
    courts: 1
  }
];

const FacilitiesPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Facilități <span className="text-primary">Sportive</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Descoperă cele mai bune baze sportive din București și rezervă acum
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8 animate-fade-in">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Caută facilități..." className="pl-10" />
              </div>
              
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Locație..." className="pl-10" />
              </div>
              
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input type="date" className="pl-10" />
              </div>
              
              <Button variant="sport" className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                Filtrează
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">Toate</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">Tenis</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">Fotbal</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">Padel</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">Înot</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Facilities Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {facilities.map((facility, index) => (
            <Card key={facility.id} className="group hover:shadow-elegant transition-all duration-300 animate-fade-in" style={{animationDelay: `${index * 0.1}s`}}>
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-1/3 relative overflow-hidden">
                    <img 
                      src={facility.image} 
                      alt={facility.name}
                      className="w-full h-48 md:h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">
                      {facility.type}
                    </Badge>
                  </div>
                  
                  <div className="md:w-2/3 p-6">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-foreground mb-1">{facility.name}</h3>
                        <div className="flex items-center text-muted-foreground text-sm">
                          <MapPin className="h-4 w-4 mr-1" />
                          {facility.location}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <Star className="h-4 w-4 text-accent mr-1 fill-current" />
                        <span className="font-semibold">{facility.rating}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mb-4">
                      {facility.amenities.map((amenity) => (
                        <Badge key={amenity} variant="secondary" className="text-xs">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 text-primary mr-2" />
                        <span>{facility.availableSlots} sloturi libere</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-muted-foreground">{facility.courts} {facility.type === 'Înot' ? 'piscină' : 'terenuri'}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="text-2xl font-bold text-primary">
                        {facility.price} RON
                        <span className="text-sm font-normal text-muted-foreground">/oră</span>
                      </div>
                      <Button variant="sport">
                        Rezervă Acum
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default FacilitiesPage;
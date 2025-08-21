import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarDays, 
  MapPin, 
  Star, 
  Clock, 
  Users, 
  Wifi, 
  Car, 
  Coffee,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import tennisImage from "@/assets/tennis-court.jpg";

const timeSlots = [
  { time: "08:00", available: true, price: 120 },
  { time: "08:30", available: true, price: 120 },
  { time: "09:00", available: false, price: 120 },
  { time: "09:30", available: true, price: 120 },
  { time: "10:00", available: true, price: 120 },
  { time: "10:30", available: false, price: 120 },
  { time: "11:00", available: true, price: 120 },
  { time: "11:30", available: true, price: 120 },
  { time: "12:00", available: true, price: 140 },
  { time: "12:30", available: true, price: 140 },
  { time: "13:00", available: false, price: 140 },
  { time: "13:30", available: true, price: 140 },
  { time: "14:00", available: true, price: 140 },
  { time: "14:30", available: true, price: 140 },
  { time: "15:00", available: true, price: 140 },
  { time: "15:30", available: false, price: 140 }
];

const BookingPage = () => {
  const selectedDate = new Date();
  const tomorrow = new Date(selectedDate);
  tomorrow.setDate(selectedDate.getDate() + 1);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/facilities" className="text-primary hover:underline flex items-center mb-4">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Înapoi la facilități
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Rezervare Teren</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Facility Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="animate-fade-in">
              <CardContent className="p-0">
                <div className="relative">
                  <img 
                    src={tennisImage} 
                    alt="Tennis Club Elite"
                    className="w-full h-64 object-cover rounded-t-lg"
                  />
                  <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground">
                    Tenis
                  </Badge>
                  <div className="absolute top-4 right-4 flex items-center bg-card/90 backdrop-blur-sm rounded-lg px-3 py-1">
                    <Star className="h-4 w-4 text-accent mr-1 fill-current" />
                    <span className="font-semibold">4.8</span>
                  </div>
                </div>
                
                <div className="p-6">
                  <h2 className="text-2xl font-bold text-foreground mb-2">Tennis Club Elite</h2>
                  <div className="flex items-center text-muted-foreground mb-4">
                    <MapPin className="h-4 w-4 mr-2" />
                    Strada Aviatorilor 42, Herastrau, București
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="flex items-center space-x-2">
                      <Wifi className="h-5 w-5 text-primary" />
                      <span className="text-sm">WiFi gratuit</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Car className="h-5 w-5 text-primary" />
                      <span className="text-sm">Parcare</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Coffee className="h-5 w-5 text-primary" />
                      <span className="text-sm">Cafenea</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5 text-primary" />
                      <span className="text-sm">Vestiare</span>
                    </div>
                  </div>
                  
                  <p className="text-muted-foreground">
                    Teren profesional de tenis cu suprafață dură, iluminat profesional pentru 
                    meciuri de seară. Echipament de calitate disponibil pentru închiriere.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Date Selection */}
            <Card className="animate-fade-in" style={{animationDelay: '0.1s'}}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CalendarDays className="h-5 w-5 mr-2" />
                  Selectează Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <Button variant="ghost" size="sm">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="text-lg font-semibold">
                    {selectedDate.toLocaleDateString('ro-RO', { 
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </h3>
                  <Button variant="ghost" size="sm">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 14 }, (_, i) => {
                    const date = new Date(selectedDate);
                    date.setDate(selectedDate.getDate() + i);
                    const isToday = date.toDateString() === selectedDate.toDateString();
                    
                    return (
                      <Button
                        key={i}
                        variant={isToday ? "default" : "outline"}
                        size="sm"
                        className="h-16 flex flex-col"
                      >
                        <span className="text-xs">
                          {date.toLocaleDateString('ro-RO', { weekday: 'short' })}
                        </span>
                        <span className="text-lg font-bold">
                          {date.getDate()}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Time Slots */}
            <Card className="animate-fade-in" style={{animationDelay: '0.2s'}}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Ore Disponibile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {timeSlots.map((slot) => (
                    <Button
                      key={slot.time}
                      variant={slot.available ? "outline" : "secondary"}
                      disabled={!slot.available}
                      className={`h-16 flex flex-col ${slot.available ? 'hover:bg-primary hover:text-primary-foreground' : ''}`}
                    >
                      <span className="font-semibold">{slot.time}</span>
                      <span className="text-xs">
                        {slot.available ? `${slot.price} RON` : 'Ocupat'}
                      </span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Booking Summary */}
          <div className="space-y-6">
            <Card className="sticky top-8 animate-fade-in" style={{animationDelay: '0.3s'}}>
              <CardHeader>
                <CardTitle>Sumar Rezervare</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Teren:</span>
                    <span className="font-medium">Teren 1 - Tenis</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data:</span>
                    <span className="font-medium">Astăzi</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ora:</span>
                    <span className="font-medium">Nu este selectată</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Durată:</span>
                    <span className="font-medium">1 oră</span>
                  </div>
                </div>
                
                <div className="border-t border-border pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-primary">120 RON</span>
                  </div>
                </div>
                
                <Button className="w-full" size="lg" variant="sport" disabled>
                  Selectează ora pentru a continua
                </Button>
                
                <p className="text-xs text-muted-foreground text-center">
                  Rezervarea poate fi anulată cu 2 ore înainte de începere
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default BookingPage;
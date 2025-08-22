import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, MapPin, Calendar as CalendarIcon, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { ro } from "date-fns/locale";
import { cn } from "@/lib/utils";

const SearchSection = () => {
  const [location, setLocation] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [facilityType, setFacilityType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  // Restricții pentru căutare: doar următoarele 2 săptămâni (ca la booking)
  const today = startOfDay(new Date());
  const maxSearchDate = addDays(today, 14);

  const facilityTypes = [
    { value: "all", label: "Toate tipurile" },
    { value: "tennis", label: "Tenis" },
    { value: "football", label: "Fotbal" },
    { value: "padel", label: "Padel" },
    { value: "swimming", label: "Înot" },
    { value: "basketball", label: "Baschet" },
    { value: "volleyball", label: "Volei" }
  ];

  const handleSearch = () => {
    // Build query parameters
    const params = new URLSearchParams();
    
    if (facilityType && facilityType !== "all") {
      params.set('type', facilityType);
    }
    if (location.trim()) {
      params.set('location', location.trim());
    }
    if (selectedDate) {
      params.set('date', format(selectedDate, 'yyyy-MM-dd'));
    }
    if (searchQuery.trim()) {
      params.set('search', searchQuery.trim());
    }

    // Navigate to facilities page with search parameters
    const queryString = params.toString();
    navigate(`/facilities${queryString ? `?${queryString}` : ''}`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <section className="py-16 bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Găsește <span className="text-primary">Terenul Perfect</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Caută și rezervă cele mai bune facilități sportive din România în câțiva pași simpli
          </p>
        </div>

        <Card className="max-w-5xl mx-auto shadow-2xl border-0 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {/* Search Query */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Caută facilități</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nume facilitate sau bază sportivă..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pl-10 bg-background/50 border-border/50 focus:border-primary"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Locația</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Oraș, sector, zonă..."
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pl-10 bg-background/50 border-border/50 focus:border-primary"
                  />
                </div>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Data rezervării</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-background/50 border-border/50 hover:border-primary text-sm truncate",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "dd MMM yyyy", { locale: ro }) : "Selectează data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50 bg-popover border shadow-lg" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => 
                        isBefore(date, today) || // Nu permite datele din trecut
                        isBefore(maxSearchDate, date) // Nu permite datele peste 2 săptămâni
                      }
                      initialFocus
                      className="p-3 pointer-events-auto bg-background rounded-md"
                    />
                    <div className="p-3 border-t bg-muted/50">
                      <p className="text-xs text-muted-foreground text-center">
                        📅 Poți căuta pentru următoarele 14 zile
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Facility Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Tipul facilității</label>
                <Select value={facilityType} onValueChange={setFacilityType}>
                  <SelectTrigger className="bg-background/50 border-border/50 focus:border-primary">
                    <SelectValue placeholder="Toate tipurile" />
                  </SelectTrigger>
                  <SelectContent>
                    {facilityTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Search Button */}
            <div className="flex justify-center">
              <Button 
                onClick={handleSearch}
                size="lg" 
                className="px-12 py-3 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Search className="mr-2 h-5 w-5" />
                Caută Facilități
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default SearchSection;
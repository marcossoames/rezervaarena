import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, MapPin, Calendar as CalendarIcon, Filter, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { ro } from "date-fns/locale";
import { cn } from "@/lib/utils";
const SearchSection = () => {
  const [location, setLocation] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [facilityType, setFacilityType] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  // Restricții pentru căutare: doar următoarele 2 săptămâni (ca la booking)
  const today = startOfDay(new Date());
  const maxSearchDate = addDays(today, 14);
  const facilityTypes = [{
    value: "all",
    label: "Toate tipurile"
  }, {
    value: "tennis",
    label: "Tenis"
  }, {
    value: "football",
    label: "Fotbal"
  }, {
    value: "padel",
    label: "Padel"
  }, {
    value: "swimming",
    label: "Înot"
  }, {
    value: "basketball",
    label: "Baschet"
  }, {
    value: "volleyball",
    label: "Volei"
  }];
  const getTimeOptions = () => {
    const times = [];
    for (let hour = 8; hour <= 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        times.push({
          value: timeString,
          label: timeString
        });
      }
    }
    return times;
  };
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
    if (startTime && endTime) {
      params.set('startTime', startTime);
      params.set('endTime', endTime);
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
            Caută și rezervă cele mai bune terenuri sportive din România în câțiva pași simpli
          </p>
        </div>

        <Card className="max-w-6xl mx-auto shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
          <CardContent className="p-6 md:p-8">
            {/* Primary Search Fields */}
            <div className="space-y-6">
              
              {/* First Row: Search and Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Caută terenuri</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Nume teren sau bază sportivă..." 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)} 
                      onKeyPress={handleKeyPress} 
                      className="h-12 pl-10 bg-background border-border focus:border-primary text-base"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Locația</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Oraș, zonă..." 
                      value={location} 
                      onChange={(e) => setLocation(e.target.value)} 
                      onKeyPress={handleKeyPress} 
                      className="h-12 pl-10 bg-background border-border focus:border-primary text-base"
                    />
                  </div>
                </div>
              </div>

              {/* Second Row: Date and Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Data rezervării</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className={cn(
                          "w-full h-12 justify-start text-left font-normal bg-background border-border hover:border-primary",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-3 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "dd MMM yyyy", { locale: ro }) : "Selectează data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50" align="start">
                      <Calendar 
                        mode="single" 
                        selected={selectedDate} 
                        onSelect={setSelectedDate} 
                        disabled={date => isBefore(date, today) || isBefore(maxSearchDate, date)} 
                        initialFocus 
                        className="p-3 pointer-events-auto"
                      />
                      <div className="p-3 border-t bg-muted/50">
                        <p className="text-xs text-muted-foreground text-center">
                          📅 Poți căuta pentru următoarele 14 zile
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Intervalul orar</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                      <Select value={startTime} onValueChange={setStartTime}>
                        <SelectTrigger className="h-12 pl-10 bg-background border-border focus:border-primary">
                          <SelectValue placeholder="De la" />
                        </SelectTrigger>
                        <SelectContent className="z-50">
                          {getTimeOptions().filter(time => !endTime || time.value < endTime).map(time => 
                            <SelectItem key={time.value} value={time.value}>
                              {time.label}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                      <Select value={endTime} onValueChange={setEndTime} disabled={!startTime}>
                        <SelectTrigger className="h-12 pl-10 bg-background border-border focus:border-primary">
                          <SelectValue placeholder="Până la" />
                        </SelectTrigger>
                        <SelectContent className="z-50">
                          {getTimeOptions().filter(time => startTime && time.value > startTime).map(time => 
                            <SelectItem key={time.value} value={time.value}>
                              {time.label}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Third Row: Sport Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Tipul terenului</label>
                  <Select value={facilityType} onValueChange={setFacilityType}>
                    <SelectTrigger className="h-12 bg-background border-border focus:border-primary">
                      <SelectValue placeholder="Toate tipurile" />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      {facilityTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div></div> {/* Empty space for symmetry */}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-4">
                <Button 
                  onClick={handleSearch} 
                  size="lg" 
                  className="w-full sm:w-auto px-8 py-3 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Search className="mr-2 h-5 w-5" />
                  Caută Terenuri
                </Button>
                
              <Button 
                variant="secondary" 
                size="lg"
                onClick={() => {
                  setLocation("");
                  setSelectedDate(undefined);
                  setFacilityType("");
                  setStartTime("");
                  setEndTime("");
                  setSearchQuery("");
                }}
                className="w-full sm:w-auto px-6 py-3 text-base border-2 border-border bg-background text-foreground hover:bg-secondary hover:text-secondary-foreground"
              >
                  <Filter className="mr-2 h-4 w-4" />
                  Resetează
                </Button>
              </div>

            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
export default SearchSection;
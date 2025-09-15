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
import { facilityTypeOptions } from "@/utils/facilityTypes";
import { isBookingTimeAllowed } from "@/utils/dateTimeValidation";
const SearchSection = () => {
  const [location, setLocation] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [facilityType, setFacilityType] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState<"60" | "90" | "">("");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  // Restricții pentru căutare: doar următoarele 2 săptămâni (ca la booking)
  const today = startOfDay(new Date());
  const maxSearchDate = addDays(today, 14);
  const facilityTypes = [{
    value: "all",
    label: "Toate tipurile"
  }, ...facilityTypeOptions];
  const getTimeOptions = () => {
    const times = [];
    const dateToCheck = selectedDate || today;
    
    for (let hour = 8; hour <= 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        // Only include times that are allowed for the selected date
        if (isBookingTimeAllowed(dateToCheck, timeString)) {
          times.push({
            value: timeString,
            label: timeString
          });
        }
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
    if (startTime && duration) {
      params.set('startTime', startTime);
      params.set('duration', duration);
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
    <section className="py-20 bg-gradient-to-br from-primary/8 via-background to-secondary/5 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="absolute top-10 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl"></div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Găsește <span className="text-primary bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Terenul Perfect</span>
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Caută și rezervă cele mai bune terenuri sportive din România în câțiva pași simpli
          </p>
        </div>

        <Card className="max-w-5xl mx-auto shadow-elegant border border-border/50 bg-card/80 backdrop-blur-md relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-lg"></div>
          <CardContent className="p-8 md:p-10 relative z-10">
            <div className="space-y-8">
              
              {/* First Row: Search and Location */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    Caută terenuri
                  </label>
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                      placeholder="Nume teren sau bază sportivă..." 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)} 
                      onKeyPress={handleKeyPress} 
                      className="h-14 pl-12 bg-background/80 border-border/50 focus:border-primary text-base rounded-xl transition-all duration-300 hover:bg-background focus:bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Locația
                  </label>
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                      placeholder="Oraș, zonă..." 
                      value={location} 
                      onChange={(e) => setLocation(e.target.value)} 
                      onKeyPress={handleKeyPress} 
                      className="h-14 pl-12 bg-background/80 border-border/50 focus:border-primary text-base rounded-xl transition-all duration-300 hover:bg-background focus:bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Second Row: Date and Time */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    Data rezervării
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className={cn(
                          "w-full h-14 justify-start text-left font-normal bg-background/80 border-border/50 hover:border-primary rounded-xl transition-all duration-300 hover:bg-background",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-3 h-5 w-5" />
                        {selectedDate ? format(selectedDate, "dd MMM yyyy", { locale: ro }) : "Selectează data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[1000]" align="start">
                       <Calendar 
                        mode="single" 
                        selected={selectedDate} 
                        onSelect={(date) => {
                          setSelectedDate(date);
                          // Clear time and duration selections when date changes
                          if (date) {
                            setStartTime("");
                            setDuration("");
                          }
                        }} 
                        disabled={date => isBefore(date, today) || isBefore(maxSearchDate, date)} 
                        initialFocus 
                        className="p-3 pointer-events-auto"
                      />
                      <div className="p-4 border-t bg-muted/30">
                        <p className="text-xs text-muted-foreground text-center">
                          📅 Poți căuta pentru următoarele 14 zile
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Interval rezervare
                  </label>
                  <div className="space-y-4">
                    {/* Duration Selection */}
                    <div className="space-y-2">
                      <Select value={duration} onValueChange={(value: "60" | "90" | "") => {
                        setDuration(value);
                        // Reset start time when duration changes
                        setStartTime("");
                      }}>
                        <SelectTrigger className="h-14 bg-background/80 border-border/50 focus:border-primary rounded-xl transition-all duration-300 hover:bg-background">
                          <SelectValue placeholder="Selectează durata" />
                        </SelectTrigger>
                        <SelectContent className="z-[1000]">
                          <SelectItem value="60">⏱️ 60 minute (1 oră)</SelectItem>
                          <SelectItem value="90">⏰ 90 minute (1.5 ore)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Start Time Selection - only show when duration is selected */}
                    {duration && (
                      <div className="space-y-2">
                        <div className="relative group">
                          <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
                          <Select value={startTime} onValueChange={setStartTime}>
                            <SelectTrigger className="h-14 pl-12 bg-background/80 border-border/50 focus:border-primary rounded-xl transition-all duration-300 hover:bg-background">
                              <SelectValue placeholder="Selectează ora de început" />
                            </SelectTrigger>
                            <SelectContent className="z-[1000]">
                              {getTimeOptions().map(time => {
                                // Check if this start time + duration would exceed operating hours
                                const [hour, minute] = time.value.split(':').map(Number);
                                const startMinutes = hour * 60 + minute;
                                const endMinutes = startMinutes + parseInt(duration);
                                const endHour = Math.floor(endMinutes / 60);
                                
                                // Don't show times that would exceed 22:00 (operating hours end)
                                if (endHour > 22) return null;
                                
                                return (
                                  <SelectItem key={time.value} value={time.value}>
                                    {time.label}
                                  </SelectItem>
                                );
                              }).filter(Boolean)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Third Row: Sport Type */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Filter className="h-4 w-4 text-primary" />
                    Tipul terenului
                  </label>
                  <Select value={facilityType} onValueChange={setFacilityType}>
                    <SelectTrigger className="h-14 bg-background/80 border-border/50 focus:border-primary rounded-xl transition-all duration-300 hover:bg-background">
                      <SelectValue placeholder="Toate tipurile" />
                    </SelectTrigger>
                    <SelectContent className="z-[100]">
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
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
                <Button 
                  onClick={handleSearch} 
                  size="lg" 
                  className="w-full sm:w-auto px-10 py-4 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-elegant hover:shadow-glow transition-all duration-300 rounded-xl"
                >
                  <Search className="mr-3 h-5 w-5" />
                  Caută Terenuri
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => {
                    setLocation("");
                    setSelectedDate(undefined);
                    setFacilityType("");
                    setStartTime("");
                    setDuration("");
                    setSearchQuery("");
                  }}
                  className="w-full sm:w-auto px-8 py-4 text-lg border-2 border-border/50 bg-background/80 text-foreground hover:bg-secondary/50 hover:text-secondary-foreground rounded-xl transition-all duration-300"
                >
                  <Filter className="mr-3 h-4 w-4" />
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
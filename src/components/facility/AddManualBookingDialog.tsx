import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { UserPlus, Repeat } from "lucide-react";
import { format, addDays, getDay, addWeeks } from "date-fns";
import { ro } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AddManualBookingDialogProps {
  facilityId: string;
  facility: {
    operating_hours_start?: string;
    operating_hours_end?: string;
    price_per_hour: number;
  } | null;
  onBookingAdded: () => void;
  selectedDate?: Date;
}

const AddManualBookingDialog = ({ facilityId, facility, onBookingAdded, selectedDate }: AddManualBookingDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [bookingDate, setBookingDate] = useState<Date | undefined>(selectedDate || new Date());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringEndDate, setRecurringEndDate] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);
  const [existingBookings, setExistingBookings] = useState<any[]>([]);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  
  const { toast } = useToast();

  // Load existing bookings and blocked dates when date changes
  const loadDateData = async (date: Date) => {
    if (!date) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Load existing bookings for the date
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('id, start_time, end_time, status')
      .eq('facility_id', facilityId)
      .eq('booking_date', dateStr)
      .in('status', ['confirmed', 'pending']);
    
    // Load blocked dates for the date
    const { data: blockedData } = await supabase
      .from('blocked_dates')
      .select('*')
      .eq('facility_id', facilityId)
      .eq('blocked_date', dateStr);
    
    setExistingBookings(bookingsData || []);
    setBlockedDates(blockedData || []);
  };

  // Check if date is fully blocked
  const isDateFullyBlocked = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return blockedDates.some(blocked => 
      blocked.blocked_date === dateStr && 
      (!blocked.start_time || !blocked.end_time) // Blocked all day if no specific times
    );
  };

  // Check if time range overlaps with existing bookings
  const hasTimeConflict = (startTime: string, endTime: string) => {
    return existingBookings.some(booking => {
      const bookingStart = booking.start_time.slice(0, 5); // Remove seconds
      const bookingEnd = booking.end_time.slice(0, 5);
      
      // Check if times overlap
      return (startTime < bookingEnd && endTime > bookingStart);
    });
  };

  // Check if time range overlaps with blocked hours
  const hasBlockedTimeConflict = (startTime: string, endTime: string) => {
    return blockedDates.some(blocked => {
      if (!blocked.start_time || !blocked.end_time) return false; // Skip full day blocks
      
      const blockedStart = blocked.start_time.slice(0, 5);
      const blockedEnd = blocked.end_time.slice(0, 5);
      
      return (startTime < blockedEnd && endTime > blockedStart);
    });
  };

  // Load date data when booking date changes or when selectedDate prop changes
  const handleDateChange = (date: Date | undefined) => {
    setBookingDate(date);
    // Reset time selections when date changes to avoid invalid carry-over
    setStartTime("");
    setEndTime("");
    // Auto-select end date as one week later if recurring is enabled
    if (date && isRecurring) {
      setRecurringEndDate(addWeeks(date, 1));
    }
    if (date) {
      loadDateData(date);
    }
  };

  // Reset form when selectedDate prop changes
  useEffect(() => {
    if (selectedDate) {
      setBookingDate(selectedDate);
      loadDateData(selectedDate);
    }
  }, [selectedDate]);

  // Ensure latest selected date is used when opening the dialog
  useEffect(() => {
    if (isOpen) {
      const dateToUse = selectedDate || new Date();
      setBookingDate(dateToUse);
      loadDateData(dateToUse);
      // Clear time/notes to prevent stale values from previous date
      setStartTime("");
      setEndTime("");
      setNotes("");
    }
  }, [isOpen, selectedDate]);


  const getTimeOptions = () => {
    const times = [];
    const startHour = facility?.operating_hours_start ? parseInt(facility.operating_hours_start.split(':')[0]) : 8;
    const endHour = facility?.operating_hours_end ? parseInt(facility.operating_hours_end.split(':')[0]) : 22;
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        times.push({ value: timeString, label: timeString });
      }
    }
    
    // Add end hour
    const endTimeString = `${endHour.toString().padStart(2, '0')}:00`;
    times.push({ value: endTimeString, label: endTimeString });
    
    return times;
  };

  const calculatePrice = () => {
    if (!startTime || !endTime || !facility?.price_per_hour) return 0;
    
    const start = new Date(`2000-01-01T${startTime}:00`);
    const end = new Date(`2000-01-01T${endTime}:00`);
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    return durationHours * facility.price_per_hour;
  };

  const generateRecurringDates = (startDate: Date, endDate: Date) => {
    const dates = [];
    let currentDate = new Date(startDate);
    
    // Weekly pentru aceeași zi din săptămână ca startDate
    const startDayOfWeek = getDay(startDate);
    while (currentDate <= endDate) {
      if (getDay(currentDate) === startDayOfWeek) {
        dates.push(new Date(currentDate));
      }
      currentDate = addDays(currentDate, 1);
    }
    
    return dates;
  };

  const handleSubmit = async () => {
    if (!bookingDate || !startTime || !endTime || !clientName.trim()) {
      toast({
        title: "Eroare",
        description: "Te rugăm să completezi toate câmpurile obligatorii",
        variant: "destructive"
      });
      return;
    }

    // Check if date is fully blocked
    if (isDateFullyBlocked(bookingDate)) {
      toast({
        title: "Eroare",
        description: "Nu poți crea rezervări pentru o zi complet blocată",
        variant: "destructive"
      });
      return;
    }

    // Check for time conflicts with existing bookings
    if (hasTimeConflict(startTime, endTime)) {
      toast({
        title: "Eroare",
        description: "Intervalul orar selectat se suprapune cu o rezervare existentă",
        variant: "destructive"
      });
      return;
    }

    // Check for time conflicts with blocked hours
    if (hasBlockedTimeConflict(startTime, endTime)) {
      toast({
        title: "Eroare",
        description: "Intervalul orar selectat se suprapune cu ore blocate",
        variant: "destructive"
      });
      return;
    }

    if (startTime >= endTime) {
      toast({
        title: "Eroare",
        description: "Ora de sfârșit trebuie să fie după ora de început",
        variant: "destructive"
      });
      return;
    }

    if (isRecurring && !recurringEndDate) {
      toast({
        title: "Eroare",
        description: "Te rugăm să selectezi data de sfârșit pentru rezervarea recurentă",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let datesToBook = [bookingDate];
      
      if (isRecurring && recurringEndDate) {
        datesToBook = generateRecurringDates(bookingDate, recurringEndDate);
      }

      // Create bookings for manual entries with proper user handling
      const calculatedPrice = calculatePrice();
      
      const bookingsToInsert = datesToBook.map(date => ({
        client_id: user.id, // Use facility owner as client_id for manual bookings - this will be adjusted by the notes field
        facility_id: facilityId,
        booking_date: format(date, 'yyyy-MM-dd'),
        start_time: startTime + ':00',
        end_time: endTime + ':00',
        total_price: calculatedPrice,
        total_amount: calculatedPrice,
        platform_fee_amount: 0, // No platform fee for manual bookings
        facility_owner_amount: calculatedPrice,
        payment_method: 'cash',
        status: 'confirmed' as const,
        notes: `Creat manual de proprietarul facilității${notes ? ` | Note suplimentare: ${notes}` : ''}`
      }));

      const { error } = await supabase
        .from('bookings')
        .insert(bookingsToInsert);

      if (error) {
        throw error;
      }

      const countInfo = datesToBook.length > 1 ? ` (${datesToBook.length} rezervări)` : '';
      
      toast({
        title: "Rezervare adăugată",
        description: `Rezervarea manuală a fost creată cu succes${countInfo}`
      });

      // Reset form
      setClientName("");
      setClientPhone("");
      setBookingDate(selectedDate || new Date());
      setStartTime("");
      setEndTime("");
      setNotes("");
      setIsRecurring(false);
      setRecurringEndDate(undefined);
      setIsOpen(false);
      
      onBookingAdded();
    } catch (error) {
      console.error('Error creating manual booking:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut crea rezervarea manuală",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!facility) {
    return (
      <Button className="w-full" disabled>
        <UserPlus className="h-4 w-4 mr-2" />
        Adaugă Rezervare Manuală
      </Button>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <UserPlus className="h-4 w-4 mr-2" />
          Adaugă Rezervare Manuală
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adaugă Rezervare Manuală</DialogTitle>
          <DialogDescription>
            Creează o rezervare pentru un client care nu a rezervat prin site
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Client Information */}
          <div className="space-y-3">
            <h4 className="font-medium">Date Client</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="clientName">Nume client *</Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Numele clientului"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientPhone">Telefon (opțional)</Label>
                <Input
                  id="clientPhone"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="Numărul de telefon"
                />
              </div>
            </div>
          </div>

          {/* Booking Details */}
          <div className="space-y-3">
            <h4 className="font-medium">Detalii Rezervare</h4>
            
            <div className="space-y-2">
              <Label>Data rezervării *</Label>
              <Calendar
                mode="single"
                selected={bookingDate}
                onSelect={handleDateChange}
                className="rounded-md border p-3 pointer-events-auto"
                disabled={(date) => date < new Date()}
                weekStartsOn={1}
                locale={ro}
              />
              
              {/* Show warnings for selected date */}
              {bookingDate && isDateFullyBlocked(bookingDate) && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">
                    ⚠️ Această zi este complet blocată. Nu se pot adăuga rezervări.
                  </p>
                </div>
              )}
              
              {bookingDate && existingBookings.length > 0 && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-700 mb-1">
                    ⚠️ Există rezervări pentru această zi:
                  </p>
                  <div className="text-xs text-amber-600">
                    {existingBookings.map((booking, index) => (
                      <div key={booking.id}>
                        {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {bookingDate && blockedDates.some(b => b.start_time && b.end_time) && (
                <div className="p-2 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-700 mb-1">
                    ⚠️ Ore blocate pentru această zi:
                  </p>
                  <div className="text-xs text-orange-600">
                    {blockedDates
                      .filter(b => b.start_time && b.end_time)
                      .map((blocked, index) => (
                        <div key={blocked.id}>
                          {blocked.start_time.slice(0, 5)} - {blocked.end_time.slice(0, 5)}
                          {blocked.reason && ` (${blocked.reason})`}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="startTime">Ora început *</Label>
                <Select 
                  value={startTime} 
                  onValueChange={setStartTime}
                  disabled={isDateFullyBlocked(bookingDate || new Date())}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selectează ora" />
                  </SelectTrigger>
                   <SelectContent>
                     {(() => {
                       const availableTimes = getTimeOptions()
                         .filter(time => {
                           // If end time is selected, only show start times that are before it
                           if (endTime && time.value >= endTime) return false;
                           
                           // Check for conflicts with existing bookings
                           const hasBookingConflict = existingBookings.some(booking => {
                             const bookingStart = booking.start_time.slice(0, 5);
                             const bookingEnd = booking.end_time.slice(0, 5);
                             return time.value >= bookingStart && time.value < bookingEnd;
                           });
                           
                           // Check for conflicts with blocked hours
                           const hasBlockConflict = blockedDates.some(blocked => {
                             if (!blocked.start_time || !blocked.end_time) return false;
                             const blockedStart = blocked.start_time.slice(0, 5);
                             const blockedEnd = blocked.end_time.slice(0, 5);
                             return time.value >= blockedStart && time.value < blockedEnd;
                           });
                           
                           return !hasBookingConflict && !hasBlockConflict;
                         });
                       
                       if (availableTimes.length === 0) {
                         return (
                           <div className="p-3 text-sm text-muted-foreground text-center">
                             Nu există ore disponibile<br/>
                             <span className="text-xs">(toate orele sunt rezervate sau blocate)</span>
                           </div>
                         );
                       }
                       
                       return availableTimes.map((time) => (
                         <SelectItem key={time.value} value={time.value}>
                           {time.label}
                         </SelectItem>
                       ));
                     })()}
                   </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Ora sfârșit *</Label>
                <Select 
                  value={endTime} 
                  onValueChange={setEndTime} 
                  disabled={!startTime || isDateFullyBlocked(bookingDate || new Date())}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selectează ora" />
                  </SelectTrigger>
                   <SelectContent>
                     {(() => {
                       if (!startTime) {
                         return (
                           <div className="p-3 text-sm text-muted-foreground text-center">
                             Selectează mai întâi ora de început
                           </div>
                         );
                       }
                       
                       const availableTimes = getTimeOptions()
                         .filter(time => {
                           // Only show times after start time
                           if (time.value <= startTime) return false;
                           
                           // Check if this end time would create conflicts with existing bookings
                           const hasBookingConflict = existingBookings.some(booking => {
                             const bookingStart = booking.start_time.slice(0, 5);
                             const bookingEnd = booking.end_time.slice(0, 5);
                             // Check if the proposed booking period overlaps with any existing booking
                             return (startTime < bookingEnd && time.value > bookingStart);
                           });
                           
                           // Check if this end time would create conflicts with blocked hours
                           const hasBlockConflict = blockedDates.some(blocked => {
                             if (!blocked.start_time || !blocked.end_time) return false;
                             const blockedStart = blocked.start_time.slice(0, 5);
                             const blockedEnd = blocked.end_time.slice(0, 5);
                             // Check if the proposed booking period overlaps with any blocked period
                             return (startTime < blockedEnd && time.value > blockedStart);
                           });
                           
                           return !hasBookingConflict && !hasBlockConflict;
                         });
                       
                       if (availableTimes.length === 0) {
                         return (
                           <div className="p-3 text-sm text-muted-foreground text-center">
                             Nu există ore disponibile după {startTime}<br/>
                             <span className="text-xs">(conflicte cu rezervări existente sau ore blocate)</span>
                           </div>
                         );
                       }
                       
                       return availableTimes.map((time) => (
                         <SelectItem key={time.value} value={time.value}>
                           {time.label}
                         </SelectItem>
                       ));
                     })()}
                   </SelectContent>
                </Select>
              </div>
            </div>

            {/* Price Display */}
            {startTime && endTime && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Preț total:</span>
                  <span className="font-bold text-lg">{calculatePrice().toFixed(2)} RON</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {((new Date(`2000-01-01T${endTime}:00`).getTime() - new Date(`2000-01-01T${startTime}:00`).getTime()) / (1000 * 60 * 60)).toFixed(1)} ore × {facility?.price_per_hour || 0} RON/oră
                </p>
              </div>
            )}
          </div>

          {/* Recurring Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="recurring" 
                checked={isRecurring}
                onCheckedChange={(checked) => {
                  setIsRecurring(!!checked);
                  // Auto-select end date as one week later when enabling recurring
                  if (checked && bookingDate) {
                    setRecurringEndDate(addWeeks(bookingDate, 1));
                  }
                }}
              />
              <Label htmlFor="recurring" className="flex items-center gap-2">
                <Repeat className="h-4 w-4" />
                Rezervare recurentă săptămânală
              </Label>
            </div>
            
            {isRecurring && (
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                  <Label>Data de sfârșit</Label>
                  <Calendar
                    mode="single"
                    selected={recurringEndDate}
                    onSelect={setRecurringEndDate}
                    disabled={(date) => !bookingDate || date <= bookingDate}
                    className="rounded-md border p-3 pointer-events-auto"
                    weekStartsOn={1}
                    locale={ro}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Note suplimentare (opțional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalii suplimentare despre rezervare..."
            />
          </div>

          {/* Warning */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              ⚠️ Această rezervare va fi marcată clar că nu a fost făcută prin site și va apărea în lista de rezervări cu această mențiune.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleSubmit} 
              disabled={isLoading || !clientName.trim() || !bookingDate || !startTime || !endTime}
              className="flex-1"
            >
              {isLoading ? 'Se creează...' : (isRecurring ? 'Creează Rezervările' : 'Creează Rezervarea')}
            </Button>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Anulează
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddManualBookingDialog;
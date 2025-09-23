import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { TimePicker } from "@/components/ui/time-picker";
import { Plus, Repeat, UserPlus } from "lucide-react";
import { format, addDays, addWeeks, getDay } from "date-fns";
import { ro } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AddManualBookingDialogProps {
  facilityId: string;
  onBookingAdded: () => void;
  selectedDate?: Date;
}

const AddManualBookingDialog = ({ facilityId, onBookingAdded, selectedDate }: AddManualBookingDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [bookingDate, setBookingDate] = useState<Date | undefined>(selectedDate || new Date());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState<'weekly'>('weekly');
  const [recurringEndDate, setRecurringEndDate] = useState<Date>();
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const { toast } = useToast();

  const weekdayLabels = [
    { value: 1, label: 'Luni' },
    { value: 2, label: 'Marți' },
    { value: 3, label: 'Miercuri' },
    { value: 4, label: 'Joi' },
    { value: 5, label: 'Vineri' },
    { value: 6, label: 'Sâmbătă' },
    { value: 0, label: 'Duminică' }
  ];

  const generateRecurringDates = (startDate: Date, endDate: Date, selectedDays?: number[]) => {
    const dates = [];
    let currentDate = new Date(startDate);
    
    if (selectedDays && selectedDays.length > 0) {
      while (currentDate <= endDate) {
        const dayOfWeek = getDay(currentDate);
        if (selectedDays.includes(dayOfWeek)) {
          dates.push(new Date(currentDate));
        }
        currentDate = addDays(currentDate, 1);
      }
    } else {
      // Weekly pentru aceeași zi din săptămână ca startDate
      const startDayOfWeek = getDay(startDate);
      while (currentDate <= endDate) {
        if (getDay(currentDate) === startDayOfWeek) {
          dates.push(new Date(currentDate));
        }
        currentDate = addDays(currentDate, 1);
      }
    }
    
    return dates;
  };

  const handleSubmit = async () => {
    if (!bookingDate || !startTime || !endTime || !clientName.trim() || !price) {
      toast({
        title: "Eroare",
        description: "Te rugăm să completezi toate câmpurile obligatorii",
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
        const daysToUse = weeklyDays.length > 0 ? weeklyDays : [getDay(bookingDate)];
        datesToBook = generateRecurringDates(bookingDate, recurringEndDate, daysToUse);
      }

      // Create a temporary client profile for manual bookings
      const tempClientId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const bookingsToInsert = datesToBook.map(date => ({
        client_id: user.id, // Use facility owner as client_id for manual bookings
        facility_id: facilityId,
        booking_date: format(date, 'yyyy-MM-dd'),
        start_time: startTime + ':00',
        end_time: endTime + ':00',
        total_price: parseFloat(price),
        total_amount: parseFloat(price),
        platform_fee_amount: 0, // No platform fee for manual bookings
        facility_owner_amount: parseFloat(price),
        payment_method: 'manual',
        status: 'confirmed' as const,
        notes: `REZERVARE MANUALĂ - Client: ${clientName}${clientPhone ? ` (${clientPhone})` : ''}${notes ? ` | Note: ${notes}` : ''} | Nu realizată prin site`
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
      setPrice("");
      setNotes("");
      setIsRecurring(false);
      setRecurringEndDate(undefined);
      setWeeklyDays([]);
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
                onSelect={setBookingDate}
                className="rounded-md border p-3 pointer-events-auto"
                disabled={(date) => date < new Date()}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="startTime">Ora început *</Label>
                <TimePicker
                  id="startTime"
                  value={startTime}
                  onChange={setStartTime}
                  placeholder="HH:MM"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Ora sfârșit *</Label>
                <TimePicker
                  id="endTime"
                  value={endTime}
                  onChange={setEndTime}
                  placeholder="HH:MM"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Preț (RON) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Recurring Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="recurring" 
                checked={isRecurring}
                onCheckedChange={(checked) => setIsRecurring(!!checked)}
              />
              <Label htmlFor="recurring" className="flex items-center gap-2">
                <Repeat className="h-4 w-4" />
                Rezervare recurentă
              </Label>
            </div>
            
            {isRecurring && (
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                  <Label>Tip recurență</Label>
                  <Select value={recurringType} onValueChange={(value: 'weekly') => setRecurringType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Săptămânal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {recurringType === 'weekly' && (
                  <div className="space-y-2">
                    <Label>Zilele săptămânii (opțional)</Label>
                    <div className="p-3 bg-blue-50 rounded-lg mb-3">
                      <p className="text-sm text-blue-700">
                        💡 Implicit se va crea rezervare pentru <strong>{weekdayLabels.find(day => day.value === getDay(bookingDate || new Date()))?.label}</strong>
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        Selectează alte zile doar dacă vrei să adaugi rezervări în zile suplimentare
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {weekdayLabels.map((day) => (
                        <div key={day.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`day-${day.value}`}
                            checked={weeklyDays.includes(day.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setWeeklyDays([...weeklyDays, day.value]);
                              } else {
                                setWeeklyDays(weeklyDays.filter(d => d !== day.value));
                              }
                            }}
                          />
                          <Label htmlFor={`day-${day.value}`} className="text-sm">
                            {day.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label>Data de sfârșit</Label>
                  <Calendar
                    mode="single"
                    selected={recurringEndDate}
                    onSelect={setRecurringEndDate}
                    disabled={(date) => !bookingDate || date <= bookingDate}
                    className="rounded-md border p-3 pointer-events-auto"
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
              disabled={isLoading || !clientName.trim() || !bookingDate || !startTime || !endTime || !price}
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
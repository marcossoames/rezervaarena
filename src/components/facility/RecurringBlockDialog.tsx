import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Repeat, CalendarOff } from "lucide-react";
import { format, addDays } from "date-fns";
import { ro } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface RecurringBlockDialogProps {
  facilityId: string;
  onBlockingAdded: () => void;
}

const RecurringBlockDialog = ({ facilityId, onBlockingAdded }: RecurringBlockDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(addDays(new Date(), 30));
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [reason, setReason] = useState("");
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

  const handleDayToggle = (dayValue: number) => {
    setSelectedDays(prev => 
      prev.includes(dayValue) 
        ? prev.filter(d => d !== dayValue)
        : [...prev, dayValue]
    );
  };

  const handleSubmit = async () => {
    if (selectedDays.length === 0) {
      toast({
        title: "Eroare",
        description: "Te rugăm să selectezi cel puțin o zi din săptămână",
        variant: "destructive"
      });
      return;
    }

    if (!endDate || endDate <= startDate) {
      toast({
        title: "Eroare",
        description: "Data de sfârșit trebuie să fie după data de început",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create recurring blocked dates for each selected day
      const recurringBlocks = selectedDays.map(dayOfWeek => ({
        facility_id: facilityId,
        day_of_week: dayOfWeek,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        reason: reason.trim() || 'Blocaj recurent săptămânal',
        created_by: user.id
      }));

      const { error } = await supabase
        .from('recurring_blocked_dates')
        .insert(recurringBlocks);

      if (error) {
        throw error;
      }

      toast({
        title: "Blocaj recurent adăugat",
        description: `Zilele selectate vor fi blocate săptămânal din ${format(startDate, 'dd MMM yyyy', { locale: ro })} până în ${format(endDate, 'dd MMM yyyy', { locale: ro })}`
      });

      // Reset form
      setStartDate(new Date());
      setEndDate(addDays(new Date(), 30));
      setSelectedDays([]);
      setReason("");
      setIsOpen(false);
      
      onBlockingAdded();
    } catch (error) {
      console.error('Error creating recurring block:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut crea blocajul recurent",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Repeat className="h-4 w-4 mr-2" />
          Blocaj Recurent
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5" />
            Adaugă Blocaj Recurent Săptămânal
          </DialogTitle>
          <DialogDescription>
            Blochează anumite zile din săptămână pentru o perioadă determinată
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Period Selection */}
          <div className="space-y-4">
            <h4 className="font-medium">Perioada Blocajului</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de început</Label>
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  className="rounded-md border p-3"
                  disabled={(date) => date < new Date()}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Data de sfârșit</Label>
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  className="rounded-md border p-3"
                  disabled={(date) => date <= startDate}
                />
              </div>
            </div>
          </div>

          {/* Days Selection */}
          <div className="space-y-3">
            <h4 className="font-medium">Zile din săptămână de blocat</h4>
            <div className="grid grid-cols-2 gap-3">
              {weekdayLabels.map((day) => (
                <div key={day.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`day-${day.value}`}
                    checked={selectedDays.includes(day.value)}
                    onCheckedChange={() => handleDayToggle(day.value)}
                  />
                  <Label 
                    htmlFor={`day-${day.value}`} 
                    className="text-sm font-normal cursor-pointer"
                  >
                    {day.label}
                  </Label>
                </div>
              ))}
            </div>
            
            {selectedDays.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Selectează cel puțin o zi din săptămână
              </p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motiv (opțional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Zi de odihnă, întreținere facilitate, etc."
              rows={3}
            />
          </div>

          {/* Preview */}
          {selectedDays.length > 0 && endDate && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <h5 className="font-medium mb-2">Previzualizare blocaj:</h5>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <strong>Perioada:</strong> {format(startDate, 'dd MMM yyyy', { locale: ro })} - {format(endDate, 'dd MMM yyyy', { locale: ro })}
                </p>
                <p>
                  <strong>Zile blocate:</strong> {selectedDays.map(d => weekdayLabels.find(w => w.value === d)?.label).join(', ')}
                </p>
                <p>
                  <strong>Motiv:</strong> {reason.trim() || 'Blocaj recurent săptămânal'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
            Anulează
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || selectedDays.length === 0}>
            {isLoading ? "Se adaugă..." : "Adaugă Blocaj Recurent"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecurringBlockDialog;
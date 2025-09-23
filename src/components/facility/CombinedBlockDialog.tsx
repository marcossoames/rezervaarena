import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { CalendarOff, Ban } from "lucide-react";
import { format, addDays } from "date-fns";
import { ro } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CombinedBlockDialogProps {
  facilityId: string;
  selectedDate: Date;
  onBlockingAdded: () => void;
  hasExistingBookings: boolean;
}

const CombinedBlockDialog = ({ 
  facilityId, 
  selectedDate, 
  onBlockingAdded,
  hasExistingBookings 
}: CombinedBlockDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [blockType, setBlockType] = useState<'single' | 'recurring'>('single');
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Recurring options
  const [startDate, setStartDate] = useState<Date>(selectedDate);
  const [endDate, setEndDate] = useState<Date | undefined>(addDays(selectedDate, 30));
  const [selectedDays, setSelectedDays] = useState<number[]>([selectedDate.getDay()]);
  
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

  const resetForm = () => {
    setBlockType('single');
    setReason("");
    setStartDate(selectedDate);
    setEndDate(addDays(selectedDate, 30));
    setSelectedDays([selectedDate.getDay()]);
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast({
        title: "Eroare",
        description: "Te rugăm să introduci motivul blocării",
        variant: "destructive"
      });
      return;
    }

    if (blockType === 'recurring') {
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
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (blockType === 'single') {
        // Block single day
        const { error } = await supabase
          .from('blocked_dates')
          .insert({
            facility_id: facilityId,
            blocked_date: format(selectedDate, 'yyyy-MM-dd'),
            start_time: null, // Full day block
            end_time: null,
            reason: reason.trim(),
            created_by: user.id
          });

        if (error) throw error;

        toast({
          title: "Zi blocată",
          description: `Ziua de ${format(selectedDate, 'dd MMM yyyy', { locale: ro })} a fost blocată complet`
        });
      } else {
        // Create recurring blocked dates
        const recurringBlocks = selectedDays.map(dayOfWeek => ({
          facility_id: facilityId,
          day_of_week: dayOfWeek,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          reason: reason.trim(),
          created_by: user.id
        }));

        const { error } = await supabase
          .from('recurring_blocked_dates')
          .insert(recurringBlocks);

        if (error) throw error;

        const dayNames = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
        const selectedDayNames = selectedDays.map(d => dayNames[d]).join(', ');

        toast({
          title: "Blocaj recurent adăugat",
          description: `Zilele de ${selectedDayNames} vor fi blocate săptămânal din ${format(startDate, 'dd MMM yyyy', { locale: ro })} până în ${format(endDate, 'dd MMM yyyy', { locale: ro })}`
        });
      }

      resetForm();
      setIsOpen(false);
      onBlockingAdded();
    } catch (error) {
      console.error('Error creating block:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut crea blocajul",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // If there are existing bookings, show a message instead of the dialog
  if (hasExistingBookings) {
    return (
      <div className="p-3 bg-muted/50 rounded-lg border border-dashed">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Ban className="h-4 w-4" />
          <span>Nu se poate bloca ziua - există rezervări active</span>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <CalendarOff className="h-4 w-4 mr-2" />
          Blochează Ziua
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5" />
            Blochează Ziua
          </DialogTitle>
          <DialogDescription>
            Alege să blochezi doar această zi sau să creezi un blocaj recurent
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Block Type Selection */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Tip de blocaj</Label>
            <RadioGroup
              value={blockType}
              onValueChange={(value) => setBlockType(value as 'single' | 'recurring')}
              className="grid grid-cols-1 gap-4"
            >
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="single" id="single" />
                <Label htmlFor="single" className="flex-1 cursor-pointer">
                  <div className="font-medium">Blochează doar această zi</div>
                  <div className="text-sm text-muted-foreground">
                    {format(selectedDate, 'EEEE, dd MMMM yyyy', { locale: ro })}
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="recurring" id="recurring" />
                <Label htmlFor="recurring" className="flex-1 cursor-pointer">
                  <div className="font-medium">Blocaj recurent săptămânal</div>
                  <div className="text-sm text-muted-foreground">
                    Blochează anumite zile din săptămână pentru o perioadă
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Recurring Options */}
          {blockType === 'recurring' && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
              <h4 className="font-medium">Setări blocaj recurent</h4>
              
              {/* Period Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de început</Label>
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    className="rounded-md border p-2"
                    disabled={(date) => date < new Date()}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Data de sfârșit</Label>
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    className="rounded-md border p-2"
                    disabled={(date) => date <= startDate}
                  />
                </div>
              </div>

              {/* Days Selection */}
              <div className="space-y-3">
                <Label>Zile din săptămână de blocat</Label>
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
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motiv blocare *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Întreținere, eveniment privat, zi de odihnă, etc."
              rows={3}
            />
          </div>

          {/* Preview */}
          {reason.trim() && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <h5 className="font-medium mb-2">Previzualizare blocaj:</h5>
              <div className="text-sm text-muted-foreground space-y-1">
                {blockType === 'single' ? (
                  <>
                    <p><strong>Tip:</strong> Blocaj pentru o singură zi</p>
                    <p><strong>Data:</strong> {format(selectedDate, 'dd MMM yyyy', { locale: ro })}</p>
                  </>
                ) : (
                  <>
                    <p><strong>Tip:</strong> Blocaj recurent săptămânal</p>
                    <p><strong>Perioada:</strong> {format(startDate, 'dd MMM yyyy', { locale: ro })} - {endDate && format(endDate, 'dd MMM yyyy', { locale: ro })}</p>
                    <p><strong>Zile:</strong> {selectedDays.map(d => weekdayLabels.find(w => w.value === d)?.label).join(', ')}</p>
                  </>
                )}
                <p><strong>Motiv:</strong> {reason.trim()}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
            Anulează
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !reason.trim() || (blockType === 'recurring' && selectedDays.length === 0)}
          >
            {isLoading ? "Se blochează..." : "Blochează"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CombinedBlockDialog;
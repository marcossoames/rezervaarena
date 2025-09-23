import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, Trash2, Calendar, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface UnblockRecurringDialogProps {
  facilityId: string;
  selectedDate: Date;
  blockedDates: Array<{
    id: string;
    blocked_date: string;
    start_time?: string;
    end_time?: string;
    reason?: string;
  }>;
  onUnblockComplete: () => void;
}

const UnblockRecurringDialog = ({ 
  facilityId, 
  selectedDate, 
  blockedDates, 
  onUnblockComplete 
}: UnblockRecurringDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'single' | 'all'>('single');
  const [isLoading, setIsLoading] = useState(false);
  
  const { toast } = useToast();

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayOfWeek = selectedDate.getDay();
  
  // Check if this is a recurring block by looking for similar blocks on same day of week
  const isRecurringBlock = blockedDates.some(block => {
    const blockDate = new Date(block.blocked_date);
    return blockDate.getDay() === dayOfWeek && 
           block.blocked_date !== selectedDateStr &&
           !block.start_time && !block.end_time; // Full day blocks only
  });

  const getRecurringBlockCount = () => {
    return blockedDates.filter(block => {
      const blockDate = new Date(block.blocked_date);
      return blockDate.getDay() === dayOfWeek && 
             !block.start_time && !block.end_time;
    }).length;
  };

  const handleUnblock = async () => {
    setIsLoading(true);

    try {
      if (selectedOption === 'single') {
        // Delete only blocks for the selected date
        const { error } = await supabase
          .from('blocked_dates')
          .delete()
          .eq('facility_id', facilityId)
          .eq('blocked_date', selectedDateStr);

        if (error) throw error;

        toast({
          title: "Zi deblocată",
          description: `Ziua de ${format(selectedDate, 'dd MMM yyyy', { locale: ro })} a fost deblocată`
        });
      } else {
        // Delete all recurring blocks for this day of week
        const recurringBlockDates = blockedDates
          .filter(block => {
            const blockDate = new Date(block.blocked_date);
            return blockDate.getDay() === dayOfWeek && 
                   !block.start_time && !block.end_time;
          })
          .map(block => block.blocked_date);

        const { error } = await supabase
          .from('blocked_dates')
          .delete()
          .eq('facility_id', facilityId)
          .in('blocked_date', recurringBlockDates);

        if (error) throw error;

        // Also delete from recurring_blocked_dates table if exists
        await supabase
          .from('recurring_blocked_dates')
          .delete()
          .eq('facility_id', facilityId)
          .eq('day_of_week', dayOfWeek);

        const dayNames = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
        
        toast({
          title: "Blocaj recurent eliminat",
          description: `Toate zilele de ${dayNames[dayOfWeek]} blocate (${recurringBlockDates.length} zile) au fost deblicate`
        });
      }

      setIsOpen(false);
      onUnblockComplete();
    } catch (error) {
      console.error('Error unblocking:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut debloca ziua/zilele selectate",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const dayNames = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Eye className="h-4 w-4 mr-2" />
          Deblochează Ziua
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Deblochează Ziua
          </DialogTitle>
          <DialogDescription>
            Alege cum vrei să deblochezi ziua de {format(selectedDate, 'dd MMMM yyyy', { locale: ro })}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Single day option */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="single"
                checked={selectedOption === 'single'}
                onCheckedChange={() => setSelectedOption('single')}
              />
              <Label htmlFor="single" className="text-sm font-normal">
                Deblochează doar această zi ({format(selectedDate, 'dd MMM yyyy', { locale: ro })})
              </Label>
            </div>

            {/* Recurring option - only show if there are recurring blocks */}
            {isRecurringBlock && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="all"
                  checked={selectedOption === 'all'}
                  onCheckedChange={() => setSelectedOption('all')}
                />
                <Label htmlFor="all" className="text-sm font-normal">
                  Deblochează toate zilele de {dayNames[dayOfWeek]} ({getRecurringBlockCount()} zile)
                </Label>
              </div>
            )}
          </div>

          {/* Warning for recurring option */}
          {selectedOption === 'all' && isRecurringBlock && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700">
                <strong>Atenție:</strong> Această acțiune va debloca toate zilele de {dayNames[dayOfWeek]} 
                din blocajul recurent ({getRecurringBlockCount()} zile în total). 
                Acțiunea nu poate fi anulată.
              </AlertDescription>
            </Alert>
          )}

          {/* No recurring blocks info */}
          {!isRecurringBlock && (
            <Alert className="border-blue-200 bg-blue-50">
              <Calendar className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                Această zi nu face parte dintr-un blocaj recurent. 
                Doar ziua selectată va fi deblocată.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
            Anulează
          </Button>
          <Button onClick={handleUnblock} disabled={isLoading}>
            {isLoading ? "Se deblochează..." : "Deblochează"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UnblockRecurringDialog;
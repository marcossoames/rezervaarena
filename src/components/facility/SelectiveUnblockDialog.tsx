import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, Trash2, Clock, Calendar, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface BlockedTimeSlot {
  id: string;
  blocked_date: string;
  start_time?: string;
  end_time?: string;
  reason?: string;
}

interface SelectiveUnblockDialogProps {
  facilityId: string;
  selectedDate: Date;
  blockedTimeSlots: BlockedTimeSlot[];
  onUnblockComplete: () => void;
  isAdmin?: boolean;
}

const SelectiveUnblockDialog = ({ 
  facilityId, 
  selectedDate, 
  blockedTimeSlots, 
  onUnblockComplete,
  isAdmin = false
}: SelectiveUnblockDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const { toast } = useToast();

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  
  // Filter slots for the selected date
  const dayBlockedSlots = blockedTimeSlots.filter(slot => 
    slot.blocked_date === selectedDateStr
  );

  // Separate full day blocks and time-specific blocks
  const fullDayBlocks = dayBlockedSlots.filter(slot => !slot.start_time && !slot.end_time);
  const timeSpecificBlocks = dayBlockedSlots.filter(slot => slot.start_time && slot.end_time);

  const hasMultipleSlots = dayBlockedSlots.length > 1;

  const toggleSlotSelection = (slotId: string) => {
    setSelectedSlots(prev => 
      prev.includes(slotId) 
        ? prev.filter(id => id !== slotId)
        : [...prev, slotId]
    );
  };

  const selectAllSlots = () => {
    setSelectedSlots(dayBlockedSlots.map(slot => slot.id));
  };

  const clearSelection = () => {
    setSelectedSlots([]);
  };

  const handleUnblock = async () => {
    if (selectedSlots.length === 0) {
      toast({
        title: "Selectie goală",
        description: "Te rugăm să selectezi cel puțin un interval pentru deblocare",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('blocked_dates')
        .delete()
        .in('id', selectedSlots);

      if (error) throw error;

      const unblockedCount = selectedSlots.length;
      const selectedSlotsData = dayBlockedSlots.filter(slot => selectedSlots.includes(slot.id));
      
      let description = "";
      if (selectedSlotsData.some(slot => !slot.start_time)) {
        description = `${unblockedCount} blocaj${unblockedCount > 1 ? 'e' : ''} eliminat${unblockedCount > 1 ? 'e' : ''}`;
      } else {
        description = `${unblockedCount} interval${unblockedCount > 1 ? 'e orare' : ' orar'} deblocat${unblockedCount > 1 ? 'e' : ''}`;
      }

      toast({
        title: "Deblocare realizată",
        description: description
      });

      setIsOpen(false);
      setSelectedSlots([]);
      onUnblockComplete();
    } catch (error) {
      console.error('Error unblocking slots:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut debloca intervalele selectate",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeSlot = (slot: BlockedTimeSlot) => {
    if (!slot.start_time || !slot.end_time) {
      return "Ziua întreagă";
    }
    return `${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)}`;
  };

  if (dayBlockedSlots.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Eye className="h-4 w-4 mr-2" />
          {hasMultipleSlots ? "Selectează pentru Deblocare" : "Deblochează"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Deblochează Intervale
          </DialogTitle>
          <DialogDescription>
            Selectează intervalele pe care vrei să le deblochezi pentru {format(selectedDate, 'dd MMMM yyyy', { locale: ro })}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {hasMultipleSlots && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={selectAllSlots}
                disabled={selectedSlots.length === dayBlockedSlots.length}
              >
                Selectează Tot
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearSelection}
                disabled={selectedSlots.length === 0}
              >
                Deselectează Tot
              </Button>
            </div>
          )}

          {/* Full day blocks */}
          {fullDayBlocks.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Blocaje pentru ziua întreagă
              </Label>
              {fullDayBlocks.map(slot => (
                <div key={slot.id} className="flex items-center space-x-2 p-3 border rounded-lg">
                  <Checkbox
                    id={slot.id}
                    checked={selectedSlots.includes(slot.id)}
                    onCheckedChange={() => toggleSlotSelection(slot.id)}
                  />
                  <div className="flex-1">
                    <Label htmlFor={slot.id} className="text-sm font-normal cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        <span>Ziua întreagă</span>
                      </div>
                      {slot.reason && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Motiv: {slot.reason}
                        </p>
                      )}
                    </Label>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Time-specific blocks */}
          {timeSpecificBlocks.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Blocaje pentru anumite ore
              </Label>
              {timeSpecificBlocks.map(slot => (
                <div key={slot.id} className="flex items-center space-x-2 p-3 border rounded-lg">
                  <Checkbox
                    id={slot.id}
                    checked={selectedSlots.includes(slot.id)}
                    onCheckedChange={() => toggleSlotSelection(slot.id)}
                  />
                  <div className="flex-1">
                    <Label htmlFor={slot.id} className="text-sm font-normal cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-green-600" />
                        <span className="font-medium">{formatTimeSlot(slot)}</span>
                      </div>
                      {slot.reason && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Motiv: {slot.reason}
                        </p>
                      )}
                    </Label>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Selection info */}
          {selectedSlots.length > 0 && (
            <Alert className="border-blue-200 bg-blue-50">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                <strong>{selectedSlots.length}</strong> interval{selectedSlots.length > 1 ? 'e' : ''} selectat{selectedSlots.length > 1 ? 'e' : ''} pentru deblocare.
                {isAdmin && (
                  <span className="block mt-1 text-xs">
                    Admin: Poți debloca orice interval pentru această facilitate.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
            Anulează
          </Button>
          <Button 
            onClick={handleUnblock} 
            disabled={isLoading || selectedSlots.length === 0}
          >
            {isLoading ? "Se deblochează..." : `Deblochează (${selectedSlots.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SelectiveUnblockDialog;
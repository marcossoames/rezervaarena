import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface DailyHours {
  monday?: { start: string; end: string } | null;
  tuesday?: { start: string; end: string } | null;
  wednesday?: { start: string; end: string } | null;
  thursday?: { start: string; end: string } | null;
  friday?: { start: string; end: string } | null;
  saturday?: { start: string; end: string } | null;
  sunday?: { start: string; end: string } | null;
}

interface DailyHoursEditorProps {
  value: DailyHours;
  onChange: (value: DailyHours) => void;
  defaultStart?: string;
  defaultEnd?: string;
}

const DAYS = [
  { key: 'monday', label: 'Luni' },
  { key: 'tuesday', label: 'Marți' },
  { key: 'wednesday', label: 'Miercuri' },
  { key: 'thursday', label: 'Joi' },
  { key: 'friday', label: 'Vineri' },
  { key: 'saturday', label: 'Sâmbătă' },
  { key: 'sunday', label: 'Duminică' },
] as const;

export function DailyHoursEditor({ value, onChange, defaultStart = "08:00", defaultEnd = "22:00" }: DailyHoursEditorProps) {
  const handleDayToggle = (dayKey: string, checked: boolean) => {
    const newValue = { ...value };
    if (checked) {
      newValue[dayKey as keyof DailyHours] = { start: defaultStart, end: defaultEnd };
    } else {
      newValue[dayKey as keyof DailyHours] = null;
    }
    onChange(newValue);
  };

  const handleTimeChange = (dayKey: string, field: 'start' | 'end', time: string) => {
    const newValue = { ...value };
    const currentDay = newValue[dayKey as keyof DailyHours];
    if (currentDay) {
      newValue[dayKey as keyof DailyHours] = {
        ...currentDay,
        [field]: time
      };
      onChange(newValue);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-primary" />
        <Label className="text-base font-semibold">Program zilnic</Label>
      </div>
      
      <Card>
        <CardContent className="pt-6 space-y-4">
          {DAYS.map(({ key, label }) => {
            const dayHours = value[key as keyof DailyHours];
            const isOpen = dayHours !== null && dayHours !== undefined;
            
            return (
              <div key={key} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center space-x-3 min-w-[120px]">
                  <Checkbox
                    id={`day-${key}`}
                    checked={isOpen}
                    onCheckedChange={(checked) => handleDayToggle(key, checked as boolean)}
                  />
                  <Label htmlFor={`day-${key}`} className="cursor-pointer font-medium">
                    {label}
                  </Label>
                </div>
                
                {isOpen && dayHours ? (
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground">Deschidere:</Label>
                      <input
                        type="time"
                        value={dayHours.start}
                        onChange={(e) => handleTimeChange(key, 'start', e.target.value)}
                        className="px-3 py-1.5 rounded-md border border-border bg-background text-sm"
                      />
                    </div>
                    <span className="text-muted-foreground">-</span>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground">Închidere:</Label>
                      <input
                        type="time"
                        value={dayHours.end}
                        onChange={(e) => handleTimeChange(key, 'end', e.target.value)}
                        className="px-3 py-1.5 rounded-md border border-border bg-background text-sm"
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground italic">Închis</span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
      
      <p className="text-sm text-muted-foreground">
        Bifează zilele când facilitatea este deschisă și setează programul. Zilele nebifate vor apărea ca închise în calendar.
      </p>
    </div>
  );
}

import * as React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { format, isSameDay } from "date-fns";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type EnhancedCalendarProps = React.ComponentProps<typeof DayPicker> & {
  blockedDates?: Set<string> | string[];
  partiallyBlockedDates?: Set<string> | string[];
};

function EnhancedCalendar({
  className,
  classNames,
  showOutsideDays = true,
  blockedDates = new Set(),
  partiallyBlockedDates = new Set(),
  ...props
}: EnhancedCalendarProps) {
  const blockedDatesSet = React.useMemo(() => {
    if (Array.isArray(blockedDates)) {
      return new Set(blockedDates);
    }
    return blockedDates;
  }, [blockedDates]);

  const partiallyBlockedDatesSet = React.useMemo(() => {
    if (Array.isArray(partiallyBlockedDates)) {
      return new Set(partiallyBlockedDates);
    }
    return partiallyBlockedDates;
  }, [partiallyBlockedDates]);

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 pointer-events-auto", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100 relative"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-lg border-2 border-primary/20",
        day_today: "bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 text-white font-bold shadow-lg border-2 border-orange-300/50 ring-2 ring-orange-200/30",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      modifiers={{
        fullyBlocked: (date) => {
          const dateString = format(date, 'yyyy-MM-dd');
          return blockedDatesSet.has(dateString);
        }
      }}
      modifiersClassNames={{
        fullyBlocked: "bg-gradient-to-br from-red-50 to-red-100 text-red-700 border-2 border-red-200 shadow-sm relative after:content-['✕'] after:absolute after:inset-0 after:flex after:items-center after:justify-center after:text-red-500 after:font-bold after:text-lg after:drop-shadow-sm"
      }}
      disabled={(date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const maxDate = new Date(today);
        maxDate.setDate(today.getDate() + 14);
        
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        
        const dateString = format(date, 'yyyy-MM-dd');
        const isFullyBlocked = blockedDatesSet.has(dateString);
        
        return targetDate < today || targetDate > maxDate || isFullyBlocked;
      }}
      {...props}
    />
  );
}
EnhancedCalendar.displayName = "EnhancedCalendar";

export { EnhancedCalendar };
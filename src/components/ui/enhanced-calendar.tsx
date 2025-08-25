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

  const today = React.useMemo(() => new Date(), []);

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
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
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold shadow-lg border-2 border-amber-300",
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
        Day: (dayProps) => {
          const { date } = dayProps;
          const dateString = format(date, 'yyyy-MM-dd');
          const isFullyBlocked = blockedDatesSet.has(dateString);
          const isPartiallyBlocked = partiallyBlockedDatesSet.has(dateString);
          const isToday = isSameDay(date, today);
          const isSelected = props.selected && isSameDay(date, props.selected as Date);
          
          // Check if the date is disabled by the parent disabled prop
          const isDisabled = props.disabled && typeof props.disabled === 'function' 
            ? props.disabled(date) 
            : false;
          
          return (
            <div className="relative w-9 h-9">
              <button
                {...dayProps}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-9 w-9 p-0 font-normal relative",
                  // Today styling - golden/orange gradient with bold border
                  isToday && !isSelected && "bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold shadow-lg border-2 border-amber-300",
                  // Selected styling - primary color
                  isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  // Today + Selected styling - enhanced primary with gold accent
                  isToday && isSelected && "bg-primary text-primary-foreground border-2 border-amber-300 shadow-lg",
                  // Fully blocked styling
                  isFullyBlocked && "bg-red-100 text-red-600 line-through opacity-75 cursor-not-allowed",
                  // Partially blocked styling
                  isPartiallyBlocked && !isFullyBlocked && "bg-orange-100 text-orange-600 border border-orange-300",
                  // Disabled styling
                  isDisabled && "text-muted-foreground opacity-50"
                )}
                disabled={isDisabled || isFullyBlocked}
              >
                <span className={cn((isFullyBlocked || isPartiallyBlocked) && "relative z-10")}>
                  {date.getDate()}
                </span>
                {isFullyBlocked && (
                  <X className="absolute inset-0 w-4 h-4 m-auto text-red-500 z-20" strokeWidth={3} />
                )}
                {isPartiallyBlocked && !isFullyBlocked && (
                  <div className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full z-20" />
                )}
              </button>
            </div>
          );
        },
      }}
      {...props}
    />
  );
}
EnhancedCalendar.displayName = "EnhancedCalendar";

export { EnhancedCalendar };
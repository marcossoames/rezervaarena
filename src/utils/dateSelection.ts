import { addDays, startOfDay } from "date-fns";

export const getInitialSearchDate = (): Date => {
  const now = new Date();
  const lastBookingHour = 22;
  
  if (now.getHours() >= lastBookingHour) {
    return startOfDay(addDays(now, 1));
  }
  
  return startOfDay(now);
};

export const hasAvailableHoursToday = (): boolean => {
  return new Date().getHours() < 22;
};
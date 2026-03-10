import { startOfDay, isBefore, isAfter, isToday } from "date-fns";

export const isBookingTimeAllowed = (date: Date, timeString: string): boolean => {
  const now = new Date();
  const selectedDate = startOfDay(date);
  const today = startOfDay(now);
  
  if (isBefore(selectedDate, today)) return false;
  
  if (isToday(selectedDate)) {
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [hourStr, minuteStr] = timeString.split(':');
    const selectedTime = parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10);
    if (selectedTime <= currentTime) return false;
  }
  
  return true;
};

export const getMinimumAllowedTime = (date: Date, facilityOpeningTime = "08:00"): string => {
  const now = new Date();
  const selectedDate = startOfDay(date);
  const today = startOfDay(now);
  
  if (isAfter(selectedDate, today)) return facilityOpeningTime;
  
  if (isToday(selectedDate)) {
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    
    let nextMinutes = currentMinutes <= 0 ? 0 : currentMinutes <= 30 ? 30 : 60;
    let nextHour = currentHour;
    
    if (nextMinutes === 60) {
      nextHour = currentHour + 1;
      nextMinutes = 0;
    }
    
    if (nextHour >= 24) {
      nextHour = 23;
      nextMinutes = 30;
    }
    
    return `${nextHour.toString().padStart(2, '0')}:${nextMinutes.toString().padStart(2, '0')}`;
  }
  
  return facilityOpeningTime;
};

export const filterAllowedTimeSlots = (
  timeSlots: Array<{ time: string; label: string; available: boolean }>,
  date: Date
): Array<{ time: string; label: string; available: boolean }> => {
  return timeSlots.map(slot => ({
    ...slot,
    available: slot.available && isBookingTimeAllowed(date, slot.time)
  }));
};

export const isBlockingTimeAllowed = (date: string, timeString?: string): boolean => {
  const blockDate = new Date(date);
  const now = new Date();
  const selectedDate = startOfDay(blockDate);
  const today = startOfDay(now);
  
  if (isBefore(selectedDate, today)) return false;
  if (!timeString) return true;
  
  if (isToday(selectedDate)) {
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [hourStr, minuteStr] = timeString.split(':');
    const selectedTime = parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10);
    if (selectedTime <= currentTime) return false;
  }
  
  return true;
};
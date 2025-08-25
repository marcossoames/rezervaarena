import { startOfDay, isBefore, isAfter, isToday } from "date-fns";

/**
 * Validates if a booking date and time are allowed
 * Rules:
 * - No bookings in the past
 * - For today, only future hours are allowed (rounded up to next hour)
 * - For future dates, all hours are allowed
 */
export const isBookingTimeAllowed = (date: Date, timeString: string): boolean => {
  const now = new Date();
  const selectedDate = startOfDay(date);
  const today = startOfDay(now);
  
  // Can't book in the past
  if (isBefore(selectedDate, today)) {
    return false;
  }
  
  // For today, check time restrictions
  if (isToday(selectedDate)) {
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    
    // Extract hour from time string (format: "HH:MM")
    const [hourStr] = timeString.split(':');
    const selectedHour = parseInt(hourStr, 10);
    
    // If current time is past the selected hour, not allowed
    if (selectedHour < currentHour) {
      return false;
    }
    
    // If it's the same hour but minutes have passed (e.g., 17:50 trying to book 17:00-18:00), not allowed
    if (selectedHour === currentHour && currentMinutes > 0) {
      return false;
    }
  }
  
  return true;
};

/**
 * Gets the minimum allowed time for a given date
 * For today: returns the next available hour (current hour + 1 if minutes > 0, else current hour)
 * For future dates: returns "08:00" (or facility's opening time)
 */
export const getMinimumAllowedTime = (date: Date, facilityOpeningTime = "08:00"): string => {
  const now = new Date();
  const selectedDate = startOfDay(date);
  const today = startOfDay(now);
  
  // For future dates, use facility opening time
  if (isAfter(selectedDate, today)) {
    return facilityOpeningTime;
  }
  
  // For today, calculate next available hour
  if (isToday(selectedDate)) {
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    
    // If minutes > 0, next hour; otherwise current hour
    const nextAvailableHour = currentMinutes > 0 ? currentHour + 1 : currentHour;
    
    // Ensure we don't go beyond 23:00
    const safeHour = Math.min(nextAvailableHour, 23);
    
    return `${safeHour.toString().padStart(2, '0')}:00`;
  }
  
  return facilityOpeningTime;
};

/**
 * Filters time slots to only show allowed times
 */
export const filterAllowedTimeSlots = (
  timeSlots: Array<{ time: string; label: string; available: boolean }>,
  date: Date
): Array<{ time: string; label: string; available: boolean }> => {
  return timeSlots.map(slot => ({
    ...slot,
    available: slot.available && isBookingTimeAllowed(date, slot.time)
  }));
};

/**
 * Validates if a date can be blocked (for admin/facility owner use)
 * Same rules as booking: no past dates, for today only future hours
 */
export const isBlockingTimeAllowed = (date: string, timeString?: string): boolean => {
  const blockDate = new Date(date);
  const now = new Date();
  const selectedDate = startOfDay(blockDate);
  const today = startOfDay(now);
  
  // Can't block past dates
  if (isBefore(selectedDate, today)) {
    return false;
  }
  
  // If no time specified, date blocking is allowed for today and future
  if (!timeString) {
    return true;
  }
  
  // For today with specific time, check time restrictions
  if (isToday(selectedDate)) {
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    
    const [hourStr] = timeString.split(':');
    const selectedHour = parseInt(hourStr, 10);
    
    // Can't block past hours
    if (selectedHour < currentHour) {
      return false;
    }
    
    // Can't block current hour if minutes have passed
    if (selectedHour === currentHour && currentMinutes > 0) {
      return false;
    }
  }
  
  return true;
};
import { addDays, startOfDay } from "date-fns";

/**
 * Determină data inițială pentru căutare/booking
 * Dacă ora curentă a depășit ultima oră disponibilă pentru rezervări (22:00),
 * returnează ziua următoare. Altfel, returnează ziua curentă.
 */
export const getInitialSearchDate = (): Date => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Ultima oră disponibilă pentru rezervări este 22:00
  // Dacă ora curentă este 22:00 sau mai târziu, preselectăm ziua următoare
  const lastBookingHour = 22;
  
  if (currentHour >= lastBookingHour) {
    // Trecem la ziua următoare
    return startOfDay(addDays(now, 1));
  }
  
  // Dacă suntem în intervalul 21:30 - 21:59, și există booking-uri de 90 min,
  // poate fi util să trecem la ziua următoare pentru a evita confuziile
  // dar păstrăm logica simplă: doar după 22:00 trecem la ziua următoare
  
  return startOfDay(now);
};

/**
 * Verifică dacă pentru data curentă mai sunt ore disponibile pentru rezervări
 */
export const hasAvailableHoursToday = (): boolean => {
  const now = new Date();
  const currentHour = now.getHours();
  
  // Verifică dacă mai sunt ore disponibile astăzi (până la 22:00)
  return currentHour < 22;
};

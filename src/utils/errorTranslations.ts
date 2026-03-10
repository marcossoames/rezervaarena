export const translateError = (errorMessage: string): string => {
  if (!errorMessage) return "A apărut o eroare neașteptată";

  const errorMap: Record<string, string> = {
    "Invalid login credentials": "Credențiale de autentificare invalide",
    "Invalid email or password": "Email sau parolă incorectă",
    "Email not confirmed": "Email-ul nu a fost confirmat",
    "User not found": "Utilizatorul nu a fost găsit",
    "Invalid credentials": "Credențiale invalide",
    "User already registered": "Utilizatorul este deja înregistrat",
    "Email already exists": "Există deja un cont cu acest email",
    "Password should be at least 6 characters": "Parola trebuie să aibă cel puțin 6 caractere",
    "Signup requires a valid password": "Înregistrarea necesită o parolă validă",
    "Unable to validate email address: invalid format": "Formatul emailului nu este valid",
    "Invalid email": "Email invalid",
    "Session expired": "Sesiunea a expirat",
    "Not authenticated": "Nu ești autentificat",
    "Authentication required": "Autentificare necesară",
    "No session found": "Nu există o sesiune activă",
    "Network request failed": "Cererea de rețea a eșuat",
    "Failed to fetch": "Nu s-a putut încărca informația",
    "Connection error": "Eroare de conexiune",
    "duplicate key value": "Această valoare există deja",
    "violates foreign key constraint": "Datele sunt legate de alte înregistrări",
    "not found": "Nu a fost găsit",
    "Something went wrong": "Ceva nu a mers bine",
    "An error occurred": "A apărut o eroare",
    "Server error": "Eroare de server",
    "Internal server error": "Eroare internă de server",
    "Bad request": "Cerere invalidă",
    "Unauthorized": "Neautorizat",
    "Forbidden": "Acces interzis",
    "Booking time overlaps": "Ora rezervării se suprapune cu altă rezervare",
    "Slot not available": "Intervalul nu este disponibil",
    "Facility not found": "Facilitatea nu a fost găsită",
    "No available slots": "Nu există intervale disponibile",
  };

  const exactMatch = errorMap[errorMessage];
  if (exactMatch) return exactMatch;

  for (const [englishError, romanianError] of Object.entries(errorMap)) {
    if (errorMessage.toLowerCase().includes(englishError.toLowerCase())) {
      return romanianError;
    }
  }

  return errorMessage;
};
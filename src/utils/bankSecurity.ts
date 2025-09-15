// Bank details security utilities
export const validateIbanFormat = (iban: string): boolean => {
  // Remove spaces and convert to uppercase
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();
  
  // Romanian IBAN: RO + 2 digits + 4 letters + 16 alphanumeric characters
  const romanianIbanRegex = /^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$/;
  
  return romanianIbanRegex.test(cleanIban);
};

export const sanitizeInput = (input: string): string => {
  // Remove potentially dangerous characters
  return input.replace(/[<>'";&()]/g, '').trim();
};

export const maskIban = (iban: string): string => {
  if (!iban || iban.length < 8) {
    return iban;
  }
  
  // Show first 4 and last 4 characters, mask the middle
  return iban.substring(0, 4) + '*'.repeat(iban.length - 8) + iban.substring(iban.length - 4);
};

export const validateAccountHolderName = (name: string): { isValid: boolean; error?: string } => {
  const sanitized = sanitizeInput(name);
  
  if (sanitized.length < 2) {
    return { isValid: false, error: "Numele titularului trebuie să aibă cel puțin 2 caractere" };
  }
  
  if (sanitized.length > 100) {
    return { isValid: false, error: "Numele titularului este prea lung" };
  }
  
  return { isValid: true };
};

export const validateBankName = (name: string): { isValid: boolean; error?: string } => {
  const sanitized = sanitizeInput(name);
  
  if (sanitized.length < 2) {
    return { isValid: false, error: "Numele băncii trebuie să aibă cel puțin 2 caractere" };
  }
  
  if (sanitized.length > 100) {
    return { isValid: false, error: "Numele băncii este prea lung" };
  }
  
  return { isValid: true };
};

// Client-side encryption helper (for additional protection)
export const hashSensitiveData = async (data: string): Promise<string> => {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};
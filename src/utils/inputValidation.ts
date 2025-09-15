/**
 * Comprehensive input validation utilities for enhanced security
 */

// Email validation with enhanced security checks
export const validateEmail = (email: string): { isValid: boolean; error?: string } => {
  if (!email || email.length === 0) {
    return { isValid: false, error: "Email este obligatoriu" };
  }
  
  if (email.length > 254) {
    return { isValid: false, error: "Email-ul este prea lung" };
  }
  
  // Check for suspicious patterns
  if (email.includes('..') || email.includes('@@') || /[<>'";&()]/.test(email)) {
    return { isValid: false, error: "Email-ul conține caractere invalide" };
  }
  
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: "Formatul email-ului nu este valid" };
  }
  
  return { isValid: true };
};

// Phone validation for Romanian numbers
export const validatePhone = (phone: string): { isValid: boolean; error?: string } => {
  if (!phone || phone.length === 0) {
    return { isValid: false, error: "Numărul de telefon este obligatoriu" };
  }
  
  // Remove spaces and common separators
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  
  // Check for suspicious characters
  if (/[<>'";&()]/.test(cleanPhone)) {
    return { isValid: false, error: "Numărul de telefon conține caractere invalide" };
  }
  
  // Romanian phone number patterns
  const romanianPhoneRegex = /^(\+?40|0)7[0-9]{8}$/;
  if (!romanianPhoneRegex.test(cleanPhone)) {
    return { isValid: false, error: "Formatul numărului de telefon nu este valid pentru România" };
  }
  
  return { isValid: true };
};

// Enhanced password strength validation with security best practices
export const validatePassword = (password: string): { isValid: boolean; error?: string; strength: number } => {
  if (!password || password.length === 0) {
    return { isValid: false, error: "Parola este obligatorie", strength: 0 };
  }
  
  // Increased minimum length for better security
  if (password.length < 12) {
    return { isValid: false, error: "Parola trebuie să aibă cel puțin 12 caractere", strength: 0 };
  }
  
  if (password.length > 128) {
    return { isValid: false, error: "Parola este prea lungă", strength: 0 };
  }
  
  let strength = 0;
  
  // Check for various character types (all required)
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  
  // Additional strength bonuses
  if (password.length >= 16) strength++;
  if (password.length >= 20) strength++;
  
  // Check character diversity
  const uniqueChars = new Set(password).size;
  if (uniqueChars >= password.length * 0.6) strength++;
  
  // Enhanced weak pattern detection
  const weakPatterns = [
    /123456/, /password/i, /qwerty/i, /abc/i, /111111/, /letmein/i,
    /welcome/i, /dragon/i, /football/i, /master/i, /login/i, /access/i, /secret/i,
    /(.)\1{3,}/, // 4 or more repeated characters
    /012345/, /987654/, /abcdef/i, /fedcba/i,
    // Sequential patterns
    /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i,
    /(012|123|234|345|456|567|678|789)/
  ];
  
  const hasWeakPattern = weakPatterns.some(pattern => pattern.test(password));
  if (hasWeakPattern) {
    return { isValid: false, error: "Parola conține un pattern comun sau caractere repetate. Alegeți o parolă mai complexă.", strength: 0 };
  }
  
  // Require all 4 basic character types for security
  if (strength < 4) {
    return { 
      isValid: false, 
      error: "Parola trebuie să conțină toate tipurile: litere mici, litere mari, cifre și caractere speciale", 
      strength 
    };
  }
  
  return { isValid: true, strength };
};

// Name validation (for full names, facility names, etc.)
export const validateName = (name: string, fieldName: string = "Numele"): { isValid: boolean; error?: string } => {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: `${fieldName} este obligatoriu` };
  }
  
  const trimmedName = name.trim();
  
  if (trimmedName.length < 2) {
    return { isValid: false, error: `${fieldName} trebuie să aibă cel puțin 2 caractere` };
  }
  
  if (trimmedName.length > 100) {
    return { isValid: false, error: `${fieldName} este prea lung` };
  }
  
  // Check for suspicious characters
  if (/[<>'";&()]/.test(trimmedName)) {
    return { isValid: false, error: `${fieldName} conține caractere invalide` };
  }
  
  // Allow letters, spaces, hyphens, and apostrophes
  if (!/^[a-zA-ZăâîșțĂÂÎȘȚ\s\-'\.]+$/.test(trimmedName)) {
    return { isValid: false, error: `${fieldName} conține caractere nepermise` };
  }
  
  return { isValid: true };
};

// Address validation
export const validateAddress = (address: string): { isValid: boolean; error?: string } => {
  if (!address || address.trim().length === 0) {
    return { isValid: false, error: "Adresa este obligatorie" };
  }
  
  const trimmedAddress = address.trim();
  
  if (trimmedAddress.length < 5) {
    return { isValid: false, error: "Adresa trebuie să aibă cel puțin 5 caractere" };
  }
  
  if (trimmedAddress.length > 200) {
    return { isValid: false, error: "Adresa este prea lungă" };
  }
  
  // Check for suspicious characters
  if (/[<>'";&()]/.test(trimmedAddress)) {
    return { isValid: false, error: "Adresa conține caractere invalide" };
  }
  
  return { isValid: true };
};

// Numeric validation (for prices, capacity, etc.)
export const validateNumeric = (
  value: string | number, 
  fieldName: string, 
  min?: number, 
  max?: number
): { isValid: boolean; error?: string } => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return { isValid: false, error: `${fieldName} trebuie să fie un număr valid` };
  }
  
  if (min !== undefined && numValue < min) {
    return { isValid: false, error: `${fieldName} trebuie să fie cel puțin ${min}` };
  }
  
  if (max !== undefined && numValue > max) {
    return { isValid: false, error: `${fieldName} nu poate fi mai mare de ${max}` };
  }
  
  return { isValid: true };
};

// Generic text validation
export const validateText = (
  text: string, 
  fieldName: string, 
  minLength: number = 0, 
  maxLength: number = 1000
): { isValid: boolean; error?: string } => {
  if (!text && minLength > 0) {
    return { isValid: false, error: `${fieldName} este obligatoriu` };
  }
  
  if (text && text.length < minLength) {
    return { isValid: false, error: `${fieldName} trebuie să aibă cel puțin ${minLength} caractere` };
  }
  
  if (text && text.length > maxLength) {
    return { isValid: false, error: `${fieldName} nu poate avea mai mult de ${maxLength} caractere` };
  }
  
  // Check for suspicious characters that could indicate XSS attempts
  if (text && /[<>'";&()]/.test(text)) {
    return { isValid: false, error: `${fieldName} conține caractere invalide` };
  }
  
  return { isValid: true };
};
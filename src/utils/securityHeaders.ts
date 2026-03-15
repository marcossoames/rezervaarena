export const applySecurityMeta = () => {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com https://checkout.stripe.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://ukopxkymzywfpobpcana.supabase.co https://www.google-analytics.com",
    "connect-src 'self' https://ukopxkymzywfpobpcana.supabase.co wss://ukopxkymzywfpobpcana.supabase.co https://api.stripe.com https://checkout.stripe.com https://www.google-analytics.com",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com",
  ].join('; ');

  const existing = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (existing) {
    existing.setAttribute('content', csp);
  } else {
    const meta = document.createElement('meta');
    meta.setAttribute('http-equiv', 'Content-Security-Policy');
    meta.setAttribute('content', csp);
    document.head.appendChild(meta);
  }
};

export const sanitizeInput = (input: string, maxLength: number = 1000): string => {
  if (typeof input !== 'string') return '';
  return input.slice(0, maxLength).replace(/[<>]/g, '').trim();
};

let requestCounts: Record<string, { count: number; timestamp: number }> = {};

export const checkClientRateLimit = (
  operation: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): boolean => {
  const now = Date.now();
  const key = `${operation}_${Math.floor(now / windowMs)}`;

  Object.keys(requestCounts).forEach(k => {
    if (now - requestCounts[k].timestamp > windowMs) {
      delete requestCounts[k];
    }
  });

  if (!requestCounts[key]) {
    requestCounts[key] = { count: 0, timestamp: now };
  }

  requestCounts[key].count++;
  return requestCounts[key].count <= maxRequests;
};

export const validateSecureSession = (): boolean => {
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    return false;
  }
  return true;
};
/**
 * Security headers and CSP configuration for enhanced application security
 */

// Enhanced Content Security Policy configuration
export const getCSPHeader = () => {
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://ukopxkymzywfpobpcana.supabase.co https://www.google-analytics.com",
    "media-src 'self' blob:",
    "connect-src 'self' https://ukopxkymzywfpobpcana.supabase.co wss://ukopxkymzywfpobpcana.supabase.co https://api.stripe.com https://checkout.stripe.com https://www.google-analytics.com",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
    "block-all-mixed-content"
  ];
  
  return cspDirectives.join('; ');
};

// Enhanced security headers configuration
export const getSecurityHeaders = () => ({
  'Content-Security-Policy': getCSPHeader(),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.stripe.com"), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-XSS-Protection': '1; mode=block',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin'
});

// Apply security headers to HTML meta tags
export const applySecurityMeta = () => {
  const headers = getSecurityHeaders();
  
  Object.entries(headers).forEach(([name, content]) => {
    const existing = document.querySelector(`meta[http-equiv="${name}"]`);
    if (existing) {
      existing.setAttribute('content', content);
    } else {
      const meta = document.createElement('meta');
      meta.setAttribute('http-equiv', name);
      meta.setAttribute('content', content);
      document.head.appendChild(meta);
    }
  });
};

// Validate and sanitize user inputs
export const sanitizeInput = (input: string, maxLength: number = 1000): string => {
  if (typeof input !== 'string') return '';
  
  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove potential XSS vectors
    .trim();
};

// Rate limiting helper for client-side
let requestCounts: Record<string, { count: number; timestamp: number }> = {};

export const checkClientRateLimit = (
  operation: string, 
  maxRequests: number = 10, 
  windowMs: number = 60000
): boolean => {
  const now = Date.now();
  const key = `${operation}_${Math.floor(now / windowMs)}`;
  
  // Clean old entries
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

// Secure session validation
export const validateSecureSession = (): boolean => {
  // Check if we're on HTTPS in production
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    console.warn('Insecure connection detected');
    return false;
  }
  
  // Check for secure storage availability
  try {
    localStorage.setItem('security_test', 'test');
    localStorage.removeItem('security_test');
  } catch {
    console.warn('Secure storage not available');
    return false;
  }
  
  return true;
};
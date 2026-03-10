import { createContext, useContext, useEffect, ReactNode } from 'react';
import { applySecurityMeta, validateSecureSession } from '@/utils/securityHeaders';
import { useToast } from '@/hooks/use-toast';

interface SecurityContextType {
  isSecure: boolean;
}

const SecurityContext = createContext<SecurityContextType>({ isSecure: false });

export const useSecurityContext = () => useContext(SecurityContext);

export const SecurityProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const isSecure = validateSecureSession();

  useEffect(() => {
    applySecurityMeta();
    
    if (!isSecure) {
      toast({
        title: "Avertisment de Securitate",
        description: "Vă rugăm să utilizați o conexiune securizată (HTTPS)",
        variant: "destructive"
      });
    }
    
    if (import.meta.env.PROD) {
      const handleKeyDown = (e: KeyboardEvent) => {
        const isFinancialPage = window.location.pathname.includes('payment') || 
                               window.location.pathname.includes('bank') ||
                               window.location.pathname.includes('admin');
        
        if (isFinancialPage && (
          e.key === 'F12' || 
          (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
          (e.ctrlKey && e.key === 'U')
        )) {
          e.preventDefault();
          return false;
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isSecure, toast]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        const sensitiveInputs = document.querySelectorAll('input[type="password"], input[data-sensitive="true"]');
        sensitiveInputs.forEach(input => {
          if (input instanceof HTMLInputElement) {
            input.value = '';
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (
    <SecurityContext.Provider value={{ isSecure }}>
      {children}
    </SecurityContext.Provider>
  );
};
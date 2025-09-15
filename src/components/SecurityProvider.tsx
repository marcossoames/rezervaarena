/**
 * Security Provider component for enhanced application security
 */
import { createContext, useContext, useEffect, ReactNode } from 'react';
import { applySecurityMeta, validateSecureSession } from '@/utils/securityHeaders';
import { useToast } from '@/hooks/use-toast';

interface SecurityContextType {
  isSecure: boolean;
}

const SecurityContext = createContext<SecurityContextType>({
  isSecure: false
});

export const useSecurityContext = () => useContext(SecurityContext);

interface SecurityProviderProps {
  children: ReactNode;
}

export const SecurityProvider = ({ children }: SecurityProviderProps) => {
  const { toast } = useToast();
  const isSecure = validateSecureSession();

  useEffect(() => {
    // Apply security headers on mount
    applySecurityMeta();
    
    // Validate secure session
    if (!isSecure) {
      toast({
        title: "Security Warning",
        description: "Please ensure you're using a secure connection",
        variant: "destructive"
      });
    }
    
    // Disable right-click context menu in production
    if (process.env.NODE_ENV === 'production') {
      const handleContextMenu = (e: MouseEvent) => e.preventDefault();
      document.addEventListener('contextmenu', handleContextMenu);
      
      return () => {
        document.removeEventListener('contextmenu', handleContextMenu);
      };
    }
  }, [isSecure, toast]);

  // Monitor for potential security threats
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Clear sensitive data when tab is hidden
        const sensitiveInputs = document.querySelectorAll('input[type="password"], input[data-sensitive="true"]');
        sensitiveInputs.forEach(input => {
          if (input instanceof HTMLInputElement) {
            input.value = '';
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <SecurityContext.Provider value={{ isSecure }}>
      {children}
    </SecurityContext.Provider>
  );
};
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
        title: "Avertisment de Securitate",
        description: "Vă rugăm să utilizați o conexiune securizată (HTTPS)",
        variant: "destructive"
      });
    }
    
    // Enhanced security measures in production
    if (process.env.NODE_ENV === 'production') {
      // Disable right-click context menu
      const handleContextMenu = (e: MouseEvent) => e.preventDefault();
      document.addEventListener('contextmenu', handleContextMenu);
      
      // Disable text selection for sensitive elements
      const disableSelection = () => {
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
      };
      
      // Disable drag and drop
      const handleDragStart = (e: DragEvent) => e.preventDefault();
      document.addEventListener('dragstart', handleDragStart);
      
      // Disable developer tools shortcuts
      const handleKeyDown = (e: KeyboardEvent) => {
        // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
            (e.ctrlKey && e.key === 'U')) {
          e.preventDefault();
          return false;
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      
      // Apply selection restrictions
      disableSelection();
      
      return () => {
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('dragstart', handleDragStart);
        document.removeEventListener('keydown', handleKeyDown);
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
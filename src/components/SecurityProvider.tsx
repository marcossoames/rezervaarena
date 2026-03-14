import { useEffect, ReactNode } from 'react';
import { applySecurityMeta, validateSecureSession } from '@/utils/securityHeaders';
import { useToast } from '@/hooks/use-toast';

export const SecurityProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();

  useEffect(() => {
    applySecurityMeta();
    
    if (!validateSecureSession()) {
      toast({
        title: "Avertisment de Securitate",
        description: "Vă rugăm să utilizați o conexiune securizată (HTTPS)",
        variant: "destructive"
      });
    }
  }, [toast]);

  return <>{children}</>;
};

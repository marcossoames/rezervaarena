/**
 * Security Monitor component for real-time security event monitoring
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  user_id?: string;
}

export const SecurityMonitor = () => {
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [securityScore, setSecurityScore] = useState<number>(85);
  const { toast } = useToast();

  useEffect(() => {
    // Monitor authentication events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        const newEvent: SecurityEvent = {
          id: Date.now().toString(),
          event_type: 'auth_success',
          severity: 'low',
          message: 'Utilizator autentificat cu succes',
          timestamp: new Date().toISOString(),
          user_id: session?.user?.id
        };
        setSecurityEvents(prev => [newEvent, ...prev.slice(0, 4)]);
      } else if (event === 'SIGNED_OUT') {
        const newEvent: SecurityEvent = {
          id: Date.now().toString(),
          event_type: 'auth_logout',
          severity: 'low',
          message: 'Utilizator deconectat',
          timestamp: new Date().toISOString()
        };
        setSecurityEvents(prev => [newEvent, ...prev.slice(0, 4)]);
      }
    });

    // Monitor for suspicious activity patterns
    const monitorSuspiciousActivity = () => {
      const connectionAttempts = parseInt(localStorage.getItem('connection_attempts') || '0');
      const lastAttempt = localStorage.getItem('last_connection_attempt');
      
      if (connectionAttempts > 3 && lastAttempt) {
        const timeDiff = Date.now() - parseInt(lastAttempt);
        if (timeDiff < 300000) { // 5 minutes
          const suspiciousEvent: SecurityEvent = {
            id: Date.now().toString(),
            event_type: 'suspicious_activity',
            severity: 'high',
            message: 'Activitate suspicioasă detectată - multiple încercări de conectare',
            timestamp: new Date().toISOString()
          };
          setSecurityEvents(prev => [suspiciousEvent, ...prev.slice(0, 4)]);
          toast({
            title: "Avertisment de Securitate",
            description: "Activitate suspicioasă detectată",
            variant: "destructive"
          });
        }
      }
    };

    // Check security status periodically
    const securityCheck = setInterval(() => {
      monitorSuspiciousActivity();
      
      // Calculate security score based on various factors
      let score = 100;
      
      // Check for HTTPS
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        score -= 20;
      }
      
      // Check for recent authentication
      const user = supabase.auth.getUser();
      if (!user) {
        score -= 10;
      }
      
      // Check for security headers
      if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
        score -= 5;
      }
      
      setSecurityScore(score);
    }, 30000); // Check every 30 seconds

    return () => {
      subscription.unsubscribe();
      clearInterval(securityCheck);
    };
  }, [toast]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Monitor Securitate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Scor Securitate:</span>
          <div className="flex items-center gap-2">
            <span className={`font-bold ${getScoreColor(securityScore)}`}>
              {securityScore}%
            </span>
            {securityScore >= 90 ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Evenimente Recente:</h4>
          {securityEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Niciun eveniment recent</p>
          ) : (
            securityEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-2 p-2 rounded border">
                <Badge variant={getSeverityColor(event.severity)} className="text-xs">
                  {event.severity.toUpperCase()}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleTimeString('ro-RO')}
                  </p>
                  <p className="text-sm">{event.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
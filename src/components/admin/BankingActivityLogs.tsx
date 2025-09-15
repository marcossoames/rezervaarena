/**
 * Enhanced Banking Activity Logs component for admin dashboard
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, AlertTriangle, User, Calendar, Globe, Monitor } from "lucide-react";

interface BankingActivityLog {
  id: string;
  user_id: string;
  operation: string;
  ip_address: string | null;
  user_agent: string;
  status: 'success' | 'failed';
  error_message?: string;
  created_at: string;
}

const BankingActivityLogs = () => {
  const [activityLogs, setActivityLogs] = useState<BankingActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadActivityLogs();
  }, []);

  const loadActivityLogs = async () => {
    try {
      setIsLoading(true);
      
      const { data: logs, error } = await supabase
        .from('banking_activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setActivityLogs((logs as BankingActivityLog[]) || []);
    } catch (error) {
      console.error('Error loading banking activity logs:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca logurile de activitate bancară",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getOperationIcon = (operation: string) => {
    if (operation.includes('read')) {
      return <User className="h-4 w-4 text-blue-600" />;
    } else if (operation.includes('create') || operation.includes('update')) {
      return <Shield className="h-4 w-4 text-green-600" />;
    } else if (operation.includes('delete')) {
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
    return <Shield className="h-4 w-4 text-gray-600" />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatOperation = (operation: string) => {
    return operation
      .replace('banking_', '')
      .replace('_', ' ')
      .toUpperCase();
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ro-RO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatUserAgent = (userAgent: string) => {
    if (!userAgent || userAgent === 'unknown') return 'Necunoscut';
    
    // Extract browser and OS info
    const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge)\/[\d.]+/);
    const osMatch = userAgent.match(/(Windows|Mac|Linux|Android|iOS)/);
    
    const browser = browserMatch ? browserMatch[1] : 'Necunoscut';
    const os = osMatch ? osMatch[1] : 'Necunoscut';
    
    return `${browser} pe ${os}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Se încarcă logurile de activitate bancară...</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Se încarcă logurile de activitate bancară...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Activitate Bancară - Loguri de Securitate ({activityLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nu există loguri de activitate bancară disponibile.
            </p>
          ) : (
            <div className="space-y-4">
              {activityLogs.map((log) => (
                <Card key={log.id} className="border border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getOperationIcon(log.operation)}
                        <Badge className={getStatusColor(log.status)}>
                          {log.status.toUpperCase()}
                        </Badge>
                        <span className="font-medium">
                          {formatOperation(log.operation)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatTimestamp(log.created_at)}
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Utilizator:</p>
                        <p className="font-mono text-xs">{log.user_id?.substring(0, 8)}...</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-muted-foreground mb-1">Adresa IP:</p>
                          <p className="font-mono text-xs">{log.ip_address || 'Necunoscută'}</p>
                        </div>
                      </div>
                    </div>

                    {log.user_agent && (
                      <div className="mt-3 flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-muted-foreground mb-1 text-xs">Dispozitiv:</p>
                          <p className="text-xs">{formatUserAgent(log.user_agent)}</p>
                        </div>
                      </div>
                    )}

                    {log.status === 'failed' && log.error_message && (
                      <div className="mt-3">
                        <p className="text-muted-foreground mb-1 text-sm">Mesaj de eroare:</p>
                        <div className="bg-red-50 p-2 rounded text-xs text-red-800">
                          {log.error_message}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BankingActivityLogs;
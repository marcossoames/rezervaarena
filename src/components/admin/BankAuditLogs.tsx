import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, AlertTriangle, User, Calendar } from "lucide-react";

interface AuditLog {
  id: string;
  admin_user_id: string;
  target_user_id: string;
  bank_details_id: string;
  action: string;
  old_data: any;
  new_data: any;
  ip_address: unknown;
  user_agent: string;
  created_at: string;
}

const BankAuditLogs = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    try {
      setIsLoading(true);
      
      const { data: logs, error } = await supabase
        .from('bank_details_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setAuditLogs(logs || []);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca logurile de audit",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'INSERT':
        return <User className="h-4 w-4 text-green-600" />;
      case 'UPDATE':
        return <Shield className="h-4 w-4 text-blue-600" />;
      case 'DELETE':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Shield className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT':
        return 'bg-green-100 text-green-800';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800';
      case 'DELETE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Se încarcă logurile de audit...</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Se încarcă logurile de audit...</p>
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
            Audit Logs - Detalii Bancare ({auditLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nu există loguri de audit disponibile.
            </p>
          ) : (
            <div className="space-y-4">
              {auditLogs.map((log) => (
                <Card key={log.id} className="border border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getActionIcon(log.action)}
                        <Badge className={getActionColor(log.action)}>
                          {log.action}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          ID: {log.bank_details_id?.substring(0, 8)}...
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatTimestamp(log.created_at)}
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Administrator:</p>
                        <p className="font-mono text-xs">{log.admin_user_id?.substring(0, 8)}...</p>
                      </div>
                      
                      <div>
                        <p className="text-muted-foreground mb-1">Utilizator țintă:</p>
                        <p className="font-mono text-xs">{log.target_user_id?.substring(0, 8)}...</p>
                      </div>
                    </div>

                    {log.action === 'UPDATE' && log.old_data && log.new_data && (
                      <div className="mt-4 grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-muted-foreground mb-2 text-sm">Date vechi:</p>
                          <div className="bg-red-50 p-2 rounded text-xs">
                            <p><strong>Titular:</strong> {log.old_data.account_holder_name}</p>
                            <p><strong>Bancă:</strong> {log.old_data.bank_name}</p>
                            <p><strong>IBAN:</strong> {log.old_data.iban_masked}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-2 text-sm">Date noi:</p>
                          <div className="bg-green-50 p-2 rounded text-xs">
                            <p><strong>Titular:</strong> {log.new_data.account_holder_name}</p>
                            <p><strong>Bancă:</strong> {log.new_data.bank_name}</p>
                            <p><strong>IBAN:</strong> {log.new_data.iban_masked}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {(log.action === 'INSERT' || log.action === 'DELETE') && (
                      <div className="mt-4">
                        <p className="text-muted-foreground mb-2 text-sm">
                          {log.action === 'INSERT' ? 'Date adăugate:' : 'Date șterse:'}
                        </p>
                        <div className={`p-2 rounded text-xs ${
                          log.action === 'INSERT' ? 'bg-green-50' : 'bg-red-50'
                        }`}>
                          {log.new_data && (
                            <>
                              <p><strong>Titular:</strong> {log.new_data.account_holder_name}</p>
                              <p><strong>Bancă:</strong> {log.new_data.bank_name}</p>
                              <p><strong>IBAN:</strong> {log.new_data.iban_masked}</p>
                            </>
                          )}
                          {log.old_data && log.action === 'DELETE' && (
                            <>
                              <p><strong>Titular:</strong> {log.old_data.account_holder_name}</p>
                              <p><strong>Bancă:</strong> {log.old_data.bank_name}</p>
                              <p><strong>IBAN:</strong> {log.old_data.iban_masked}</p>
                            </>
                          )}
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

export default BankAuditLogs;
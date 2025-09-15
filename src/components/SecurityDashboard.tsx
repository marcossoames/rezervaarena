/**
 * Comprehensive Security Dashboard for administrators
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Users, 
  Activity, 
  Lock,
  Eye,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

interface SecurityMetrics {
  totalUsers: number;
  activeSessionsToday: number;
  failedLoginAttempts: number;
  suspiciousActivities: number;
  bankingOperations: number;
  securityScore: number;
}

interface AuditLog {
  id: string;
  action: string;
  admin_user_id: string;
  target_user_id?: string;
  metadata: any;
  created_at: string;
}

interface SecurityAlert {
  id: string;
  type: 'high_risk_banking' | 'multiple_failed_logins' | 'unusual_activity' | 'policy_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
}

export const SecurityDashboard = () => {
  const [metrics, setMetrics] = useState<SecurityMetrics>({
    totalUsers: 0,
    activeSessionsToday: 0,
    failedLoginAttempts: 0,
    suspiciousActivities: 0,
    bankingOperations: 0,
    securityScore: 85
  });
  
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadSecurityData();
    const interval = setInterval(loadSecurityData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadSecurityData = async () => {
    try {
      // Load security metrics
      const [profilesResponse, auditResponse, bankingResponse] = await Promise.all([
        supabase.from('profiles').select('id, created_at'),
        supabase.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('banking_activity_log').select('*').gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      ]);

      if (profilesResponse.data) {
        const today = new Date().toDateString();
        const todayUsers = profilesResponse.data.filter(
          profile => new Date(profile.created_at).toDateString() === today
        );

        setMetrics(prev => ({
          ...prev,
          totalUsers: profilesResponse.data.length,
          activeSessionsToday: todayUsers.length,
          bankingOperations: bankingResponse.data?.length || 0
        }));
      }

      if (auditResponse.data) {
        setAuditLogs(auditResponse.data);
      }

      // Calculate security score
      const securityScore = calculateSecurityScore();
      setMetrics(prev => ({ ...prev, securityScore }));

      // Generate security alerts based on recent activity
      generateSecurityAlerts();
      
    } catch (error) {
      console.error('Error loading security data:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca datele de securitate",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateSecurityScore = () => {
    let score = 100;
    
    // Check various security factors
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      score -= 20;
    }
    
    if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
      score -= 10;
    }
    
    if (metrics.failedLoginAttempts > 10) {
      score -= 15;
    }
    
    if (metrics.suspiciousActivities > 5) {
      score -= 20;
    }
    
    return Math.max(score, 0);
  };

  const generateSecurityAlerts = () => {
    const alerts: SecurityAlert[] = [];
    
    if (metrics.failedLoginAttempts > 5) {
      alerts.push({
        id: 'failed_logins',
        type: 'multiple_failed_logins',
        severity: 'high',
        message: `${metrics.failedLoginAttempts} încercări eșuate de autentificare în ultimele 24h`,
        timestamp: new Date().toISOString(),
        resolved: false
      });
    }
    
    if (metrics.bankingOperations > 50) {
      alerts.push({
        id: 'high_banking_activity',
        type: 'high_risk_banking',
        severity: 'medium',
        message: `Activitate bancară intensă: ${metrics.bankingOperations} operațiuni`,
        timestamp: new Date().toISOString(),
        resolved: false
      });
    }
    
    setSecurityAlerts(alerts);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Dashboard Securitate</h1>
      </div>

      {/* Security Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scor Securitate</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className={`text-2xl font-bold ${getScoreColor(metrics.securityScore)}`}>
                {metrics.securityScore}%
              </div>
              {metrics.securityScore >= 90 ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              )}
            </div>
            <Progress value={metrics.securityScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilizatori Totali</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              +{metrics.activeSessionsToday} astăzi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operațiuni Bancare</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.bankingOperations}</div>
            <p className="text-xs text-muted-foreground">
              Ultimele 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerte Active</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {securityAlerts.filter(alert => !alert.resolved).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Necesită atenție
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Security Information */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">Alerte Securitate</TabsTrigger>
          <TabsTrigger value="audit">Jurnal Audit</TabsTrigger>
          <TabsTrigger value="monitoring">Monitorizare Live</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alerte de Securitate Active</CardTitle>
            </CardHeader>
            <CardContent>
              {securityAlerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <p className="text-muted-foreground">Nu există alerte de securitate active</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {securityAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={getSeverityColor(alert.severity)}>
                            {alert.severity.toUpperCase()}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(alert.timestamp).toLocaleString('ro-RO')}
                          </span>
                        </div>
                        <p className="text-sm">{alert.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Jurnal Audit Recent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Activity className="h-4 w-4 text-blue-500 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{log.action}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString('ro-RO')}
                        </span>
                      </div>
                      {log.metadata && (
                        <p className="text-xs text-muted-foreground">
                          {JSON.stringify(log.metadata, null, 2)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monitorizare în Timp Real</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Conexiune Securizată</h4>
                  <div className="flex items-center gap-2">
                    {window.location.protocol === 'https:' || window.location.hostname === 'localhost' ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-600">HTTPS Activ</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="text-sm text-red-600">HTTPS Inactiv</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Anteturi de Securitate</h4>
                  <div className="flex items-center gap-2">
                    {document.querySelector('meta[http-equiv="Content-Security-Policy"]') ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-600">CSP Configurat</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm text-yellow-600">CSP Lipsă</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
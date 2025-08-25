import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, XCircle, Calendar, User, TrendingDown, TrendingUp } from "lucide-react";

interface ClientBehaviorStats {
  user_id: string;
  full_name: string;
  email: string;
  total_bookings: number;
  completed_bookings: number;
  no_show_bookings: number;
  cancelled_bookings: number;
}

interface ClientBehaviorStatsProps {
  stats: ClientBehaviorStats;
  showDetailed?: boolean;
}

const ClientBehaviorStats: React.FC<ClientBehaviorStatsProps> = ({ 
  stats, 
  showDetailed = false 
}) => {
  const {
    full_name,
    email,
    total_bookings,
    completed_bookings,
    no_show_bookings,
    cancelled_bookings
  } = stats;

  // Calculate percentages
  const completionRate = total_bookings > 0 ? (completed_bookings / total_bookings) * 100 : 0;
  const noShowRate = total_bookings > 0 ? (no_show_bookings / total_bookings) * 100 : 0;
  const cancellationRate = total_bookings > 0 ? (cancelled_bookings / total_bookings) * 100 : 0;

  // Risk assessment
  const getRiskLevel = () => {
    if (noShowRate > 30 || cancellationRate > 40) return 'high';
    if (noShowRate > 15 || cancellationRate > 25) return 'medium';
    return 'low';
  };

  const getRiskInfo = (level: string) => {
    switch (level) {
      case 'high':
        return {
          label: 'Risc Mare',
          variant: 'destructive' as const,
          icon: <AlertTriangle className="h-4 w-4" />,
          description: 'Client cu istoric problematic'
        };
      case 'medium':
        return {
          label: 'Risc Mediu',
          variant: 'secondary' as const,
          icon: <TrendingDown className="h-4 w-4" />,
          description: 'Client cu unele probleme'
        };
      default:
        return {
          label: 'Client Fiabil',
          variant: 'default' as const,
          icon: <CheckCircle className="h-4 w-4" />,
          description: 'Client cu istoric bun'
        };
    }
  };

  const riskLevel = getRiskLevel();
  const riskInfo = getRiskInfo(riskLevel);

  if (!showDetailed) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant={riskInfo.variant} className="flex items-center gap-1">
          {riskInfo.icon}
          {riskInfo.label}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {no_show_bookings} lipsă, {cancelled_bookings} anulate
        </span>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <span>{full_name}</span>
          </div>
          <Badge variant={riskInfo.variant} className="flex items-center gap-1">
            {riskInfo.icon}
            {riskInfo.label}
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{email}</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{total_bookings}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Calendar className="h-3 w-3" />
              Total Rezervări
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{completed_bookings}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Finalizate
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{no_show_bookings}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Lipsă
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{cancelled_bookings}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <XCircle className="h-3 w-3" />
              Anulate
            </div>
          </div>
        </div>

        {/* Progress Bars */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Rata de finalizare</span>
              <span className="text-green-600 font-medium">{completionRate.toFixed(1)}%</span>
            </div>
            <Progress value={completionRate} className="h-2" />
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Rata de lipsă</span>
              <span className="text-orange-600 font-medium">{noShowRate.toFixed(1)}%</span>
            </div>
            <Progress value={noShowRate} className="h-2 bg-orange-100" />
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Rata de anulare</span>
              <span className="text-red-600 font-medium">{cancellationRate.toFixed(1)}%</span>
            </div>
            <Progress value={cancellationRate} className="h-2 bg-red-100" />
          </div>
        </div>

        {/* Risk Assessment */}
        <div className={`p-3 rounded-lg border-l-4 ${
          riskLevel === 'high' ? 'bg-red-50 border-red-500' :
          riskLevel === 'medium' ? 'bg-yellow-50 border-yellow-500' :
          'bg-green-50 border-green-500'
        }`}>
          <div className="flex items-center gap-2 text-sm font-medium">
            {riskInfo.icon}
            {riskInfo.description}
          </div>
          {riskLevel !== 'low' && (
            <p className="text-xs text-muted-foreground mt-1">
              {riskLevel === 'high' 
                ? 'Recomandăm atenție sporită la viitoarele rezervări ale acestui client.'
                : 'Urmărește îndeaproape comportamentul viitor al clientului.'
              }
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ClientBehaviorStats;
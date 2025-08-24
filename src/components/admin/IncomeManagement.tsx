import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Calendar, TrendingUp, CreditCard, Banknote, BarChart3, RefreshCw } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { ro } from "date-fns/locale";

interface IncomeData {
  physicalIncome: number;
  onlineIncome: number;
  totalIncome: number;
  totalBookings: number;
  physicalBookings: number;
  onlineBookings: number;
}

interface MonthlyIncomeData extends IncomeData {
  month: string;
  year: number;
}

const IncomeManagement = () => {
  const [incomeData, setIncomeData] = useState<IncomeData>({
    physicalIncome: 0,
    onlineIncome: 0,
    totalIncome: 0,
    totalBookings: 0,
    physicalBookings: 0,
    onlineBookings: 0
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyIncomeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("current_month");
  const { toast } = useToast();

  useEffect(() => {
    loadIncomeData();
  }, [selectedPeriod]);

  const loadIncomeData = async () => {
    try {
      setIsLoading(true);
      
      let startDate: Date;
      let endDate: Date;
      const now = new Date();

      switch (selectedPeriod) {
        case "current_month":
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          break;
        case "last_month":
          const lastMonth = subMonths(now, 1);
          startDate = startOfMonth(lastMonth);
          endDate = endOfMonth(lastMonth);
          break;
        case "current_year":
          startDate = startOfYear(now);
          endDate = endOfYear(now);
          break;
        case "last_3_months":
          startDate = startOfMonth(subMonths(now, 2));
          endDate = endOfMonth(now);
          break;
        default:
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
      }

      // Fetch all bookings for the selected period
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*')
        .gte('booking_date', format(startDate, 'yyyy-MM-dd'))
        .lte('booking_date', format(endDate, 'yyyy-MM-dd'))
        .order('booking_date', { ascending: false });

      if (error) throw error;

      let physicalIncome = 0;
      let onlineIncome = 0;
      let physicalBookings = 0;
      let onlineBookings = 0;

      bookings?.forEach(booking => {
        if (booking.payment_method === 'cash' && booking.status === 'completed') {
          // For cash payments, we take 10% commission only from completed bookings
          physicalIncome += booking.total_price * 0.1;
          physicalBookings++;
        } else if (booking.payment_method === 'card' && ['confirmed', 'completed'].includes(booking.status)) {
          // For online payments, we take the full amount from confirmed/completed bookings
          onlineIncome += booking.total_price;
          onlineBookings++;
        }
      });

      const totalIncome = physicalIncome + onlineIncome;
      const totalBookings = physicalBookings + onlineBookings;

      setIncomeData({
        physicalIncome,
        onlineIncome,
        totalIncome,
        totalBookings,
        physicalBookings,
        onlineBookings
      });

      // Load monthly data for the chart (last 6 months)
      await loadMonthlyData();

    } catch (error) {
      console.error('Error loading income data:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca datele de încasări",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMonthlyData = async () => {
    try {
      const monthsData: MonthlyIncomeData[] = [];
      const now = new Date();

      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const startDate = startOfMonth(monthDate);
        const endDate = endOfMonth(monthDate);

        const { data: bookings, error } = await supabase
          .from('bookings')
          .select('*')
          .gte('booking_date', format(startDate, 'yyyy-MM-dd'))
          .lte('booking_date', format(endDate, 'yyyy-MM-dd'));

        if (error) throw error;

        let physicalIncome = 0;
        let onlineIncome = 0;
        let physicalBookings = 0;
        let onlineBookings = 0;

        bookings?.forEach(booking => {
          if (booking.payment_method === 'cash' && booking.status === 'completed') {
            physicalIncome += booking.total_price * 0.1;
            physicalBookings++;
          } else if (booking.payment_method === 'card' && ['confirmed', 'completed'].includes(booking.status)) {
            onlineIncome += booking.total_price;
            onlineBookings++;
          }
        });

        monthsData.push({
          month: format(monthDate, 'MMM', { locale: ro }),
          year: monthDate.getFullYear(),
          physicalIncome,
          onlineIncome,
          totalIncome: physicalIncome + onlineIncome,
          totalBookings: physicalBookings + onlineBookings,
          physicalBookings,
          onlineBookings
        });
      }

      setMonthlyData(monthsData);
    } catch (error) {
      console.error('Error loading monthly data:', error);
    }
  };

  const getPeriodLabel = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case "current_month":
        return format(now, 'MMMM yyyy', { locale: ro });
      case "last_month":
        return format(subMonths(now, 1), 'MMMM yyyy', { locale: ro });
      case "current_year":
        return `Anul ${now.getFullYear()}`;
      case "last_3_months":
        return "Ultimele 3 luni";
      default:
        return "Luna curentă";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rapoarte Încasări</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <p className="text-muted-foreground">Se încarcă datele de încasări...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="shadow-lg border-0 bg-gradient-to-r from-card/80 to-card/60 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-primary/20">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Rapoarte Încasări</h1>
                <p className="text-sm text-muted-foreground">Perioada: {getPeriodLabel()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-48 bg-background">
                  <SelectValue placeholder="Selectează perioada" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="current_month">Luna curentă</SelectItem>
                  <SelectItem value="last_month">Luna trecută</SelectItem>
                  <SelectItem value="last_3_months">Ultimele 3 luni</SelectItem>
                  <SelectItem value="current_year">Anul curent</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={loadIncomeData}
                className="hover-scale shadow-sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizează
              </Button>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6">
          {/* Income Summary Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="border-l-4 border-l-orange-500 shadow-md hover:shadow-lg transition-all hover-scale bg-gradient-to-r from-card to-card/80">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Încasări Fizice (Cash)</CardTitle>
                <Banknote className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{incomeData.physicalIncome.toFixed(2)} RON</div>
                <p className="text-xs text-muted-foreground">
                  10% comision din {incomeData.physicalBookings} rezervări cash finalizate
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-all hover-scale bg-gradient-to-r from-card to-card/80">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Încasări Online</CardTitle>
                <CreditCard className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{incomeData.onlineIncome.toFixed(2)} RON</div>
                <p className="text-xs text-muted-foreground">
                  Suma completă din {incomeData.onlineBookings} rezervări online
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 shadow-md hover:shadow-lg transition-all hover-scale bg-gradient-to-r from-card to-card/80">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Încasări</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{incomeData.totalIncome.toFixed(2)} RON</div>
                <p className="text-xs text-muted-foreground">
                  Din {incomeData.totalBookings} rezervări procesate
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Breakdown */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-secondary/30 to-secondary/20 p-4 rounded-lg border mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Evolutie Lunară (Ultimele 6 Luni)
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Comparație între tipurile de încasări</p>
            </div>

            <div className="grid gap-4">
              {monthlyData.map((month, index) => (
                <Card key={index} className="border shadow-sm hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-lg">
                        {month.month} {month.year}
                      </h4>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          {month.totalIncome.toFixed(2)} RON
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {month.totalBookings} rezervări
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="flex items-center gap-2">
                          <Banknote className="h-4 w-4 text-orange-600" />
                          <span className="text-sm font-medium">Cash (10%)</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-orange-600">{month.physicalIncome.toFixed(2)} RON</div>
                          <div className="text-xs text-muted-foreground">{month.physicalBookings} rezervări</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium">Online (100%)</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-blue-600">{month.onlineIncome.toFixed(2)} RON</div>
                          <div className="text-xs text-muted-foreground">{month.onlineBookings} rezervări</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Income Explanation */}
          <Card className="bg-gradient-to-r from-muted/30 to-muted/20 border-muted">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Metodă de Calcul
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <Banknote className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium">Încasări Fizice (Cash)</p>
                  <p className="text-sm text-muted-foreground">
                    Se calculează 10% comision doar din rezervările cu plată cash care au fost finalizate (status: completed)
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium">Încasări Online</p>
                  <p className="text-sm text-muted-foreground">
                    Se calculează suma completă din rezervările cu plată card care sunt confirmate sau finalizate
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">Total Încasări</p>
                  <p className="text-sm text-muted-foreground">
                    Suma încasărilor fizice și online pentru perioada selectată
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default IncomeManagement;
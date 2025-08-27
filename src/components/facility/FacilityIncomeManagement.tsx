import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Calendar, TrendingUp, CreditCard, Banknote, BarChart3, RefreshCw, Wallet } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { ro } from "date-fns/locale";

interface FacilityIncomeData {
  totalReceivedCash: number;
  totalReceivedCard: number;
  totalReceived: number;
  totalBookings: number;
  cashBookings: number;
  cardBookings: number;
  totalGrossCash: number;
  totalGrossCard: number;
  totalGross: number;
}

interface MonthlyFacilityIncomeData extends FacilityIncomeData {
  month: string;
  year: number;
}

const FacilityIncomeManagement = () => {
  const [incomeData, setIncomeData] = useState<FacilityIncomeData>({
    totalReceivedCash: 0,
    totalReceivedCard: 0,
    totalReceived: 0,
    totalBookings: 0,
    cashBookings: 0,
    cardBookings: 0,
    totalGrossCash: 0,
    totalGrossCard: 0,
    totalGross: 0
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyFacilityIncomeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("current_month");
  const { toast } = useToast();

  useEffect(() => {
    loadIncomeData();
  }, [selectedPeriod]);

  const loadIncomeData = async () => {
    try {
      setIsLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get user's facilities
      const { data: facilities, error: facilitiesError } = await supabase
        .from('facilities')
        .select('id')
        .eq('owner_id', user.id);

      if (facilitiesError) throw facilitiesError;

      const facilityIds = facilities?.map(f => f.id) || [];
      
      if (facilityIds.length === 0) {
        setIncomeData({
          totalReceivedCash: 0,
          totalReceivedCard: 0,
          totalReceived: 0,
          totalBookings: 0,
          cashBookings: 0,
          cardBookings: 0,
          totalGrossCash: 0,
          totalGrossCard: 0,
          totalGross: 0
        });
        setMonthlyData([]);
        return;
      }
      
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

      // Fetch all bookings for the selected period and facilities
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*')
        .in('facility_id', facilityIds)
        .gte('booking_date', format(startDate, 'yyyy-MM-dd'))
        .lte('booking_date', format(endDate, 'yyyy-MM-dd'))
        .order('booking_date', { ascending: false });

      if (error) throw error;

      let totalReceivedCash = 0;
      let totalReceivedCard = 0;
      let cashBookings = 0;
      let cardBookings = 0;
      let totalGrossCash = 0;
      let totalGrossCard = 0;

      bookings?.forEach(booking => {
        if (booking.payment_method === 'cash' && booking.status === 'completed') {
          // For cash payments: facility gets 90%, platform gets 10%
          totalReceivedCash += booking.total_price * 0.9;
          totalGrossCash += booking.total_price;
          cashBookings++;
        } else if (booking.payment_method === 'card' && ['confirmed', 'completed'].includes(booking.status)) {
          // For card payments: facility gets 90%, platform gets 10%
          totalReceivedCard += booking.total_price * 0.9;
          totalGrossCard += booking.total_price;
          cardBookings++;
        }
      });

      const totalReceived = totalReceivedCash + totalReceivedCard;
      const totalBookings = cashBookings + cardBookings;
      const totalGross = totalGrossCash + totalGrossCard;

      setIncomeData({
        totalReceivedCash,
        totalReceivedCard,
        totalReceived,
        totalBookings,
        cashBookings,
        cardBookings,
        totalGrossCash,
        totalGrossCard,
        totalGross
      });

      // Load monthly data for the chart (last 3 months)
      await loadMonthlyData(facilityIds);

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

  const loadMonthlyData = async (facilityIds: string[]) => {
    try {
      const monthsData: MonthlyFacilityIncomeData[] = [];
      const now = new Date();

      for (let i = 2; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const startDate = startOfMonth(monthDate);
        const endDate = endOfMonth(monthDate);

        const { data: bookings, error } = await supabase
          .from('bookings')
          .select('*')
          .in('facility_id', facilityIds)
          .gte('booking_date', format(startDate, 'yyyy-MM-dd'))
          .lte('booking_date', format(endDate, 'yyyy-MM-dd'));

        if (error) throw error;

        let totalReceivedCash = 0;
        let totalReceivedCard = 0;
        let cashBookings = 0;
        let cardBookings = 0;
        let totalGrossCash = 0;
        let totalGrossCard = 0;

        bookings?.forEach(booking => {
          if (booking.payment_method === 'cash' && booking.status === 'completed') {
            totalReceivedCash += booking.total_price * 0.9;
            totalGrossCash += booking.total_price;
            cashBookings++;
          } else if (booking.payment_method === 'card' && ['confirmed', 'completed'].includes(booking.status)) {
            totalReceivedCard += booking.total_price * 0.9;
            totalGrossCard += booking.total_price;
            cardBookings++;
          }
        });

        monthsData.push({
          month: format(monthDate, 'MMM', { locale: ro }),
          year: monthDate.getFullYear(),
          totalReceivedCash,
          totalReceivedCard,
          totalReceived: totalReceivedCash + totalReceivedCard,
          totalBookings: cashBookings + cardBookings,
          cashBookings,
          cardBookings,
          totalGrossCash,
          totalGrossCard,
          totalGross: totalGrossCash + totalGrossCard
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
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Venituri Baza Sportivă</h1>
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
                <CardTitle className="text-sm font-medium">Încasări Cash (90%)</CardTitle>
                <Banknote className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{incomeData.totalReceivedCash.toFixed(2)} RON</div>
                <p className="text-xs text-muted-foreground">
                  Din {incomeData.totalGrossCash.toFixed(2)} RON total • {incomeData.cashBookings} rezervări
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-all hover-scale bg-gradient-to-r from-card to-card/80">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Încasări Card (90%)</CardTitle>
                <CreditCard className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{incomeData.totalReceivedCard.toFixed(2)} RON</div>
                <p className="text-xs text-muted-foreground">
                  Din {incomeData.totalGrossCard.toFixed(2)} RON total • {incomeData.cardBookings} rezervări
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 shadow-md hover:shadow-lg transition-all hover-scale bg-gradient-to-r from-card to-card/80">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Primit</CardTitle>
                <TrendingUp className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{incomeData.totalReceived.toFixed(2)} RON</div>
                <p className="text-xs text-muted-foreground">
                  Din {incomeData.totalGross.toFixed(2)} RON total • {incomeData.totalBookings} rezervări
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Breakdown */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-secondary/30 to-secondary/20 p-4 rounded-lg border mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Evolutie Lunară (Ultimele 3 Luni)
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
                          {month.totalReceived.toFixed(2)} RON primit
                        </div>
                        <div className="text-sm text-muted-foreground">
                          din {month.totalGross.toFixed(2)} RON total • {month.totalBookings} rezervări
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="flex items-center gap-2">
                          <Banknote className="h-4 w-4 text-orange-600" />
                          <span className="text-sm font-medium">Cash (90%)</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-orange-600">{month.totalReceivedCash.toFixed(2)} RON</div>
                          <div className="text-xs text-muted-foreground">din {month.totalGrossCash.toFixed(2)} RON • {month.cashBookings} rezervări</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium">Card (90%)</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-blue-600">{month.totalReceivedCard.toFixed(2)} RON</div>
                          <div className="text-xs text-muted-foreground">din {month.totalGrossCard.toFixed(2)} RON • {month.cardBookings} rezervări</div>
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
                  <p className="font-medium">Încasări Cash</p>
                  <p className="text-sm text-muted-foreground">
                    Primiți 90% din rezervările cu plată cash finalizate. Platforma percepe 10% comision.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium">Încasări Card</p>
                  <p className="text-sm text-muted-foreground">
                    Primiți 90% din rezervările cu plată card confirmate sau finalizate. Platforma percepe 10% comision.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">Total Primit</p>
                  <p className="text-sm text-muted-foreground">
                    Suma totală pe care o primiți din toate rezervările pentru perioada selectată
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

export default FacilityIncomeManagement;
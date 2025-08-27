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

interface FacilityIncomeData {
  facilityId: string;
  facilityName: string;
  ownerName: string;
  phoneNumber: string;
  // Câți bani trebuie să primim de la baza (comision 10% din cash)
  commissionFromCash: number;
  cashBookings: number;
  // Câți bani trebuie să dăm la baza (90% din online)
  paymentToFacility: number;
  onlineBookings: number;
  // Calculul final (pozitiv = baza ne datorează, negativ = noi datorăm)
  netBalance: number;
  totalOnlineAmount: number;
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
  const [facilityData, setFacilityData] = useState<FacilityIncomeData[]>([]);
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

      // Load monthly data for the chart (last 3 months)
      await loadMonthlyData();
      
      // Load facility breakdown data
      await loadFacilityData(startDate, endDate);

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

      for (let i = 2; i >= 0; i--) {
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

  const loadFacilityData = async (startDate: Date, endDate: Date) => {
    try {
      // Get all bookings for the period
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .gte('booking_date', format(startDate, 'yyyy-MM-dd'))
        .lte('booking_date', format(endDate, 'yyyy-MM-dd'))
        .in('status', ['confirmed', 'completed']);

      if (bookingsError) throw bookingsError;

      // Get all unique facility IDs
      const facilityIds = [...new Set(bookings?.map(b => b.facility_id) || [])];
      
      if (facilityIds.length === 0) {
        setFacilityData([]);
        return;
      }

      // Get facility details with owner information
      const { data: facilities, error: facilitiesError } = await supabase
        .from('facilities')
        .select(`
          id,
          name,
          owner_id,
          profiles!facilities_owner_id_fkey (
            full_name,
            phone
          )
        `)
        .in('id', facilityIds);

      if (facilitiesError) throw facilitiesError;

      // Create a map of facility details
      const facilityDetailsMap = new Map();
      facilities?.forEach(facility => {
        facilityDetailsMap.set(facility.id, {
          name: facility.name,
          ownerName: facility.profiles?.full_name || 'Nume necunoscut',
          phoneNumber: facility.profiles?.phone || 'Telefon necunoscut'
        });
      });

      // Group bookings by facility
      const facilityMap = new Map<string, FacilityIncomeData>();

      bookings?.forEach(booking => {
        const facilityId = booking.facility_id;
        const facilityDetails = facilityDetailsMap.get(facilityId);
        
        if (!facilityDetails) return;

        if (!facilityMap.has(facilityId)) {
          facilityMap.set(facilityId, {
            facilityId,
            facilityName: facilityDetails.name,
            ownerName: facilityDetails.ownerName,
            phoneNumber: facilityDetails.phoneNumber,
            commissionFromCash: 0,
            cashBookings: 0,
            paymentToFacility: 0,
            onlineBookings: 0,
            netBalance: 0,
            totalOnlineAmount: 0
          });
        }

        const facilityData = facilityMap.get(facilityId)!;

        if (booking.payment_method === 'cash' && booking.status === 'completed') {
          // For cash payments: we get 10% commission only when completed
          // The facility gets the full amount and owes us 10%
          facilityData.commissionFromCash += booking.total_price * 0.1;
          facilityData.cashBookings++;
        } else if (booking.payment_method === 'card' && ['confirmed', 'completed'].includes(booking.status)) {
          // For card payments: we receive full amount and must transfer 90% to facility
          facilityData.totalOnlineAmount += booking.total_price;
          facilityData.paymentToFacility += booking.total_price * 0.9;
          facilityData.onlineBookings++;
        }
      });

      // Calculate net balance for each facility
      const facilityArray = Array.from(facilityMap.values()).map(facility => ({
        ...facility,
        // Pozitiv = baza ne datorează, Negativ = noi datorăm la baza
        netBalance: facility.commissionFromCash - facility.paymentToFacility
      }));

      // Sort by net balance (highest debt from facilities first)
      facilityArray.sort((a, b) => b.netBalance - a.netBalance);

      setFacilityData(facilityArray);
    } catch (error) {
      console.error('Error loading facility data:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca datele pentru facilități",
        variant: "destructive"
      });
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

          {/* Facility Breakdown */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-secondary/30 to-secondary/20 p-4 rounded-lg border mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Situația pe Baze Sportive
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Distribuția financiară cu fiecare proprietar de bază sportivă
              </p>
            </div>

            <div className="space-y-4">
              {facilityData.length > 0 ? (
                facilityData.map((facility, index) => (
                  <Card key={facility.facilityId} className="border shadow-sm hover:shadow-md transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg text-foreground">
                            {facility.facilityName}
                          </h4>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span>👤 {facility.ownerName}</span>
                            <span>📞 {facility.phoneNumber}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xl font-bold ${
                            facility.netBalance > 0 
                              ? 'text-green-600' 
                              : facility.netBalance < 0 
                                ? 'text-red-600' 
                                : 'text-gray-600'
                          }`}>
                            {facility.netBalance > 0 ? '+' : ''}{facility.netBalance.toFixed(2)} RON
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {facility.netBalance > 0 
                              ? 'Ne datorează' 
                              : facility.netBalance < 0 
                                ? 'Le datorăm' 
                                : 'Echilibrat'
                            }
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid md:grid-cols-3 gap-4">
                        {/* Commission from Cash */}
                        <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Banknote className="h-4 w-4 text-orange-600" />
                              <span className="text-sm font-medium">Comision Cash (10%)</span>
                            </div>
                          </div>
                          <div className="text-lg font-semibold text-orange-600">
                            +{facility.commissionFromCash.toFixed(2)} RON
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Din {facility.cashBookings} rezervări cash
                          </div>
                        </div>
                        
                        {/* Payment to Facility */}
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4 text-blue-600" />
                              <span className="text-sm font-medium">Plată către bază (90%)</span>
                            </div>
                          </div>
                          <div className="text-lg font-semibold text-blue-600">
                            -{facility.paymentToFacility.toFixed(2)} RON
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Din {facility.onlineBookings} rezervări online ({facility.totalOnlineAmount.toFixed(2)} RON)
                          </div>
                        </div>

                        {/* Net Balance */}
                        <div className={`p-3 rounded-lg border ${
                          facility.netBalance > 0 
                            ? 'bg-green-50 border-green-200' 
                            : facility.netBalance < 0 
                              ? 'bg-red-50 border-red-200' 
                              : 'bg-gray-50 border-gray-200'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <TrendingUp className={`h-4 w-4 ${
                                facility.netBalance > 0 
                                  ? 'text-green-600' 
                                  : facility.netBalance < 0 
                                    ? 'text-red-600' 
                                    : 'text-gray-600'
                              }`} />
                              <span className="text-sm font-medium">Situația Finală</span>
                            </div>
                          </div>
                          <div className={`text-lg font-semibold ${
                            facility.netBalance > 0 
                              ? 'text-green-600' 
                              : facility.netBalance < 0 
                                ? 'text-red-600' 
                                : 'text-gray-600'
                          }`}>
                            {facility.netBalance > 0 ? '+' : ''}{facility.netBalance.toFixed(2)} RON
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {facility.netBalance > 0 
                              ? 'Să ne plătească' 
                              : facility.netBalance < 0 
                                ? 'Să le plătim' 
                                : 'Echilibrat'
                            }
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Nu există date financiare pentru perioada selectată
                    </p>
                  </CardContent>
                </Card>
              )}
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
                  <p className="font-medium">Comision din Plăți Cash</p>
                  <p className="text-sm text-muted-foreground">
                    Percepem 10% comision din rezervările cu plată cash finalizate. Baza sportivă ne datorează acești bani.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium">Plăți către Baze Sportive</p>
                  <p className="text-sm text-muted-foreground">
                    Transferăm 90% din încasările online către bazele sportive (păstrăm 10% comision platformă)
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">Situația Finală per Bază</p>
                  <p className="text-sm text-muted-foreground">
                    Calculul final: Comision Cash - Plăți Online. Pozitiv = ne datorează, Negativ = le datorăm
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
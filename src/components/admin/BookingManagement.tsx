import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay } from "date-fns";
import { ro } from "date-fns/locale";
import { isBlockingTimeAllowed } from "@/utils/dateTimeValidation";
import { Badge } from "@/components/ui/badge";
import { DialogTrigger } from "@/components/ui/dialog";
import { Calendar as CalendarIcon, Clock, MapPin, User, DollarSign, Filter, Ban, X, Building2 } from "lucide-react";
import BookingStatusManager from "@/components/booking/BookingStatusManager";
import ClientBehaviorStats from "@/components/admin/ClientBehaviorStats";

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  total_price: number;
  notes?: string;
  created_at: string;
  client_id: string;
  facility_id: string;
  facility_name: string;
  facility_type: string;
  facility_city: string;
  client_name: string;
  client_email: string;
}

interface Facility {
  id: string;
  name: string;
  facility_type: string;
  city: string;
}

interface BlockedDate {
  id: string;
  facility_id: string;
  blocked_date: string;
  start_time?: string;
  end_time?: string;
  reason?: string;
  created_at: string;
}

interface CalendarDay {
  date: Date;
  bookings: Booking[];
  blockedTimes: BlockedDate[];
  isToday: boolean;
  isSelected: boolean;
}

const BookingManagement = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFacility, setSelectedFacility] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedSportType, setSelectedSportType] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  
  // Block date/time modal state
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockDate, setBlockDate] = useState('');
  const [blockStartTime, setBlockStartTime] = useState('');
  const [blockEndTime, setBlockEndTime] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [selectedFacilityForBlock, setSelectedFacilityForBlock] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterBookings();
  }, [selectedFacility, selectedStatus, selectedSportType, selectedDate, currentMonth]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load all bookings with facility and client details
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .order('booking_date', { ascending: false })
        .order('start_time', { ascending: true });

      if (bookingsError) throw bookingsError;

      // Get facility details for each booking
      const facilityIds = bookingsData?.map(b => b.facility_id) || [];
      const { data: facilitiesData } = await supabase
        .from('facilities')
        .select('id, name, facility_type, city')
        .in('id', facilityIds);

      // Get client details for each booking
      const clientIds = bookingsData?.map(b => b.client_id) || [];
      const { data: clientsData } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', clientIds);

      // Create lookup maps
      const facilityMap = new Map(facilitiesData?.map(f => [f.id, f]) || []);
      const clientMap = new Map(clientsData?.map(c => [c.user_id, c]) || []);

      const formattedBookings = bookingsData?.map(booking => {
        const facility = facilityMap.get(booking.facility_id);
        const client = clientMap.get(booking.client_id);
        
        return {
          ...booking,
          facility_name: facility?.name || 'Unknown',
          facility_type: facility?.facility_type || 'Unknown',
          facility_city: facility?.city || 'Unknown',
          client_name: client?.full_name || 'Unknown',
          client_email: client?.email || 'Unknown'
        };
      }) || [];

      setBookings(formattedBookings);

      // Load facilities for filter
      const { data: allFacilitiesData, error: facilitiesError } = await supabase
        .from('facilities')
        .select('id, name, facility_type, city')
        .eq('is_active', true)
        .order('name');

      if (facilitiesError) throw facilitiesError;
      setFacilities(allFacilitiesData || []);

      // Load blocked dates
      const { data: blockedDatesData, error: blockedError } = await supabase
        .from('blocked_dates')
        .select('*')
        .order('blocked_date', { ascending: false });

      if (blockedError) throw blockedError;
      
      // Remove duplicates based on id to prevent display issues
      const uniqueBlockedDates = blockedDatesData?.filter((item, index, arr) => 
        arr.findIndex(x => x.id === item.id) === index
      ) || [];
      
      setBlockedDates(uniqueBlockedDates);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca rezervările",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterBookings = () => {
    // This will be used to filter bookings based on selected criteria
    // The actual filtering is handled in the render method
  };

  const updateBookingStatus = async (bookingId: string, newStatus: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show') => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId);

      if (error) throw error;

      setBookings(prev => prev.map(booking => 
        booking.id === bookingId 
          ? { ...booking, status: newStatus }
          : booking
      ));

      toast({
        title: "Succes",
        description: "Statusul rezervării a fost actualizat",
      });
    } catch (error) {
      console.error('Error updating booking status:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut actualiza statusul rezervării",
        variant: "destructive"
      });
    }
  };

  const blockDateTime = async () => {
    if (!selectedFacilityForBlock || !blockDate) {
      toast({
        title: "Eroare",
        description: "Selectați facilitatea și data",
        variant: "destructive"
      });
      return;
    }

    // Validate date and time restrictions
    if (!isBlockingTimeAllowed(blockDate, blockStartTime)) {
      toast({
        title: "Eroare",
        description: "Nu puteți bloca date/ore din trecut sau ore care au trecut deja astăzi",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('blocked_dates')
        .insert({
          facility_id: selectedFacilityForBlock,
          blocked_date: blockDate,
          start_time: blockStartTime || null,
          end_time: blockEndTime || null,
          reason: blockReason || null,
          created_by: (await supabase.auth.getUser()).data.user?.id || ''
        });

      if (error) throw error;

      toast({
        title: "Succes",
        description: "Data/ora a fost blocată cu succes",
      });

      // Reset form and close modal
      setIsBlockModalOpen(false);
      setBlockDate('');
      setBlockStartTime('');
      setBlockEndTime('');
      setBlockReason('');
      setSelectedFacilityForBlock('');

      // Reload data
      loadData();
    } catch (error) {
      console.error('Error blocking date/time:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut bloca data/ora",
        variant: "destructive"
      });
    }
  };

  const unblockDateTime = async (blockId: string) => {
    try {
      const { error } = await supabase
        .from('blocked_dates')
        .delete()
        .eq('id', blockId);

      if (error) throw error;

      toast({
        title: "Succes",
        description: "Blocarea a fost eliminată",
      });

      // Immediately remove from local state to prevent duplicates
      setBlockedDates(prev => prev.filter(blocked => blocked.id !== blockId));
      
      // Also reload fresh data from server
      setTimeout(() => loadData(), 100);
    } catch (error) {
      console.error('Error unblocking date/time:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut elimina blocarea",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "În așteptare", variant: "secondary" as const },
      confirmed: { label: "Confirmată", variant: "default" as const },
      cancelled: { label: "Anulată", variant: "destructive" as const },
      completed: { label: "Finalizată", variant: "outline" as const },
      no_show: { label: "Lipsă", variant: "destructive" as const }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getFacilityTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      'football': 'Fotbal',
      'tennis': 'Tenis',
      'padel': 'Padel',
      'squash': 'Squash',
      'basketball': 'Baschet',
      'volleyball': 'Volei',
      'foot_tennis': 'Tenis de Picior',
      'ping_pong': 'Ping Pong',
      'other': 'Altele'
    };
    return types[type] || type;
  };

  const getFacilityTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      'football': 'bg-gradient-to-r from-green-500 to-green-600',
      'tennis': 'bg-gradient-to-r from-orange-500 to-orange-600', 
      'padel': 'bg-gradient-to-r from-pink-500 to-pink-600',
      'squash': 'bg-gradient-to-r from-cyan-500 to-cyan-600',
      'basketball': 'bg-gradient-to-r from-purple-500 to-purple-600',
      'volleyball': 'bg-gradient-to-r from-blue-500 to-blue-600',
      'foot_tennis': 'bg-gradient-to-r from-red-500 to-red-600',
      'ping_pong': 'bg-gradient-to-r from-yellow-500 to-yellow-600',
      'other': 'bg-gradient-to-r from-gray-500 to-gray-600'
    };
    return colors[type] || colors['other'];
  };

  const getSportTypes = () => {
    const types = [
      { value: 'football', label: 'Fotbal' },
      { value: 'tennis', label: 'Tenis' },
      { value: 'padel', label: 'Padel' },
      { value: 'squash', label: 'Squash' },
      { value: 'basketball', label: 'Baschet' },
      { value: 'volleyball', label: 'Volei' },
      { value: 'foot_tennis', label: 'Tenis de Picior' },
      { value: 'ping_pong', label: 'Ping Pong' },
      { value: 'other', label: 'Altele' }
    ];
    return types;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const getCalendarDays = (): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const today = new Date();
    
    // Get start and end of the current month being viewed
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    // Get start of week for the first day of month (to show full weeks)
    const startOfWeek = new Date(startOfMonth);
    startOfWeek.setDate(startOfMonth.getDate() - startOfMonth.getDay() + 1);
    
    // Get end of week for the last day of month
    const endOfWeek = new Date(endOfMonth);
    endOfWeek.setDate(endOfMonth.getDate() + (7 - endOfMonth.getDay()));
    
    // Generate days for the full calendar grid
    for (let d = new Date(startOfWeek); d <= endOfWeek; d.setDate(d.getDate() + 1)) {
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayBookings = bookings.filter(booking => 
        booking.booking_date === dateStr &&
        (selectedFacility === "all" || booking.facility_id === selectedFacility) &&
        (selectedStatus === "all" || booking.status === selectedStatus) &&
        (selectedSportType === "all" || booking.facility_type === selectedSportType)
      );
      const dayBlocked = blockedDates.filter(blocked => 
        blocked.blocked_date === dateStr &&
        (selectedFacility === "all" || blocked.facility_id === selectedFacility)
      );
      
      days.push({
        date: new Date(d),
        bookings: dayBookings,
        blockedTimes: dayBlocked,
        isToday: format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'),
        isSelected: selectedDate ? format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd') : false
      });
    }
    
    return days;
  };

  const filteredBookings = bookings.filter(booking => {
    const facilityMatch = selectedFacility === "all" || booking.facility_id === selectedFacility;
    const statusMatch = selectedStatus === "all" || booking.status === selectedStatus;
    const sportTypeMatch = selectedSportType === "all" || booking.facility_type === selectedSportType;
    const dateMatch = !selectedDate || booking.booking_date === format(selectedDate, 'yyyy-MM-dd');
    
    return facilityMatch && statusMatch && sportTypeMatch && dateMatch;
  });

  const filteredBlockedDates = blockedDates.filter(blocked => {
    const facilityMatch = selectedFacility === "all" || blocked.facility_id === selectedFacility;
    const dateMatch = !selectedDate || blocked.blocked_date === format(selectedDate, 'yyyy-MM-dd');
    
    return facilityMatch && dateMatch;
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gestionare Rezervări</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Se încarcă rezervările...</p>
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
                <CalendarIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Gestionare Rezervări</h1>
                <p className="text-sm text-muted-foreground">({filteredBookings.length} rezervări găsite)</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Dialog open={isBlockModalOpen} onOpenChange={setIsBlockModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="hover-scale shadow-sm">
                    <Ban className="h-4 w-4 mr-2" />
                    Blochează Dată/Oră
                  </Button>
                </DialogTrigger>
                <DialogContent className="animate-scale-in">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Ban className="h-5 w-5 text-destructive" />
                      Blochează Dată/Oră pentru Teren
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="animate-fade-in">
                      <label className="text-sm font-medium mb-2 block">Teren</label>
                      <Select value={selectedFacilityForBlock} onValueChange={setSelectedFacilityForBlock}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Selectează terenul" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-lg z-50">
                          {facilities.map(facility => (
                            <SelectItem key={facility.id} value={facility.id} className="hover:bg-accent">
                              {facility.name} - {facility.city}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                      <label className="text-sm font-medium mb-2 block">Data</label>
                      <Input
                        type="date"
                        value={blockDate}
                        onChange={(e) => setBlockDate(e.target.value)}
                        className="bg-background"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Ora început (opțional)</label>
                        <Input
                          type="time"
                          value={blockStartTime}
                          onChange={(e) => setBlockStartTime(e.target.value)}
                          className="bg-background"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Ora sfârșit (opțional)</label>
                        <Input
                          type="time"
                          value={blockEndTime}
                          onChange={(e) => setBlockEndTime(e.target.value)}
                          className="bg-background"
                        />
                      </div>
                    </div>
                    
                    <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
                      <label className="text-sm font-medium mb-2 block">Motiv (opțional)</label>
                      <Textarea
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)}
                        placeholder="Ex: Mentenanță, întrerupere curent, etc."
                        className="bg-background"
                      />
                    </div>
                    
                    <div className="flex justify-end gap-2 pt-4 border-t animate-fade-in" style={{ animationDelay: '0.4s' }}>
                      <Button variant="outline" onClick={() => setIsBlockModalOpen(false)} className="hover-scale">
                        Anulează
                      </Button>
                      <Button onClick={blockDateTime} className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary hover-scale">
                        Blochează
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg shadow-sm">
                <Button
                  variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('calendar')}
                  className="transition-all duration-200 hover-scale"
                >
                  Calendar
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="transition-all duration-200 hover-scale"
                >
                  Listă
                </Button>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {/* Filters */}
          <div className="grid md:grid-cols-3 gap-6 mb-8 p-4 bg-gradient-to-r from-secondary/30 to-secondary/20 rounded-lg border animate-fade-in">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Facilitate
              </label>
              <Select value={selectedFacility} onValueChange={setSelectedFacility}>
                <SelectTrigger className="bg-background shadow-sm hover:shadow-md transition-shadow">
                  <SelectValue placeholder="Toate facilitățile" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all" className="hover:bg-accent">Toate facilitățile</SelectItem>
                  {facilities.map(facility => (
                    <SelectItem key={facility.id} value={facility.id} className="hover:bg-accent">
                      {facility.name} - {facility.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                Status
              </label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="bg-background shadow-sm hover:shadow-md transition-shadow">
                  <SelectValue placeholder="Toate statusurile" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all" className="hover:bg-accent">Toate statusurile</SelectItem>
                  <SelectItem value="pending" className="hover:bg-accent">În așteptare</SelectItem>
                   <SelectItem value="confirmed" className="hover:bg-accent">Confirmată</SelectItem>
                   <SelectItem value="cancelled" className="hover:bg-accent">Anulată</SelectItem>
                   <SelectItem value="completed" className="hover:bg-accent">Finalizată</SelectItem>
                   <SelectItem value="no_show" className="hover:bg-accent">Lipsă</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                Tip sport
              </label>
              <Select value={selectedSportType} onValueChange={setSelectedSportType}>
                <SelectTrigger className="bg-background shadow-sm hover:shadow-md transition-shadow">
                  <SelectValue placeholder="Toate sporturile" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all" className="hover:bg-accent">Toate sporturile</SelectItem>
                  {getSportTypes().map(sport => (
                    <SelectItem key={sport.value} value={sport.value} className="hover:bg-accent">
                      {sport.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Unified Calendar View */}
          {viewMode === 'calendar' && (
            <div className="mb-8 animate-fade-in">
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 rounded-lg border border-primary/20 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-primary">
                      <CalendarIcon className="h-5 w-5" />
                      Calendar Rezervări
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">Navigează prin luni și click pe o zi pentru detalii</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateMonth('prev')}
                      className="hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      ←
                    </Button>
                    <span className="text-lg font-semibold min-w-[200px] text-center">
                      {format(currentMonth, 'MMMM yyyy', { locale: ro })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateMonth('next')}
                      className="hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      →
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-2 mb-4">
                {['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'].map(day => (
                  <div key={day} className="text-center text-sm font-medium p-3 bg-secondary/30 rounded-lg border">
                    {day}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-3">
                {getCalendarDays().map((day, index) => {
                  const isCurrentMonth = day.date.getMonth() === currentMonth.getMonth();
                  return (
                    <div
                      key={index}
                      className={`min-h-32 border-2 rounded-xl p-3 cursor-pointer transition-all duration-300 hover-scale shadow-sm hover:shadow-lg ${
                        !isCurrentMonth ? 'opacity-50 bg-muted/20' :
                        day.isToday ? 'bg-gradient-to-br from-primary/20 to-primary/10 border-primary shadow-md' : 
                        day.isSelected ? 'bg-gradient-to-br from-secondary/50 to-secondary/30 border-primary shadow-md' : 
                        'bg-card/50 border-border hover:bg-secondary/30 hover:border-primary/50'
                      }`}
                      onClick={() => {
                        setSelectedDate(day.date);
                        if (!isCurrentMonth) {
                          setCurrentMonth(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
                        }
                      }}
                    >
                      <div className={`text-sm font-semibold mb-2 ${
                        !isCurrentMonth ? 'text-muted-foreground' :
                        day.isToday ? 'text-primary' : 'text-foreground'
                      }`}>
                        {format(day.date, 'd')}
                        {day.isToday && <span className="ml-1 text-xs">(azi)</span>}
                      </div>
                      <div className="space-y-1">
                        {day.bookings.slice(0, 2).map((booking, idx) => (
                          <div
                            key={idx}
                            className={`text-xs p-2 rounded-lg text-white shadow-sm font-medium transition-all hover:scale-105 ${getFacilityTypeColor(booking.facility_type)} ${
                              booking.status === 'cancelled' ? 'opacity-60 line-through' :
                              booking.status === 'pending' ? 'ring-2 ring-yellow-400/50' :
                              ''
                            }`}
                            title={`${booking.start_time} - ${booking.facility_name} (${getFacilityTypeLabel(booking.facility_type)})`}
                          >
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {booking.start_time}
                            </div>
                            <div className="text-[10px] opacity-90 truncate">
                              {getFacilityTypeLabel(booking.facility_type)}
                            </div>
                          </div>
                        ))}
                        {day.blockedTimes.length > 0 && (
                          <div className="text-xs p-2 rounded-lg bg-gradient-to-r from-black to-gray-800 text-white shadow-sm">
                            <div className="flex items-center gap-1">
                              <Ban className="h-3 w-3" />
                              Blocat
                            </div>
                          </div>
                        )}
                        {day.bookings.length > 2 && (
                          <div className="text-xs text-muted-foreground font-medium bg-secondary/50 p-1 rounded">
                            +{day.bookings.length - 2} mai multe
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Blocked Times for Selected Date */}
          {filteredBlockedDates.length > 0 && (
            <div className="mb-8 animate-fade-in">
              <div className="bg-gradient-to-r from-destructive/5 to-destructive/10 p-4 rounded-lg border border-destructive/20 mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-destructive">
                  <Ban className="h-5 w-5" />
                  Date/Ore Blocate
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Intervalele blocate pentru data selectată</p>
              </div>
              <div className="grid gap-3">
                {filteredBlockedDates.map((blocked, index) => {
                  const facility = facilities.find(f => f.id === blocked.facility_id);
                  return (
                    <Card key={blocked.id} className="border-l-4 border-l-destructive shadow-md hover:shadow-lg transition-all duration-300 hover-scale bg-gradient-to-r from-card to-card/80 animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-8 h-8 bg-destructive/20 rounded-full flex items-center justify-center">
                                <Ban className="h-4 w-4 text-destructive" />
                              </div>
                              <span className="font-semibold text-lg">{facility?.name || 'Teren necunoscut'}</span>
                              <Badge variant="destructive" className="shadow-sm">Blocat</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1 ml-11">
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4" />
                                <span className="font-medium">Data: {format(new Date(blocked.blocked_date), 'dd MMMM yyyy', { locale: ro })}</span>
                              </div>
                              {blocked.start_time && blocked.end_time && (
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4" />
                                  <span>Interval: {blocked.start_time} - {blocked.end_time}</span>
                                </div>
                              )}
                              {blocked.reason && (
                                <div className="flex items-center gap-2">
                                  <Filter className="h-4 w-4" />
                                  <span>Motiv: {blocked.reason}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unblockDateTime(blocked.id)}
                            className="hover-scale shadow-sm hover:shadow-md hover:border-destructive hover:text-destructive transition-all"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Deblochează
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="animate-fade-in">
              {filteredBookings.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CalendarIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-lg font-medium">
                    Nu există rezervări pentru criteriile selectate.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Încearcă să modifici filtrele pentru a vedea alte rezervări.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredBookings.map((booking, index) => (
                    <Card key={booking.id} className="border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-all duration-300 hover-scale bg-gradient-to-r from-card to-card/80 animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                                <Building2 className="h-5 w-5 text-blue-600" />
                              </div>
                              <h3 className="text-lg font-semibold">{booking.facility_name}</h3>
                              {getStatusBadge(booking.status)}
                              <Badge variant="outline" className="shadow-sm">
                                {getFacilityTypeLabel(booking.facility_type)}
                              </Badge>
                            </div>
                            
                            <div className="grid md:grid-cols-2 gap-6 mb-4">
                              <div className="space-y-3 p-4 bg-secondary/20 rounded-lg border">
                                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Detalii Rezervare</h4>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <CalendarIcon className="h-4 w-4" />
                                  {format(new Date(booking.booking_date), 'dd MMMM yyyy', { locale: ro })}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Clock className="h-4 w-4" />
                                  {booking.start_time} - {booking.end_time}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <MapPin className="h-4 w-4" />
                                  {booking.facility_city}
                                </div>
                              </div>
                              
                              <div className="space-y-3 p-4 bg-secondary/20 rounded-lg border">
                                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Detalii Client</h4>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <User className="h-4 w-4" />
                                  {booking.client_name} ({booking.client_email})
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <DollarSign className="h-4 w-4" />
                                  {booking.total_price} RON
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  <strong>Rezervată:</strong> {format(new Date(booking.created_at), 'dd/MM/yyyy HH:mm', { locale: ro })}
                                </p>
                              </div>
                            </div>

                            {booking.notes && (
                              <div className="p-4 bg-muted/30 rounded-lg border mb-4">
                                <p className="text-sm font-medium text-muted-foreground mb-2">Note suplimentare:</p>
                                <p className="text-sm">{booking.notes}</p>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-3 ml-6">
                            <BookingStatusManager 
                              booking={{
                                id: booking.id,
                                booking_date: booking.booking_date,
                                start_time: booking.start_time,
                                end_time: booking.end_time,
                                status: booking.status,
                                total_price: booking.total_price,
                                payment_method: 'cash', // You might want to add this field to the interface
                                notes: booking.notes,
                                client_id: booking.client_id
                              }}
                              onStatusUpdate={() => loadData()}
                              showStatusUpdate={true}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BookingManagement;
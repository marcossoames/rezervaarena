import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Clock, MapPin, User, DollarSign, Filter, Ban, Plus, X } from "lucide-react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
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
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
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
  }, [selectedFacility, selectedStatus, selectedDate]);

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
      setBlockedDates(blockedDatesData || []);

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

  const updateBookingStatus = async (bookingId: string, newStatus: 'pending' | 'confirmed' | 'cancelled' | 'completed') => {
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

      loadData();
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
      completed: { label: "Finalizată", variant: "outline" as const }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getFacilityTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      'football': 'Fotbal',
      'tennis': 'Tenis',
      'basketball': 'Baschet',
      'volleyball': 'Volei',
      'swimming': 'Înot',
      'padel': 'Padel',
      'other': 'Altele'
    };
    return types[type] || type;
  };

  const getCalendarDays = (): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const today = new Date();
    const selectedMonth = selectedDate || today;
    
    // Get start and end of month
    const startOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const endOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
    
    // Generate days for the month
    for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayBookings = bookings.filter(booking => 
        booking.booking_date === dateStr &&
        (selectedFacility === "all" || booking.facility_id === selectedFacility)
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
    const dateMatch = !selectedDate || booking.booking_date === format(selectedDate, 'yyyy-MM-dd');
    
    return facilityMatch && statusMatch && dateMatch;
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-6 w-6" />
              Gestionare Rezervări ({filteredBookings.length})
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={isBlockModalOpen} onOpenChange={setIsBlockModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Ban className="h-4 w-4 mr-2" />
                    Blochează Dată/Oră
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Blochează Dată/Oră pentru Teren</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Teren</label>
                      <Select value={selectedFacilityForBlock} onValueChange={setSelectedFacilityForBlock}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selectează terenul" />
                        </SelectTrigger>
                        <SelectContent>
                          {facilities.map(facility => (
                            <SelectItem key={facility.id} value={facility.id}>
                              {facility.name} - {facility.city}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium mb-2 block">Data</label>
                      <Input
                        type="date"
                        value={blockDate}
                        onChange={(e) => setBlockDate(e.target.value)}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Ora început (opțional)</label>
                        <Input
                          type="time"
                          value={blockStartTime}
                          onChange={(e) => setBlockStartTime(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Ora sfârșit (opțional)</label>
                        <Input
                          type="time"
                          value={blockEndTime}
                          onChange={(e) => setBlockEndTime(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium mb-2 block">Motiv (opțional)</label>
                      <Textarea
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)}
                        placeholder="Ex: Mentenanță, întrerupere curent, etc."
                      />
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsBlockModalOpen(false)}>
                        Anulează
                      </Button>
                      <Button onClick={blockDateTime}>
                        Blochează
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <div className="flex gap-1 border rounded-md">
                <Button
                  variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('calendar')}
                >
                  Calendar
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  Listă
                </Button>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Facilitate</label>
              <Select value={selectedFacility} onValueChange={setSelectedFacility}>
                <SelectTrigger>
                  <SelectValue placeholder="Toate facilitățile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate facilitățile</SelectItem>
                  {facilities.map(facility => (
                    <SelectItem key={facility.id} value={facility.id}>
                      {facility.name} - {facility.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Toate statusurile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate statusurile</SelectItem>
                  <SelectItem value="pending">În așteptare</SelectItem>
                  <SelectItem value="confirmed">Confirmată</SelectItem>
                  <SelectItem value="cancelled">Anulată</SelectItem>
                  <SelectItem value="completed">Finalizată</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Data</label>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={ro}
                className="rounded-md border w-fit"
              />
            </div>
          </div>

          {/* Calendar View */}
          {viewMode === 'calendar' && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4">Calendar Rezervări</h3>
              <div className="grid grid-cols-7 gap-2 mb-4">
                {['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'].map(day => (
                  <div key={day} className="text-center text-sm font-medium p-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {getCalendarDays().map((day, index) => (
                  <div
                    key={index}
                    className={`min-h-24 border rounded-lg p-2 cursor-pointer transition-colors ${
                      day.isToday ? 'bg-primary/10 border-primary' : 
                      day.isSelected ? 'bg-secondary border-primary' : 
                      'hover:bg-secondary/50'
                    }`}
                    onClick={() => setSelectedDate(day.date)}
                  >
                    <div className="text-sm font-medium mb-1">
                      {format(day.date, 'd')}
                    </div>
                    <div className="space-y-1">
                      {day.bookings.slice(0, 2).map((booking, idx) => (
                        <div
                          key={idx}
                          className={`text-xs p-1 rounded text-white ${
                            booking.status === 'confirmed' ? 'bg-green-500' :
                            booking.status === 'pending' ? 'bg-yellow-500' :
                            booking.status === 'cancelled' ? 'bg-red-500' :
                            'bg-gray-500'
                          }`}
                        >
                          {booking.start_time}
                        </div>
                      ))}
                      {day.blockedTimes.length > 0 && (
                        <div className="text-xs p-1 rounded bg-black text-white">
                          <Ban className="h-3 w-3 inline mr-1" />
                          Blocat
                        </div>
                      )}
                      {day.bookings.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{day.bookings.length - 2} mai multe
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Blocked Times for Selected Date */}
          {filteredBlockedDates.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4">Date/Ore Blocate</h3>
              <div className="grid gap-2">
                {filteredBlockedDates.map((blocked) => {
                  const facility = facilities.find(f => f.id === blocked.facility_id);
                  return (
                    <Card key={blocked.id} className="border-l-4 border-l-red-500">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Ban className="h-4 w-4 text-red-500" />
                              <span className="font-medium">{facility?.name || 'Teren necunoscut'}</span>
                              <Badge variant="destructive">Blocat</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              <div>Data: {format(new Date(blocked.blocked_date), 'dd MMMM yyyy', { locale: ro })}</div>
                              {blocked.start_time && blocked.end_time && (
                                <div>Interval: {blocked.start_time} - {blocked.end_time}</div>
                              )}
                              {blocked.reason && (
                                <div>Motiv: {blocked.reason}</div>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unblockDateTime(blocked.id)}
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
            <>
              {filteredBookings.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nu există rezervări pentru criteriile selectate.
                </p>
              ) : (
                <div className="grid gap-4">
                  {filteredBookings.map((booking) => (
                    <Card key={booking.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <h3 className="text-lg font-semibold">{booking.facility_name}</h3>
                              {getStatusBadge(booking.status)}
                              <Badge variant="outline">
                                {getFacilityTypeLabel(booking.facility_type)}
                              </Badge>
                            </div>
                            
                            <div className="grid md:grid-cols-2 gap-4 mb-4">
                              <div className="space-y-2">
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
                              
                              <div className="space-y-2">
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
                              <p className="text-sm text-muted-foreground mb-4">
                                <strong>Note:</strong> {booking.notes}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col gap-2 ml-4">
                            {booking.status === 'pending' && (
                              <>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                                >
                                  Confirmă
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                                >
                                  Anulează
                                </Button>
                              </>
                            )}
                            
                            {booking.status === 'confirmed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateBookingStatus(booking.id, 'completed')}
                              >
                                Marchează ca finalizată
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BookingManagement;
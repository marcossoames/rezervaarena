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
import { Calendar as CalendarIcon, Clock, MapPin, User, DollarSign, Filter, Ban, X, Building2, Trash2 } from "lucide-react";
import BookingStatusManager from "@/components/booking/BookingStatusManager";
import ClientBehaviorStats from "@/components/admin/ClientBehaviorStats";
import BookingDetailsDialog from "@/components/admin/BookingDetailsDialog";
import DayBookingsDialog from "@/components/admin/DayBookingsDialog";
import SelectiveUnblockDialog from "@/components/facility/SelectiveUnblockDialog";
import AddManualBookingDialog from "@/components/facility/AddManualBookingDialog";
import DayScheduleCalendar from "@/components/admin/DayScheduleCalendar";

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'pending';
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
  payment_method?: string;
}

interface Facility {
  id: string;
  name: string;
  facility_type: string;
  city: string;
  operating_hours_start?: string;
  operating_hours_end?: string;
  price_per_hour: number;
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
  const [selectedFacilityForManual, setSelectedFacilityForManual] = useState('');
  
  // Booking details modal state
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isBookingDetailsOpen, setIsBookingDetailsOpen] = useState(false);
  
  // Day bookings dialog state
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
  const [isDayBookingsOpen, setIsDayBookingsOpen] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadBookings(), loadFacilities(), loadBlockedDates()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          facilities!bookings_facility_id_fkey(name, facility_type, city),
          profiles!bookings_client_id_fkey(full_name, email)
        `)
        .order('booking_date', { ascending: false })
        .order('start_time', { ascending: true });

      if (error) throw error;

      const formattedBookings = (data || []).map(booking => ({
        id: booking.id,
        booking_date: booking.booking_date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        status: booking.status,
        total_price: booking.total_price,
        notes: booking.notes,
        created_at: booking.created_at,
        client_id: booking.client_id,
        facility_id: booking.facility_id,
        facility_name: booking.facilities.name,
        facility_type: booking.facilities.facility_type,
        facility_city: booking.facilities.city,
        client_name: booking.profiles.full_name,
        client_email: booking.profiles.email,
        payment_method: booking.payment_method || 'cash'
      }));

      setBookings(formattedBookings);
    } catch (error) {
      console.error('Error loading bookings:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca rezervările",
        variant: "destructive"
      });
    }
  };

  const loadFacilities = async () => {
    try {
      const { data, error } = await supabase
        .from('facilities')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setFacilities(data || []);
    } catch (error) {
      console.error('Error loading facilities:', error);
    }
  };

  const loadBlockedDates = async () => {
    try {
      const { data, error } = await supabase
        .from('blocked_dates')
        .select('*')
        .order('blocked_date', { ascending: false });

      if (error) throw error;
      setBlockedDates(data || []);
    } catch (error) {
      console.error('Error loading blocked dates:', error);
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

      setIsBlockModalOpen(false);
      setBlockDate('');
      setBlockStartTime('');
      setBlockEndTime('');
      setBlockReason('');
      setSelectedFacilityForBlock('');

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

  // Filter bookings based on selected criteria
  const filteredBookings = bookings.filter(booking => {
    if (selectedFacility !== "all" && booking.facility_id !== selectedFacility) return false;
    if (selectedStatus !== "all" && booking.status !== selectedStatus) return false;
    if (selectedSportType !== "all" && booking.facility_type !== selectedSportType) return false;
    return true;
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Se încarcă rezervările...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarIcon className="h-5 w-5 text-primary" />
              <div>
                <h1 className="text-xl font-bold">Gestionare Rezervări</h1>
                <p className="text-sm text-muted-foreground">({filteredBookings.length} rezervări găsite)</p>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="hidden md:grid grid-cols-4 gap-2 text-center">
              <div className="bg-primary/10 p-2 rounded-lg">
                <div className="text-lg font-bold text-primary">{bookings.length}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="bg-green-500/10 p-2 rounded-lg">
                <div className="text-lg font-bold text-green-600">
                  {bookings.filter(b => b.status === 'confirmed').length}
                </div>
                <div className="text-xs text-muted-foreground">Confirmate</div>
              </div>
              <div className="bg-orange-500/10 p-2 rounded-lg">
                <div className="text-lg font-bold text-orange-600">
                  {bookings.filter(b => b.status === 'completed').length}
                </div>
                <div className="text-xs text-muted-foreground">Finalizate</div>
              </div>
              <div className="bg-red-500/10 p-2 rounded-lg">
                <div className="text-lg font-bold text-red-600">
                  {bookings.filter(b => b.status === 'cancelled').length}
                </div>
                <div className="text-xs text-muted-foreground">Anulate</div>
              </div>
            </div>
          </CardTitle>
          
          {/* Enhanced Action Panel */}
          <div className="bg-muted/30 rounded-lg p-4 border mt-4">
            <div className="text-sm font-medium mb-3">Acțiuni Rapide</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Manual Booking Section */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Rezervare Manuală</label>
                <Select value={selectedFacilityForManual} onValueChange={setSelectedFacilityForManual}>
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
                {selectedFacilityForManual && (() => {
                  const facility = facilities.find(f => f.id === selectedFacilityForManual);
                  return facility ? (
                    <AddManualBookingDialog 
                      facilityId={selectedFacilityForManual}
                      facility={{
                        operating_hours_start: facility.operating_hours_start,
                        operating_hours_end: facility.operating_hours_end,
                        price_per_hour: facility.price_per_hour
                      }}
                      onBookingAdded={loadData}
                    />
                  ) : null;
                })()}
              </div>

              {/* Block Date/Time Section */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Blocare Disponibilitate</label>
                <Dialog open={isBlockModalOpen} onOpenChange={setIsBlockModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="w-full">
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
                        <Label>Teren</Label>
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
                        <Label>Data</Label>
                        <Input
                          type="date"
                          value={blockDate}
                          onChange={(e) => setBlockDate(e.target.value)}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Ora început (opțional)</Label>
                          <Input
                            type="time"
                            value={blockStartTime}
                            onChange={(e) => setBlockStartTime(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Ora sfârșit (opțional)</Label>
                          <Input
                            type="time"
                            value={blockEndTime}
                            onChange={(e) => setBlockEndTime(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label>Motiv (opțional)</Label>
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
              </div>

              {/* View Toggle Section */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Mod Vizualizare</label>
                <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg">
                  <Button
                    variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('calendar')}
                    className="flex-1"
                  >
                    Calendar
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="flex-1"
                  >
                    Listă
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
            <div>
              <Label>Facilitate</Label>
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
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Toate statusurile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate statusurile</SelectItem>
                  <SelectItem value="confirmed">Confirmată</SelectItem>
                  <SelectItem value="cancelled">Anulată</SelectItem>
                  <SelectItem value="completed">Finalizată</SelectItem>
                  <SelectItem value="no_show">Lipsă</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tip Sport</Label>
              <Select value={selectedSportType} onValueChange={setSelectedSportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Toate tipurile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate tipurile</SelectItem>
                  <SelectItem value="fotbal">Fotbal</SelectItem>
                  <SelectItem value="tenis">Tenis</SelectItem>
                  <SelectItem value="baschet">Baschet</SelectItem>
                  <SelectItem value="volei">Volei</SelectItem>
                  <SelectItem value="padel">Padel</SelectItem>
                  <SelectItem value="squash">Squash</SelectItem>
                  <SelectItem value="inot">Înot</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Day Schedule Calendar */}
          <DayScheduleCalendar
            selectedDate={selectedDate}
            bookings={filteredBookings}
            facilities={facilities}
            selectedFacility={selectedFacility}
            onBookingClick={(bookingId) => {
              setSelectedBookingId(bookingId);
              setIsBookingDetailsOpen(true);
            }}
          />

          {/* Bookings List */}
          <div className="space-y-4">
            {filteredBookings.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Nu au fost găsite rezervări pentru criteriile selectate.</p>
              </div>
            ) : (
              filteredBookings.map((booking) => (
                <Card key={booking.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <div className="font-medium">{booking.facility_name}</div>
                        <div className="text-muted-foreground">{booking.facility_city}</div>
                      </div>
                      <div className="text-sm">
                        <div className="font-medium">{format(new Date(booking.booking_date), 'dd MMM yyyy', { locale: ro })}</div>
                        <div className="text-muted-foreground">{booking.start_time} - {booking.end_time}</div>
                      </div>
                      <div className="text-sm">
                        <div className="font-medium">{booking.client_name}</div>
                        <div className="text-muted-foreground">{booking.client_email}</div>
                      </div>
                      <div className="text-sm">
                        <div className="font-medium">{booking.total_price} RON</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <BookingStatusManager
                        booking={{
                          id: booking.id,
                          booking_date: booking.booking_date,
                          start_time: booking.start_time,
                          end_time: booking.end_time,
                          status: booking.status,
                          total_price: booking.total_price,
                          payment_method: 'cash',
                          notes: booking.notes,
                          client_id: booking.client_id
                        }}
                        onStatusUpdate={loadData}
                      />
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BookingManagement;

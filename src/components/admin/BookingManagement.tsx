import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Clock, MapPin, User, DollarSign, Filter } from "lucide-react";
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

const BookingManagement = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFacility, setSelectedFacility] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
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
      
      // Load all bookings with facility and client details using separate queries
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

  const filteredBookings = bookings.filter(booking => {
    const facilityMatch = selectedFacility === "all" || booking.facility_id === selectedFacility;
    const statusMatch = selectedStatus === "all" || booking.status === selectedStatus;
    const dateMatch = !selectedDate || booking.booking_date === format(selectedDate, 'yyyy-MM-dd');
    
    return facilityMatch && statusMatch && dateMatch;
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
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-6 w-6" />
            Gestionare Rezervări ({filteredBookings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid md:grid-cols-4 gap-4 mb-6">
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

            <div className="md:col-span-2">
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

          {/* Bookings List */}
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
        </CardContent>
      </Card>
    </div>
  );
};

export default BookingManagement;
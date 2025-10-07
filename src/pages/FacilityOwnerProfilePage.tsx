import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Calendar, Building2, Settings, User, Trash2, CreditCard, CheckCircle, AlertCircle, Edit, Plus, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { deleteUserAccount, checkOwnerActiveFacilityBookings } from "@/utils/deleteAccount";
import { validateIbanFormat, sanitizeInput, validateAccountHolderName, validateBankName, maskIban } from "@/utils/bankSecurity";
import { checkClientRateLimit } from "@/utils/securityHeaders";
import { format } from "date-fns";
interface BankDetails {
  id: string;
  account_holder_name: string;
  bank_name: string;
  iban: string;
  created_at: string;
  updated_at: string;
}
interface BankFormData {
  account_holder_name: string;
  bank_name: string;
  iban: string;
}
const FacilityOwnerProfilePage = () => {
  const [activeBookingsInfo, setActiveBookingsInfo] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [submittingBankDetails, setSubmittingBankDetails] = useState(false);
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [sportsComplexData, setSportsComplexData] = useState<any>(null);
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: {
      errors
    }
  } = useForm<BankFormData>();
  const [stats, setStats] = useState({
    todayBookings: 0,
    monthlyBookings: 0,
    activeFacilities: 0
  });
  useEffect(() => {
    checkAuth();
    loadBankDetails();
    loadSportsComplexData();
  }, []);
  const checkAuth = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/facility/login");
        return;
      }
      await loadProfile(user.id);
      await loadStats(user.id);
    } catch (error) {
      console.error("Auth check error:", error);
      navigate("/facility/login");
    }
  };
  const loadProfile = async (userId: string) => {
    try {
      const {
        data,
        error
      } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
      if (error) {
        throw error;
      }
      setProfile(data);
    } catch (error) {
      console.error("Error loading profile:", error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut încărca profilul",
        variant: "destructive"
      });
    }
  };
  const loadSportsComplexData = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;
      const {
        data,
        error
      } = await supabase.from("sports_complexes").select("*").eq("owner_id", user.id).maybeSingle();
      if (error) {
        console.error("Error loading sports complex:", error);
        return;
      }
      setSportsComplexData(data);
    } catch (error) {
      console.error("Error loading sports complex data:", error);
    }
  };
  const loadStats = async (userId: string) => {
    try {
      // Get user's ACTIVE facilities
      const {
        data: facilities,
        error: facilitiesError
      } = await supabase.from("facilities").select("id").eq("owner_id", userId).eq("is_active", true); // Only count active facilities

      if (facilitiesError) {
        throw facilitiesError;
      }
      const facilityIds = facilities.map(f => f.id);
      if (facilityIds.length === 0) {
        setStats({
          todayBookings: 0,
          monthlyBookings: 0,
          activeFacilities: 0
        });
        return;
      }

      // Get today's date in local timezone (avoid UTC shift)
      const today = new Date();
      const todayStr = format(today, "yyyy-MM-dd");

      // Get this month's start and end dates without timezone issues
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth(); // 0-based month
      const monthStart = format(new Date(currentYear, currentMonth, 1), "yyyy-MM-dd");
      const monthEnd = format(new Date(currentYear, currentMonth + 1, 0), "yyyy-MM-dd"); // Last day of current month

      console.log("Date range for stats:", {
        todayStr,
        monthStart,
        monthEnd,
        facilityIds
      });

      // Get today's bookings (confirmed and pending only)
      const {
        data: todayBookings,
        error: todayError
      } = await supabase.from("bookings").select("*").in("facility_id", facilityIds).eq("booking_date", todayStr).in("status", ["confirmed", "pending"]);

      // Get monthly bookings (confirmed and pending for accurate count)
      const {
        data: monthlyBookings,
        error: monthlyError
      } = await supabase.from("bookings").select("*").in("facility_id", facilityIds).gte("booking_date", monthStart).lte("booking_date", monthEnd).in("status", ["confirmed", "pending"]);
      console.log("Today bookings query result:", {
        todayBookings,
        todayError
      });
      console.log("Monthly bookings query result:", {
        monthlyBookings,
        monthlyError
      });
      if (todayError) throw todayError;
      if (monthlyError) throw monthlyError;
      console.log("Booking stats loaded:", {
        todayCount: todayBookings?.length || 0,
        monthlyCount: monthlyBookings?.length || 0,
        activeFacilitiesCount: facilities.length,
        debug: {
          todayStr,
          monthStart,
          monthEnd
        }
      });
      setStats({
        todayBookings: todayBookings?.length || 0,
        monthlyBookings: monthlyBookings?.length || 0,
        activeFacilities: facilities.length
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Extracts detailed error message from Supabase Edge Function invoke errors
  const parseFunctionError = (err: any): string => {
    try {
      let message = err?.message || "Eroare la salvarea datelor.";
      const ctx = err?.context || err;
      const candidates = [ctx?.response?.text, ctx?.response?.body, ctx?.response?.data, ctx?.response?.error, ctx?.json, ctx?.body];
      for (const c of candidates) {
        if (!c) continue;
        if (typeof c === "string") {
          try {
            const parsed = JSON.parse(c);
            if (parsed?.error) {
              message = parsed.error;
              break;
            }
          } catch {
            message = c;
            break;
          }
        } else if (typeof c === "object") {
          if (c?.error) {
            message = c.error;
            break;
          }
        }
      }
      if (/Rate limit exceeded/i.test(message)) {
        return "Prea multe încercări. Vă rugăm să așteptați 15 minute și să încercați din nou.";
      }
      if (/Invalid Romanian IBAN format|IBAN format invalid/i.test(message)) {
        return "Format IBAN invalid pentru România. Folosiți: RO12ABCD1234567890123456.";
      }
      if (/Authentication required|Session too old|Session expired/i.test(message)) {
        return "Sesiune expirată pentru operațiuni bancare. Reautentificați-vă și reîncercați.";
      }
      return message;
    } catch {
      return "Eroare la salvarea datelor.";
    }
  };
const loadBankDetails = async () => {
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('bank_details')
        .select('id, account_holder_name, bank_name, iban, created_at, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading bank details:', error);
        return;
      }

      if (data) {
        setBankDetails({
          id: data.id,
          account_holder_name: data.account_holder_name,
          bank_name: data.bank_name,
          iban: data.iban ? maskIban(data.iban) : '',
          created_at: data.created_at,
          updated_at: data.updated_at
        });
      } else {
        setBankDetails(null);
      }
    } catch (error) {
      console.error('Error loading bank details:', error);
    }
  };
  const openBankDialog = (editing = false) => {
    setIsEditingBank(editing);
    if (editing && bankDetails) {
      setValue("account_holder_name", bankDetails.account_holder_name);
      setValue("bank_name", bankDetails.bank_name);
      setValue("iban", ""); // Do not prefill masked IBAN; require re-entry
    } else {
      reset();
    }
    setIsBankDialogOpen(true);
  };
const onBankSubmit = async (formData: BankFormData) => {
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;

      // Rate limiting check
      if (!checkClientRateLimit("bank_details_update", 5, 300000)) {
        toast({
          title: "Prea multe încercări",
          description: "Vă rugăm să așteptați înainte de a încerca din nou",
          variant: "destructive"
        });
        return;
      }

      // Client-side validation and sanitization
      const accountHolderValidation = validateAccountHolderName(formData.account_holder_name);
      if (!accountHolderValidation.isValid) {
        toast({ title: "Eroare de validare", description: accountHolderValidation.error, variant: "destructive" });
        return;
      }
      const bankNameValidation = validateBankName(formData.bank_name);
      if (!bankNameValidation.isValid) {
        toast({ title: "Eroare de validare", description: bankNameValidation.error, variant: "destructive" });
        return;
      }
      if (!validateIbanFormat(formData.iban)) {
        toast({ title: "Eroare de validare", description: "Formatul IBAN este invalid. Utilizați formatul RO12ABCD1234567890123456", variant: "destructive" });
        return;
      }

      // Sanitize inputs
      const sanitizedData = {
        account_holder_name: sanitizeInput(formData.account_holder_name),
        bank_name: sanitizeInput(formData.bank_name),
        iban: formData.iban.replace(/\s/g, "").toUpperCase()
      };

      setSubmittingBankDetails(true);

      // Check if bank details already exist
      const { data: existing, error: existingError } = await supabase
        .from('bank_details')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (existingError) throw existingError;

      let dbError: any = null;
      if (existing) {
        const { error } = await supabase
          .from('bank_details')
          .update({
            account_holder_name: sanitizedData.account_holder_name,
            bank_name: sanitizedData.bank_name,
            iban: sanitizedData.iban,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);
        dbError = error;
      } else {
        const { error } = await supabase
          .from('bank_details')
          .insert([{
            user_id: user.id,
            account_holder_name: sanitizedData.account_holder_name,
            bank_name: sanitizedData.bank_name,
            iban: sanitizedData.iban
          }]);
        dbError = error;
      }

      if (dbError) throw dbError;

      toast({
        title: "Succes",
        description: existing ? "Detaliile bancare au fost actualizate" : "Detaliile bancare au fost adăugate"
      });
      setIsBankDialogOpen(false);
      reset();
      loadBankDetails();
    } catch (error) {
      console.error("Error saving bank details:", error);
      toast({ title: "Eroare", description: "Nu s-au putut salva detaliile bancare", variant: "destructive" });
    } finally {
      setSubmittingBankDetails(false);
    }
  };
const deleteBankDetails = async () => {
    if (!bankDetails || !confirm("Ești sigur că vrei să ștergi detaliile bancare?")) {
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('bank_details')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;

      setBankDetails(null);
      toast({ title: "Succes", description: "Detaliile bancare au fost șterse" });
    } catch (error) {
      console.error("Error deleting bank details:", error);
      toast({ title: "Eroare", description: "Nu s-au putut șterge detaliile bancare", variant: "destructive" });
    }
  };
  const extractSportsComplexName = (userTypeComment: string): string => {
    if (!userTypeComment) return "Baza Sportivă";

    // Handle format: "Complex Sportiv ABC - Proprietar bază sportivă"
    if (userTypeComment.includes(" - Proprietar bază sportivă")) {
      return userTypeComment.replace(" - Proprietar bază sportivă", "").trim();
    }

    // Handle format: "Proprietar bază sportivă - Complex Sportiv ABC"
    if (userTypeComment.startsWith("Proprietar bază sportivă - ")) {
      return userTypeComment.replace("Proprietar bază sportivă - ", "").trim();
    }
    return userTypeComment;
  };
  const handleDeleteClick = async () => {
    const activeBookingsData = await checkOwnerActiveFacilityBookings();
    setActiveBookingsInfo(activeBookingsData);
    setShowDeleteDialog(true);
  };
  const handleDeleteAccount = async () => {
    try {
      const result = await deleteUserAccount();
      if (result.success) {
        toast({
          title: "Cont șters",
          description: "Contul a fost șters cu succes."
        });
        // Redirect to home page as visitor
        navigate("/", {
          replace: true
        });
      } else {
        toast({
          title: "Eroare",
          description: result.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut șterge contul. Vă rugăm să încercați din nou.",
        variant: "destructive"
      });
    }
  };
  if (isLoading || !profile) {
    return <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg text-muted-foreground">Se încarcă...</p>
          </div>
        </main>
        <Footer />
      </div>;
  }
  const sportsComplexName = extractSportsComplexName(profile.user_type_comment || "");
  return <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/")} className="mb-4 hover:bg-primary/5 border-2 border-primary/20 hover:border-primary hover:text-primary transition-all duration-200">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Înapoi la pagina principală
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Profil Proprietar de Bază Sportivă</h1>
          <p className="text-muted-foreground mt-2">Gestionează-ți profilul și facilitățile sportive</p>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full" onClick={() => navigate("/facility-calendar")}>
            <CardHeader className="flex flex-col h-full">
              <CardTitle className="flex items-center gap-2 min-h-[3rem]">
                <Calendar className="h-5 w-5" />
                Calendar Terenuri
              </CardTitle>
              <CardDescription>Vizualizează calendarul și blochează zile / ore specifice</CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full" onClick={() => navigate("/manage-facilities")}>
            <CardHeader className="flex flex-col h-full">
              <CardTitle className="flex items-center gap-2 min-h-[3rem]">
                <Building2 className="h-5 w-5" />
                Setări Terenuri
              </CardTitle>
              <CardDescription>Adaugă, editează sau șterge facilitățile sportive</CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full" onClick={() => navigate("/facility-owner-income")}>
            <CardHeader className="flex flex-col h-full">
              <CardTitle className="flex items-center gap-2 min-h-[3rem]">
                <DollarSign className="h-5 w-5" />
                Venituri
              </CardTitle>
              <CardDescription>Vizualizează veniturile din rezervări și comisioane</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-6">
          {/* Profile Info */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informații Profil
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate("/edit-sports-complex-settings")}>
                <Settings className="h-4 w-4 mr-2" />
                Editează Setări
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <h3 className="font-semibold text-lg mb-4">{sportsComplexName}</h3>

                  {/* First row - 3 columns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Nume complet:</span>
                      <p className="font-medium">{profile.full_name}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Email:</span>
                      <p className="font-medium">{profile.email}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Telefon:</span>
                      <p className="font-medium">{profile.phone}</p>
                    </div>
                  </div>

                  {/* Second row - 3 columns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Adresă:</span>
                      <p className="font-medium">{sportsComplexData?.address || "Nu este setată"}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Descriere:</span>
                      <p className="font-medium text-sm">{sportsComplexData?.description || "Nu există descriere"}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Servicii generale:</span>
                      <p className="font-medium text-sm">
                        {sportsComplexData?.general_services && sportsComplexData.general_services.length > 0 ? sportsComplexData.general_services.join(", ") : "Nu sunt setate servicii"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right column - Quick Stats (narrower) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card className="border-2">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Rezervări astăzi</p>
                          <p className="text-xl font-bold">{stats.todayBookings}</p>
                        </div>
                        <Calendar className="h-6 w-6 text-primary" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Rezervări luna aceasta</p>
                          <p className="text-xl font-bold">{stats.monthlyBookings}</p>
                        </div>
                        <Calendar className="h-6 w-6 text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Terenuri active</p>
                          <p className="text-xl font-bold">{stats.activeFacilities}</p>
                        </div>
                        <Building2 className="h-6 w-6 text-green-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bank Account Details Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-6 w-6" />
                Detalii Bancare
              </CardTitle>
              {bankDetails ? <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openBankDialog(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editează
                  </Button>
                  <Button variant="destructive" size="sm" onClick={deleteBankDetails}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Șterge
                  </Button>
                </div> : <Button onClick={() => openBankDialog(false)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adaugă Cont Bancar
                </Button>}
            </CardHeader>
            <CardContent>
              {bankDetails ? <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Titular Cont:</p>
                    <p className="font-medium">{bankDetails.account_holder_name}</p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Banca:</p>
                    <p className="font-medium">{bankDetails.bank_name}</p>
                  </div>

                  <div className="md:col-span-2">
                    <p className="text-muted-foreground">IBAN:</p>
                    <p className="font-mono text-xs">{bankDetails.iban}</p>
                  </div>
                </div> : <p className="text-muted-foreground text-center py-4">
                  Nu aveți încă detalii bancare adăugate. Adăugați un cont bancar pentru a primi plăți.
                </p>}
            </CardContent>
          </Card>

          {/* Bank Details Dialog */}
          <Dialog open={isBankDialogOpen} onOpenChange={setIsBankDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{isEditingBank ? "Editează Detalii Bancare" : "Adaugă Detalii Bancare"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onBankSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="account_holder_name">Numele Titularului</Label>
                  <Input id="account_holder_name" {...register("account_holder_name", {
                  required: "Numele titularului este obligatoriu"
                })} placeholder="ex: SC SportComplex SRL" />
                  {errors.account_holder_name && <p className="text-sm text-destructive">{errors.account_holder_name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_name">Numele Băncii</Label>
                  <Input id="bank_name" {...register("bank_name", {
                  required: "Numele băncii este obligatoriu"
                })} placeholder="ex: Banca Transilvania" />
                  {errors.bank_name && <p className="text-sm text-destructive">{errors.bank_name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="iban">IBAN</Label>
                  <Input id="iban" {...register("iban", {
                  required: "IBAN-ul este obligatoriu",
                  pattern: {
                    value: /^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$/,
                    message: "IBAN-ul trebuie să fie în formatul: RO12ABCD1234567890123456"
                  }
                })} placeholder="ex: RO12ABCD1234567890123456" />
                  {errors.iban && <p className="text-sm text-destructive">{errors.iban.message}</p>}
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsBankDialogOpen(false)} className="flex-1">
                    Anulează
                  </Button>
                  <Button type="submit" className="flex-1">
                    {isEditingBank ? "Actualizează" : "Adaugă"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Delete Account */}
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Zona Periculoasă
              </CardTitle>
              <CardDescription>Acțiuni ireversibile pentru contul tău</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" className="w-full sm:w-auto" onClick={handleDeleteClick}>
                <Trash2 className="h-4 w-4 mr-2" />
                Șterge Contul
              </Button>

              <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmă ștergerea contului</AlertDialogTitle>
                    <AlertDialogDescription>
                      {activeBookingsInfo?.activeBookings > 0 ? `Atenție: aveți ${activeBookingsInfo.activeBookings} rezervări viitoare pe facilitățile dvs. Confirmând, toate aceste rezervări vor fi anulate automat înainte de ștergerea contului.` : `Confirmând, contul va fi șters definitiv. Dacă există rezervări viitoare, acestea vor fi anulate automat înainte de ștergere.`}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>Renunță</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Da, șterge contul
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>;
};
export default FacilityOwnerProfilePage;
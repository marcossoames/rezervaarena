import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Edit, Trash2, CreditCard, Landmark } from "lucide-react";
import { useForm } from "react-hook-form";
import { validateIbanFormat, sanitizeInput, validateAccountHolderName, validateBankName, maskIban } from "@/utils/bankSecurity";

interface BankDetails {
  id: string;
  user_id: string;
  account_holder_name: string;
  bank_name: string;
  iban: string;
  created_at: string;
  updated_at: string;
  // Facility owner info
  owner_name?: string;
  owner_email?: string;
  complex_name?: string;
}

interface BankFormData {
  account_holder_name: string;
  bank_name: string;
  iban: string;
}

const BankDetailsManagement = () => {
  const [bankDetails, setBankDetails] = useState<BankDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<BankDetails | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [facilityOwners, setFacilityOwners] = useState<any[]>([]);
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<BankFormData>();
  const { toast } = useToast();

  useEffect(() => {
    loadBankDetails();
    loadFacilityOwners();
  }, []);

  const loadBankDetails = async () => {
    try {
      setIsLoading(true);
      
      // Get all bank details
      const { data: bankData, error: bankError } = await supabase
        .from('bank_details')
        .select('*')
        .order('created_at', { ascending: false });

      if (bankError) throw bankError;

      if (bankData && bankData.length > 0) {
        // Get ALL profiles that could be facility owners
        const { data: allProfilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, user_type_comment');

        const profileMap = new Map(allProfilesData?.map(p => [p.user_id, p]) || []);

        const enrichedBankDetails = bankData.map(bank => {
          const profile = profileMap.get(bank.user_id);
          let complexName = 'Baza Sportivă';
          
          if (profile?.user_type_comment) {
            const commentParts = profile.user_type_comment.split(' - ');
            if (commentParts.length > 1 && commentParts[1].includes('Proprietar bază sportivă')) {
              complexName = commentParts[0];
            }
          }
          
          return {
            ...bank,
            owner_name: profile?.full_name || 'Necunoscut',
            owner_email: profile?.email || 'Necunoscut',
            complex_name: complexName
          };
        });

        setBankDetails(enrichedBankDetails);
      } else {
        setBankDetails([]);
      }
    } catch (error) {
      console.error('Error loading bank details:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca detaliile bancare",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadFacilityOwners = async () => {
    try {
      // Get facility owners
      const { data: facilityOwnersData } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, user_type_comment')
        .like('user_type_comment', '%Proprietar bază sportivă%');

      setFacilityOwners(facilityOwnersData || []);
    } catch (error) {
      console.error('Error loading facility owners:', error);
    }
  };

  const openAddDialog = () => {
    setEditingBank(null);
    setSelectedOwnerId("");
    reset();
    setIsDialogOpen(true);
  };

  const openEditDialog = (bank: BankDetails) => {
    setEditingBank(bank);
    setSelectedOwnerId(bank.user_id);
    setValue('account_holder_name', bank.account_holder_name);
    setValue('bank_name', bank.bank_name);
    setValue('iban', bank.iban);
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: BankFormData) => {
    try {
      if (!selectedOwnerId) {
        toast({
          title: "Eroare",
          description: "Selectează proprietarul bazei sportive",
          variant: "destructive"
        });
        return;
      }

      // Client-side validation and sanitization
      const accountHolderValidation = validateAccountHolderName(data.account_holder_name);
      if (!accountHolderValidation.isValid) {
        toast({
          title: "Eroare de validare",
          description: accountHolderValidation.error,
          variant: "destructive"
        });
        return;
      }

      const bankNameValidation = validateBankName(data.bank_name);
      if (!bankNameValidation.isValid) {
        toast({
          title: "Eroare de validare",
          description: bankNameValidation.error,
          variant: "destructive"
        });
        return;
      }

      if (!validateIbanFormat(data.iban)) {
        toast({
          title: "Eroare de validare",
          description: "Formatul IBAN este invalid. Utilizați formatul RO12ABCD1234567890123456",
          variant: "destructive"
        });
        return;
      }

      // Sanitize inputs
      const sanitizedData = {
        account_holder_name: sanitizeInput(data.account_holder_name),
        bank_name: sanitizeInput(data.bank_name),
        iban: data.iban.replace(/\s/g, '').toUpperCase()
      };

      if (editingBank) {
        // Update existing bank details
        const { error } = await supabase
          .from('bank_details')
          .update(sanitizedData)
          .eq('id', editingBank.id);

        if (error) throw error;

        toast({
          title: "Succes",
          description: "Detaliile bancare au fost actualizate",
        });
      } else {
        // Create new bank details
        const { error } = await supabase
          .from('bank_details')
          .insert([
            {
              user_id: selectedOwnerId,
              ...sanitizedData
            }
          ]);

        if (error) throw error;

        toast({
          title: "Succes",
          description: "Detaliile bancare au fost adăugate",
        });
      }

      setIsDialogOpen(false);
      reset();
      loadBankDetails();
    } catch (error) {
      console.error('Error saving bank details:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut salva detaliile bancare. Verificați formatul datelor.",
        variant: "destructive"
      });
    }
  };

  const deleteBankDetails = async (bankId: string, ownerName: string) => {
    if (!confirm(`Ești sigur că vrei să ștergi detaliile bancare pentru ${ownerName}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('bank_details')
        .delete()
        .eq('id', bankId);

      if (error) throw error;

      setBankDetails(prev => prev.filter(bank => bank.id !== bankId));
      
      toast({
        title: "Succes",
        description: "Detaliile bancare au fost șterse",
      });
    } catch (error) {
      console.error('Error deleting bank details:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut șterge detaliile bancare",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Se încarcă detaliile bancare...</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Se încarcă detaliile bancare...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-6 w-6" />
            Detalii Bancare ({bankDetails.length})
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Adaugă Detalii Bancare
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingBank ? 'Editează Detalii Bancare' : 'Adaugă Detalii Bancare'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {!editingBank && (
                  <div className="space-y-2">
                    <Label htmlFor="owner">Proprietar Bază Sportivă</Label>
                    <select
                      id="owner"
                      value={selectedOwnerId}
                      onChange={(e) => setSelectedOwnerId(e.target.value)}
                      className="w-full p-2 border border-border rounded-md bg-background"
                      required
                    >
                      <option value="">Selectează proprietarul</option>
                      {facilityOwners.map((owner) => (
                        <option key={owner.user_id} value={owner.user_id}>
                          {owner.full_name} ({owner.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="account_holder_name">Numele Titularului</Label>
                  <Input
                    id="account_holder_name"
                    {...register("account_holder_name", { required: "Numele titularului este obligatoriu" })}
                    placeholder="ex: SC SportComplex SRL"
                  />
                  {errors.account_holder_name && (
                    <p className="text-sm text-destructive">{errors.account_holder_name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_name">Numele Băncii</Label>
                  <Input
                    id="bank_name"
                    {...register("bank_name", { required: "Numele băncii este obligatoriu" })}
                    placeholder="ex: Banca Transilvania"
                  />
                  {errors.bank_name && (
                    <p className="text-sm text-destructive">{errors.bank_name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="iban">IBAN</Label>
                  <Input
                    id="iban"
                    {...register("iban", { 
                      required: "IBAN-ul este obligatoriu",
                      pattern: {
                        value: /^RO\d{2}[A-Z]{4}\d{16}$/,
                        message: "IBAN-ul trebuie să fie în formatul: RO12ABCD1234567890123456"
                      }
                    })}
                    placeholder="ex: RO12ABCD1234567890123456"
                  />
                  {errors.iban && (
                    <p className="text-sm text-destructive">{errors.iban.message}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                    Anulează
                  </Button>
                  <Button type="submit" className="flex-1">
                    {editingBank ? 'Actualizează' : 'Adaugă'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {bankDetails.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nu există detalii bancare în sistem.
            </p>
          ) : (
            <div className="grid gap-4">
              {bankDetails.map((bank) => (
                <Card key={bank.id} className="border border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Building2 className="h-5 w-5 text-blue-600" />
                          <h4 className="font-semibold">{bank.complex_name}</h4>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Proprietar:</p>
                            <p className="font-medium">{bank.owner_name}</p>
                            <p className="text-xs text-muted-foreground">{bank.owner_email}</p>
                          </div>
                          
                          <div>
                            <p className="text-muted-foreground">Titular Cont:</p>
                            <p className="font-medium">{bank.account_holder_name}</p>
                          </div>
                          
                          <div>
                            <p className="text-muted-foreground">Banca:</p>
                            <p className="font-medium">{bank.bank_name}</p>
                          </div>
                          
                           <div>
                             <p className="text-muted-foreground">IBAN:</p>
                             <p className="font-mono text-xs">{maskIban(bank.iban)}</p>
                           </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(bank)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Editează
                        </Button>
                        
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteBankDetails(bank.id, bank.owner_name || 'Unknown')}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Șterge
                        </Button>
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

export default BankDetailsManagement;
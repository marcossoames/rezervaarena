import { supabase } from "@/integrations/supabase/client";

export interface BankDetails {
  id?: string;
  account_holder_name: string;
  bank_name: string;
  iban?: string;
  iban_masked?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BankingResponse {
  bankDetails?: BankDetails;
  success?: boolean;
  error?: string;
}

export const readSecureBankDetails = async (): Promise<BankingResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke('secure-banking-operations', {
      body: { operation: 'read' }
    });

    if (error) throw new Error(error.message || 'Failed to read bank details');
    return data;
  } catch (error) {
    console.error('Error reading bank details:', error);
    throw error;
  }
};

export const upsertSecureBankDetails = async (
  bankDetails: Omit<BankDetails, 'id' | 'created_at' | 'updated_at' | 'iban_masked'>,
  operation: 'create' | 'update' = 'create'
): Promise<BankingResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke('secure-banking-operations', {
      body: { operation, bankDetails }
    });

    if (error) throw new Error(error.message || 'Failed to save bank details');
    return data;
  } catch (error) {
    console.error('Error saving bank details:', error);
    throw error;
  }
};

export const deleteSecureBankDetails = async (): Promise<BankingResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke('secure-banking-operations', {
      body: { operation: 'delete' }
    });

    if (error) throw new Error(error.message || 'Failed to delete bank details');
    return data;
  } catch (error) {
    console.error('Error deleting bank details:', error);
    throw error;
  }
};

export const validateBankingPermissions = async (): Promise<boolean> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Authentication required');
    return true;
  } catch (error) {
    console.error('Banking permissions validation failed:', error);
    return false;
  }
};

export const checkBankingSecurityStatus = async (): Promise<{
  isSecure: boolean;
  warnings: string[];
}> => {
  const warnings: string[] = [];
  
  try {
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      warnings.push('Conexiune nesigură detectată. Utilizați HTTPS pentru operațiuni bancare.');
    }

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      warnings.push('Autentificare necesară pentru operațiuni bancare.');
    }

    return { isSecure: warnings.length === 0, warnings };
  } catch (error) {
    return {
      isSecure: false,
      warnings: ['Verificarea securității a eșuat. Vă rugăm să încercați din nou.']
    };
  }
};
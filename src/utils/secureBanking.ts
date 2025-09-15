/**
 * Secure banking operations utility using the protected edge function
 */
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

/**
 * Read bank details using secure edge function
 */
export const readSecureBankDetails = async (): Promise<BankingResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke('secure-banking-operations', {
      body: { operation: 'read' }
    });

    if (error) {
      console.error('Secure banking read error:', error);
      throw new Error(error.message || 'Failed to read bank details');
    }

    return data;
  } catch (error) {
    console.error('Error reading secure bank details:', error);
    throw error;
  }
};

/**
 * Create or update bank details using secure edge function
 */
export const upsertSecureBankDetails = async (
  bankDetails: Omit<BankDetails, 'id' | 'created_at' | 'updated_at' | 'iban_masked'>,
  operation: 'create' | 'update' = 'create'
): Promise<BankingResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke('secure-banking-operations', {
      body: { 
        operation,
        bankDetails 
      }
    });

    if (error) {
      console.error('Secure banking upsert error:', error);
      throw new Error(error.message || 'Failed to save bank details');
    }

    return data;
  } catch (error) {
    console.error('Error upserting secure bank details:', error);
    throw error;
  }
};

/**
 * Delete bank details using secure edge function
 */
export const deleteSecureBankDetails = async (): Promise<BankingResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke('secure-banking-operations', {
      body: { operation: 'delete' }
    });

    if (error) {
      console.error('Secure banking delete error:', error);
      throw new Error(error.message || 'Failed to delete bank details');
    }

    return data;
  } catch (error) {
    console.error('Error deleting secure bank details:', error);
    throw error;
  }
};

/**
 * Validate if bank operation should be allowed based on user permissions
 */
export const validateBankingPermissions = async (): Promise<boolean> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      throw new Error('Authentication required');
    }

    // Additional validation could be added here
    // For example, checking user role, account status, etc.
    
    return true;
  } catch (error) {
    console.error('Banking permissions validation failed:', error);
    return false;
  }
};

/**
 * Check if user has recent banking activity that might indicate suspicious behavior
 */
export const checkBankingSecurityStatus = async (): Promise<{
  isSecure: boolean;
  warnings: string[];
}> => {
  const warnings: string[] = [];
  
  try {
    // Check if we're on a secure connection
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      warnings.push('Conexiune nesigură detectată. Utilizați HTTPS pentru operațiuni bancare.');
    }

    // Check for valid authentication
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      warnings.push('Autentificare necesară pentru operațiuni bancare.');
    }

    // Additional security checks could be added here
    // Such as checking session age, device fingerprinting, etc.

    return {
      isSecure: warnings.length === 0,
      warnings
    };
  } catch (error) {
    console.error('Security status check failed:', error);
    return {
      isSecure: false,
      warnings: ['Verificarea securității a eșuat. Vă rugăm să încercați din nou.']
    };
  }
};
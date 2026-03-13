import { supabase } from "@/integrations/supabase/client";

export interface AccountFormData {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone: string;
  businessName: string;
  businessDescription: string;
  address: string;
  city: string;
  numberOfFacilities: number;
  generalServices: string[];
}

export interface FacilityData {
  name: string;
  description: string;
  facilityType: string;
  address: string;
  city: string;
  pricePerHour: number;
  capacity: number;
  capacityMax?: number;
  amenities: string[];
  images: File[];
  mainImageIndex: number;
  operatingHoursStart?: string;
  operatingHoursEnd?: string;
  allowedDurations?: number[];
}

export const saveFacilitiesForUser = async (
  accountData: AccountFormData,
  facilities: FacilityData[]
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Save facilities one by one
    for (const facility of facilities) {
      if (!facility.name || !facility.facilityType || !facility.address || !facility.city) {
        console.warn('Skipping incomplete facility:', facility.name);
        continue;
      }

      const { data: newFacility, error: facilityError } = await supabase
        .from('facilities')
        .insert({
          owner_id: user.id,
          name: facility.name,
          description: facility.description,
          facility_type: facility.facilityType as any,
          address: facility.address,
          city: facility.city,
          price_per_hour: facility.pricePerHour,
          capacity: facility.capacity,
          capacity_max: facility.capacityMax || null,
          operating_hours_start: facility.operatingHoursStart || '08:00',
          operating_hours_end: facility.operatingHoursEnd || '22:00',
          amenities: facility.amenities,
          allowed_durations: facility.allowedDurations && facility.allowedDurations.length > 0 ? facility.allowedDurations : [60,90,120],
          is_active: true
        })
        .select()
        .single();

      if (facilityError) {
        console.error('Error saving facility:', facilityError);
        throw facilityError;
      }

      
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error saving facilities:', error);
    return { success: false, error: error.message };
  }
};
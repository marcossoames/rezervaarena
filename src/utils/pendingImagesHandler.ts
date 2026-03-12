import { supabase } from "@/integrations/supabase/client";

interface PendingFacilityData {
  name: string;
  description: string;
  facilityType: string;
  pricePerHour: number;
  capacity: number;
  capacityMax?: number;
  amenities: string[];
  operatingHoursStart: string;
  operatingHoursEnd: string;
  images: string[];
  mainImageIndex: number;
}

const base64ToFile = (base64: string, filename: string): File => {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

const uploadImage = async (file: File, facilityId: string): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${facilityId}/${Date.now()}.${fileExt}`;
  
  const { error: uploadError } = await supabase.storage
    .from('facility-images')
    .upload(fileName, file);
  
  if (uploadError) throw uploadError;
  
  return fileName;
};

export const processPendingImages = async () => {
  try {
    const pendingImagesData = localStorage.getItem('pendingFacilityImages');
    const pendingUserEmail = localStorage.getItem('pendingUserEmail');
    
    if (!pendingImagesData || !pendingUserEmail) return false;

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || user.email !== pendingUserEmail) {
      localStorage.removeItem('pendingFacilityImages');
      localStorage.removeItem('pendingUserEmail');
      return false;
    }

    const facilitiesData: PendingFacilityData[] = JSON.parse(pendingImagesData);
    
    const { data: facilities, error: facilitiesError } = await supabase
      .from('facilities')
      .select('id, name')
      .eq('owner_id', user.id);

    if (facilitiesError) {
      console.error('Error fetching facilities:', facilitiesError);
      return false;
    }

    for (const facilityData of facilitiesData) {
      const facility = facilities?.find(f => f.name === facilityData.name);
      if (!facility) continue;

      if (facilityData.images.length > 0) {
        const imageUrls: string[] = [];
        
        for (let i = 0; i < facilityData.images.length; i++) {
          try {
            const file = base64ToFile(facilityData.images[i], `image-${i}.jpg`);
            const imageUrl = await uploadImage(file, facility.id);
            imageUrls.push(imageUrl);
          } catch (imageError) {
            console.error(`Error uploading image ${i + 1}:`, imageError);
          }
        }

        if (imageUrls.length > 0) {
          const mainImageUrl = imageUrls[facilityData.mainImageIndex] || imageUrls[0];
          
          const updateData: any = { 
            images: imageUrls,
            main_image_url: mainImageUrl
          };

          if (facilityData.operatingHoursStart) {
            updateData.operating_hours_start = facilityData.operatingHoursStart;
          }
          if (facilityData.operatingHoursEnd) {
            updateData.operating_hours_end = facilityData.operatingHoursEnd;
          }
          
          const { error: updateError } = await supabase
            .from('facilities')
            .update(updateData)
            .eq('id', facility.id);

          if (updateError) {
            console.error('Error updating facility with images:', updateError);
          }
        }
      } else {
        const updateData: any = {};
        if (facilityData.operatingHoursStart) {
          updateData.operating_hours_start = facilityData.operatingHoursStart;
        }
        if (facilityData.operatingHoursEnd) {
          updateData.operating_hours_end = facilityData.operatingHoursEnd;
        }

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('facilities')
            .update(updateData)
            .eq('id', facility.id);

          if (updateError) {
            console.error('Error updating facility hours:', updateError);
          }
        }
      }
    }

    localStorage.removeItem('pendingFacilityImages');
    localStorage.removeItem('pendingUserEmail');
    
    return true;
  } catch (error) {
    console.error('Error processing pending images:', error);
    return false;
  }
};

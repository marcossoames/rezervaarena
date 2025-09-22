import { supabase } from "@/integrations/supabase/client";

export const getImagePublicUrl = (imagePath: string): string => {
  if (!imagePath) return "/placeholder.svg";
  
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // If it's a path to placeholder images in public folder
  if (imagePath.startsWith('/') || imagePath.startsWith('placeholder-')) {
    return imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  }
  
  // For Supabase storage paths, get public URL
  const { data } = supabase.storage
    .from('facility-images')
    .getPublicUrl(imagePath);
  
  return data.publicUrl;
};

export const convertImagesToPublicUrls = (images?: string[]): string[] => {
  if (!images || images.length === 0) return [];
  
  return images.map(getImagePublicUrl);
};
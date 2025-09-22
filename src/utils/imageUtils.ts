import { supabase } from "@/integrations/supabase/client";

export const getImagePublicUrl = (imagePath: string): string => {
  if (!imagePath) return "/placeholder.svg";
  
  // Already a full URL (including Supabase public URLs) -> return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Placeholder assets from public folder
  if (imagePath.startsWith('/') || imagePath.startsWith('placeholder-')) {
    return imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  }

  // If the value accidentally includes the bucket prefix, strip it (to avoid double prefixing)
  const cleanedPath = imagePath.replace(/^facility-images\//, '');

  // For Supabase storage paths, build a public URL from the bucket
  const { data } = supabase.storage
    .from('facility-images')
    .getPublicUrl(cleanedPath);
  
  return data.publicUrl;
};


export const convertImagesToPublicUrls = (images?: string[]): string[] => {
  if (!images || images.length === 0) return [];
  
  return images.map(getImagePublicUrl);
};
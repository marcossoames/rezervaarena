import { supabase } from "@/integrations/supabase/client";

export const getImagePublicUrl = (imagePath: string): string => {
  if (!imagePath) return "/placeholder.svg";
  
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('blob:') || imagePath.startsWith('data:')) {
    return imagePath;
  }
  
  if (imagePath.startsWith('/') || imagePath.startsWith('placeholder-')) {
    return imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  }

  try {
    const cleanedPath = imagePath.replace(/^facility-images\//, '');
    const { data } = supabase.storage.from('facility-images').getPublicUrl(cleanedPath);
    if (data?.publicUrl) return data.publicUrl;
  } catch (error) {
    console.error('Error generating public URL:', imagePath, error);
  }
  
  return "/placeholder.svg";
};

export const convertImagesToPublicUrls = (images?: string[]): string[] => {
  if (!images || images.length === 0) return [];
  return images.map(getImagePublicUrl);
};
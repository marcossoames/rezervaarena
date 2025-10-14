import { getImagePublicUrl, convertImagesToPublicUrls } from "./imageUtils";

// Test function to debug image URL generation
export const testImageUtils = () => {
  const testImagePath = "f07dfdf7-a3e6-41b5-b4b0-72499cd55b8d/1758658080981.jpg";
  const testImagesArray = [testImagePath];
  
  console.log("Testing image utils:");
  console.log("Original path:", testImagePath);
  console.log("getImagePublicUrl result:", getImagePublicUrl(testImagePath));
  console.log("convertImagesToPublicUrls result:", convertImagesToPublicUrls(testImagesArray));
  console.log("Array length:", convertImagesToPublicUrls(testImagesArray).length);
};
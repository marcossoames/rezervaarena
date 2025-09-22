import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { convertImagesToPublicUrls } from "@/utils/imageUtils";

interface ImageCarouselProps {
  images: string[];
  facilityName: string;
  className?: string;
}

const ImageCarousel = ({ images, facilityName, className = "" }: ImageCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [modalIndex, setModalIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Convert image paths to public URLs
  const publicImages = convertImagesToPublicUrls(images);

  if (!publicImages || publicImages.length === 0) {
    return (
      <div className={`bg-muted flex items-center justify-center ${className}`}>
        <img 
          src="/placeholder.svg" 
          alt={facilityName}
          className="w-full h-full object-cover rounded-inherit"
        />
      </div>
    );
  }

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? publicImages.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === publicImages.length - 1 ? 0 : prevIndex + 1
    );
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPreviousModal = () => {
    setModalIndex((prevIndex) => 
      prevIndex === 0 ? publicImages.length - 1 : prevIndex - 1
    );
  };

  const goToNextModal = () => {
    setModalIndex((prevIndex) => 
      prevIndex === publicImages.length - 1 ? 0 : prevIndex + 1
    );
  };

  const openModal = (index: number) => {
    setModalIndex(index);
    setIsModalOpen(true);
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <div 
          className={`relative overflow-hidden group cursor-pointer ${className}`}
          onClick={() => openModal(currentIndex)}
        >
          {/* Main Image */}
          <img
            src={publicImages[currentIndex]}
            alt={`${facilityName} - imagine ${currentIndex + 1}`}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 rounded-inherit"
          />

          {/* Navigation Arrows - Only show if more than 1 image */}
          {publicImages.length > 1 && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevious();
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  goToNext();
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Image Counter */}
          {publicImages.length > 1 && (
            <div className="absolute top-3 right-3 bg-black/50 text-white px-2 py-1 rounded-full text-xs">
              {currentIndex + 1} / {publicImages.length}
            </div>
          )}

          {/* Dots Indicator - Only show if more than 1 image and less than 6 */}
          {publicImages.length > 1 && publicImages.length <= 5 && (
            <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-2">
              {publicImages.map((_, index) => (
                <button
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex 
                      ? "bg-white" 
                      : "bg-white/50 hover:bg-white/70"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToSlide(index);
                  }}
                />
              ))}
            </div>
          )}

          {/* Click overlay hint */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-3 py-1 rounded-full text-sm font-medium">
              Click pentru a mări
            </div>
          </div>
        </div>
      </DialogTrigger>

      <DialogContent className="max-w-6xl w-full p-0 bg-black/95">
        {/* Close Button - Red and more visible */}
        <button 
          onClick={() => setIsModalOpen(false)}
          className="absolute top-4 right-4 z-50 w-10 h-10 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center transition-colors shadow-lg"
        >
          <X className="h-6 w-6" />
        </button>
        
        <div className="relative w-full h-[80vh] flex items-center justify-center">
          {/* Large Image */}
          <img
            src={publicImages[modalIndex]}
            alt={`${facilityName} - imagine ${modalIndex + 1}`}
            className="max-w-full max-h-full object-contain"
          />

          {/* Modal Navigation - Only show if more than 1 image */}
          {publicImages.length > 1 && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white"
                onClick={goToPreviousModal}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white"
                onClick={goToNextModal}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}

          {/* Modal Image Counter - moved to avoid close button */}
          {publicImages.length > 1 && (
            <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded-full z-40">
              {modalIndex + 1} / {publicImages.length}
            </div>
          )}

          {/* Modal Thumbnail Strip */}
          {publicImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 bg-black/70 p-2 rounded-lg max-w-full overflow-x-auto">
              {publicImages.map((image, index) => (
                <button
                  key={index}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    index === modalIndex 
                      ? "border-white" 
                      : "border-transparent hover:border-white/50"
                  }`}
                  onClick={() => setModalIndex(index)}
                >
                  <img
                    src={image}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageCarousel;
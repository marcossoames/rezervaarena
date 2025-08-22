import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ImageCarouselProps {
  images: string[];
  facilityName: string;
  className?: string;
}

const ImageCarousel = ({ images, facilityName, className = "" }: ImageCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className={`bg-muted flex items-center justify-center ${className}`}>
        <img 
          src="/placeholder.svg" 
          alt={facilityName}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === images.length - 1 ? 0 : prevIndex + 1
    );
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div className={`relative overflow-hidden group ${className}`}>
      {/* Main Image */}
      <img
        src={images[currentIndex]}
        alt={`${facilityName} - imagine ${currentIndex + 1}`}
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
      />

      {/* Navigation Arrows - Only show if more than 1 image */}
      {images.length > 1 && (
        <>
          <Button
            variant="outline"
            size="icon"
            className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white"
            onClick={goToPrevious}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white"
            onClick={goToNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      )}

      {/* Image Counter */}
      {images.length > 1 && (
        <div className="absolute top-3 right-3 bg-black/50 text-white px-2 py-1 rounded-full text-xs">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Dots Indicator - Only show if more than 1 image and less than 6 */}
      {images.length > 1 && images.length <= 5 && (
        <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-2">
          {images.map((_, index) => (
            <button
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex 
                  ? "bg-white" 
                  : "bg-white/50 hover:bg-white/70"
              }`}
              onClick={() => goToSlide(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageCarousel;
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { convertImagesToPublicUrls } from "@/utils/imageUtils";
import { getFacilityTypeLabel } from "@/utils/facilityTypes";

interface FacilityCardCarouselProps {
  images?: string[];
  facilityName: string;
  facilityType: string;
  className?: string;
}

export const FacilityCardCarousel = ({
  images,
  facilityName,
  facilityType,
  className = ""
}: FacilityCardCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const publicUrls = convertImagesToPublicUrls(images);

  // If no images, show placeholder based on facility type
  if (!publicUrls || publicUrls.length === 0) {
    return (
      <div className={`relative ${className}`}>
        <img
          src={`/placeholder-${facilityType}.jpg`}
          alt={facilityName}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = "/placeholder.svg";
          }}
        />
        <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground z-10">
          {getFacilityTypeLabel(facilityType)}
        </Badge>
      </div>
    );
  }

  const goToPrevious = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? publicUrls.length - 1 : prev - 1));
  };

  const goToNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === publicUrls.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className={`relative group ${className}`}>
      <img
        src={publicUrls[currentIndex]}
        alt={`${facilityName} - Imagine ${currentIndex + 1}`}
        className="w-full h-full object-cover"
        onError={(e) => {
          e.currentTarget.src = "/placeholder.svg";
        }}
      />

      <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground z-10">
        {getFacilityTypeLabel(facilityType)}
      </Badge>

      {/* Navigation arrows - only show if there are multiple images */}
      {publicUrls.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background text-foreground rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 shadow-md"
            aria-label="Imagine anterioară"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background text-foreground rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 shadow-md"
            aria-label="Imagine următoare"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {publicUrls.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 w-1.5 rounded-full transition-all ${
                  index === currentIndex
                    ? "bg-primary w-4"
                    : "bg-background/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

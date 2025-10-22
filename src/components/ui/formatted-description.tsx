import { useState } from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface FormattedDescriptionProps {
  text: string;
  maxLength?: number;
  className?: string;
  onExpandRequested?: () => void;
}

export const FormattedDescription = ({ 
  text, 
  maxLength = 200,
  className,
  onExpandRequested,
}: FormattedDescriptionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!text) return null;
  
  const shouldTruncate = text.length > maxLength;
  const displayText = shouldTruncate && !isExpanded 
    ? text.substring(0, maxLength) + "..." 
    : text;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
        {displayText}
      </p>
      {shouldTruncate && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (onExpandRequested) {
              onExpandRequested();
            } else {
              setIsExpanded(!isExpanded);
            }
          }}
          className="h-auto p-0 text-primary hover:text-primary/80 font-normal underline-offset-2 hover:underline"
        >
          {isExpanded ? "Citește mai puțin" : "Citește mai mult"}
        </Button>
      )}
    </div>
  );
};

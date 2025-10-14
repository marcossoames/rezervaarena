import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';

const LoadingScreen = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prevProgress) => {
        if (prevProgress >= 95) {
          clearInterval(timer);
          return 95;
        }
        // Fast initial loading, then slower
        const increment = prevProgress < 50 ? 15 : prevProgress < 80 ? 8 : 3;
        return Math.min(prevProgress + increment, 95);
      });
    }, 150);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-hero flex flex-col items-center justify-center">
      {/* App Name */}
      <h1 className="text-5xl font-bold text-primary-foreground mb-8 animate-fade-in tracking-tight">
        RezervaArena
      </h1>

      {/* Progress Bar */}
      <div className="w-64 px-4 animate-fade-in">
        <Progress 
          value={progress} 
          className="h-2 bg-primary-foreground/20"
        />
        <p className="text-primary-foreground/80 text-sm text-center mt-3">
          Se încarcă...
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;

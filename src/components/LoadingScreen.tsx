import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import logo from '@/assets/logo-rezervaarena-colorful.png';

const LoadingScreen = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prevProgress) => {
        if (prevProgress >= 95) {
          clearInterval(timer);
          return 95;
        }
        const increment = prevProgress < 50 ? 15 : prevProgress < 80 ? 8 : 3;
        return Math.min(prevProgress + increment, 95);
      });
    }, 150);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-hero flex flex-col items-center justify-center">
      {/* Logo */}
      <img 
        src={logo} 
        alt="RezervaArena" 
        className="w-64 h-64 mb-8 animate-fade-in object-contain"
      />

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

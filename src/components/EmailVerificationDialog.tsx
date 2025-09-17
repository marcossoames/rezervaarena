import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmailVerificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  isResendAvailable?: boolean;
}

export const EmailVerificationDialog: React.FC<EmailVerificationDialogProps> = ({
  isOpen,
  onClose,
  email,
  isResendAvailable = true
}) => {
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showResendPrompt, setShowResendPrompt] = useState(false);
  const { toast } = useToast();

  // Timer to track elapsed time and show resend prompt after 1 minute
  useEffect(() => {
    if (!isOpen) {
      setTimeElapsed(0);
      setShowResendPrompt(false);
      return;
    }

    const timer = setInterval(() => {
      setTimeElapsed(prev => {
        const newTime = prev + 1;
        if (newTime >= 60 && !showResendPrompt) {
          setShowResendPrompt(true);
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, showResendPrompt]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleResendConfirmation = async () => {
    setIsResending(true);
    setResendSuccess(false);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: { emailRedirectTo: `${window.location.origin}/` }
      });

      if (error) {
        throw error;
      }

      setResendSuccess(true);
      setShowResendPrompt(false);
      setTimeElapsed(0);
      toast({
        title: "Email retrimis cu succes!",
        description: "Am retrimis emailul de confirmare. Verifică-ți inbox-ul și folderul spam.",
        duration: 5000
      });
    } catch (error: any) {
      console.error('Resend error:', error);
      toast({
        title: "Eroare la retrimiterea emailului",
        description: error.message || "Nu s-a putut retrimite emailul de confirmare. Încearcă din nou.",
        variant: "destructive"
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-sm border-2 border-primary/20 shadow-2xl">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-xl font-semibold text-foreground">
            Verifică-ți emailul!
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Am trimis un email de confirmare la adresa:
            <div className="font-semibold text-foreground mt-2 p-2 bg-muted rounded-md">
              {email}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Timp așteptare:</span>
            </div>
            <span className="text-sm font-mono">{formatTime(timeElapsed)}</span>
          </div>

          <Alert className="border-primary/20 bg-primary/5">
            <CheckCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              <strong>Pașii următori:</strong>
              <ol className="mt-2 ml-4 space-y-1 list-decimal">
                <li>Deschide emailul primit</li>
                <li>Dă click pe linkul de confirmare</li>
                <li>Revino să te conectezi</li>
              </ol>
            </AlertDescription>
          </Alert>

          {showResendPrompt && (
            <Alert className="border-amber-500 bg-amber-50 animate-pulse">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700">
                <strong>A trecut mai mult de un minut.</strong> Nu ai primit emailul? 
                Verifică folderul spam sau retrimite emailul de confirmare.
              </AlertDescription>
            </Alert>
          )}

          {resendSuccess && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                Email retrimis cu succes! Verifică-ți inbox-ul și folderul spam.
              </AlertDescription>
            </Alert>
          )}

          {!showResendPrompt && timeElapsed < 60 && (
            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700 text-sm">
                <strong>Nu ai primit emailul?</strong> Verifică folderul spam. 
                Dacă nu îl găsești după un minut, poți retrimite emailul.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isResendAvailable && (
            <Button
              variant={showResendPrompt ? "default" : "outline"}
              onClick={handleResendConfirmation}
              disabled={isResending}
              className={`w-full sm:w-auto ${showResendPrompt ? 'animate-pulse bg-primary text-primary-foreground' : ''}`}
            >
              {isResending ? "Se retrimite..." : "Retrimite emailul"}
            </Button>
          )}
          <Button onClick={onClose} variant="secondary" className="w-full sm:w-auto">
            Am înțeles
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
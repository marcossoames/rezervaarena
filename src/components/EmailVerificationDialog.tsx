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
import { Mail, CheckCircle, AlertCircle } from "lucide-react";
import { useState } from "react";
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
  const { toast } = useToast();

  const handleResendConfirmation = async () => {
    setIsResending(true);
    setResendSuccess(false);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      });

      if (error) {
        throw error;
      }

      setResendSuccess(true);
      toast({
        title: "Email retrimis!",
        description: "Verifică-ți din nou emailul pentru confirmarea contului.",
        duration: 5000
      });
    } catch (error: any) {
      toast({
        title: "Eroare",
        description: error.message || "Nu s-a putut retrimite emailul de confirmare",
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

          {resendSuccess && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                Email retrimis cu succes! Verifică-ți inbox-ul și folderul spam.
              </AlertDescription>
            </Alert>
          )}

          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700 text-sm">
              <strong>Nu ai primit emailul?</strong> Verifică folderul spam sau retrimite-l.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isResendAvailable && (
            <Button
              variant="outline"
              onClick={handleResendConfirmation}
              disabled={isResending}
              className="w-full sm:w-auto"
            >
              {isResending ? "Se retrimite..." : "Retrimite emailul"}
            </Button>
          )}
          <Button onClick={onClose} className="w-full sm:w-auto">
            Am înțeles
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
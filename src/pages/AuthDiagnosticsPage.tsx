import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Copy, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const AuthDiagnosticsPage = () => {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const supabaseUrl = "https://ukopxkymzywfpobpcana.supabase.co";
  const callbackUrl = `${supabaseUrl}/auth/v1/callback`;
  const currentOrigin = window.location.origin;
  const redirectUrl = `${currentOrigin}/auth-redirect`;
  const googleClientId = "556634083767-6e4o5otsascaohj7uu1ldgeguh9j7ljl.apps.googleusercontent.com";

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({
      title: "Copiat!",
      description: "Valoarea a fost copiată în clipboard."
    });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const diagnosticFields = [
    {
      id: "supabase-url",
      label: "Supabase URL",
      value: supabaseUrl,
      description: "URL-ul proiectului Supabase"
    },
    {
      id: "callback-url",
      label: "Google OAuth Callback URL",
      value: callbackUrl,
      description: "Trebuie adăugat în Google Cloud Console → OAuth 2.0 Client → Authorized redirect URIs"
    },
    {
      id: "current-origin",
      label: "Origin curent",
      value: currentOrigin,
      description: "Domeniul aplicației"
    },
    {
      id: "redirect-url",
      label: "Redirect URL aplicație",
      value: redirectUrl,
      description: "Trebuie setat în Supabase → Authentication → URL Configuration → Redirect URLs"
    },
    {
      id: "google-client-id",
      label: "Google Web Client ID",
      value: googleClientId,
      description: "Trebuie setat în Supabase → Authentication → Providers → Google"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center text-primary-foreground hover:text-primary-foreground/80">
            <ArrowLeft className="h-5 w-5 mr-2" />
            Înapoi
          </Link>
        </div>

        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="text-2xl">Diagnostic Autentificare Google</CardTitle>
            <CardDescription>
              Informații necesare pentru configurarea corectă a autentificării Google
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="bg-muted/50 p-4 rounded-lg space-y-4">
              {diagnosticFields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{field.label}</h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(field.value, field.id)}
                    >
                      {copiedField === field.id ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <code className="block p-2 bg-background rounded text-xs break-all">
                    {field.value}
                  </code>
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                </div>
              ))}
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <span className="text-amber-600">⚠️</span>
                Pași de configurare
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>În <strong>Google Cloud Console</strong>:
                  <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                    <li>OAuth 2.0 Client → Authorized redirect URIs → Adaugă <strong>Callback URL</strong></li>
                    <li>OAuth 2.0 Client → Authorized JavaScript origins → Adaugă <strong>Origin curent</strong></li>
                    <li>OAuth consent screen → Authorized domains → Adaugă: <code>lovableproject.com</code> și <code>supabase.co</code></li>
                  </ul>
                </li>
                <li>În <strong>Supabase Dashboard</strong>:
                  <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                    <li>Authentication → URL Configuration → Site URL → Setează <strong>Origin curent</strong></li>
                    <li>Authentication → URL Configuration → Redirect URLs → Adaugă <strong>Redirect URL aplicație</strong></li>
                    <li>Authentication → Providers → Google → Client ID → Setează <strong>Google Web Client ID</strong></li>
                  </ul>
                </li>
              </ol>
            </div>

            <div className="flex gap-3">
              <Button asChild variant="outline" className="flex-1">
                <a 
                  href="https://console.cloud.google.com/apis/credentials" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Google Cloud Console
                </a>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <a 
                  href="https://supabase.com/dashboard/project/ukopxkymzywfpobpcana/auth/providers" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Supabase Dashboard
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthDiagnosticsPage;

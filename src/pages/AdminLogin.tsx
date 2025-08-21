import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Mail, Lock, ArrowLeft, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

const AdminLogin = () => {
  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center text-primary-foreground hover:text-primary-foreground/80 transition-smooth">
            <ArrowLeft className="h-5 w-5 mr-2" />
            Înapoi la SportBook
          </Link>
        </div>

        <Card className="shadow-elegant animate-scale-in border-sport-blue/30">
          <CardHeader className="text-center pb-6">
            <div className="w-16 h-16 bg-sport-blue rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
              <Shield className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl text-foreground">Panou Administrare</CardTitle>
            <p className="text-muted-foreground">Acces restricționat pentru administratori</p>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Zonă Securizată</p>
                <p className="text-xs text-destructive/80">Doar personalul autorizat poate accesa această secțiune</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-email">Email administrator</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="admin-email" 
                  type="email" 
                  placeholder="admin@sportbook.ro"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Parola administrator</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="admin-password" 
                  type="password" 
                  placeholder="Parola securizată"
                  className="pl-10"
                />
              </div>
            </div>

            <Button className="w-full" size="lg" variant="premium">
              <Shield className="h-4 w-4 mr-2" />
              Acces Administrator
            </Button>

            <div className="text-center">
              <Link to="/admin/forgot-password" className="text-sm text-muted-foreground hover:text-primary transition-smooth">
                Probleme cu autentificarea?
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Show message and redirect to contact page
    toast({
      title: "Resetare parolă",
      description: "Pentru resetarea parolei, vă rugăm să contactați administratorul site-ului prin pagina de contact.",
      duration: 5000,
    });
    
    // Redirect to contact page
    navigate("/contact");
  }, [navigate, toast]);

  return null;
};

export default ForgotPasswordPage;
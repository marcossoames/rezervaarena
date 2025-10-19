import { useEffect, useState } from "react";
import { Network } from "@capacitor/network";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WifiOff, Wifi } from "lucide-react";
import { Capacitor } from "@capacitor/core";

export const NetworkStatusMonitor = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const { toast } = useToast();
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    // Only run on native platforms (iOS/Android)
    if (!isNative) return;

    let hasShownOfflineToast = false;

    const checkNetworkStatus = async () => {
      const status = await Network.getStatus();
      const online = status.connected;
      setIsOnline(online);
      setShowBanner(!online);

      // Show toast only when going offline, not on initial load
      if (!online && !hasShownOfflineToast) {
        toast({
          title: "Fără conexiune la internet",
          description: "Nu ai conexiune la internet. Operațiunile nu vor fi salvate până când te reconectezi.",
          variant: "destructive",
          duration: 5000,
        });
        hasShownOfflineToast = true;
      }
    };

    // Check initial status
    checkNetworkStatus();

    // Listen for network changes
    let listenerHandle: any;
    Network.addListener('networkStatusChange', (status) => {
      const online = status.connected;
      setIsOnline(online);
      setShowBanner(!online);

      if (!online) {
        toast({
          title: "Conexiune pierdută",
          description: "Nu ai conexiune la internet. Operațiunile nu vor fi salvate până când te reconectezi.",
          variant: "destructive",
          duration: 5000,
        });
        hasShownOfflineToast = true;
      } else if (hasShownOfflineToast) {
        // Show reconnection toast only if we previously showed offline toast
        toast({
          title: "Reconectat la internet",
          description: "Conexiunea a fost restabilită. Acum poți efectua operațiuni.",
          duration: 3000,
        });
        hasShownOfflineToast = false;
      }
    }).then(handle => {
      listenerHandle = handle;
    });

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [toast, isNative]);

  // Don't show anything on web
  if (!isNative) return null;

  // Show persistent banner when offline
  if (showBanner && !isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] animate-in slide-in-from-top">
        <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
          <WifiOff className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <strong>Fără internet:</strong> Operațiunile nu vor fi salvate până la reconectare
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return null;
};

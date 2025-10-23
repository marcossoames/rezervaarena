import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  created_at: string;
}

/**
 * Hook pentru gestionarea notificărilor native (System Notification Center)
 * Funcționează atât pe web (Web Notifications API) cât și pe mobile (Capacitor Local Notifications)
 */
export const useNativeNotifications = () => {
  useEffect(() => {
    let channel: any;

    const setupNotifications = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Request permission based on platform
        if (Capacitor.isNativePlatform()) {
          // Mobile - Capacitor Local Notifications
          const permissionStatus = await LocalNotifications.checkPermissions();
          if (permissionStatus.display !== 'granted') {
            const result = await LocalNotifications.requestPermissions();
            if (result.display !== 'granted') {
              console.warn('Notification permissions not granted');
              return;
            }
          }
        } else {
          // Web - Web Notifications API
          if ('Notification' in window) {
            if (Notification.permission === 'default') {
              const permission = await Notification.requestPermission();
              if (permission !== 'granted') {
                console.warn('Notification permissions not granted');
                return;
              }
            } else if (Notification.permission === 'denied') {
              console.warn('Notification permissions denied');
              return;
            }
          }
        }

        // Set up realtime subscription for new notifications
        channel = supabase
          .channel('native-notifications-changes')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`
            },
            async (payload) => {
              console.log('New notification received:', payload);
              const newNotif = payload.new as Notification;
              
              // Send native notification
              await sendNativeNotification(newNotif);
            }
          )
          .subscribe();
      } catch (error) {
        console.error('Error setting up native notifications:', error);
      }
    };

    setupNotifications();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);
};

/**
 * Trimite o notificare nativă în funcție de platformă
 */
const sendNativeNotification = async (notification: Notification) => {
  try {
    if (Capacitor.isNativePlatform()) {
      // Mobile - Capacitor Local Notifications
      await LocalNotifications.schedule({
        notifications: [
          {
            title: notification.title,
            body: notification.message,
            id: Math.floor(Math.random() * 100000), // Random ID pentru notificare
            schedule: { at: new Date(Date.now() + 1000) }, // Trimite imediat
            sound: undefined, // Folosește sunetul default
            attachments: undefined,
            actionTypeId: "",
            extra: {
              notificationId: notification.id,
              link: notification.link
            }
          }
        ]
      });
    } else {
      // Web - Web Notifications API
      if ('Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification(notification.title, {
          body: notification.message,
          icon: '/android-chrome-192x192.png', // Logo aplicației
          badge: '/android-chrome-192x192.png',
          tag: notification.id, // Previne notificări duplicate
          requireInteraction: false,
          silent: false,
        });

        // Handle notification click
        notif.onclick = () => {
          window.focus();
          if (notification.link) {
            window.location.href = notification.link;
          }
          notif.close();
        };
      }
    }
  } catch (error) {
    console.error('Error sending native notification:', error);
  }
};

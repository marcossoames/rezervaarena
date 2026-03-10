import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";

interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  created_at: string;
}

export const useNativeNotifications = () => {
  useEffect(() => {
    let channel: any;

    const setupNotifications = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        if (Capacitor.isNativePlatform()) {
          const permissionStatus = await LocalNotifications.checkPermissions();
          if (permissionStatus.display !== 'granted') {
            const result = await LocalNotifications.requestPermissions();
            if (result.display !== 'granted') return;
          }
        } else {
          if ('Notification' in window) {
            if (Notification.permission === 'default') {
              const permission = await Notification.requestPermission();
              if (permission !== 'granted') return;
            } else if (Notification.permission === 'denied') {
              return;
            }
          }
        }

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
              await sendNativeNotification(payload.new as NotificationData);
            }
          )
          .subscribe();
      } catch (error) {
        console.error('Error setting up notifications:', error);
      }
    };

    setupNotifications();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);
};

const sendNativeNotification = async (notification: NotificationData) => {
  try {
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [{
          title: notification.title,
          body: notification.message,
          id: Math.floor(Math.random() * 100000),
          schedule: { at: new Date(Date.now() + 1000) },
          sound: undefined,
          attachments: undefined,
          actionTypeId: "",
          extra: {
            notificationId: notification.id,
            link: notification.link
          }
        }]
      });
    } else {
      if ('Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification(notification.title, {
          body: notification.message,
          icon: '/android-chrome-192x192.png',
          badge: '/android-chrome-192x192.png',
          tag: notification.id,
          requireInteraction: false,
          silent: false,
        });

        notif.onclick = () => {
          window.focus();
          if (notification.link) window.location.href = notification.link;
          notif.close();
        };
      }
    }
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};
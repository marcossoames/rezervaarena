import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rezervaarena.app',
  appName: 'RezervaArena',
  webDir: 'dist',
  /*server: {
    url: 'https://947ae49f-e8d5-4283-95f7-ef683f84f2b9.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },*/
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#001d3d',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#001d3d'
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#488AFF',
      sound: 'beep.wav'
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com', // Replace with your Web Client ID
      forceCodeForRefreshToken: true
    }
  },
  ios: {
    contentInset: 'always'
  }
};

export default config;

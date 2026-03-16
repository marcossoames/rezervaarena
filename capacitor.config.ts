import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rezervaarena.app',
  appName: 'RezervaArena',
  webDir: 'dist',
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
    CapacitorSocialLogin: {
      google: {
        webClientId: '556634083767-6e4o5otsascaohj7uu1ldgeguh9j7ljl.apps.googleusercontent.com',
        scopes: ['profile', 'email']
      }
    }
  },
  ios: {
    contentInset: 'always'
  }
};

export default config;

import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.947ae49fe8d5428395f7ef683f84f2b9',
  appName: 'RezervaArena',
  webDir: 'dist',
  server: {
    url: 'https://947ae49f-e8d5-4283-95f7-ef683f84f2b9.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#001d3d',
      showSpinner: false
    }
  }
};

export default config;

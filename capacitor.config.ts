import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.baltozaur.app',
  appName: 'Baltozaur',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;

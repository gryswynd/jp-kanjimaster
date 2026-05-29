import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rikizo.app',
  appName: 'Rikizo',
  webDir: 'www',
  ios: {
    // Let the web content draw under the status bar / home indicator; the app's
    // own CSS handles env(safe-area-inset-*).
    contentInset: 'never',
    backgroundColor: '#272320',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#272320',
      showSpinner: false,
    },
  },
};

export default config;

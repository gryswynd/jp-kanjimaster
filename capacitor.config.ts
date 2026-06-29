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
  android: {
    backgroundColor: '#272320',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#272320',
      showSpinner: false,
    },
    // Firebase Authentication (@capacitor-firebase/authentication). skipNativeAuth
    // lets the native layer return a credential that our compat JS SDK signs in
    // with (see app/shared/auth.js). iOS: add the reversed-client-id URL scheme
    // from GoogleService-Info.plist + the "Sign in with Apple" capability.
    // Android: GoogleService-Info → google-services.json + SHA-1/256 in Firebase.
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['apple.com', 'google.com'],
    },
  },
};

export default config;

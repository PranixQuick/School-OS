import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.pranix.schoolos',
  appName: 'School OS',
  webDir: 'out',
  server: {
    // WebView points to production Vercel URL — no static export needed.
    // The web app at school-os-rh47.vercel.app is the source of truth.
    url: 'https://school-os-rh47.vercel.app',
    cleartext: false,
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1e40af',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#1e40af',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    intentFilters: [
      {
        action: 'android.intent.action.VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: 'school-os-rh47.vercel.app' }
        ],
        categories: [
          'android.intent.category.DEFAULT',
          'android.intent.category.BROWSABLE'
        ]
      }
    ]
  },
};

export default config;

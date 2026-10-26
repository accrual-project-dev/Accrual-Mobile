import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.syntheticae.accrual',
  appName: 'Accrual',
  webDir: 'dist',
  backgroundColor: '#0A0A0B',
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile'
  },
  android: {
    backgroundColor: '#0A0A0B',
    allowMixedContent: false,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    CapacitorHttp: {
      enabled: false,
    },
  },
};

export default config;

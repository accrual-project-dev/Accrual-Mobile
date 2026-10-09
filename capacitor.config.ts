import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alhafidz.trouvaille',
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
      enabled: true,
    },
  },
};

export default config;

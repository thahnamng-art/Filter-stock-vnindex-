import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'vn.fialda.quant.screener',
  appName: 'Fialda Quant',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    backgroundColor: '#0c1017',
    allowMixedContent: true
  }
};

export default config;

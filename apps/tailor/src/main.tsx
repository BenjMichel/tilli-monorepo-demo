import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { httpApi } from './api';
import { App } from './app';
import { usePalette } from './theme';

/**
 * The API has no CORS: the app reaches it through /api on the Metro dev server (metro.config.cjs).
 * On the web that is the page's own origin; on a phone, the host Expo Go loaded the bundle from.
 */
function apiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'web') return '/api';
  const host = Constants.expoConfig?.hostUri;
  if (!host) throw new Error('Set EXPO_PUBLIC_API_URL: no dev server to relay the API');
  return `http://${host}/api`;
}

const api = httpApi(apiBaseUrl());

export function Main() {
  const palette = usePalette();
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.surface }} edges={['top']}>
        <App api={api} />
      </SafeAreaView>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

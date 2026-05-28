import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { ThemeProvider } from '@/lib/theme-context';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}

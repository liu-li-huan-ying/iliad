import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0b0b0d' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="play" />
      </Stack>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

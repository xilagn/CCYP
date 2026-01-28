import { Stack } from 'expo-router';
import { AppProvider } from '../contexts/AppContext';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <AppProvider>
      <StatusBar style="light" backgroundColor="#0a0a0f" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#0a0a0f',
          },
          headerTintColor: '#00d4ff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: '#0a0a0f',
          },
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            title: '蓝牙串口工具',
            headerShown: true 
          }} 
        />
        <Stack.Screen 
          name="bluetooth" 
          options={{ 
            title: '蓝牙设备扫描',
            headerShown: true 
          }} 
        />
        <Stack.Screen 
          name="terminal" 
          options={{ 
            title: '串口终端',
            headerShown: true 
          }} 
        />
      </Stack>
    </AppProvider>
  );
}

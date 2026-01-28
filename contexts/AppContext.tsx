import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LogEntry {
  id: string;
  timestamp: number;
  type: 'info' | 'success' | 'error' | 'send' | 'receive' | 'websocket';
  message: string;
}

interface AppContextType {
  deviceId: string;
  setDeviceId: (id: string) => void;
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;
  btConnected: boolean;
  setBtConnected: (connected: boolean) => void;
  logs: LogEntry[];
  addLog: (type: LogEntry['type'], message: string) => void;
  clearLogs: () => void;
  connectedDevice: any;
  setConnectedDevice: (device: any) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [deviceId, setDeviceIdState] = useState<string>('');
  const [wsConnected, setWsConnected] = useState(false);
  const [btConnected, setBtConnected] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<any>(null);

  // 加载保存的 device_id
  useEffect(() => {
    loadDeviceId();
  }, []);

  const loadDeviceId = async () => {
    try {
      const saved = await AsyncStorage.getItem('device_id');
      if (saved) {
        setDeviceIdState(saved);
      }
    } catch (error) {
      console.error('加载 device_id 失败:', error);
    }
  };

  const setDeviceId = async (id: string) => {
    try {
      await AsyncStorage.setItem('device_id', id);
      setDeviceIdState(id);
    } catch (error) {
      console.error('保存 device_id 失败:', error);
    }
  };

  const addLog = (type: LogEntry['type'], message: string) => {
    const newLog: LogEntry = {
      id: Date.now().toString() + Math.random(),
      timestamp: Date.now(),
      type,
      message,
    };
    setLogs(prev => [...prev, newLog]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <AppContext.Provider
      value={{
        deviceId,
        setDeviceId,
        wsConnected,
        setWsConnected,
        btConnected,
        setBtConnected,
        logs,
        addLog,
        clearLogs,
        connectedDevice,
        setConnectedDevice,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

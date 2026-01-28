import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../contexts/AppContext';
import { Ionicons } from '@expo/vector-icons';
import RNBluetoothClassic, { BluetoothDevice } from 'react-native-bluetooth-classic';

export default function Bluetooth() {
  const router = useRouter();
  const { setConnectedDevice, setBtConnected, addLog } = useApp();
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [pairedDevices, setPairedDevices] = useState<BluetoothDevice[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    checkBluetoothEnabled();
    loadPairedDevices();
  }, []);

  const checkBluetoothEnabled = async () => {
    try {
      const enabled = await RNBluetoothClassic.isBluetoothEnabled();
      if (!enabled) {
        Alert.alert(
          '蓝牙未开启',
          '请开启蓝牙功能',
          [
            { text: '取消', style: 'cancel' },
            {
              text: '去开启',
              onPress: async () => {
                try {
                  await RNBluetoothClassic.requestBluetoothEnabled();
                } catch (error) {
                  console.error('请求开启蓝牙失败:', error);
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('检查蓝牙状态失败:', error);
      Alert.alert('错误', '无法检查蓝牙状态');
    }
  };

  const loadPairedDevices = async () => {
    try {
      const paired = await RNBluetoothClassic.getBondedDevices();
      setPairedDevices(paired);
      addLog('info', `已加载 ${paired.length} 个已配对设备`);
    } catch (error) {
      console.error('获取已配对设备失败:', error);
      addLog('error', '获取已配对设备失败');
    }
  };

  const startScan = async () => {
    try {
      const enabled = await RNBluetoothClassic.isBluetoothEnabled();
      if (!enabled) {
        Alert.alert('提示', '请先开启蓝牙');
        return;
      }

      setScanning(true);
      setDevices([]);
      addLog('info', '开始扫描蓝牙设备...');

      const discovered = await RNBluetoothClassic.startDiscovery();
      setDevices(discovered);
      addLog('success', `扫描完成，发现 ${discovered.length} 个设备`);
    } catch (error) {
      console.error('扫描失败:', error);
      addLog('error', '扫描蓝牙设备失败');
      Alert.alert('错误', '扫描蓝牙设备失败');
    } finally {
      setScanning(false);
    }
  };

  const connectToDevice = async (device: BluetoothDevice) => {
    try {
      setConnecting(device.id);
      addLog('info', `正在连接到 ${device.name || device.address}...`);

      const connected = await device.connect();
      
      if (connected) {
        setConnectedDevice(device);
        setBtConnected(true);
        addLog('success', `已连接到 ${device.name || device.address}`);
        Alert.alert(
          '连接成功',
          `已连接到 ${device.name || device.address}`,
          [
            {
              text: '前往终端',
              onPress: () => router.push('/terminal'),
            },
          ]
        );
      } else {
        throw new Error('连接失败');
      }
    } catch (error) {
      console.error('连接失败:', error);
      addLog('error', `连接 ${device.name || device.address} 失败`);
      Alert.alert('连接失败', '无法连接到该设备，请确保设备支持 SPP 协议');
    } finally {
      setConnecting(null);
    }
  };

  const renderDevice = (device: BluetoothDevice, isPaired: boolean = false) => (
    <TouchableOpacity
      key={device.id}
      style={styles.deviceItem}
      onPress={() => connectToDevice(device)}
      disabled={connecting !== null}
    >
      <View style={styles.deviceIcon}>
        <Ionicons
          name={isPaired ? 'bluetooth' : 'bluetooth-outline'}
          size={32}
          color={isPaired ? '#00ff88' : '#00d4ff'}
        />
      </View>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{device.name || '未知设备'}</Text>
        <Text style={styles.deviceAddress}>{device.address}</Text>
        {isPaired && (
          <View style={styles.pairedBadge}>
            <Text style={styles.pairedText}>已配对</Text>
          </View>
        )}
      </View>
      {connecting === device.id ? (
        <ActivityIndicator size="small" color="#00d4ff" />
      ) : (
        <Ionicons name="chevron-forward" size={24} color="#666" />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* 扫描按钮 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.scanButton, scanning && styles.scanButtonDisabled]}
          onPress={startScan}
          disabled={scanning}
        >
          {scanning ? (
            <ActivityIndicator size="small" color="#0a0a0f" />
          ) : (
            <Ionicons name="scan" size={24} color="#0a0a0f" />
          )}
          <Text style={styles.scanButtonText}>
            {scanning ? '扫描中...' : '开始扫描'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.refreshButton} onPress={loadPairedDevices}>
          <Ionicons name="refresh" size={24} color="#00d4ff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* 已配对设备 */}
        {pairedDevices.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="link" size={20} color="#00ff88" />
              <Text style={styles.sectionTitle}>已配对设备 ({pairedDevices.length})</Text>
            </View>
            {pairedDevices.map(device => renderDevice(device, true))}
          </View>
        )}

        {/* 扫描到的设备 */}
        {devices.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="search" size={20} color="#00d4ff" />
              <Text style={styles.sectionTitle}>扫描到的设备 ({devices.length})</Text>
            </View>
            {devices.map(device => renderDevice(device, false))}
          </View>
        )}

        {/* 空状态 */}
        {!scanning && devices.length === 0 && pairedDevices.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="bluetooth-outline" size={80} color="#444" />
            <Text style={styles.emptyText}>未发现蓝牙设备</Text>
            <Text style={styles.emptyHint}>点击上方按钮开始扫描</Text>
          </View>
        )}

        {/* 提示信息 */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#00d4ff" />
          <Text style={styles.infoText}>
            请确保目标蓝牙设备支持 SPP（串口协议）并已开启可发现模式
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  scanButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00d4ff',
    borderRadius: 12,
    paddingVertical: 15,
    gap: 10,
  },
  scanButtonDisabled: {
    backgroundColor: '#666',
  },
  scanButtonText: {
    color: '#0a0a0f',
    fontSize: 16,
    fontWeight: 'bold',
  },
  refreshButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00d4ff',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e0e0e0',
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  deviceIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0a0a0f',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e0e0e0',
    marginBottom: 4,
  },
  deviceAddress: {
    fontSize: 14,
    color: '#888',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  pairedBadge: {
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  pairedText: {
    fontSize: 12,
    color: '#00ff88',
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 20,
    fontWeight: 'bold',
  },
  emptyHint: {
    fontSize: 14,
    color: '#444',
    marginTop: 5,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 15,
    margin: 15,
    gap: 12,
    borderWidth: 1,
    borderColor: '#00d4ff',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
  },
});

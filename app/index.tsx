import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import * as Network from 'expo-network';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import * as Audio from 'expo-audio';
import { useRouter } from 'expo-router';
import { useApp } from '../contexts/AppContext';
import { Ionicons } from '@expo/vector-icons';

export default function Index() {
  const router = useRouter();
  const { deviceId, setDeviceId, wsConnected, btConnected, addLog } = useApp();
  const [inputId, setInputId] = useState(deviceId);
  const [networkStatus, setNetworkStatus] = useState('unknown');
  const networkStatusRef = React.useRef(networkStatus);
  
  // 更新ref值
  useEffect(() => {
    networkStatusRef.current = networkStatus;
  }, [networkStatus]);

  useEffect(() => {
    // 检查网络连接状态（基础检测）
    const checkNetworkStatus = async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        setNetworkStatus(networkState.isConnected ? 'connected' : 'disconnected');
        addLog('info', `网络连接状态: ${networkState.isConnected ? '已连接' : '未连接'}`);
        if (networkState.isConnected) {
          addLog('info', `网络类型: ${networkState.type}`);
          if (networkState.type === 'wifi') {
            addLog('info', '当前使用WiFi网络');
          } else if (networkState.type === 'cellular') {
            addLog('info', '当前使用移动数据网络');
          }
        }
      } catch (error) {
        console.error('检查网络状态失败:', error);
        setNetworkStatus('error');
        addLog('error', `检查网络状态失败: ${error}`);
      }
    };
    
    // 验证网络连接状态（通过尝试连接服务器）
    const verifyNetworkConnection = async () => {
      try {
        // 尝试连接一个可靠的服务器
        const response = await fetch('https://www.baidu.com', {
          method: 'HEAD',
          timeout: 3000
        });
        return response.ok;
      } catch (error) {
        return false;
      }
    };

    // 申请所有需要的权限
    const requestPermissions = async () => {
      try {
        addLog('info', '开始申请权限...');
        
        // 跨平台位置权限申请
        try {
          const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
          addLog('info', `位置权限: ${locationStatus}`);
        } catch (locationError) {
          addLog('error', `位置权限申请失败: ${locationError}`);
        }
        
        // 跨平台媒体库权限申请
        try {
          const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
          addLog('info', `媒体库权限: ${mediaStatus}`);
        } catch (mediaError) {
          addLog('error', `媒体库权限申请失败: ${mediaError}`);
        }
        
        // 跨平台音频录制权限申请
        try {
          const { status } = await Audio.requestPermissionsAsync();
          addLog('info', `音频录制权限: ${status}`);
        } catch (audioError) {
          addLog('error', `音频录制权限申请失败: ${audioError}`);
        }
        
        // Android平台特定权限
        if (Platform.OS === 'android') {
          // 存储权限
          try {
            const storagePermission = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
            );
            addLog('info', `读取外部存储权限: ${storagePermission}`);
          } catch (storageError) {
            addLog('error', `存储权限申请失败: ${storageError}`);
          }
          
          // 蓝牙权限
          try {
            const bluetoothScanPermission = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
            );
            addLog('info', `蓝牙扫描权限: ${bluetoothScanPermission}`);
          } catch (bluetoothError) {
            addLog('error', `蓝牙扫描权限申请失败: ${bluetoothError}`);
          }
          
          try {
            const bluetoothConnectPermission = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
            );
            addLog('info', `蓝牙连接权限: ${bluetoothConnectPermission}`);
          } catch (bluetoothError) {
            addLog('error', `蓝牙连接权限申请失败: ${bluetoothError}`);
          }
          
          // 前台服务权限
          try {
            const foregroundServicePermission = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.FOREGROUND_SERVICE
            );
            addLog('info', `前台服务权限: ${foregroundServicePermission}`);
          } catch (foregroundError) {
            addLog('error', `前台服务权限申请失败: ${foregroundError}`);
          }
        }
        
        addLog('success', '权限申请完成');
      } catch (error) {
        console.error('权限申请失败:', error);
        addLog('error', `权限申请失败: ${error}`);
      }
    };

    // 执行初始化操作
    const initializeApp = async () => {
      await checkNetworkStatus();
      await requestPermissions();
    };

    initializeApp();

    // 网络状态变化监听（使用定时器定期检查）
    const networkCheckInterval = setInterval(async () => {
      try {
        // 基础网络状态检测
        const networkState = await Network.getNetworkStateAsync();
        
        // 验证实际互联网连接
        const isInternetConnected = await verifyNetworkConnection();
        
        // 综合判断网络状态
        const newStatus = (networkState.isConnected && isInternetConnected) ? 'connected' : 'disconnected';
        
        if (newStatus !== networkStatusRef.current) {
          setNetworkStatus(newStatus);
          addLog('info', `网络连接状态变化: ${newStatus === 'connected' ? '已连接' : '未连接'}`);
          addLog('info', `基础网络状态: ${networkState.isConnected ? '已连接' : '未连接'}`);
          addLog('info', `互联网连接: ${isInternetConnected ? '可达' : '不可达'}`);
          // 添加网络状态变化通知
          Alert.alert(
            '网络状态变化',
            `网络连接状态: ${newStatus === 'connected' ? '已连接' : '未连接'}\n基础网络: ${networkState.isConnected ? '已连接' : '未连接'}\n互联网: ${isInternetConnected ? '可达' : '不可达'}`,
            [{ text: '确定' }]
          );
        }
      } catch (error) {
        console.error('检查网络状态失败:', error);
      }
    }, 2000); // 每2秒检查一次

    return () => clearInterval(networkCheckInterval);
  }, []);

  const handleSave = () => {
    if (!inputId.trim()) {
      Alert.alert('错误', '请输入设备 ID');
      return;
    }
    setDeviceId(inputId.trim());
    Alert.alert('成功', '设备 ID 已保存');
  };

  const handleNavigate = () => {
    if (!deviceId) {
      Alert.alert('提示', '请先配置设备 ID');
      return;
    }
    router.push('/bluetooth');
  };

  const testServerConnection = async () => {
    addLog('info', '=== 服务器连接测试开始 ===');
    const WS_URL = 'ws://107.174.240.113:8080';
    addLog('info', `测试地址: ${WS_URL}`);
    
    // 检查网络状态
    try {
      const currentNetworkState = await Network.getNetworkStateAsync();
      addLog('info', `网络连接状态: ${currentNetworkState.isConnected ? '已连接' : '未连接'}`);
      addLog('info', `网络类型: ${currentNetworkState.type}`);
      
      if (!currentNetworkState.isConnected) {
        addLog('error', '网络未连接，无法测试服务器连接');
        Alert.alert('测试失败', '网络未连接，请检查网络设置后重试');
        addLog('info', '=== 服务器连接测试结束 ===');
        return;
      }
    } catch (error) {
      addLog('error', `检查网络状态失败: ${error}`);
      Alert.alert('测试失败', '检查网络状态失败，请重试');
      addLog('info', '=== 服务器连接测试结束 ===');
      return;
    }
    
    // 显示测试开始提示
    Alert.alert('测试中', '正在测试服务器连接，请稍候...');
    
    try {
      addLog('info', '检查WebSocket是否可用...');
      if (typeof WebSocket === 'undefined') {
        addLog('error', 'WebSocket在当前环境中不可用');
        setTimeout(() => {
          Alert.alert('测试失败', 'WebSocket在当前环境中不可用');
        }, 500);
        addLog('info', '=== 服务器连接测试结束 ===');
        return;
      }
      
      addLog('info', '开始创建WebSocket连接...');
      addLog('info', `WebSocket URL: ${WS_URL}`);
      addLog('info', `WebSocket构造函数调用前`);
      
      const testWs = new WebSocket(WS_URL);
      
      addLog('info', 'WebSocket连接对象创建成功');
      addLog('info', `WebSocket对象: ${typeof testWs}`);
      addLog('info', `WebSocket初始状态: ${testWs.readyState}`);
      
      let receivedResponse = false;
      let testSuccess = false;
      let testCompleted = false;
      
      // 确保最终会显示结果
      const finalTimeout = setTimeout(() => {
        if (!testCompleted) {
          testCompleted = true;
          addLog('error', '测试最终超时: 未收到任何响应');
          Alert.alert('测试失败', '测试最终超时: 未收到任何响应');
          if (testWs.readyState === WebSocket.CONNECTING || testWs.readyState === WebSocket.OPEN) {
            testWs.close();
          }
          addLog('info', '=== 服务器连接测试结束 ===');
        }
      }, 8000);
      
      testWs.onopen = () => {
        addLog('success', '✓ WebSocket连接已打开');
        addLog('info', `连接状态: ${testWs.readyState}`);
        addLog('info', '已建立连接，等待服务器回复...');
        
        // 发送ping消息测试服务器响应
        const pingMessage = {
          type: 'ping',
          device_id: deviceId || 'test_device',
          timestamp: Date.now()
        };
        testWs.send(JSON.stringify(pingMessage));
        addLog('info', '发送ping消息测试服务器响应...');
      };
      
      testWs.onmessage = (event) => {
        addLog('info', `收到服务器消息 (${event.data.length} bytes)`);
        try {
          const data = JSON.parse(event.data);
          addLog('info', `解析消息成功: ${data.type}`);
          
          receivedResponse = true;
          testSuccess = true;
          testCompleted = true;
          clearTimeout(finalTimeout);
          
          if (data.type === 'welcome' || data.type === 'pong' || data.type === 'registered') {
            addLog('success', `✓ 服务器连接测试成功！收到${data.type}消息`);
            testWs.close();
            setTimeout(() => {
              Alert.alert('测试成功', `服务器连接测试成功！\n收到${data.type === 'welcome' ? '欢迎' : data.type === 'pong' ? '心跳' : '注册'}消息`);
            }, 500);
          } else {
            // 其他类型的消息也视为成功
            addLog('success', `✓ 服务器连接测试成功！收到${data.type}消息`);
            testWs.close();
            setTimeout(() => {
              Alert.alert('测试成功', `服务器连接测试成功！\n收到${data.type}消息`);
            }, 500);
          }
        } catch (error) {
          // 即使解析失败，也视为成功（至少服务器有响应）
          receivedResponse = true;
          testSuccess = true;
          testCompleted = true;
          clearTimeout(finalTimeout);
          addLog('error', `收到服务器消息，但解析失败: ${error}`);
          addLog('info', `原始消息: ${event.data}`);
          testWs.close();
          setTimeout(() => {
            Alert.alert('测试成功', '服务器连接测试成功！收到服务器响应');
          }, 500);
        }
        addLog('info', '=== 服务器连接测试结束 ===');
      };
      
      testWs.onerror = (error) => {
        testCompleted = true;
        clearTimeout(finalTimeout);
        let errorMessage = '未知错误';
        if (error instanceof Error) {
          errorMessage = error.message || '未知错误';
        } else if (error && typeof error === 'object') {
          // 处理Event对象和其他对象
          if (error.type) {
            errorMessage = `网络错误: ${error.type}`;
          } else if (error.message) {
            errorMessage = error.message;
          } else {
            errorMessage = '网络连接错误';
          }
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
        addLog('error', `✗ 服务器连接测试失败: ${errorMessage}`);
        addLog('error', `错误详情: ${JSON.stringify(error)}`);
        addLog('error', `错误类型: ${typeof error}`);
        setTimeout(() => {
          Alert.alert('测试失败', `服务器连接测试失败: ${errorMessage}`);
        }, 500);
        addLog('info', '=== 服务器连接测试结束 ===');
      };
      
      testWs.onclose = (event) => {
        addLog('info', `WebSocket连接已关闭，代码: ${event.code}, 原因: ${event.reason || '无'}`);
        
        if (!receivedResponse && !testCompleted) {
          testCompleted = true;
          clearTimeout(finalTimeout);
          const closeError = `服务器连接测试失败: ${event.reason || '未收到服务器回复'}`;
          addLog('error', closeError);
          setTimeout(() => {
            Alert.alert('测试失败', closeError);
          }, 500);
        }
        
        addLog('info', '测试连接已关闭');
        if (!testCompleted) {
          addLog('info', '=== 服务器连接测试结束 ===');
        }
      };
      
      // 5秒超时
      addLog('info', '设置5秒超时...');
      setTimeout(() => {
        addLog('info', `检查连接状态: ${testWs.readyState}`);
        if (testWs.readyState === WebSocket.CONNECTING || testWs.readyState === WebSocket.OPEN) {
          addLog('info', '超时，关闭连接...');
          testWs.close();
          if (!receivedResponse && !testCompleted) {
            testCompleted = true;
            clearTimeout(finalTimeout);
            const timeoutError = '服务器连接测试超时: 未收到服务器回复';
            addLog('error', timeoutError);
            setTimeout(() => {
              Alert.alert('测试失败', timeoutError);
            }, 500);
            addLog('info', '=== 服务器连接测试结束 ===');
          }
        }
      }, 5000);
      
    } catch (error) {
      const errorMsg = `测试连接失败: ${error}`;
      addLog('error', errorMsg);
      addLog('error', `错误详情: ${error?.stack || '无'}`);
      setTimeout(() => {
        Alert.alert('测试失败', errorMsg);
      }, 500);
      addLog('info', '=== 服务器连接测试结束 ===');
    }
  };

  const pingServer = async () => {
    addLog('info', '开始执行Ping服务器函数...');
    const WS_URL = 'ws://107.174.240.113:8080';
    addLog('info', `Ping地址: ${WS_URL}`);
    
    // 检查网络状态
    try {
      const currentNetworkState = await Network.getNetworkStateAsync();
      if (!currentNetworkState.isConnected) {
        addLog('error', '网络未连接，无法Ping服务器');
        Alert.alert('Ping失败', '网络未连接，请检查网络设置后重试');
        return;
      }
    } catch (error) {
      addLog('error', `检查网络状态失败: ${error}`);
      Alert.alert('Ping失败', '检查网络状态失败，请重试');
      return;
    }
    
    // 显示Ping开始提示
    Alert.alert('Ping中', '正在Ping服务器，请稍候...');
    
    try {
      addLog('info', '检查WebSocket是否可用...');
      if (typeof WebSocket === 'undefined') {
        addLog('error', 'WebSocket在当前环境中不可用');
        setTimeout(() => {
          Alert.alert('Ping失败', 'WebSocket在当前环境中不可用');
        }, 500);
        return;
      }
      
      addLog('info', '创建WebSocket连接...');
      const pingWs = new WebSocket(WS_URL);
      addLog('info', 'WebSocket连接对象创建成功');
      
      let receivedPong = false;
      let pingCompleted = false;
      const startTime = Date.now();
      
      // 确保最终会显示结果
      const finalTimeout = setTimeout(() => {
        if (!pingCompleted) {
          pingCompleted = true;
          addLog('error', 'Ping最终超时: 未收到Pong响应');
          Alert.alert('Ping失败', 'Ping最终超时: 未收到Pong响应');
          if (pingWs.readyState === WebSocket.CONNECTING || pingWs.readyState === WebSocket.OPEN) {
            pingWs.close();
          }
        }
      }, 5000);
      
      pingWs.onopen = () => {
        addLog('info', 'WebSocket连接已打开');
        addLog('info', '发送Ping消息...');
        
        // 发送ping消息
        const pingMessage = {
          type: 'ping',
          device_id: deviceId || 'ping_test',
          timestamp: Date.now()
        };
        pingWs.send(JSON.stringify(pingMessage));
        addLog('info', 'Ping消息已发送');
      };
      
      pingWs.onmessage = (event) => {
        addLog('info', '收到服务器消息');
        try {
          const data = JSON.parse(event.data);
          addLog('info', `解析消息成功: ${data.type}`);
          
          if (data.type === 'pong') {
            receivedPong = true;
            pingCompleted = true;
            clearTimeout(finalTimeout);
            const responseTime = Date.now() - startTime;
            addLog('success', `Ping服务器成功！响应时间: ${responseTime}ms`);
            pingWs.close();
            setTimeout(() => {
              Alert.alert('Ping成功', `服务器Ping成功！\n响应时间: ${responseTime}ms`);
            }, 500);
          } else if (data.type === 'welcome' || data.type === 'registered') {
            // 这些也视为成功响应
            receivedPong = true;
            pingCompleted = true;
            clearTimeout(finalTimeout);
            const responseTime = Date.now() - startTime;
            addLog('success', `Ping服务器成功！收到${data.type}消息，响应时间: ${responseTime}ms`);
            pingWs.close();
            setTimeout(() => {
              Alert.alert('Ping成功', `服务器Ping成功！\n收到${data.type}消息\n响应时间: ${responseTime}ms`);
            }, 500);
          }
        } catch (error) {
          // 即使解析失败，也视为成功（至少服务器有响应）
          receivedPong = true;
          pingCompleted = true;
          clearTimeout(finalTimeout);
          const responseTime = Date.now() - startTime;
          addLog('error', `收到服务器消息，但解析失败: ${error}`);
          addLog('info', `原始消息: ${event.data}`);
          pingWs.close();
          setTimeout(() => {
            Alert.alert('Ping成功', `服务器Ping成功！\n响应时间: ${responseTime}ms\n注意: 消息解析失败`);
          }, 500);
        }
      };
      
      pingWs.onerror = (error) => {
        pingCompleted = true;
        clearTimeout(finalTimeout);
        let errorMessage = '未知错误';
        if (error instanceof Error) {
          errorMessage = error.message || '未知错误';
        } else if (error && typeof error === 'object') {
          // 处理Event对象和其他对象
          if (error.type) {
            errorMessage = `网络错误: ${error.type}`;
          } else if (error.message) {
            errorMessage = error.message;
          } else {
            errorMessage = '网络连接错误';
          }
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
        addLog('error', `Ping服务器失败: ${errorMessage}`);
        setTimeout(() => {
          Alert.alert('Ping失败', `Ping服务器失败: ${errorMessage}`);
        }, 500);
      };
      
      pingWs.onclose = (event) => {
        addLog('info', `WebSocket连接已关闭，代码: ${event.code}, 原因: ${event.reason}`);
        if (!receivedPong && !pingCompleted) {
          pingCompleted = true;
          clearTimeout(finalTimeout);
          const closeError = `Ping服务器失败: ${event.reason || '未收到服务器回复'}`;
          addLog('error', closeError);
          setTimeout(() => {
            Alert.alert('Ping失败', closeError);
          }, 500);
        }
        addLog('info', 'Ping连接已关闭');
      };
      
      // 3秒超时
      addLog('info', '设置3秒超时...');
      setTimeout(() => {
        addLog('info', `检查连接状态: ${pingWs.readyState}`);
        if (pingWs.readyState === WebSocket.CONNECTING || pingWs.readyState === WebSocket.OPEN) {
          addLog('info', '超时，关闭连接...');
          pingWs.close();
          if (!receivedPong && !pingCompleted) {
            pingCompleted = true;
            clearTimeout(finalTimeout);
            const timeoutError = 'Ping服务器超时: 未收到响应';
            addLog('error', timeoutError);
            setTimeout(() => {
              Alert.alert('Ping失败', timeoutError);
            }, 500);
          }
        }
      }, 3000);
      
    } catch (error) {
      const errorMsg = `Ping服务器失败: ${error}`;
      addLog('error', errorMsg);
      addLog('error', `错误详情: ${error?.stack || '无'}`);
      setTimeout(() => {
        Alert.alert('Ping失败', errorMsg);
      }, 500);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* 顶部装饰 */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="bluetooth" size={80} color="#00d4ff" />
          </View>
          <Text style={styles.title}>蓝牙串口通信工具</Text>
          <Text style={styles.subtitle}>Bluetooth Serial Terminal</Text>
        </View>

        {/* 状态指示器 */}
        <View style={styles.statusContainer}>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, wsConnected && styles.statusDotActive]} />
            <Text style={styles.statusText}>WebSocket</Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, btConnected && styles.statusDotActive]} />
            <Text style={styles.statusText}>蓝牙</Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, networkStatus === 'connected' && styles.statusDotActive]} />
            <Text style={styles.statusText}>网络</Text>
          </View>
        </View>

        {/* 设备 ID 配置 */}
        <View style={styles.configSection}>
          <Text style={styles.label}>设备 ID 配置</Text>
          <Text style={styles.hint}>用于 WebSocket 服务器识别此设备</Text>
          
          <View style={styles.inputContainer}>
            <Ionicons name="phone-portrait-outline" size={20} color="#00d4ff" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={inputId}
              onChangeText={setInputId}
              placeholder="输入设备 ID（如：android_001）"
              placeholderTextColor="#666"
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Ionicons name="save-outline" size={20} color="#0a0a0f" />
            <Text style={styles.saveButtonText}>保存配置</Text>
          </TouchableOpacity>

          {deviceId && (
            <View style={styles.savedInfo}>
              <Ionicons name="checkmark-circle" size={18} color="#00ff88" />
              <Text style={styles.savedText}>当前设备 ID: {deviceId}</Text>
            </View>
          )}
        </View>

        {/* 服务器信息 */}
        <View style={styles.serverInfo}>
          <Text style={styles.serverTitle}>服务器地址</Text>
          <View style={styles.serverItem}>
            <Ionicons name="globe-outline" size={16} color="#00d4ff" />
            <Text style={styles.serverText}>ws://107.174.240.113:8080</Text>
          </View>
          <TouchableOpacity style={styles.testServerButton} onPress={testServerConnection}>
            <Ionicons name="wifi-outline" size={18} color="#0a0a0f" />
            <Text style={styles.testServerButtonText}>测试服务器连接</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pingServerButton} onPress={pingServer}>
            <Ionicons name="sync-outline" size={18} color="#0a0a0f" />
            <Text style={styles.pingServerButtonText}>Ping服务器</Text>
          </TouchableOpacity>
        </View>

        {/* 开始按钮 */}
        <TouchableOpacity
          style={[styles.startButton, !deviceId && styles.startButtonDisabled]}
          onPress={handleNavigate}
          disabled={!deviceId}
        >
          <Ionicons name="scan" size={24} color="#0a0a0f" />
          <Text style={styles.startButtonText}>开始扫描蓝牙设备</Text>
          <Ionicons name="chevron-forward" size={24} color="#0a0a0f" />
        </TouchableOpacity>

        {/* 功能说明 */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>功能特性</Text>
          <View style={styles.featureItem}>
            <Ionicons name="scan-circle-outline" size={20} color="#00d4ff" />
            <Text style={styles.featureText}>蓝牙设备扫描与连接</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="sync-outline" size={20} color="#00d4ff" />
            <Text style={styles.featureText}>WebSocket 实时通信</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="terminal-outline" size={20} color="#00d4ff" />
            <Text style={styles.featureText}>串口数据收发</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="list-outline" size={20} color="#00d4ff" />
            <Text style={styles.featureText}>实时日志滚动显示</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#00d4ff',
    shadowColor: '#00d4ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00d4ff',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    marginBottom: 30,
    paddingVertical: 15,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#444',
  },
  statusDotActive: {
    backgroundColor: '#00ff88',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  statusText: {
    color: '#e0e0e0',
    fontSize: 14,
  },
  configSection: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  label: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00d4ff',
    marginBottom: 5,
  },
  hint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 15,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2a2a3e',
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#e0e0e0',
    fontSize: 16,
    paddingVertical: 15,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00d4ff',
    borderRadius: 12,
    paddingVertical: 15,
    gap: 8,
  },
  saveButtonText: {
    color: '#0a0a0f',
    fontSize: 16,
    fontWeight: 'bold',
  },
  savedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 15,
    padding: 10,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  savedText: {
    color: '#00ff88',
    fontSize: 14,
  },
  serverInfo: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  serverTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00d4ff',
    marginBottom: 8,
  },
  serverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serverText: {
    color: '#e0e0e0',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  testServerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00d4ff',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 8,
    marginTop: 12,
  },
  testServerButtonText: {
    color: '#0a0a0f',
    fontSize: 14,
    fontWeight: 'bold',
  },
  pingServerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00ff88',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 8,
    marginTop: 8,
  },
  pingServerButtonText: {
    color: '#0a0a0f',
    fontSize: 14,
    fontWeight: 'bold',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00ff88',
    borderRadius: 16,
    paddingVertical: 18,
    gap: 10,
    marginBottom: 30,
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  startButtonDisabled: {
    backgroundColor: '#444',
    shadowOpacity: 0,
  },
  startButtonText: {
    color: '#0a0a0f',
    fontSize: 18,
    fontWeight: 'bold',
  },
  featuresContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00d4ff',
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  featureText: {
    color: '#e0e0e0',
    fontSize: 14,
  },
});

import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import * as Network from 'expo-network';
import { useRouter } from 'expo-router';
import { useApp } from '../contexts/AppContext';
import { Ionicons } from '@expo/vector-icons';
import iconv from 'iconv-lite';

const WS_URL = 'ws://107.174.240.113:8080';

export default function Terminal() {
  const router = useRouter();
  const {
    deviceId,
    connectedDevice,
    btConnected,
    setBtConnected,
    wsConnected,
    setWsConnected,
    logs,
    addLog,
    clearLogs,
  } = useApp();

  const [command, setCommand] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [encoding, setEncoding] = useState('utf8'); // 默认编码
  const scrollViewRef = useRef<ScrollView>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!connectedDevice || !btConnected) {
      return;
    }

    connectWebSocket();
    startBluetoothListener();

    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [connectedDevice, btConnected]);

  useEffect(() => {
    // 自动滚动到底部
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [logs]);

  // 重连尝试次数
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  
  const connectWebSocket = async () => {
    // 检查设备ID是否已设置
    if (!deviceId) {
      addLog('error', '设备ID未设置，无法连接服务器');
      Alert.alert('错误', '设备ID未设置，无法连接服务器');
      return;
    }
    
    // 检查服务器地址
    if (!WS_URL || WS_URL.trim() === '') {
      addLog('error', '服务器地址未设置');
      Alert.alert('错误', '服务器地址未设置');
      return;
    }
    
    try {
      addLog('info', '=== WebSocket 连接诊断开始 ===');
      addLog('info', `使用设备ID: ${deviceId}`);
      addLog('info', `服务器地址: ${WS_URL}`);
      
      // 检查网络连接状态
      try {
        const networkState = await Network.getNetworkStateAsync();
        addLog('info', `网络连接状态: ${networkState.isConnected ? '已连接' : '未连接'}`);
        addLog('info', `网络类型: ${networkState.type}`);
        if (networkState.type === 'wifi') {
          addLog('info', '当前使用WiFi网络');
        } else if (networkState.type === 'cellular') {
          addLog('info', '当前使用移动数据网络');
        }
        
        if (!networkState.isConnected) {
          addLog('error', '网络未连接，无法连接服务器');
          Alert.alert('错误', '网络未连接，请检查网络设置后重试');
          addLog('info', '=== WebSocket 连接诊断结束 ===');
          return;
        }
      } catch (error) {
        addLog('error', `检查网络状态失败: ${error}`);
        // 即使网络检查失败，也继续尝试连接
      }
      
      // 验证实际互联网连接
      try {
        const response = await fetch('https://www.baidu.com', { method: 'HEAD', timeout: 3000 });
        addLog('info', `互联网连接验证: ${response.ok ? '成功' : '失败'}`);
      } catch (error) {
        addLog('warning', `互联网连接验证失败: ${error}`);
        addLog('info', '继续尝试WebSocket连接...');
      }
      
      addLog('info', '开始创建WebSocket连接...');
      addLog('info', `WebSocket URL: ${WS_URL}`);
      addLog('info', `WebSocket构造函数调用前`);
      
      const websocket = new WebSocket(WS_URL);
      
      addLog('info', 'WebSocket连接对象创建成功');
      addLog('info', `WebSocket对象: ${typeof websocket}`);
      addLog('info', `WebSocket初始状态: ${websocket.readyState}`);

      websocket.onopen = () => {
        addLog('success', '✓ WebSocket 连接成功');
        addLog('info', `WebSocket状态: ${websocket.readyState}`);
        setWsConnected(true);
        setWs(websocket);
        reconnectAttempts.current = 0; // 重置重连次数
        
        // 注册设备
        registerDevice(websocket);
        
        // 启动心跳检测
        startHeartbeat(websocket);
        addLog('info', '=== WebSocket 连接诊断结束 ===');
      };

      websocket.onmessage = (event) => {
        try {
          addLog('info', `收到服务器消息 (${event.data.length} bytes)`);
          const data = JSON.parse(event.data);
          addLog('websocket', `消息类型: ${data.type}`);
          
          // 处理不同类型的消息
          if (data.type === 'registered') {
            addLog('success', '✓ 设备注册成功，可接收远程命令');
            Alert.alert('成功', '设备注册成功，可接收远程命令');
          } else if (data.type === 'command') {
            // 收到远程命令，转发到蓝牙
            sendToBluetooth(data.data);
            addLog('websocket', `远程命令: ${data.data}`);
          } else if (data.type === 'welcome') {
            addLog('info', `服务器欢迎消息: ${data.message}`);
          } else if (data.type === 'pong') {
            // 心跳响应
            addLog('info', '✓ 服务器心跳响应');
          } else if (data.type === 'error') {
            addLog('error', `服务器错误: ${data.message}`);
            Alert.alert('错误', `服务器错误: ${data.message}`);
          } else {
            addLog('info', `收到其他消息类型: ${data.type}`);
          }
        } catch (error) {
          console.error('解析消息失败:', error);
          addLog('error', `收到消息，但解析失败: ${error}`);
          addLog('info', `原始消息: ${event.data}`);
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket 错误:', error);
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
        addLog('error', `✗ 服务器连接错误: ${errorMessage}`);
        addLog('error', `错误详情: ${JSON.stringify(error)}`);
        addLog('error', `错误类型: ${typeof error}`);
        addLog('info', '=== WebSocket 连接诊断结束 ===');
        setWsConnected(false);
      };

      websocket.onclose = (event) => {
        addLog('info', `服务器连接关闭: ${event.code} ${event.reason || '无'}`);
        addLog('info', `关闭代码含义: ${getCloseCodeMeaning(event.code)}`);
        setWsConnected(false);
        setWs(null);

        // 清除心跳定时器
        if (heartbeatTimer.current) {
          clearInterval(heartbeatTimer.current);
          heartbeatTimer.current = null;
        }

        // 自动重连
        if (deviceId && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 30000); // 指数退避
          addLog('info', `尝试重新连接服务器... (${reconnectAttempts.current}/${maxReconnectAttempts})`);
          addLog('info', `重连延迟: ${delay}ms`);
          reconnectTimer.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          addLog('error', '✗ 重连失败，已达到最大尝试次数');
          Alert.alert('错误', '无法连接到服务器，请检查网络设置后重试\n\n可能的原因:\n1. 服务器未运行\n2. 网络连接问题\n3. 防火墙阻止\n4. 服务器地址错误');
          reconnectAttempts.current = 0; // 重置重连次数
          addLog('info', '=== WebSocket 连接诊断结束 ===');
        }
      };
    } catch (error) {
      console.error('创建 WebSocket 失败:', error);
      const errorMsg = `测试连接失败: ${error}`;
      addLog('error', errorMsg);
      addLog('error', `错误详情: ${error?.stack || '无'}`);
      Alert.alert('错误', errorMsg);
      addLog('info', '=== WebSocket 连接诊断结束 ===');
    }
  };

  // 获取WebSocket关闭代码含义
  const getCloseCodeMeaning = (code: number): string => {
    const codeMap: { [key: number]: string } = {
      1000: '正常关闭',
      1001: '终端离开',
      1002: '协议错误',
      1003: '不支持的数据类型',
      1004: '预留',
      1005: '无状态码',
      1006: '连接异常关闭',
      1007: '数据格式错误',
      1008: '政策违反',
      1009: '消息过大',
      1010: '扩展协商失败',
      1011: '服务器内部错误',
      1012: '服务重启',
      1013: '临时不可用',
      1014: 'TLS握手失败',
      1015: 'TLS错误'
    };
    return codeMap[code] || `未知代码 ${code}`;
  };

  // 注册设备
  const registerDevice = (websocket: WebSocket) => {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      const registerMsg = {
        type: 'register',
        device_id: deviceId,
        timestamp: Date.now(),
        platform: '5plus_spp',
        version: '1.0.0',
        description: '串口命令转发器(SPP 3.0)'
      };
      websocket.send(JSON.stringify(registerMsg));
      addLog('websocket', `发送设备注册信息`);
    }
  };

  // 心跳定时器
  const heartbeatTimer = useRef<NodeJS.Timeout | null>(null);
  
  // 启动心跳检测
  const startHeartbeat = (websocket: WebSocket) => {
    // 每30秒发送一次心跳
    heartbeatTimer.current = setInterval(() => {
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        const pingMsg = {
          type: 'ping',
          device_id: deviceId,
          timestamp: Date.now()
        };
        websocket.send(JSON.stringify(pingMsg));
        addLog('info', '发送心跳消息...');
      }
    }, 30000);
  };

  const startBluetoothListener = () => {
    if (!connectedDevice) return;

    try {
      // 监听蓝牙数据
      connectedDevice.onDataReceived((data: any) => {
        let message = '';
        
        // 根据选择的编码解码数据
        if (encoding === 'gbk') {
          try {
            // 尝试将接收到的数据转换为GBK编码
            if (data instanceof Uint8Array) {
              // 如果直接是Uint8Array
              message = iconv.decode(data, 'gbk');
              addLog('info', `使用GBK编码解码Uint8Array数据`);
            } else if (data.data instanceof Uint8Array) {
              // 如果data.data是Uint8Array
              message = iconv.decode(data.data, 'gbk');
              addLog('info', `使用GBK编码解码数据`);
            } else if (typeof data === 'string') {
              // 如果直接是字符串
              const uint8Array = new Uint8Array(data.split('').map((char: string) => char.charCodeAt(0)));
              message = iconv.decode(uint8Array, 'gbk');
              addLog('info', `使用GBK编码解码字符串数据`);
            } else if (typeof data.data === 'string') {
              // 如果data.data是字符串
              const uint8Array = new Uint8Array(data.data.split('').map((char: string) => char.charCodeAt(0)));
              message = iconv.decode(uint8Array, 'gbk');
              addLog('info', `使用GBK编码解码字符串数据`);
            } else {
              // 其他情况，尝试转换
              message = data.toString();
              addLog('info', `使用默认方式处理数据`);
            }
          } catch (decodeError) {
            console.error('GBK解码失败:', decodeError);
            addLog('error', `GBK解码失败: ${decodeError}`);
            // 如果解码失败，使用原始数据
            message = data.toString();
          }
        } else {
          // UTF-8编码
          if (data.data) {
            message = data.data.toString();
          } else {
            message = data.toString();
          }
        }
        
        addLog('receive', `蓝牙接收: ${message}`);
      });
    } catch (error) {
      console.error('启动蓝牙监听失败:', error);
      addLog('error', '蓝牙监听启动失败');
    }
  };

  const sendToBluetooth = async (data: string) => {
    if (!connectedDevice || !btConnected) {
      Alert.alert('错误', '蓝牙未连接');
      return;
    }

    try {
      // 根据选择的编码转换数据
      if (encoding === 'gbk') {
        // 使用iconv-lite将字符串转换为GBK编码的Buffer
        const buffer = iconv.encode(data, 'gbk');
        // 将Buffer转换为Uint8Array
        const uint8Array = new Uint8Array(buffer);
        // 直接发送Uint8Array
        await connectedDevice.write(uint8Array);
        addLog('info', `使用GBK编码发送数据 (${uint8Array.length} bytes)`);
      } else {
        // UTF-8编码直接发送字符串
        await connectedDevice.write(data);
      }
      
      addLog('send', `发送到蓝牙: ${data}`);
    } catch (error) {
      console.error('发送失败:', error);
      addLog('error', `发送失败: ${error}`);
      Alert.alert('发送失败', '无法发送数据到蓝牙设备');
    }
  };

  const handleSendCommand = () => {
    if (!command.trim()) {
      Alert.alert('提示', '请输入命令');
      return;
    }

    sendToBluetooth(command.trim());
    setCommand('');
  };

  const handleDisconnect = async () => {
    Alert.alert(
      '确认断开',
      '是否断开蓝牙和 WebSocket 连接？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '断开',
          style: 'destructive',
          onPress: async () => {
            if (ws) {
              ws.close();
            }
            if (connectedDevice) {
              try {
                await connectedDevice.disconnect();
              } catch (error) {
                console.error('断开蓝牙失败:', error);
              }
            }
            setBtConnected(false);
            setWsConnected(false);
            addLog('info', '已断开所有连接');
            router.back();
          },
        },
      ]
    );
  };

  const testServerConnection = async () => {
    addLog('info', '=== 服务器连接测试开始 ===');
    addLog('info', `测试地址: ${WS_URL}`);
    
    // 检查网络状态
    try {
      const networkState = await Network.getNetworkStateAsync();
      addLog('info', `网络连接状态: ${networkState.isConnected ? '已连接' : '未连接'}`);
      addLog('info', `网络类型: ${networkState.type}`);
      
      if (!networkState.isConnected) {
        addLog('error', '网络未连接，无法测试服务器连接');
        Alert.alert('测试失败', '网络未连接，请检查网络设置后重试');
        addLog('info', '=== 服务器连接测试结束 ===');
        return;
      }
    } catch (error) {
      addLog('error', `检查网络状态失败: ${error}`);
    }
    
    try {
      addLog('info', '检查WebSocket是否可用...');
      if (typeof WebSocket === 'undefined') {
        addLog('error', 'WebSocket在当前环境中不可用');
        Alert.alert('测试失败', 'WebSocket在当前环境中不可用');
        addLog('info', '=== 服务器连接测试结束 ===');
        return;
      }
      
      addLog('info', '创建WebSocket连接...');
      const testWs = new WebSocket(WS_URL);
      addLog('info', 'WebSocket连接对象创建成功');
      addLog('info', `初始状态: ${testWs.readyState}`);
      
      let receivedResponse = false;
      let testCompleted = false;
      
      // 确保最终会显示结果
      const finalTimeout = setTimeout(() => {
        if (!testCompleted) {
          testCompleted = true;
          addLog('error', '测试最终超时: 未收到任何响应');
          Alert.alert('测试失败', '服务器连接测试超时: 未收到服务器响应');
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
          testCompleted = true;
          clearTimeout(finalTimeout);
          
          if (data.type === 'welcome' || data.type === 'pong' || data.type === 'registered') {
            addLog('success', `✓ 服务器连接测试成功！收到${data.type}消息`);
            Alert.alert('测试成功', `服务器连接测试成功！\n收到${data.type === 'welcome' ? '欢迎' : data.type === 'pong' ? '心跳' : '注册'}消息`);
          } else {
            addLog('success', `✓ 服务器连接测试成功！收到${data.type}消息`);
            Alert.alert('测试成功', `服务器连接测试成功！\n收到${data.type}消息`);
          }
          
          testWs.close();
          addLog('info', '=== 服务器连接测试结束 ===');
        } catch (error) {
          // 即使解析失败，也视为成功（至少服务器有响应）
          receivedResponse = true;
          testCompleted = true;
          clearTimeout(finalTimeout);
          addLog('error', `收到服务器消息，但解析失败: ${error}`);
          addLog('info', `原始消息: ${event.data}`);
          testWs.close();
          Alert.alert('测试成功', '服务器连接测试成功！收到服务器响应');
          addLog('info', '=== 服务器连接测试结束 ===');
        }
      };
      
      testWs.onerror = (error) => {
        testCompleted = true;
        clearTimeout(finalTimeout);
        let errorMessage = '未知错误';
        if (error instanceof Error) {
          errorMessage = error.message || '未知错误';
        } else if (error && typeof error === 'object') {
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
        Alert.alert('测试失败', `服务器连接测试失败: ${errorMessage}`);
        addLog('info', '=== 服务器连接测试结束 ===');
      };
      
      testWs.onclose = (event) => {
        addLog('info', `WebSocket连接已关闭，代码: ${event.code}, 原因: ${event.reason || '无'}`);
        addLog('info', `关闭代码含义: ${getCloseCodeMeaning(event.code)}`);
        
        if (!receivedResponse && !testCompleted) {
          testCompleted = true;
          clearTimeout(finalTimeout);
          const closeError = `服务器连接测试失败: ${event.reason || '未收到服务器回复'}`;
          addLog('error', closeError);
          Alert.alert('测试失败', closeError);
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
            Alert.alert('测试失败', timeoutError);
            addLog('info', '=== 服务器连接测试结束 ===');
          }
        }
      }, 5000);
      
    } catch (error) {
      addLog('error', `测试连接失败: ${error}`);
      addLog('error', `错误详情: ${error?.stack || '无'}`);
      Alert.alert('测试失败', `测试连接失败: ${error}`);
      addLog('info', '=== 服务器连接测试结束 ===');
    }
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'success':
        return '#00ff88';
      case 'error':
        return '#ff4444';
      case 'send':
        return '#00d4ff';
      case 'receive':
        return '#ffaa00';
      case 'websocket':
        return '#aa88ff';
      default:
        return '#888';
    }
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'close-circle';
      case 'send':
        return 'arrow-up-circle';
      case 'receive':
        return 'arrow-down-circle';
      case 'websocket':
        return 'globe';
      default:
        return 'information-circle';
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* 状态栏 */}
      <View style={styles.statusBar}>
        <View style={styles.statusItem}>
          <View style={[styles.statusDot, wsConnected && styles.statusDotActive]} />
          <Text style={styles.statusText}>WebSocket</Text>
        </View>
        <View style={styles.statusItem}>
          <View style={[styles.statusDot, btConnected && styles.statusDotActive]} />
          <Text style={styles.statusText}>蓝牙</Text>
        </View>
        <View style={styles.encodingSelector}>
          <TouchableOpacity 
            style={[styles.encodingButton, encoding === 'utf8' && styles.encodingButtonActive]} 
            onPress={() => setEncoding('utf8')}
          >
            <Text style={[styles.encodingText, encoding === 'utf8' && styles.encodingTextActive]}>UTF-8</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.encodingButton, encoding === 'gbk' && styles.encodingButtonActive]} 
            onPress={() => setEncoding('gbk')}
          >
            <Text style={[styles.encodingText, encoding === 'gbk' && styles.encodingTextActive]}>GBK</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceText} numberOfLines={1}>
            {connectedDevice?.name || connectedDevice?.address || '未知设备'}
          </Text>
        </View>
      </View>

      {/* 日志显示区 */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.logContainer}
        contentContainerStyle={styles.logContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {logs.map((log) => (
          <View key={log.id} style={styles.logItem}>
            <View style={styles.logHeader}>
              <Ionicons
                name={getLogIcon(log.type) as any}
                size={16}
                color={getLogColor(log.type)}
              />
              <Text style={[styles.logTime, { color: getLogColor(log.type) }]}>
                {formatTime(log.timestamp)}
              </Text>
            </View>
            <Text style={styles.logMessage}>{log.message}</Text>
          </View>
        ))}
        {logs.length === 0 && (
          <View style={styles.emptyLogs}>
            <Ionicons name="document-text-outline" size={60} color="#444" />
            <Text style={styles.emptyText}>暂无日志</Text>
          </View>
        )}
      </ScrollView>

      {/* 输入区 */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={command}
            onChangeText={setCommand}
            placeholder="输入命令（如：AT）"
            placeholderTextColor="#666"
            autoCapitalize="none"
            returnKeyType="send"
            onSubmitEditing={handleSendCommand}
          />
        </View>
        <TouchableOpacity style={styles.sendButton} onPress={handleSendCommand}>
          <Ionicons name="send" size={24} color="#0a0a0f" />
        </TouchableOpacity>
      </View>

      {/* 底部按钮 */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.clearButton} onPress={clearLogs}>
          <Ionicons name="trash-outline" size={20} color="#ff4444" />
          <Text style={styles.clearButtonText}>清空日志</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.testButton} onPress={testServerConnection}>
          <Ionicons name="wifi-outline" size={20} color="#00d4ff" />
          <Text style={styles.testButtonText}>测试服务器</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
          <Ionicons name="close-circle-outline" size={20} color="#e0e0e0" />
          <Text style={styles.disconnectButtonText}>断开连接</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 15,
    paddingVertical: 12,
    gap: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#00d4ff',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#444',
  },
  statusDotActive: {
    backgroundColor: '#00ff88',
  },
  statusText: {
    color: '#e0e0e0',
    fontSize: 12,
  },
  encodingSelector: {
    flexDirection: 'row',
    gap: 5,
    marginHorizontal: 10,
  },
  encodingButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#2a2a3e',
    borderWidth: 1,
    borderColor: '#444',
  },
  encodingButtonActive: {
    backgroundColor: '#00d4ff',
    borderColor: '#00d4ff',
  },
  encodingText: {
    color: '#e0e0e0',
    fontSize: 10,
    fontWeight: 'bold',
  },
  encodingTextActive: {
    color: '#0a0a0f',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceText: {
    color: '#00d4ff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  logContainer: {
    flex: 1,
  },
  logContent: {
    padding: 15,
  },
  logItem: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#00d4ff',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  logTime: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
  },
  logMessage: {
    color: '#e0e0e0',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  emptyLogs: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 15,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2a2a3e',
  },
  input: {
    color: '#e0e0e0',
    fontSize: 16,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  sendButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#00d4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
    backgroundColor: '#1a1a2e',
  },
  clearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  clearButtonText: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: 'bold',
  },
  testButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#00d4ff',
  },
  testButtonText: {
    color: '#00d4ff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  disconnectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a3e',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  disconnectButtonText: {
    color: '#e0e0e0',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

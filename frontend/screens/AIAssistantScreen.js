import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  useWindowDimensions,
  ActivityIndicator
} from 'react-native';
import * as Crypto from 'expo-crypto';
import api from '../lib/api';

function AssistantIcon({ size = 16, color = '#93C5FD' }) {
  if (Platform.OS === 'web') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <path
          d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z"
          fill={color}
        />
        <path
          d="M19 16L20.2 19.8L24 21L20.2 22.2L19 26L17.8 22.2L14 21L17.8 19.8L19 16Z"
          fill={color}
          opacity="0.85"
        />
      </svg>
    );
  }
  return (
    <Text style={{ color, fontSize: size, fontWeight: '700', lineHeight: size + 2 }}>✦</Text>
  );
}

export default function AIAssistantScreen({ navigation }) {
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 768;

  // Session ID: Random UUIDv4 initialized per chat session; kept in memory only
  const [sessionId, setSessionId] = useState(() => Crypto.randomUUID());
  
  // AI Service availability state
  const [isAiAvailable, setIsAiAvailable] = useState(null); // null = checking, true/false
  const [aiStatusMessage, setAiStatusMessage] = useState('');
  const [providerSubtitle, setProviderSubtitle] = useState('Your ZettaRemit AI Assistant');

  // Conversation history in component state (never persisted to storage)
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hello! I am the ZettaRemit AI Assistant. I can answer questions about ZettaRemit transfer workflows, 3% fees, exchange rate refresh rules, KYC limits, and general remittance concepts.\n\nHow can I help you today?',
      sources: ['about_zettaremit.md']
    }
  ]);

  const [inputQuestion, setInputQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isSendHovered, setIsSendHovered] = useState(false);

  const scrollViewRef = useRef(null);

  // Check authentication and AI health on mount
  useEffect(() => {
    let isMounted = true;
    async function checkAuthAndHealth() {
      // 1. Direct route protection: Verify authenticated session
      try {
        const session = await api.session();
        if (!session || !session.token) {
          if (navigation && typeof navigation.replace === 'function') {
            navigation.replace('Login');
            return;
          }
        }
      } catch (err) {
        if (navigation && typeof navigation.replace === 'function') {
          navigation.replace('Login');
          return;
        }
      }

      // 2. Health check
      try {
        const health = await api.aiHealth();
        if (isMounted) {
          if (health && health.status === 'ok') {
            setIsAiAvailable(true);
            setAiStatusMessage('AI Assistant Online');
            setProviderSubtitle('Your ZettaRemit AI Assistant');
          } else {
            setIsAiAvailable(false);
            setAiStatusMessage('AI Assistant is currently unavailable on the backend.');
            setProviderSubtitle('Assistant Offline');
          }
        }
      } catch (err) {
        if (isMounted) {
          setIsAiAvailable(false);
          setAiStatusMessage('The AI Assistant is currently offline.');
          setProviderSubtitle('Assistant Offline');
        }
      }
    }
    checkAuthAndHealth();
    return () => { isMounted = false; };
  }, [navigation]);

  // Timer for inference feedback
  useEffect(() => {
    let timer;
    if (loading) {
      setLoadingSeconds(0);
      timer = setInterval(() => {
        setLoadingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setLoadingSeconds(0);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [loading]);

  // Scroll to bottom when messages update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, loading]);

  const handleSend = async () => {
    const trimmed = inputQuestion.trim();
    if (!trimmed || loading || isAiAvailable === false) return;

    setErrorBanner('');
    const userMessageId = `user_${Date.now()}`;
    const userMessage = {
      id: userMessageId,
      role: 'user',
      text: trimmed
    };

    const aiMessageId = `ai_${Date.now()}`;
    const initialAiMessage = {
      id: aiMessageId,
      role: 'assistant',
      text: '',
      sources: []
    };

    setMessages(prev => [...prev, userMessage, initialAiMessage]);
    setInputQuestion('');
    setLoading(true);

    let receivedStream = false;

    try {
      if (typeof api.aiAskStream === 'function') {
        await api.aiAskStream(trimmed, sessionId, {
          onSources: (srcs) => {
            setMessages(prev =>
              prev.map(m => (m.id === aiMessageId ? { ...m, sources: srcs } : m))
            );
          },
          onChunk: (chunk, fullText) => {
            receivedStream = true;
            setMessages(prev =>
              prev.map(m => (m.id === aiMessageId ? { ...m, text: fullText } : m))
            );
          },
          onDone: (result) => {
            setMessages(prev =>
              prev.map(m =>
                m.id === aiMessageId
                  ? { ...m, text: result.answer || m.text, sources: result.sources || m.sources, latency: result.latency_seconds }
                  : m
              )
            );
          }
        });
      } else {
        const response = await api.aiAsk(trimmed, sessionId);
        setMessages(prev =>
          prev.map(m =>
            m.id === aiMessageId
              ? {
                  ...m,
                  text: response.answer || 'I could not generate an answer.',
                  sources: response.sources || [],
                  latency: response.latency_seconds
                }
              : m
          )
        );
      }
    } catch (err) {
      if (!receivedStream && typeof api.aiAsk === 'function' && err.code !== 'ABORT') {
        try {
          const response = await api.aiAsk(trimmed, sessionId);
          setMessages(prev =>
            prev.map(m =>
              m.id === aiMessageId
                ? {
                    ...m,
                    text: response.answer || 'I could not generate an answer.',
                    sources: response.sources || [],
                    latency: response.latency_seconds
                  }
                : m
            )
          );
          setLoading(false);
          return;
        } catch (fallbackErr) {
          err = fallbackErr;
        }
      }

      let friendlyError = 'The request could not be completed.';
      if (err.status === 429) {
        friendlyError = 'The AI assistant is busy processing another query. Please wait a moment and retry.';
      } else if (err.status === 503) {
        friendlyError = 'The local AI service is unavailable. Please ensure the local Ollama server is running.';
      } else if (err.status === 504 || err.code === 'TIMEOUT') {
        friendlyError = 'The AI generation timed out. Local CPU inference took longer than expected. Please try a shorter question.';
      } else if (err.code === 'NETWORK') {
        friendlyError = 'Network connection to the API failed. Please verify your backend server connection.';
      } else if (err.message) {
        friendlyError = err.message;
      }
      setErrorBanner(friendlyError);
      if (!receivedStream) {
        setMessages(prev => prev.filter(m => m.id !== aiMessageId));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        role: 'assistant',
        text: 'Chat cleared. How else can I assist you with ZettaRemit?',
        sources: ['about_zettaremit.md']
      }
    ]);
    setErrorBanner('');
    // Generate a fresh session ID for the new conversation
    setSessionId(Crypto.randomUUID());
  };

  return (
    <SafeAreaView style={[styles.container, Platform.OS === 'web' && { height: '100vh', maxHeight: '100vh', overflow: 'hidden' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#001E62" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        
        {/* Top Navigation Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (navigation && typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
                navigation.goBack();
              } else if (navigation && typeof navigation.navigate === 'function') {
                navigation.navigate('Dashboard');
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>&larr; Back</Text>
          </TouchableOpacity>
          <View style={styles.topBarTitleContainer}>
            <Text style={styles.topBarTitle}>ZettaRemit AI Assistant</Text>
            <Text style={styles.topBarSubtitle}>{providerSubtitle}</Text>
          </View>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearChat}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Clear chat"
            testID="clear_chat_button"
            activeOpacity={0.8}
          >
            <Text style={[styles.clearButtonText, loading && { opacity: 0.5 }]}>Clear Chat</Text>
          </TouchableOpacity>
        </View>

        {/* Status / Error Notifications */}
        {isAiAvailable === false && (
          <View style={styles.unavailableBanner}>
            <Text style={styles.unavailableBannerText}>
              &#9888; {aiStatusMessage}
            </Text>
          </View>
        )}

        {!!errorBanner && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorBanner}</Text>
          </View>
        )}

        {/* Main Chat Container */}
        <View style={[styles.chatWrapper, isDesktop && styles.desktopChatWrapper]}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesScroll}
            contentContainerStyle={styles.messagesContainer}
            showsVerticalScrollIndicator={true}
          >
            {messages.map((msg) => (
              <View
                key={msg.id}
                testID={`msg_${msg.role}`}
                accessible={true}
                accessibilityLabel={msg.role === 'user' ? 'User message' : 'Assistant message'}
                style={[
                  styles.messageRow,
                  msg.role === 'user' ? styles.userRow : styles.assistantRow
                ]}
              >
                {msg.role === 'assistant' && (
                  <View style={styles.avatarIcon}>
                    <AssistantIcon size={15} color="#93C5FD" />
                  </View>
                )}
                <View
                  style={[
                    styles.bubble,
                    msg.role === 'user' ? styles.userBubble : styles.assistantBubble
                  ]}
                >
                  {msg.role === 'assistant' && loading && !msg.text ? (
                    <View style={styles.generatingRow}>
                      <ActivityIndicator size="small" color="#003DA5" />
                      <Text style={styles.generatingText}>Thinking...</Text>
                    </View>
                  ) : (
                    <Text
                      style={[
                        styles.messageText,
                        msg.role === 'user' ? styles.userMessageText : styles.assistantMessageText
                      ]}
                      selectable={true}
                    >
                      {msg.text}
                    </Text>
                  )}
                </View>
              </View>
            ))}

            {/* Loading Indicator when awaiting initial response */}
            {loading && (!messages.length || messages[messages.length - 1].role !== 'assistant') && (
              <View accessible={true} testID="loading_indicator" accessibilityLabel="Generating answer" style={[styles.messageRow, styles.assistantRow]}>
                <View style={styles.avatarIcon}>
                  <AssistantIcon size={15} color="#93C5FD" />
                </View>
                <View style={[styles.bubble, styles.assistantBubble, styles.loadingBubble]}>
                  <View style={styles.generatingRow}>
                    <ActivityIndicator size="small" color="#003DA5" />
                    <Text style={styles.loadingText}>
                      Generating grounded answer... ({loadingSeconds}s)
                    </Text>
                  </View>
                  {loadingSeconds > 25 && (
                    <Text style={styles.loadingSubtext}>
                      Inference in progress. Please wait.
                    </Text>
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Bottom Question Input Bar */}
          <View style={styles.inputContainer}>
            <TextInput
              testID="chat_input"
              style={[
                styles.textInput,
                Platform.OS === 'web' && { outlineStyle: 'none', outline: 'none' },
                isInputFocused && styles.textInputFocused,
                (isAiAvailable === false || loading) && styles.textInputDisabled
              ]}
              placeholder={
                isAiAvailable === false
                  ? "AI Assistant is currently offline"
                  : "Ask a question about fees, rates, limits, or transfers..."
              }
              placeholderTextColor="#94A3B8"
              value={inputQuestion}
              onChangeText={setInputQuestion}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              maxLength={1000}
              editable={!loading && isAiAvailable !== false}
              onSubmitEditing={handleSend}
              onKeyPress={(e) => {
                if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              returnKeyType="send"
              multiline={false}
            />
            {(() => {
              const isSendDisabled = !inputQuestion.trim() || loading || isAiAvailable === false;
              return (
                <TouchableOpacity
                  testID="send_button"
                  style={[
                    styles.sendButton,
                    isSendDisabled && styles.sendButtonDisabled,
                    !isSendDisabled && isSendHovered && styles.sendButtonHovered,
                    Platform.OS === 'web' && {
                      cursor: isSendDisabled ? 'not-allowed' : 'pointer'
                    }
                  ]}
                  onPress={handleSend}
                  disabled={isSendDisabled}
                  onMouseEnter={() => setIsSendHovered(true)}
                  onMouseLeave={() => setIsSendHovered(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Send question"
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.sendButtonText}>Sending</Text>
                    </View>
                  ) : (
                    <Text style={[styles.sendButtonText, isSendDisabled && styles.sendButtonTextDisabled]}>Send</Text>
                  )}
                </TouchableOpacity>
              );
            })()}
          </View>

          {/* Unobtrusive Simulation Disclosure Footer */}
          <View style={styles.simulationBanner}>
            <Text style={styles.simulationBannerText}>
              SIMULATION ONLY: ZettaRemit is an educational software simulation and does not move real money or connect to live banking rails.
            </Text>
          </View>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  topBar: {
    backgroundColor: '#001E62',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#002D80'
  },
  backButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)'
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600'
  },
  topBarTitleContainer: {
    alignItems: 'center'
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2
  },
  topBarSubtitle: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2
  },
  clearButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)'
  },
  clearButtonText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '500'
  },
  simulationBanner: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  simulationBannerText: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15
  },
  unavailableBanner: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA'
  },
  unavailableBannerText: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center'
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FCA5A5'
  },
  errorBannerText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center'
  },
  chatWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#F8FAFC'
  },
  desktopChatWrapper: {
    maxWidth: 880,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#001E62',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E2E8F0'
  },
  messagesScroll: {
    flex: 1
  },
  messagesContainer: {
    padding: 20,
    paddingBottom: 24
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 18,
    alignItems: 'flex-start'
  },
  userRow: {
    justifyContent: 'flex-end'
  },
  assistantRow: {
    justifyContent: 'flex-start'
  },
  avatarIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#001E62',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#003DA5',
    shadowColor: '#001E62',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16
  },
  userBubble: {
    backgroundColor: '#003DA5',
    borderBottomRightRadius: 4,
    shadowColor: '#003DA5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  messageText: {
    fontSize: 14.5,
    lineHeight: 22.5
  },
  userMessageText: {
    color: '#FFFFFF'
  },
  assistantMessageText: {
    color: '#0F172A'
  },
  generatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  generatingText: {
    fontSize: 13,
    color: '#003DA5',
    fontWeight: '500',
    marginLeft: 6
  },
  sourcesContainer: {
    display: 'none'
  },
  sourcePill: {
    display: 'none'
  },
  loadingBubble: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingVertical: 12
  },
  loadingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  loadingText: {
    fontSize: 13,
    color: '#003DA5',
    fontWeight: '500',
    marginLeft: 8
  },
  loadingSubtext: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 4
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 10
  },
  textInput: {
    flex: 1,
    height: 46,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 23,
    paddingHorizontal: 18,
    fontSize: 14.5,
    color: '#0F172A'
  },
  textInputFocused: {
    borderColor: '#003DA5',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5
  },
  textInputDisabled: {
    backgroundColor: '#F1F5F9',
    color: '#94A3B8'
  },
  sendButton: {
    backgroundColor: '#003DA5',
    paddingHorizontal: 20,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#003DA5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2
  },
  sendButtonHovered: {
    backgroundColor: '#002D80'
  },
  sendButtonDisabled: {
    backgroundColor: '#E2E8F0',
    shadowOpacity: 0,
    elevation: 0
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '600'
  },
  sendButtonTextDisabled: {
    color: '#94A3B8'
  }
});

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

export default function AIAssistantScreen({ navigation }) {
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 768;

  // Session ID: Random UUIDv4 initialized per chat session; kept in memory only
  const [sessionId, setSessionId] = useState(() => Crypto.randomUUID());
  
  // AI Service availability state
  const [isAiAvailable, setIsAiAvailable] = useState(null); // null = checking, true/false
  const [aiStatusMessage, setAiStatusMessage] = useState('');
  const [providerSubtitle, setProviderSubtitle] = useState('RAG Assistant');

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

  const scrollViewRef = useRef(null);

  // Check AI health on mount using existing API configuration
  useEffect(() => {
    let isMounted = true;
    async function checkHealth() {
      try {
        const health = await api.aiHealth();
        if (isMounted) {
          if (health && health.status === 'ok') {
            setIsAiAvailable(true);
            const providerName = health.provider === 'ollama_cloud' ? 'Ollama Cloud' : 'Local Ollama';
            const modelName = health.model || (health.provider === 'ollama_cloud' ? 'gemma4:31b' : 'llama3.2:3b');
            setAiStatusMessage(`AI Assistant Online (${providerName} • ${modelName})`);
            setProviderSubtitle(`${providerName} • ${modelName}`);
          } else {
            setIsAiAvailable(false);
            setAiStatusMessage('AI Assistant is currently unavailable on the backend.');
          }
        }
      } catch (err) {
        if (isMounted) {
          setIsAiAvailable(false);
          setAiStatusMessage(
            'The AI Assistant operates locally with Ollama and is unavailable in this environment.'
          );
        }
      }
    }
    checkHealth();
    return () => { isMounted = false; };
  }, []);

  // Timer for CPU generation feedback
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

    setMessages(prev => [...prev, userMessage]);
    setInputQuestion('');
    setLoading(true);

    try {
      const response = await api.aiAsk(trimmed, sessionId);
      const assistantMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        text: response.answer || 'I could not generate an answer.',
        sources: response.sources || [],
        latency: response.latency_seconds
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
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
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
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
          >
            <Text style={[styles.clearButtonText, loading && { opacity: 0.5 }]}>Clear Chat</Text>
          </TouchableOpacity>
        </View>

        {/* Simulation Disclaimer Banner */}
        <View style={styles.simulationBanner}>
          <Text style={styles.simulationBannerText}>
            <Text style={{ fontWeight: '700' }}>SIMULATION ONLY:</Text> ZettaRemit is an educational software simulation and does not move real money or connect to live banking rails.
          </Text>
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
                    <Text style={{ fontSize: 16 }}>&#129302;</Text>
                  </View>
                )}
                <View
                  style={[
                    styles.bubble,
                    msg.role === 'user' ? styles.userBubble : styles.assistantBubble
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      msg.role === 'user' ? styles.userMessageText : styles.assistantMessageText
                    ]}
                    selectable={true}
                  >
                    {msg.text}
                  </Text>

                  {/* Knowledge Base Source Citations */}
                  {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                    <View style={styles.sourcesContainer}>
                      <Text style={styles.sourcesLabel}>Sources:</Text>
                      <View style={styles.sourcePillsRow}>
                        {msg.sources.map((src, idx) => (
                          <View key={idx} style={styles.sourcePill}>
                            <Text style={styles.sourcePillText}>&#128196; {src}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              </View>
            ))}

            {/* Loading Indicator when waiting for Ollama */}
            {loading && (
              <View accessible={true} testID="loading_indicator" accessibilityLabel="Generating answer" style={[styles.messageRow, styles.assistantRow]}>
                <View style={styles.avatarIcon}>
                  <Text style={{ fontSize: 16 }}>&#129302;</Text>
                </View>
                <View style={[styles.bubble, styles.assistantBubble, styles.loadingBubble]}>
                  <ActivityIndicator size="small" color="#003DA5" />
                  <Text style={styles.loadingText}>
                    Generating grounded answer... ({loadingSeconds}s)
                  </Text>
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
              maxLength={1000}
              editable={!loading && isAiAvailable !== false}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline={false}
            />
            <TouchableOpacity
              testID="send_button"
              style={[
                styles.sendButton,
                (!inputQuestion.trim() || loading || isAiAvailable === false) && styles.sendButtonDisabled
              ]}
              onPress={handleSend}
              disabled={!inputQuestion.trim() || loading || isAiAvailable === false}
              accessibilityRole="button"
              accessibilityLabel="Send question"
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9'
  },
  topBar: {
    backgroundColor: '#001E62',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#002D80'
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#002D80'
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
    fontWeight: '700'
  },
  topBarSubtitle: {
    color: '#93C5FD',
    fontSize: 11,
    marginTop: 2
  },
  clearButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)'
  },
  clearButtonText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '500'
  },
  simulationBanner: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A'
  },
  simulationBannerText: {
    color: '#92400E',
    fontSize: 12,
    textAlign: 'center'
  },
  unavailableBanner: {
    backgroundColor: '#FEE2E2',
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
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FCA5A5'
  },
  errorBannerText: {
    color: '#B91C1C',
    fontSize: 13,
    textAlign: 'center'
  },
  chatWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  desktopChatWrapper: {
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E2E8F0'
  },
  messagesScroll: {
    flex: 1
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 24
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
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
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 4
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14
  },
  userBubble: {
    backgroundColor: '#003DA5',
    borderBottomRightRadius: 2
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 2
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21
  },
  userMessageText: {
    color: '#FFFFFF'
  },
  assistantMessageText: {
    color: '#1E293B'
  },
  sourcesContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  sourcesLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4
  },
  sourcePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  sourcePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 4,
    marginBottom: 4
  },
  sourcePillText: {
    fontSize: 11,
    color: '#334155'
  },
  loadingBubble: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingVertical: 12
  },
  loadingText: {
    fontSize: 13,
    color: '#003DA5',
    fontWeight: '500',
    marginTop: 6
  },
  loadingSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  textInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1E293B',
    marginRight: 8
  },
  textInputDisabled: {
    backgroundColor: '#F1F5F9',
    color: '#94A3B8'
  },
  sendButton: {
    backgroundColor: '#003DA5',
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendButtonDisabled: {
    backgroundColor: '#94A3B8'
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600'
  }
});

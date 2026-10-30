import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, useWindowDimensions, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator } from 'react-native';
// Session handling is centralized and never trusts stored user IDs.
import api from '../lib/api';
import { waitForBackendReadiness } from '../lib/readiness';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 768;

  const isMountedRef = useRef(true);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleLogin = async () => {
    if (loading) return;
    setError('');
    setLoading(true);
    setStatusMessage('Connecting to ZettaRemit...');

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Step 1: Check backend readiness (handles Render Free cold starts)
      const readiness = await waitForBackendReadiness({
        checkHealth: ({ timeoutMs, signal }) => api.health({ timeoutMs, signal }),
        maxWaitMs: 60000,
        pollIntervalMs: 2000,
        healthTimeoutMs: 6000,
        waitNoticeDelayMs: 2500,
        onStatusChange: (msg) => {
          if (isMountedRef.current) setStatusMessage(msg);
        },
        signal: abortController.signal,
      });

      if (!isMountedRef.current || abortController.signal.aborted) {
        return;
      }

      if (!readiness.ready) {
        setError('ZettaRemit is taking longer than expected to connect. Please try again.');
        setLoading(false);
        setStatusMessage('');
        return;
      }

      // Step 2: Backend is ready! Submit login request exactly once
      setStatusMessage('Connecting to ZettaRemit...');
      await api.login(email, password);

      if (!isMountedRef.current) return;
      setPassword('');
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (err) {
      if (!isMountedRef.current || abortController.signal.aborted) return;
      setError(err.message || 'Incorrect email or password. Please try again.');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setStatusMessage('');
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollWrapper} keyboardShouldPersistTaps="handled">
          
          <View style={[styles.layoutWrapper, isDesktop && styles.desktopRow]}>
            
            {/* LEFT BRANDING COLUMN (Only visible on computers) */}
            {isDesktop && (
              <View style={styles.desktopLeftPanel}>
                <View style={styles.brandContainer}>
                  <Image source={require('../assets/logo.png')} style={{ width: 180, height: 60, resizeMode: 'contain', marginBottom: 16 }} />
                  <Text style={styles.desktopTagline}>      ZettaRemit</Text>
                  <Text style={styles.desktopDescription}>
                  Inflow streaming ledger designed for lightning-fast cross-border clearings and real-time exchange rate matrices.
                  </Text>
                </View>
              </View>
            )}

            {/* RIGHT FORM COLUMN (Responsive for phone and computer) */}
            <View style={[styles.formColumn, isDesktop && styles.desktopRightPanel]}>
              <View style={[styles.formCard, isDesktop && styles.desktopFormCardStyle]}>
                
                {/* Mobile-only logo header */}
                {!isDesktop && <Image source={require('../assets/logo1.png')} style={{ width: 150, height: 50, resizeMode: 'contain', alignSelf: 'center', marginBottom: 32 }} />}

                <Text style={styles.mainTitle}>Welcome Back</Text>
                <Text style={styles.subTitle}>Hello there, sign in to continue</Text>

                {!!error && (
                  <View style={styles.errorContainer} accessibilityRole="alert">
                    <Text style={styles.errorText}>{error}</Text>
                    {error === 'ZettaRemit is taking longer than expected to connect. Please try again.' && (
                      <TouchableOpacity
                        style={styles.errorRetryButton}
                        onPress={handleLogin}
                        accessibilityRole="button"
                        disabled={loading}
                      >
                        <Text style={styles.errorRetryButtonText}>Retry</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {loading && !!statusMessage && (
                  <View style={styles.connectingContainer} accessibilityLiveRegion="polite">
                    <ActivityIndicator size="small" color="#0047AB" style={{ marginRight: 8 }} />
                    <Text style={styles.connectingText}>{statusMessage}</Text>
                  </View>
                )}

                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput 
                  style={styles.inputBox} 
                  placeholder="Enter your email address" 
                  placeholderTextColor="#A0AEC0"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (error) setError('');
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <Text style={styles.inputLabel}>Password</Text>
                <TextInput 
                  style={styles.inputBox} 
                  placeholder="Password" 
                  placeholderTextColor="#A0AEC0"
                  secureTextEntry
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (error) setError('');
                  }}
                />

                <TouchableOpacity style={styles.forgotBtn}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                  accessibilityRole="button"
                >
                  {loading ? (
                    <View style={styles.buttonLoadingRow}>
                      <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.primaryButtonText}>Connecting...</Text>
                    </View>
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {error === 'ZettaRemit is taking longer than expected to connect. Please try again.' ? 'Retry' : 'Login'}
                    </Text>
                  )}
                </TouchableOpacity>

                <View style={styles.signupPromptRow}>
                  <Text style={styles.promptText}>Don't have an account? </Text>
                  {/* THE FIX: Correctly maps to 'SignupWizard' instead of 'Register' */}
                  <TouchableOpacity onPress={() => navigation.navigate('SignupWizard')}>
                    <Text style={styles.promptActionText}>Create account</Text>
                  </TouchableOpacity>
                </View>

              </View>
            </View>

          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollWrapper: { flexGrow: 1 },
  layoutWrapper: { flex: 1, justifyContent: 'center' },
  desktopRow: { flexDirection: 'row' },
  
  // Left Side Desktop Branding Panel
  desktopLeftPanel: { flex: 1.2, backgroundColor: '#001E62', padding: 60, justifyContent: 'space-between' },
  brandContainer: { marginTop: 'auto', marginBottom: 'auto', maxWidth: 460 },
  desktopLogo: { color: '#FFFFFF', fontSize: 32, fontWeight: '700', marginBottom: 16 },
  desktopTagline: { color: '#f4f6f7', fontSize: 20, fontWeight: '600', marginBottom: 12 },
  desktopDescription: { color: '#A0AEC0', fontSize: 15, lineHeight: 24 },
  desktopFooterText: { color: '#4A5568', fontSize: 12 },

  // Right Side Form Wrapper
  formColumn: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  desktopRightPanel: { backgroundColor: '#F8F9FA' },
  formCard: { width: '100%', maxWidth: 400 },
  desktopFormCardStyle: { backgroundColor: '#FFFFFF', padding: 40, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10 },
  
  // Elements
  mobileLogo: { color: '#0047AB', fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 32 },
  mainTitle: { fontSize: 24, fontWeight: '700', color: '#1A202C', marginBottom: 6 },
  subTitle: { fontSize: 14, color: '#718096', marginBottom: 28 },
  errorContainer: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FEB2B2',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  errorText: {
    color: '#C53030',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorRetryButton: {
    marginTop: 8,
    alignSelf: 'center',
    backgroundColor: '#C53030',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  errorRetryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  connectingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF8FF',
    borderColor: '#BEE3F8',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  connectingText: {
    color: '#2B6CB0',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  inputLabel: { fontSize: 13, color: '#4A5568', fontWeight: '600', marginBottom: 6 },
  inputBox: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 14, fontSize: 15, backgroundColor: '#FFFFFF', marginBottom: 16, color: '#1A202C' },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 24 },
  forgotText: { color: '#0047AB', fontSize: 13, fontWeight: '500' },
  primaryButton: { backgroundColor: '#0047AB', paddingVertical: 14, borderRadius: 8, alignItems: 'center', shadowColor: '#0047AB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  primaryButtonDisabled: { opacity: 0.75 },
  buttonLoadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  signupPromptRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  promptText: { color: '#718096', fontSize: 14 },
  promptActionText: { color: '#0047AB', fontSize: 14, fontWeight: '600' }
});

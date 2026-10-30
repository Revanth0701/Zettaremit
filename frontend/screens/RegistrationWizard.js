import api from '../lib/api';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, ScrollView, Platform, useWindowDimensions, Image, Alert } from 'react-native';

export default function RegistrationWizard({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 768;

  const [emailPhone, setEmailPhone] = useState('');
  const [password, setPassword] = useState('');

  const [otp, setOtp] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [nationality, setNationality] = useState('');
  const [country, setCountry] = useState('');

  const [kycType, setKycType] = useState('PAN Card');
  const [error, setError] = useState('');

  function showAlert(title, message) {
    Alert.alert(title, message);
  }

  async function nextStep() {
    // 1. Validate Step 1
    if (currentStep === 1) {
      if (!emailPhone || !emailPhone.trim()) {
        setError("Please enter your email address.");
        return;
      }
      if (!password || password.length < 12) {
        setError("Password must be at least 12 characters.");
        return;
      }
      const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
      const byteLen = encoder ? encoder.encode(password).length : password.length;
      if (byteLen > 72 || password.length > 72) {
        setError("Password is too long. Please use 72 characters or fewer.");
        return;
      }
      setError('');
    }

    if (currentStep === 4) {
      if (!fullName || !fullName.trim()) {
        setError("Please enter your name.");
        showAlert("Missing Info", "Please enter your name.");
        return;
      }
    }

    // 2. The Final Step: Send data to MySQL
    if (currentStep === 7) {
      if (!fullName || !fullName.trim()) {
        setError("Please enter your name.");
        showAlert("Missing Info", "Please enter your name.");
        return;
      }
      if (loading) return;
      setLoading(true);
      try {
        await api.register({full_name: fullName.trim(), email: emailPhone.trim().toLowerCase(), password});
        setPassword('');
        setCurrentStep(8);
      } catch (err) {
        setError(err.message);
        showAlert('Registration failed', err.message);
      }
      finally { setLoading(false); }
      return;
    }

    // 3. Normal Step Navigation (Only runs if NOT step 7)
    if (currentStep === 8) {
      navigation.navigate('Login');
    } else {
      setCurrentStep(currentStep + 1);
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  }

  function getProgressWidth() {
    return (currentStep / 8) * 100 + '%';
  }

  function getHeaderTitle() {
    if (currentStep <= 5) {
      return "Create your account";
    }
    if (currentStep <= 7) {
      return "Verify your profile";
    }
    return "Account created";
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>

        <View style={[styles.layoutWrapper, isDesktop && styles.desktopRow]}>

          {isDesktop && (
            <View style={styles.desktopLeftPanel}>
              <View style={styles.brandContainer}>
                <Image source={require('../assets/logo.png')} style={styles.desktopLogoImage} />
                <Text style={styles.desktopTagline}>      ZettaRemit</Text>
                <Text style={styles.desktopDescription}>
                  Fast, transparent cross-border transfers from India to the USA.
                </Text>
              </View>
            </View>
          )}

          <View style={[styles.formColumn, isDesktop && styles.desktopRightPanel]}>
            <View style={[styles.formCard, isDesktop && styles.desktopFormCardStyle]}>

              <View style={styles.navBar}>
                {currentStep < 8 ? (
                  <TouchableOpacity onPress={prevStep} style={styles.backButton}>
                    <Text style={styles.backArrow}>←</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.placeholderSide} />
                )}
                <Text style={styles.navTitle}>{getHeaderTitle()}</Text>
                <View style={styles.placeholderSide} />
              </View>

              <View style={styles.progressTrackBar}>
                <View style={[styles.progressActiveFill, { width: getProgressWidth() }]} />
              </View>

              <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true}>
                <View style={styles.formContent}>

                  {currentStep === 1 && (
                    <View>
                      <Text style={styles.mainTitle}>Create your account</Text>
                      <Text style={styles.subLabelText}>Enter your email address to set up your account.</Text>

                      {!!error && (
                        <View style={styles.inlineErrorContainer} accessibilityRole="alert">
                          <Text style={styles.inlineErrorText}>{error}</Text>
                        </View>
                      )}

                      <TextInput
                        style={styles.formInputBox}
                        placeholder="Enter your email address"
                        placeholderTextColor="#A0AEC0"
                        value={emailPhone}
                        onChangeText={(val) => {
                          setEmailPhone(val);
                          if (error) setError('');
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />

                      <TextInput
                        style={styles.formInputBox}
                        placeholder="Enter your password"
                        placeholderTextColor="#A0AEC0"
                        value={password}
                        onChangeText={(val) => {
                          setPassword(val);
                          if (error) setError('');
                        }}
                        secureTextEntry
                      />
                    </View>
                  )}

                  {currentStep === 2 && (
                    <View>
                      <Text style={styles.mainTitle}>OTP Verification (Simulated)</Text>
                      <Text style={styles.subLabelText}>Simulation mode: No SMS is delivered. Enter any 6-digit test code (e.g. 123456) to proceed.</Text>

                      <View style={styles.otpGridWrapper}>
                        <View style={[styles.otpDisplayCell, otp.length === 0 && styles.otpDisplayCellActive]}><Text style={styles.otpCellText}>{otp[0] || ''}</Text></View>
                        <View style={[styles.otpDisplayCell, otp.length === 1 && styles.otpDisplayCellActive]}><Text style={styles.otpCellText}>{otp[1] || ''}</Text></View>
                        <View style={[styles.otpDisplayCell, otp.length === 2 && styles.otpDisplayCellActive]}><Text style={styles.otpCellText}>{otp[2] || ''}</Text></View>
                        <View style={[styles.otpDisplayCell, otp.length === 3 && styles.otpDisplayCellActive]}><Text style={styles.otpCellText}>{otp[3] || ''}</Text></View>
                        <View style={[styles.otpDisplayCell, otp.length === 4 && styles.otpDisplayCellActive]}><Text style={styles.otpCellText}>{otp[4] || ''}</Text></View>
                        <View style={[styles.otpDisplayCell, otp.length === 5 && styles.otpDisplayCellActive]}><Text style={styles.otpCellText}>{otp[5] || ''}</Text></View>
                      </View>

                      <TextInput
                        style={styles.hiddenInputOverlay}
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otp}
                        onChangeText={setOtp}
                        autoFocus={true}
                      />
                    </View>
                  )}

                  {currentStep === 3 && (
                    <View>
                      <Text style={styles.mainTitle}>Home address</Text>
                      <Text style={styles.subLabelText}>Please provide your primary residential billing location</Text>
                      <TextInput style={styles.formInputBox} placeholder="Street Address" placeholderTextColor="#A0AEC0" value={street} onChangeText={setStreet} />
                      <TextInput style={styles.formInputBox} placeholder="City" placeholderTextColor="#A0AEC0" value={city} onChangeText={setCity} />
                      <TextInput style={styles.formInputBox} placeholder="Postal Code" placeholderTextColor="#A0AEC0" value={postalCode} onChangeText={setPostalCode} keyboardType="number-pad" />
                    </View>
                  )}

                  {currentStep === 4 && (
                    <View>
                      <Text style={styles.mainTitle}>Add your personal info</Text>
                      <Text style={styles.subLabelText}>Ensure this matches your legal identity documents exactly</Text>
                      {!!error && (
                        <View style={{ backgroundColor: '#FED7D7', borderWidth: 1, borderColor: '#FEB2B2', borderRadius: 8, padding: 12, marginBottom: 16 }} accessibilityRole="alert">
                          <Text style={{ color: '#C53030', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>{error}</Text>
                        </View>
                      )}
                      <TextInput style={styles.formInputBox} placeholder="Full Legal Name" placeholderTextColor="#A0AEC0" value={fullName} onChangeText={setFullName} />
                      <TextInput style={styles.formInputBox} placeholder="Date of Birth (DD/MM/YYYY)" placeholderTextColor="#A0AEC0" value={dob} onChangeText={setDob} />
                      <TextInput style={styles.formInputBox} placeholder="Nationality" placeholderTextColor="#A0AEC0" value={nationality} onChangeText={setNationality} />
                    </View>
                  )}

                  {currentStep === 5 && (
                    <View>
                      <Text style={styles.mainTitle}>Country of residence</Text>
                      <Text style={styles.subLabelText}>Select the primary economic country you reside in</Text>
                      <TextInput style={styles.formInputBox} placeholder="Select Country" placeholderTextColor="#A0AEC0" value={country} onChangeText={setCountry} />
                    </View>
                  )}

                  {currentStep === 6 && (
                    <View style={styles.alignItemsCenter}>
                      <Text style={styles.illustrationPlaceholder}>🧑‍💻</Text>
                      <Text style={styles.mainTitleCenter}>Select document type (Simulated Demo)</Text>

                      <View style={styles.kycOptionsWrapper}>
                        <TouchableOpacity style={[styles.documentItemRow, kycType === 'PAN Card' && styles.documentItemRowActive]} onPress={() => setKycType('PAN Card')} activeOpacity={0.8}>
                          <Text style={styles.docItemText}>💳 PAN Card</Text>
                          <Text style={styles.docStatusDot}>{kycType === 'PAN Card' ? '🟢' : '⚪'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.documentItemRow, kycType === 'Aadhar Card' && styles.documentItemRowActive]} onPress={() => setKycType('Aadhar Card')} activeOpacity={0.8}>
                          <Text style={styles.docItemText}>🏛️ Aadhar Card</Text>
                          <Text style={styles.docStatusDot}>{kycType === 'Aadhar Card' ? '🟢' : '⚪'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.documentItemRow, kycType === 'Passport' && styles.documentItemRowActive]} onPress={() => setKycType('Passport')} activeOpacity={0.8}>
                          <Text style={styles.docItemText}>🛂 Passport</Text>
                          <Text style={styles.docStatusDot}>{kycType === 'Passport' ? '🟢' : '⚪'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.documentItemRow, kycType === 'Visa' && styles.documentItemRowActive]} onPress={() => setKycType('Visa')} activeOpacity={0.8}>
                          <Text style={styles.docItemText}>📄 Visa</Text>
                          <Text style={styles.docStatusDot}>{kycType === 'Visa' ? '🟢' : '⚪'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {currentStep === 7 && (
                    <View>
                      <Text style={styles.mainTitle}>{kycType} (Simulation)</Text>
                      <Text style={styles.subLabelText}>Demo mode: Do not enter real government document numbers. Real identity documents are not collected, verified, or stored in simulation mode.</Text>

                      <View style={[styles.formInputBox, { backgroundColor: '#F8FAFC', justifyContent: 'center', borderColor: '#CBD5E1', paddingVertical: 14 }]}>
                        <Text style={{ color: '#4A5568', fontSize: 14, fontWeight: '600' }}>
                          Assigned Test ID: {kycType === 'Aadhar Card' ? 'DEMO-9999-8888-7777' : kycType === 'PAN Card' ? 'DEMO-ABCDE1234F' : 'DEMO-PASS-0001'} (Simulated)
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: '#718096', marginTop: -6, marginBottom: 16 }}>
                        No government ID numbers are collected or stored.
                      </Text>

                      <TouchableOpacity style={styles.uploadBoxPlaceholder}>
                        <Text style={styles.uploadBoxIcon}>📤</Text>
                        <Text style={styles.uploadBoxText}>Photo upload (Optional / Disabled in simulation)</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {currentStep === 8 && (
                    <View style={{alignItems: 'center', paddingVertical: 40}}>
                      <Text style={{fontSize: 70, marginBottom: 24}}>✅</Text>
                      <Text style={{fontSize: 24, fontWeight: '700', color: '#1A202C', marginBottom: 12}}>Account Created</Text>
                      <Text style={{fontSize: 15, color: '#718096', textAlign: 'center', lineHeight: 22}}>
                        Your profile has been created successfully in simulation mode. You are now ready to explore transfers.
                      </Text>
                    </View>
                  )}

                </View>

                <View style={styles.footerContainer}>
                  <TouchableOpacity style={styles.primaryActionButton} activeOpacity={0.9} onPress={nextStep} disabled={loading} accessibilityRole="button">
                    <Text style={styles.primaryActionButtonText}>
                      {
                        currentStep === 6 ? "Select & Continue" :
                        currentStep === 7 ? "Complete Demo Setup" :
                        currentStep === 8 ? "Continue to Login" :
                        "Continue"
                      }
                    </Text>
                  </TouchableOpacity>
                </View>

              </ScrollView>
            </View>
          </View>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', height: Platform.OS === 'web' ? '100vh' : '100%' },
  layoutWrapper: { flex: 1, justifyContent: 'center' },
  desktopRow: { flexDirection: 'row' },

  desktopLeftPanel: { flex: 1.2, backgroundColor: '#001E62', padding: 60, justifyContent: 'space-between' },
  brandContainer: { marginTop: 'auto', marginBottom: 'auto', maxWidth: 460 },
  desktopLogoImage: { width: 180, height: 60, resizeMode: 'contain', marginBottom: 16 },
  desktopTagline: { color: '#fdfeff', fontSize: 20, fontWeight: '600', marginBottom: 12 },
  desktopDescription: { color: '#A0AEC0', fontSize: 15, lineHeight: 24 },

  formColumn: { flex: 1, justifyContent: 'center' },
  desktopRightPanel: { backgroundColor: '#F8F9FA', alignItems: 'center', justifyContent: 'center', padding: 24 },

  formCard: { flex: 1, width: '100%', maxWidth: 480, maxHeight: 700 },
  desktopFormCardStyle: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10, overflow: 'hidden' },

  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 50, paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  backArrow: { fontSize: 24, color: '#000000', fontWeight: '600' },
  navTitle: { fontSize: 15, fontWeight: '600', color: '#1A202C' },
  placeholderSide: { width: 40 },
  progressTrackBar: { height: 3, width: '100%', backgroundColor: '#EDF2F7' },
  progressActiveFill: { height: '100%', backgroundColor: '#38A169' },

  scrollContainer: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24, backgroundColor: '#FFFFFF' },
  formContent: { marginTop: 20 },

  mainTitle: { fontSize: 22, fontWeight: '700', color: '#000000', marginBottom: 6 },

  mainTitleCenter: { fontSize: 18, fontWeight: '700', color: '#000000', textAlign: 'center', marginBottom: 16, paddingHorizontal: 10 },
  illustrationPlaceholder: { fontSize: 50, marginVertical: 10 },

  subLabelText: { fontSize: 14, color: '#718096', marginBottom: 20, lineHeight: 20 },

  inlineErrorContainer: { backgroundColor: '#FED7D7', borderWidth: 1, borderColor: '#FEB2B2', borderRadius: 8, padding: 12, marginBottom: 16 },
  inlineErrorText: { color: '#C53030', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  formInputBox: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, fontSize: 16, color: '#000000', backgroundColor: '#F8F9FA', marginBottom: 12 },

  otpGridWrapper: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 10 },
  otpDisplayCell: { width: 45, height: 55, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
  otpDisplayCellActive: { borderColor: '#0052CC', borderWidth: 2 },
  otpCellText: { fontSize: 22, fontWeight: '600', color: '#000000' },
  hiddenInputOverlay: { position: 'absolute', width: '100%', height: 70, opacity: 0 },
  alignItemsCenter: { alignItems: 'center' },

  kycOptionsWrapper: { width: '100%', gap: 10 },

  documentItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderWidth: 1, borderColor: '#E2E8F0', padding: 12, borderRadius: 10, backgroundColor: '#FAFAFA', marginBottom: 10 },
  documentItemRowActive: { borderColor: '#0047AB', backgroundColor: '#F0F4F8' },
  docItemText: { fontSize: 15, fontWeight: '600', color: '#1A202C' },
  docStatusDot: { fontSize: 14 },

  uploadBoxPlaceholder: { borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 10, height: 120, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA', marginTop: 10 },
  uploadBoxIcon: { fontSize: 32, marginBottom: 8 },
  uploadBoxText: { fontSize: 14, color: '#718096', fontWeight: '500' },

  footerContainer: { marginTop: 20, marginBottom: 10 },
  primaryActionButton: { backgroundColor: '#0047AB', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  primaryActionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' }
});

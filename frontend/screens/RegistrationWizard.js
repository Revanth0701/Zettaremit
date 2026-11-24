import api from '../lib/api';
import { FieldLabel, PasswordField, FormIcon } from '../components/FormFields';
import CountrySelect from '../components/CountrySelect';
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, ScrollView, Platform, useWindowDimensions, Image, Alert } from 'react-native';

export default function RegistrationWizard({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 768;

  const [emailPhone, setEmailPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [otpDigits, setOtpDigits] = useState(() => Array(6).fill(''));
  const otp = otpDigits.join('');
  const otpInputs = useRef([]);
  const [activeOtpIndex, setActiveOtpIndex] = useState(null);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [nationality, setNationality] = useState('');
  const [country, setCountry] = useState('');

  const [kycType, setKycType] = useState('PAN Card');
  const [error, setError] = useState('');
  const [registrationConflict, setRegistrationConflict] = useState(false);

  function focusOtp(index) {
    otpInputs.current[index]?.focus();
  }

  function changeOtp(index, text) {
    const digits = text.replace(/[^0-9]/g, '');
    if (text && !digits) return;
    // Full-code paste/autofill replaces the code even when another box is focused.
    const start = digits.length === 6 ? 0 : index;
    setOtpDigits(previous => {
      const next = [...previous];
      if (!digits) next[index] = '';
      else digits.slice(0, 6 - start).split('').forEach((digit, offset) => {
        next[start + offset] = digit;
      });
      return next;
    });
    if (digits) focusOtp(Math.min(start + digits.length, 5));
  }

  function selectOtpDigit(index, event) {
    const { selection, text = otpDigits[index] } = event.nativeEvent;
    // A populated box edits one whole digit, even when clicked again while focused.
    if (text.length !== 1 || (selection.start === 0 && selection.end === 1)) return;
    const input = otpInputs.current[index];
    if (Platform.OS === 'web') input?.setSelectionRange(0, 1);
    else input?.setNativeProps({ selection: { start: 0, end: 1 } });
  }

  function handleOtpKey(index, event) {
    const key = event.nativeEvent.key;
    if (key === 'Backspace' && !otpDigits[index] && index > 0) {
      event.preventDefault?.();
      setOtpDigits(previous => previous.map((digit, position) => position === index - 1 ? '' : digit));
      focusOtp(index - 1);
    } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault?.();
      focusOtp(Math.max(0, Math.min(5, index + (key === 'ArrowLeft' ? -1 : 1))));
    }
  }

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
      if (password !== confirmPassword) { setError('Passwords do not match. Re-enter your confirm password.'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPhone.trim())) { setError('Enter a valid email address.'); return; }
      setError('');
    }

    if (currentStep === 2 && !/^\d{6}$/.test(otp)) { setError('Enter a 6-digit test code.'); return; }
    setError('');

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
      setRegistrationConflict(false);
      try {
        await api.register({full_name: fullName.trim(), email: emailPhone.trim().toLowerCase(), password});
        setPassword('');
        setConfirmPassword('');
        setCurrentStep(8);
      } catch (err) {
        setError(err.message || 'Unable to create your account right now. Please try again.');
        setRegistrationConflict(err.status === 409);
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
                  {currentStep !== 1 && currentStep !== 4 && !!error && (
                    <View style={styles.inlineErrorContainer} accessibilityRole="alert">
                      <Text style={styles.inlineErrorText}>{error}</Text>
                      {registrationConflict && (
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Sign in to existing account" onPress={() => navigation.navigate('Login')} style={{ paddingVertical: 12, alignItems: 'center' }}>
                          <Text style={{ color: '#0047AB', fontWeight: '600' }}>Sign in</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {currentStep === 1 && (
                    <View>
                      <Text style={styles.mainTitle}>Create your account</Text>
                      <Text style={styles.subLabelText}>Enter your email address to set up your account.</Text>

                      {!!error && (
                        <View style={styles.inlineErrorContainer} accessibilityRole="alert">
                          <Text style={styles.inlineErrorText}>{error}</Text>
                        </View>
                      )}

                      <FieldLabel required>Email Address</FieldLabel>
                      {/* RN Web filters name props; web-only refs set stable DOM names. */}
                      <TextInput
                        {...(Platform.OS === 'web' ? { name: 'email', ref: input => input?.setAttribute('name', 'email'), autoComplete: 'username' } : {})}
                        accessibilityLabel="Email Address" aria-required={true}
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

                      <PasswordField aria-invalid={!!error && /password/i.test(error)}
                        {...(Platform.OS === 'web' ? { name: 'new-password', ref: input => input?.setAttribute('name', 'new-password'), autoComplete: 'new-password' } : {})}
                        style={styles.formInputBox}
                        placeholder="Enter your password"
                        placeholderTextColor="#A0AEC0"
                        value={password}
                        onChangeText={(val) => {
                          setPassword(val);
                          if (error) setError('');
                        }}
                      />
                      <PasswordField aria-invalid={!!error && /password/i.test(error)} {...(Platform.OS === 'web' ? { name: 'confirm-password', ref: input => input?.setAttribute('name', 'confirm-password'), autoComplete: 'new-password' } : {})} label="Confirm Password" style={styles.formInputBox} placeholder="Re-enter your password" value={confirmPassword} onChangeText={value => { setConfirmPassword(value); setError(''); }} />
                    </View>
                  )}

                  {currentStep === 2 && (
                    <View>
                      <Text style={styles.mainTitle}>Verify your email</Text>
                      <Text style={styles.subLabelText}>No email or SMS is sent. Enter any 6-digit test code to continue.</Text>

                      <FieldLabel required>Test verification code</FieldLabel>
                      <View style={styles.otpGridWrapper}>
                        {otpDigits.map((digit, index) => (
                          <TextInput
                            key={index}
                            ref={input => { otpInputs.current[index] = input; }}
                            accessibilityLabel={`Test verification code digit ${index + 1} of 6`}
                            aria-required={true}
                            style={[
                              styles.otpDisplayCell,
                              styles.otpCellText,
                              { textAlign: 'center', padding: 0 },
                              Platform.OS === 'web' && { outlineStyle: 'none' },
                              activeOtpIndex === index && styles.otpDisplayCellActive,
                            ]}
                            keyboardType="number-pad"
                            inputMode="numeric"
                            autoComplete={index === 0 ? 'one-time-code' : 'off'}
                            autoCorrect={false}
                            maxLength={6}
                            selectTextOnFocus
                            autoFocus={index === 0}
                            value={digit}
                            onChangeText={text => changeOtp(index, text)}
                            onFocus={() => setActiveOtpIndex(index)}
                            onBlur={() => setActiveOtpIndex(active => active === index ? null : active)}
                            onKeyPress={event => handleOtpKey(index, event)}
                            onSelectionChange={event => selectOtpDigit(index, event)}
                          />
                        ))}
                      </View>
                    </View>
                  )}

                  {currentStep === 3 && (
                    <View>
                      <Text style={styles.mainTitle}>Home address</Text>
                      <Text style={styles.subLabelText}>Please provide your primary residential billing location</Text>
                      <FieldLabel>Street Address (optional)</FieldLabel>
                      <TextInput accessibilityLabel="Street Address" aria-required={false} style={styles.formInputBox} placeholder="Street Address" placeholderTextColor="#A0AEC0" value={street} onChangeText={setStreet} />
                      <FieldLabel>City (optional)</FieldLabel>
                      <TextInput accessibilityLabel="City" aria-required={false} style={styles.formInputBox} placeholder="City" placeholderTextColor="#A0AEC0" value={city} onChangeText={setCity} />
                      <FieldLabel>Postal Code (optional)</FieldLabel>
                      <TextInput accessibilityLabel="Postal Code" aria-required={false} style={styles.formInputBox} placeholder="Postal Code" placeholderTextColor="#A0AEC0" value={postalCode} onChangeText={setPostalCode} keyboardType="number-pad" />
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
                      <FieldLabel required>Full Legal Name</FieldLabel>
                      <TextInput accessibilityLabel="Full Legal Name" aria-required={true} style={styles.formInputBox} placeholder="Full Legal Name" placeholderTextColor="#A0AEC0" value={fullName} onChangeText={setFullName} />
                      <FieldLabel>Date of Birth (DD/MM/YYYY) (optional)</FieldLabel>
                      <TextInput accessibilityLabel="Date of Birth (DD/MM/YYYY)" aria-required={false} style={styles.formInputBox} placeholder="Date of Birth (DD/MM/YYYY)" placeholderTextColor="#A0AEC0" value={dob} onChangeText={setDob} />
                      <FieldLabel>Nationality (optional)</FieldLabel>
                      <TextInput accessibilityLabel="Nationality" aria-required={false} style={styles.formInputBox} placeholder="Nationality" placeholderTextColor="#A0AEC0" value={nationality} onChangeText={setNationality} />
                    </View>
                  )}

                  {currentStep === 5 && (
                    <View>
                      <Text style={styles.mainTitle}>Country of residence</Text>
                      <Text style={styles.subLabelText}>Select the primary economic country you reside in</Text>
                      <CountrySelect value={country} onChange={setCountry} />
                    </View>
                  )}

                  {currentStep === 6 && (
                    <View>
                      <Text style={styles.mainTitle}>Choose an identity document</Text>
                      <Text style={styles.subLabelText}>Profile verification is simulated. No real identity check is performed. Real identity documents are not collected, verified, or stored in simulation mode.</Text>
                      <FieldLabel required>Document type</FieldLabel>
                      <View style={styles.kycOptionsWrapper}>
                        {['PAN Card', 'Aadhar Card', 'Passport', 'Visa'].map(document => (
                          <TouchableOpacity key={document} accessibilityRole="radio" accessibilityLabel={document === 'Aadhar Card' ? 'Aadhaar Card' : document} aria-checked={kycType === document} accessibilityState={{ checked: kycType === document }} style={[styles.documentItemRow, kycType === document && styles.documentItemRowActive]} onPress={() => setKycType(document)}>
                            <FormIcon />
                            <View style={{ flex: 1, marginHorizontal: 14 }}>
                              <Text style={styles.docItemText}>{document === 'Aadhar Card' ? 'Aadhaar Card' : document}</Text>
                              <Text style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>Use an assigned test identifier</Text>
                            </View>
                            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: kycType === document ? '#0047AB' : '#CBD5E0', alignItems: 'center', justifyContent: 'center' }}>{kycType === document && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#0047AB' }}/>}</View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {currentStep === 7 && (
                    <View>
                      <Text style={styles.mainTitle}>{kycType} (Simulation)</Text>
                      <Text style={styles.subLabelText}>Use the assigned test identifier below. No real documents are collected or verified.</Text>

                      <View style={[styles.formInputBox, { backgroundColor: '#F8FAFC', justifyContent: 'center', borderColor: '#CBD5E1', paddingVertical: 14 }]}>
                        <Text style={{ color: '#4A5568', fontSize: 14, fontWeight: '600' }}>
                          Assigned Test ID: {kycType === 'Aadhar Card' ? 'DEMO-9999-8888-7777' : kycType === 'PAN Card' ? 'DEMO-ABCDE1234F' : 'DEMO-PASS-0001'} (Simulated)
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: '#718096', marginTop: -6, marginBottom: 16 }}>
                        No government ID numbers are collected or stored.
                      </Text>

                      <TouchableOpacity disabled accessibilityState={{ disabled: true }} style={styles.uploadBoxPlaceholder}>
                        <FormIcon />
                        <Text style={styles.uploadBoxText}>Photo upload (Optional / Disabled in simulation)</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {currentStep === 8 && (
                    <View style={{alignItems: 'center', paddingVertical: 40}}>
                      <Text style={{fontSize: 70, marginBottom: 24}}>✅</Text>
                      <Text style={{fontSize: 24, fontWeight: '700', color: '#1A202C', marginBottom: 12}}>Account Created</Text>
                      <Text style={{fontSize: 15, color: '#718096', textAlign: 'center', lineHeight: 22}}>
                        Your account is ready. Sign in to explore transfers.
                      </Text>
                    </View>
                  )}

                </View>

                <View style={styles.footerContainer}>
                  <TouchableOpacity style={styles.primaryActionButton} activeOpacity={0.9} onPress={nextStep} disabled={loading} accessibilityRole="button">
                    <Text style={styles.primaryActionButtonText}>
                      {
                        currentStep === 6 ? "Select & Continue" :
                        currentStep === 7 ? (error && !registrationConflict ? "Retry registration" : "Create account") :
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

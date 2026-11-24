import React, { useCallback, useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Import screen files
import SplashScreen from './screens/SplashScreen';
import HomeScreen from './screens/HomeScreen';
import HowItWorksScreen from './screens/HowItWorksScreen';
import RatesAndFeesScreen from './screens/RatesAndFeesScreen';
import AboutScreen from './screens/AboutScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import LoginScreen from './screens/LoginScreen';
import RegistrationWizard from './screens/RegistrationWizard';
import DashboardScreen from './screens/DashboardScreen';
import AIAssistantScreen from './screens/AIAssistantScreen';

import api, { onUnauthorized } from './lib/api';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';
import { isWebRefresh, readNavigation, saveNavigation } from './lib/navigationState';
const routeStorage = () => { try { return Platform.OS === 'web' ? window.sessionStorage : null; } catch (_) { return null; } };
const navigationRef = createNavigationContainerRef();

const Stack = createStackNavigator();

export default function App() {
  const [freshLaunch] = useState(() => Platform.OS !== 'web' || !isWebRefresh(typeof window === 'undefined' ? null : window.performance));
  const [splashFinished, setSplashFinished] = useState(false);
  const finishSplash = useCallback(() => setSplashFinished(true), []);
  const [initialState, setInitialState] = useState(null);
  const [restoreError, setRestoreError] = useState('');
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setRestoreError('');
    (async () => {
      try {
        const session = await api.session();
        // Reuse an existing read-only authenticated endpoint to validate the bearer token.
        if (session) await api.history();
        if (!active) return;
        setInitialState({ index: 0, routes: [readNavigation(routeStorage(), !!session, Platform.OS)] });
      } catch (error) {
        if (!active) return;
        if (error.status === 401 || error.message === 'Please sign in again.') setInitialState({ index: 0, routes: [{ name: 'Login' }] });
        else setRestoreError('Unable to restore your session. Check your connection and retry.');
      }
    })();
    return () => { active = false; };
  }, [restoreAttempt]);
  useEffect(() => {
    // Non-blocking wake-up for Render Free upon app boot
    try {
      if (typeof api.wakeBackend === 'function') {
        api.wakeBackend();
      }
    } catch (_) {}

    return onUnauthorized(() => {
      saveNavigation(routeStorage(), { index: 0, routes: [{ name: 'Login' }] });
      if (navigationRef.isReady()) navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
    });
  }, []);

  // Auth validation runs alongside the brief splash; never expose a public page in between.
  if (freshLaunch && (!splashFinished || (!initialState && !restoreError))) return <SplashScreen onFinish={finishSplash} />;
  if (!initialState) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA' }}><ActivityIndicator accessibilityLabel="Restoring session" color="#0047AB"/><Text style={{ marginTop: 12 }}>Loading ZettaRemit...</Text>{!!restoreError && <><Text accessibilityRole="alert" style={{ padding: 16 }}>{restoreError}</Text><TouchableOpacity accessibilityRole="button" onPress={() => setRestoreAttempt(value => value + 1)} style={{ padding: 16 }}><Text>Retry</Text></TouchableOpacity></>}</View>;
  return (
    <NavigationContainer ref={navigationRef} initialState={initialState} onStateChange={state => saveNavigation(routeStorage(), state)}>
      <Stack.Navigator initialRouteName={Platform.OS === 'web' ? 'Home' : 'Welcome'} screenOptions={{ headerShown: false, cardStyle: { flex: 1, overflow: 'hidden' } }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="HowItWorks" component={HowItWorksScreen} />
        <Stack.Screen name="RatesAndFees" component={RatesAndFeesScreen} />
        <Stack.Screen name="About" component={AboutScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignupWizard" component={RegistrationWizard} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="AIAssistant" component={AIAssistantScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

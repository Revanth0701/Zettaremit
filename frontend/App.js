import React, { useEffect } from 'react';
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
const navigationRef = createNavigationContainerRef();

const Stack = createStackNavigator();

export default function App() {
  useEffect(() => {
    // Non-blocking wake-up for Render Free upon app boot
    try {
      if (typeof api.wakeBackend === 'function') {
        api.wakeBackend();
      }
    } catch (_) {}

    return onUnauthorized(() => {
      if (navigationRef.isReady()) navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
    });
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      {/* initialRouteName forces the app to boot up on the Splash screen */}
      <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false, cardStyle: { flex: 1, overflow: 'hidden' } }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
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

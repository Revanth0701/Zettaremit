import React, { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Import all your screen files
import SplashScreen from './screens/SplashScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import LoginScreen from './screens/LoginScreen';
import RegistrationWizard from './screens/RegistrationWizard';
import DashboardScreen from './screens/DashboardScreen';
import AIAssistantScreen from './screens/AIAssistantScreen';

import { onUnauthorized } from './lib/api';
const navigationRef = createNavigationContainerRef();

const Stack = createStackNavigator();

export default function App() {
  useEffect(() => onUnauthorized(() => {
    if (navigationRef.isReady()) navigationRef.reset({ index:0, routes:[{ name:'Login' }] });
  }), []);
  return (
    <NavigationContainer ref={navigationRef}>
      {/* initialRouteName forces the app to boot up on the Splash screen */}
      <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false, cardStyle: { flex: 1, overflow: 'hidden' } }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignupWizard" component={RegistrationWizard} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="AIAssistant" component={AIAssistantScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
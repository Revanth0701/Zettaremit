import React, { useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, StatusBar, Image } from 'react-native';
import api from '../lib/api';

export default function SplashScreen({ navigation }) {
  
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const sess = await api.session();
        if (active) {
          if (sess && sess.token) {
            navigation.replace('Dashboard');
          } else {
            navigation.replace('Home');
          }
        }
      } catch (_) {
        if (active) navigation.replace('Home');
      }
    }, 2500);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#003D99" />
      
      <View style={styles.content}>
        {/* This Image component pulls your exact logo file from the assets folder */}
        <Image 
          source={require('../assets/logo.png')} 
          style={styles.logoImage}
          resizeMode="contain"
        />
        
        <Text style={styles.brandText}>ZettaRemit</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    // This matches the deep blue from your screenshot
    backgroundColor: '#001E62', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  content: {
    alignItems: 'center',
  },
  logoImage: {
    width: 100,  // Adjust these numbers if the logo looks too big or too small
    height: 100,
    marginBottom: 16,
  },
  brandText: { 
    fontSize: 28, 
    fontWeight: '600', 
    color: '#FFFFFF',
    letterSpacing: 0.5,
  }
});

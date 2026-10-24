import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Image, useWindowDimensions } from 'react-native';

export default function WelcomeScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isSmall = width < 400;

  return (
    <SafeAreaView style={styles.container}>
      
      {/* Top Half: Logo and Text */}
      <View style={styles.contentWrapper}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/logo.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.headline, isSmall && styles.headlineSmall]}>ZettaRemit</Text>
          <Text style={[styles.headline, isSmall && styles.headlineSmall]}>   </Text>
          <Text style={[styles.headline, isSmall && styles.headlineSmall]}>Effortless Transfers,</Text>
          <Text style={[styles.headline, isSmall && styles.headlineSmall]}>Boundless Connections.</Text>
          <Text style={styles.subheading}>
            Quick, reliable money transfers between the U.S. and India, designed for students and families
          </Text>
        </View>
      </View>

      {/* Bottom Half: Buttons and Footer */}
      <View style={styles.bottomInterface}>
        <TouchableOpacity 
          style={styles.primaryButton} 
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.primaryButtonText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.secondaryButton} 
          activeOpacity={0.85}
          onPress={() => navigation.navigate('SignupWizard')}
        >
          <Text style={styles.secondaryButtonText}>Sign-up</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          By continuing you accept our{'\n'}
          <Text style={styles.linkText}>Terms of service</Text> and <Text style={styles.linkText}>Privacy Policy</Text>
        </Text>
      </View>
      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#001E62', 
    justifyContent: 'space-between', 
    paddingHorizontal: 24 
  },
  contentWrapper: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 40 
  },
  logoContainer: { 
    marginBottom: 40, 
    alignItems: 'center' 
  },
  logoImage: { 
    width: 160, 
    height: 160 
  },
  textContainer: { 
    alignItems: 'center' 
  },
  headline: { 
    fontSize: 26, 
    fontWeight: '700', 
    color: '#fcf8f8', 
    textAlign: 'center', 
    lineHeight: 34 
  },
  headlineSmall: {
    fontSize: 22,
    lineHeight: 30
  },
  subheading: { 
    fontSize: 14, 
    color: '#627D98', 
    textAlign: 'center', 
    marginTop: 16, 
    lineHeight: 22, 
    paddingHorizontal: 10 
  },
  bottomInterface: { 
    width: '100%', 
    maxWidth: 320, // <--- THIS FIXES THE WIDE BUTTONS
    alignSelf: 'center', // <--- KEEPS THEM CENTERED ON DESKTOP
    marginBottom: 40, 
    gap: 16 
  },
  primaryButton: { 
    backgroundColor: '#0047AB', 
    paddingVertical: 16, 
    borderRadius: 8, 
    alignItems: 'center' 
  },
  primaryButtonText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: '600' 
  },
  secondaryButton: { 
    backgroundColor: '#FFFFFF', 
    paddingVertical: 16, 
    borderRadius: 8, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#0047AB' 
  },
  secondaryButtonText: { 
    color: '#0047AB', 
    fontSize: 16, 
    fontWeight: '600' 
  },
  footerText: { 
    fontSize: 12, 
    color: '#718096', 
    textAlign: 'center', 
    marginTop: 16, 
    lineHeight: 18 
  },
  linkText: { 
    textDecorationLine: 'underline', 
    color: '#718096' 
  }
});

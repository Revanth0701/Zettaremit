import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Image,
  useWindowDimensions,
  ScrollView
} from 'react-native';

export default function WelcomeScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isSmall = width < 400;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollWrapper}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
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
            <Text style={[styles.brandTitle, isSmall && styles.brandTitleSmall]}>ZettaRemit</Text>
            <Text style={[styles.headline, isSmall && styles.headlineSmall]}>
              Effortless Transfers,{"\n"}Boundless Connections.
            </Text>
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
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>Login</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton} 
            activeOpacity={0.85}
            onPress={() => navigation.navigate('SignupWizard')}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>Sign-up</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.backButton} 
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Home')}
            accessibilityRole="button"
          >
            <Text style={styles.backButtonText}>← Back to Homepage</Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            By continuing you accept our{'\n'}
            <Text style={styles.linkText}>Terms of service</Text> and <Text style={styles.linkText}>Privacy Policy</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#001E62' 
  },
  scrollWrapper: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center'
  },
  contentWrapper: { 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: 16
  },
  logoContainer: { 
    marginBottom: 24, 
    alignItems: 'center' 
  },
  logoImage: { 
    width: 140, 
    height: 140 
  },
  textContainer: { 
    alignItems: 'center',
    paddingHorizontal: 8
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  brandTitleSmall: {
    fontSize: 24
  },
  headline: { 
    fontSize: 22, 
    fontWeight: '700', 
    color: '#E0E7FF', 
    textAlign: 'center', 
    lineHeight: 30,
    marginBottom: 12
  },
  headlineSmall: {
    fontSize: 19,
    lineHeight: 26
  },
  subheading: { 
    fontSize: 14.5, 
    color: '#93C5FD', 
    textAlign: 'center', 
    lineHeight: 22, 
    maxWidth: 340
  },
  bottomInterface: { 
    width: '100%', 
    maxWidth: 320, 
    alignSelf: 'center', 
    marginTop: 24,
    gap: 14 
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
    color: '#94A3B8', 
    textAlign: 'center', 
    marginTop: 12, 
    lineHeight: 18 
  },
  linkText: { 
    textDecorationLine: 'underline', 
    color: '#93C5FD' 
  },
  backButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#93C5FD',
    fontSize: 14,
    fontWeight: '600',
  }
});

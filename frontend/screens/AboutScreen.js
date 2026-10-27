import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  useWindowDimensions,
} from 'react-native';
import AboutSection from '../components/AboutSection';

export default function AboutScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const handleGetStarted = () => {
    navigation.navigate('Welcome');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Public Header */}
      <View style={[styles.navbar, isDesktop && styles.navbarDesktop]}>
        <View style={styles.navContainer}>
          <TouchableOpacity
            style={styles.brandRow}
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.8}
            accessibilityRole="link"
            accessibilityLabel="ZettaRemit Home"
          >
            <Image
              source={require('../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.brandName}>ZettaRemit</Text>
          </TouchableOpacity>

          <View style={styles.navRightGroup}>
            <TouchableOpacity
              style={styles.backLink}
              onPress={() => navigation.navigate('Home')}
              accessibilityRole="button"
            >
              <Text style={styles.backLinkText}>← Home</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryCta}
              onPress={handleGetStarted}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Get Started"
            >
              <Text style={styles.primaryCtaText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentWrapper}>
          <AboutSection onGetStarted={handleGetStarted} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#001E62',
  },
  navbar: {
    backgroundColor: '#00164D',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  navbarDesktop: {
    paddingHorizontal: 40,
    paddingVertical: 16,
  },
  navContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 36,
    height: 36,
    marginRight: 10,
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  navRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backLink: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backLinkText: {
    color: '#93C5FD',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryCta: {
    backgroundColor: '#0052FF',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  contentWrapper: {
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
});

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  useWindowDimensions,
  Platform,
  Modal,
} from 'react-native';
import api from '../lib/api';

import CorridorIllustration from '../components/CorridorIllustration';
import TransferCalculatorPreview from '../components/TransferCalculatorPreview';
import ZettaAIPreview from '../components/ZettaAIPreview';
import HowItWorksSection from '../components/HowItWorksSection';
import RatesAndFeesSection from '../components/RatesAndFeesSection';
import AboutSection from '../components/AboutSection';

export default function HomeScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const scrollViewRef = useRef(null);

  // Section Y-offsets for smooth scrolling / navigation
  const [sectionPositions, setSectionPositions] = useState({});

  // Render Free non-blocking wake-up upon public homepage mount
  useEffect(() => {
    try {
      if (typeof api.wakeBackend === 'function') {
        api.wakeBackend();
      }
    } catch (_) {
      // Non-blocking background call; do not interrupt UI
    }
  }, []);

  const handleGetStarted = () => {
    setMobileMenuOpen(false);
    navigation.navigate('Welcome');
  };

  const handleScrollToSection = (sectionKey) => {
    setMobileMenuOpen(false);
    const pos = sectionPositions[sectionKey];
    if (typeof pos === 'number' && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: Math.max(0, pos - 70), animated: true });
    }
  };

  const recordLayout = (sectionKey, e) => {
    const y = e.nativeEvent.layout.y;
    setSectionPositions((prev) => ({ ...prev, [sectionKey]: y }));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ========================================================
          PUBLIC NAVIGATION BAR (DESKTOP & MOBILE)
          ======================================================== */}
      <View style={[styles.navbar, isDesktop && styles.navbarDesktop]}>
        <View style={styles.navContainer}>
          {/* Official Logo & Brand */}
          <TouchableOpacity
            style={styles.brandRow}
            onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
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

          {/* Desktop Nav Items */}
          {isDesktop ? (
            <View style={styles.desktopNavGroup}>
              <TouchableOpacity
                style={styles.navLink}
                onPress={() => handleScrollToSection('howItWorks')}
                accessibilityRole="button"
              >
                <Text style={styles.navLinkText}>How It Works</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navLink}
                onPress={() => handleScrollToSection('rates')}
                accessibilityRole="button"
              >
                <Text style={styles.navLinkText}>Rates & Fees</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navLink}
                onPress={() => handleScrollToSection('about')}
                accessibilityRole="button"
              >
                <Text style={styles.navLinkText}>About</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navLink}
                onPress={() => handleScrollToSection('aiPreview')}
                accessibilityRole="button"
              >
                <Text style={styles.navLinkText}>ZettaAI</Text>
              </TouchableOpacity>

              {/* PRIMARY CTA: Get Started (NO Log In button on public pages) */}
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
          ) : (
            /* Mobile Header Controls: Hamburger Button */
            <View style={styles.mobileNavGroup}>
              <TouchableOpacity
                style={styles.mobileCtaCompact}
                onPress={handleGetStarted}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Text style={styles.mobileCtaCompactText}>Get Started</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.hamburgerButton}
                onPress={() => setMobileMenuOpen(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Open Menu"
              >
                <Text style={styles.hamburgerIcon}>☰</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* ========================================================
          MOBILE MENU MODAL / DRAWER
          ======================================================== */}
      {!isDesktop && (
        <Modal
          visible={mobileMenuOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setMobileMenuOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.mobileDrawer}>
              <View style={styles.mobileDrawerHeader}>
                <View style={styles.brandRow}>
                  <Image
                    source={require('../assets/logo.png')}
                    style={styles.logoImageSmall}
                    resizeMode="contain"
                  />
                  <Text style={styles.brandName}>ZettaRemit</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeDrawerButton}
                  onPress={() => setMobileMenuOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close Menu"
                >
                  <Text style={styles.closeDrawerIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.mobileDrawerLinks}>
                <TouchableOpacity
                  style={styles.mobileDrawerLink}
                  onPress={() => handleScrollToSection('howItWorks')}
                >
                  <Text style={styles.mobileDrawerLinkText}>How It Works</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.mobileDrawerLink}
                  onPress={() => handleScrollToSection('rates')}
                >
                  <Text style={styles.mobileDrawerLinkText}>Rates & Fees</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.mobileDrawerLink}
                  onPress={() => handleScrollToSection('about')}
                >
                  <Text style={styles.mobileDrawerLinkText}>About ZettaRemit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.mobileDrawerLink}
                  onPress={() => handleScrollToSection('aiPreview')}
                >
                  <Text style={styles.mobileDrawerLinkText}>ZettaAI Assistant</Text>
                </TouchableOpacity>
              </View>

              {/* Primary CTA in Drawer (NO Log In button) */}
              <TouchableOpacity
                style={styles.drawerPrimaryCta}
                onPress={handleGetStarted}
                activeOpacity={0.85}
              >
                <Text style={styles.drawerPrimaryCtaText}>Get Started</Text>
              </TouchableOpacity>

              <Text style={styles.drawerFooterNotice}>
                Remittance Simulation Platform • Educational Demo
              </Text>
            </View>
          </View>
        </Modal>
      )}

      {/* ========================================================
          PAGE SCROLL CONTENT
          ======================================================== */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================
            HERO SECTION
            ======================================================== */}
        <View style={[styles.heroSection, isDesktop && styles.heroSectionDesktop]}>
          <View style={[styles.heroContent, isDesktop && styles.heroContentDesktop]}>
            {/* Left Hero Column: Headline & Value Proposition */}
            <View style={[styles.heroTextColumn, isDesktop && styles.heroTextColumnDesktop]}>
              <View style={styles.heroBadgeRow}>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>INDIA (INR) → USA (USD)</Text>
                </View>
                <View style={styles.simulationBadge}>
                  <Text style={styles.simulationBadgeText}>SIMULATION PLATFORM</Text>
                </View>
              </View>

              <Text style={[styles.heroHeadline, isDesktop && styles.heroHeadlineDesktop]}>
                A simpler way to simulate international money transfers.
              </Text>

              <Text style={styles.heroDescription}>
                Experience institutional-grade cross-border remittance simulations. Explore transparent 3% simulation fees, daily reference exchange rates, and multi-state ledger tracking in a 100% risk-free sandbox.
              </Text>

              <CorridorIllustration />

              <View style={styles.heroActionRow}>
                <TouchableOpacity
                  style={styles.heroPrimaryButton}
                  onPress={handleGetStarted}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={styles.heroPrimaryButtonText}>Get Started</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.heroSecondaryButton}
                  onPress={() => handleScrollToSection('howItWorks')}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                >
                  <Text style={styles.heroSecondaryButtonText}>Learn More ↓</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Right Hero Column: Interactive Transfer Calculator Preview */}
            <View style={[styles.heroCalculatorColumn, isDesktop && styles.heroCalculatorColumnDesktop]}>
              <TransferCalculatorPreview onGetStarted={handleGetStarted} />
            </View>
          </View>
        </View>

        {/* ========================================================
            FEATURE HIGHLIGHTS CARDS
            ======================================================== */}
        <View style={styles.sectionWrapper}>
          <View style={[styles.featuresGrid, isDesktop && styles.featuresGridDesktop]}>
            <View style={[styles.featureCard, isDesktop && styles.featureCardDesktop]}>
              <Text style={styles.featureIcon}>💎</Text>
              <Text style={styles.featureTitle}>Transparent Rates & Fees</Text>
              <Text style={styles.featureBody}>
                Predictable 3% simulation fee with reference market rates. No hidden intermediary charges or exchange spread markups.
              </Text>
            </View>

            <View style={[styles.featureCard, isDesktop && styles.featureCardDesktop]}>
              <Text style={styles.featureIcon}>🛡️</Text>
              <Text style={styles.featureTitle}>Simulation Platform</Text>
              <Text style={styles.featureBody}>
                Designed for students, families, and developers to explore the US-India remittance corridor without committing live funds.
              </Text>
            </View>

            <View style={[styles.featureCard, isDesktop && styles.featureCardDesktop]}>
              <Text style={styles.featureIcon}>📊</Text>
              <Text style={styles.featureTitle}>Transaction Tracking</Text>
              <Text style={styles.featureBody}>
                Real-time multi-state simulation ledger tracks quotes, fees, and transfers from initiation to final settlement.
              </Text>
            </View>

            <View style={[styles.featureCard, isDesktop && styles.featureCardDesktop]}>
              <Text style={styles.featureIcon}>✨</Text>
              <Text style={styles.featureTitle}>ZettaAI Assistance</Text>
              <Text style={styles.featureBody}>
                Built-in artificial intelligence assistant clarifies currency mechanics, rate movements, and simulation procedures.
              </Text>
            </View>
          </View>
        </View>

        {/* ========================================================
            HOW IT WORKS SECTION
            ======================================================== */}
        <View
          style={styles.sectionWrapper}
          onLayout={(e) => recordLayout('howItWorks', e)}
        >
          <HowItWorksSection />
        </View>

        {/* ========================================================
            RATES & FEES SECTION
            ======================================================== */}
        <View
          style={styles.sectionWrapper}
          onLayout={(e) => recordLayout('rates', e)}
        >
          <RatesAndFeesSection />
        </View>

        {/* ========================================================
            ZETTA AI PREVIEW SECTION
            ======================================================== */}
        <View
          style={styles.sectionWrapper}
          onLayout={(e) => recordLayout('aiPreview', e)}
        >
          <ZettaAIPreview onGetStarted={handleGetStarted} />
        </View>

        {/* ========================================================
            ABOUT ZETTAREMIT SECTION
            ======================================================== */}
        <View
          style={styles.sectionWrapper}
          onLayout={(e) => recordLayout('about', e)}
        >
          <AboutSection onGetStarted={handleGetStarted} />
        </View>

        {/* ========================================================
            FOOTER
            ======================================================== */}
        <View style={styles.footer}>
          <View style={[styles.footerContainer, isDesktop && styles.footerContainerDesktop]}>
            <View style={styles.footerBrandCol}>
              <View style={styles.brandRow}>
                <Image
                  source={require('../assets/logo.png')}
                  style={styles.logoImageSmall}
                  resizeMode="contain"
                />
                <Text style={styles.brandName}>ZettaRemit</Text>
              </View>
              <Text style={styles.footerTagline}>
                India to USA remittance simulation platform designed for students, families, and engineers.
              </Text>
              <View style={styles.footerSimulationNotice}>
                <Text style={styles.footerNoticeText}>
                  SIMULATION ONLY: ZettaRemit does not process real monetary transactions or accept customer deposits.
                </Text>
              </View>
            </View>

            <View style={styles.footerLinksCol}>
              <Text style={styles.footerColTitle}>Navigation</Text>
              <TouchableOpacity onPress={() => handleScrollToSection('howItWorks')}>
                <Text style={styles.footerLink}>How It Works</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleScrollToSection('rates')}>
                <Text style={styles.footerLink}>Rates & Fees</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleScrollToSection('about')}>
                <Text style={styles.footerLink}>About ZettaRemit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleScrollToSection('aiPreview')}>
                <Text style={styles.footerLink}>ZettaAI Assistant</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footerCtaCol}>
              <Text style={styles.footerColTitle}>Get Started</Text>
              <Text style={styles.footerCtaDesc}>
                Ready to try the simulation? Create your account or sign in to continue.
              </Text>
              <TouchableOpacity
                style={styles.footerCtaBtn}
                onPress={handleGetStarted}
                activeOpacity={0.85}
              >
                <Text style={styles.footerCtaBtnText}>Get Started</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footerBottomBar}>
            <Text style={styles.footerCopyright}>
              © 2026 ZettaRemit. All rights reserved. Educational Simulation Platform.
            </Text>
          </View>
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
    zIndex: 100,
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
  logoImageSmall: {
    width: 28,
    height: 28,
    marginRight: 8,
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  desktopNavGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  navLink: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  navLinkText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryCta: {
    backgroundColor: '#0052FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#0052FF',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mobileNavGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mobileCtaCompact: {
    backgroundColor: '#0052FF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
  },
  mobileCtaCompactText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  hamburgerButton: {
    padding: 6,
  },
  hamburgerIcon: {
    color: '#FFFFFF',
    fontSize: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-start',
  },
  mobileDrawer: {
    backgroundColor: '#071633',
    padding: 24,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 102, 255, 0.4)',
  },
  mobileDrawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  closeDrawerButton: {
    padding: 6,
  },
  closeDrawerIcon: {
    color: '#FFFFFF',
    fontSize: 22,
  },
  mobileDrawerLinks: {
    gap: 16,
    marginBottom: 24,
  },
  mobileDrawerLink: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  mobileDrawerLinkText: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '600',
  },
  drawerPrimaryCta: {
    backgroundColor: '#0052FF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  drawerPrimaryCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  drawerFooterNotice: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroSection: {
    backgroundColor: '#001E62',
    paddingVertical: 36,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  heroSectionDesktop: {
    paddingVertical: 64,
    paddingHorizontal: 40,
  },
  heroContent: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    gap: 36,
  },
  heroContentDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTextColumn: {
    width: '100%',
  },
  heroTextColumnDesktop: {
    width: '52%',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  heroBadge: {
    backgroundColor: 'rgba(0, 102, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 102, 255, 0.5)',
  },
  heroBadgeText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  simulationBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.4)',
  },
  simulationBadgeText: {
    color: '#FDE047',
    fontSize: 11,
    fontWeight: '700',
  },
  heroHeadline: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 40,
    marginBottom: 16,
  },
  heroHeadlineDesktop: {
    fontSize: 44,
    lineHeight: 52,
  },
  heroDescription: {
    color: '#CBD5E1',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  heroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  heroPrimaryButton: {
    backgroundColor: '#0052FF',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    shadowColor: '#0052FF',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  heroPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroSecondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroSecondaryButtonText: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '600',
  },
  heroCalculatorColumn: {
    width: '100%',
    alignItems: 'center',
  },
  heroCalculatorColumnDesktop: {
    width: '44%',
  },
  sectionWrapper: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
  featuresGrid: {
    gap: 16,
    paddingVertical: 36,
  },
  featuresGridDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  featureCard: {
    backgroundColor: '#071633',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  featureCardDesktop: {
    flex: 1,
  },
  featureIcon: {
    fontSize: 26,
    marginBottom: 10,
  },
  featureTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  featureBody: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    backgroundColor: '#001238',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  footerContainer: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    gap: 32,
    marginBottom: 36,
  },
  footerContainerDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  footerBrandCol: {
    maxWidth: 400,
  },
  footerTagline: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
    marginBottom: 14,
  },
  footerSimulationNotice: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  footerNoticeText: {
    color: '#CBD5E1',
    fontSize: 11,
    lineHeight: 15,
  },
  footerLinksCol: {
    gap: 10,
  },
  footerColTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  footerLink: {
    color: '#94A3B8',
    fontSize: 14,
    paddingVertical: 2,
  },
  footerCtaCol: {
    maxWidth: 320,
  },
  footerCtaDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  footerCtaBtn: {
    backgroundColor: '#0052FF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  footerCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  footerBottomBar: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 20,
    alignItems: 'center',
  },
  footerCopyright: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
  },
});

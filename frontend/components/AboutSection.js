import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, useWindowDimensions } from 'react-native';

const PILLARS = [
  {
    icon: '🎯',
    title: 'Our Mission',
    text: 'To bring institutional clarity and complete transparency to the cross-border remittance corridor between India and the United States.',
  },
  {
    icon: '🛡️',
    title: 'Architectural Rigor',
    text: 'Engineered with production-grade financial safeguards: cryptographic quote tokens, idempotency enforcement, and JWT user isolation.',
  },
  {
    icon: '💡',
    title: 'Simulation Sandbox',
    text: 'Built specifically for students, families, and developers to explore exchange rates, fee mechanics, and transfer tracking without financial risk.',
  },
];

export default function AboutSection({ onGetStarted }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>ABOUT ZETTAREMIT</Text>
        </View>
        <Text style={styles.title}>Demystifying Cross-Border Transfers</Text>
        <Text style={styles.subtitle}>
          ZettaRemit was created to demonstrate how modern remittance platforms should operate: transparently, securely, and with zero hidden costs.
        </Text>
      </View>

      {/* Pillars Grid */}
      <View style={[styles.pillarsGrid, isDesktop && styles.pillarsGridDesktop]}>
        {PILLARS.map((p) => (
          <View key={p.title} style={[styles.pillarCard, isDesktop && styles.pillarCardDesktop]}>
            <Text style={styles.pillarIcon}>{p.icon}</Text>
            <Text style={styles.pillarTitle}>{p.title}</Text>
            <Text style={styles.pillarText}>{p.text}</Text>
          </View>
        ))}
      </View>

      {/* Mandatory Regulatory / Simulation Notice Banner */}
      <View style={styles.regulatoryCallout}>
        <View style={styles.regulatoryIconBox}>
          <Text style={styles.regulatoryIcon}>⚠️</Text>
        </View>
        <View style={styles.regulatoryContent}>
          <Text style={styles.regulatoryTitle}>Mandatory Simulation Disclosure</Text>
          <Text style={styles.regulatoryText}>
            ZettaRemit is an educational remittance simulation platform and architecture showcase. ZettaRemit does not process real monetary transactions, hold customer deposits, or transmit fiat currency. All account balances, quotes, fees, and transfers displayed within the application are simulated for demonstration purposes.
          </Text>
        </View>
      </View>

      {/* CTA Box */}
      <View style={styles.ctaBox}>
        <Text style={styles.ctaBoxTitle}>Ready to explore the simulation?</Text>
        <Text style={styles.ctaBoxSubtitle}>
          Create a free demo account and experience the full transfer corridor in action.
        </Text>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={onGetStarted}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Get Started with ZettaRemit"
        >
          <Text style={styles.ctaButtonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 32,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  badge: {
    backgroundColor: 'rgba(0, 102, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 102, 255, 0.4)',
    marginBottom: 10,
  },
  badgeText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 620,
    lineHeight: 22,
  },
  pillarsGrid: {
    gap: 16,
    marginBottom: 28,
  },
  pillarsGridDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pillarCard: {
    backgroundColor: '#0B1B3D',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  pillarCardDesktop: {
    flex: 1,
  },
  pillarIcon: {
    fontSize: 28,
    marginBottom: 12,
  },
  pillarTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  pillarText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
  },
  regulatoryCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(234, 179, 8, 0.08)',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    marginBottom: 28,
  },
  regulatoryIconBox: {
    marginRight: 14,
    marginTop: 2,
  },
  regulatoryIcon: {
    fontSize: 22,
  },
  regulatoryContent: {
    flex: 1,
  },
  regulatoryTitle: {
    color: '#FDE047',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  regulatoryText: {
    color: '#FEF08A',
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.9,
  },
  ctaBox: {
    backgroundColor: 'linear-gradient(180deg, #001E62 0%, #001238 100%)',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 102, 255, 0.3)',
  },
  ctaBoxTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  ctaBoxSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 18,
    maxWidth: 480,
  },
  ctaButton: {
    backgroundColor: '#0052FF',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 10,
    shadowColor: '#0052FF',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

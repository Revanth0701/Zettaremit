import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

const STEPS = [
  {
    step: '01',
    title: 'Create Your Account',
    description: 'Sign up in seconds with your email address. Verify your simulated profile risk-free without exposing sensitive government ID documents.',
    badge: 'Email Only • Fast Onboarding',
    icon: '👤',
  },
  {
    step: '02',
    title: 'Enter Transfer Details',
    description: 'Specify your send amount in Indian Rupees (INR) and designate a simulated US recipient name and delivery destination.',
    badge: 'India to USA Corridor',
    icon: '📝',
  },
  {
    step: '03',
    title: 'Review Simulated Quote',
    description: 'Lock in a transparent 3% platform fee and reference exchange rate quote. Every quote is cryptographically verified and rate-secured.',
    badge: 'Transparent 3% Fee',
    icon: '🔒',
  },
  {
    step: '04',
    title: 'Track Your Transaction',
    description: 'Follow your transfer in real-time as it advances through each simulated milestone to settlement in your personal activity ledger.',
    badge: 'Multi-State Audit Ledger',
    icon: '📊',
  },
];

export default function HowItWorksSection() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>HOW IT WORKS</Text>
        </View>
        <Text style={styles.title}>Simulated Remittance in 4 Simple Steps</Text>
        <Text style={styles.subtitle}>
          Our streamlined workflow mirrors institutional cross-border clearing systems while keeping your transactions 100% risk-free.
        </Text>
      </View>

      <View style={[styles.grid, isDesktop && styles.gridDesktop]}>
        {STEPS.map((s) => (
          <View key={s.step} style={[styles.card, isDesktop && styles.cardDesktop]}>
            <View style={styles.cardTop}>
              <Text style={styles.stepNumber}>{s.step}</Text>
              <Text style={styles.stepIcon}>{s.icon}</Text>
            </View>
            <Text style={styles.cardTitle}>{s.title}</Text>
            <Text style={styles.cardDesc}>{s.description}</Text>
            <View style={styles.cardBadgeContainer}>
              <Text style={styles.cardBadgeText}>{s.badge}</Text>
            </View>
          </View>
        ))}
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
    textAlign: 'center',
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
  grid: {
    gap: 16,
  },
  gridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: '#0B1B3D',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardDesktop: {
    width: '48.5%',
    marginBottom: 16,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    color: '#38BDF8',
    fontSize: 28,
    fontWeight: '900',
    opacity: 0.9,
  },
  stepIcon: {
    fontSize: 24,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  cardBadgeContainer: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardBadgeText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
});

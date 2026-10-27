import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

export default function CorridorIllustration() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      {/* Origin: India Card */}
      <View style={[styles.nodeCard, isDesktop ? styles.nodeCardDesktop : styles.nodeCardMobile]}>
        <View style={styles.flagRow}>
          <Text style={styles.flagEmoji}>🇮🇳</Text>
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>ORIGIN</Text>
          </View>
        </View>
        <Text style={styles.countryName}>India</Text>
        <Text style={styles.currencyTitle}>INR (₹)</Text>
        <Text style={styles.nodeDetail}>Simulated Bank / UPI Inflow</Text>
      </View>

      {/* Transfer Corridor Beam */}
      <View style={[styles.corridorBeam, isDesktop ? styles.corridorBeamDesktop : styles.corridorBeamMobile]}>
        <View style={styles.beamLine} />
        <View style={styles.transferBadge}>
          <Text style={styles.transferBadgeIcon}>✈</Text>
          <Text style={styles.transferBadgeText}>Simulated Clearing Arc</Text>
        </View>
        <View style={styles.ratePill}>
          <Text style={styles.ratePillText}>3% Simulation Fee • Indicative Rate</Text>
        </View>
      </View>

      {/* Destination: USA Card */}
      <View style={[styles.nodeCard, isDesktop ? styles.nodeCardDesktop : styles.nodeCardMobile]}>
        <View style={styles.flagRow}>
          <Text style={styles.flagEmoji}>🇺🇸</Text>
          <View style={[styles.badgeContainer, styles.badgeDestination]}>
            <Text style={styles.badgeText}>DESTINATION</Text>
          </View>
        </View>
        <Text style={styles.countryName}>United States</Text>
        <Text style={styles.currencyTitle}>USD ($)</Text>
        <Text style={styles.nodeDetail}>Simulated ACH Payout</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#071633',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 102, 255, 0.3)',
    alignItems: 'center',
    marginVertical: 16,
    width: '100%',
  },
  containerDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  nodeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  nodeCardDesktop: {
    width: '28%',
  },
  nodeCardMobile: {
    width: '100%',
    alignItems: 'center',
  },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  flagEmoji: {
    fontSize: 28,
  },
  badgeContainer: {
    backgroundColor: 'rgba(0, 102, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 102, 255, 0.5)',
  },
  badgeDestination: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  badgeText: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  countryName: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  currencyTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginVertical: 4,
  },
  nodeDetail: {
    color: '#94A3B8',
    fontSize: 12,
  },
  corridorBeam: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  corridorBeamDesktop: {
    flex: 1,
    paddingHorizontal: 16,
  },
  corridorBeamMobile: {
    width: '100%',
    marginVertical: 16,
  },
  beamLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#0066FF',
    width: '100%',
    opacity: 0.5,
  },
  transferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0052FF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#0052FF',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  transferBadgeIcon: {
    color: '#FFD700',
    fontSize: 14,
    marginRight: 6,
  },
  transferBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ratePill: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  ratePillText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
});

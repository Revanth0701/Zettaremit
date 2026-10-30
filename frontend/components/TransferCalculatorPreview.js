import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, useWindowDimensions, ActivityIndicator } from 'react-native';
import api from '../lib/api';

const QUICK_AMOUNTS = ['10000', '25000', '50000', '100000'];
const FEE_PERCENT = 3;

export default function TransferCalculatorPreview({ onGetStarted }) {
  const [inrAmount, setInrAmount] = useState('25000');
  const [rate, setRate] = useState(null);
  const [rateStatus, setRateStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [rateAttribution, setRateAttribution] = useState('Platform Reference Rate');
  const [rateObservedAt, setRateObservedAt] = useState(null);
  const isMountedRef = useRef(true);

  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const fetchReferenceRate = async () => {
    if (!isMountedRef.current) return;
    setRateStatus('loading');
    setRate(null);

    try {
      let data = null;

      // 1. Try unified getReferenceRate helper if available
      if (typeof api.getReferenceRate === 'function') {
        data = await api.getReferenceRate();
      } else if (typeof api.config === 'function') {
        // Fallback to public unauthenticated config endpoint
        const cfg = await api.config();
        if (cfg && cfg.inr_per_usd) {
          const parsed = parseFloat(cfg.inr_per_usd);
          if (Number.isFinite(parsed) && parsed > 0) {
            data = {
              rate: parsed,
              inr_per_usd: String(cfg.inr_per_usd),
              observed_at: cfg.observed_at || null,
              attribution_text: cfg.attribution_text || 'Platform Reference Rate',
            };
          }
        }
      }

      if (!isMountedRef.current) return;

      if (data && Number.isFinite(data.rate) && data.rate > 0) {
        setRate(data.rate);
        setRateAttribution(data.attribution_text || 'Platform Reference Rate');
        setRateObservedAt(data.observed_at || null);
        setRateStatus('ready');
      } else {
        setRate(null);
        setRateStatus('error');
      }
    } catch (_) {
      if (!isMountedRef.current) return;
      setRate(null);
      setRateStatus('error');
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchReferenceRate();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const cleanInput = inrAmount.replace(/[^0-9.]/g, '');
  const grossNum = parseFloat(cleanInput) || 0;
  const feeNum = grossNum > 0 ? (grossNum * (FEE_PERCENT / 100)) : 0;
  const netNum = Math.max(0, grossNum - feeNum);

  // Exact INR-to-USD calculation when verified rate is present; NO invented fallback payout
  const usdPayout = (rateStatus === 'ready' && rate && rate > 0)
    ? (netNum / rate).toFixed(2)
    : null;

  const formatInr = (val) => {
    return Number(val).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <Text style={styles.cardBadge}>SIMULATED CALCULATOR</Text>
          <Text style={styles.currencyPair}>INR → USD</Text>
        </View>
        <Text style={styles.cardHeadline}>Estimate Your Simulation</Text>
        <Text style={styles.cardSubtitle}>
          Preview transparent fees and reference exchange rates without committing live funds.
        </Text>
      </View>

      {/* Input Amount Section */}
      <View style={styles.inputGroup}>
        <View style={styles.labelRow}>
          <Text style={styles.inputLabel}>You Send (Gross Amount)</Text>
          <Text style={styles.currencyBadge}>INR (₹)</Text>
        </View>
        <View style={styles.inputWrapper}>
          <Text style={styles.currencyPrefix}>₹</Text>
          <TextInput
            style={styles.textInput}
            value={inrAmount}
            onChangeText={setInrAmount}
            keyboardType="numeric"
            placeholder="25000"
            placeholderTextColor="#64748B"
            accessibilityLabel="Send amount in INR"
          />
        </View>

        {/* Quick Amount Pills */}
        <View style={styles.pillsRow}>
          {QUICK_AMOUNTS.map((amt) => (
            <TouchableOpacity
              key={amt}
              style={[styles.pill, inrAmount === amt && styles.pillActive]}
              onPress={() => setInrAmount(amt)}
              activeOpacity={0.8}
            >
              <Text style={[styles.pillText, inrAmount === amt && styles.pillTextActive]}>
                ₹{parseInt(amt, 10).toLocaleString('en-IN')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Breakdown Card */}
      <View style={styles.breakdownCard}>
        <View style={styles.breakdownRow}>
          <View style={styles.breakdownLeft}>
            <Text style={styles.breakdownIcon}>—</Text>
            <Text style={styles.breakdownLabel}>Platform Fee (3% Simulation)</Text>
          </View>
          <Text style={styles.breakdownValue}>- ₹{formatInr(feeNum)} INR</Text>
        </View>

        <View style={styles.breakdownRow}>
          <View style={styles.breakdownLeft}>
            <Text style={styles.breakdownIcon}>=</Text>
            <Text style={styles.breakdownLabel}>Net Amount to Convert</Text>
          </View>
          <Text style={styles.breakdownValueBold}>₹{formatInr(netNum)} INR</Text>
        </View>

        <View style={styles.divider} />

        {/* Indicative Reference Rate Section (public, direct from open.er-api.com) */}
        <View style={styles.breakdownRow}>
          <View style={styles.breakdownLeft}>
            <Text style={styles.breakdownIcon}>⚡</Text>
            <Text style={styles.breakdownLabel}>Indicative Reference Rate</Text>
          </View>

          {rateStatus === 'loading' && (
            <View style={styles.rateStatusRow}>
              <ActivityIndicator size="small" color="#60A5FA" style={{ marginRight: 6 }} />
              <Text style={styles.rateLoadingText}>Fetching reference exchange rate...</Text>
            </View>
          )}

          {rateStatus === 'error' && (
            <View style={styles.rateStatusRow}>
              <Text style={styles.rateErrorText}>Reference rate temporarily unavailable</Text>
              <TouchableOpacity
                onPress={fetchReferenceRate}
                style={styles.retryButton}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Retry fetching rate"
              >
                <Text style={styles.retryButtonText}>↻</Text>
              </TouchableOpacity>
            </View>
          )}

          {rateStatus === 'ready' && rate && (
            <Text style={styles.rateValueText}>
              1 USD ≈ ₹{rate.toFixed(2)} INR
            </Text>
          )}
        </View>

        {rateStatus === 'ready' && (
          <Text style={styles.rateSubtext}>
            Indicative reference rate • {rateAttribution}
            {rateObservedAt ? ` • Observed ${new Date(rateObservedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}` : ''}
          </Text>
        )}

        {rateStatus === 'error' && (
          <Text style={styles.rateErrorSubtext}>
            Unable to connect to live exchange rate provider. Please retry shortly.
          </Text>
        )}
      </View>

      {/* Recipient Gets Box */}
      <View style={styles.payoutBox}>
        <View style={styles.payoutHeader}>
          <Text style={styles.payoutLabel}>Recipient Receives (Estimated)</Text>
          <View style={styles.usdBadge}>
            <Text style={styles.usdBadgeText}>USD ($)</Text>
          </View>
        </View>

        {/* Displays calculated USD when rate is available; NEVER an invented USD payout */}
        {rateStatus === 'ready' && usdPayout !== null ? (
          <>
            <Text style={styles.payoutAmount}>${usdPayout}</Text>
            <Text style={styles.payoutNotice}>
              Indicative estimate only — not a locked or guaranteed rate
            </Text>
          </>
        ) : rateStatus === 'loading' ? (
          <>
            <Text style={styles.payoutAmountPlaceholder}>—</Text>
            <Text style={styles.payoutNotice}>
              Fetching reference exchange rate...
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.payoutAmountPlaceholder}>—</Text>
            <Text style={styles.payoutNoticeUnavailable}>
              USD conversion unavailable without a verified exchange rate.
            </Text>
          </>
        )}
      </View>

      {/* Simulation Disclosure Notice */}
      <View style={styles.simulationNotice}>
        <Text style={styles.simulationNoticeIcon}>ℹ️</Text>
        <Text style={styles.simulationNoticeText}>
          Simulation platform only. Live monetary transactions are disabled.
        </Text>
      </View>

      {/* Primary CTA Button */}
      <TouchableOpacity
        style={styles.ctaButton}
        onPress={onGetStarted}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Get Started with transfer simulation"
      >
        <Text style={styles.ctaButtonText}>Get Started to Simulate</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0B1B3D',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 102, 255, 0.35)',
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  containerDesktop: {
    maxWidth: 520,
  },
  cardHeader: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardBadge: {
    backgroundColor: 'rgba(0, 102, 255, 0.25)',
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  currencyPair: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  cardHeadline: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  currencyBadge: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#071329',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 16,
    height: 52,
  },
  currencyPrefix: {
    color: '#94A3B8',
    fontSize: 20,
    fontWeight: '700',
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    padding: 0,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  pill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pillActive: {
    backgroundColor: 'rgba(0, 102, 255, 0.3)',
    borderColor: '#0066FF',
  },
  pillText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  breakdownCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
    flexWrap: 'wrap',
    gap: 6,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownIcon: {
    color: '#64748B',
    fontSize: 14,
    width: 20,
    fontWeight: '700',
  },
  breakdownLabel: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  breakdownValue: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '600',
  },
  breakdownValueBold: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
  },
  rateStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rateLoadingText: {
    color: '#93C5FD',
    fontSize: 12,
    fontStyle: 'italic',
  },
  rateErrorText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '600',
  },
  retryButton: {
    marginLeft: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  retryButtonText: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '700',
  },
  rateValueText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
  },
  rateSubtext: {
    color: '#64748B',
    fontSize: 11,
    marginLeft: 20,
    marginTop: 2,
  },
  rateErrorSubtext: {
    color: '#F87171',
    fontSize: 11,
    marginLeft: 20,
    marginTop: 2,
  },
  payoutBox: {
    backgroundColor: 'rgba(0, 82, 255, 0.15)',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 102, 255, 0.4)',
    marginBottom: 16,
    alignItems: 'center',
  },
  payoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  payoutLabel: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  usdBadge: {
    backgroundColor: '#0052FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  usdBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  payoutAmount: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginVertical: 4,
  },
  payoutAmountPlaceholder: {
    color: '#64748B',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginVertical: 4,
  },
  payoutNotice: {
    color: '#94A3B8',
    fontSize: 11,
  },
  payoutNoticeUnavailable: {
    color: '#F87171',
    fontSize: 11,
    textAlign: 'center',
  },
  simulationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.25)',
    marginBottom: 20,
  },
  simulationNoticeIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  simulationNoticeText: {
    color: '#FDE047',
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  ctaButton: {
    backgroundColor: '#0052FF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
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

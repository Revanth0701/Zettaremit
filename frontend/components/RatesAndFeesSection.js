import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import api from '../lib/api';

const TIERS = [10000, 25000, 50000, 100000];

export default function RatesAndFeesSection() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [rate, setRate] = useState(null);
  const [rateLoading, setRateLoading] = useState(true);
  const [rateError, setRateError] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchRate = async () => {
      try {
        let data = null;
        if (typeof api.getReferenceRate === 'function') {
          data = await api.getReferenceRate();
        } else if (typeof api.config === 'function') {
          const cfg = await api.config();
          if (cfg && cfg.inr_per_usd) {
            const parsed = parseFloat(cfg.inr_per_usd);
            if (Number.isFinite(parsed) && parsed > 0) {
              data = { rate: parsed };
            }
          }
        }
        if (active) {
          if (data && Number.isFinite(data.rate) && data.rate > 0) {
            setRate(data.rate);
            setRateLoading(false);
            setRateError(false);
          } else {
            setRate(null);
            setRateLoading(false);
            setRateError(true);
          }
        }
      } catch (_) {
        if (active) {
          setRate(null);
          setRateLoading(false);
          setRateError(true);
        }
      }
    };
    fetchRate();
    return () => { active = false; };
  }, []);

  const comparisonRows = TIERS.map((tier) => {
    const fee = (tier * 0.03).toFixed(2);
    const net = (tier - parseFloat(fee)).toFixed(2);
    const rateStr = rate ? `₹${rate.toFixed(2)}` : '—';
    const payoutStr = rate ? `$${(parseFloat(net) / rate).toFixed(2)}` : '—';
    return {
      gross: `₹${tier.toLocaleString('en-IN')}`,
      fee: `₹${parseFloat(fee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      net: `₹${parseFloat(net).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      rate: rateStr,
      payout: payoutStr,
    };
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>TRANSPARENCY FIRST</Text>
        </View>
        <Text style={styles.title}>Predictable Rates & Flat 3% Fees</Text>
        <Text style={styles.subtitle}>
          No surprise banking charges, no hidden currency spread markups. Here is exactly how every simulated transfer is calculated.
        </Text>
      </View>

      {/* Two-Column Cards: Rate Methodology & Fee Structure */}
      <View style={[styles.cardsRow, isDesktop && styles.cardsRowDesktop]}>
        {/* Exchange Rate Card */}
        <View style={[styles.infoCard, isDesktop && styles.infoCardDesktop]}>
          <View style={styles.infoCardHeader}>
            <Text style={styles.infoCardIcon}>📈</Text>
            <Text style={styles.infoCardTitle}>Reference Exchange Rates</Text>
          </View>
          <Text style={styles.infoCardText}>
            ZettaRemit utilizes daily reference benchmarks to provide realistic currency conversion metrics for the INR → USD remittance corridor.
          </Text>
          <View style={styles.featureItem}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.featureText}>Daily indicative reference rate from exchange rate providers</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.featureText}>Guaranteed quote locking during transfer generation</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.featureText}>Clear attribution to market reference data sources</Text>
          </View>
          <View style={styles.disclaimerPill}>
            <Text style={styles.disclaimerText}>
              Note: Public overview figures reflect the current reference rate when available. Active reference rates are locked when you generate a signed transfer quote.
            </Text>
          </View>
        </View>

        {/* 3% Fee Card */}
        <View style={[styles.infoCard, isDesktop && styles.infoCardDesktop]}>
          <View style={styles.infoCardHeader}>
            <Text style={styles.infoCardIcon}>⚡</Text>
            <Text style={styles.infoCardTitle}>Flat 3.00% Simulation Fee</Text>
          </View>
          <Text style={styles.infoCardText}>
            Our fee model is simple: a transparent 3% deduction from the gross INR send amount before conversion.
          </Text>
          <View style={styles.formulaBox}>
            <Text style={styles.formulaTitle}>CALCULATION FORMULA</Text>
            <Text style={styles.formulaCode}>Fee (INR) = Gross Amount × 0.03</Text>
            <Text style={styles.formulaCode}>Net INR = Gross Amount - Fee</Text>
            <Text style={styles.formulaCode}>USD Payout = Net INR ÷ Exchange Rate</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.featureText}>Zero receiving fees for the US beneficiary</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.featureText}>No hidden wire fees or correspondent intermediary cuts</Text>
          </View>
        </View>
      </View>

      {/* Illustrative Breakdown Table */}
      <View style={styles.tableCard}>
        <View style={styles.tableHeaderRow}>
          <Text style={styles.tableTitle}>Illustrative Transfer Examples</Text>
          <Text style={styles.tableSubtitle}>
            {rateLoading
              ? 'Fetching reference exchange rate...'
              : rate
              ? `Calculated with active reference rate (1 USD ≈ ₹${rate.toFixed(2)} INR)`
              : 'Reference rate temporarily unavailable • Live rates locked on quote generation'}
          </Text>
        </View>

        <View style={styles.tableContainer}>
          {/* Header Row */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCol, styles.colHeader, { flex: 1.2 }]}>You Send</Text>
            <Text style={[styles.tableCol, styles.colHeader, { flex: 1 }]}>3% Fee</Text>
            <Text style={[styles.tableCol, styles.colHeader, { flex: 1.2 }]}>Net Converted</Text>
            <Text style={[styles.tableCol, styles.colHeader, { flex: 1 }]}>Rate (INR)</Text>
            <Text style={[styles.tableCol, styles.colHeader, { flex: 1.2, textAlign: 'right' }]}>USD Payout</Text>
          </View>

          {/* Data Rows */}
          {comparisonRows.map((row, idx) => (
            <View key={row.gross} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
              <Text style={[styles.tableCol, styles.colGross, { flex: 1.2 }]}>{row.gross}</Text>
              <Text style={[styles.tableCol, styles.colFee, { flex: 1 }]}>{row.fee}</Text>
              <Text style={[styles.tableCol, styles.colNet, { flex: 1.2 }]}>{row.net}</Text>
              <Text style={[styles.tableCol, styles.colRate, { flex: 1 }]}>{row.rate}</Text>
              <Text style={[styles.tableCol, styles.colPayout, { flex: 1.2, textAlign: 'right' }]}>{row.payout}</Text>
            </View>
          ))}
        </View>
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
  cardsRow: {
    gap: 16,
    marginBottom: 24,
  },
  cardsRowDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoCard: {
    backgroundColor: '#0B1B3D',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  infoCardDesktop: {
    flex: 1,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  infoCardIcon: {
    fontSize: 22,
  },
  infoCardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  infoCardText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginVertical: 4,
  },
  checkIcon: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '700',
  },
  featureText: {
    color: '#CBD5E1',
    fontSize: 13,
    flex: 1,
  },
  disclaimerPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  disclaimerText: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
  },
  formulaBox: {
    backgroundColor: '#071329',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 102, 255, 0.2)',
  },
  formulaTitle: {
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  formulaCode: {
    color: '#E2E8F0',
    fontSize: 12,
    fontFamily: 'monospace',
    marginVertical: 2,
  },
  tableCard: {
    backgroundColor: '#0B1B3D',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tableHeaderRow: {
    marginBottom: 16,
  },
  tableTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  tableSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  tableContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tableHeader: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tableRowAlt: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  tableCol: {
    fontSize: 12,
  },
  colHeader: {
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
    fontSize: 11,
  },
  colGross: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  colFee: {
    color: '#F87171',
    fontWeight: '500',
  },
  colNet: {
    color: '#CBD5E1',
  },
  colRate: {
    color: '#38BDF8',
  },
  colPayout: {
    color: '#34D399',
    fontWeight: '700',
  },
});

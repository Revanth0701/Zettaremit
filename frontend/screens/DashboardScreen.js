import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, StatusBar, useWindowDimensions, Image, Linking, Modal } from 'react-native';
const SafeModal = Modal || View;
// Authenticated requests use the centralized token client.
import api from '../lib/api';
import * as Crypto from 'expo-crypto';
import { createQuoteFlow, ATTRIBUTION_URL, ATTRIBUTION_TEXT } from '../lib/quoteFlow';

// Professional UI Icons for ZettaRemit Dashboard
function AssistantIcon({ size = 20, color = '#003DA5' }) {
  if (Platform.OS === 'web') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <path
          d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z"
          fill={color}
        />
        <path
          d="M19 16L20.2 19.8L24 21L20.2 22.2L19 26L17.8 22.2L14 21L17.8 19.8L19 16Z"
          fill={color}
          opacity="0.85"
        />
      </svg>
    );
  }
  return (
    <Text style={{ color, fontSize: size, fontWeight: '700', lineHeight: size + 2 }}>✦</Text>
  );
}

function HomeIcon({ size = 18, color = '#64748B' }) {
  if (Platform.OS === 'web') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: 'block' }}
      >
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V9.5z" />
      </svg>
    );
  }
  return <Text style={{ color, fontSize: size, fontWeight: '600' }}>⌂</Text>;
}

function SendMoneyIcon({ size = 18, color = '#64748B' }) {
  if (Platform.OS === 'web') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: 'block' }}
      >
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" fill={color} fillOpacity="0.15" />
      </svg>
    );
  }
  return <Text style={{ color, fontSize: size, fontWeight: '600' }}>↗</Text>;
}

function HistoryIcon({ size = 18, color = '#64748B' }) {
  if (Platform.OS === 'web') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: 'block' }}
      >
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <line x1="7" y1="8" x2="17" y2="8" />
        <line x1="7" y1="12" x2="17" y2="12" />
        <line x1="7" y1="16" x2="13" y2="16" />
      </svg>
    );
  }
  return <Text style={{ color, fontSize: size, fontWeight: '600' }}>≡</Text>;
}

function ProfileIcon({ size = 18, color = '#64748B' }) {
  if (Platform.OS === 'web') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: 'block' }}
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    );
  }
  return <Text style={{ color, fontSize: size, fontWeight: '600' }}>●</Text>;
}

function PhoneUpiIcon({ size = 22, color = '#003DA5' }) {
  if (Platform.OS === 'web') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: 'block' }}
      >
        <rect x="5" y="2" width="14" height="20" rx="3" />
        <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2.5" />
      </svg>
    );
  }
  return <Text style={{ color, fontSize: size, fontWeight: '600' }}>📱</Text>;
}

function BankNetIcon({ size = 22, color = '#003DA5' }) {
  if (Platform.OS === 'web') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: 'block' }}
      >
        <polygon points="12 2 2 7 22 7 12 2" fill={color} fillOpacity="0.12" />
        <line x1="5" y1="10" x2="5" y2="17" />
        <line x1="10" y1="10" x2="10" y2="17" />
        <line x1="14" y1="10" x2="14" y2="17" />
        <line x1="19" y1="10" x2="19" y2="17" />
        <line x1="2" y1="21" x2="22" y2="21" />
      </svg>
    );
  }
  return <Text style={{ color, fontSize: size, fontWeight: '600' }}>🏛</Text>;
}

function SuccessCheckIcon({ size = 52, color = '#10B981' }) {
  if (Platform.OS === 'web') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: 'block' }}
      >
        <circle cx="12" cy="12" r="10" fill="#ECFDF5" />
        <polyline points="9 12 11.5 14.5 16 9.5" stroke="#10B981" strokeWidth="2.5" />
      </svg>
    );
  }
  return <Text style={{ color, fontSize: size }}>✓</Text>;
}

export default function DashboardScreen({ navigation }) {
  const [appStep, setAppStep] = useState(1);
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 768; 

  const [recipient, setRecipient] = useState('');
  const [account, setAccount] = useState('');
  const [routing, setRouting] = useState('');
  const [swift, setSwift] = useState('');
  
  const [sendAmountInr, setSendAmountInr] = useState('100000');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const flowRef = useRef(null);
  if (!flowRef.current) flowRef.current = createQuoteFlow({api,newKey:() => Crypto.randomUUID()});
  const flow = flowRef.current;
  const [quoteState, setQuoteState] = useState(flow.getSnapshot());
  const submitting = quoteState.submitting;
  const [receipt, setReceipt] = useState(null);
  useEffect(() => {
    const unsubscribe = flow.subscribe(setQuoteState);
    const timer = setInterval(() => flow.tick(), 1000);
    return () => { unsubscribe(); clearInterval(timer); };
  }, [flow]);
  const quote = quoteState.quote;
  const quoteCurrent = !!quote && !quoteState.expired && Date.parse(quote.expires_at) > Date.now();
  const canProceed = quoteCurrent && !quoteState.expired && !submitting && !quoteState.pending && !quoteState.loading;
  const canSubmit = canProceed;
  const rawInr = quote ? quote.gross_amount : '—';
  const feeAmount = quote ? quote.fee_deducted : '—';
  const receiveAmountUsd = quote ? quote.recipient_amount : '—';
  const convertedInr = quote ? quote.net_amount : '—';
  const handleRecipientChange = text => { if (flow.setInput(text,sendAmountInr)) setRecipient(text); };
  const handleAmountChange = text => {
    const value = text.replace(/[^0-9.]/g, '');
    if (flow.setInput(recipient,value)) setSendAmountInr(value);
  };
  const loadQuote = () => { flow.setInput(recipient,sendAmountInr); return flow.loadQuote(); };
  const handleStep3Proceed = () => {
    if (!canProceed) return;
    if (!flow.accept()) {
      setError('Unable to confirm quote. Please try again.');
      return;
    }
    setAppStep(4);
  };
  const acceptQuote = handleStep3Proceed;

  const formatNum = (num) => {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const [paymentMethod, setPaymentMethod] = useState('');
  const [upiId, setUpiId] = useState('');
  const [isUpiVerified, setIsUpiVerified] = useState(false);
  
  const [indianAccountName, setIndianAccountName] = useState('');
  const [indianBankName, setIndianBankName] = useState('');
  const [indianAccount, setIndianAccount] = useState('');
  const [ifscCode, setIfscCode] = useState('');

  const [transactions, setTransactions] = useState([]);

  const fetchTransactions = async () => {
    setLoading(true); setError('');
    try {
      const rows = await api.history();
      setTransactions(rows.map(tx => ({
        id: tx.transaction_id,
        recipient_name: tx.recipient_name,
        gross_amount: Number(tx.gross_amount) || 0,
        recipient_amount: Number(tx.recipient_amount) || 0,
        status: tx.status || 'SIMULATED',
        created_at: tx.created_at,
        dateLabel: tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-US') : 'Recent',
        route: `Transfer to ${tx.recipient_name} (Simulated)`,
        amount: `- ${tx.source_currency || 'INR'} ${formatNum(tx.gross_amount)}`,
        isPositive: false
      })));
    } catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchTransactions(); }, []);

  const handleProceedFromPayment = async () => {
    if (!canProceed) { setError('A valid quote is required before proceeding.'); return; }
    if (!paymentMethod || (paymentMethod === 'upi' && !isUpiVerified)) {
      setError('Please select and verify a payment method.');
      return;
    }
    if (!quoteState.accepted) {
      const ok = flow.accept();
      if (!ok) {
        setError('Unable to confirm quote. Please review the updated quote.');
        return;
      }
    }
    if (paymentMethod === 'netbanking') {
      setAppStep(5);
    } else {
      await handleTransferSubmit();
    }
  };
  const handleIndianBankSubmit = async () => {
    if (!canProceed) { setError('A valid quote is required before proceeding.'); return; }
    if (!indianAccountName || !indianBankName || !indianAccount || !ifscCode) {
      setError('Please enter all Indian bank details.');
      return;
    }
    if (!quoteState.accepted) {
      const ok = flow.accept();
      if (!ok) {
        setError('Unable to confirm quote. Please review the updated quote.');
        return;
      }
    }
    await handleTransferSubmit();
  };
  const handleTransferSubmit = async (retry = false) => {
    if (submitting) return; // Prevent duplicate submissions from rapid repeated clicks
    setError('');
    const transaction = await (retry === true ? flow.retryPending() : flow.submit());
    if (transaction) {
      setReceipt(transaction);
      setAppStep(6);
      await fetchTransactions();
    }
  };

  const [userName, setUserName] = useState('');
  useEffect(() => {
    if (typeof api.session === 'function') {
      api.session().then(s => {
        if (s?.fullName && typeof s.fullName === 'string' && s.fullName.trim()) {
          setUserName(s.fullName.trim());
        }
      }).catch(() => {});
    }
  }, []);
  const displayName = userName && userName.trim() ? userName.trim() : 'User';


  const [referenceRate, setReferenceRate] = useState(quote ? quote.exchange_rate : null);
  useEffect(() => {
    let active = true;
    const fetchRate = async () => {
      try {
        if (typeof api.rate === 'function') {
          const data = await api.rate();
          if (active && data?.inr_per_usd) {
            setReferenceRate(data.inr_per_usd);
            if (data.observed_at) setRateObservedAt(data.observed_at);
            setRateUnavailable(false);
            return;
          }
        }
      } catch (_) {}
      try {
        if (typeof api.config === 'function') {
          const data = await api.config();
          if (active && data?.inr_per_usd) {
            setReferenceRate(data.inr_per_usd);
            setRateUnavailable(false);
            return;
          }
        }
      } catch (_) {
        if (active) setRateUnavailable(true);
      }
    };
    fetchRate();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (quote?.exchange_rate) setReferenceRate(quote.exchange_rate);
  }, [quote]);

  const [aiEnabled, setAiEnabled] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [rateObservedAt, setRateObservedAt] = useState(null);
  const [rateUnavailable, setRateUnavailable] = useState(false);
  const handleLogout = async () => {
    setShowProfileModal(false);
    await api.logout();
    navigation.replace('Login');
  };

  const totalTransfers = transactions.length;
  const totalInrSubmitted = transactions.reduce((sum, tx) => sum + (Number(tx.gross_amount) || 0), 0);
  const totalUsdPayout = transactions.reduce((sum, tx) => sum + (Number(tx.recipient_amount) || 0), 0);
  const mostRecentDate = transactions.length > 0 && transactions[0].created_at
    ? new Date(transactions[0].created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const formattedRateDate = rateObservedAt
    ? `${new Date(rateObservedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${new Date(rateObservedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Today (Live Reference)';
  useEffect(() => {
    if (typeof api.aiHealth === 'function') {
      api.aiHealth().then(h => {
        if (h && h.status === 'ok') setAiEnabled(true);
      }).catch(() => {});
    }
  }, []);

  // Debounced auto-quote on valid amount & recipient change
  useEffect(() => {
    if (!recipient.trim() || !sendAmountInr) return;
    const timer = setTimeout(() => {
      flow.setInput(recipient, sendAmountInr);
      flow.loadQuote();
    }, 400);
    return () => clearTimeout(timer);
  }, [sendAmountInr, recipient, appStep]);

  // Auto-refresh expired quote if on steps 3, 4, or 5
  useEffect(() => {
    if (appStep >= 3 && appStep <= 5 && quoteState.expired && recipient.trim() && sendAmountInr && !submitting && !quoteState.pending) {
      flow.setInput(recipient, sendAmountInr);
      flow.loadQuote();
    }
  }, [quoteState.expired, appStep, recipient, sendAmountInr, submitting, quoteState.pending]);

  const resetFlow = () => {
    if (!flow.reset()) return;
    setReceipt(null); setError('');
    setAppStep(1); 
    setPaymentMethod(''); 
    setIsUpiVerified(false); 
    flow.setInput(recipient,'100000'); setSendAmountInr('100000');
    setIndianAccountName('');
    setIndianBankName('');
    setIndianAccount('');
    setIfscCode('');
  };

  const currentRate = quote ? quote.exchange_rate : referenceRate ? referenceRate : null;
  const rateDisplay = currentRate ? `1 USD = ₹${currentRate}` : 'Loading daily reference rate...';
  const quoteBanner = (
    <View style={styles.rateBanner}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#2B6CB0', marginBottom: 4, letterSpacing: 0.5 }}>
        USD/INR Exchange Rate
      </Text>
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A365D' }}>
        {rateDisplay}
      </Text>
      {quoteState.loading && <Text style={{ fontSize: 12, color: '#4A5568', marginTop: 2 }}>Updating rate...</Text>}
    </View>
  );

  const rateFooter = (
    <View style={{ marginTop: 12, alignItems: 'center', paddingHorizontal: 8 }}>
      <Text
        accessibilityRole="link"
        style={{ fontSize: 12, color: '#718096', textDecorationLine: 'underline' }}
        {...(Platform.OS === 'web'
          ? { href: ATTRIBUTION_URL, hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } }
          : { onPress: () => Linking.openURL(ATTRIBUTION_URL).catch(() => setError('Could not open provider attribution.')) })}
      >
        {ATTRIBUTION_TEXT}
      </Text>
    </View>
  );

  const alerts = (
    <View>
      {!!(error || quoteState.error) && (
        <View style={extraStyles.errorBanner} accessibilityRole="alert">
          <Text style={extraStyles.errorBannerText}>&#9888; {error || quoteState.error}</Text>
        </View>
      )}
      {quoteState.pending && (
        <TouchableOpacity
          style={extraStyles.pendingBanner}
          disabled={submitting}
          onPress={() => handleTransferSubmit(true)}
          accessibilityRole="button"
        >
          <Text style={extraStyles.pendingBannerText}>Check previous attempt using the original request &rarr;</Text>
        </TouchableOpacity>
      )}
      {receipt && (
        <View style={extraStyles.receiptBanner}>
          <Text style={extraStyles.receiptBannerText}>
            Transfer Initiated: {receipt.recipient_amount} {receipt.target_currency} (Simulation mode; no live funds moved).
          </Text>
        </View>
      )}
      {(loading || submitting) && (
        <View style={extraStyles.loadingBanner}>
          <Text style={extraStyles.loadingBannerText}>
            {loading ? 'Loading history...' : 'Processing transfer...'}
          </Text>
        </View>
      )}
    </View>
  );

  if (isDesktop) {
    return (
      <SafeAreaView style={[styles.desktopContainer, Platform.OS === 'web' && { height: '100vh', maxHeight: '100vh', overflow: 'hidden' }]}>
        <View style={styles.desktopSidebar}>
          <View>
            <Image source={require('../assets/logo1.png')} style={styles.desktopLogo} />
            <View style={styles.desktopNavMenu}>
              <TouchableOpacity style={[styles.navItem, appStep === 1 && styles.navItemActive]} onPress={() => setAppStep(1)}>
                <View style={extraStyles.navIconWrap}>
                  <HomeIcon size={19} color={appStep === 1 ? '#0047AB' : '#64748B'} />
                </View>
                <Text style={[styles.navText, appStep === 1 && styles.navTextActive]}>Home</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.navItem, (appStep > 1 && appStep < 7) && styles.navItemActive]} onPress={() => setAppStep(2)}>
                <View style={extraStyles.navIconWrap}>
                  <SendMoneyIcon size={19} color={(appStep > 1 && appStep < 7) ? '#0047AB' : '#64748B'} />
                </View>
                <Text style={[styles.navText, (appStep > 1 && appStep < 7) && styles.navTextActive]}>Send Money</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.navItem, appStep === 7 && styles.navItemActive]} onPress={() => setAppStep(7)}>
                <View style={extraStyles.navIconWrap}>
                  <HistoryIcon size={19} color={appStep === 7 ? '#0047AB' : '#64748B'} />
                </View>
                <Text style={[styles.navText, appStep === 7 && styles.navTextActive]}>History</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => navigation.navigate('AIAssistant')}
                accessibilityRole="button"
                accessibilityLabel="ZettaAI Assistant"
              >
                <View style={extraStyles.navIconWrap}>
                  <AssistantIcon size={19} color="#003DA5" />
                </View>
                <Text style={styles.navText}>ZettaAI Assistant</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={() => {
              api.logout();
              navigation.replace('Login');
          }}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.desktopMainContent}>
          {alerts}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.desktopScrollContent} showsVerticalScrollIndicator={true}>
            
            {appStep === 1 && (
              <View>
                <View style={styles.desktopBlueBanner}>
                  <View style={styles.bannerTopRow}>
                    <View style={styles.profileInfo}>
                      <View style={styles.avatarPlaceholder}>
                        <ProfileIcon size={20} color="#003DA5" />
                      </View>
                      <Text style={styles.greetingText}>Hi, {displayName}</Text>
                    </View>
                  </View>
                  <View style={extraStyles.heroRateBox}>
                    <Text style={extraStyles.heroRateHeading}>INR → USD Reference Rate</Text>
                    {rateUnavailable ? (
                      <Text style={extraStyles.heroRateError}>Exchange rate temporarily unavailable</Text>
                    ) : (
                      <View style={extraStyles.heroRateCenter}>
                        <Text style={extraStyles.heroRateNumber}>
                          {referenceRate ? `1 USD = ₹${referenceRate}` : 'Loading reference rate...'}
                        </Text>
                        <Text style={extraStyles.heroRateSub}>
                          {rateObservedAt ? `Last updated: ${formattedRateDate}` : 'Indicative daily reference rate'}
                        </Text>
                      </View>
                    )}
                    <Text style={extraStyles.heroRateNote}>
                      Indicative reference rate · Quotes locked upon transfer
                    </Text>
                  </View>
                </View>

                <View style={[styles.desktopFloatingCardsRow, { gap: 20, marginTop: -44, zIndex: 10 }]}>
                  <TouchableOpacity style={[styles.desktopActionCard, extraStyles.desktopActionCardRefined]} onPress={() => setAppStep(2)} activeOpacity={0.85}>
                    <View style={extraStyles.desktopActionIconWrap}>
                      <SendMoneyIcon size={24} color="#003DA5" />
                    </View>
                    <Text style={[styles.desktopActionText, extraStyles.desktopActionTextRefined]}>Send Money</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.desktopActionCard, extraStyles.desktopActionCardRefined]} onPress={() => setAppStep(7)} activeOpacity={0.85}>
                    <View style={extraStyles.desktopActionIconWrap}>
                      <HistoryIcon size={24} color="#003DA5" />
                    </View>
                    <Text style={[styles.desktopActionText, extraStyles.desktopActionTextRefined]}>Transaction History</Text>
                  </TouchableOpacity>
                  {aiEnabled && (
                    <TouchableOpacity style={[styles.desktopActionCard, extraStyles.desktopActionCardRefined]} onPress={() => navigation.navigate('AIAssistant')} activeOpacity={0.85}>
                      <View style={extraStyles.desktopActionIconWrap}>
                        <AssistantIcon size={24} color="#003DA5" />
                      </View>
                      <Text style={[styles.desktopActionText, extraStyles.desktopActionTextRefined]}>AI Assistant</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Account Activity Summary */}
                <View style={extraStyles.desktopActivitySection}>
                  <View style={extraStyles.activityHeaderRow}>
                    <Text style={extraStyles.activitySectionTitle}>Account Activity (Simulated)</Text>
                    {mostRecentDate && (
                      <Text style={extraStyles.activityLatestDate}>Latest transfer: {mostRecentDate}</Text>
                    )}
                  </View>
                  {totalTransfers === 0 ? (
                    <View style={extraStyles.emptyActivityCard}>
                      <Text style={extraStyles.emptyActivityText}>
                        No transfers yet. Start your first transfer to see your activity here.
                      </Text>
                    </View>
                  ) : (
                    <View style={extraStyles.activityCardsRow}>
                      <View style={extraStyles.activityCard}>
                        <Text style={extraStyles.activityCardLabel}>Transfers Initiated</Text>
                        <Text style={extraStyles.activityCardValue}>{totalTransfers}</Text>
                        <Text style={extraStyles.activityCardSub}>Simulated transfers</Text>
                      </View>
                      <View style={extraStyles.activityCard}>
                        <Text style={extraStyles.activityCardLabel}>Total Sent (INR)</Text>
                        <Text style={extraStyles.activityCardValue}>₹ {formatNum(totalInrSubmitted.toFixed(2))}</Text>
                        <Text style={extraStyles.activityCardSub}>Gross INR submitted</Text>
                      </View>
                      <View style={extraStyles.activityCard}>
                        <Text style={extraStyles.activityCardLabel}>Total Payout (USD)</Text>
                        <Text style={[extraStyles.activityCardValue, { color: '#059669' }]}>
                          $ {formatNum(totalUsdPayout.toFixed(2))}
                        </Text>
                        <Text style={extraStyles.activityCardSub}>Est. recipient USD</Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.desktopHistoryContainer}>
                  <View style={extraStyles.recentTxHeaderRow}>
                    <Text style={extraStyles.recentTxTitle}>Recent Transfers</Text>
                    <TouchableOpacity onPress={() => setAppStep(7)} activeOpacity={0.7}>
                      <Text style={extraStyles.viewAllLink}>View all →</Text>
                    </TouchableOpacity>
                  </View>
                  {transactions.map((tx, index) => (
                    <View key={index} style={styles.desktopTxGroup}>
                      {(index === 0 || transactions[index - 1].dateLabel !== tx.dateLabel) && (
                        <Text style={styles.txDateHeader}>{tx.dateLabel}</Text>
                      )}
                      <View style={styles.desktopTxRow}>
                        <View>
                          <Text style={styles.txTitle}>{tx.route}</Text>
                          <Text style={styles.txRef}>{tx.id}</Text>
                        </View>
                        <Text style={[styles.txAmount, tx.isPositive ? styles.textGreen : styles.textRed]}>
                          {tx.amount}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {transactions.length === 0 && (
                    <Text style={{textAlign: 'center', color: '#A0AEC0', paddingVertical: 20}}>No transfers yet. Start your first transfer to see your activity here.</Text>
                  )}
                </View>
              </View>
            )}

            {(appStep > 1 && appStep < 7) && (
              <View style={styles.desktopWizardContainer}>
                <View style={styles.desktopWizardCard}>
                  
                  {appStep === 2 && (
                    <View>
                      <View style={styles.wizardHeader}>
                        <TouchableOpacity onPress={() => setAppStep(1)}><Text style={styles.backArrow}>&lt;</Text></TouchableOpacity>
                        <Text style={styles.wizardTitle}>Receiver Information</Text>
                      </View>
                      <TextInput style={styles.inputBox} placeholder="Recipient Legal Name" placeholderTextColor="#A0AEC0" value={recipient} onChangeText={handleRecipientChange} />
                      <TextInput style={styles.inputBox} placeholder="Account Number" placeholderTextColor="#A0AEC0" value={account} onChangeText={setAccount} />
                      <TextInput style={styles.inputBox} placeholder="Routing Number (ACH / ABA)" placeholderTextColor="#A0AEC0" value={routing} onChangeText={setRouting} />
                      <TextInput style={styles.inputBox} placeholder="SWIFT Code" placeholderTextColor="#A0AEC0" autoCapitalize="characters" value={swift} onChangeText={setSwift} />
                      <TouchableOpacity style={styles.primaryButton} onPress={() => setAppStep(3)}><Text style={styles.primaryButtonText}>Save recipient and proceed</Text></TouchableOpacity>
                    </View>
                  )}

                  {appStep === 3 && (
                    <View>
                      <View style={styles.wizardHeader}>
                        <TouchableOpacity onPress={() => setAppStep(2)}><Text style={styles.backArrow}>&lt;</Text></TouchableOpacity>
                        <Text style={styles.wizardTitle}>Send Money to USA</Text>
                      </View>
                      {quoteBanner}
                      <Text style={styles.inputLabel}>You'll be sending (INR)</Text>
                      <View style={styles.currencyInputRow}>
                        <TextInput style={styles.currencyInput} value={sendAmountInr} onChangeText={handleAmountChange} keyboardType="numeric" />
                        <Text style={styles.currencyTag}>INR</Text>
                      </View>
                      <Text style={styles.inputLabel}>Recipient gets (USD)</Text>
                      <View style={[styles.currencyInputRow, styles.currencyInputRowDisabled]}>
                        <TextInput style={styles.currencyInputDisabled} value={`$ ${formatNum(receiveAmountUsd)}`} editable={false} />
                        <Text style={styles.currencyTag}>USD</Text>
                      </View>
                      <View style={styles.summaryCard}>
                        <View style={styles.summaryRow}><Text style={styles.summaryText}>Amount sent</Text><Text style={styles.summaryTextBold}>₹ {formatNum(rawInr)}</Text></View>
                        <View style={styles.summaryRow}><Text style={styles.summaryText}>ZettaRemit fee (3%)</Text><Text style={styles.textRed}>- ₹ {quote ? formatNum(quote.fee_deducted) : formatNum(feeAmount)}</Text></View>
                        <View style={styles.summaryRow}><Text style={styles.summaryText}>Net INR</Text><Text style={styles.summaryTextBold}>₹ {quote ? formatNum(quote.net_amount) : formatNum(convertedInr)}</Text></View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryRow}><Text style={styles.summaryText}>Converted amount (USD payout)</Text><Text style={styles.textGreenLg}>$ {quote ? formatNum(quote.recipient_amount) : formatNum(receiveAmountUsd)}</Text></View>
                        <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#EDF2F7', flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                          <Text style={{ fontSize: 12, color: '#718096' }}>
                            3% fee: INR {quote ? quote.fee_deducted : formatNum(feeAmount)} · Net INR: {quote ? quote.net_amount : formatNum(convertedInr)} · USD payout: {quote ? quote.recipient_amount : formatNum(receiveAmountUsd)}
                          </Text>
                          {quote && (
                            <Text style={{ fontSize: 12, color: quoteCurrent ? '#718096' : '#C53030' }}>
                              {quoteCurrent ? 'Quote expires' : 'Quote expired'}: {new Date(quote.expires_at).toLocaleTimeString()}
                            </Text>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity style={[styles.primaryButton, !canProceed && styles.buttonDisabled]} onPress={handleStep3Proceed} disabled={!canProceed}><Text style={styles.primaryButtonText}>Proceed</Text></TouchableOpacity>
                      {rateFooter}
                    </View>
                  )}

                  {appStep === 4 && (
                    <View>
                      <View style={styles.wizardHeader}>
                        <TouchableOpacity onPress={() => setAppStep(3)}><Text style={styles.backArrow}>&lt;</Text></TouchableOpacity>
                        <Text style={styles.wizardTitle}>Select Payment Method</Text>
                      </View>
                      {quoteBanner}
                      <TouchableOpacity style={styles.paymentOptionBox} onPress={() => setPaymentMethod('upi')} activeOpacity={0.9}>
                        <View style={styles.paymentOptionHeader}>
                          <View style={extraStyles.paymentIconBox}>
                            <PhoneUpiIcon size={22} color="#003DA5" />
                          </View>
                          <View style={styles.paymentTextCol}><Text style={styles.paymentMethodTitle}>UPI ID</Text><Text style={styles.paymentMethodDesc}>Phonepe, Gpay, Paytm, BHIM & more</Text></View>
                          <View style={[styles.radioCircle, paymentMethod === 'upi' && styles.radioCircleSelected]}>{paymentMethod === 'upi' && <View style={styles.radioInner} />}</View>
                        </View>
                        {paymentMethod === 'upi' && (
                          <View style={styles.expandedPaymentArea}>
                            <TextInput style={styles.inputBox} placeholder="UPI ID (e.g., username@upi)" placeholderTextColor="#A0AEC0" value={upiId} onChangeText={(text) => {setUpiId(text); setIsUpiVerified(false);}} autoCapitalize="none" />
                            {!isUpiVerified ? (<TouchableOpacity style={styles.verifyButton} onPress={() => setIsUpiVerified(true)}><Text style={styles.verifyButtonText}>Confirm UPI ID (Demo)</Text></TouchableOpacity>) : (<Text style={styles.verifiedText}>UPI ID Confirmed (Simulated)</Text>)}
                          </View>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.paymentOptionBox} onPress={() => setPaymentMethod('netbanking')} activeOpacity={0.9}>
                        <View style={styles.paymentOptionHeader}>
                          <View style={extraStyles.paymentIconBox}>
                            <BankNetIcon size={22} color="#003DA5" />
                          </View>
                          <View style={styles.paymentTextCol}><Text style={styles.paymentMethodTitle}>Net Banking</Text><Text style={styles.paymentMethodDesc}>Simulated transfer via Indian net banking</Text></View>
                          <View style={[styles.radioCircle, paymentMethod === 'netbanking' && styles.radioCircleSelected]}>{paymentMethod === 'netbanking' && <View style={styles.radioInner} />}</View>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.primaryButton, (!paymentMethod || (paymentMethod === 'upi' && !isUpiVerified)) && styles.buttonDisabled]} onPress={handleProceedFromPayment} disabled={!canSubmit || !paymentMethod || (paymentMethod === 'upi' && !isUpiVerified)}>
                        <Text style={styles.primaryButtonText}>Proceed</Text>
                      </TouchableOpacity>
                      
                      {rateFooter}
                    </View>
                  )}

                  {appStep === 5 && (
                    <View>
                      <View style={styles.wizardHeader}>
                        <TouchableOpacity onPress={() => setAppStep(4)}><Text style={styles.backArrow}>&lt;</Text></TouchableOpacity>
                        <Text style={styles.wizardTitle}>Enter Indian Bank Details</Text>
                      </View>
                      <Text style={{ fontSize: 13, color: '#4A5568', textAlign: 'center', marginBottom: 12 }}>Demo Mode: Use fictional test bank details. No real bank accounts are connected or debited.</Text>
                      {quoteBanner}
                      <TextInput style={styles.inputBox} placeholder="Fictional Account Holder Name" placeholderTextColor="#A0AEC0" value={indianAccountName} onChangeText={setIndianAccountName} />
                      <TextInput style={styles.inputBox} placeholder="Bank Name (e.g., SBI, HDFC)" placeholderTextColor="#A0AEC0" value={indianBankName} onChangeText={setIndianBankName} />
                      <TextInput style={styles.inputBox} placeholder="Fictional Account Number" placeholderTextColor="#A0AEC0" value={indianAccount} onChangeText={setIndianAccount} keyboardType="number-pad" />
                      <TextInput style={styles.inputBox} placeholder="IFSC Code (e.g., SBIN0001234)" placeholderTextColor="#A0AEC0" autoCapitalize="characters" value={ifscCode} onChangeText={setIfscCode} />
                      <Text style={extraStyles.submissionDisclosure}>
                        Simulation Notice: This transfer is processed in simulation mode. No real money or bank accounts will be debited.
                      </Text>
                      <TouchableOpacity style={[styles.primaryButton, (!indianAccountName || !indianBankName || !indianAccount || !ifscCode) && styles.buttonDisabled]} onPress={handleIndianBankSubmit} disabled={!canProceed || (!indianAccountName || !indianBankName || !indianAccount || !ifscCode)}>
                        <Text style={styles.primaryButtonText}>Confirm Simulated Transfer (₹ {formatNum(rawInr)})</Text>
                      </TouchableOpacity>
                      
                      {rateFooter}
                    </View>
                  )}

                  {appStep === 6 && (
                    <View style={{alignItems: 'center', paddingVertical: 40}}>
                      <View style={{marginBottom: 20}}>
                        <SuccessCheckIcon size={56} color="#10B981" />
                      </View>
                      <Text style={{fontSize: 22, fontWeight: '700', color: '#1A202C', marginBottom: 10}}>Transfer Submitted</Text>
                      <Text style={{fontSize: 15, color: '#718096', textAlign: 'center', marginBottom: 30}}>Your transfer has been successfully initiated in simulation mode. No live funds were moved.</Text>
                      <TouchableOpacity style={styles.primaryButton} onPress={resetFlow}><Text style={styles.primaryButtonText}>Go back to home</Text></TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}

            {appStep === 7 && (
              <View style={styles.desktopWizardContainer}>
                <View style={[styles.desktopWizardCard, {maxWidth: 800}]}>
                  <View style={styles.wizardHeader}>
                    <TouchableOpacity onPress={() => setAppStep(1)}><Text style={styles.backArrow}>&lt;</Text></TouchableOpacity>
                    <Text style={styles.wizardTitle}>Complete Transaction History</Text>
                  </View>
                  
                  {transactions.map((tx, index) => (
                    <View key={index} style={styles.desktopTxGroup}>
                      {(index === 0 || transactions[index - 1].dateLabel !== tx.dateLabel) && (
                        <Text style={styles.txDateHeader}>{tx.dateLabel}</Text>
                      )}
                      <View style={styles.desktopTxRow}>
                        <View>
                          <Text style={styles.txTitle}>{tx.route}</Text>
                          <Text style={styles.txRef}>{tx.id}</Text>
                        </View>
                        <Text style={[styles.txAmount, tx.isPositive ? styles.textGreen : styles.textRed]}>
                          {tx.amount}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {transactions.length === 0 && (
                    <Text style={{textAlign: 'center', color: '#A0AEC0', paddingVertical: 20}}>No transfers yet. Start your first transfer to see your activity here.</Text>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, Platform.OS === 'web' && { height: '100vh', maxHeight: '100vh', overflow: 'hidden' }]}>
      {alerts}
      <StatusBar barStyle={appStep === 1 ? "light-content" : "dark-content"} backgroundColor={appStep === 1 ? "#003DA5" : "#FFFFFF"} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollWrapper} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true}>
          
          {appStep === 1 && (
            <View style={styles.fullHeight}>
              <View style={styles.blueHeaderBlock}>
                <View style={styles.headerTopRow}>
                  <TouchableOpacity style={styles.profileInfo} onPress={() => setShowProfileModal(true)} activeOpacity={0.8} accessibilityRole="button">
                    <View style={styles.avatarPlaceholder}>
                      <ProfileIcon size={18} color="#003DA5" />
                    </View>
                    <Text style={styles.greetingText}>Hi, {displayName}</Text>
                  </TouchableOpacity>
                </View>
                <View style={extraStyles.mobileHeroRateBox}>
                  <Text style={extraStyles.mobileHeroRateHeading}>INR → USD Reference Rate</Text>
                  {rateUnavailable ? (
                    <Text style={extraStyles.heroRateError}>Exchange rate temporarily unavailable</Text>
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={extraStyles.mobileHeroRateNumber}>
                        {referenceRate ? `1 USD = ₹${referenceRate}` : 'Loading reference rate...'}
                      </Text>
                      <Text style={extraStyles.mobileHeroRateSub}>
                        {rateObservedAt ? `Last updated: ${formattedRateDate}` : 'Indicative daily reference rate'}
                      </Text>
                    </View>
                  )}
                  <Text style={extraStyles.mobileHeroRateNote}>
                    Indicative reference rate · Quotes locked upon transfer
                  </Text>
                </View>
              </View>
              
              <View style={[styles.floatingCardsRow, { gap: 10, paddingHorizontal: 16, marginTop: -36, zIndex: 10 }]}>
                <TouchableOpacity style={[styles.quickActionCard, extraStyles.quickActionCardRefined]} onPress={() => setAppStep(2)} activeOpacity={0.85}>
                  <View style={extraStyles.quickActionIconWrap}>
                    <SendMoneyIcon size={20} color="#003DA5" />
                  </View>
                  <Text style={[styles.quickActionText, extraStyles.quickActionTextRefined]}>Send Money</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.quickActionCard, extraStyles.quickActionCardRefined]} onPress={() => setAppStep(7)} activeOpacity={0.85}>
                  <View style={extraStyles.quickActionIconWrap}>
                    <HistoryIcon size={20} color="#003DA5" />
                  </View>
                  <Text style={[styles.quickActionText, extraStyles.quickActionTextRefined]}>Transaction History</Text>
                </TouchableOpacity>
                {aiEnabled && (
                  <TouchableOpacity style={[styles.quickActionCard, extraStyles.quickActionCardRefined]} onPress={() => navigation.navigate('AIAssistant')} activeOpacity={0.85}>
                    <View style={extraStyles.quickActionIconWrap}>
                      <AssistantIcon size={20} color="#003DA5" />
                    </View>
                    <Text style={[styles.quickActionText, extraStyles.quickActionTextRefined]}>AI Assistant</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Mobile Account Activity Summary */}
              <View style={extraStyles.mobileActivityContainer}>
                <View style={extraStyles.activityHeaderRow}>
                  <Text style={extraStyles.mobileActivityTitle}>Account Activity (Simulated)</Text>
                  {mostRecentDate && (
                    <Text style={extraStyles.mobileActivityDate}>Latest: {mostRecentDate}</Text>
                  )}
                </View>
                {totalTransfers === 0 ? (
                  <View style={extraStyles.mobileEmptyActivityCard}>
                    <Text style={extraStyles.emptyActivityText}>
                      No transfers yet. Start your first transfer to see your activity here.
                    </Text>
                  </View>
                ) : (
                  <View style={extraStyles.mobileActivityGrid}>
                    <View style={extraStyles.mobileActivityItem}>
                      <Text style={extraStyles.mobileActivityItemLabel}>Transfers</Text>
                      <Text style={extraStyles.mobileActivityItemValue}>{totalTransfers}</Text>
                    </View>
                    <View style={extraStyles.mobileActivityItem}>
                      <Text style={extraStyles.mobileActivityItemLabel}>Total Sent</Text>
                      <Text style={extraStyles.mobileActivityItemValue}>₹ {formatNum(totalInrSubmitted.toFixed(0))}</Text>
                    </View>
                    <View style={extraStyles.mobileActivityItem}>
                      <Text style={extraStyles.mobileActivityItemLabel}>Est. Payout</Text>
                      <Text style={[extraStyles.mobileActivityItemValue, { color: '#059669' }]}>
                        $ {formatNum(totalUsdPayout.toFixed(2))}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.transactionListContainer}>
                <View style={extraStyles.recentTxHeaderRow}>
                  <Text style={extraStyles.recentTxTitle}>Recent Transfers</Text>
                  <TouchableOpacity onPress={() => setAppStep(7)} activeOpacity={0.7}>
                    <Text style={extraStyles.viewAllLink}>View all →</Text>
                  </TouchableOpacity>
                </View>
                {transactions.map((tx, index) => (
                  <View key={index}>
                    {(index === 0 || transactions[index - 1].dateLabel !== tx.dateLabel) && (
                      <Text style={styles.txDateHeader}>{tx.dateLabel}</Text>
                    )}
                    <View style={styles.txRow}>
                      <View>
                        <Text style={styles.txTitle}>{tx.route}</Text>
                        <Text style={styles.txRef}>{tx.id}</Text>
                      </View>
                      <Text style={[styles.txAmount, tx.isPositive ? styles.textGreen : styles.textRed]}>
                        {tx.amount}
                      </Text>
                    </View>
                  </View>
                ))}
                {transactions.length === 0 && (
                  <Text style={{textAlign: 'center', color: '#A0AEC0', paddingVertical: 20}}>No transfers yet. Start your first transfer to see your activity here.</Text>
                )}
              </View>

              <View style={[styles.bottomNavBar, extraStyles.bottomNavBarRefined]}>
                 <TouchableOpacity style={[styles.navTabActive, extraStyles.navTabActiveRefined]} onPress={() => setAppStep(1)}>
                    <View style={{ marginRight: 6 }}>
                      <HomeIcon size={16} color="#FFFFFF" />
                    </View>
                    <Text style={styles.navTabTextActive}>Home</Text>
                 </TouchableOpacity>
                 <TouchableOpacity
                   style={styles.navTab}
                   onPress={() => navigation.navigate('AIAssistant')}
                   accessibilityRole="button"
                   accessibilityLabel="ZettaAI Assistant"
                 >
                    <View style={extraStyles.navTabIconWrap}>
                      <AssistantIcon size={18} color="#003DA5" />
                    </View>
                    <Text style={styles.navTabText}>ZettaAI</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={styles.navTab} onPress={() => setShowProfileModal(true)} accessibilityRole="button">
                    <View style={extraStyles.navTabIconWrap}>
                      <ProfileIcon size={18} color="#64748B" />
                    </View>
                    <Text style={styles.navTabText}>Profile</Text>
                 </TouchableOpacity>
              </View>

              <SafeModal
                visible={showProfileModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowProfileModal(false)}
              >
                <TouchableOpacity
                  style={extraStyles.modalBackdrop}
                  activeOpacity={1}
                  onPress={() => setShowProfileModal(false)}
                >
                  <TouchableOpacity
                    activeOpacity={1}
                    style={extraStyles.profileModalCard}
                    onPress={(e) => e && e.stopPropagation && e.stopPropagation()}
                  >
                    <View style={extraStyles.profileModalHeader}>
                      <View style={extraStyles.modalAvatarWrap}>
                        <ProfileIcon size={28} color="#003DA5" />
                      </View>
                      <Text style={extraStyles.profileModalName}>{displayName}</Text>
                      <Text style={extraStyles.profileModalSub}>Simulation Account</Text>
                    </View>

                    <View style={extraStyles.profileModalDivider} />

                    <TouchableOpacity
                      style={extraStyles.modalLogoutButton}
                      onPress={handleLogout}
                      accessibilityRole="button"
                    >
                      <Text style={extraStyles.modalLogoutText}>Log Out</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={extraStyles.modalCancelButton}
                      onPress={() => setShowProfileModal(false)}
                      accessibilityRole="button"
                    >
                      <Text style={extraStyles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                </TouchableOpacity>
              </SafeModal>
            </View>
          )}

          {(appStep > 1 && appStep < 7) && (
            <View style={styles.wizardPad}>
              {appStep === 2 && (
                <View>
                  <View style={styles.wizardHeader}>
                    <TouchableOpacity onPress={() => setAppStep(1)}><Text style={styles.backArrow}>&lt;</Text></TouchableOpacity>
                    <Text style={styles.wizardTitle}>Receiver Information</Text>
                  </View>
                  <TextInput style={styles.inputBox} placeholder="Recipient Legal Name" placeholderTextColor="#A0AEC0" value={recipient} onChangeText={handleRecipientChange} />
                  <TextInput style={styles.inputBox} placeholder="Account Number" placeholderTextColor="#A0AEC0" keyboardType="number-pad" value={account} onChangeText={setAccount} />
                  <TextInput style={styles.inputBox} placeholder="Routing Number (ACH / ABA)" placeholderTextColor="#A0AEC0" keyboardType="number-pad" value={routing} onChangeText={setRouting} />
                  <TextInput style={styles.inputBox} placeholder="SWIFT Code" placeholderTextColor="#A0AEC0" autoCapitalize="characters" value={swift} onChangeText={setSwift} />
                  <TouchableOpacity style={styles.primaryButton} onPress={() => setAppStep(3)}><Text style={styles.primaryButtonText}>Save recipient and proceed</Text></TouchableOpacity>
                </View>
              )}

              {appStep === 3 && (
                <View>
                  <View style={styles.wizardHeader}>
                    <TouchableOpacity onPress={() => setAppStep(2)}><Text style={styles.backArrow}>&lt;</Text></TouchableOpacity>
                    <Text style={styles.wizardTitle}>Send Money to USA</Text>
                  </View>
                  {quoteBanner}
                  <Text style={styles.inputLabel}>You'll be sending (INR)</Text>
                  <View style={styles.currencyInputRow}>
                    <TextInput style={styles.currencyInput} value={sendAmountInr} onChangeText={handleAmountChange} keyboardType="numeric" />
                    <Text style={styles.currencyTag}>INR ▾</Text>
                  </View>
                  <Text style={styles.inputLabel}>Recipient gets (USD)</Text>
                  <View style={[styles.currencyInputRow, styles.currencyInputRowDisabled]}>
                    <TextInput style={styles.currencyInputDisabled} value={`$ ${formatNum(receiveAmountUsd)}`} editable={false} />
                    <Text style={styles.currencyTag}>USD ▾</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Transfer Summary</Text>
                    <View style={styles.summaryRow}><Text style={styles.summaryText}>Amount sent</Text><Text style={styles.summaryTextBold}>₹ {formatNum(rawInr)}</Text></View>
                    <View style={styles.summaryRow}><Text style={styles.summaryText}>ZettaRemit fee (3%)</Text><Text style={styles.textRed}>- ₹ {quote ? formatNum(quote.fee_deducted) : formatNum(feeAmount)}</Text></View>
                    <View style={styles.summaryRow}><Text style={styles.summaryText}>Net INR</Text><Text style={styles.summaryTextBold}>₹ {quote ? formatNum(quote.net_amount) : formatNum(convertedInr)}</Text></View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}><Text style={styles.summaryText}>Converted amount (USD payout)</Text><View style={{alignItems: 'flex-end'}}><Text style={styles.textGreenLg}>$ {quote ? formatNum(quote.recipient_amount) : formatNum(receiveAmountUsd)}</Text><Text style={styles.summarySubText}>(₹ {quote ? formatNum(quote.net_amount) : formatNum(convertedInr)})</Text></View></View>
                    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#EDF2F7', flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: 12, color: '#718096' }}>
                        3% fee: INR {quote ? quote.fee_deducted : formatNum(feeAmount)} · Net INR: {quote ? quote.net_amount : formatNum(convertedInr)} · USD payout: {quote ? quote.recipient_amount : formatNum(receiveAmountUsd)}
                      </Text>
                      {quote && (
                        <Text style={{ fontSize: 12, color: quoteCurrent ? '#718096' : '#C53030' }}>
                          {quoteCurrent ? 'Quote expires' : 'Quote expired'}: {new Date(quote.expires_at).toLocaleTimeString()}
                        </Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity style={[styles.primaryButton, !canProceed && styles.buttonDisabled]} onPress={handleStep3Proceed} disabled={!canProceed}><Text style={styles.primaryButtonText}>Proceed</Text></TouchableOpacity>
                  {rateFooter}
                </View>
              )}

              {appStep === 4 && (
                <View>
                  <View style={styles.wizardHeader}>
                    <TouchableOpacity onPress={() => setAppStep(3)}><Text style={styles.backArrow}>&lt;</Text></TouchableOpacity>
                    <Text style={styles.wizardTitle}>Select Payment Method</Text>
                  </View>
                  {quoteBanner}
                  <TouchableOpacity style={styles.paymentOptionBox} onPress={() => setPaymentMethod('upi')} activeOpacity={0.9}>
                    <View style={styles.paymentOptionHeader}>
                      <View style={extraStyles.paymentIconBox}>
                        <PhoneUpiIcon size={22} color="#003DA5" />
                      </View>
                      <View style={styles.paymentTextCol}><Text style={styles.paymentMethodTitle}>UPI ID</Text><Text style={styles.paymentMethodDesc}>Phonepe, Gpay, Paytm, BHIM & more</Text></View>
                      <View style={[styles.radioCircle, paymentMethod === 'upi' && styles.radioCircleSelected]}>{paymentMethod === 'upi' && <View style={styles.radioInner} />}</View>
                    </View>
                    {paymentMethod === 'upi' && (
                      <View style={styles.expandedPaymentArea}>
                        <TextInput style={styles.inputBox} placeholder="UPI ID (e.g., username@upi)" placeholderTextColor="#A0AEC0" value={upiId} onChangeText={(text) => {setUpiId(text); setIsUpiVerified(false);}} autoCapitalize="none" />
                        {!isUpiVerified ? (<TouchableOpacity style={styles.verifyButton} onPress={() => setIsUpiVerified(true)}><Text style={styles.verifyButtonText}>Confirm UPI ID (Demo)</Text></TouchableOpacity>) : (<Text style={styles.verifiedText}>UPI ID Confirmed (Simulated)</Text>)}
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.paymentOptionBox} onPress={() => setPaymentMethod('netbanking')} activeOpacity={0.9}>
                    <View style={styles.paymentOptionHeader}>
                      <View style={extraStyles.paymentIconBox}>
                        <BankNetIcon size={22} color="#003DA5" />
                      </View>
                      <View style={styles.paymentTextCol}><Text style={styles.paymentMethodTitle}>Net Banking</Text><Text style={styles.paymentMethodDesc}>Simulated transfer via Indian net banking</Text></View>
                      <View style={[styles.radioCircle, paymentMethod === 'netbanking' && styles.radioCircleSelected]}>{paymentMethod === 'netbanking' && <View style={styles.radioInner} />}</View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.primaryButton, (!paymentMethod || (paymentMethod === 'upi' && !isUpiVerified)) && styles.buttonDisabled]} onPress={handleProceedFromPayment} disabled={!canSubmit || !paymentMethod || (paymentMethod === 'upi' && !isUpiVerified)}><Text style={styles.primaryButtonText}>Proceed</Text></TouchableOpacity>
                  
                  {rateFooter}
                </View>
              )}

              {appStep === 5 && (
                <View>
                  <View style={styles.wizardHeader}>
                    <TouchableOpacity onPress={() => setAppStep(4)}><Text style={styles.backArrow}>&lt;</Text></TouchableOpacity>
                    <Text style={styles.wizardTitle}>Enter Indian Bank Details</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: '#4A5568', textAlign: 'center', marginBottom: 12 }}>Demo Mode: Use fictional test bank details. No real bank accounts are connected or debited.</Text>
                  {quoteBanner}
                  <TextInput style={styles.inputBox} placeholder="Fictional Account Holder Name" placeholderTextColor="#A0AEC0" value={indianAccountName} onChangeText={setIndianAccountName} />
                  <TextInput style={styles.inputBox} placeholder="Bank Name (e.g., SBI, HDFC)" placeholderTextColor="#A0AEC0" value={indianBankName} onChangeText={setIndianBankName} />
                  <TextInput style={styles.inputBox} placeholder="Fictional Account Number" placeholderTextColor="#A0AEC0" value={indianAccount} onChangeText={setIndianAccount} keyboardType="number-pad" />
                  <TextInput style={styles.inputBox} placeholder="IFSC Code (e.g., SBIN0001234)" placeholderTextColor="#A0AEC0" autoCapitalize="characters" value={ifscCode} onChangeText={setIfscCode} />
                  <Text style={extraStyles.submissionDisclosure}>
                    Simulation Notice: This transfer is processed in simulation mode. No real money or bank accounts will be debited.
                  </Text>
                  <TouchableOpacity style={[styles.primaryButton, (!indianAccountName || !indianBankName || !indianAccount || !ifscCode) && styles.buttonDisabled]} onPress={handleIndianBankSubmit} disabled={!canProceed || (!indianAccountName || !indianBankName || !indianAccount || !ifscCode)}>
                    <Text style={styles.primaryButtonText}>Confirm Simulated Transfer (₹ {formatNum(rawInr)})</Text>
                  </TouchableOpacity>
                  
                  {rateFooter}
                </View>
              )}

              {appStep === 6 && (
                <View style={{alignItems: 'center', paddingVertical: 40}}>
                  <View style={{marginBottom: 20}}>
                    <SuccessCheckIcon size={56} color="#10B981" />
                  </View>
                  <Text style={{fontSize: 22, fontWeight: '700', color: '#1A202C', marginBottom: 10}}>Transfer Submitted</Text>
                  <Text style={{fontSize: 15, color: '#718096', textAlign: 'center', marginBottom: 30}}>Your transfer has been successfully initiated in simulation mode. No live funds were moved.</Text>
                  <TouchableOpacity style={styles.primaryButton} onPress={resetFlow}><Text style={styles.primaryButtonText}>Go back to home</Text></TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {appStep === 7 && (
            <View style={styles.wizardPad}>
              <View style={styles.wizardHeader}>
                <TouchableOpacity onPress={() => setAppStep(1)}><Text style={styles.backArrow}>&lt;</Text></TouchableOpacity>
                <Text style={styles.wizardTitle}>Transaction History</Text>
              </View>
              {transactions.map((tx, index) => (
                <View key={index}>
                  {(index === 0 || transactions[index - 1].dateLabel !== tx.dateLabel) && (
                    <Text style={styles.txDateHeader}>{tx.dateLabel}</Text>
                  )}
                  <View style={styles.txRow}>
                    <View>
                      <Text style={styles.txTitle}>{tx.route}</Text>
                      <Text style={styles.txRef}>{tx.id}</Text>
                    </View>
                    <Text style={[styles.txAmount, tx.isPositive ? styles.textGreen : styles.textRed]}>
                      {tx.amount}
                    </Text>
                  </View>
                </View>
              ))}
              {transactions.length === 0 && (
                <Text style={{textAlign: 'center', color: '#A0AEC0', paddingVertical: 20}}>No transfers yet. Start your first transfer to see your activity here.</Text>
              )}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const extraStyles = StyleSheet.create({
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 12
  },
  errorBannerText: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '500'
  },
  pendingBanner: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 12
  },
  pendingBannerText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '600'
  },
  receiptBanner: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 12
  },
  receiptBannerText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '500'
  },
  loadingBanner: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center'
  },
  loadingBannerText: {
    color: '#64748B',
    fontSize: 12
  },
  navIconWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  desktopActionCardRefined: { flex: 1, maxWidth: 220, minHeight: 124, paddingVertical: 18, paddingHorizontal: 16, shadowColor: '#001E62', shadowOpacity: 0.08, shadowRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center' },
  desktopActionIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EBF3FC', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  desktopActionTextRefined: { fontSize: 13.5, color: '#1E293B', textAlign: 'center', fontWeight: '600', lineHeight: 18 },
  quickActionCardRefined: { flex: 1, minHeight: 96, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#001E62', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3, justifyContent: 'center' },
  quickActionIconWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EBF3FC', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickActionTextRefined: { fontSize: 11.5, color: '#1E293B', textAlign: 'center', fontWeight: '600', lineHeight: 15 },
  paymentIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EBF3FC', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  navTabIconWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  bottomNavBarRefined: { justifyContent: 'space-around', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, zIndex: 20 },
  navTabActiveRefined: { paddingHorizontal: 18, paddingVertical: 9, marginRight: 0 },
  submissionDisclosure: { fontSize: 12, color: '#718096', textAlign: 'center', marginBottom: 12, lineHeight: 18 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  profileModalCard: { width: '100%', maxWidth: 320, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  profileModalHeader: { alignItems: 'center', marginBottom: 16 },
  modalAvatarWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EBF3FC', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  profileModalName: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  profileModalSub: { fontSize: 13, color: '#64748B' },
  profileModalDivider: { width: '100%', height: 1, backgroundColor: '#E2E8F0', marginBottom: 16 },
  modalLogoutButton: { width: '100%', backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 10 },
  modalLogoutText: { color: '#DC2626', fontSize: 15, fontWeight: '600' },
  modalCancelButton: { width: '100%', backgroundColor: '#F8FAFC', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { color: '#64748B', fontSize: 14, fontWeight: '500' },
  heroRateBox: { alignItems: 'center', marginTop: 14, marginBottom: 8 },
  heroRateHeading: { fontSize: 13, fontWeight: '600', color: '#BFDBFE', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  heroRateCenter: { alignItems: 'center', marginVertical: 4 },
  heroRateNumber: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  heroRateSub: { fontSize: 12.5, color: '#E2E8F0', marginTop: 4, fontWeight: '500' },
  heroRateNote: { fontSize: 11, color: 'rgba(255, 255, 255, 0.7)', marginTop: 8 },
  heroRateError: { fontSize: 16, color: '#FECACA', fontWeight: '600', marginVertical: 12 },
  mobileHeroRateBox: { alignItems: 'center', marginTop: 16, marginBottom: 4 },
  mobileHeroRateHeading: { fontSize: 12, fontWeight: '600', color: '#BFDBFE', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  mobileHeroRateNumber: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  mobileHeroRateSub: { fontSize: 11.5, color: '#E2E8F0', marginTop: 2, fontWeight: '500' },
  mobileHeroRateNote: { fontSize: 10.5, color: 'rgba(255, 255, 255, 0.7)', marginTop: 6 },
  desktopActivitySection: { marginTop: 32, marginHorizontal: 20 },
  activityHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  activitySectionTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  activityLatestDate: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  emptyActivityCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  emptyActivityText: { fontSize: 13.5, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  activityCardsRow: { flexDirection: 'row', gap: 16 },
  activityCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  activityCardLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 },
  activityCardValue: { fontSize: 22, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  activityCardSub: { fontSize: 11.5, color: '#94A3B8' },
  recentTxHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  recentTxTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  viewAllLink: { fontSize: 13, color: '#0047AB', fontWeight: '600' },
  mobileActivityContainer: { marginTop: 20, paddingHorizontal: 16 },
  mobileActivityTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  mobileActivityDate: { fontSize: 11, color: '#64748B' },
  mobileEmptyActivityCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', marginTop: 8 },
  mobileActivityGrid: { flexDirection: 'row', gap: 10, marginTop: 8 },
  mobileActivityItem: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', elevation: 1 },
  mobileActivityItemLabel: { fontSize: 10.5, fontWeight: '600', color: '#64748B', textTransform: 'uppercase', marginBottom: 4 },
  mobileActivityItemValue: { fontSize: 14, fontWeight: '700', color: '#0F172A' }
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollWrapper: { flexGrow: 1, paddingBottom: 150 }, 
  fullHeight: { flex: 1 },
  wizardPad: { flex: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 150, backgroundColor: '#FFFFFF' }, 
  
  blueHeaderBlock: { backgroundColor: '#003DA5', paddingTop: 20, paddingHorizontal: 20, paddingBottom: 80, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profileInfo: { flexDirection: 'row', alignItems: 'center' },
  mobileAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#CBD5E0', marginRight: 12 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 20 },
  greetingText: { fontSize: 16, color: '#FFFFFF', fontWeight: '500' },
  balanceLabel: { color: '#E2E8F0', fontSize: 14, marginBottom: 8 },
  balanceRowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  balanceAmount: { color: '#FFFFFF', fontSize: 36, fontWeight: '700', marginRight: 12 },
  currencyPill: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  currencyPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  
  floatingCardsRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingHorizontal: 20, marginTop: -50 },
  quickActionCard: { backgroundColor: '#FFFFFF', width: '47%', paddingVertical: 16, paddingHorizontal: 8, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  quickActionIcon: { fontSize: 28, marginBottom: 12 },
  quickActionText: { fontSize: 11, color: '#4A5568', textAlign: 'center', fontWeight: '500', lineHeight: 14 },
  
  transactionListContainer: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 },
  txDateHeader: { fontSize: 12, color: '#A0AEC0', fontWeight: '500', marginBottom: 12, marginTop: 16 },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F0F4F8' },
  txTitle: { fontSize: 15, fontWeight: '700', color: '#1A202C', marginBottom: 4 },
  txRef: { fontSize: 11, color: '#A0AEC0' },
  txAmount: { fontSize: 15, fontWeight: '700' },
  textGreen: { color: '#38A169' },
  textRed: { color: '#E53E3E' },
  
  bottomNavBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'center', paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  navTabActive: { backgroundColor: '#0047AB', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginRight: 40 },
  navTabIconActive: { fontSize: 16, marginRight: 8, color: '#FFF' },
  navTabTextActive: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  navTab: { paddingHorizontal: 20, paddingVertical: 10, justifyContent: 'center' },
  navTabIcon: { fontSize: 20, color: '#A0AEC0' },

  wizardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backArrow: { fontSize: 22, color: '#1A202C', marginRight: 16, fontWeight: '600' },
  wizardTitle: { fontSize: 18, fontWeight: '600', color: '#1A202C' },
  inputBox: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#FFFFFF', marginBottom: 12 },
  inputLabel: { fontSize: 14, color: '#4A5568', marginBottom: 8, fontWeight: '500' },
  currencyInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 16, marginBottom: 16 },
  currencyInputRowDisabled: { backgroundColor: '#F7FAFC' },
  currencyInput: { flex: 1, paddingVertical: 12, fontSize: 16, fontWeight: '600', color: '#1A202C' },
  currencyInputDisabled: { flex: 1, paddingVertical: 12, fontSize: 16, fontWeight: '700', color: '#38A169' },
  currencyTag: { fontSize: 14, color: '#718096', fontWeight: '600', backgroundColor: '#EDF2F7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  rateBanner: { backgroundColor: '#EBF8FF', padding: 10, borderRadius: 8, marginBottom: 16, alignItems: 'center' },
  rateText: { color: '#0047AB', fontWeight: '600', fontSize: 14 },
  summaryCard: { backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#EDF2F7', borderRadius: 12, padding: 16, marginTop: 10 },
  summaryTitle: { fontSize: 16, fontWeight: '600', color: '#1A202C', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryText: { fontSize: 14, color: '#4A5568' },
  summaryTextBold: { fontSize: 14, fontWeight: '600', color: '#1A202C' },
  summaryDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 10 },
  summarySubText: { fontSize: 12, color: '#718096', marginTop: 4 },
  textGreenLg: { color: '#38A169', fontSize: 18, fontWeight: '700' },
  
  paymentOptionBox: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 16, marginBottom: 12 },
  paymentOptionHeader: { flexDirection: 'row', alignItems: 'center' },
  paymentIcon: { fontSize: 24, marginRight: 16 },
  paymentTextCol: { flex: 1 },
  paymentMethodTitle: { fontSize: 15, fontWeight: '600', color: '#1A202C', marginBottom: 4 },
  paymentMethodDesc: { fontSize: 12, color: '#718096' },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E0', justifyContent: 'center', alignItems: 'center' },
  radioCircleSelected: { borderColor: '#38A169' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#38A169' },
  expandedPaymentArea: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#EDF2F7' },
  verifyButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#0047AB', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  verifyButtonText: { color: '#0047AB', fontWeight: '600', fontSize: 14 },
  verifiedText: { color: '#38A169', fontWeight: '600', fontSize: 14, textAlign: 'right', marginTop: -10 },
  
  primaryButton: { backgroundColor: '#0047AB', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 16, marginBottom: 16 },
  buttonDisabled: { backgroundColor: '#A0AEC0' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  
  desktopContainer: { flex: 1, flexDirection: 'row', backgroundColor: '#F0F2F5' },
  desktopSidebar: { width: 250, flexShrink: 0, backgroundColor: '#FFFFFF', padding: 24, borderRightWidth: 1, borderRightColor: '#E2E8F0', justifyContent: 'space-between' },
  desktopLogo: { width: 140, height: 40, resizeMode: 'contain', marginBottom: 40 },
  desktopNavMenu: { gap: 12 },
  navItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  navItemActive: { backgroundColor: '#EBF8FF' },
  navIcon: { fontSize: 18, marginRight: 12 },
  navText: { fontSize: 15, color: '#4A5568', fontWeight: '500' },
  navTextActive: { color: '#0047AB', fontWeight: '600' },
  logoutButton: { padding: 16 },
  logoutText: { color: '#E53E3E', fontSize: 15, fontWeight: '600' },
  
  desktopMainContent: { flex: 1, minWidth: 0, minHeight: 0 },
  desktopScrollContent: { flexGrow: 1, padding: 20, paddingBottom: 100 }, 
  desktopBlueBanner: { backgroundColor: '#003DA5', borderRadius: 20, padding: 40, paddingBottom: 80 },
  bannerBalanceCenter: { alignItems: 'center' },
  
  desktopFloatingCardsRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: -50, paddingHorizontal: 20 },
  desktopActionCard: { backgroundColor: '#FFFFFF', width: 200, paddingVertical: 24, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  desktopActionIcon: { fontSize: 32, marginBottom: 16 },
  desktopActionText: { fontSize: 14, color: '#1A202C', textAlign: 'center', fontWeight: '600', lineHeight: 20 },
  
  desktopHistoryContainer: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 30, marginTop: 40, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
  desktopTxGroup: { marginBottom: 10 },
  desktopTxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#EDF2F7' },
  
  desktopWizardContainer: { width: '100%', alignItems: 'center', paddingTop: 0 }, 
  desktopWizardCard: { 
    backgroundColor: '#FFFFFF', width: '100%', maxWidth: 500, borderRadius: 16, 
    paddingHorizontal: 30, paddingTop: 24, paddingBottom: 24, 
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 
  }
});

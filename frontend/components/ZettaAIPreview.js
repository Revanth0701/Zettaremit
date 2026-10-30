import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, useWindowDimensions } from 'react-native';

const SAMPLE_TOPICS = [
  {
    id: 'rate',
    title: 'Exchange Rates',
    question: "What is today's INR to USD reference rate?",
    answer: "ZettaRemit references daily market benchmark rates to calculate realistic transfer quotes without committing live funds.",
  },
  {
    id: 'fee',
    title: '3% Platform Fee',
    question: 'How is the 3% simulation fee calculated?',
    answer: "The 3% simulation platform fee is deducted upfront from your gross INR send amount before conversion. For example, sending ₹25,000 incurs a ₹750 platform fee, leaving ₹24,250 converted into USD at the active reference rate.",
  },
  {
    id: 'tracking',
    title: 'Ledger Tracking',
    question: 'How do I follow my simulated transaction?',
    answer: 'Every simulated transfer receives a cryptographic quote token and is logged in your personal simulation history ledger, showing transitions from "initiated" to "settled".',
  },
  {
    id: 'safety',
    title: 'Platform Safety',
    question: 'Is real money deducted from my bank account?',
    answer: 'No. ZettaRemit is an educational cross-border remittance simulation platform. All accounts, rates, fees, and transfers are simulated. Real monetary transactions are disabled.',
  },
];

export default function ZettaAIPreview({ onGetStarted }) {
  const [activeTopicIndex, setActiveTopicIndex] = useState(0);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const currentTopic = SAMPLE_TOPICS[activeTopicIndex];

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.aiBadgeRow}>
          <View style={styles.sparkleBadge}>
            <Text style={styles.sparkleIcon}>✨</Text>
            <Text style={styles.badgeText}>ZETTA AI ASSISTANT PREVIEW</Text>
          </View>
          <View style={styles.infoPill}>
            <Text style={styles.infoPillText}>Interactive Demo</Text>
          </View>
        </View>
        <Text style={styles.title}>Intelligence Built for Cross-Border Simulations</Text>
        <Text style={styles.subtitle}>
          Explore how ZettaAI guides users through remittance corridors, currency mechanics, fee transparency, and transaction tracking.
        </Text>
      </View>

      {/* Topic Switcher Pills */}
      <View style={styles.topicsRow}>
        {SAMPLE_TOPICS.map((topic, index) => (
          <TouchableOpacity
            key={topic.id}
            style={[styles.topicPill, index === activeTopicIndex && styles.topicPillActive]}
            onPress={() => setActiveTopicIndex(index)}
            activeOpacity={0.8}
          >
            <Text style={[styles.topicPillText, index === activeTopicIndex && styles.topicPillTextActive]}>
              {topic.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Interactive Conversation Box */}
      <View style={styles.chatBox}>
        {/* User Prompt Bubble */}
        <View style={styles.userBubble}>
          <Text style={styles.userAvatar}>👤</Text>
          <View style={styles.userBubbleContent}>
            <Text style={styles.userBubbleLabel}>Sample Question</Text>
            <Text style={styles.userBubbleText}>{currentTopic.question}</Text>
          </View>
        </View>

        {/* AI Response Bubble */}
        <View style={styles.aiBubble}>
          <View style={styles.aiHeaderRow}>
            <View style={styles.aiAvatar}>
              <Text style={styles.aiAvatarIcon}>✨</Text>
            </View>
            <Text style={styles.aiName}>ZettaAI Assistant</Text>
            <View style={styles.simulatedIndicator}>
              <Text style={styles.simulatedIndicatorText}>VERIFIED KNOWLEDGE</Text>
            </View>
          </View>
          <Text style={styles.aiResponseText}>{currentTopic.answer}</Text>
        </View>

        {/* Informational Security Callout */}
        <View style={styles.securityCallout}>
          <Text style={styles.lockIcon}>🔒</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.securityTitle}>Sign in for Live Interactive AI Chat</Text>
            <Text style={styles.securityDescription}>
              In accordance with security policies, authenticated AI endpoints and personalized account query capabilities are unlocked when you sign in.
            </Text>
          </View>
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={onGetStarted}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Get Started with ZettaAI"
        >
          <Text style={styles.ctaButtonText}>Get Started with ZettaAI</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#071633',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 102, 255, 0.3)',
    width: '100%',
    marginVertical: 20,
  },
  containerDesktop: {
    padding: 32,
  },
  header: {
    marginBottom: 20,
  },
  aiBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sparkleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  sparkleIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  badgeText: {
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  infoPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  infoPillText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
  },
  topicsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  topicPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  topicPillActive: {
    backgroundColor: 'rgba(0, 102, 255, 0.25)',
    borderColor: '#0066FF',
  },
  topicPillText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  topicPillTextActive: {
    color: '#60A5FA',
    fontWeight: '700',
  },
  chatBox: {
    backgroundColor: '#050E24',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  userBubble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  userAvatar: {
    fontSize: 18,
    marginRight: 10,
    marginTop: 2,
  },
  userBubbleContent: {
    flex: 1,
  },
  userBubbleLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  userBubbleText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  aiBubble: {
    backgroundColor: 'rgba(0, 82, 255, 0.1)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 102, 255, 0.3)',
    marginBottom: 16,
  },
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  aiAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0052FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  aiAvatarIcon: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  aiName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  simulatedIndicator: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  simulatedIndicatorText: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  aiResponseText: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 22,
  },
  securityCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    marginBottom: 16,
  },
  lockIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  securityTitle: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  securityDescription: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
  },
  ctaButton: {
    backgroundColor: '#0052FF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

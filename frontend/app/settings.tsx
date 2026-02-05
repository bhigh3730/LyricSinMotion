import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Switch,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SettingItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  type: 'toggle' | 'link' | 'info';
  value?: boolean;
  onPress?: () => void;
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Settings state
  const [highQuality, setHighQuality] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [notifications, setNotifications] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const settingsSections = [
    {
      title: 'Video Generation',
      items: [
        {
          id: 'quality',
          title: 'High Quality Output',
          subtitle: 'Generate videos in higher resolution',
          icon: 'sparkles' as const,
          type: 'toggle' as const,
          value: highQuality,
          onToggle: setHighQuality,
        },
        {
          id: 'autosave',
          title: 'Auto-save Projects',
          subtitle: 'Automatically save progress',
          icon: 'save-outline' as const,
          type: 'toggle' as const,
          value: autoSave,
          onToggle: setAutoSave,
        },
      ],
    },
    {
      title: 'AI Settings',
      items: [
        {
          id: 'model',
          title: 'AI Model',
          subtitle: 'Claude Sonnet 4.5 (via Emergent)',
          icon: 'hardware-chip-outline' as const,
          type: 'info' as const,
        },
        {
          id: 'video-api',
          title: 'Video Generation API',
          subtitle: 'Not configured (MOCK mode)',
          icon: 'videocam-outline' as const,
          type: 'info' as const,
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        {
          id: 'notifications',
          title: 'Push Notifications',
          subtitle: 'Get notified when video is ready',
          icon: 'notifications-outline' as const,
          type: 'toggle' as const,
          value: notifications,
          onToggle: setNotifications,
        },
      ],
    },
    {
      title: 'About',
      items: [
        {
          id: 'version',
          title: 'Version',
          subtitle: 'LyricMotion v.1.0',
          icon: 'information-circle-outline' as const,
          type: 'info' as const,
        },
        {
          id: 'support',
          title: 'Support & Feedback',
          subtitle: 'Get help or report issues',
          icon: 'help-circle-outline' as const,
          type: 'link' as const,
          onPress: () => Linking.openURL('mailto:support@lyricmotion.app'),
        },
        {
          id: 'privacy',
          title: 'Privacy Policy',
          icon: 'shield-outline' as const,
          type: 'link' as const,
          onPress: () => {},
        },
        {
          id: 'terms',
          title: 'Terms of Service',
          icon: 'document-text-outline' as const,
          type: 'link' as const,
          onPress: () => {},
        },
      ],
    },
  ];

  const renderSettingItem = (item: any, index: number) => {
    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.settingItem,
          index === 0 && styles.settingItemFirst,
        ]}
        onPress={item.type === 'link' ? item.onPress : undefined}
        activeOpacity={item.type === 'link' ? 0.7 : 1}
        disabled={item.type !== 'link'}
      >
        <View style={styles.settingItemLeft}>
          <View style={styles.settingIconContainer}>
            <Ionicons name={item.icon} size={20} color="#8b5cf6" />
          </View>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingTitle}>{item.title}</Text>
            {item.subtitle && (
              <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
            )}
          </View>
        </View>

        {item.type === 'toggle' && (
          <Switch
            value={item.value}
            onValueChange={item.onToggle}
            trackColor={{ false: '#3f3f5a', true: '#8b5cf6' }}
            thumbColor={item.value ? '#fff' : '#6b7280'}
          />
        )}

        {item.type === 'link' && (
          <Ionicons name="chevron-forward" size={20} color="#6b7280" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#0a0a12', '#12121f', '#1a1a2e']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* App Info Card */}
          <View style={styles.appInfoCard}>
            <LinearGradient
              colors={['rgba(139, 92, 246, 0.2)', 'rgba(99, 102, 241, 0.1)']}
              style={styles.appInfoGradient}
            >
              <View style={styles.appLogoContainer}>
                <LinearGradient
                  colors={['#8b5cf6', '#6366f1']}
                  style={styles.appLogo}
                >
                  <Ionicons name="videocam" size={32} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.appName}>LyricMotion</Text>
              <Text style={styles.appDescription}>
                AI-Powered Music Video Creator
              </Text>
              <View style={styles.appBadge}>
                <Text style={styles.appBadgeText}>v.1.0 BETA</Text>
              </View>
            </LinearGradient>
          </View>

          {/* Settings Sections */}
          {settingsSections.map((section, sectionIndex) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionContent}>
                {section.items.map((item, itemIndex) =>
                  renderSettingItem(item, itemIndex)
                )}
              </View>
            </View>
          ))}

          {/* Integration Notice */}
          <View style={styles.integrationNotice}>
            <Ionicons name="information-circle" size={24} color="#f59e0b" />
            <View style={styles.integrationNoticeContent}>
              <Text style={styles.integrationNoticeTitle}>
                Video Generation API Required
              </Text>
              <Text style={styles.integrationNoticeText}>
                To generate actual videos, integrate with Runway ML, Luma AI, or
                fal.ai. Currently running in MOCK mode with AI storyboard
                generation.
              </Text>
            </View>
          </View>

          {/* Credits */}
          <View style={styles.credits}>
            <Text style={styles.creditsText}>
              Powered by Claude AI via Emergent
            </Text>
            <Text style={styles.copyrightText}>
              © 2025 LyricMotion. All rights reserved.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a12',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  appInfoCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  appInfoGradient: {
    padding: 24,
    alignItems: 'center',
  },
  appLogoContainer: {
    marginBottom: 16,
  },
  appLogo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  appDescription: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  appBadge: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 20,
  },
  appBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#c4b5fd',
    letterSpacing: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionContent: {
    backgroundColor: 'rgba(45, 45, 68, 0.3)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.1)',
  },
  settingItemFirst: {
    borderTopWidth: 0,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  integrationNotice: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    gap: 12,
  },
  integrationNoticeContent: {
    flex: 1,
  },
  integrationNoticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f59e0b',
    marginBottom: 4,
  },
  integrationNoticeText: {
    fontSize: 13,
    color: '#fbbf24',
    lineHeight: 18,
  },
  credits: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  creditsText: {
    fontSize: 12,
    color: '#6b7280',
  },
  copyrightText: {
    fontSize: 11,
    color: '#4b5563',
    marginTop: 4,
  },
});

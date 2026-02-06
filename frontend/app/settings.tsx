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
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
      title: 'AI Configuration',
      items: [
        {
          id: 'storyboard-model',
          title: 'Storyboard AI',
          subtitle: 'Claude Sonnet 4.5 (Active)',
          icon: 'hardware-chip-outline' as const,
          type: 'info' as const,
        },
        {
          id: 'video-api',
          title: 'Video Generation',
          subtitle: 'Demo Mode (Personal Use)',
          icon: 'videocam-outline' as const,
          type: 'info' as const,
        },
      ],
    },
    {
      title: 'About',
      items: [
        {
          id: 'version',
          title: 'Version',
          subtitle: 'LyricSiNMotion v.1.0',
          icon: 'information-circle-outline' as const,
          type: 'info' as const,
        },
        {
          id: 'purpose',
          title: 'Purpose',
          subtitle: 'Artist Creator Portfolio Tool',
          icon: 'brush-outline' as const,
          type: 'info' as const,
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
              <Image
                source={require('../assets/images/lyricsinmotion-logo.jpg')}
                style={styles.appLogo}
                resizeMode="contain"
              />
              <View style={styles.appBadge}>
                <Text style={styles.appBadgeText}>PERSONAL CREATIVE STUDIO</Text>
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

          {/* Feature Notice */}
          <View style={styles.featureNotice}>
            <Ionicons name="rocket" size={24} color="#10b981" />
            <View style={styles.featureNoticeContent}>
              <Text style={styles.featureNoticeTitle}>
                AI Storyboard Generation Active
              </Text>
              <Text style={styles.featureNoticeText}>
                Real AI-powered storyboards using Claude Sonnet. Video output is
                in demo mode for personal portfolio creation.
              </Text>
            </View>
          </View>

          {/* Credits */}
          <View style={styles.credits}>
            <Text style={styles.creditsText}>
              Built for Creative Expression
            </Text>
            <Text style={styles.copyrightText}>
              LyricSiNMotion - Personal Use Edition
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
    padding: 20,
    alignItems: 'center',
  },
  appLogo: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  appBadge: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 20,
  },
  appBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#c4b5fd',
    letterSpacing: 1.5,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
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
  featureNotice: {
    flexDirection: 'row',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    gap: 12,
  },
  featureNoticeContent: {
    flex: 1,
  },
  featureNoticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 4,
  },
  featureNoticeText: {
    fontSize: 13,
    color: '#34d399',
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

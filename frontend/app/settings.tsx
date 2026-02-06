import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Switch,
  ImageBackground,
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
        activeOpacity={1}
        disabled={item.type !== 'link'}
      >
        <View style={styles.settingItemLeft}>
          <View style={styles.settingIconContainer}>
            <Ionicons name={item.icon} size={18} color="#8b5cf6" />
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
      </TouchableOpacity>
    );
  };

  return (
    <ImageBackground
      source={require('../assets/images/lyricsinmotion-logo.jpg')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      {/* Dark overlay gradient for readability */}
      <LinearGradient
        colors={[
          'rgba(10, 10, 18, 0.88)',
          'rgba(10, 10, 18, 0.92)',
          'rgba(10, 10, 18, 0.96)',
        ]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 40 }} />
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
              <View style={styles.appInfoContent}>
                <Text style={styles.appName}>LyricSiNMotion</Text>
                <Text style={styles.appVersion}>v.1.0</Text>
                <View style={styles.appBadge}>
                  <Text style={styles.appBadgeText}>PERSONAL CREATIVE STUDIO</Text>
                </View>
              </View>
            </View>

            {/* Settings Sections */}
            {settingsSections.map((section) => (
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
              <Ionicons name="rocket" size={22} color="#10b981" />
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
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 40,
  },
  appInfoCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  appInfoContent: {
    padding: 20,
    alignItems: 'center',
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
    textShadowColor: 'rgba(139, 92, 246, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  appVersion: {
    fontSize: 12,
    color: '#a78bfa',
    marginTop: 4,
  },
  appBadge: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderRadius: 16,
  },
  appBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#c4b5fd',
    letterSpacing: 1.2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 10,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionContent: {
    backgroundColor: 'rgba(45, 45, 68, 0.35)',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
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
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  settingSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  featureNotice: {
    flexDirection: 'row',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    gap: 10,
  },
  featureNoticeContent: {
    flex: 1,
  },
  featureNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 4,
  },
  featureNoticeText: {
    fontSize: 12,
    color: '#34d399',
    lineHeight: 17,
  },
  credits: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  creditsText: {
    fontSize: 11,
    color: '#4b5563',
  },
});

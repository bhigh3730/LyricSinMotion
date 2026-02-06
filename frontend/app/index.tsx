import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  ActivityIndicator,
  ImageBackground,
  Alert,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProjectStore } from '../store/projectStore';
import { useCacheStore } from '../store/cacheStore';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { projects, fetchProjects, loading } = useProjectStore();
  const { 
    hasUnsavedSession, 
    initializeCache, 
    restoreFromCache, 
    clearCache,
    createNewSession,
    currentSession,
  } = useCacheStore();
  
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  
  // Animations
  const [headerAnim] = useState(new Animated.Value(0));
  const [buttonAnim] = useState(new Animated.Value(0));
  const [listAnim] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    fetchProjects();
    initializeCache().then(() => {
      // Check for unsaved session after init
      const { hasUnsavedSession } = useCacheStore.getState();
      if (hasUnsavedSession) {
        setShowRestoreModal(true);
      }
    });
    
    // Entrance animations
    Animated.sequence([
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(buttonAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(listAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleRestoreSession = async () => {
    const session = await restoreFromCache();
    setShowRestoreModal(false);
    if (session) {
      router.push('/create');
    }
  };

  const handleDiscardSession = async () => {
    await clearCache();
    setShowRestoreModal(false);
  };

  const handleCreateNew = () => {
    createNewSession('manual');
    router.push('/create');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return '#6366f1';
      case 'processing': return '#f59e0b';
      case 'storyboard_ready': return '#10b981';
      case 'video_ready': return '#8b5cf6';
      default: return '#6366f1';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'processing': return 'Processing';
      case 'storyboard_ready': return 'Storyboard Ready';
      case 'video_ready': return 'Video Ready';
      default: return status;
    }
  };

  return (
    <ImageBackground
      source={require('../assets/images/lyricsinmotion-logo.jpg')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <LinearGradient
        colors={[
          'rgba(10, 10, 18, 0.85)',
          'rgba(10, 10, 18, 0.9)',
          'rgba(10, 10, 18, 0.95)',
          'rgba(10, 10, 18, 0.98)',
        ]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Floating particles effect */}
        <View style={styles.particlesContainer}>
          {[...Array(20)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.particle,
                {
                  left: Math.random() * width,
                  top: Math.random() * height,
                  opacity: Math.random() * 0.3 + 0.1,
                  width: Math.random() * 3 + 1,
                  height: Math.random() * 3 + 1,
                  backgroundColor: i % 3 === 0 ? '#8b5cf6' : i % 3 === 1 ? '#06b6d4' : '#ec4899',
                },
              ]}
            />
          ))}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <Animated.View
            style={[
              styles.headerSection,
              {
                opacity: headerAnim,
                transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
              },
            ]}
          >
            <View style={styles.titleContainer}>
              <Text style={styles.appTitle}>LyricSiNMotion</Text>
              <View style={styles.versionBadge}>
                <Text style={styles.versionText}>v.1.0</Text>
              </View>
            </View>
            <Text style={styles.appTagline}>AI-Powered Music Video Creator</Text>
            <Text style={styles.appSubtitle}>Transform lyrics into cinematic visuals</Text>
          </Animated.View>

          {/* Create Button */}
          <Animated.View
            style={[
              styles.createButtonContainer,
              {
                opacity: buttonAnim,
                transform: [
                  { scale: pulseAnim },
                  { translateY: buttonAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
                ],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreateNew}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#8b5cf6', '#6366f1', '#4f46e5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.createButtonGradient}
              >
                <Ionicons name="add-circle" size={26} color="#fff" />
                <Text style={styles.createButtonText}>Create New Video</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Projects Section */}
          <Animated.View
            style={[
              styles.projectsSection,
              {
                opacity: listAnim,
                transform: [{ translateY: listAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Ionicons name="folder-open" size={18} color="#8b5cf6" />
              <Text style={styles.sectionTitle}>Your Projects</Text>
              <View style={styles.sectionLine} />
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#8b5cf6" />
                <Text style={styles.loadingText}>Loading projects...</Text>
              </View>
            ) : projects.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="film-outline" size={40} color="#8b5cf6" />
                </View>
                <Text style={styles.emptyText}>No projects yet</Text>
                <Text style={styles.emptySubtext}>Create your first AI-powered music video</Text>
              </View>
            ) : (
              projects.map((project) => (
                <TouchableOpacity
                  key={project.id}
                  style={styles.projectCard}
                  onPress={() => router.push(`/project/${project.id}`)}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['rgba(139, 92, 246, 0.18)', 'rgba(99, 102, 241, 0.08)']}
                    style={styles.projectCardGradient}
                  >
                    <View style={styles.projectCardContent}>
                      <View style={styles.projectIcon}>
                        <Ionicons name="musical-notes" size={22} color="#8b5cf6" />
                      </View>
                      <View style={styles.projectInfo}>
                        <Text style={styles.projectName}>{project.name}</Text>
                        <Text style={styles.projectDate}>{formatDate(project.created_at)}</Text>
                        {project.audio_filename && (
                          <Text style={styles.projectAudio} numberOfLines={1}>
                            <Ionicons name="musical-note" size={11} color="#6b7280" /> {project.audio_filename}
                          </Text>
                        )}
                      </View>
                      <View style={styles.projectStatus}>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(project.status) + '25' }]}>
                          <View style={[styles.statusDot, { backgroundColor: getStatusColor(project.status) }]} />
                          <Text style={[styles.statusText, { color: getStatusColor(project.status) }]}>
                            {getStatusLabel(project.status)}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#6b7280" />
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))
            )}
          </Animated.View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Personal Creative Studio</Text>
          </View>
        </ScrollView>

        {/* Settings Button */}
        <TouchableOpacity
          style={[styles.settingsButton, { top: insets.top + 8 }]}
          onPress={() => router.push('/settings')}
        >
          <LinearGradient
            colors={['rgba(139, 92, 246, 0.25)', 'rgba(99, 102, 241, 0.15)']}
            style={styles.settingsButtonGradient}
          >
            <Ionicons name="settings-outline" size={20} color="#a78bfa" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Restore Session Modal */}
      <Modal visible={showRestoreModal} transparent animationType="fade">
        <View style={styles.restoreModalOverlay}>
          <View style={styles.restoreModalContent}>
            <View style={styles.restoreModalIcon}>
              <Ionicons name="refresh-circle" size={48} color="#8b5cf6" />
            </View>
            <Text style={styles.restoreModalTitle}>Restore Previous Session?</Text>
            <Text style={styles.restoreModalText}>
              We found an unsaved session from your last visit. Would you like to restore it?
            </Text>
            <View style={styles.restoreModalButtons}>
              <TouchableOpacity style={styles.restoreModalDiscard} onPress={handleDiscardSession}>
                <Text style={styles.restoreModalDiscardText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.restoreModalRestore} onPress={handleRestoreSession}>
                <LinearGradient colors={['#8b5cf6', '#6366f1']} style={styles.restoreModalRestoreGradient}>
                  <Text style={styles.restoreModalRestoreText}>Restore</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  container: { flex: 1 },
  particlesContainer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  particle: { position: 'absolute', borderRadius: 10 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  headerSection: { alignItems: 'center', marginTop: 30, marginBottom: 28 },
  titleContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  appTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
    textShadowColor: 'rgba(139, 92, 246, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  versionBadge: { backgroundColor: 'rgba(139, 92, 246, 0.3)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  versionText: { fontSize: 11, fontWeight: '700', color: '#c4b5fd' },
  appTagline: { fontSize: 14, color: '#a78bfa', fontWeight: '500' },
  appSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  createButtonContainer: { marginBottom: 28 },
  createButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 28,
    gap: 10,
  },
  createButtonText: { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  projectsSection: { flex: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  sectionLine: { flex: 1, height: 1, backgroundColor: 'rgba(139, 92, 246, 0.2)' },
  loadingContainer: { paddingVertical: 40, alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#6b7280', fontSize: 13 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#9ca3af' },
  emptySubtext: { fontSize: 13, color: '#6b7280', marginTop: 6 },
  projectCard: {
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  projectCardGradient: { padding: 14 },
  projectCardContent: { flexDirection: 'row', alignItems: 'center' },
  projectIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectInfo: { flex: 1, marginLeft: 12 },
  projectName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  projectDate: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  projectAudio: { fontSize: 10, color: '#6b7280', marginTop: 3 },
  projectStatus: { alignItems: 'flex-end', gap: 6 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 5 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '600' },
  footer: { alignItems: 'center', paddingVertical: 20, marginTop: 12 },
  footerText: { fontSize: 11, color: '#4b5563' },
  settingsButton: { position: 'absolute', right: 14, borderRadius: 20, overflow: 'hidden' },
  settingsButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  restoreModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  restoreModalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  restoreModalIcon: { marginBottom: 16 },
  restoreModalTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  restoreModalText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  restoreModalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  restoreModalDiscard: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  restoreModalDiscardText: { fontSize: 14, fontWeight: '600', color: '#ef4444' },
  restoreModalRestore: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  restoreModalRestoreGradient: { paddingVertical: 12, alignItems: 'center' },
  restoreModalRestoreText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});

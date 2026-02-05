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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProjectStore } from '../store/projectStore';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { projects, fetchProjects, loading } = useProjectStore();
  
  // Animations
  const [logoAnim] = useState(new Animated.Value(0));
  const [buttonAnim] = useState(new Animated.Value(0));
  const [listAnim] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    fetchProjects();
    
    // Entrance animations
    Animated.sequence([
      Animated.timing(logoAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(buttonAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(listAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Animated Background */}
      <LinearGradient
        colors={['#0a0a12', '#12121f', '#1a1a2e']}
        style={StyleSheet.absoluteFill}
      />
      
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
                opacity: Math.random() * 0.5 + 0.1,
                width: Math.random() * 4 + 1,
                height: Math.random() * 4 + 1,
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
        {/* Logo Section */}
        <Animated.View
          style={[
            styles.logoSection,
            {
              opacity: logoAnim,
              transform: [
                {
                  translateY: logoAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={['#8b5cf6', '#6366f1', '#4f46e5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoGradient}
            >
              <Ionicons name="videocam" size={48} color="#fff" />
            </LinearGradient>
            <View style={styles.logoGlow} />
          </View>
          
          <Text style={styles.appTitle}>LyricMotion</Text>
          <Text style={styles.appVersion}>v.1.0</Text>
          <Text style={styles.appTagline}>AI-Powered Music Video Creator</Text>
        </Animated.View>

        {/* Create Button */}
        <Animated.View
          style={[
            styles.createButtonContainer,
            {
              opacity: buttonAnim,
              transform: [
                { scale: pulseAnim },
                {
                  translateY: buttonAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push('/create')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#8b5cf6', '#6366f1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.createButtonGradient}
            >
              <Ionicons name="add-circle" size={28} color="#fff" />
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
              transform: [
                {
                  translateY: listAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Projects</Text>
            <View style={styles.sectionLine} />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8b5cf6" />
            </View>
          ) : projects.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="film-outline" size={64} color="#3f3f5a" />
              <Text style={styles.emptyText}>No projects yet</Text>
              <Text style={styles.emptySubtext}>
                Create your first AI-powered music video
              </Text>
            </View>
          ) : (
            projects.map((project, index) => (
              <TouchableOpacity
                key={project.id}
                style={styles.projectCard}
                onPress={() => router.push(`/project/${project.id}`)}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['rgba(139, 92, 246, 0.1)', 'rgba(99, 102, 241, 0.05)']}
                  style={styles.projectCardGradient}
                >
                  <View style={styles.projectCardContent}>
                    <View style={styles.projectIcon}>
                      <Ionicons name="musical-notes" size={24} color="#8b5cf6" />
                    </View>
                    <View style={styles.projectInfo}>
                      <Text style={styles.projectName}>{project.name}</Text>
                      <Text style={styles.projectDate}>
                        {formatDate(project.created_at)}
                      </Text>
                      {project.audio_filename && (
                        <Text style={styles.projectAudio} numberOfLines={1}>
                          <Ionicons name="musical-note" size={12} color="#6b7280" />{' '}
                          {project.audio_filename}
                        </Text>
                      )}
                    </View>
                    <View style={styles.projectStatus}>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: getStatusColor(project.status) + '20' },
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: getStatusColor(project.status) },
                          ]}
                        />
                        <Text
                          style={[
                            styles.statusText,
                            { color: getStatusColor(project.status) },
                          ]}
                        >
                          {getStatusLabel(project.status)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#6b7280" />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))
          )}
        </Animated.View>
      </ScrollView>

      {/* Settings Button */}
      <TouchableOpacity
        style={[styles.settingsButton, { top: insets.top + 10 }]}
        onPress={() => router.push('/settings')}
      >
        <Ionicons name="settings-outline" size={24} color="#8b5cf6" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a12',
  },
  particlesContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    backgroundColor: '#8b5cf6',
    borderRadius: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  logoGradient: {
    width: 100,
    height: 100,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#8b5cf6',
    opacity: 0.2,
    top: -10,
    left: -10,
  },
  appTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
  },
  appVersion: {
    fontSize: 12,
    color: '#8b5cf6',
    marginTop: 4,
    letterSpacing: 1,
  },
  appTagline: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  createButtonContainer: {
    marginBottom: 40,
  },
  createButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    gap: 12,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  projectsSection: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2d2d44',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#4b5563',
    marginTop: 8,
  },
  projectCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  projectCardGradient: {
    padding: 16,
  },
  projectCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectInfo: {
    flex: 1,
    marginLeft: 12,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  projectDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  projectAudio: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  projectStatus: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  settingsButton: {
    position: 'absolute',
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
});

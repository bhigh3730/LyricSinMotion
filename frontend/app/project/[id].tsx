import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProjectStore, StoryboardScene } from '../../store/projectStore';

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const {
    currentProject,
    fetchProject,
    deleteProject,
    updateScene,
    generateVideo,
    loading,
  } = useProjectStore();

  const [selectedScene, setSelectedScene] = useState<StoryboardScene | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editedScene, setEditedScene] = useState<Partial<StoryboardScene>>({});
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (id) {
      fetchProject(id);
    }
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [id]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDeleteProject = () => {
    Alert.alert(
      'Delete Project',
      'Are you sure you want to delete this project? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (id) {
              await deleteProject(id);
              router.replace('/');
            }
          },
        },
      ]
    );
  };

  const handleEditScene = (scene: StoryboardScene) => {
    setSelectedScene(scene);
    setEditedScene({
      description: scene.description,
      camera_movement: scene.camera_movement,
      lighting: scene.lighting,
      mood: scene.mood,
      character_actions: scene.character_actions,
    });
    setEditModalVisible(true);
  };

  const handleSaveScene = async () => {
    if (!id || !selectedScene) return;

    await updateScene(id, selectedScene.id, editedScene);
    setEditModalVisible(false);
    setSelectedScene(null);
  };

  const handleGenerateVideo = async () => {
    if (!id) return;

    setIsGeneratingVideo(true);
    try {
      await generateVideo(id);
      Alert.alert(
        'Video Generation',
        'Video generation complete! (MOCK - In production, this would generate the actual video using an AI video service like Runway ML or Luma AI)',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to generate video');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  if (loading && !currentProject) {
    return (
      <View style={[styles.container, styles.centered]}>
        <LinearGradient
          colors={['#0a0a12', '#12121f', '#1a1a2e']}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  if (!currentProject) {
    return (
      <View style={[styles.container, styles.centered]}>
        <LinearGradient
          colors={['#0a0a12', '#12121f', '#1a1a2e']}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.errorText}>Project not found</Text>
        <TouchableOpacity
          style={styles.backHomeButton}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.backHomeText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getStatusInfo = () => {
    switch (currentProject.status) {
      case 'draft':
        return { color: '#6366f1', label: 'Draft', icon: 'document-outline' as const };
      case 'processing':
        return { color: '#f59e0b', label: 'Processing', icon: 'sync' as const };
      case 'storyboard_ready':
        return { color: '#10b981', label: 'Storyboard Ready', icon: 'film-outline' as const };
      case 'video_ready':
        return { color: '#8b5cf6', label: 'Video Ready', icon: 'videocam' as const };
      default:
        return { color: '#6366f1', label: 'Draft', icon: 'document-outline' as const };
    }
  };

  const statusInfo = getStatusInfo();

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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {currentProject.name}
        </Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteProject}
        >
          <Ionicons name="trash-outline" size={22} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Status Card */}
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View
                style={[
                  styles.statusIconContainer,
                  { backgroundColor: statusInfo.color + '20' },
                ]}
              >
                <Ionicons name={statusInfo.icon} size={24} color={statusInfo.color} />
              </View>
              <View style={styles.statusInfo}>
                <Text style={styles.statusLabel}>Status</Text>
                <Text style={[styles.statusValue, { color: statusInfo.color }]}>
                  {statusInfo.label}
                </Text>
              </View>
            </View>

            {/* Project Info */}
            <View style={styles.projectInfoGrid}>
              {currentProject.audio_filename && (
                <View style={styles.infoItem}>
                  <Ionicons name="musical-note" size={16} color="#6b7280" />
                  <Text style={styles.infoText} numberOfLines={1}>
                    {currentProject.audio_filename}
                  </Text>
                </View>
              )}
              {currentProject.audio_duration && (
                <View style={styles.infoItem}>
                  <Ionicons name="time-outline" size={16} color="#6b7280" />
                  <Text style={styles.infoText}>
                    {formatTime(currentProject.audio_duration)}
                  </Text>
                </View>
              )}
              {currentProject.audio_analysis?.tempo && (
                <View style={styles.infoItem}>
                  <Ionicons name="speedometer-outline" size={16} color="#6b7280" />
                  <Text style={styles.infoText}>
                    {currentProject.audio_analysis.tempo} BPM
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Storyboard Section */}
          {currentProject.storyboard && currentProject.storyboard.length > 0 && (
            <View style={styles.storyboardSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Storyboard</Text>
                <Text style={styles.sceneCount}>
                  {currentProject.storyboard.length} scenes
                </Text>
              </View>

              {currentProject.storyboard.map((scene, index) => (
                <TouchableOpacity
                  key={scene.id}
                  style={styles.sceneCard}
                  onPress={() => handleEditScene(scene)}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['rgba(139, 92, 246, 0.1)', 'rgba(99, 102, 241, 0.05)']}
                    style={styles.sceneCardGradient}
                  >
                    <View style={styles.sceneHeader}>
                      <View style={styles.sceneNumberBadge}>
                        <Text style={styles.sceneNumber}>{index + 1}</Text>
                      </View>
                      <Text style={styles.sceneTime}>
                        {formatTime(scene.start_time)} - {formatTime(scene.end_time)}
                      </Text>
                      <Ionicons name="pencil" size={16} color="#8b5cf6" />
                    </View>

                    <Text style={styles.sceneDescription}>{scene.description}</Text>

                    <View style={styles.sceneDetails}>
                      <View style={styles.sceneDetailItem}>
                        <Ionicons name="videocam-outline" size={14} color="#6b7280" />
                        <Text style={styles.sceneDetailText}>{scene.camera_movement}</Text>
                      </View>
                      <View style={styles.sceneDetailItem}>
                        <Ionicons name="bulb-outline" size={14} color="#6b7280" />
                        <Text style={styles.sceneDetailText}>{scene.lighting}</Text>
                      </View>
                      <View style={styles.sceneDetailItem}>
                        <Ionicons name="heart-outline" size={14} color="#6b7280" />
                        <Text style={styles.sceneDetailText}>{scene.mood}</Text>
                      </View>
                    </View>

                    {scene.lyric_segment && (
                      <View style={styles.lyricSegment}>
                        <Ionicons name="mic-outline" size={14} color="#8b5cf6" />
                        <Text style={styles.lyricText} numberOfLines={2}>
                          "{scene.lyric_segment}"
                        </Text>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Generate Video Button */}
          {currentProject.storyboard && currentProject.storyboard.length > 0 && (
            <TouchableOpacity
              style={styles.generateVideoButton}
              onPress={handleGenerateVideo}
              disabled={isGeneratingVideo}
            >
              <LinearGradient
                colors={['#8b5cf6', '#6366f1', '#4f46e5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.generateVideoGradient}
              >
                {isGeneratingVideo ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.generateVideoText}>Generating Video...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="videocam" size={24} color="#fff" />
                    <Text style={styles.generateVideoText}>
                      {currentProject.status === 'video_ready'
                        ? 'Regenerate Video'
                        : 'Generate Video'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Mock Video Notice */}
          {currentProject.status === 'video_ready' && (
            <View style={styles.mockNotice}>
              <Ionicons name="information-circle" size={20} color="#f59e0b" />
              <Text style={styles.mockNoticeText}>
                Video generation is currently in MOCK mode. Integrate a video AI API
                (Runway ML, Luma AI, or fal.ai) to generate actual videos.
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Edit Scene Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Scene</Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={styles.modalInput}
                value={editedScene.description}
                onChangeText={(text) =>
                  setEditedScene({ ...editedScene, description: text })
                }
                multiline
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.inputLabel}>Camera Movement</Text>
              <TextInput
                style={styles.modalInputSmall}
                value={editedScene.camera_movement}
                onChangeText={(text) =>
                  setEditedScene({ ...editedScene, camera_movement: text })
                }
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.inputLabel}>Lighting</Text>
              <TextInput
                style={styles.modalInputSmall}
                value={editedScene.lighting}
                onChangeText={(text) =>
                  setEditedScene({ ...editedScene, lighting: text })
                }
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.inputLabel}>Mood</Text>
              <TextInput
                style={styles.modalInputSmall}
                value={editedScene.mood}
                onChangeText={(text) =>
                  setEditedScene({ ...editedScene, mood: text })
                }
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.inputLabel}>Character Actions</Text>
              <TextInput
                style={styles.modalInput}
                value={editedScene.character_actions}
                onChangeText={(text) =>
                  setEditedScene({ ...editedScene, character_actions: text })
                }
                multiline
                placeholderTextColor="#6b7280"
              />
            </ScrollView>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveScene}
            >
              <LinearGradient
                colors={['#8b5cf6', '#6366f1']}
                style={styles.saveButtonGradient}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a12',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    marginBottom: 20,
  },
  backHomeButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: 12,
  },
  backHomeText: {
    color: '#8b5cf6',
    fontSize: 16,
    fontWeight: '600',
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
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginHorizontal: 12,
    textAlign: 'center',
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  statusCard: {
    backgroundColor: 'rgba(45, 45, 68, 0.3)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusInfo: {
    marginLeft: 12,
  },
  statusLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  projectInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  infoText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  storyboardSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  sceneCount: {
    fontSize: 14,
    color: '#8b5cf6',
  },
  sceneCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  sceneCardGradient: {
    padding: 16,
  },
  sceneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  sceneNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sceneNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  sceneTime: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
  },
  sceneDescription: {
    fontSize: 14,
    color: '#e5e7eb',
    lineHeight: 20,
    marginBottom: 12,
  },
  sceneDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  sceneDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  sceneDetailText: {
    fontSize: 11,
    color: '#9ca3af',
  },
  lyricSegment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  lyricText: {
    flex: 1,
    fontSize: 12,
    color: '#c4b5fd',
    fontStyle: 'italic',
  },
  generateVideoButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  generateVideoGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  generateVideoText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  mockNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    gap: 12,
  },
  mockNoticeText: {
    flex: 1,
    fontSize: 13,
    color: '#f59e0b',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    maxHeight: 400,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: 'rgba(45, 45, 68, 0.5)',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalInputSmall: {
    backgroundColor: 'rgba(45, 45, 68, 0.5)',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    marginBottom: 16,
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

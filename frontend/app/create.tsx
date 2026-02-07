import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  Modal,
  Share,
  PermissionsAndroid,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as DocumentPicker from 'expo-document-picker';
import { useCacheStore } from '../store/cacheStore';
import { useProjectStore } from '../store/projectStore';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function CreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createProject, saveLyrics } = useProjectStore();
  const { startAutoSave, stopAutoSave, saveToCache, exportStoryboardAsText } = useCacheStore();

  // State
  const [step, setStep] = useState(1); // 1: Upload Audio, 2: Review/Generate, 3: Edit Scenes, 4: Export
  const [projectName, setProjectName] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<any>(null);
  const [audioAnalysis, setAudioAnalysis] = useState<any>(null);
  const [lyrics, setLyrics] = useState(''); // Optional - helps AI understand unclear words
  const [renderStyle, setRenderStyle] = useState('cinematic photorealistic');
  const [scenes, setScenes] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editingScene, setEditingScene] = useState<any>(null);
  const [showSceneModal, setShowSceneModal] = useState(false);
  
  // Export options
  const [cloudBackup, setCloudBackup] = useState(false);
  const [dualBackup, setDualBackup] = useState(false);
  const [driveConfigured, setDriveConfigured] = useState(false);

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    startAutoSave();
    checkDriveStatus();
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    return () => {
      stopAutoSave();
      saveToCache();
    };
  }, []);

  const checkDriveStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/drive/status`);
      setDriveConfigured(response.data.configured);
    } catch (error) {
      setDriveConfigured(false);
    }
  };

  // Step 1: Pick Audio File
  const handlePickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-m4a', 'audio/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setAudioFile(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick audio file');
    }
  };

  // Step 1: Upload & Analyze Audio
  const handleUploadAudio = async () => {
    if (!projectName.trim()) {
      Alert.alert('Error', 'Please enter a project name');
      return;
    }
    if (!audioFile) {
      Alert.alert('Error', 'Please select an audio file');
      return;
    }

    setIsUploading(true);
    try {
      // Create project
      const projectResponse = await axios.post(`${API_URL}/api/projects`, {
        name: projectName.trim(),
      });
      const newProjectId = projectResponse.data.id;
      setProjectId(newProjectId);

      // Upload audio for analysis
      const formData = new FormData();
      formData.append('audio', {
        uri: audioFile.uri,
        name: audioFile.name || 'audio.mp3',
        type: audioFile.mimeType || 'audio/mpeg',
      } as any);

      const analysisResponse = await axios.post(
        `${API_URL}/api/projects/${newProjectId}/audio`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      setAudioAnalysis(analysisResponse.data.analysis);
      setStep(2);

    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', error?.response?.data?.detail || 'Failed to analyze audio');
    } finally {
      setIsUploading(false);
    }
  };

  // Step 2: Auto-Generate All Scenes
  const handleAutoGenerate = async () => {
    if (!projectId) {
      Alert.alert('Error', 'Project not found');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await axios.post(`${API_URL}/api/projects/${projectId}/auto-generate`, {
        project_id: projectId,
        lyrics: lyrics.trim() || null, // Optional - helps AI understand unclear words
        render_style: renderStyle,
      });

      setScenes(response.data.scenes);
      setStep(3);

      Alert.alert(
        'Success!',
        `AI generated ${response.data.total_scenes} scenes automatically!\n\nYou can now review and edit any scene.`
      );

    } catch (error: any) {
      console.error('Generation error:', error);
      Alert.alert('Error', error?.response?.data?.detail || 'Failed to generate scenes');
    } finally {
      setIsGenerating(false);
    }
  };

  // Step 3: Edit a scene
  const handleSaveSceneEdit = async () => {
    if (!editingScene || !projectId) return;

    try {
      await axios.put(`${API_URL}/api/projects/${projectId}/scenes/${editingScene.id}`, {
        project_id: projectId,
        scene_id: editingScene.id,
        description: editingScene.description,
        camera_movement: editingScene.camera_movement,
        lighting: editingScene.lighting,
        mood: editingScene.mood,
        render_style: editingScene.render_style,
      });

      // Update local state
      setScenes(prev => prev.map(s => s.id === editingScene.id ? editingScene : s));
      setShowSceneModal(false);
      setEditingScene(null);

    } catch (error) {
      Alert.alert('Error', 'Failed to save scene');
    }
  };

  // Step 4: Export
  const handleExport = async () => {
    if (scenes.length === 0) {
      Alert.alert('Error', 'No scenes to export');
      return;
    }

    setIsExporting(true);
    try {
      // Build export text with GROK-optimized prompts
      const exportLines = [
        '='.repeat(60),
        'LYRICSINMOTION STORYBOARD EXPORT',
        `Project: ${projectName}`,
        `Exported: ${new Date().toLocaleString()}`,
        `Total Scenes: ${scenes.length}`,
        `Render Style: ${renderStyle}`,
        '='.repeat(60),
        '',
        'Each scene block is optimized for GROK 4.1 text-to-video.',
        'Generate 8-10 second clips per block.',
        '',
        '='.repeat(60),
      ];

      scenes.forEach((scene, i) => {
        exportLines.push('');
        exportLines.push('-'.repeat(60));
        exportLines.push(`[SCENE ${scene.segment_number || i + 1}] [${scene.start_time}s - ${scene.end_time}s]`);
        exportLines.push(`SECTION: ${scene.section_type || 'verse'} | ENERGY: ${scene.energy || 'medium'}`);
        exportLines.push('');
        exportLines.push(`VISUAL: ${scene.description}`);
        exportLines.push('');
        exportLines.push(`CAMERA: ${scene.camera_movement}`);
        exportLines.push(`LIGHTING: ${scene.lighting}`);
        exportLines.push(`MOOD: ${scene.mood}`);
        exportLines.push(`STYLE: ${scene.render_style || renderStyle}`);
        exportLines.push('');
        if (scene.grok_prompt) {
          exportLines.push('GROK PROMPT:');
          exportLines.push(scene.grok_prompt);
        }
        exportLines.push('-'.repeat(60));
      });

      exportLines.push('');
      exportLines.push('='.repeat(60));
      exportLines.push(`TOTAL RUNTIME: ~${scenes.length * 8} seconds`);
      exportLines.push('='.repeat(60));

      const exportText = exportLines.join('\n');
      const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_storyboard_${Date.now()}.txt`;

      // Save using native file system
      if (Platform.OS === 'android') {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            filename,
            'text/plain'
          );
          await FileSystem.writeAsStringAsync(fileUri, exportText);
        } else {
          // Fallback to document directory
          const filePath = `${FileSystem.documentDirectory}${filename}`;
          await FileSystem.writeAsStringAsync(filePath, exportText);
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(filePath, { mimeType: 'text/plain' });
          }
        }
      } else {
        const filePath = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(filePath, exportText);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filePath, { mimeType: 'text/plain' });
        }
      }

      // Also upload to cloud if selected
      if (cloudBackup || dualBackup) {
        await axios.post(`${API_URL}/api/drive/upload`, {
          filename,
          content: exportText,
          cloud_backup: cloudBackup,
          dual_backup: dualBackup,
        });
      }

      Alert.alert('Export Complete', `Saved: ${filename}`);

    } catch (error: any) {
      console.error('Export error:', error);
      Alert.alert('Error', error?.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  // Render Step 1: Upload Audio
  const renderStep1 = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      <View style={styles.stepHeader}>
        <Ionicons name="musical-notes" size={48} color="#8b5cf6" />
        <Text style={styles.stepTitle}>Upload Your Track</Text>
        <Text style={styles.stepDescription}>
          AI will analyze the rhythm, tempo, and energy to auto-generate scene descriptions
        </Text>
      </View>

      <Text style={styles.inputLabel}>Project Name</Text>
      <TextInput
        style={styles.input}
        placeholder="My Music Video..."
        placeholderTextColor="#6b7280"
        value={projectName}
        onChangeText={setProjectName}
      />

      <TouchableOpacity style={styles.uploadBox} onPress={handlePickAudio}>
        <LinearGradient
          colors={['rgba(139, 92, 246, 0.2)', 'rgba(99, 102, 241, 0.1)']}
          style={styles.uploadBoxGradient}
        >
          {audioFile ? (
            <>
              <Ionicons name="checkmark-circle" size={48} color="#10b981" />
              <Text style={styles.uploadedFileName}>{audioFile.name}</Text>
              <Text style={styles.uploadSubtext}>Tap to change</Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={48} color="#8b5cf6" />
              <Text style={styles.uploadText}>Tap to select MP3/WAV</Text>
              <Text style={styles.uploadSubtext}>AI will analyze rhythm & energy</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.primaryButton, (!audioFile || !projectName.trim() || isUploading) && styles.buttonDisabled]}
        onPress={handleUploadAudio}
        disabled={!audioFile || !projectName.trim() || isUploading}
      >
        <LinearGradient
          colors={audioFile && projectName.trim() ? ['#8b5cf6', '#6366f1'] : ['#3f3f5a', '#3f3f5a']}
          style={styles.primaryButtonGradient}
        >
          {isUploading ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.primaryButtonText}>Analyzing Audio...</Text>
            </>
          ) : (
            <>
              <Ionicons name="analytics" size={22} color="#fff" />
              <Text style={styles.primaryButtonText}>Analyze & Continue</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  // Render Step 2: Review Analysis & Generate
  const renderStep2 = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      <View style={styles.stepHeader}>
        <Ionicons name="sparkles" size={48} color="#8b5cf6" />
        <Text style={styles.stepTitle}>Audio Analyzed!</Text>
        <Text style={styles.stepDescription}>
          AI detected the rhythm. Now generate all scene descriptions automatically.
        </Text>
      </View>

      {/* Audio Analysis Summary */}
      {audioAnalysis && (
        <View style={styles.analysisSummary}>
          <View style={styles.analysisRow}>
            <View style={styles.analysisItem}>
              <Text style={styles.analysisValue}>{Math.round(audioAnalysis.duration)}s</Text>
              <Text style={styles.analysisLabel}>Duration</Text>
            </View>
            <View style={styles.analysisItem}>
              <Text style={styles.analysisValue}>{Math.round(audioAnalysis.tempo)} BPM</Text>
              <Text style={styles.analysisLabel}>Tempo</Text>
            </View>
            <View style={styles.analysisItem}>
              <Text style={styles.analysisValue}>{audioAnalysis.num_segments}</Text>
              <Text style={styles.analysisLabel}>Scenes</Text>
            </View>
          </View>
        </View>
      )}

      {/* Optional Lyrics */}
      <Text style={styles.inputLabel}>Lyrics (Optional)</Text>
      <Text style={styles.inputHint}>Helps AI understand slang or unclear words</Text>
      <TextInput
        style={styles.lyricsInput}
        placeholder="Paste lyrics here if you want AI to better understand the words..."
        placeholderTextColor="#4b5563"
        value={lyrics}
        onChangeText={setLyrics}
        multiline
        textAlignVertical="top"
      />

      {/* Render Style */}
      <Text style={styles.inputLabel}>Render Style</Text>
      <TextInput
        style={styles.input}
        placeholder="cinematic photorealistic"
        placeholderTextColor="#6b7280"
        value={renderStyle}
        onChangeText={setRenderStyle}
      />

      <TouchableOpacity
        style={[styles.primaryButton, isGenerating && styles.buttonDisabled]}
        onPress={handleAutoGenerate}
        disabled={isGenerating}
      >
        <LinearGradient
          colors={isGenerating ? ['#3f3f5a', '#3f3f5a'] : ['#8b5cf6', '#6366f1', '#4f46e5']}
          style={styles.primaryButtonGradient}
        >
          {isGenerating ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.primaryButtonText}>AI Generating {audioAnalysis?.num_segments || '...'} Scenes...</Text>
            </>
          ) : (
            <>
              <Ionicons name="flash" size={22} color="#fff" />
              <Text style={styles.primaryButtonText}>Auto-Generate All Scenes</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  // Render Step 3: Review & Edit Scenes
  const renderStep3 = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>{scenes.length} Scenes Generated</Text>
        <Text style={styles.stepDescription}>
          Review and edit any scene. Tap a scene to modify.
        </Text>
      </View>

      <ScrollView style={styles.scenesList} showsVerticalScrollIndicator={false}>
        {scenes.map((scene, index) => (
          <TouchableOpacity
            key={scene.id || index}
            style={styles.sceneCard}
            onPress={() => {
              setEditingScene({ ...scene });
              setShowSceneModal(true);
            }}
          >
            <LinearGradient
              colors={['rgba(139, 92, 246, 0.15)', 'rgba(99, 102, 241, 0.08)']}
              style={styles.sceneCardGradient}
            >
              <View style={styles.sceneCardHeader}>
                <View style={styles.sceneNumber}>
                  <Text style={styles.sceneNumberText}>{scene.segment_number || index + 1}</Text>
                </View>
                <Text style={styles.sceneTime}>{scene.start_time}s - {scene.end_time}s</Text>
                <View style={[styles.energyBadge, { backgroundColor: scene.energy > 0.6 ? '#ef444420' : scene.energy > 0.3 ? '#f59e0b20' : '#10b98120' }]}>
                  <Text style={[styles.energyText, { color: scene.energy > 0.6 ? '#ef4444' : scene.energy > 0.3 ? '#f59e0b' : '#10b981' }]}>
                    {scene.section_type || 'verse'}
                  </Text>
                </View>
              </View>
              <Text style={styles.sceneDescription} numberOfLines={3}>
                {scene.description || 'Tap to add description...'}
              </Text>
              <View style={styles.sceneFooter}>
                <Text style={styles.sceneStyle}>{scene.render_style || renderStyle}</Text>
                <Ionicons name="pencil" size={16} color="#8b5cf6" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(4)}>
        <LinearGradient colors={['#10b981', '#059669']} style={styles.primaryButtonGradient}>
          <Ionicons name="arrow-forward" size={22} color="#fff" />
          <Text style={styles.primaryButtonText}>Proceed to Export</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  // Render Step 4: Export
  const renderStep4 = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      <View style={styles.stepHeader}>
        <Ionicons name="download" size={48} color="#10b981" />
        <Text style={styles.stepTitle}>Export Storyboard</Text>
        <Text style={styles.stepDescription}>
          Export GROK 4.1 optimized prompts for each scene
        </Text>
      </View>

      <View style={styles.exportSummary}>
        <Text style={styles.summaryText}>{scenes.length} scenes ready</Text>
        <Text style={styles.summaryText}>~{scenes.length * 8} seconds runtime</Text>
        <Text style={styles.summaryText}>Style: {renderStyle}</Text>
      </View>

      {/* Backup Options */}
      <View style={styles.backupOptions}>
        <TouchableOpacity
          style={[styles.backupOption, cloudBackup && styles.backupOptionActive]}
          onPress={() => setCloudBackup(!cloudBackup)}
          disabled={!driveConfigured}
        >
          <View style={[styles.checkbox, cloudBackup && styles.checkboxActive]}>
            {cloudBackup && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={styles.backupLabel}>CLOUD Backup (EXPORTS)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.backupOption, dualBackup && styles.backupOptionActive]}
          onPress={() => setDualBackup(!dualBackup)}
          disabled={!driveConfigured}
        >
          <View style={[styles.checkbox, dualBackup && styles.checkboxActive]}>
            {dualBackup && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={styles.backupLabel}>DUAL Backup (MULTI)</Text>
        </TouchableOpacity>

        <View style={styles.localAlways}>
          <Ionicons name="phone-portrait" size={16} color="#10b981" />
          <Text style={styles.localAlwaysText}>Local storage always enabled</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.exportButton, isExporting && styles.buttonDisabled]}
        onPress={handleExport}
        disabled={isExporting}
      >
        <LinearGradient
          colors={isExporting ? ['#3f3f5a', '#3f3f5a'] : ['#8b5cf6', '#6366f1']}
          style={styles.exportButtonGradient}
        >
          {isExporting ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.exportButtonText}>Exporting...</Text>
            </>
          ) : (
            <>
              <Ionicons name="download" size={24} color="#fff" />
              <Text style={styles.exportButtonText}>EXPORT</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButton} onPress={() => setStep(3)}>
        <Ionicons name="arrow-back" size={18} color="#8b5cf6" />
        <Text style={styles.backButtonText}>Back to Scenes</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <ImageBackground
      source={require('../assets/images/lyricsinmotion-logo.jpg')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(10, 10, 18, 0.92)', 'rgba(10, 10, 18, 0.96)', 'rgba(10, 10, 18, 0.98)']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {step === 1 ? 'New Project' : step === 2 ? 'Generate' : step === 3 ? 'Edit Scenes' : 'Export'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Progress */}
        <View style={styles.progress}>
          {[1, 2, 3, 4].map((s) => (
            <View key={s} style={styles.progressItem}>
              <View style={[styles.progressDot, step >= s && styles.progressDotActive]} />
              {s < 4 && <View style={[styles.progressLine, step > s && styles.progressLineActive]} />}
            </View>
          ))}
        </View>

        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* Scene Edit Modal */}
      <Modal visible={showSceneModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Scene #{editingScene?.segment_number}</Text>
              <TouchableOpacity onPress={() => setShowSceneModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.modalLabel}>Scene Description</Text>
              <TextInput
                style={styles.modalInputLarge}
                value={editingScene?.description}
                onChangeText={(text) => setEditingScene((prev: any) => prev ? { ...prev, description: text } : null)}
                placeholder="Describe the visual..."
                placeholderTextColor="#6b7280"
                multiline
              />

              <Text style={styles.modalLabel}>Render Style</Text>
              <TextInput
                style={styles.modalInput}
                value={editingScene?.render_style || renderStyle}
                onChangeText={(text) => setEditingScene((prev: any) => prev ? { ...prev, render_style: text } : null)}
                placeholder="cinematic photorealistic"
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.modalLabel}>Camera Movement</Text>
              <TextInput
                style={styles.modalInput}
                value={editingScene?.camera_movement}
                onChangeText={(text) => setEditingScene((prev: any) => prev ? { ...prev, camera_movement: text } : null)}
                placeholder="Slow dolly, tracking shot..."
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.modalLabel}>Lighting</Text>
              <TextInput
                style={styles.modalInput}
                value={editingScene?.lighting}
                onChangeText={(text) => setEditingScene((prev: any) => prev ? { ...prev, lighting: text } : null)}
                placeholder="Neon glow, dramatic shadows..."
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.modalLabel}>Mood</Text>
              <TextInput
                style={styles.modalInput}
                value={editingScene?.mood}
                onChangeText={(text) => setEditingScene((prev: any) => prev ? { ...prev, mood: text } : null)}
                placeholder="Intense, ethereal, triumphant..."
                placeholderTextColor="#6b7280"
              />
            </ScrollView>

            <TouchableOpacity style={styles.modalSaveButton} onPress={handleSaveSceneEdit}>
              <LinearGradient colors={['#8b5cf6', '#6366f1']} style={styles.modalSaveGradient}>
                <Text style={styles.modalSaveText}>Save Changes</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  progressItem: { flexDirection: 'row', alignItems: 'center' },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3f3f5a',
  },
  progressDotActive: { backgroundColor: '#8b5cf6' },
  progressLine: {
    width: 30,
    height: 2,
    backgroundColor: '#3f3f5a',
    marginHorizontal: 4,
  },
  progressLineActive: { backgroundColor: '#8b5cf6' },
  content: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  stepHeader: { alignItems: 'center', marginBottom: 24 },
  stepTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginTop: 12 },
  stepDescription: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#9ca3af', marginBottom: 6 },
  inputHint: { fontSize: 11, color: '#6b7280', marginBottom: 8, marginTop: -4 },
  input: {
    backgroundColor: 'rgba(45, 45, 68, 0.5)',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    marginBottom: 16,
  },
  lyricsInput: {
    backgroundColor: 'rgba(45, 45, 68, 0.5)',
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    marginBottom: 16,
    minHeight: 100,
    maxHeight: 150,
  },
  uploadBox: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  uploadBoxGradient: { padding: 32, alignItems: 'center' },
  uploadText: { fontSize: 15, fontWeight: '600', color: '#8b5cf6', marginTop: 12 },
  uploadSubtext: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  uploadedFileName: { fontSize: 14, fontWeight: '600', color: '#10b981', marginTop: 12 },
  primaryButton: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  analysisSummary: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  analysisRow: { flexDirection: 'row', justifyContent: 'space-around' },
  analysisItem: { alignItems: 'center' },
  analysisValue: { fontSize: 20, fontWeight: '700', color: '#8b5cf6' },
  analysisLabel: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  scenesList: { flex: 1, maxHeight: 400 },
  sceneCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  sceneCardGradient: { padding: 12 },
  sceneCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  sceneNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sceneNumberText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  sceneTime: { flex: 1, fontSize: 11, color: '#6b7280' },
  energyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  energyText: { fontSize: 10, fontWeight: '600' },
  sceneDescription: { fontSize: 13, color: '#e5e7eb', lineHeight: 18 },
  sceneFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sceneStyle: { fontSize: 10, color: '#6b7280' },
  exportSummary: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  summaryText: { fontSize: 14, color: '#10b981', marginBottom: 4 },
  backupOptions: { marginBottom: 20 },
  backupOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: 'rgba(45, 45, 68, 0.4)',
    borderRadius: 10,
    marginBottom: 10,
    gap: 12,
  },
  backupOptionActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#6b7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  backupLabel: { fontSize: 14, color: '#fff' },
  localAlways: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  localAlwaysText: { fontSize: 12, color: '#10b981' },
  exportButton: { borderRadius: 14, overflow: 'hidden', marginBottom: 16 },
  exportButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  exportButtonText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  backButtonText: { fontSize: 14, color: '#8b5cf6' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  modalScroll: { maxHeight: 350 },
  modalLabel: { fontSize: 12, fontWeight: '600', color: '#9ca3af', marginBottom: 4, marginTop: 12 },
  modalInput: {
    backgroundColor: 'rgba(45, 45, 68, 0.5)',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  modalInputLarge: {
    backgroundColor: 'rgba(45, 45, 68, 0.5)',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalSaveButton: { borderRadius: 10, overflow: 'hidden', marginTop: 16 },
  modalSaveGradient: { paddingVertical: 14, alignItems: 'center' },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

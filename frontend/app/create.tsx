import React, { useEffect, useState, useRef, useCallback } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCacheStore, StoryboardScene } from '../store/cacheStore';
import { useProjectStore } from '../store/projectStore';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function StoryboardCreator() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const {
    currentSession,
    updateSession,
    startAutoSave,
    stopAutoSave,
    saveToCache,
    addScene,
    updateScene,
    removeScene,
    exportStoryboardAsText,
    createNewSession,
  } = useCacheStore();

  const { createProject, saveLyrics, saveTheme } = useProjectStore();

  const [mode, setMode] = useState<'manual' | 'auto-breakdown'>('manual');
  const [projectName, setProjectName] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [theme, setTheme] = useState('');
  const [blockDuration, setBlockDuration] = useState(8);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingScene, setEditingScene] = useState<StoryboardScene | null>(null);
  const [showSceneModal, setShowSceneModal] = useState(false);
  const [step, setStep] = useState(1); // 1: Setup, 2: Storyboard Editor, 3: Export

  // Export options
  const [cloudBackup, setCloudBackup] = useState(false);
  const [dualBackup, setDualBackup] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<any>(null);
  const [driveConfigured, setDriveConfigured] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start auto-save
    startAutoSave();
    
    // Check Drive configuration
    checkDriveStatus();
    
    // Initialize from cache if exists
    if (currentSession) {
      setProjectName(currentSession.projectName || '');
      setLyrics(currentSession.lyrics || '');
      setTheme(currentSession.theme || '');
      setMode(currentSession.mode || 'manual');
      setBlockDuration(currentSession.breakdownDuration || 8);
      if (currentSession.storyboardScenes.length > 0) {
        setStep(2);
      }
    }

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

  // Update cache whenever inputs change
  useEffect(() => {
    updateSession({
      projectName,
      lyrics,
      theme,
      mode,
      breakdownDuration: blockDuration,
      currentStep: step,
    });
  }, [projectName, lyrics, theme, mode, blockDuration, step]);

  const checkDriveStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/drive/status`);
      setDriveConfigured(response.data.configured);
    } catch (error) {
      setDriveConfigured(false);
    }
  };

  const handleAutoBreakdown = async () => {
    if (!lyrics.trim()) {
      Alert.alert('Error', 'Please enter lyrics first');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await axios.post(`${API_URL}/api/breakdown-lyrics`, {
        lyrics: lyrics.trim(),
        theme: theme.trim(),
        block_duration: blockDuration,
      });

      const { scenes } = response.data;
      
      createNewSession('auto-breakdown');
      updateSession({
        projectName,
        lyrics,
        theme,
        mode: 'auto-breakdown',
        breakdownDuration: blockDuration,
      });

      scenes.forEach((scene: any) => {
        addScene({
          lyricSegment: scene.lyric_segment,
          sceneDescription: scene.description,
          cameraMovement: scene.camera_movement,
          lighting: scene.lighting,
          mood: scene.mood,
          characterActions: scene.character_actions,
          visualStyle: scene.visual_style,
          startTime: scene.start_time,
          endTime: scene.end_time,
        });
      });

      setStep(2);
    } catch (error: any) {
      console.error('Breakdown error:', error);
      Alert.alert('Error', error?.response?.data?.detail || 'Failed to generate breakdown');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddManualScene = () => {
    const scenes = currentSession?.storyboardScenes || [];
    const lastScene = scenes[scenes.length - 1];
    const startTime = lastScene ? lastScene.endTime : 0;
    
    setEditingScene({
      id: '',
      blockNumber: scenes.length + 1,
      startTime,
      endTime: startTime + blockDuration,
      lyricSegment: '',
      sceneDescription: '',
      cameraMovement: '',
      lighting: '',
      mood: '',
      characterActions: '',
      visualStyle: '',
      grokPrompt: '',
    });
    setShowSceneModal(true);
  };

  const handleSaveScene = () => {
    if (!editingScene) return;

    if (editingScene.id) {
      updateScene(editingScene.id, editingScene);
    } else {
      addScene(editingScene);
    }
    setShowSceneModal(false);
    setEditingScene(null);
  };

  const handleProceedToExport = () => {
    if (!currentSession || currentSession.storyboardScenes.length === 0) {
      Alert.alert('Error', 'No storyboard scenes to export');
      return;
    }
    setStep(3);
  };

  const handleExport = async () => {
    if (!currentSession || currentSession.storyboardScenes.length === 0) {
      Alert.alert('Error', 'No storyboard scenes to export');
      return;
    }

    setIsExporting(true);
    setExportResult(null);

    try {
      const exportText = exportStoryboardAsText(projectName || 'Untitled');
      const filename = `${(projectName || 'Untitled').replace(/\\s+/g, '_')}_storyboard_${Date.now()}.txt`;
      const filePath = `${FileSystem.documentDirectory}${filename}`;

      // Always save locally first
      await FileSystem.writeAsStringAsync(filePath, exportText);

      // Upload to backend/Google Drive
      const uploadResponse = await axios.post(`${API_URL}/api/drive/upload`, {
        filename,
        content: exportText,
        cloud_backup: cloudBackup,
        dual_backup: dualBackup,
      });

      setExportResult({
        ...uploadResponse.data,
        localPath: filePath,
        filename,
      });

      // Share locally if available
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/plain',
          dialogTitle: 'Export Storyboard Prompts',
        });
      }

      // Show success message
      let message = 'Storyboard exported to local storage!';
      if (uploadResponse.data.cloud_backup?.success) {
        message += '\n✓ Uploaded to EXPORTS folder';
      }
      if (uploadResponse.data.dual_backup?.success) {
        message += '\n✓ Uploaded to MULTI folder';
      }
      if (uploadResponse.data.errors?.length > 0) {
        message += '\n\nWarnings: ' + uploadResponse.data.errors.join(', ');
      }

      Alert.alert('Export Complete', message);

    } catch (error: any) {
      console.error('Export error:', error);
      Alert.alert('Export Error', error?.message || 'Failed to export storyboard');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveProject = async () => {
    if (!projectName.trim()) {
      Alert.alert('Error', 'Please enter a project name');
      return;
    }

    try {
      const project = await createProject(projectName.trim());
      if (lyrics.trim()) {
        await saveLyrics(project.id, lyrics.trim());
      }
      if (theme.trim()) {
        await saveTheme(project.id, theme.trim());
      }
      
      await saveToCache();
      Alert.alert('Saved', 'Project saved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to save project');
    }
  };

  // Radio Button Component
  const RadioButton = ({ selected, onPress, label, sublabel, icon, disabled }: any) => (
    <TouchableOpacity
      style={[styles.radioButton, selected && styles.radioButtonSelected, disabled && styles.radioButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected && <View style={styles.radioInner} />}
      </View>
      <View style={styles.radioContent}>
        <View style={styles.radioHeader}>
          <Ionicons name={icon} size={18} color={selected ? '#10b981' : '#8b5cf6'} />
          <Text style={[styles.radioLabel, selected && styles.radioLabelSelected]}>{label}</Text>
        </View>
        <Text style={styles.radioSublabel}>{sublabel}</Text>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={22} color="#10b981" />}
    </TouchableOpacity>
  );

  const renderSetupStep = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      {/* Mode Selection */}
      <View style={styles.modeSelector}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'manual' && styles.modeButtonActive]}
          onPress={() => setMode('manual')}
        >
          <Ionicons name="create-outline" size={20} color={mode === 'manual' ? '#fff' : '#8b5cf6'} />
          <Text style={[styles.modeButtonText, mode === 'manual' && styles.modeButtonTextActive]}>
            Manual
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'auto-breakdown' && styles.modeButtonActive]}
          onPress={() => setMode('auto-breakdown')}
        >
          <Ionicons name="sparkles" size={20} color={mode === 'auto-breakdown' ? '#fff' : '#8b5cf6'} />
          <Text style={[styles.modeButtonText, mode === 'auto-breakdown' && styles.modeButtonTextActive]}>
            AI Breakdown
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.modeDescription}>
        {mode === 'manual' 
          ? 'Create storyboard scenes manually, one by one'
          : 'AI automatically breaks lyrics into 8-second video blocks with GROK-optimized prompts'}
      </Text>

      {/* Project Name */}
      <Text style={styles.inputLabel}>Project Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter project name..."
        placeholderTextColor="#6b7280"
        value={projectName}
        onChangeText={setProjectName}
      />

      {/* Lyrics Input */}
      <Text style={styles.inputLabel}>Song Lyrics</Text>
      <TextInput
        style={styles.lyricsInput}
        placeholder="Paste complete song lyrics here...\n\n[Verse 1]\nYour lyrics...\n\n[Chorus]\n..."
        placeholderTextColor="#4b5563"
        value={lyrics}
        onChangeText={setLyrics}
        multiline
        textAlignVertical="top"
      />

      {/* Theme/Style */}
      <Text style={styles.inputLabel}>Visual Theme (Optional)</Text>
      <TextInput
        style={styles.themeInput}
        placeholder="e.g., Cyberpunk cityscape, neon lights, futuristic dystopia..."
        placeholderTextColor="#4b5563"
        value={theme}
        onChangeText={setTheme}
        multiline
        textAlignVertical="top"
      />

      {/* Block Duration */}
      {mode === 'auto-breakdown' && (
        <View style={styles.durationSelector}>
          <Text style={styles.inputLabel}>Block Duration: {blockDuration}s</Text>
          <View style={styles.durationButtons}>
            {[6, 8, 10].map((dur) => (
              <TouchableOpacity
                key={dur}
                style={[styles.durationButton, blockDuration === dur && styles.durationButtonActive]}
                onPress={() => setBlockDuration(dur)}
              >
                <Text style={[styles.durationButtonText, blockDuration === dur && styles.durationButtonTextActive]}>
                  {dur}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {mode === 'auto-breakdown' ? (
          <TouchableOpacity
            style={[styles.generateButton, (!lyrics.trim() || isGenerating) && styles.buttonDisabled]}
            onPress={handleAutoBreakdown}
            disabled={!lyrics.trim() || isGenerating}
          >
            <LinearGradient
              colors={lyrics.trim() && !isGenerating ? ['#8b5cf6', '#6366f1'] : ['#3f3f5a', '#3f3f5a']}
              style={styles.generateButtonGradient}
            >
              {isGenerating ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.generateButtonText}>Generating Breakdown...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles" size={22} color="#fff" />
                  <Text style={styles.generateButtonText}>Generate AI Breakdown</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.generateButton}
            onPress={() => {
              if (!projectName.trim()) {
                Alert.alert('Error', 'Please enter a project name');
                return;
              }
              createNewSession('manual');
              updateSession({ projectName, lyrics, theme, mode: 'manual' });
              setStep(2);
            }}
          >
            <LinearGradient colors={['#8b5cf6', '#6366f1']} style={styles.generateButtonGradient}>
              <Ionicons name="create" size={22} color="#fff" />
              <Text style={styles.generateButtonText}>Start Manual Storyboard</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );

  const renderStoryboardEditor = () => (
    <Animated.View style={[styles.editorContainer, { opacity: fadeAnim }]}>
      {/* Editor Header */}
      <View style={styles.editorHeader}>
        <Text style={styles.editorTitle}>{projectName || 'Untitled'}</Text>
        <Text style={styles.editorSubtitle}>
          {currentSession?.storyboardScenes.length || 0} scenes • {mode === 'auto-breakdown' ? 'AI Breakdown' : 'Manual'}
        </Text>
      </View>

      {/* Scenes List */}
      <ScrollView style={styles.scenesList} showsVerticalScrollIndicator={false}>
        {currentSession?.storyboardScenes.map((scene, index) => (
          <TouchableOpacity
            key={scene.id}
            style={styles.sceneCard}
            onPress={() => {
              setEditingScene(scene);
              setShowSceneModal(true);
            }}
          >
            <LinearGradient
              colors={['rgba(139, 92, 246, 0.15)', 'rgba(99, 102, 241, 0.08)']}
              style={styles.sceneCardGradient}
            >
              <View style={styles.sceneCardHeader}>
                <View style={styles.sceneNumber}>
                  <Text style={styles.sceneNumberText}>{scene.blockNumber}</Text>
                </View>
                <Text style={styles.sceneTime}>
                  {scene.startTime}s - {scene.endTime}s
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert('Delete Scene', 'Remove this scene?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => removeScene(scene.id) },
                    ]);
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
              
              {scene.lyricSegment && (
                <Text style={styles.sceneLyric} numberOfLines={2}>
                  "{scene.lyricSegment}"
                </Text>
              )}
              
              <Text style={styles.sceneDesc} numberOfLines={2}>
                {scene.sceneDescription || 'Tap to edit scene details...'}
              </Text>
              
              <View style={styles.sceneTags}>
                {scene.mood && (
                  <View style={styles.sceneTag}>
                    <Text style={styles.sceneTagText}>{scene.mood}</Text>
                  </View>
                )}
                {scene.cameraMovement && (
                  <View style={styles.sceneTag}>
                    <Text style={styles.sceneTagText}>{scene.cameraMovement}</Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}

        {/* Add Scene Button */}
        <TouchableOpacity style={styles.addSceneButton} onPress={handleAddManualScene}>
          <Ionicons name="add-circle" size={24} color="#8b5cf6" />
          <Text style={styles.addSceneText}>Add Scene</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSaveProject}>
          <Ionicons name="save-outline" size={20} color="#8b5cf6" />
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.exportButton}
          onPress={handleProceedToExport}
        >
          <LinearGradient colors={['#10b981', '#059669']} style={styles.exportButtonGradient}>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
            <Text style={styles.exportButtonText}>Proceed to Export</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderExportStep = () => (
    <Animated.View style={[styles.exportContainer, { opacity: fadeAnim }]}>
      {/* Export Header */}
      <View style={styles.exportHeader}>
        <Ionicons name="cloud-upload" size={48} color="#8b5cf6" />
        <Text style={styles.exportTitle}>Export Storyboard</Text>
        <Text style={styles.exportSubtitle}>
          {currentSession?.storyboardScenes.length || 0} scenes ready • {projectName || 'Untitled'}
        </Text>
      </View>

      {/* Sticky Backup Options */}
      <View style={styles.backupOptionsContainer}>
        <Text style={styles.backupOptionsTitle}>Backup Options</Text>
        
        <RadioButton
          selected={cloudBackup}
          onPress={() => setCloudBackup(!cloudBackup)}
          label="CLOUD Backup"
          sublabel="Upload to Google Drive EXPORTS folder"
          icon="cloud-outline"
          disabled={!driveConfigured}
        />
        
        <RadioButton
          selected={dualBackup}
          onPress={() => setDualBackup(!dualBackup)}
          label="DUAL"
          sublabel="Upload to Google Drive MULTI folder"
          icon="copy-outline"
          disabled={!driveConfigured}
        />

        {!driveConfigured && (
          <View style={styles.driveNotice}>
            <Ionicons name="information-circle" size={18} color="#f59e0b" />
            <Text style={styles.driveNoticeText}>
              Google Drive not configured. Local storage only.
            </Text>
          </View>
        )}

        <View style={styles.alwaysLocal}>
          <Ionicons name="phone-portrait-outline" size={16} color="#10b981" />
          <Text style={styles.alwaysLocalText}>✓ Local storage is always enabled</Text>
        </View>
      </View>

      {/* Export Summary */}
      <View style={styles.exportSummary}>
        <Text style={styles.summaryTitle}>Export Summary:</Text>
        <Text style={styles.summaryItem}>• Local Storage: Always</Text>
        {cloudBackup && <Text style={styles.summaryItem}>• EXPORTS Folder: Enabled</Text>}
        {dualBackup && <Text style={styles.summaryItem}>• MULTI Folder: Enabled</Text>}
      </View>

      {/* Export Result */}
      {exportResult && (
        <View style={styles.exportResult}>
          <Text style={styles.resultTitle}>Export Results:</Text>
          {exportResult.local_saved && (
            <View style={styles.resultItem}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.resultText}>Local: Saved</Text>
            </View>
          )}
          {exportResult.cloud_backup?.success && (
            <View style={styles.resultItem}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.resultText}>EXPORTS: Uploaded</Text>
            </View>
          )}
          {exportResult.dual_backup?.success && (
            <View style={styles.resultItem}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.resultText}>MULTI: Uploaded</Text>
            </View>
          )}
          {exportResult.errors?.map((err: string, i: number) => (
            <View key={i} style={styles.resultItem}>
              <Ionicons name="warning" size={18} color="#f59e0b" />
              <Text style={styles.resultTextWarning}>{err}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Export Button */}
      <TouchableOpacity
        style={[styles.mainExportButton, isExporting && styles.buttonDisabled]}
        onPress={handleExport}
        disabled={isExporting}
      >
        <LinearGradient
          colors={isExporting ? ['#3f3f5a', '#3f3f5a'] : ['#8b5cf6', '#6366f1', '#4f46e5']}
          style={styles.mainExportGradient}
        >
          {isExporting ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.mainExportText}>Exporting...</Text>
            </>
          ) : (
            <>
              <Ionicons name="download" size={24} color="#fff" />
              <Text style={styles.mainExportText}>EXPORT</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {/* Back to Editor */}
      <TouchableOpacity style={styles.backToEditor} onPress={() => setStep(2)}>
        <Ionicons name="arrow-back" size={18} color="#8b5cf6" />
        <Text style={styles.backToEditorText}>Back to Storyboard</Text>
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
        colors={['rgba(10, 10, 18, 0.92)', 'rgba(10, 10, 18, 0.95)', 'rgba(10, 10, 18, 0.98)']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {step === 1 ? 'Storyboard Creator' : step === 2 ? 'Edit Storyboard' : 'Export'}
          </Text>
          {step === 2 && (
            <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
              <Ionicons name="settings-outline" size={20} color="#8b5cf6" />
            </TouchableOpacity>
          )}
          {(step === 1 || step === 3) && <View style={{ width: 40 }} />}
        </View>

        {/* Progress Steps */}
        <View style={styles.progressSteps}>
          {[1, 2, 3].map((s) => (
            <View key={s} style={styles.progressStepContainer}>
              <View style={[styles.progressStep, step >= s && styles.progressStepActive]}>
                <Text style={[styles.progressStepText, step >= s && styles.progressStepTextActive]}>
                  {s}
                </Text>
              </View>
              {s < 3 && <View style={[styles.progressLine, step > s && styles.progressLineActive]} />}
            </View>
          ))}
        </View>

        {/* Auto-save indicator */}
        <View style={styles.autoSaveIndicator}>
          <View style={styles.autoSaveDot} />
          <Text style={styles.autoSaveText}>Auto-saving</Text>
        </View>

        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={100}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 1 && renderSetupStep()}
            {step === 2 && renderStoryboardEditor()}
            {step === 3 && renderExportStep()}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* Scene Edit Modal */}
      <Modal visible={showSceneModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingScene?.id ? 'Edit Scene' : 'New Scene'} #{editingScene?.blockNumber}
              </Text>
              <TouchableOpacity onPress={() => setShowSceneModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.modalLabel}>Lyric Segment</Text>
              <TextInput
                style={styles.modalInput}
                value={editingScene?.lyricSegment}
                onChangeText={(text) => setEditingScene(prev => prev ? {...prev, lyricSegment: text} : null)}
                placeholder="The lyrics for this scene..."
                placeholderTextColor="#6b7280"
                multiline
              />

              <Text style={styles.modalLabel}>Scene Description</Text>
              <TextInput
                style={styles.modalInputLarge}
                value={editingScene?.sceneDescription}
                onChangeText={(text) => setEditingScene(prev => prev ? {...prev, sceneDescription: text} : null)}
                placeholder="Detailed visual description..."
                placeholderTextColor="#6b7280"
                multiline
              />

              <Text style={styles.modalLabel}>Camera Movement</Text>
              <TextInput
                style={styles.modalInput}
                value={editingScene?.cameraMovement}
                onChangeText={(text) => setEditingScene(prev => prev ? {...prev, cameraMovement: text} : null)}
                placeholder="e.g., Slow dolly in, aerial tracking..."
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.modalLabel}>Lighting</Text>
              <TextInput
                style={styles.modalInput}
                value={editingScene?.lighting}
                onChangeText={(text) => setEditingScene(prev => prev ? {...prev, lighting: text} : null)}
                placeholder="e.g., Neon glow, dramatic shadows..."
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.modalLabel}>Mood/Atmosphere</Text>
              <TextInput
                style={styles.modalInput}
                value={editingScene?.mood}
                onChangeText={(text) => setEditingScene(prev => prev ? {...prev, mood: text} : null)}
                placeholder="e.g., Tense, ethereal, triumphant..."
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.modalLabel}>Character Actions</Text>
              <TextInput
                style={styles.modalInput}
                value={editingScene?.characterActions}
                onChangeText={(text) => setEditingScene(prev => prev ? {...prev, characterActions: text} : null)}
                placeholder="What characters do in this scene..."
                placeholderTextColor="#6b7280"
                multiline
              />

              <Text style={styles.modalLabel}>Visual Style</Text>
              <TextInput
                style={styles.modalInput}
                value={editingScene?.visualStyle}
                onChangeText={(text) => setEditingScene(prev => prev ? {...prev, visualStyle: text} : null)}
                placeholder="e.g., Cinematic, CGI, photorealistic..."
                placeholderTextColor="#6b7280"
              />
            </ScrollView>

            <TouchableOpacity style={styles.modalSaveButton} onPress={handleSaveScene}>
              <LinearGradient colors={['#8b5cf6', '#6366f1']} style={styles.modalSaveGradient}>
                <Text style={styles.modalSaveText}>Save Scene</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  container: { flex: 1 },
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  progressSteps: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  progressStepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressStep: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2d2d44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressStepActive: {
    backgroundColor: '#8b5cf6',
  },
  progressStepText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  progressStepTextActive: {
    color: '#fff',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: '#2d2d44',
    marginHorizontal: 4,
  },
  progressLineActive: {
    backgroundColor: '#8b5cf6',
  },
  autoSaveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 6,
  },
  autoSaveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  autoSaveText: { fontSize: 10, color: '#10b981' },
  content: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(45, 45, 68, 0.4)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  modeButtonActive: { backgroundColor: '#8b5cf6' },
  modeButtonText: { fontSize: 13, fontWeight: '600', color: '#8b5cf6' },
  modeButtonTextActive: { color: '#fff' },
  modeDescription: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    backgroundColor: 'rgba(45, 45, 68, 0.5)',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    marginBottom: 16,
  },
  lyricsInput: {
    backgroundColor: 'rgba(45, 45, 68, 0.5)',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    marginBottom: 16,
    minHeight: 150,
    maxHeight: 200,
  },
  themeInput: {
    backgroundColor: 'rgba(45, 45, 68, 0.5)',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    marginBottom: 16,
    minHeight: 70,
  },
  durationSelector: { marginBottom: 20 },
  durationButtons: { flexDirection: 'row', gap: 10, marginTop: 8 },
  durationButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(45, 45, 68, 0.5)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  durationButtonActive: { backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' },
  durationButtonText: { fontSize: 14, fontWeight: '600', color: '#8b5cf6' },
  durationButtonTextActive: { color: '#fff' },
  actionButtons: { marginTop: 10 },
  generateButton: { borderRadius: 12, overflow: 'hidden' },
  buttonDisabled: { opacity: 0.6 },
  generateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  generateButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  editorContainer: { flex: 1 },
  editorHeader: { marginBottom: 16 },
  editorTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  editorSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  scenesList: { flex: 1 },
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
  sceneLyric: {
    fontSize: 12,
    color: '#c4b5fd',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  sceneDesc: { fontSize: 13, color: '#e5e7eb', lineHeight: 18, marginBottom: 8 },
  sceneTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sceneTag: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sceneTagText: { fontSize: 10, color: '#a78bfa' },
  addSceneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(139, 92, 246, 0.4)',
    marginTop: 8,
    gap: 8,
  },
  addSceneText: { fontSize: 14, fontWeight: '600', color: '#8b5cf6' },
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.2)',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    gap: 6,
  },
  saveButtonText: { fontSize: 14, fontWeight: '600', color: '#8b5cf6' },
  exportButton: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  exportButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  exportButtonText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  
  // Export Step Styles
  exportContainer: { flex: 1, alignItems: 'center' },
  exportHeader: { alignItems: 'center', marginBottom: 24 },
  exportTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginTop: 12 },
  exportSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  
  backupOptionsContainer: {
    width: '100%',
    backgroundColor: 'rgba(45, 45, 68, 0.4)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  backupOptionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  radioButtonSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  radioButtonDisabled: {
    opacity: 0.5,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#6b7280',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioOuterSelected: {
    borderColor: '#10b981',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
  },
  radioContent: { flex: 1 },
  radioHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radioLabel: { fontSize: 15, fontWeight: '600', color: '#fff' },
  radioLabelSelected: { color: '#10b981' },
  radioSublabel: { fontSize: 11, color: '#6b7280', marginTop: 2, marginLeft: 26 },
  
  driveNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  driveNoticeText: { flex: 1, fontSize: 11, color: '#f59e0b' },
  
  alwaysLocal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.2)',
  },
  alwaysLocalText: { fontSize: 12, color: '#10b981' },
  
  exportSummary: {
    width: '100%',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  summaryTitle: { fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 8 },
  summaryItem: { fontSize: 12, color: '#a78bfa', marginBottom: 4 },
  
  exportResult: {
    width: '100%',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  resultTitle: { fontSize: 13, fontWeight: '600', color: '#10b981', marginBottom: 8 },
  resultItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  resultText: { fontSize: 12, color: '#34d399' },
  resultTextWarning: { fontSize: 12, color: '#fbbf24' },
  
  mainExportButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 16,
  },
  mainExportGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  mainExportText: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  
  backToEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backToEditorText: { fontSize: 14, color: '#8b5cf6' },
  
  // Modal Styles
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
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  modalScroll: { maxHeight: 400 },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 4,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: 'rgba(45, 45, 68, 0.5)',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  modalInputLarge: {
    backgroundColor: 'rgba(45, 45, 68, 0.5)',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalSaveButton: { borderRadius: 10, overflow: 'hidden', marginTop: 16 },
  modalSaveGradient: { paddingVertical: 12, alignItems: 'center' },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

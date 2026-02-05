import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { useProjectStore } from '../store/projectStore';

export default function CreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    createProject,
    uploadAudio,
    saveLyrics,
    saveTheme,
    generateStoryboard,
    currentProject,
    loading,
    error,
  } = useProjectStore();

  const [projectName, setProjectName] = useState('');
  const [audioFile, setAudioFile] = useState<any>(null);
  const [lyrics, setLyrics] = useState('');
  const [theme, setTheme] = useState('');
  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

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
  }, [step]);

  const handlePickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-m4a', 'audio/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        setAudioFile(file);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick audio file');
    }
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      Alert.alert('Error', 'Please enter a project name');
      return;
    }

    setIsCreating(true);
    try {
      const project = await createProject(projectName.trim());
      setStep(2);
    } catch (error) {
      Alert.alert('Error', 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUploadAudio = async () => {
    if (!currentProject || !audioFile) {
      Alert.alert('Error', 'Please select an audio file');
      return;
    }

    setIsCreating(true);
    try {
      await uploadAudio(currentProject.id, audioFile);
      setStep(3);
    } catch (error) {
      Alert.alert('Error', 'Failed to upload audio');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveLyrics = async () => {
    if (!currentProject || !lyrics.trim()) {
      Alert.alert('Error', 'Please enter lyrics');
      return;
    }

    setIsCreating(true);
    try {
      await saveLyrics(currentProject.id, lyrics.trim());
      setStep(4);
    } catch (error) {
      Alert.alert('Error', 'Failed to save lyrics');
    } finally {
      setIsCreating(false);
    }
  };

  const handleGenerateStoryboard = async () => {
    if (!currentProject) return;

    // Save theme if provided
    if (theme.trim()) {
      await saveTheme(currentProject.id, theme.trim());
    }

    setIsGenerating(true);
    try {
      await generateStoryboard(currentProject.id);
      router.replace(`/project/${currentProject.id}`);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to generate storyboard');
    } finally {
      setIsGenerating(false);
    }
  };

  const renderStep1 = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.stepHeader}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>1</Text>
        </View>
        <Text style={styles.stepTitle}>Name Your Project</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Enter project name..."
        placeholderTextColor="#6b7280"
        value={projectName}
        onChangeText={setProjectName}
        autoFocus
      />

      <TouchableOpacity
        style={[styles.nextButton, !projectName.trim() && styles.buttonDisabled]}
        onPress={handleCreateProject}
        disabled={!projectName.trim() || isCreating}
      >
        <LinearGradient
          colors={projectName.trim() ? ['#8b5cf6', '#6366f1'] : ['#3f3f5a', '#3f3f5a']}
          style={styles.nextButtonGradient}
        >
          {isCreating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.nextButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderStep2 = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.stepHeader}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>2</Text>
        </View>
        <Text style={styles.stepTitle}>Upload Audio</Text>
      </View>

      <Text style={styles.stepDescription}>
        Upload your MP3 file (max 4 minutes)
      </Text>

      <TouchableOpacity style={styles.uploadButton} onPress={handlePickAudio}>
        <LinearGradient
          colors={['rgba(139, 92, 246, 0.2)', 'rgba(99, 102, 241, 0.1)']}
          style={styles.uploadButtonGradient}
        >
          {audioFile ? (
            <>
              <Ionicons name="checkmark-circle" size={48} color="#10b981" />
              <Text style={styles.uploadedFileName} numberOfLines={1}>
                {audioFile.name}
              </Text>
              <Text style={styles.uploadedFileSize}>
                {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={48} color="#8b5cf6" />
              <Text style={styles.uploadText}>Tap to select audio file</Text>
              <Text style={styles.uploadSubtext}>MP3, WAV, M4A supported</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.nextButton, !audioFile && styles.buttonDisabled]}
        onPress={handleUploadAudio}
        disabled={!audioFile || isCreating}
      >
        <LinearGradient
          colors={audioFile ? ['#8b5cf6', '#6366f1'] : ['#3f3f5a', '#3f3f5a']}
          style={styles.nextButtonGradient}
        >
          {isCreating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.nextButtonText}>Upload & Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderStep3 = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.stepHeader}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>3</Text>
        </View>
        <Text style={styles.stepTitle}>Enter Lyrics</Text>
      </View>

      <Text style={styles.stepDescription}>
        Paste or type your song lyrics
      </Text>

      <TextInput
        style={styles.lyricsInput}
        placeholder="Paste your lyrics here...\n\nVerse 1:\n...\n\nChorus:\n..."
        placeholderTextColor="#4b5563"
        value={lyrics}
        onChangeText={setLyrics}
        multiline
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[styles.nextButton, !lyrics.trim() && styles.buttonDisabled]}
        onPress={handleSaveLyrics}
        disabled={!lyrics.trim() || isCreating}
      >
        <LinearGradient
          colors={lyrics.trim() ? ['#8b5cf6', '#6366f1'] : ['#3f3f5a', '#3f3f5a']}
          style={styles.nextButtonGradient}
        >
          {isCreating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.nextButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderStep4 = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.stepHeader}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>4</Text>
        </View>
        <Text style={styles.stepTitle}>Theme & Style (Optional)</Text>
      </View>

      <Text style={styles.stepDescription}>
        Describe the mood, genre, or visual style you want
      </Text>

      <TextInput
        style={styles.themeInput}
        placeholder="e.g., Gritty Southern trap, alien invasion metaphor, gothic ethereal female backing vocals, dystopian cityscape..."
        placeholderTextColor="#4b5563"
        value={theme}
        onChangeText={setTheme}
        multiline
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={styles.generateButton}
        onPress={handleGenerateStoryboard}
        disabled={isGenerating}
      >
        <LinearGradient
          colors={['#8b5cf6', '#6366f1', '#4f46e5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.generateButtonGradient}
        >
          {isGenerating ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.generateButtonText}>Generating Storyboard...</Text>
            </>
          ) : (
            <>
              <Ionicons name="sparkles" size={24} color="#fff" />
              <Text style={styles.generateButtonText}>Generate AI Storyboard</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {isGenerating && (
        <View style={styles.generatingInfo}>
          <Text style={styles.generatingText}>
            AI is analyzing your lyrics and creating a cinematic storyboard...
          </Text>
        </View>
      )}
    </Animated.View>
  );

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
        <Text style={styles.headerTitle}>Create New Video</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        {[1, 2, 3, 4].map((s) => (
          <View key={s} style={styles.progressStep}>
            <View
              style={[
                styles.progressDot,
                s <= step && styles.progressDotActive,
                s < step && styles.progressDotComplete,
              ]}
            >
              {s < step ? (
                <Ionicons name="checkmark" size={14} color="#fff" />
              ) : (
                <Text style={styles.progressDotText}>{s}</Text>
              )}
            </View>
            {s < 4 && (
              <View
                style={[
                  styles.progressLine,
                  s < step && styles.progressLineActive,
                ]}
              />
            )}
          </View>
        ))}
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
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </ScrollView>
      </KeyboardAvoidingView>
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
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 20,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2d2d44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: {
    backgroundColor: '#8b5cf6',
  },
  progressDotComplete: {
    backgroundColor: '#10b981',
  },
  progressDotText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: '#2d2d44',
  },
  progressLineActive: {
    backgroundColor: '#10b981',
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  stepContainer: {
    flex: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8b5cf6',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  stepDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  input: {
    backgroundColor: 'rgba(45, 45, 68, 0.5)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    marginBottom: 24,
  },
  uploadButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderStyle: 'dashed',
  },
  uploadButtonGradient: {
    padding: 40,
    alignItems: 'center',
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8b5cf6',
    marginTop: 12,
  },
  uploadSubtext: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  uploadedFileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    marginTop: 12,
    maxWidth: '80%',
  },
  uploadedFileSize: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  lyricsInput: {
    backgroundColor: 'rgba(45, 45, 68, 0.5)',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    marginBottom: 24,
    minHeight: 200,
    maxHeight: 300,
  },
  themeInput: {
    backgroundColor: 'rgba(45, 45, 68, 0.5)',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    marginBottom: 24,
    minHeight: 120,
  },
  nextButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  generateButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  generateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  generatingInfo: {
    marginTop: 24,
    padding: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  generatingText: {
    fontSize: 14,
    color: '#8b5cf6',
    textAlign: 'center',
  },
});

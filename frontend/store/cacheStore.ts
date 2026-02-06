import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'lyricsinmotion_session_cache';
const CACHE_INTERVAL = 1000; // 1 second

export interface CachedSession {
  projectId?: string;
  projectName: string;
  lyrics: string;
  theme: string;
  audioFile?: any;
  storyboardScenes: StoryboardScene[];
  currentStep: number;
  lastSaved: number;
  mode: 'manual' | 'auto-breakdown'; // manual storyboard or auto lyrics breakdown
  breakdownDuration: number; // seconds per block (default 8)
}

export interface StoryboardScene {
  id: string;
  blockNumber: number;
  startTime: number;
  endTime: number;
  lyricSegment: string;
  sceneDescription: string;
  cameraMovement: string;
  lighting: string;
  mood: string;
  characterActions: string;
  visualStyle: string;
  grokPrompt: string; // Optimized prompt for GROK 4.1
}

interface CacheState {
  currentSession: CachedSession | null;
  hasUnsavedSession: boolean;
  lastRestoredAt: number | null;
  autoSaveEnabled: boolean;
  autoSaveIntervalId: NodeJS.Timeout | null;
  
  // Actions
  initializeCache: () => Promise<void>;
  updateSession: (data: Partial<CachedSession>) => void;
  saveToCache: () => Promise<void>;
  restoreFromCache: () => Promise<CachedSession | null>;
  clearCache: () => Promise<void>;
  startAutoSave: () => void;
  stopAutoSave: () => void;
  checkForUnsavedSession: () => Promise<boolean>;
  createNewSession: (mode?: 'manual' | 'auto-breakdown') => void;
  addScene: (scene: Partial<StoryboardScene>) => void;
  updateScene: (sceneId: string, data: Partial<StoryboardScene>) => void;
  removeScene: (sceneId: string) => void;
  generateGrokPrompt: (scene: StoryboardScene) => string;
  exportStoryboardAsText: (projectName: string) => string;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const generateGrokPromptFromScene = (scene: StoryboardScene): string => {
  // Generate optimized prompt for GROK 4.1 text-to-video
  const parts = [
    `[SCENE ${scene.blockNumber}] [${scene.startTime}s-${scene.endTime}s]`,
    ``,
    `VISUAL: ${scene.sceneDescription}`,
    ``,
    `CAMERA: ${scene.cameraMovement}`,
    `LIGHTING: ${scene.lighting}`,
    `MOOD/ATMOSPHERE: ${scene.mood}`,
    `ACTION: ${scene.characterActions}`,
    `STYLE: ${scene.visualStyle}`,
    ``,
    `LYRIC CONTEXT: "${scene.lyricSegment}"`,
    ``,
    `Generate a cinematic 10-second video clip. No text overlays. Photorealistic or high-quality CGI. Smooth motion. Match the emotional tone of the lyrics through visual storytelling.`
  ];
  
  return parts.join('\n');
};

export const useCacheStore = create<CacheState>((set, get) => ({
  currentSession: null,
  hasUnsavedSession: false,
  lastRestoredAt: null,
  autoSaveEnabled: true,
  autoSaveIntervalId: null,

  initializeCache: async () => {
    const hasUnsaved = await get().checkForUnsavedSession();
    set({ hasUnsavedSession: hasUnsaved });
  },

  updateSession: (data: Partial<CachedSession>) => {
    set((state) => ({
      currentSession: state.currentSession
        ? { ...state.currentSession, ...data, lastSaved: Date.now() }
        : {
            projectName: '',
            lyrics: '',
            theme: '',
            storyboardScenes: [],
            currentStep: 1,
            lastSaved: Date.now(),
            mode: 'manual',
            breakdownDuration: 8,
            ...data,
          },
    }));
  },

  saveToCache: async () => {
    const { currentSession } = get();
    if (currentSession) {
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
          ...currentSession,
          lastSaved: Date.now(),
        }));
      } catch (error) {
        console.error('Failed to save cache:', error);
      }
    }
  },

  restoreFromCache: async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const session = JSON.parse(cached) as CachedSession;
        set({
          currentSession: session,
          hasUnsavedSession: false,
          lastRestoredAt: Date.now(),
        });
        return session;
      }
    } catch (error) {
      console.error('Failed to restore cache:', error);
    }
    return null;
  },

  clearCache: async () => {
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
      set({
        currentSession: null,
        hasUnsavedSession: false,
      });
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  },

  startAutoSave: () => {
    const { autoSaveIntervalId } = get();
    if (autoSaveIntervalId) return;

    const intervalId = setInterval(() => {
      get().saveToCache();
    }, CACHE_INTERVAL);

    set({ autoSaveIntervalId: intervalId });
  },

  stopAutoSave: () => {
    const { autoSaveIntervalId } = get();
    if (autoSaveIntervalId) {
      clearInterval(autoSaveIntervalId);
      set({ autoSaveIntervalId: null });
    }
  },

  checkForUnsavedSession: async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const session = JSON.parse(cached) as CachedSession;
        // Check if session has meaningful content
        const hasContent = session.projectName || session.lyrics || session.storyboardScenes.length > 0;
        return hasContent;
      }
    } catch (error) {
      console.error('Failed to check cache:', error);
    }
    return false;
  },

  createNewSession: (mode = 'manual') => {
    set({
      currentSession: {
        projectName: '',
        lyrics: '',
        theme: '',
        storyboardScenes: [],
        currentStep: 1,
        lastSaved: Date.now(),
        mode,
        breakdownDuration: 8,
      },
      hasUnsavedSession: false,
    });
  },

  addScene: (sceneData: Partial<StoryboardScene>) => {
    const { currentSession } = get();
    if (!currentSession) return;

    const scenes = currentSession.storyboardScenes;
    const blockNumber = scenes.length + 1;
    const lastScene = scenes[scenes.length - 1];
    const startTime = lastScene ? lastScene.endTime : 0;
    const duration = currentSession.breakdownDuration || 8;

    const newScene: StoryboardScene = {
      id: generateId(),
      blockNumber,
      startTime,
      endTime: startTime + duration,
      lyricSegment: '',
      sceneDescription: '',
      cameraMovement: '',
      lighting: '',
      mood: '',
      characterActions: '',
      visualStyle: '',
      grokPrompt: '',
      ...sceneData,
    };

    // Generate GROK prompt
    newScene.grokPrompt = generateGrokPromptFromScene(newScene);

    set({
      currentSession: {
        ...currentSession,
        storyboardScenes: [...scenes, newScene],
      },
    });
  },

  updateScene: (sceneId: string, data: Partial<StoryboardScene>) => {
    const { currentSession } = get();
    if (!currentSession) return;

    const scenes = currentSession.storyboardScenes.map((scene) => {
      if (scene.id === sceneId) {
        const updated = { ...scene, ...data };
        updated.grokPrompt = generateGrokPromptFromScene(updated);
        return updated;
      }
      return scene;
    });

    set({
      currentSession: {
        ...currentSession,
        storyboardScenes: scenes,
      },
    });
  },

  removeScene: (sceneId: string) => {
    const { currentSession } = get();
    if (!currentSession) return;

    const scenes = currentSession.storyboardScenes
      .filter((s) => s.id !== sceneId)
      .map((scene, index) => ({
        ...scene,
        blockNumber: index + 1,
      }));

    set({
      currentSession: {
        ...currentSession,
        storyboardScenes: scenes,
      },
    });
  },

  generateGrokPrompt: (scene: StoryboardScene) => {
    return generateGrokPromptFromScene(scene);
  },

  exportStoryboardAsText: (projectName: string) => {
    const { currentSession } = get();
    if (!currentSession) return '';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${projectName.replace(/\s+/g, '_')}_storyboard_${timestamp}`;
    
    const header = [
      '=' .repeat(60),
      `LYRICSINMOTION STORYBOARD EXPORT`,
      `Project: ${projectName}`,
      `Exported: ${new Date().toLocaleString()}`,
      `Mode: ${currentSession.mode === 'auto-breakdown' ? 'Auto Lyrics Breakdown' : 'Manual Storyboard'}`,
      `Block Duration: ${currentSession.breakdownDuration} seconds`,
      `Total Scenes: ${currentSession.storyboardScenes.length}`,
      '='.repeat(60),
      '',
      'USAGE: Each scene block below is an optimized prompt for GROK 4.1',
      'text-to-video generation. Generate 10-second clips per block.',
      '',
      '='.repeat(60),
    ].join('\n');

    const scenes = currentSession.storyboardScenes.map((scene) => {
      return [
        '',
        '-'.repeat(60),
        scene.grokPrompt,
        '-'.repeat(60),
      ].join('\n');
    }).join('\n');

    const footer = [
      '',
      '='.repeat(60),
      'END OF STORYBOARD',
      `Total Runtime: ${currentSession.storyboardScenes.length * currentSession.breakdownDuration} seconds`,
      '='.repeat(60),
    ].join('\n');

    return header + scenes + footer;
  },
}));

import { create } from 'zustand';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export interface StoryboardScene {
  id: string;
  start_time: number;
  end_time: number;
  description: string;
  camera_movement: string;
  lighting: string;
  mood: string;
  character_actions: string;
  lyric_segment: string;
}

export interface AudioAnalysis {
  duration: number;
  tempo: number;
  beats: number[];
  sections: Array<{ name: string; start: number; end: number }>;
  energy_profile: number[];
}

export interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  status: 'draft' | 'processing' | 'storyboard_ready' | 'video_ready';
  audio_filename?: string;
  audio_duration?: number;
  lyrics?: string;
  theme_description?: string;
  audio_analysis?: AudioAnalysis;
  storyboard?: StoryboardScene[];
  video_url?: string;
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchProjects: () => Promise<void>;
  fetchProject: (id: string) => Promise<void>;
  createProject: (name: string) => Promise<Project>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  uploadAudio: (projectId: string, file: any) => Promise<any>;
  saveLyrics: (projectId: string, lyrics: string) => Promise<void>;
  saveTheme: (projectId: string, theme: string) => Promise<void>;
  generateStoryboard: (projectId: string) => Promise<void>;
  updateScene: (projectId: string, sceneId: string, data: Partial<StoryboardScene>) => Promise<void>;
  generateVideo: (projectId: string) => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const response = await axios.get(`${API_URL}/api/projects`);
      set({ projects: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchProject: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.get(`${API_URL}/api/projects/${id}`);
      set({ currentProject: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  createProject: async (name: string) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post(`${API_URL}/api/projects`, { name });
      const newProject = response.data;
      set((state) => ({
        projects: [newProject, ...state.projects],
        currentProject: newProject,
        loading: false,
      }));
      return newProject;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateProject: async (id: string, data: Partial<Project>) => {
    try {
      const response = await axios.put(`${API_URL}/api/projects/${id}`, data);
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? response.data : p)),
        currentProject: state.currentProject?.id === id ? response.data : state.currentProject,
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  deleteProject: async (id: string) => {
    try {
      await axios.delete(`${API_URL}/api/projects/${id}`);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject,
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  uploadAudio: async (projectId: string, file: any) => {
    set({ loading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('audio', {
        uri: file.uri,
        name: file.name || 'audio.mp3',
        type: file.mimeType || 'audio/mpeg',
      } as any);

      const response = await axios.post(
        `${API_URL}/api/projects/${projectId}/audio`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // Refresh project
      await get().fetchProject(projectId);
      set({ loading: false });
      return response.data;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  saveLyrics: async (projectId: string, lyrics: string) => {
    try {
      await axios.post(`${API_URL}/api/projects/${projectId}/lyrics`, {
        project_id: projectId,
        lyrics,
      });
      await get().fetchProject(projectId);
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  saveTheme: async (projectId: string, theme: string) => {
    try {
      await axios.post(`${API_URL}/api/projects/${projectId}/theme`, {
        project_id: projectId,
        theme_description: theme,
      });
      await get().fetchProject(projectId);
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  generateStoryboard: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      await axios.post(`${API_URL}/api/projects/${projectId}/generate-storyboard`);
      await get().fetchProject(projectId);
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateScene: async (projectId: string, sceneId: string, data: Partial<StoryboardScene>) => {
    try {
      await axios.put(`${API_URL}/api/projects/${projectId}/scenes/${sceneId}`, {
        project_id: projectId,
        scene_id: sceneId,
        ...data,
      });
      await get().fetchProject(projectId);
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  generateVideo: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      await axios.post(`${API_URL}/api/projects/${projectId}/generate-video`);
      await get().fetchProject(projectId);
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  setCurrentProject: (project: Project | null) => {
    set({ currentProject: project });
  },

  clearError: () => {
    set({ error: null });
  },
}));

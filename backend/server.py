from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import base64
import json
import tempfile
import asyncio
import io
import numpy as np

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Google Drive Configuration
GOOGLE_SERVICE_ACCOUNT_FILE = ROOT_DIR / 'google-service-account.json'
GDRIVE_EXPORTS_FOLDER_ID = "1S-rhyyGgl6O-5g1d4sZzKiDBO9xoQsZJ"  # EXPORTS folder
GDRIVE_MULTI_FOLDER_ID = "1mr9CrmjTijaLEKtNf2WtuVNSSnetQ3am"    # MULTI folder

def get_google_drive_service():
    """Initialize Google Drive service using service account credentials"""
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        
        if not GOOGLE_SERVICE_ACCOUNT_FILE.exists():
            return None
        
        credentials = service_account.Credentials.from_service_account_file(
            str(GOOGLE_SERVICE_ACCOUNT_FILE),
            scopes=['https://www.googleapis.com/auth/drive.file']
        )
        service = build('drive', 'v3', credentials=credentials)
        return service
    except Exception as e:
        logging.error(f"Failed to initialize Google Drive: {e}")
        return None

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="LyricSiNMotion API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ===================== AUDIO ANALYSIS FUNCTIONS =====================

def analyze_audio_file(file_path: str) -> Dict[str, Any]:
    """
    Analyze audio file using librosa to extract:
    - Duration, tempo, beats
    - Energy profile per segment
    - Rhythm patterns
    - Section detection (verse, chorus, etc.)
    """
    try:
        import librosa
        
        # Load audio file
        y, sr = librosa.load(file_path, sr=22050)
        duration = librosa.get_duration(y=y, sr=sr)
        
        # Tempo and beat detection
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
        
        # Handle tempo - convert to float properly
        if hasattr(tempo, '__len__'):
            tempo = float(tempo[0]) if len(tempo) > 0 else 120.0
        else:
            tempo = float(tempo)
        
        # Energy analysis (RMS)
        rms = librosa.feature.rms(y=y)[0]
        
        # Segment audio into 8-second blocks
        segment_duration = 8.0
        num_segments = int(np.ceil(duration / segment_duration))
        
        segments = []
        samples_per_segment = int(segment_duration * sr)
        rms_per_frame = len(y) / len(rms)
        
        for i in range(num_segments):
            start_time = i * segment_duration
            end_time = min((i + 1) * segment_duration, duration)
            
            # Get samples for this segment
            start_sample = int(start_time * sr)
            end_sample = int(end_time * sr)
            segment_audio = y[start_sample:end_sample]
            
            # Calculate energy for this segment
            start_frame = int(start_sample / rms_per_frame)
            end_frame = int(end_sample / rms_per_frame)
            segment_rms = rms[start_frame:end_frame]
            avg_energy = float(np.mean(segment_rms)) if len(segment_rms) > 0 else 0.5
            
            # Normalize energy to 0-1 scale
            max_rms = float(np.max(rms)) if np.max(rms) > 0 else 1.0
            normalized_energy = avg_energy / max_rms
            
            # Count beats in this segment
            segment_beats = [b for b in beat_times if start_time <= b < end_time]
            beat_density = len(segment_beats) / segment_duration
            
            # Determine intensity level
            if normalized_energy > 0.7:
                intensity = "high"
            elif normalized_energy > 0.4:
                intensity = "medium"
            else:
                intensity = "low"
            
            # Estimate section type based on position and energy
            position_ratio = i / num_segments
            if position_ratio < 0.1:
                section_type = "intro"
            elif position_ratio > 0.9:
                section_type = "outro"
            elif normalized_energy > 0.6 and beat_density > 1.5:
                section_type = "chorus"
            elif normalized_energy < 0.3:
                section_type = "bridge"
            else:
                section_type = "verse"
            
            segments.append({
                "segment_number": i + 1,
                "start_time": round(start_time, 2),
                "end_time": round(end_time, 2),
                "energy": round(normalized_energy, 3),
                "intensity": intensity,
                "beat_density": round(beat_density, 2),
                "beats_in_segment": len(segment_beats),
                "section_type": section_type
            })
        
        return {
            "duration": round(duration, 2),
            "tempo": round(tempo, 1),
            "total_beats": len(beat_times),
            "beat_times": beat_times[:50],  # First 50 beats for reference
            "num_segments": num_segments,
            "segments": segments,
            "avg_energy": round(float(np.mean(rms)) / max_rms, 3),
            "energy_variance": round(float(np.std(rms)), 4)
        }
        
    except Exception as e:
        logger.error(f"Audio analysis error: {e}")
        # Return fallback analysis
        estimated_duration = 180  # 3 minutes default
        return {
            "duration": estimated_duration,
            "tempo": 120.0,
            "total_beats": int(estimated_duration * 2),
            "beat_times": [],
            "num_segments": int(estimated_duration / 8),
            "segments": [],
            "avg_energy": 0.5,
            "energy_variance": 0.1,
            "error": str(e)
        }


# ===================== MODELS =====================

class StoryboardScene(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    start_time: float  # seconds
    end_time: float  # seconds
    description: str
    camera_movement: str
    lighting: str
    mood: str
    character_actions: str
    lyric_segment: str

class AudioAnalysis(BaseModel):
    duration: float
    tempo: float
    beats: List[float]
    sections: List[dict]  # intro, verse, chorus, etc.
    energy_profile: List[float]

class Project(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "draft"  # draft, processing, storyboard_ready, video_ready
    audio_filename: Optional[str] = None
    audio_duration: Optional[float] = None
    lyrics: Optional[str] = None
    theme_description: Optional[str] = None
    audio_analysis: Optional[AudioAnalysis] = None
    storyboard: Optional[List[StoryboardScene]] = None
    video_url: Optional[str] = None  # Mock video URL

class ProjectCreate(BaseModel):
    name: str

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    lyrics: Optional[str] = None
    theme_description: Optional[str] = None

class LyricsInput(BaseModel):
    project_id: str
    lyrics: str

class ThemeInput(BaseModel):
    project_id: str
    theme_description: str

class GenerateStoryboardRequest(BaseModel):
    project_id: str

class SceneUpdateRequest(BaseModel):
    project_id: str
    scene_id: str
    description: Optional[str] = None
    camera_movement: Optional[str] = None
    lighting: Optional[str] = None
    mood: Optional[str] = None
    character_actions: Optional[str] = None

# ===================== ROUTES =====================

@api_router.get("/")
async def root():
    return {"message": "LyricMotion API v1.0 - AI-Powered Music Video Creator"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}

# Project CRUD
@api_router.post("/projects", response_model=Project)
async def create_project(project_input: ProjectCreate):
    project = Project(name=project_input.name)
    await db.projects.insert_one(project.dict())
    return project

@api_router.get("/projects", response_model=List[Project])
async def get_projects():
    projects = await db.projects.find().sort("created_at", -1).to_list(100)
    return [Project(**p) for p in projects]

@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return Project(**project)

@api_router.put("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, update: ProjectUpdate):
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.projects.update_one({"id": project_id}, {"$set": update_data})
    updated = await db.projects.find_one({"id": project_id})
    return Project(**updated)

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    result = await db.projects.delete_one({"id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted successfully"}

# Audio Upload with REAL analysis
@api_router.post("/projects/{project_id}/audio")
async def upload_audio(project_id: str, audio: UploadFile = File(...)):
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate file type
    if not audio.filename.lower().endswith(('.mp3', '.wav', '.m4a', '.ogg', '.flac')):
        raise HTTPException(status_code=400, detail="Supported formats: MP3, WAV, M4A, OGG, FLAC")
    
    # Save audio temporarily for analysis
    content = await audio.read()
    
    with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tmp_file:
        tmp_file.write(content)
        tmp_path = tmp_file.name
    
    try:
        # REAL audio analysis using librosa
        analysis = analyze_audio_file(tmp_path)
        
        # Store audio data in database for later use
        audio_data = base64.b64encode(content).decode('utf-8')
        
        # Update project with analysis
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {
                "audio_filename": audio.filename,
                "audio_duration": analysis["duration"],
                "audio_analysis": analysis,
                "audio_data": audio_data,  # Store audio for playback reference
                "updated_at": datetime.utcnow()
            }}
        )
        
        return {
            "message": "Audio analyzed successfully",
            "filename": audio.filename,
            "duration": analysis["duration"],
            "tempo": analysis["tempo"],
            "total_segments": analysis["num_segments"],
            "analysis": analysis
        }
    finally:
        # Clean up temp file
        os.unlink(tmp_path)


# ==================== MAIN AUTO-GENERATION ENDPOINT ====================

class AutoGenerateRequest(BaseModel):
    project_id: str
    lyrics: Optional[str] = None  # Optional - helps AI understand unclear words
    render_style: Optional[str] = None  # Retained style from previous successful renders
    scene_type: Optional[str] = None  # Optional scene type preference

@api_router.post("/projects/{project_id}/auto-generate")
async def auto_generate_scenes(project_id: str, request: AutoGenerateRequest):
    """
    MAIN FUNCTION: Automatically generate ALL scene descriptions from audio + optional lyrics.
    
    1. Uses audio analysis (rhythm, beats, energy) to understand the song
    2. Lyrics help clarify unclear words/slang (optional)
    3. AI generates scene descriptions for every 8-second segment
    4. User can then edit scene descriptions and render style
    """
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    audio_analysis = project.get("audio_analysis")
    if not audio_analysis:
        raise HTTPException(status_code=400, detail="Upload audio first - AI needs to analyze the rhythm")
    
    # Update status
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"status": "processing"}}
    )
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM API key not configured")
        
        # Get segments from audio analysis
        segments = audio_analysis.get("segments", [])
        if not segments:
            # Create default segments based on duration
            duration = audio_analysis.get("duration", 180)
            num_segments = int(duration / 8)
            segments = [
                {
                    "segment_number": i + 1,
                    "start_time": i * 8,
                    "end_time": min((i + 1) * 8, duration),
                    "intensity": "medium",
                    "section_type": "verse",
                    "energy": 0.5
                }
                for i in range(num_segments)
            ]
        
        # Prepare context for AI
        lyrics = request.lyrics or project.get("lyrics", "")
        render_style = request.render_style or "cinematic photorealistic"
        tempo = audio_analysis.get("tempo", 120)
        
        # Initialize Claude
        chat = LlmChat(
            api_key=api_key,
            session_id=f"autogen-{project_id}",
            system_message=f"""You are an expert music video director and scene writer.
Your job is to create vivid, cinematic scene descriptions that match the RHYTHM and ENERGY of music.

CRITICAL RULES:
1. Each scene MUST sync with the audio's rhythm - use the tempo ({tempo} BPM) and energy levels
2. High energy = fast cuts, dynamic movement, intense visuals
3. Low energy = slow motion, contemplative shots, atmospheric scenes
4. If lyrics are provided, they CLARIFY meaning - don't just visualize words literally
5. Create VISUAL METAPHORS that capture the FEELING of the lyrics
6. NO text/subtitles on screen - only pure visual storytelling
7. Each description should be 2-3 detailed sentences

RENDER STYLE TO USE: {render_style}
(Apply this style consistently unless user changes it)

Output ONLY valid JSON array."""
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        
        # Build the prompt with all segment data
        segments_info = json.dumps(segments, indent=2)
        
        prompt = f"""Analyze this song and create scene descriptions for EVERY segment.

AUDIO ANALYSIS:
- Duration: {audio_analysis.get('duration', 180)} seconds
- Tempo: {tempo} BPM
- Total Segments: {len(segments)}
- Average Energy: {audio_analysis.get('avg_energy', 0.5)}

SEGMENT DATA (rhythm/energy per 8-second block):
{segments_info}

{"LYRICS (to help understand the song - some words may be slang or unclear):" if lyrics else "NO LYRICS PROVIDED - create abstract visual story based on rhythm:"}
{lyrics if lyrics else ""}

RENDER STYLE: {render_style}

Generate a scene description for EACH of the {len(segments)} segments.
Match the scene intensity to the segment energy level.
Sync camera movements to the beat (tempo: {tempo} BPM).

Output JSON array:
[
  {{
    "segment_number": 1,
    "start_time": 0,
    "end_time": 8,
    "scene_description": "Detailed cinematic description matching the rhythm and energy...",
    "camera_movement": "Movement synced to {tempo} BPM...",
    "lighting": "Lighting that matches the mood...",
    "mood": "Emotional tone of this segment...",
    "render_style": "{render_style}",
    "grok_prompt": "Complete prompt optimized for GROK 4.1 text-to-video generation..."
  }}
]"""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse response
        response_text = response.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        scenes_data = json.loads(response_text)
        
        # Format scenes for storage
        storyboard = []
        for scene in scenes_data:
            formatted_scene = {
                "id": str(uuid.uuid4()),
                "segment_number": scene.get("segment_number", len(storyboard) + 1),
                "start_time": scene.get("start_time", len(storyboard) * 8),
                "end_time": scene.get("end_time", (len(storyboard) + 1) * 8),
                "description": scene.get("scene_description", ""),
                "camera_movement": scene.get("camera_movement", ""),
                "lighting": scene.get("lighting", ""),
                "mood": scene.get("mood", ""),
                "character_actions": scene.get("character_actions", ""),
                "lyric_segment": scene.get("lyric_segment", ""),
                "render_style": scene.get("render_style", render_style),
                "grok_prompt": scene.get("grok_prompt", ""),
                "energy": segments[scene.get("segment_number", 1) - 1].get("energy", 0.5) if scene.get("segment_number", 1) <= len(segments) else 0.5,
                "section_type": segments[scene.get("segment_number", 1) - 1].get("section_type", "verse") if scene.get("segment_number", 1) <= len(segments) else "verse"
            }
            storyboard.append(formatted_scene)
        
        # Save storyboard and update project
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {
                "storyboard": storyboard,
                "status": "storyboard_ready",
                "lyrics": lyrics if lyrics else project.get("lyrics"),
                "retained_render_style": render_style,
                "updated_at": datetime.utcnow()
            }}
        )
        
        return {
            "message": f"Auto-generated {len(storyboard)} scenes successfully!",
            "total_scenes": len(storyboard),
            "duration": audio_analysis.get("duration"),
            "render_style": render_style,
            "scenes": storyboard
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response: {e}")
        await db.projects.update_one({"id": project_id}, {"$set": {"status": "draft"}})
        raise HTTPException(status_code=500, detail="AI response parsing failed - please try again")
    except Exception as e:
        logger.error(f"Auto-generation error: {e}")
        await db.projects.update_one({"id": project_id}, {"$set": {"status": "draft"}})
        raise HTTPException(status_code=500, detail=str(e))


# Update single scene (user edits)
@api_router.put("/projects/{project_id}/scenes/{scene_id}")
async def update_single_scene(project_id: str, scene_id: str, update: SceneUpdateRequest):
    """User edits a single scene description or render style"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    storyboard = project.get("storyboard", [])
    scene_found = False
    
    for i, scene in enumerate(storyboard):
        if scene.get("id") == scene_id:
            for key, value in update.dict().items():
                if value is not None and key not in ["project_id", "scene_id"]:
                    storyboard[i][key] = value
            scene_found = True
            break
    
    if not scene_found:
        raise HTTPException(status_code=404, detail="Scene not found")
    
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {
            "storyboard": storyboard,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"message": "Scene updated successfully", "scene": storyboard[i]}


# Retain render style (user confirms a style works)
@api_router.post("/projects/{project_id}/retain-style")
async def retain_render_style(project_id: str, style: str = Form(...)):
    """User confirms a render style works - AI will use it for future scenes"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {
            "retained_render_style": style,
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Also save to user preferences for future projects
    await db.user_preferences.update_one(
        {"type": "render_style"},
        {"$set": {"preferred_style": style, "updated_at": datetime.utcnow()}},
        upsert=True
    )
    
    return {"message": f"Render style '{style}' retained for future use"}

# Lyrics
@api_router.post("/projects/{project_id}/lyrics")
async def save_lyrics(project_id: str, lyrics_input: LyricsInput):
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {
            "lyrics": lyrics_input.lyrics,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"message": "Lyrics saved successfully"}

# Theme
@api_router.post("/projects/{project_id}/theme")
async def save_theme(project_id: str, theme_input: ThemeInput):
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {
            "theme_description": theme_input.theme_description,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"message": "Theme saved successfully"}

# Generate Storyboard with AI
@api_router.post("/projects/{project_id}/generate-storyboard")
async def generate_storyboard(project_id: str):
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if not project.get("lyrics"):
        raise HTTPException(status_code=400, detail="Lyrics are required to generate storyboard")
    
    if not project.get("audio_analysis"):
        raise HTTPException(status_code=400, detail="Audio must be uploaded first")
    
    # Update status
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"status": "processing"}}
    )
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM API key not configured")
        
        # Initialize Claude
        chat = LlmChat(
            api_key=api_key,
            session_id=f"storyboard-{project_id}",
            system_message="""You are an expert cinematic storyboard creator for music videos. 
You create detailed, visually stunning scene descriptions that translate lyrics into dynamic, 
narrative-driven video sequences. Focus on:
- Camera movements (dolly, crane, tracking, handheld)
- Lighting (dramatic shadows, neon glows, natural light)
- Character actions that embody lyric meaning
- Mood and atmosphere
- NO text overlays, NO lyric subtitles, NO waveform visualizers
- Only cinematic, story-driven motion like live-action or CGI
Output JSON array of scenes."""
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        
        audio_analysis = project.get("audio_analysis", {})
        lyrics = project.get("lyrics", "")
        theme = project.get("theme_description", "cinematic music video")
        duration = audio_analysis.get("duration", 180)
        sections = audio_analysis.get("sections", [])
        
        prompt = f"""Create a cinematic storyboard for a music video based on these lyrics and theme.

THEME/MOOD: {theme}

LYRICS:
{lyrics}

AUDIO STRUCTURE:
- Total Duration: {duration:.1f} seconds
- Tempo: {audio_analysis.get('tempo', 120)} BPM
- Sections: {json.dumps(sections)}

Create 6-10 scenes that:
1. Match the audio sections (intro, verse, chorus, bridge, outro)
2. Visually interpret the lyrics through character actions and environments
3. Build a coherent narrative arc
4. Use dynamic camera work synced to beats
5. Create strong visual atmosphere matching the mood

Output ONLY a valid JSON array with this exact format:
[
  {{
    "start_time": 0,
    "end_time": 15,
    "description": "Scene description here",
    "camera_movement": "Camera technique",
    "lighting": "Lighting description",
    "mood": "Emotional tone",
    "character_actions": "What characters do",
    "lyric_segment": "Relevant lyrics"
  }}
]"""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse the response
        try:
            # Extract JSON from response
            response_text = response.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]
            
            scenes_data = json.loads(response_text)
            
            storyboard = []
            for scene_data in scenes_data:
                scene = StoryboardScene(
                    start_time=scene_data.get("start_time", 0),
                    end_time=scene_data.get("end_time", 10),
                    description=scene_data.get("description", ""),
                    camera_movement=scene_data.get("camera_movement", ""),
                    lighting=scene_data.get("lighting", ""),
                    mood=scene_data.get("mood", ""),
                    character_actions=scene_data.get("character_actions", ""),
                    lyric_segment=scene_data.get("lyric_segment", "")
                )
                storyboard.append(scene.dict())
            
            # Update project with storyboard
            await db.projects.update_one(
                {"id": project_id},
                {"$set": {
                    "storyboard": storyboard,
                    "status": "storyboard_ready",
                    "updated_at": datetime.utcnow()
                }}
            )
            
            return {"message": "Storyboard generated successfully", "scenes": storyboard}
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response: {e}")
            logger.error(f"Response was: {response}")
            raise HTTPException(status_code=500, detail="Failed to parse AI response")
            
    except Exception as e:
        logger.error(f"Error generating storyboard: {e}")
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {"status": "draft"}}
        )
        raise HTTPException(status_code=500, detail=str(e))

# Update scene
@api_router.put("/projects/{project_id}/scenes/{scene_id}")
async def update_scene(project_id: str, scene_id: str, update: SceneUpdateRequest):
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    storyboard = project.get("storyboard", [])
    scene_found = False
    
    for i, scene in enumerate(storyboard):
        if scene.get("id") == scene_id:
            for key, value in update.dict().items():
                if value is not None and key not in ["project_id", "scene_id"]:
                    storyboard[i][key] = value
            scene_found = True
            break
    
    if not scene_found:
        raise HTTPException(status_code=404, detail="Scene not found")
    
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {
            "storyboard": storyboard,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"message": "Scene updated successfully"}

# ==================== LYRICS BREAKDOWN ENDPOINT ====================

class LyricsBreakdownRequest(BaseModel):
    lyrics: str
    theme: Optional[str] = "cinematic music video"
    block_duration: int = 8  # seconds per block

@api_router.post("/breakdown-lyrics")
async def breakdown_lyrics(request: LyricsBreakdownRequest):
    """
    AI-powered lyrics breakdown into 8-second video blocks.
    Generates GROK 4.1 optimized prompts for each block.
    """
    if not request.lyrics.strip():
        raise HTTPException(status_code=400, detail="Lyrics are required")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM API key not configured")
        
        # Calculate approximate number of blocks based on lyrics length
        # Roughly estimate 3-4 seconds per line of lyrics
        lines = [l.strip() for l in request.lyrics.strip().split('\n') if l.strip()]
        estimated_duration = len(lines) * 3.5  # rough estimate
        num_blocks = max(4, int(estimated_duration / request.block_duration))
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"breakdown-{uuid.uuid4()}",
            system_message=f"""You are an expert at breaking down song lyrics into cinematic video scene blocks.
Each block should be exactly {request.block_duration} seconds of video content.
Your output must be optimized for GROK 4.1 text-to-video generation.

For each block, provide:
1. The exact lyric segment for that timeframe
2. Extremely detailed visual description (what GROK should generate)
3. Precise camera movement
4. Lighting setup
5. Mood/atmosphere
6. Character/subject actions
7. Visual style reference

CRITICAL RULES:
- NO text overlays or lyrics on screen
- NO audio waveforms or visualizers
- ONLY cinematic, story-driven visuals
- Each description should be 2-3 sentences minimum
- Be extremely specific about visual details
- Output ONLY valid JSON array"""
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        
        prompt = f"""Break down these lyrics into {num_blocks} cinematic video blocks of {request.block_duration} seconds each.

THEME/VISUAL STYLE: {request.theme}

LYRICS:
{request.lyrics}

Create exactly {num_blocks} scene blocks. Each block must be optimized for GROK 4.1 text-to-video AI.

Output ONLY a valid JSON array with this exact format:
[
  {{
    "block_number": 1,
    "start_time": 0,
    "end_time": {request.block_duration},
    "lyric_segment": "The exact lyrics for this block",
    "description": "Extremely detailed cinematic scene description. Include environment, subjects, actions, colors, textures. Be specific enough for AI video generation.",
    "camera_movement": "Specific camera technique (slow dolly in, aerial tracking shot, handheld follow, etc.)",
    "lighting": "Detailed lighting setup (neon glow from left, harsh overhead spotlight, golden hour backlight, etc.)",
    "mood": "Emotional atmosphere (tense anticipation, ethereal calm, explosive energy, etc.)",
    "character_actions": "What subjects/characters are doing in the scene",
    "visual_style": "Reference style (photorealistic, cinematic CGI, anime-inspired, etc.)"
  }}
]"""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse the response
        response_text = response.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        scenes_data = json.loads(response_text)
        
        # Ensure proper formatting
        formatted_scenes = []
        for i, scene in enumerate(scenes_data):
            formatted_scene = {
                "block_number": scene.get("block_number", i + 1),
                "start_time": scene.get("start_time", i * request.block_duration),
                "end_time": scene.get("end_time", (i + 1) * request.block_duration),
                "lyric_segment": scene.get("lyric_segment", ""),
                "description": scene.get("description", ""),
                "camera_movement": scene.get("camera_movement", ""),
                "lighting": scene.get("lighting", ""),
                "mood": scene.get("mood", ""),
                "character_actions": scene.get("character_actions", ""),
                "visual_style": scene.get("visual_style", "cinematic photorealistic"),
            }
            formatted_scenes.append(formatted_scene)
        
        return {
            "message": "Lyrics breakdown complete",
            "block_duration": request.block_duration,
            "total_blocks": len(formatted_scenes),
            "estimated_duration": len(formatted_scenes) * request.block_duration,
            "scenes": formatted_scenes
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse AI response")
    except Exception as e:
        logger.error(f"Error in lyrics breakdown: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Generate Video (Mock)
@api_router.post("/projects/{project_id}/generate-video")
async def generate_video(project_id: str):
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if not project.get("storyboard"):
        raise HTTPException(status_code=400, detail="Storyboard must be generated first")
    
    # Mock video generation
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {
            "status": "video_ready",
            "video_url": "mock://video-ready",  # Placeholder
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {
        "message": "Video generation complete (MOCK - integrate video AI API for real generation)",
        "status": "video_ready"
    }


# ==================== GOOGLE DRIVE BACKUP ENDPOINTS ====================

class DriveUploadRequest(BaseModel):
    filename: str
    content: str
    cloud_backup: bool = False  # Upload to EXPORTS folder
    dual_backup: bool = False   # Upload to MULTI folder

class DriveStatusResponse(BaseModel):
    configured: bool
    exports_folder_id: str
    multi_folder_id: str

@api_router.get("/drive/status")
async def get_drive_status():
    """Check if Google Drive integration is configured"""
    service = get_google_drive_service()
    return {
        "configured": service is not None,
        "exports_folder_id": GDRIVE_EXPORTS_FOLDER_ID,
        "multi_folder_id": GDRIVE_MULTI_FOLDER_ID,
    }

@api_router.post("/drive/upload")
async def upload_to_drive(request: DriveUploadRequest):
    """
    Upload storyboard export to Google Drive folders.
    - cloud_backup: Upload to EXPORTS folder
    - dual_backup: Upload to MULTI folder  
    """
    results = {
        "local_saved": True,
        "cloud_backup": None,
        "dual_backup": None,
        "errors": []
    }
    
    # Always save to database as backup
    export_record = {
        "id": str(uuid.uuid4()),
        "filename": request.filename,
        "content": request.content,
        "created_at": datetime.utcnow(),
        "cloud_uploaded": False,
        "dual_uploaded": False,
    }
    await db.storyboard_exports.insert_one(export_record)
    
    # Upload to Google Drive if requested
    if request.cloud_backup or request.dual_backup:
        service = get_google_drive_service()
        
        if not service:
            results["errors"].append("Google Drive not configured. Please add service account credentials.")
            return results
        
        try:
            from googleapiclient.http import MediaIoBaseUpload
            
            # Prepare file content
            file_content = io.BytesIO(request.content.encode('utf-8'))
            media = MediaIoBaseUpload(file_content, mimetype='text/plain', resumable=True)
            
            # Upload to EXPORTS folder (CLOUD backup)
            if request.cloud_backup:
                try:
                    file_metadata = {
                        'name': request.filename,
                        'parents': [GDRIVE_EXPORTS_FOLDER_ID]
                    }
                    file_content.seek(0)
                    media = MediaIoBaseUpload(file_content, mimetype='text/plain', resumable=True)
                    
                    uploaded_file = service.files().create(
                        body=file_metadata,
                        media_body=media,
                        fields='id, name, webViewLink'
                    ).execute()
                    
                    results["cloud_backup"] = {
                        "success": True,
                        "file_id": uploaded_file.get('id'),
                        "file_name": uploaded_file.get('name'),
                        "link": uploaded_file.get('webViewLink'),
                        "folder": "EXPORTS"
                    }
                    
                    # Update database record
                    await db.storyboard_exports.update_one(
                        {"id": export_record["id"]},
                        {"$set": {"cloud_uploaded": True, "cloud_file_id": uploaded_file.get('id')}}
                    )
                    
                except Exception as e:
                    logger.error(f"EXPORTS folder upload failed: {e}")
                    results["cloud_backup"] = {"success": False, "error": str(e)}
                    results["errors"].append(f"CLOUD backup failed: {str(e)}")
            
            # Upload to MULTI folder (DUAL backup)
            if request.dual_backup:
                try:
                    file_metadata = {
                        'name': request.filename,
                        'parents': [GDRIVE_MULTI_FOLDER_ID]
                    }
                    file_content.seek(0)
                    media = MediaIoBaseUpload(file_content, mimetype='text/plain', resumable=True)
                    
                    uploaded_file = service.files().create(
                        body=file_metadata,
                        media_body=media,
                        fields='id, name, webViewLink'
                    ).execute()
                    
                    results["dual_backup"] = {
                        "success": True,
                        "file_id": uploaded_file.get('id'),
                        "file_name": uploaded_file.get('name'),
                        "link": uploaded_file.get('webViewLink'),
                        "folder": "MULTI"
                    }
                    
                    # Update database record
                    await db.storyboard_exports.update_one(
                        {"id": export_record["id"]},
                        {"$set": {"dual_uploaded": True, "dual_file_id": uploaded_file.get('id')}}
                    )
                    
                except Exception as e:
                    logger.error(f"MULTI folder upload failed: {e}")
                    results["dual_backup"] = {"success": False, "error": str(e)}
                    results["errors"].append(f"DUAL backup failed: {str(e)}")
                    
        except Exception as e:
            logger.error(f"Google Drive upload error: {e}")
            results["errors"].append(str(e))
    
    return results


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

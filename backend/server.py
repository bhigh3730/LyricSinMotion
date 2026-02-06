from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import base64
import json
import tempfile
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="LyricMotion API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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

# Audio Upload
@api_router.post("/projects/{project_id}/audio")
async def upload_audio(project_id: str, audio: UploadFile = File(...)):
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate file type
    if not audio.filename.lower().endswith(('.mp3', '.wav', '.m4a')):
        raise HTTPException(status_code=400, detail="Only MP3, WAV, and M4A files are supported")
    
    # Read and analyze audio
    content = await audio.read()
    
    # Mock audio analysis (in production, use librosa)
    # For demo, we'll estimate duration based on file size
    file_size = len(content)
    estimated_duration = min(file_size / 16000, 240)  # Rough estimate, max 4 min
    
    # Create mock audio analysis
    audio_analysis = {
        "duration": estimated_duration,
        "tempo": 120.0,  # Mock BPM
        "beats": [i * 0.5 for i in range(int(estimated_duration * 2))],  # Mock beats
        "sections": [
            {"name": "intro", "start": 0, "end": estimated_duration * 0.1},
            {"name": "verse1", "start": estimated_duration * 0.1, "end": estimated_duration * 0.3},
            {"name": "chorus1", "start": estimated_duration * 0.3, "end": estimated_duration * 0.45},
            {"name": "verse2", "start": estimated_duration * 0.45, "end": estimated_duration * 0.6},
            {"name": "chorus2", "start": estimated_duration * 0.6, "end": estimated_duration * 0.75},
            {"name": "bridge", "start": estimated_duration * 0.75, "end": estimated_duration * 0.85},
            {"name": "outro", "start": estimated_duration * 0.85, "end": estimated_duration},
        ],
        "energy_profile": [0.3, 0.5, 0.8, 0.6, 0.9, 0.7, 0.4]  # Mock energy per section
    }
    
    # Update project
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {
            "audio_filename": audio.filename,
            "audio_duration": estimated_duration,
            "audio_analysis": audio_analysis,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {
        "message": "Audio uploaded successfully",
        "filename": audio.filename,
        "duration": estimated_duration,
        "analysis": audio_analysis
    }

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

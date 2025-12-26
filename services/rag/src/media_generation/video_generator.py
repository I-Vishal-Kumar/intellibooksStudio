"""Video Generator using DALL-E + MoviePy for document video summaries."""

import asyncio
import logging
import os
import time
import hashlib
import tempfile
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import io

logger = logging.getLogger(__name__)


class VideoOrientation(str, Enum):
    """Video orientation options."""
    LANDSCAPE = "landscape"  # 16:9 (1920x1080)
    PORTRAIT = "portrait"  # 9:16 (1080x1920)
    SQUARE = "square"  # 1:1 (1080x1080)


class VideoDetailLevel(str, Enum):
    """Detail level for video content."""
    CONCISE = "concise"  # 3-5 scenes
    STANDARD = "standard"  # 5-8 scenes
    DETAILED = "detailed"  # 8-12 scenes


@dataclass
class VideoConfig:
    """Configuration for video generation."""
    orientation: VideoOrientation = VideoOrientation.LANDSCAPE
    detail_level: VideoDetailLevel = VideoDetailLevel.STANDARD
    include_audio: bool = True
    audio_language: str = "en-US"
    scene_duration: float = 5.0  # seconds per scene


@dataclass
class VideoResult:
    """Result of video generation."""
    success: bool
    video_path: Optional[str] = None
    duration_seconds: float = 0.0
    file_size_bytes: int = 0
    title: str = ""
    processing_time_ms: float = 0.0
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


# Resolution mapping
RESOLUTIONS = {
    VideoOrientation.LANDSCAPE: (1920, 1080),
    VideoOrientation.PORTRAIT: (1080, 1920),
    VideoOrientation.SQUARE: (1080, 1080),
}

# Scene count by detail level
SCENE_COUNTS = {
    VideoDetailLevel.CONCISE: 4,
    VideoDetailLevel.STANDARD: 6,
    VideoDetailLevel.DETAILED: 10,
}


@dataclass
class Scene:
    """Represents a single scene in the video."""
    title: str
    narration: str
    image_prompt: str
    duration: float = 5.0


class VideoGenerator:
    """
    Generates video summaries from document content.

    Uses:
    - DALL-E (OpenAI) for AI-generated images
    - Edge TTS for narration
    - MoviePy for video composition
    """

    def __init__(self, output_dir: Optional[str] = None):
        self.output_dir = Path(output_dir) if output_dir else Path("data/video_output")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    async def generate_video_summary(
        self,
        document_content: str,
        document_title: str,
        config: VideoConfig,
        session_id: Optional[str] = None,
    ) -> VideoResult:
        """
        Generate a video summary from document content.

        Args:
            document_content: The full text content of the document(s)
            document_title: Title for the video
            config: Video generation configuration
            session_id: Optional session ID for file organization

        Returns:
            VideoResult with path to generated video file
        """
        start_time = time.time()

        try:
            # Step 1: Generate scenes/storyboard using LLM
            logger.info("Generating video storyboard...")
            scenes = await self._generate_storyboard(
                document_content, document_title, config
            )

            if not scenes:
                return VideoResult(
                    success=False,
                    error="Failed to generate video storyboard",
                    processing_time_ms=(time.time() - start_time) * 1000,
                )

            logger.info(f"Generated {len(scenes)} scenes")

            # Step 2: Generate images for each scene using DALL-E
            logger.info("Generating images with DALL-E...")
            images = await self._generate_images(scenes, config)

            if not images or len(images) != len(scenes):
                return VideoResult(
                    success=False,
                    error="Failed to generate all scene images",
                    processing_time_ms=(time.time() - start_time) * 1000,
                )

            # Step 3: Generate audio narration
            audio_path = None
            if config.include_audio:
                logger.info("Generating audio narration...")
                audio_path = await self._generate_narration(scenes, config, session_id)

            # Step 4: Compose video with MoviePy
            logger.info("Composing final video...")
            video_path = await self._compose_video(
                scenes, images, audio_path, document_title, config, session_id
            )

            if not video_path or not Path(video_path).exists():
                return VideoResult(
                    success=False,
                    error="Failed to compose video",
                    processing_time_ms=(time.time() - start_time) * 1000,
                )

            # Get file info
            file_size = Path(video_path).stat().st_size
            total_duration = sum(s.duration for s in scenes)

            logger.info(f"Video generated: {video_path} ({file_size} bytes, {total_duration:.0f}s)")

            return VideoResult(
                success=True,
                video_path=video_path,
                duration_seconds=total_duration,
                file_size_bytes=file_size,
                title=document_title,
                processing_time_ms=(time.time() - start_time) * 1000,
                metadata={
                    "scene_count": len(scenes),
                    "resolution": RESOLUTIONS[config.orientation],
                    "has_audio": config.include_audio,
                    "detail_level": config.detail_level.value,
                },
            )

        except Exception as e:
            logger.exception(f"Video generation failed: {e}")
            return VideoResult(
                success=False,
                error=str(e),
                processing_time_ms=(time.time() - start_time) * 1000,
            )

    async def _generate_storyboard(
        self,
        content: str,
        title: str,
        config: VideoConfig,
    ) -> List[Scene]:
        """Generate video storyboard/scenes using LLM."""
        try:
            from openai import AsyncOpenAI
            from ..config import get_settings

            settings = get_settings()

            if not settings.openrouter_api_key:
                return self._create_simple_storyboard(content, title, config)

            client = AsyncOpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=settings.openrouter_api_key,
            )

            scene_count = SCENE_COUNTS.get(config.detail_level, 6)

            prompt = f"""Create a video storyboard for a document summary video.

Document Title: {title}

Document Content (excerpt):
{content[:6000]}

Create exactly {scene_count} scenes for this video. For each scene provide:
1. A short title (3-5 words)
2. Narration text (2-3 sentences, about 30-50 words)
3. An image prompt for DALL-E (describe a professional, clean visual that represents the content)

Format your response as JSON array:
[
  {{
    "title": "Scene Title",
    "narration": "The narration text to be spoken...",
    "image_prompt": "A professional illustration showing..."
  }}
]

Guidelines for image prompts:
- Use professional, corporate/business style
- Avoid text in images
- Prefer abstract/conceptual visualizations
- Use clean, modern design aesthetic
- Include relevant visual metaphors

Generate the storyboard now:"""

            response = await client.chat.completions.create(
                model=settings.openrouter_model,
                messages=[
                    {"role": "system", "content": "You are a professional video storyboard creator. Output only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=2000,
            )

            result = response.choices[0].message.content

            # Parse JSON
            import json
            # Clean up markdown code blocks if present
            if "```json" in result:
                result = result.split("```json")[1].split("```")[0]
            elif "```" in result:
                result = result.split("```")[1].split("```")[0]

            scenes_data = json.loads(result.strip())

            return [
                Scene(
                    title=s.get("title", f"Scene {i+1}"),
                    narration=s.get("narration", ""),
                    image_prompt=s.get("image_prompt", "Professional business illustration"),
                    duration=config.scene_duration,
                )
                for i, s in enumerate(scenes_data)
            ]

        except Exception as e:
            logger.warning(f"LLM storyboard generation failed: {e}, using simple storyboard")
            return self._create_simple_storyboard(content, title, config)

    def _create_simple_storyboard(
        self,
        content: str,
        title: str,
        config: VideoConfig,
    ) -> List[Scene]:
        """Create simple storyboard without LLM."""
        scene_count = SCENE_COUNTS.get(config.detail_level, 6)

        # Split content into chunks
        words = content.split()
        chunk_size = len(words) // scene_count

        scenes = []
        for i in range(scene_count):
            start = i * chunk_size
            end = start + chunk_size
            chunk = " ".join(words[start:end])

            # Take first 50 words for narration
            narration = " ".join(chunk.split()[:50])

            scenes.append(Scene(
                title=f"{title} - Part {i+1}",
                narration=narration if narration else f"Section {i+1} of the document.",
                image_prompt=f"Professional business illustration representing {title}, modern clean design, section {i+1}",
                duration=config.scene_duration,
            ))

        return scenes

    async def _generate_images(
        self,
        scenes: List[Scene],
        config: VideoConfig,
    ) -> List[bytes]:
        """Generate images for scenes using DALL-E."""
        try:
            from openai import AsyncOpenAI
            from ..config import get_settings

            settings = get_settings()

            # Use OpenAI directly for DALL-E (not OpenRouter)
            if not settings.openai_api_key:
                logger.warning("OpenAI API key not set, using placeholder images")
                return await self._generate_placeholder_images(scenes, config)

            client = AsyncOpenAI(api_key=settings.openai_api_key)

            # Determine size based on orientation
            size_map = {
                VideoOrientation.LANDSCAPE: "1792x1024",
                VideoOrientation.PORTRAIT: "1024x1792",
                VideoOrientation.SQUARE: "1024x1024",
            }
            size = size_map.get(config.orientation, "1792x1024")

            images = []
            for i, scene in enumerate(scenes):
                try:
                    logger.info(f"Generating image {i+1}/{len(scenes)}...")
                    response = await client.images.generate(
                        model="dall-e-3",
                        prompt=scene.image_prompt,
                        size=size,
                        quality="standard",
                        n=1,
                    )

                    # Download image
                    import httpx
                    async with httpx.AsyncClient() as http:
                        img_response = await http.get(response.data[0].url)
                        images.append(img_response.content)

                except Exception as e:
                    logger.warning(f"Failed to generate image for scene {i+1}: {e}")
                    # Use placeholder
                    placeholder = await self._create_placeholder_image(scene.title, config)
                    images.append(placeholder)

            return images

        except ImportError:
            logger.warning("OpenAI package not available, using placeholders")
            return await self._generate_placeholder_images(scenes, config)
        except Exception as e:
            logger.warning(f"DALL-E generation failed: {e}, using placeholders")
            return await self._generate_placeholder_images(scenes, config)

    async def _generate_placeholder_images(
        self,
        scenes: List[Scene],
        config: VideoConfig,
    ) -> List[bytes]:
        """Generate placeholder images when DALL-E is not available."""
        images = []
        for scene in scenes:
            img = await self._create_placeholder_image(scene.title, config)
            images.append(img)
        return images

    async def _create_placeholder_image(
        self,
        title: str,
        config: VideoConfig,
    ) -> bytes:
        """Create a placeholder image with text."""
        try:
            from PIL import Image, ImageDraw, ImageFont

            width, height = RESOLUTIONS[config.orientation]

            # Create gradient background
            img = Image.new("RGB", (width, height), "#1a1a2e")
            draw = ImageDraw.Draw(img)

            # Draw gradient effect
            for i in range(height):
                r = int(26 + (i / height) * 20)
                g = int(26 + (i / height) * 10)
                b = int(46 + (i / height) * 30)
                draw.line([(0, i), (width, i)], fill=(r, g, b))

            # Add title text
            try:
                font = ImageFont.truetype("arial.ttf", 48)
            except:
                font = ImageFont.load_default()

            # Center text
            text_bbox = draw.textbbox((0, 0), title, font=font)
            text_width = text_bbox[2] - text_bbox[0]
            text_height = text_bbox[3] - text_bbox[1]
            x = (width - text_width) // 2
            y = (height - text_height) // 2

            draw.text((x, y), title, fill="white", font=font)

            # Save to bytes
            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
            return buffer.getvalue()

        except Exception as e:
            logger.error(f"Failed to create placeholder: {e}")
            # Return minimal valid PNG
            return b'\x89PNG\r\n\x1a\n'

    async def _generate_narration(
        self,
        scenes: List[Scene],
        config: VideoConfig,
        session_id: Optional[str] = None,
    ) -> Optional[str]:
        """Generate audio narration for all scenes."""
        try:
            import edge_tts

            # Combine all narrations
            full_narration = " ... ".join(s.narration for s in scenes)

            # Get voice for language
            from .audio_generator import VOICE_MAP
            voice = VOICE_MAP.get(config.audio_language, "en-US-AriaNeural")

            # Generate unique filename
            content_hash = hashlib.md5(full_narration.encode()).hexdigest()[:8]
            timestamp = int(time.time())
            filename = f"narration_{timestamp}_{content_hash}.mp3"

            if session_id:
                output_dir = self.output_dir / session_id
                output_dir.mkdir(parents=True, exist_ok=True)
                output_path = output_dir / filename
            else:
                output_path = self.output_dir / filename

            communicate = edge_tts.Communicate(full_narration, voice)
            await communicate.save(str(output_path))

            return str(output_path)

        except Exception as e:
            logger.warning(f"Narration generation failed: {e}")
            return None

    async def _compose_video(
        self,
        scenes: List[Scene],
        images: List[bytes],
        audio_path: Optional[str],
        title: str,
        config: VideoConfig,
        session_id: Optional[str] = None,
    ) -> Optional[str]:
        """Compose final video using MoviePy."""
        try:
            from moviepy.editor import (
                ImageClip, concatenate_videoclips, AudioFileClip,
                CompositeVideoClip, TextClip
            )
            from PIL import Image
            import numpy as np

            width, height = RESOLUTIONS[config.orientation]
            fps = 24

            clips = []
            temp_files = []

            for i, (scene, img_bytes) in enumerate(zip(scenes, images)):
                # Save image to temp file
                temp_img = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
                temp_files.append(temp_img.name)

                # Resize image to target resolution
                img = Image.open(io.BytesIO(img_bytes))
                img = img.resize((width, height), Image.Resampling.LANCZOS)
                img.save(temp_img.name)
                temp_img.close()

                # Create clip
                clip = ImageClip(temp_img.name).set_duration(scene.duration)

                # Add title overlay
                try:
                    txt_clip = TextClip(
                        scene.title,
                        fontsize=36,
                        color="white",
                        font="Arial",
                        stroke_color="black",
                        stroke_width=1,
                    ).set_position(("center", height - 100)).set_duration(scene.duration)

                    clip = CompositeVideoClip([clip, txt_clip])
                except Exception as e:
                    logger.warning(f"Text overlay failed: {e}")

                clips.append(clip)

            # Concatenate all clips
            final_clip = concatenate_videoclips(clips, method="compose")

            # Add audio if available
            if audio_path and Path(audio_path).exists():
                try:
                    audio = AudioFileClip(audio_path)
                    # Adjust video duration to match audio
                    if audio.duration > final_clip.duration:
                        # Extend last clip
                        pass  # Keep as is for now
                    final_clip = final_clip.set_audio(audio)
                except Exception as e:
                    logger.warning(f"Audio overlay failed: {e}")

            # Generate output path
            content_hash = hashlib.md5(title.encode()).hexdigest()[:8]
            timestamp = int(time.time())
            filename = f"video_{timestamp}_{content_hash}.mp4"

            if session_id:
                output_dir = self.output_dir / session_id
                output_dir.mkdir(parents=True, exist_ok=True)
                output_path = output_dir / filename
            else:
                output_path = self.output_dir / filename

            # Write video
            final_clip.write_videofile(
                str(output_path),
                fps=fps,
                codec="libx264",
                audio_codec="aac",
                logger=None,  # Suppress moviepy logs
            )

            # Cleanup
            final_clip.close()
            for temp_file in temp_files:
                try:
                    os.unlink(temp_file)
                except:
                    pass

            return str(output_path)

        except ImportError as e:
            logger.error(f"MoviePy not available: {e}")
            return None
        except Exception as e:
            logger.exception(f"Video composition failed: {e}")
            return None

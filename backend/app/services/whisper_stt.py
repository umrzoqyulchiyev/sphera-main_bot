import os
import asyncio
import subprocess

_model = None
_ffmpeg = None


def _get_ffmpeg() -> str | None:
    """imageio-ffmpeg dan ffmpeg binarini topadi (sudosiz)."""
    global _ffmpeg
    if _ffmpeg is None:
        try:
            import imageio_ffmpeg
            _ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            _ffmpeg = ""
    return _ffmpeg or None


def _get_model():
    """faster-whisper ni lazy import qiladi."""
    global _model
    if _model is None:
        from faster_whisper import WhisperModel  # lazy
        size = os.getenv("WHISPER_MODEL", "small")
        _model = WhisperModel(size, device="cpu", compute_type="int8")
    return _model


def _to_wav(src_path: str) -> str:
    """Har qanday audio (webm/ogg/mp3) ni 16kHz mono wav ga aylantiradi."""
    ffmpeg = _get_ffmpeg()
    if not ffmpeg:
        return src_path  # PyAV o'zi dekod qiladi
    wav_path = src_path + ".wav"
    cmd = [
        ffmpeg, "-y", "-i", src_path,
        "-ar", "16000", "-ac", "1", "-f", "wav", wav_path,
    ]
    proc = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if proc.returncode == 0 and os.path.isfile(wav_path):
        return wav_path
    return src_path


async def transcribe(audio_path: str) -> str:
    def _run() -> str:
        path = _to_wav(audio_path)
        model = _get_model()
        segments, _info = model.transcribe(
            path,
            beam_size=5,
            vad_filter=True,
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()
        if path != audio_path:
            try:
                os.remove(path)
            except OSError:
                pass
        return text

    return await asyncio.to_thread(_run)

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  Download,
  ExternalLink,
  AlertCircle,
  Video,
  Headphones,
  Maximize2,
  Settings,
  Sparkles,
} from 'lucide-react';
import { VideoRecording } from '../types';

interface AnswerVideoPlayerProps {
  videoRecording?: VideoRecording;
  fallbackVideoUrl?: string;
  transcriptText?: string;
  speakerName?: string;
  className?: string;
}

export const AnswerVideoPlayer: React.FC<AnswerVideoPlayerProps> = ({
  videoRecording,
  fallbackVideoUrl,
  transcriptText,
  speakerName = 'Interviewee',
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [hasVideoError, setHasVideoError] = useState(false);
  const [usingAudioFallback, setUsingAudioFallback] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(videoRecording?.durationSeconds || 0);

  // Compute best source URL
  useEffect(() => {
    setHasVideoError(false);
    setUsingAudioFallback(false);

    if (fallbackVideoUrl) {
      setResolvedUrl(fallbackVideoUrl);
      return;
    }

    if (videoRecording) {
      if (videoRecording.videoUrl) {
        setResolvedUrl(videoRecording.videoUrl);
      } else if (videoRecording.id) {
        setResolvedUrl(`/api/videos/${videoRecording.id}`);
      }
    }
  }, [videoRecording, fallbackVideoUrl]);

  // Handle speed change
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  // Video error handler: fallback cascade
  const handleVideoError = () => {
    console.warn('Video element encountered error loading source:', resolvedUrl);

    // If we tried a local blob and it failed, try the server streaming endpoint
    if (videoRecording?.id && !resolvedUrl.startsWith('/api/videos/')) {
      const serverUrl = `/api/videos/${videoRecording.id}`;
      setResolvedUrl(serverUrl);
      return;
    }

    // Otherwise activate alternative media review mode (audio + direct download)
    setHasVideoError(true);
    setUsingAudioFallback(true);
  };

  const togglePlay = () => {
    if (usingAudioFallback) {
      if (!audioRef.current) return;
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      if (!videoRef.current) return;
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {
          setHasVideoError(true);
          setUsingAudioFallback(true);
        });
        setIsPlaying(true);
      }
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const downloadUrl = videoRecording?.id
    ? `/api/videos/${videoRecording.id}/download`
    : resolvedUrl;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Media Viewport */}
      <div className="relative aspect-video rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shadow-inner flex items-center justify-center group">
        {!resolvedUrl ? (
          <div className="text-center p-6 space-y-1.5 text-slate-500">
            <Video className="w-8 h-8 mx-auto opacity-30" />
            <p className="text-xs font-medium">No video recording available</p>
          </div>
        ) : usingAudioFallback ? (
          /* Alternative Audio & Voice Review Mode */
          <div className="w-full h-full p-4 flex flex-col items-center justify-between bg-gradient-to-b from-slate-900 to-slate-950 text-center">
            <div className="w-full flex items-center justify-between text-[11px] text-indigo-400">
              <span className="flex items-center space-x-1 font-semibold">
                <Headphones className="w-3.5 h-3.5" />
                <span>Audio Stream Active (Voice Answer Intact)</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                Alternative Media Mode
              </span>
            </div>

            {/* Audio Waveform Simulator */}
            <div className="flex items-center justify-center space-x-1.5 py-4 w-full max-w-xs">
              {[40, 65, 30, 85, 95, 45, 75, 55, 90, 60, 40, 70, 80, 50, 65].map((h, i) => (
                <span
                  key={i}
                  style={{ height: `${isPlaying ? Math.max(15, (h * (0.5 + Math.random() * 0.5))) : 12}px` }}
                  className={`w-1.5 rounded-full transition-all duration-150 ${
                    isPlaying ? 'bg-indigo-400 animate-pulse' : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>

            <audio
              ref={audioRef}
              src={resolvedUrl}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || duration)}
              className="w-full max-w-xs h-9 accent-indigo-500"
              controls
            />

            <p className="text-[11px] text-slate-400 line-clamp-1 italic px-2">
              "{transcriptText ? transcriptText.slice(0, 75) + '...' : `Recording from ${speakerName}`}"
            </p>
          </div>
        ) : (
          /* Standard Video Element */
          <>
            <video
              ref={videoRef}
              src={resolvedUrl}
              controls
              playsInline
              preload="metadata"
              onError={handleVideoError}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => {
                if (e.currentTarget.duration) {
                  setDuration(e.currentTarget.duration);
                }
              }}
              className="w-full h-full object-cover bg-black"
            >
              <source src={resolvedUrl} type="video/webm" />
              <source src={resolvedUrl} type="video/mp4" />
            </video>
          </>
        )}
      </div>

      {/* Quick Action Bar for Interviewers */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-900/90 border border-slate-800/80 rounded-xl p-2 px-3">
        {/* Left: Status & Duration */}
        <div className="flex items-center space-x-2 text-slate-300">
          <span className="flex items-center space-x-1">
            <span className={`w-2 h-2 rounded-full ${resolvedUrl ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            <span className="font-medium text-[11px]">
              {usingAudioFallback ? 'Audio Mode' : 'VP8/WebM Stream'}
            </span>
          </span>

          {duration > 0 && (
            <span className="text-slate-400 text-[11px] font-mono">
              {Math.floor(currentTime)}s / {Math.ceil(duration)}s
            </span>
          )}
        </div>

        {/* Center: Playback Speed Selector */}
        <div className="flex items-center space-x-1 bg-slate-950/80 border border-slate-800 rounded-lg p-0.5">
          {[0.75, 1, 1.25, 1.5, 2].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSpeedChange(s)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                playbackSpeed === s
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={`Play at ${s}x speed`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Right: Alternative Tools & Download */}
        <div className="flex items-center space-x-2">
          {resolvedUrl && (
            <>
              {/* Toggle Audio Only Mode */}
              <button
                type="button"
                onClick={() => setUsingAudioFallback((prev) => !prev)}
                className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] transition-colors cursor-pointer"
                title="Switch between video and audio-only playback"
              >
                <Headphones className="w-3 h-3 text-indigo-400" />
                <span>{usingAudioFallback ? 'Show Video' : 'Audio Mode'}</span>
              </button>

              {/* Direct Download Button */}
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download={`reqvoice_recording_${videoRecording?.id || 'answer'}.webm`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-indigo-200 text-[11px] border border-indigo-500/30 transition-colors cursor-pointer"
                  title="Download recording to review offline"
                >
                  <Download className="w-3 h-3" />
                  <span>Download</span>
                </a>
              )}

              {/* Open in new tab */}
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Open video in full separate tab"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </>
          )}
        </div>
      </div>

      {/* Fallback Notice banner if video had codec decoding issue */}
      {hasVideoError && (
        <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 flex items-start space-x-2 text-[11px] text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-amber-300">Alternative Media Player Engaged</p>
            <p className="text-amber-200/80">
              Your browser cannot decode this video container stream directly. The audio answer and transcription are intact above, or click "Download" to play in external media player.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

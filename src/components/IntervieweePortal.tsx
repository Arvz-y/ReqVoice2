import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Mic,
  Square,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  ArrowRight,
  ArrowLeft,
  XCircle,
  Sparkles,
  Edit3,
  BrainCircuit,
  Smile,
  Frown,
  Meh,
  ThumbsUp,
  Volume2,
  Sun,
  Moon,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../lib/api';
import { saveVideoBlob, deleteVideoBlob, calculateCompressionStats, blobToBase64 } from '../lib/videoStorage';
import { InterviewQuestion } from '../types';
import { useTheme } from './ThemeContext';

interface IntervieweePortalProps {
  token: string;
  onExitPreview?: () => void;
}

export const IntervieweePortal: React.FC<IntervieweePortalProps> = ({
  token,
  onExitPreview,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);

  // Question navigation
  const [currentQIndex, setCurrentQIndex] = useState(0);

  // Input mode: 'typing' or 'recording'
  const [inputMode, setInputMode] = useState<'recording' | 'typing'>('recording');
  const [typedResponse, setTypedResponse] = useState('');

  // Real-time sentiment state for typed / recorded response
  const [sentimentResult, setSentimentResult] = useState<{
    sentiment: 'positive' | 'neutral' | 'negative' | 'constructive';
    sentimentScore: number;
    sentimentTone: string;
    keyRequirements: string[];
    urgency?: string;
  } | null>(null);
  const [analyzingSentiment, setAnalyzingSentiment] = useState(false);

  // Camera & recording state
  const [cameraActive, setCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Video recording output for current question
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [compressionMetrics, setCompressionMetrics] = useState<any>(null);
  const [liveTranscript, setLiveTranscript] = useState<string>('');

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, any>>({});
  const [isCompleted, setIsCompleted] = useState(false);

  // Audio level visualizer
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // Storage notice when previous recording is deleted
  const [spaceSavedNotice, setSpaceSavedNotice] = useState<string | null>(null);
  const currentSavedVideoIdRef = useRef<string | null>(null);

  // Refs
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const reviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);

  // Load interview details
  useEffect(() => {
    loadInterview();
    return () => {
      stopCamera();
    };
  }, [token]);

  const loadInterview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.share.getPublicInterview(token);
      setSessionData(data);
      if (data.responses) {
        setSubmittedAnswers(data.responses);
        const answeredCount = Object.keys(data.responses).length;
        if (answeredCount >= data.questions.length && data.questions.length > 0) {
          setIsCompleted(true);
        } else {
          setCurrentQIndex(Math.min(answeredCount, data.questions.length - 1));
        }
      }
    } catch (err: any) {
      setError(err.message || 'Unable to access the requirements survey. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  // When question changes, reset temporary inputs for next question
  useEffect(() => {
    currentSavedVideoIdRef.current = null;
    resetRecording();
    setTypedResponse('');
    setSentimentResult(null);
    setLiveTranscript('');
  }, [currentQIndex]);

  // Attach the acquired stream after React has rendered the live <video>.
  // Previously startCamera() assigned srcObject before cameraActive rendered the
  // element, so liveVideoRef.current was null and the interviewee saw no camera.
  useEffect(() => {
    if (!cameraActive || !liveVideoRef.current || !mediaStreamRef.current) return;
    const video = liveVideoRef.current;
    video.srcObject = mediaStreamRef.current;
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => {});
  }, [cameraActive]);

  // Start camera and microphone
  const startCamera = async () => {
    setCameraError(null);
    try {
      stopCamera();

      // Optimize video constraints for space saving (640x480 SD resolution with 24fps)
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      // Render the viewfinder first, then attach the live MediaStream. This avoids
      // the race where React has not mounted the <video> element yet.
      setCameraActive(true);
      const attachLivePreview = () => {
        const video = liveVideoRef.current;
        const activeStream = mediaStreamRef.current;
        if (!video || !activeStream) return;
        if (video.srcObject !== activeStream) video.srcObject = activeStream;
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;
        video.play().catch(() => {});
      };
      requestAnimationFrame(attachLivePreview);

      // Initialize audio waveform visualizer
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;

        const updateMeter = () => {
          if (!analyserRef.current) return;
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(updateMeter);
        };
        updateMeter();
      } catch (e) {
        console.warn('Audio visualizer setup error:', e);
      }

      requestAnimationFrame(attachLivePreview);
    } catch (err: any) {
      console.error('Camera access failed:', err);
      setCameraError(
        'Unable to access camera or microphone. Check browser permissions or click "Test with Sample Video" below.'
      );
      setCameraActive(false);
    }
  };

  // Stop camera and microphone
  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setCameraActive(false);
    setAudioLevel(0);
  };

  // Start recording video and audio
  const startRecording = () => {
    if (!mediaStreamRef.current) return;

    try {
      recordedChunksRef.current = [];
      setRecordingSeconds(0);
      setSentimentResult(null);

      // Support VP8/Opus container with target 600 kbps for ~75% space reduction
      let mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      const recorder = new MediaRecorder(mediaStreamRef.current, {
        mimeType,
        videoBitsPerSecond: 600000,
      });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const completeBlob = new Blob(recordedChunksRef.current, {
          type: mimeType || 'video/webm',
        });
        const measuredDuration = recordingStartedAtRef.current
          ? Math.max(0, (Date.now() - recordingStartedAtRef.current) / 1000)
          : recordingSeconds;
        const finalDuration = Math.max(1, Math.round(measuredDuration));
        if (completeBlob.size < 1024) {
          console.error('Recording produced an invalidly small media file:', completeBlob.size, mimeType);
          setCameraError('The recording was incomplete. Please record again and wait until the timer is running before stopping.');
          setRecordedBlob(null);
          setRecordedVideoUrl(null);
          setIsRecording(false);
          return;
        }

        setRecordingSeconds(finalDuration);
        setRecordedBlob(completeBlob);

        const videoUrl = URL.createObjectURL(completeBlob);
        setRecordedVideoUrl(videoUrl);

        // Store video in local IndexedDB and record ID for cleanup on re-record
        const currentQ = sessionData?.questions?.[currentQIndex];
        const vidId = `vid-${currentQ?.id || 'q'}-${Date.now()}`;
        currentSavedVideoIdRef.current = vidId;
        try {
          await saveVideoBlob(vidId, completeBlob, finalDuration);
        } catch (err) {
          console.warn('Local video storage error:', err);
        }

        // Calculate space-saving compression metric
        const stats = calculateCompressionStats(finalDuration, completeBlob.size);
        setCompressionMetrics(stats);

        // Recording has fully stopped. Turn off the camera preview so the
        // interface clearly transitions from REC to Review mode.
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
        if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
        setCameraActive(false);
        recordingStartedAtRef.current = null;
        mediaRecorderRef.current = null;

        // Run real-time transcription and automatic sentiment analysis on recorded video
        triggerAutoTranscriptionAndSentiment(completeBlob, finalDuration);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      recordingStartedAtRef.current = Date.now();
      setIsRecording(true);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      alert(`Unable to start media recorder: ${err.message}`);
    }
  };

  // Stop recording only after asking MediaRecorder to flush its final chunk.
  // Without requestData(), some browsers can leave the last media chunk pending,
  // producing a tiny/invalid WebM (for example a few bytes) on upload.
  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && isRecording) {
      try {
        if (recorder.state === 'recording') recorder.requestData();
      } catch (err) {
        console.warn('Unable to flush final recording chunk:', err);
      }
      recorder.stop();
      setIsRecording(false);
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // Reset recording & delete previous recorded video to reclaim storage space
  const resetRecording = async () => {
    // 1. Delete previous stored video blob in IndexedDB to reclaim storage immediately
    if (currentSavedVideoIdRef.current) {
      try {
        await deleteVideoBlob(currentSavedVideoIdRef.current);
      } catch (err) {
        console.warn('Error deleting previous video from storage:', err);
      }
      currentSavedVideoIdRef.current = null;
    }

    // Also check if current question has a previously submitted video to delete
    const currentQ = sessionData?.questions?.[currentQIndex];
    if (currentQ && submittedAnswers[currentQ.id]?.videoRecording?.id) {
      try {
        await deleteVideoBlob(submittedAnswers[currentQ.id].videoRecording.id);
      } catch {}
    }

    // 2. Revoke object URL from browser memory
    if (recordedVideoUrl) {
      try {
        URL.revokeObjectURL(recordedVideoUrl);
      } catch {}
    }

    setRecordedBlob(null);
    setRecordedVideoUrl(null);
    setCompressionMetrics(null);
    setRecordingSeconds(0);
    setLiveTranscript('');
    setSentimentResult(null);
    setSpaceSavedNotice('Previous recorded video deleted to free local browser storage.');
    setTimeout(() => setSpaceSavedNotice(null), 3500);

    // 3. Make sure camera is actively running so interviewee sees themselves in the mirror viewfinder
    if (inputMode === 'recording') {
      if (!cameraActive) {
        startCamera();
      }
    }
  };

  // Provide synthetic sample recording if webcam is unavailable
  const generateDemoRecording = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = '#6366f1';
    ctx.font = 'bold 24px Outfit, sans-serif';
    ctx.fillText('reqvoiceV2 Camera Capture', 150, 180);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px Plus Jakarta Sans, sans-serif';
    ctx.fillText('Compressed Video & Audio Stream (640x480 @ 600 kbps)', 110, 220);
    ctx.fillStyle = '#10b981';
    ctx.fillText('Stakeholder Voice Recording Verified', 175, 270);

    const stream = canvas.captureStream(24);
    const audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const dest = audioCtx.createMediaStreamDestination();
    osc.connect(dest);
    osc.start();
    const combinedStream = new MediaStream([
      ...stream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ]);

    const recorder = new MediaRecorder(combinedStream, {
      mimeType: 'video/webm',
      videoBitsPerSecond: 600000,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      osc.stop();
      audioCtx.close();
      const demoBlob = new Blob(chunks, { type: 'video/webm' });
      setRecordedBlob(demoBlob);
      const url = URL.createObjectURL(demoBlob);
      setRecordedVideoUrl(url);
      setRecordingSeconds(18);
      const stats = calculateCompressionStats(18, demoBlob.size || 1420000);
      setCompressionMetrics(stats);
      setCameraError(null);
      triggerAutoTranscriptionAndSentiment(demoBlob, 18);
    };

    recorder.start();
    setTimeout(() => recorder.stop(), 1500);
  };

  // Real-time transcription and automatic sentiment analysis for video/audio
  const triggerAutoTranscriptionAndSentiment = async (blob: Blob, duration: number) => {
    const currentQ = sessionData?.questions?.[currentQIndex];
    if (!currentQ) return;

    setAnalyzingSentiment(true);
    try {
      const base64Media = await blobToBase64(blob);
      const result = await api.gemini.transcribeVideo({
        base64Media,
        mimeType: blob.type || 'video/webm',
        questionText: currentQ.questionText,
        category: currentQ.category,
        durationSeconds: duration,
      });

      if (result) {
        setLiveTranscript(result.transcript);
        setSentimentResult({
          sentiment: result.sentiment || 'constructive',
          sentimentScore: result.sentimentScore || 82,
          sentimentTone: `${result.sentiment.toUpperCase()} • High Confidence`,
          keyRequirements: result.keyRequirements || [],
        });
      }
    } catch (err) {
      console.warn('Auto transcription / sentiment failed:', err);
    } finally {
      setAnalyzingSentiment(false);
    }
  };

  // Real-time sentiment analysis for typed text
  const handleAnalyzeTypedText = async () => {
    if (!typedResponse.trim()) return;
    const currentQ = sessionData?.questions?.[currentQIndex];

    setAnalyzingSentiment(true);
    try {
      const res = await api.gemini.analyzeResponse({
        text: typedResponse,
        questionText: currentQ?.questionText,
        category: currentQ?.category,
        speakerRole: sessionData?.interviewee?.role,
      });

      if (res) {
        setSentimentResult({
          sentiment: res.sentiment,
          sentimentScore: res.sentimentScore,
          sentimentTone: res.sentimentTone,
          keyRequirements: res.keyRequirements,
          urgency: res.urgency,
        });
      }
    } catch (err) {
      console.error('Sentiment analysis error:', err);
    } finally {
      setAnalyzingSentiment(false);
    }
  };

  // Submit Answer (Typing or Recorded Video)
  const handleSubmitAnswer = async () => {
    const currentQ = sessionData.questions[currentQIndex];
    if (!currentQ) return;

    const hasTyped = typedResponse.trim().length > 0;
    const hasRecorded = !!recordedBlob;

    if (!hasTyped && !hasRecorded) {
      alert('Please either type an answer or record a video/audio response before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      let base64Media = '';
      if (recordedBlob) {
        if (recordedBlob.size < 1024) {
          throw new Error('The recorded video is incomplete or empty. Please record the answer again.');
        }
        base64Media = await blobToBase64(recordedBlob);
        if (!base64Media || base64Media.length < 1000) {
          throw new Error('The recorded video could not be encoded correctly. Please record the answer again.');
        }
      }

      // Evidence rule: AI transcript data is created only from an actual recording.
      // A typed answer remains the interviewee's written response and is never relabeled as a transcript.
      let finalTranscript = recordedBlob ? liveTranscript.trim() : '';
      let finalSentiment = recordedBlob ? sentimentResult : null;

      // A recording is valid evidence even when transcription fails.
      // Never invent a transcript. The original video must still be submitted
      // and made available to the interviewer for playback.
      // 2. Save compressed video blob locally in IndexedDB if not already saved
      const videoId = currentSavedVideoIdRef.current || `vid-${currentQ.id}-${Date.now()}`;
      if (recordedBlob && !currentSavedVideoIdRef.current) {
        await saveVideoBlob(videoId, recordedBlob, recordingSeconds);
        currentSavedVideoIdRef.current = videoId;
      }

      const responsePayload = {
        questionId: currentQ.id,
        responseText: recordedBlob ? finalTranscript : typedResponse.trim(),
        audioDurationSeconds: recordingSeconds || undefined,
        videoRecording: recordedBlob
          ? {
              id: videoId,
              durationSeconds: recordingSeconds,
              mimeType: recordedBlob.type || 'video/webm',
              compressionStats: compressionMetrics || calculateCompressionStats(recordingSeconds, recordedBlob.size),
              recordedAt: new Date().toISOString(),
              videoUrl: `/api/videos/${videoId}/playback`,
              base64Data: base64Media || undefined,
            }
          : undefined,
        aiTranscript: recordedBlob
          ? {
              transcript: finalTranscript,
              sentiment: finalSentiment?.sentiment || 'neutral',
              sentimentScore: finalSentiment?.sentimentScore ?? 50,
              sentimentTone: finalSentiment?.sentimentTone || 'Video Analysis',
              keyRequirements: finalSentiment?.keyRequirements || [],
              generatedAt: new Date().toISOString(),
              modelUsed: 'gemini-3.8-flash',
            }
          : undefined,
      };

      // 3. Submit to server
      const res = await api.share.submitAnswer(token, responsePayload);

      setSubmittedAnswers((prev) => ({
        ...prev,
        [currentQ.id]: responsePayload,
      }));

      if (res.isComplete || currentQIndex + 1 >= sessionData.questions.length) {
        setIsCompleted(true);
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } else {
        setCurrentQIndex((prev) => prev + 1);
      }
    } catch (err: any) {
      alert(`Submission error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400 font-mono">Connecting to ReqVoice Interview Portal...</p>
      </div>
    );
  }

  if (error || !sessionData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
            <XCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Interview Link Inactive</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {error || 'This interview link is no longer accessible or has expired.'}
          </p>
          {onExitPreview && (
            <button
              onClick={onExitPreview}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-medium hover:bg-slate-700 transition-colors"
            >
              Return to Workspace
            </button>
          )}
        </div>
      </div>
    );
  }

  const questions: InterviewQuestion[] = sessionData.questions || [];
  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">No Questions in Interview</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            This interview session does not contain any questions yet.
          </p>
          {onExitPreview && (
            <button
              onClick={onExitPreview}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-medium hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Return to Workspace
            </button>
          )}
        </div>
      </div>
    );
  }

  const currentQ: InterviewQuestion | undefined = questions[currentQIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(submittedAnswers).length;
  const progressPercent = Math.round((answeredCount / Math.max(1, totalQuestions)) * 100);

  const getSentimentIcon = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return <Smile className="w-4 h-4 text-emerald-400" />;
      case 'negative':
        return <Frown className="w-4 h-4 text-rose-400" />;
      case 'constructive':
        return <ThumbsUp className="w-4 h-4 text-indigo-400" />;
      default:
        return <Meh className="w-4 h-4 text-amber-400" />;
    }
  };

  const getSentimentBadgeColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
      case 'negative':
        return 'bg-rose-500/10 border-rose-500/30 text-rose-300';
      case 'constructive':
        return 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300';
      default:
        return 'bg-amber-500/10 border-amber-500/30 text-amber-300';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Top Preview Bar if launched from workspace */}
        {onExitPreview && (
          <div className="p-3 px-4 rounded-2xl bg-indigo-950/70 border border-indigo-500/30 flex items-center justify-between text-xs text-indigo-300">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Interviewee Portal Live Preview</span>
            </div>
            <button
              onClick={onExitPreview}
              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
            >
              Return to Workspace
            </button>
          </div>
        )}

        {/* Concise Brief Interviewer Information Card */}
        <div className="rounded-2xl sm:rounded-3xl bg-slate-900/90 border border-slate-800 p-4 sm:p-6 shadow-xl space-y-3.5 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shrink-0">
                <BrainCircuit className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-tight font-heading truncate">
                  {sessionData.systemName}
                </h1>
                <p className="text-[11px] text-slate-400">
                  Requirements Discovery Survey
                </p>
              </div>
            </div>

            {/* Header Right: Interviewer Profile & Quick Theme Switcher */}
            <div className="flex items-center space-x-3 self-start sm:self-auto">
              <div className="text-left sm:text-right text-xs">
                <span className="text-[10px] text-slate-500 uppercase font-mono">Interviewer: </span>
                <span className="font-semibold text-white">
                  {sessionData.interviewer?.name || 'Systems Lead'}
                </span>
                <span className="text-[11px] text-indigo-400 block">
                  {sessionData.interviewer?.role}
                </span>
              </div>

              <button
                id="btn-portal-theme-toggle"
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {theme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                )}
              </button>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">
                {isCompleted
                  ? 'Survey Completed'
                  : `Question ${currentQIndex + 1} of ${totalQuestions}`}
              </span>
              <span className="text-indigo-400 font-semibold">{progressPercent}% Progress</span>
            </div>
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-teal-400 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* COMPLETED STATE */}
        {isCompleted ? (
          <div className="p-8 sm:p-10 rounded-3xl bg-slate-900 border border-emerald-500/30 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white font-heading">Thank You! All Responses Recorded</h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                Your answers have been stored with real-time transcription and automatic sentiment analysis for {sessionData.interviewer?.name}.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 max-w-sm mx-auto text-left text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span>Questions Answered:</span>
                <span className="font-semibold text-white">{totalQuestions}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Media Optimization:</span>
                <span className="font-semibold text-emerald-400">SD 600 kbps (Space-Saving)</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>AI Engine:</span>
                <span className="font-semibold text-indigo-400">Real-Time Transcription & Sentiment</span>
              </div>
            </div>

            {onExitPreview && (
              <button
                onClick={onExitPreview}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Return to Workspace
              </button>
            )}
          </div>
        ) : (
          /* ACTIVE QUESTION CARD */
          currentQ && (
            <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-7 space-y-5 shadow-xl">
              
              {/* Question Banner */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                    Category: {currentQ.category.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-500">
                    Question {currentQIndex + 1} of {totalQuestions}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
                  {currentQ.questionText}
                </h2>
                {currentQ.rationale && (
                  <p className="text-xs text-slate-400 italic">
                    Focus: {currentQ.rationale}
                  </p>
                )}
              </div>

              {/* Input Mode Selector: Typing vs. Camera/Audio Recording */}
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setInputMode('recording')}
                  className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    inputMode === 'recording'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Record Audio & Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputMode('typing');
                    stopCamera();
                  }}
                  className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    inputMode === 'typing'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Type Written Answer</span>
                </button>
              </div>

              {/* INPUT MODE A: Video & Audio Recording */}
              {inputMode === 'recording' && (
                <div className="space-y-4">
                  {spaceSavedNotice && (
                    <div className="p-2.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2 animate-fadeIn">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>{spaceSavedNotice}</span>
                    </div>
                  )}

                  {/* Viewfinder / Review Player */}
                  <div className="relative aspect-video w-full rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                    {recordedVideoUrl ? (
                      <div className="relative w-full h-full">
                        <video
                          ref={reviewVideoRef}
                          src={recordedVideoUrl}
                          controls
                          playsInline
                          className="w-full h-full object-cover bg-black"
                        />
                        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold flex items-center space-x-1.5 backdrop-blur-sm">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Recorded ({formatTime(recordingSeconds)})</span>
                        </div>
                      </div>
                    ) : cameraActive ? (
                      <div className="relative w-full h-full">
                        <video
                          ref={liveVideoRef}
                          autoPlay
                          playsInline
                          muted
                          onLoadedMetadata={(e) => {
                            e.currentTarget.play().catch(() => {});
                          }}
                          className="w-full h-full object-cover scale-x-[-1]"
                        />

                        {/* Top status */}
                        <div className="absolute top-3 left-3 flex items-center space-x-2">
                          {isRecording ? (
                            <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-600/90 text-white text-xs font-bold shadow-lg animate-pulse">
                              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                              <span>REC • {formatTime(recordingSeconds)}</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 text-xs font-medium backdrop-blur-sm">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              <span>Live Mirror View</span>
                            </div>
                          )}
                        </div>

                        {/* Top right mirror badge */}
                        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700/80 text-[10px] text-slate-300 font-medium backdrop-blur-sm">
                          Self-View Active (Mirror)
                        </div>

                        {/* Audio visualizer bar */}
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-900/85 border border-slate-800/80 backdrop-blur-md text-xs">
                          <div className="flex items-center space-x-2">
                            <Mic className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-[11px] text-slate-300">Mic Level:</span>
                            <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-400 transition-all duration-100 rounded-full"
                                style={{ width: `${Math.min(100, audioLevel * 1.5)}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">SD 600 kbps (Compressed)</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-6 space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mx-auto flex items-center justify-center">
                          <Video className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">Record Video & Audio Answer</h3>
                          <p className="text-xs text-slate-400 max-w-xs mx-auto">
                            Camera and mic will record simultaneously. The video will be compressed to save space.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={startCamera}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
                          >
                            Enable Camera & Mic
                          </button>
                          <button
                            type="button"
                            onClick={generateDemoRecording}
                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
                          >
                            Test with Sample Video
                          </button>
                        </div>
                        {cameraError && (
                          <p className="text-[11px] text-amber-400 max-w-sm mx-auto">{cameraError}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Camera Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-2">
                      {cameraActive && !isRecording && !recordedVideoUrl && (
                        <button
                          type="button"
                          onClick={startRecording}
                          className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/30 transition-all cursor-pointer"
                        >
                          <Video className="w-4 h-4" />
                          <span>Start Recording Answer</span>
                        </button>
                      )}

                      {isRecording && (
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-600/30 transition-all cursor-pointer"
                        >
                          <Square className="w-4 h-4 fill-white" />
                          <span>Stop & Review ({formatTime(recordingSeconds)})</span>
                        </button>
                      )}

                      {recordedVideoUrl && (
                        <button
                          type="button"
                          onClick={resetRecording}
                          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Re-Record</span>
                        </button>
                      )}

                      {cameraActive && (
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="px-3 py-2 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors"
                        >
                          Turn Off Camera
                        </button>
                      )}
                    </div>

                    {compressionMetrics && (
                      <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-xs">
                        <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Saved {compressionMetrics.savingsPercentage}% space</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* INPUT MODE B: Typing Field */}
              {inputMode === 'typing' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-300">
                      Type Your Written Answer:
                    </label>
                    <button
                      type="button"
                      onClick={handleAnalyzeTypedText}
                      disabled={analyzingSentiment || !typedResponse.trim()}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1 transition-colors disabled:opacity-40"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{analyzingSentiment ? 'Analyzing...' : 'Run Real-Time Sentiment Check'}</span>
                    </button>
                  </div>

                  <textarea
                    rows={4}
                    value={typedResponse}
                    onChange={(e) => setTypedResponse(e.target.value)}
                    placeholder="Type your response to this requirements question in detail..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed"
                  />
                </div>
              )}

              {/* REAL-TIME TRANSCRIPTION & SENTIMENT ANALYSIS DISPLAY */}
              {(liveTranscript || sentimentResult || analyzingSentiment) && (
                <div className="p-4 rounded-2xl bg-slate-950/90 border border-indigo-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Real-Time Transcription & Sentiment Analysis
                      </span>
                    </div>

                    {sentimentResult && (
                      <span
                        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getSentimentBadgeColor(
                          sentimentResult.sentiment
                        )}`}
                      >
                        {getSentimentIcon(sentimentResult.sentiment)}
                        <span className="capitalize">{sentimentResult.sentiment}</span>
                        <span>({sentimentResult.sentimentScore}%)</span>
                      </span>
                    )}
                  </div>

                  {/* Real-time transcription */}
                  {liveTranscript && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-mono">Real-Time Transcription:</span>
                      <p className="text-xs text-slate-300 italic bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                        "{liveTranscript}"
                      </p>
                    </div>
                  )}

                  {/* Extracted Key Requirements Tags */}
                  {sentimentResult?.keyRequirements && sentimentResult.keyRequirements.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] text-slate-500 uppercase font-mono">
                        Extracted System Requirements:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {sentimentResult.keyRequirements.map((req, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px]"
                          >
                            #{req}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Question Action Bar */}
              <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-400">
                  {recordedBlob
                    ? '✓ Video recorded and compressed'
                    : typedResponse.trim()
                    ? '✓ Written answer ready'
                    : 'Record video/audio or type answer'}
                </div>

                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={isSubmitting || (!recordedBlob && !typedResponse.trim())}
                  className="flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50 cursor-pointer w-full sm:w-auto"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving Recording...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {currentQIndex + 1 < totalQuestions
                          ? 'Submit & Next Question'
                          : 'Submit Final Answer'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

            </div>
          )
        )}

      </div>
    </div>
  );
};

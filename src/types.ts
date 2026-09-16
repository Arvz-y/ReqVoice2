export type QuestionCategory = 'workflow' | 'pain_point' | 'expectation' | 'limitation' | 'desired_feature';

export type InterviewType = 'Structured' | 'Semi-Structured' | 'Unstructured';

export interface InterviewQuestion {
  id: string;
  category: QuestionCategory;
  questionText: string;
  rationale: string;
  suggestedFollowups: string[];
}

export interface SystemUnderStudy {
  id: string;
  userId?: string;
  name: string;
  type: string;
  description: string;
  lifecycleState: 'existing' | 'proposed' | 'modernization';
  targetRoles: string[];
  createdAt: string;
}

export interface VideoCompressionStats {
  resolution: string;
  codec: string;
  bitrateKbps: number;
  rawEstimateBytes: number;
  compressedBytes: number;
  savingsPercentage: number;
}

export interface RecordedVideoData {
  id: string;
  videoUrl?: string; // base64 or blob URL
  videoBlobKey?: string; // IndexedDB storage key
  mimeType: string;
  sourceMimeType?: string;
  deliveryMimeType?: string;
  storageStatus?: 'saved' | 'pending' | 'failed';
  storagePath?: string;
  durationSeconds: number;
  compressionStats: VideoCompressionStats;
  recordedAt: string;
  base64Data?: string;
}

export type VideoRecording = RecordedVideoData;

export interface AITranscriptData {
  transcript: string;
  confidence: number;
  sentiment: 'positive' | 'neutral' | 'negative' | 'constructive';
  sentimentScore: number;
  keyRequirements: string[];
  modelUsed: string;
  generatedAt: string;
  speaker?: string;
}

export interface InterviewResponse {
  id: string;
  interviewId: string;
  questionId: string;
  questionText: string;
  category: QuestionCategory;
  responseText: string;
  audioDurationSeconds: number;
  videoRecording?: RecordedVideoData;
  aiTranscript?: AITranscriptData;
  createdAt: string;
}

export interface SummaryReport {
  executiveSummary: string;
  overallSentiment: {
    dominant: 'positive' | 'neutral' | 'negative' | 'constructive';
    positiveRatio: number;
    negativeRatio: number;
    neutralRatio: number;
  };
  currentWorkflows: string[];
  userExpectations: string[];
  systemLimitations: string[];
  recommendedFeatures: {
    name: string;
    priority: 'High' | 'Medium' | 'Low';
    rationale: string;
  }[];
  synthesizedAt: string;
}

export interface InterviewSession {
  id: string;
  userId?: string;
  systemId: string;
  systemName: string;
  interviewerName: string;
  interviewerRole: string;
  interviewerDept: string;
  intervieweeName: string;
  intervieweeRole: string;
  intervieweeEmail?: string;
  intervieweeDept?: string;
  shareToken: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  interviewType?: InterviewType;
  questions: InterviewQuestion[];
  responses: Record<string, InterviewResponse>;
  summaryReport?: SummaryReport;
  createdAt: string;
  completedAt?: string;
}

export interface UserActivity {
  id: string;
  userId: string;
  type: 'session_created' | 'response_recorded' | 'interview_completed' | 'system_added' | 'system_deleted' | 'report_generated' | 'login';
  title: string;
  description: string;
  timestamp: string;
}

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  department: string;
  avatarUrl?: string;
  bio?: string;
  isFirstTime?: boolean;
  hasCompletedTutorial?: boolean;
  createdAt?: string;
}

export interface InterviewGuide {
  id: string;
  systemId: string;
  role: string;
  title: string;
  phases: {
    name: string;
    durationMinutes: number;
    questions: string[];
    tips: string;
  }[];
}

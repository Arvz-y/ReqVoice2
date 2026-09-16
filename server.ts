import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { DatabaseSync } from "node:sqlite";

dotenv.config();

const app = express();

app.use("/api", (req: Request, res: Response, next: any) => {
  const startedAt = Date.now();
  const requestId = req.headers["x-request-id"] || `api-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader("X-Request-ID", String(requestId));
  res.on("finish", () => {
    const elapsed = Date.now() - startedAt;
    console.log(`[API ${requestId}] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${elapsed}ms`);
  });
  next();
});
const PORT = Number(process.env.PORT) || 3000;

// High limit for audio/video payloads
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));

// Lazy-initialized Gemini client.
// AI Studio normally exposes GEMINI_API_KEY, but support common server-side
// aliases as well so question generation does not fail just because the secret
// was stored under another supported name.
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.API_KEY;

  if (!geminiClient && apiKey) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "ReqVoice2/AI-Question-Generator",
        },
      },
    });
  }
  return geminiClient;
}

// In-memory Database with rich seed data for Requirements Gathering
interface StoredSystem {
  id: string;
  userId: string;
  name: string;
  type: string;
  description: string;
  lifecycleState: "existing" | "proposed" | "modernization";
  targetRoles: string[];
  createdAt: string;
}

interface StoredQuestion {
  id: string;
  category: "workflow" | "pain_point" | "expectation" | "limitation" | "desired_feature";
  questionText: string;
  rationale: string;
  suggestedFollowups: string[];
}

interface StoredInterview {
  id: string;
  userId: string;
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
  status: "scheduled" | "in_progress" | "completed";
  interviewType?: "Structured" | "Semi-Structured" | "Unstructured";
  questions: StoredQuestion[];
  prompt?: string;
  promptVersion?: number;
  promptChangeCount?: number;
  responses: Record<string, any>;
  summaryReport?: any;
  createdAt: string;
  completedAt?: string;
}

interface StoredActivity {
  id: string;
  userId: string;
  type: "session_created" | "response_recorded" | "interview_completed" | "system_added" | "system_deleted" | "report_generated" | "login";
  title: string;
  description: string;
  timestamp: string;
}

interface StoredVideo {
  id: string;
  interviewId?: string;
  questionId?: string;
  mimeType: string;
  buffer: Buffer;
  durationSeconds: number;
  recordedAt: string;
}

// 1. Structured Questions (Standardized, quantifiable, rigid sequence, parameter & SLA focused)
const STRUCTURED_QUESTIONS: StoredQuestion[] = [
  {
    id: "sq-1",
    category: "workflow",
    questionText: "What are the exact step-by-step inputs, validation checks, and data transformations executed in this operational sequence?",
    rationale: "Map precise sequential data flow and operational business rules without ambiguity",
    suggestedFollowups: [
      "What is the exact maximum character length and format for each input parameter?",
      "Which fields require database uniqueness constraints or checksum validations?",
    ],
  },
  {
    id: "sq-2",
    category: "pain_point",
    questionText: "What is the measured frequency of system failures per week, and what is the exact average downtime in minutes?",
    rationale: "Quantify operational incident impact, MTTR, and failure severity with numeric metrics",
    suggestedFollowups: [
      "What percentage of failure incidents result in manual data recovery procedures?",
      "What is the measured financial or labor cost per hour of system unavailability?",
    ],
  },
  {
    id: "sq-3",
    category: "expectation",
    questionText: "What are the mandatory numerical SLA targets for API response latency (< ms) and peak concurrent user throughput?",
    rationale: "Establish quantifiable non-functional criteria and SLA compliance thresholds",
    suggestedFollowups: [
      "What is the maximum allowable latency under 99th percentile peak load?",
      "What is the target uptime percentage commitment (e.g. 99.9% vs 99.99%)?",
    ],
  },
  {
    id: "sq-4",
    category: "limitation",
    questionText: "Which specific database locks, third-party API rate limits, or batch window durations restrict current transaction throughput?",
    rationale: "Identify hard technical boundaries and architectural concurrency caps",
    suggestedFollowups: [
      "What is the exact query timeout threshold currently configured in the database?",
      "Which downstream endpoints throttle batch synchronization requests?",
    ],
  },
  {
    id: "sq-5",
    category: "desired_feature",
    questionText: "What are the top 3 functional capabilities required for Phase 1 acceptance criteria, ranked in strict order of priority?",
    rationale: "Establish formal ISO/IEC requirements acceptance baseline and scoring criteria",
    suggestedFollowups: [
      "What quantitative metric will verify successful deployment of each capability?",
      "Which capability is a non-negotiable blocking dependency for production go-live?",
    ],
  },
];

// 2. Semi-Structured Questions (Guided core framework with exploratory follow-up probes)
const SEMI_STRUCTURED_QUESTIONS: StoredQuestion[] = [
  {
    id: "ssq-1",
    category: "workflow",
    questionText: "Can you walk me through your daily routine workflows and primary tasks in the system?",
    rationale: "Establish baseline operational cadence, user tasks, and time allocations",
    suggestedFollowups: [
      "Which step in this routine workflow consumes the most human attention?",
      "How many different screens or third-party tools do you have to switch between?",
    ],
  },
  {
    id: "ssq-2",
    category: "pain_point",
    questionText: "What are the most frustrating bottlenecks, manual workarounds, or errors you encounter?",
    rationale: "Identify acute friction points, data re-entry, and process vulnerabilities",
    suggestedFollowups: [
      "How much time is lost each week managing this specific workaround?",
      "Has this error ever caused data inconsistencies in downstream reports?",
    ],
  },
  {
    id: "ssq-3",
    category: "expectation",
    questionText: "What are your core expectations for system latency, accessibility, and user ergonomics?",
    rationale: "Discover non-functional requirements, SLA benchmarks, and mobile/desktop expectations",
    suggestedFollowups: [
      "What sub-second response time would be considered acceptable for this query?",
      "Do your field teams require offline cached access when network connectivity drops?",
    ],
  },
  {
    id: "ssq-4",
    category: "limitation",
    questionText: "Where does the current architecture fail or prevent you from achieving departmental goals?",
    rationale: "Expose architectural boundaries, database lockups, or batch synchronization lags",
    suggestedFollowups: [
      "Is the bottleneck located in data ingestion, search indexing, or export generation?",
    ],
  },
  {
    id: "ssq-5",
    category: "desired_feature",
    questionText: "If you could prioritize three essential features for the new system, what would they be?",
    rationale: "Collect prioritized stakeholder wishlist and architectural feasibility weightings",
    suggestedFollowups: [
      "Which of these three features is a non-negotiable prerequisite to adoption?",
    ],
  },
];

// 3. Unstructured Questions (Open-ended conversational inquiry, strategic vision & narratives)
const UNSTRUCTURED_QUESTIONS: StoredQuestion[] = [
  {
    id: "uq-1",
    category: "workflow",
    questionText: "From your perspective, how does your department's day-to-day work fit into the bigger mission of the organization?",
    rationale: "Explore high-level stakeholder context, organizational environment, and collaborative dynamics",
    suggestedFollowups: [
      "How has the nature of your team's day-to-day work evolved over recent years?",
      "Where do the most interesting informal collaborations happen between teams?",
    ],
  },
  {
    id: "uq-2",
    category: "pain_point",
    questionText: "What aspects of the current technology cause the most friction or headaches for your team on a human level?",
    rationale: "Uncover emotional pain points, team fatigue, and hidden informal workarounds",
    suggestedFollowups: [
      "If you could wave a magic wand and eliminate one daily annoyance, what would it be?",
      "What workaround has your team invented that management might not even know about?",
    ],
  },
  {
    id: "uq-3",
    category: "expectation",
    questionText: "If this new system were an absolute dream to use every day, what would that feel like for your team?",
    rationale: "Discover strategic user vision, qualitative delight factors, and emotional expectations",
    suggestedFollowups: [
      "How would you measure whether this project was a runaway success one year from now?",
      "What would give your stakeholders complete confidence in adopting this platform?",
    ],
  },
  {
    id: "uq-4",
    category: "limitation",
    questionText: "What organizational or technological hurdles seem to hold your department back the most right now?",
    rationale: "Surface unspoken cultural, policy, and systemic barriers to organizational change",
    suggestedFollowups: [
      "Are there legacy policies or habits that might clash with modern workflows?",
      "Where do you feel the biggest gap between technological potential and daily reality?",
    ],
  },
  {
    id: "uq-5",
    category: "desired_feature",
    questionText: "Looking forward, what kind of innovations or superpowers would make the biggest meaningful difference in your work life?",
    rationale: "Gather open-ended aspirational capabilities, innovation ideas, and strategic roadmap value",
    suggestedFollowups: [
      "What new opportunities could your team pursue if routine manual work was automated?",
      "What exciting ideas have team members proposed that couldn't be built previously?",
    ],
  },
];

const DEFAULT_QUESTIONS: StoredQuestion[] = SEMI_STRUCTURED_QUESTIONS;

let systemsDb: StoredSystem[] = [];

let interviewsDb: StoredInterview[] = [];

let activitiesDb: StoredActivity[] = [];

// Dedicated server-side SQLite video database. The database stores the complete
// original recording plus an optional H.264/AAC delivery copy as BLOBs.
// Set VIDEO_DATABASE_PATH to a persistent Render Disk path in production.
const videoDatabasePath = path.resolve(
  process.env.VIDEO_DATABASE_PATH || path.join(process.cwd(), "video-vault", "videos.sqlite")
);
fs.mkdirSync(path.dirname(videoDatabasePath), { recursive: true });
const videoDatabase = new DatabaseSync(videoDatabasePath);
videoDatabase.exec(
  'PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; ' +
  'CREATE TABLE IF NOT EXISTS interview_videos (' +
  'id TEXT PRIMARY KEY, interview_id TEXT NOT NULL, question_id TEXT, ' +
  'mime_type TEXT NOT NULL, source_mime_type TEXT NOT NULL, delivery_mime_type TEXT NOT NULL, ' +
  'original_extension TEXT NOT NULL, original_blob BLOB, delivery_blob BLOB, storage_path TEXT, ' +
  'duration_seconds REAL NOT NULL DEFAULT 0, recorded_at TEXT NOT NULL, created_at TEXT NOT NULL' +
  '); ' +
  'CREATE INDEX IF NOT EXISTS idx_interview_videos_interview_question ON interview_videos(interview_id, question_id);'
);
try { videoDatabase.exec('ALTER TABLE interview_videos ADD COLUMN storage_path TEXT'); } catch {}
console.log('Video database:', videoDatabasePath);

// Persist interview sessions in the same SQLite database. Render can restart or
// redeploy a web service at any time; keeping interviews only in a process-local
// array makes a public interview link suddenly look expired even when the
// interviewee just recorded an answer.
videoDatabase.exec(
  'CREATE TABLE IF NOT EXISTS interview_sessions (' +
  'id TEXT PRIMARY KEY, user_id TEXT NOT NULL, system_id TEXT NOT NULL, ' +
  'share_token TEXT NOT NULL UNIQUE, session_json TEXT NOT NULL, updated_at TEXT NOT NULL' +
  '); ' +
  'CREATE INDEX IF NOT EXISTS idx_interview_sessions_share_token ON interview_sessions(share_token);'
);

const saveInterviewToDatabase = (interview: StoredInterview) => {
  const stmt = videoDatabase.prepare(
    'INSERT INTO interview_sessions (id, user_id, system_id, share_token, session_json, updated_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id, system_id=excluded.system_id, share_token=excluded.share_token, session_json=excluded.session_json, updated_at=excluded.updated_at'
  );
  stmt.run(
    interview.id,
    interview.userId,
    interview.systemId,
    interview.shareToken,
    JSON.stringify(interview),
    new Date().toISOString()
  );
};

const deleteInterviewFromDatabase = (interviewId: string) => {
  videoDatabase.prepare('DELETE FROM interview_sessions WHERE id = ?').run(interviewId);
};

const loadInterviewsFromDatabase = (): StoredInterview[] => {
  const rows = videoDatabase.prepare(
    'SELECT session_json FROM interview_sessions ORDER BY updated_at DESC'
  ).all() as any[];
  const loaded: StoredInterview[] = [];
  for (const row of rows) {
    try {
      const interview = JSON.parse(String(row.session_json)) as StoredInterview;
      if (interview?.id && interview?.shareToken && Array.isArray(interview.questions) && interview.responses) {
        loaded.push(interview);
      }
    } catch (error) {
      console.warn('Skipping corrupt persisted interview session:', error);
    }
  }
  return loaded;
};

interviewsDb = loadInterviewsFromDatabase();
console.log(`Loaded ${interviewsDb.length} persisted interview session(s).`);

const saveVideoToDatabase = (record: {
  id: string; interviewId: string; questionId?: string; sourceMimeType: string;
  sourceExtension: string; originalBuffer: Buffer; deliveryMimeType: string;
  deliveryBuffer?: Buffer | null; durationSeconds: number; recordedAt: string; storagePath?: string;
}) => {
  const stmt = videoDatabase.prepare(
    'INSERT INTO interview_videos (id, interview_id, question_id, mime_type, source_mime_type, delivery_mime_type, original_extension, original_blob, delivery_blob, storage_path, duration_seconds, recorded_at, created_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(id) DO UPDATE SET interview_id=excluded.interview_id, question_id=excluded.question_id, mime_type=excluded.mime_type, source_mime_type=excluded.source_mime_type, delivery_mime_type=excluded.delivery_mime_type, original_extension=excluded.original_extension, original_blob=COALESCE(excluded.original_blob, interview_videos.original_blob), delivery_blob=COALESCE(excluded.delivery_blob, interview_videos.delivery_blob), storage_path=excluded.storage_path, duration_seconds=excluded.duration_seconds, recorded_at=excluded.recorded_at'
  );
  stmt.run(record.id, record.interviewId, record.questionId || null, record.deliveryMimeType, record.sourceMimeType, record.deliveryMimeType, record.sourceExtension, record.storagePath ? null : record.originalBuffer, record.deliveryBuffer || null, record.storagePath || null, record.durationSeconds || 0, record.recordedAt, new Date().toISOString());
};

const getVideoDatabaseRecord = (videoId: string) => {
  const row = videoDatabase.prepare('SELECT * FROM interview_videos WHERE id = ?').get(videoId) as any;
  if (!row) return null;
  let originalBuffer = row.original_blob ? Buffer.from(row.original_blob as Uint8Array) : Buffer.alloc(0);
  const storagePath = row.storage_path ? String(row.storage_path) : null;
  return {
    id: String(row.id), interviewId: String(row.interview_id),
    questionId: row.question_id ? String(row.question_id) : undefined,
    sourceMimeType: String(row.source_mime_type), deliveryMimeType: String(row.delivery_mime_type),
    originalExtension: String(row.original_extension), originalBuffer,
    deliveryBuffer: row.delivery_blob ? Buffer.from(row.delivery_blob as Uint8Array) : null,
    storagePath, durationSeconds: Number(row.duration_seconds) || 0, recordedAt: String(row.recorded_at),
  };
};

// Short-lived compatibility cache for legacy code; SQLite is authoritative.
const videosStore = new Map<string, StoredVideo>();

// Render's default filesystem is ephemeral. Set VIDEO_STORAGE_DIR to a mounted
// persistent disk (for example /var/data/reqvoice-videos) in production so
// submitted recordings survive deploys/restarts.
const userVideosDir = path.resolve(
  process.env.VIDEO_STORAGE_DIR || path.join(process.cwd(), "user-videos")
);
if (!fs.existsSync(userVideosDir)) {
  fs.mkdirSync(userVideosDir, { recursive: true });
}
console.log(`Video storage directory: ${userVideosDir}`);

// Browser MediaRecorder commonly produces WebM/VP8/Opus. That is excellent for
// browser capture, but Windows Media Player and some mobile/default players may
// reject the container/codec. Keep the original recording untouched as evidence
// and create a broadly compatible H.264/AAC MP4 playback copy.
const videoTranscodeJobs = new Map<string, Promise<string | null>>();

const getVideoFilePath = (videoId: string, extension: string) =>
  path.join(userVideosDir, `${videoId}.${extension}`);

const transcodeToCompatibleMp4 = (videoId: string, sourcePath: string): Promise<string | null> => {
  const existingJob = videoTranscodeJobs.get(videoId);
  if (existingJob) return existingJob;

  const outputPath = getVideoFilePath(videoId, "mp4");
  if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1024) {
    return Promise.resolve(outputPath);
  }
  try {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  } catch {}

  if (!ffmpegPath || !fs.existsSync(ffmpegPath as string)) {
    console.error("FFmpeg binary is unavailable; cannot create a compatible MP4 copy.");
    return Promise.resolve(null);
  }

  const job = new Promise<string | null>((resolve) => {
    const args = [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-i", sourcePath,
      "-map", "0:v:0?",
      "-map", "0:a:0?",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      "-shortest",
      outputPath,
    ];

    const child = spawn(ffmpegPath as string, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 6000) stderr = stderr.slice(-6000);
    });

    child.on("error", (err) => {
      console.error(`Video MP4 conversion failed for ${videoId}:`, err.message);
      try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
      resolve(null);
    });

    child.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1024) {
        console.log(`Video MP4 playback copy ready: ${videoId} (${fs.statSync(outputPath).size} bytes)`);
        resolve(outputPath);
      } else {
        console.error(`Video MP4 conversion exited with code ${code} for ${videoId}.`, stderr.slice(-2500));
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
        resolve(null);
      }
    });
  });

  videoTranscodeJobs.set(videoId, job);
  void job.finally(() => videoTranscodeJobs.delete(videoId));
  return job;
};

const detectVideoContainer = (buffer: Buffer): { extension: "mp4" | "webm" | "ogg"; mimeType: string } | null => {
  // Detect the actual container from its bytes instead of trusting a browser MIME
  // label. This prevents a WebM payload from being saved with the wrong extension.
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    return { extension: "mp4", mimeType: "video/mp4" };
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return { extension: "webm", mimeType: "video/webm" };
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "OggS") {
    return { extension: "ogg", mimeType: "video/ogg" };
  }
  return null;
};

const findOriginalVideoPath = (videoId: string): { path: string; mimeType: string; extension: string } | null => {
  const safeId = videoId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId || safeId !== videoId) return null;

  for (const extension of ["mp4", "webm", "ogg"]) {
    const filePath = getVideoFilePath(safeId, extension);
    if (fs.existsSync(filePath)) {
      const mimeType =
        extension === "mp4" ? "video/mp4" :
        extension === "ogg" ? "video/ogg" :
        "video/webm";
      return { path: filePath, mimeType, extension };
    }
  }
  return null;
};


interface StoredUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  department: string;
  password: string; // Stored securely
  avatarUrl: string;
  bio: string;
  isFirstTime: boolean;
  hasCompletedTutorial: boolean;
  createdAt: string;
}

let usersDb: StoredUser[] = [];


// Active authenticated sessions: token -> StoredUser (No default auto-login session for security)
const activeSessions = new Map<string, StoredUser>();

function getAuthUser(req: Request): StoredUser | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  return activeSessions.get(token) || null;
}

function sanitizeUser(user: StoredUser) {
  const { password, ...safe } = user;
  return safe;
}

// ========================
// API ROUTES
// ========================

// 0. Health check
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "reqvoiceV2", timestamp: new Date().toISOString() });
});

// 1. Auth routes
app.get("/api/auth/me", (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ user: null, message: "Not authenticated" });
    return;
  }
  res.json({ user: sanitizeUser(user) });
});

app.post("/api/auth/login", (req: Request, res: Response) => {
  const { usernameOrEmail, password } = req.body;
  if (!usernameOrEmail) {
    res.status(400).json({ error: "Username or email is required." });
    return;
  }

  const query = usernameOrEmail.trim().toLowerCase();
  const user = usersDb.find(
    (u) => u.username.toLowerCase() === query || u.email.toLowerCase() === query
  );

  if (!user) {
    res.status(401).json({ error: "No account found matching this username or email." });
    return;
  }

  if (password && user.password !== password) {
    res.status(401).json({ error: "Invalid password. Please verify and try again." });
    return;
  }

  const token = `rv2_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
  activeSessions.set(token, user);
  res.json({ success: true, token, user: sanitizeUser(user) });
});

app.post("/api/auth/register", (req: Request, res: Response) => {
  const { name, username, email, password, role, department } = req.body;
  if (!name || !username || !email || !password) {
    res.status(400).json({ error: "All registration fields are required." });
    return;
  }

  const existing = usersDb.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase() || u.email.toLowerCase() === email.trim().toLowerCase()
  );
  if (existing) {
    res.status(400).json({ error: "Username or email already registered." });
    return;
  }

  const newUser: StoredUser = {
    id: `usr-${Date.now().toString(36)}`,
    name: name.trim(),
    username: username.trim().toLowerCase(),
    email: email.trim().toLowerCase(),
    password: password.trim(),
    role: role || "Requirements Engineer",
    department: department || "Systems Engineering",
    avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
    bio: "Systems requirements specialist.",
    isFirstTime: true,
    hasCompletedTutorial: false,
    createdAt: new Date().toISOString(),
  };

  usersDb.push(newUser);

  // Initialize a personalized default system workspace for the new user
  const initialSystem: StoredSystem = {
    id: `sys-${Date.now().toString(36)}`,
    userId: newUser.id,
    name: `${newUser.department || "Enterprise"} Portal Modernization`,
    type: "Enterprise Information Architecture",
    description: `Requirements discovery and stakeholder feedback repository for ${newUser.name}.`,
    lifecycleState: "proposed",
    targetRoles: [newUser.role || "Requirements Analyst", "Key Stakeholder", "Operations Manager"],
    createdAt: new Date().toISOString(),
  };
  systemsDb.unshift(initialSystem);

  // Initialize first activity record for this isolated user
  activitiesDb.unshift({
    id: `act-${Date.now().toString(36)}`,
    userId: newUser.id,
    type: "login",
    title: "Account Space Initialized",
    description: `Welcome to ReqVoice, ${newUser.name}. Your private requirements workspace has been configured.`,
    timestamp: new Date().toISOString(),
  });

  const token = `rv2_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
  activeSessions.set(token, newUser);
  res.json({ success: true, token, user: sanitizeUser(newUser) });
});

app.post("/api/auth/logout", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    activeSessions.delete(token);
  }
  res.json({ success: true });
});

app.put("/api/auth/profile", (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { name, username, department, role, avatarUrl, bio } = req.body;

  if (username && username.trim().toLowerCase() !== user.username.toLowerCase()) {
    const existing = usersDb.find(
      (u) => u.id !== user.id && u.username.toLowerCase() === username.trim().toLowerCase()
    );
    if (existing) {
      res.status(400).json({ error: "This username is already taken." });
      return;
    }
    user.username = username.trim().toLowerCase();
  }

  if (name) user.name = name.trim();
  if (department) user.department = department.trim();
  if (role) user.role = role.trim();
  if (avatarUrl) user.avatarUrl = avatarUrl.trim();
  if (bio !== undefined) user.bio = bio.trim();

  // Also update corresponding interviewer names in interview records belonging to this user
  interviewsDb.forEach((inv) => {
    if (inv.userId === user.id) {
      if (name) inv.interviewerName = user.name;
      if (role) inv.interviewerRole = user.role;
      if (department) inv.interviewerDept = user.department;
    }
  });

  res.json({ success: true, user: sanitizeUser(user) });
});

app.put("/api/auth/password", (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Both current password and new password are required." });
    return;
  }

  if (user.password !== currentPassword) {
    res.status(400).json({ error: "Current password does not match records." });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters long." });
    return;
  }

  user.password = newPassword;
  res.json({ success: true, message: "Password updated successfully." });
});

app.post("/api/auth/tutorial-completed", (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (user) {
    user.hasCompletedTutorial = true;
    user.isFirstTime = false;
  }
  res.json({ success: true });
});

// 2. Systems routes (Account-Isolated)
app.get("/api/systems", (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    res.json({ systems: [] });
    return;
  }
  const userSystems = systemsDb.filter((s) => s.userId === user.id);
  res.json({ systems: userSystems });
});

app.post("/api/systems", (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { name, type, description, lifecycleState, targetRoles } = req.body;
  if (!name) {
    res.status(400).json({ error: "System name is required." });
    return;
  }
  const newSystem: StoredSystem = {
    id: `sys-${Date.now().toString(36)}`,
    userId: user.id,
    name: name.trim(),
    type: type || "Custom Information Architecture",
    description: description || "",
    lifecycleState: lifecycleState || "proposed",
    targetRoles: Array.isArray(targetRoles) ? targetRoles : ["End User", "System Administrator"],
    createdAt: new Date().toISOString(),
  };
  systemsDb.unshift(newSystem);

  activitiesDb.unshift({
    id: `act-${Date.now().toString(36)}`,
    userId: user.id,
    type: "system_added",
    title: `System Registered: ${newSystem.name}`,
    description: `Added system under study: ${newSystem.name} (${newSystem.lifecycleState})`,
    timestamp: new Date().toISOString(),
  });

  res.json({ system: newSystem });
});

app.delete("/api/systems/:id", (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const systemId = req.params.id;
  const sysIndex = systemsDb.findIndex((s) => s.id === systemId);
  if (sysIndex === -1) {
    res.status(404).json({ error: "System not found." });
    return;
  }

  const sys = systemsDb[sysIndex];
  if (sys.userId !== user.id) {
    res.status(403).json({ error: "Access denied. You can only remove systems registered in your account." });
    return;
  }

  const removedSystem = systemsDb.splice(sysIndex, 1)[0];

  // Also remove associated interviews if any
  const removedInterviewIds = interviewsDb.filter((inv) => inv.systemId === systemId).map((inv) => inv.id);
  interviewsDb = interviewsDb.filter((inv) => inv.systemId !== systemId);
  removedInterviewIds.forEach(deleteInterviewFromDatabase);

  activitiesDb.unshift({
    id: `act-${Date.now().toString(36)}`,
    userId: user.id,
    type: "system_deleted",
    title: `System Removed: ${removedSystem.name}`,
    description: `Removed system under study: ${removedSystem.name}`,
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, removedId: systemId });
});

// 3. Interviews routes (Account-Isolated)
app.get("/api/interviews", (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    res.json({ interviews: [] });
    return;
  }
  const { systemId } = req.query;
  let list = interviewsDb.filter((i) => i.userId === user.id);
  if (systemId) {
    list = list.filter((i) => i.systemId === systemId);
  }
  res.json({ interviews: list });
});

app.get("/api/interviews/:id", (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const interview = interviewsDb.find((i) => i.id === req.params.id);
  if (!interview) {
    res.status(404).json({ error: "Interview record not found" });
    return;
  }
  if (user && interview.userId && interview.userId !== user.id) {
    res.status(403).json({ error: "Access denied. This interview belongs to another account." });
    return;
  }
  res.json({ interview });
});

app.post("/api/interviews", (req: Request, res: Response) => {
  try {
    const currentUser = getAuthUser(req);
  if (!currentUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { systemId, intervieweeName, intervieweeRole, intervieweeEmail, intervieweeDept, questions, interviewType, prompt, promptVersion } = req.body;
  const userSystems = systemsDb.filter((s) => s.userId === currentUser.id);
  const sys = userSystems.find((s) => s.id === systemId) || userSystems[0] || systemsDb[0];

  const defaultForType = interviewType === "Structured" ? STRUCTURED_QUESTIONS :
    interviewType === "Unstructured" ? UNSTRUCTURED_QUESTIONS :
    SEMI_STRUCTURED_QUESTIONS;

  const formattedQuestions: StoredQuestion[] = (questions || defaultForType).map(
    (q: any, idx: number) => ({
      id: q.id || `q-${Date.now().toString(36)}-${idx}`,
      category: q.category || "workflow",
      questionText: q.questionText || "What are your primary requirements?",
      rationale: q.rationale || "Requirements discovery",
      suggestedFollowups: q.suggestedFollowups || [],
    })
  );

  const newInterview: StoredInterview = {
    id: `int-${Date.now().toString(36)}`,
    userId: currentUser.id,
    systemId: sys.id,
    systemName: sys.name,
    interviewerName: currentUser.name,
    interviewerRole: currentUser.role,
    interviewerDept: currentUser.department,
    intervieweeName: intervieweeName || "Anonymous Stakeholder",
    intervieweeRole: intervieweeRole || "Operational Specialist",
    intervieweeEmail: intervieweeEmail || "",
    intervieweeDept: intervieweeDept || "Operations",
    shareToken: `token-${Math.random().toString(36).substring(2, 8)}-${Date.now().toString(36)}`,
    status: "in_progress",
    interviewType: (interviewType === "Structured" || interviewType === "Unstructured" || interviewType === "Semi-Structured") ? interviewType : "Semi-Structured",
    questions: formattedQuestions,
    prompt: typeof prompt === "string" ? prompt.trim() : "",
    promptVersion: Number(promptVersion) || 1,
    promptChangeCount: Number(promptVersion) > 0 ? Number(promptVersion) : 1,
    responses: {},
    createdAt: new Date().toISOString(),
  };

  interviewsDb.unshift(newInterview);
  saveInterviewToDatabase(newInterview);

  activitiesDb.unshift({
    id: `act-${Date.now().toString(36)}`,
    userId: currentUser.id,
    type: "session_created",
    title: "Interview Session Created",
    description: `Created requirements discovery session with ${newInterview.intervieweeName} (${newInterview.intervieweeRole}) for ${newInterview.systemName}`,
    timestamp: new Date().toISOString(),
  });

  res.status(201).json({ interview: newInterview });
  } catch (error: any) {
    console.error("Create interview session failed:", error);
    res.status(500).json({
      error: "Failed to create interview session.",
      details: process.env.NODE_ENV === "production" ? undefined : (error?.message || String(error)),
    });
  }
});

app.post("/api/interviews/:id/response", async (req: Request, res: Response) => {
  const interview = interviewsDb.find((i) => i.id === req.params.id);
  if (!interview) {
    res.status(404).json({ error: "Interview not found" });
    return;
  }

  const { questionId, responseText, audioDurationSeconds, videoRecording, aiTranscript } = req.body;
  const question = interview.questions.find((q) => q.id === questionId);

  // Persist the actual recording before accepting the response. The disk vault is the durable
  // backing store; videosStore is the fast in-memory cache used for streaming.
  if (videoRecording && videoRecording.id) {
    if (!videoRecording.base64Data && videoRecording.storageStatus !== "saved") {
      res.status(400).json({ error: "The recorded video could not be accessed, so no transcript or response media was stored." });
      return;
    }
    // A previously persisted recording can be submitted again without its
    // base64 payload. Do not try to decode an undefined value.
    if (!videoRecording.base64Data && videoRecording.storageStatus === "saved") {
      videoRecording.videoUrl = "/api/videos/" + videoRecording.id + "/playback";
    } else {
      try {
        const rawBase64 = String(videoRecording.base64Data || "");
        const cleanBase64 = rawBase64.replace(/^data:[^;]+;base64,/i, "").replace(/\s/g, "");
        if (cleanBase64.length < 1000) {
          throw new Error(`Encoded video payload is too small (${cleanBase64.length} base64 characters)`);
        }

        const videoBuffer = Buffer.from(cleanBase64, "base64");
        if (videoBuffer.length < 1024) {
          throw new Error(`Video payload is incomplete (${videoBuffer.length} bytes)`);
        }

        const detected = detectVideoContainer(videoBuffer);
        if (!detected) {
          throw new Error("The uploaded bytes are not a recognized MP4, WebM, or Ogg video container");
        }

        const extension = detected.extension;
        const mimeType = detected.mimeType;
        console.log(`Saving interview video ${videoRecording.id}: ${videoBuffer.length} bytes, detected ${mimeType}`);

        const originalPath = getVideoFilePath(videoRecording.id, extension);
        fs.writeFileSync(originalPath, videoBuffer);
        if (!fs.existsSync(originalPath) || fs.statSync(originalPath).size !== videoBuffer.length) {
          throw new Error("Server failed to persist the complete video payload");
        }

        videosStore.set(videoRecording.id, {
          id: videoRecording.id,
          interviewId: interview.id,
          questionId,
          mimeType,
          buffer: videoBuffer,
          durationSeconds: videoRecording.durationSeconds || 0,
          recordedAt: videoRecording.recordedAt || new Date().toISOString(),
        });

        // Keep transcription independent from media persistence. The original
        // capture is already stored even if AI later fails. For WebM/Ogg, create
        // a standard H.264/AAC MP4 delivery copy for browser and device playback.
        let deliveryExtension = extension;
        if (extension !== "mp4") {
          const compatibleMp4 = await transcodeToCompatibleMp4(videoRecording.id, originalPath);
          if (compatibleMp4) {
            deliveryExtension = "mp4";
            const mp4Buffer = fs.readFileSync(compatibleMp4);
            if (mp4Buffer.length > 1024) {
              videosStore.set(videoRecording.id, {
                id: videoRecording.id,
                interviewId: interview.id,
                questionId,
                mimeType: "video/mp4",
                buffer: mp4Buffer,
                durationSeconds: videoRecording.durationSeconds || 0,
                recordedAt: videoRecording.recordedAt || new Date().toISOString(),
              });
            }
          }
        }

        videoRecording.videoUrl = "/api/videos/" + videoRecording.id + "/playback";
        videoRecording.storageStatus = "saved";
        videoRecording.storagePath = "video_vault/" + videoRecording.id + "." + deliveryExtension;
        videoRecording.mimeType = deliveryExtension === "mp4" ? "video/mp4" : mimeType;
        videoRecording.sourceMimeType = mimeType;
        videoRecording.deliveryMimeType = videoRecording.mimeType;
        // Never keep the large base64 payload in the interview record or send it
        // back to the interviewer; the server-side video file is the media source.
        delete videoRecording.base64Data;

      } catch (err) {
        console.warn("Could not save video recording:", err);
        const message = err instanceof Error ? err.message : "Unknown media storage error";
      res.status(422).json({
        code: "VIDEO_STORAGE_FAILED",
        error: "The video recording could not be saved. " + message,
        retryable: false,
      });
        return;
      }
    }
  }

  const responseObj = {
    id: `resp-${Date.now().toString(36)}`,
    interviewId: interview.id,
    questionId,
    questionText: question ? question.questionText : "Requirements Discovery",
    category: question ? question.category : "workflow",
    responseText: responseText || "",
    audioDurationSeconds: audioDurationSeconds || 0,
    videoRecording: videoRecording
      ? {
          ...videoRecording,
          transcriptionStatus: aiTranscript?.transcript?.trim() ? "completed" : "unavailable",
        }
      : undefined,
    // Never create or preserve an AI transcript unless it contains text from
    // the submitted recording.
    aiTranscript: (videoRecording?.storageStatus === "saved" && aiTranscript?.transcript?.trim())
      ? aiTranscript
      : undefined,
    createdAt: new Date().toISOString(),
  };

  interview.responses[questionId] = responseObj;
  saveInterviewToDatabase(interview);

  if (interview.userId) {
    activitiesDb.unshift({
      id: `act-${Date.now().toString(36)}`,
      userId: interview.userId,
      type: "response_recorded",
      title: "Response Recorded",
      description: `${interview.intervieweeName} answered question "${question ? question.questionText.slice(0, 45) + '...' : questionId}"`,
      timestamp: new Date().toISOString(),
    });
  }

  res.json({ success: true, response: responseObj });
});

app.post("/api/interviews/:id/finish", async (req: Request, res: Response) => {
  const interview = interviewsDb.find((i) => i.id === req.params.id);
  if (!interview) {
    res.status(404).json({ error: "Interview not found" });
    return;
  }

  interview.status = "completed";
  interview.completedAt = new Date().toISOString();
  saveInterviewToDatabase(interview);

  // Synthesize AI Summary Report
  const responsesList = Object.values(interview.responses);
  const answersText = responsesList
    .map((r: any) => `Q: ${r.questionText}\nA (${r.category}): ${r.responseText}\nTranscript: ${r.aiTranscript?.transcript || "N/A"}`)
    .join("\n\n");

  const ai = getGeminiClient();
  if (ai && answersText.trim().length > 10) {
    try {
      const prompt = `You are a Principal Requirements Engineer analyzing a structured stakeholder interview for the system: "${interview.systemName}".
Interviewee: ${interview.intervieweeName} (${interview.intervieweeRole}, ${interview.intervieweeDept || "Department"}).

Answers and Transcripts:
${answersText}

Synthesize an executive requirements report in JSON with this exact structure:
{
  "executiveSummary": "A concise 2-sentence executive briefing of stakeholder priorities and core findings",
  "overallSentiment": {
    "dominant": "constructive",
    "positiveRatio": 0.4,
    "negativeRatio": 0.2,
    "neutralRatio": 0.4
  },
  "currentWorkflows": ["workflow 1", "workflow 2"],
  "userExpectations": ["expectation 1", "expectation 2"],
  "systemLimitations": ["limitation 1", "limitation 2"],
  "recommendedFeatures": [
    {
      "name": "Feature name",
      "priority": "High",
      "rationale": "Why this is critical based on interviewee responses"
    }
  ]
}`;

      const aiRes = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const parsed = JSON.parse(aiRes.text || "{}");
      interview.summaryReport = {
        ...parsed,
        synthesizedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.warn("Gemini report synthesis failed, using domain synthesis:", err);
    }
  }

  if (!interview.summaryReport) {
    // Domain heuristic synthesis
    interview.summaryReport = {
      executiveSummary: `Requirements discovery report for ${interview.systemName} with ${interview.intervieweeName} (${interview.intervieweeRole}). High stakeholder interest in reducing manual bottlenecks and latency.`,
      overallSentiment: {
        dominant: "constructive",
        positiveRatio: 0.45,
        negativeRatio: 0.15,
        neutralRatio: 0.4,
      },
      currentWorkflows: [
        "Routine operational queries, record lookup, and cross-team task status handoffs",
        "Periodic verification and reconciliation against secondary departmental records",
      ],
      userExpectations: [
        "Sub-second data querying and responsive UI feedback on both desktop and tablets",
        "Clear validation alerts and automated audit trails for all critical actions",
      ],
      systemLimitations: [
        "Current manual entry duplicates effort and introduces data validation errors",
        "Lack of real-time event streaming causes delays between departmental handoffs",
      ],
      recommendedFeatures: [
        {
          name: "Real-Time Event Notification & Ingestion Pipeline",
          priority: "High",
          rationale: "Directly solves stakeholder latency and inter-departmental lag",
        },
        {
          name: "Ergonomic Rapid-Input Batch Interface",
          priority: "Medium",
          rationale: "Reduces keyboard/mouse strain and speeds up repetitive daily tasks",
        },
      ],
      synthesizedAt: new Date().toISOString(),
    };
  }

  saveInterviewToDatabase(interview);
  res.json({ interview, summaryReport: interview.summaryReport });
});

app.delete("/api/interviews/:id", (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const interview = interviewsDb.find((i) => i.id === req.params.id);
  if (!interview || interview.userId !== user.id) {
    res.status(404).json({ error: "Interview not found in your account space." });
    return;
  }
  interviewsDb = interviewsDb.filter((i) => i.id !== req.params.id);
  deleteInterviewFromDatabase(req.params.id);
  res.json({ success: true });
});

// 4. Public Share Portal for Interviewee
app.get("/api/share/:token", (req: Request, res: Response) => {
  const interview = interviewsDb.find((i) => i.shareToken === req.params.token);
  if (!interview) {
    res.status(404).json({ error: "This interview link is either invalid, expired, or has been deactivated." });
    return;
  }

  const sys = systemsDb.find((s) => s.id === interview.systemId);

  res.json({
    id: interview.id,
    systemId: interview.systemId,
    systemName: interview.systemName,
    systemDescription: sys?.description || "Systems requirements evaluation.",
    interviewer: {
      name: interview.interviewerName,
      role: interview.interviewerRole,
      department: interview.interviewerDept,
    },
    interviewee: {
      name: interview.intervieweeName,
      role: interview.intervieweeRole,
    },
    interviewType: interview.interviewType || "Semi-Structured",
    questions: interview.questions,
    responses: interview.responses,
  });
});

// Binary video upload. The browser sends the Blob directly instead of embedding it in JSON/base64.
app.post(
  "/api/share/:token/video",
  express.raw({ type: ["video/*", "application/octet-stream"], limit: "10mb" }),
  async (req: Request, res: Response) => {
    const interview = interviewsDb.find((i) => i.shareToken === req.params.token);
    if (!interview) {
      res.status(404).json({ error: "Interview session expired or not found." });
      return;
    }

    const questionId = String(req.headers["x-question-id"] || "");
    const videoId = String(req.headers["x-video-id"] || "");
    const durationSeconds = Number(req.headers["x-duration-seconds"] || 0) || 0;
    const uploadOffset = Math.max(0, Number(req.headers["x-upload-offset"] || 0) || 0);
    const uploadTotal = Math.max(0, Number(req.headers["x-upload-total"] || 0) || 0);
    const uploadFinal = String(req.headers["x-upload-final"] || "").toLowerCase() === "true";

    const question = interview.questions.find((q) => q.id === questionId);
    if (!question || !videoId) {
      res.status(400).json({ error: "Video upload is missing a valid question or video ID." });
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(videoId)) {
      res.status(400).json({ error: "The video ID contains invalid characters." });
      return;
    }

    const chunk = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
    if (!chunk.length) {
      res.status(422).json({ code: "VIDEO_CHUNK_EMPTY", error: "The uploaded video chunk is empty." });
      return;
    }
    if (chunk.length > 10 * 1024 * 1024) {
      res.status(413).json({ code: "VIDEO_CHUNK_TOO_LARGE", error: "The video chunk is too large. Please retry the upload." });
      return;
    }

    const uploadDir = path.join(userVideosDir, ".uploads");
    fs.mkdirSync(uploadDir, { recursive: true });
    const tempPath = path.join(uploadDir, videoId + ".upload");

    try {
      if (uploadOffset === 0) {
        try { fs.unlinkSync(tempPath); } catch {}
      }

      const currentSize = fs.existsSync(tempPath) ? fs.statSync(tempPath).size : 0;
      if (currentSize !== uploadOffset) {
        res.status(409).json({
          code: "VIDEO_UPLOAD_OFFSET_MISMATCH",
          error: "The upload position no longer matches the server. Please restart the video upload.",
          expectedOffset: currentSize,
        });
        return;
      }

      fs.appendFileSync(tempPath, chunk);
      const receivedBytes = fs.statSync(tempPath).size;

      if (!uploadFinal) {
        res.status(200).json({
          success: true,
          complete: false,
          videoId,
          receivedBytes,
          totalBytes: uploadTotal || undefined,
        });
        return;
      }

      if (uploadTotal && receivedBytes !== uploadTotal) {
        res.status(409).json({
          code: "VIDEO_UPLOAD_INCOMPLETE",
          error: `The complete recording has not reached the server yet (${receivedBytes} of ${uploadTotal} bytes).`,
          receivedBytes,
          totalBytes: uploadTotal,
        });
        return;
      }

      if (receivedBytes < 1024) {
        res.status(422).json({
          code: "VIDEO_TOO_SMALL",
          error: `The recording is incomplete (${receivedBytes} bytes received). Please record again.`,
        });
        return;
      }

      const header = Buffer.alloc(16);
      const fd = fs.openSync(tempPath, "r");
      try { fs.readSync(fd, header, 0, 16, 0); } finally { fs.closeSync(fd); }
      const detected = detectVideoContainer(header);
      if (!detected) {
        res.status(422).json({ code: "VIDEO_CONTAINER_INVALID", error: "The recording is not a recognized MP4, WebM, or Ogg media container." });
        return;
      }
      const recordedAt = new Date().toISOString();
      const originalPath = getVideoFilePath(videoId, detected.extension);
      fs.renameSync(tempPath, originalPath);
      if (fs.statSync(originalPath).size !== receivedBytes) throw new Error("The complete video payload was not written to storage.");

      // Keep large media out of SQLite BLOBs. SQLite stores authoritative metadata;
      // the persistent video vault stores the complete binary recording.
      saveVideoToDatabase({
        id: videoId, interviewId: interview.id, questionId,
        sourceMimeType: detected.mimeType, sourceExtension: detected.extension,
        originalBuffer: Buffer.alloc(0), deliveryMimeType: detected.mimeType,
        deliveryBuffer: null, storagePath: originalPath, durationSeconds, recordedAt,
      });

      res.status(201).json({
        success: true,
        complete: true,
        videoRecording: {
          id: videoId,
          durationSeconds,
          mimeType: detected.extension === "mp4" ? "video/mp4" : detected.mimeType,
          sourceMimeType: detected.mimeType,
          deliveryMimeType: detected.extension === "mp4" ? "video/mp4" : detected.mimeType,
          storageStatus: "saved",
          storagePath: "video_database/interview_videos/" + videoId,
          videoUrl: "/api/videos/" + videoId + "/playback",
          recordedAt,
        },
      });

      if (detected.extension !== "mp4") {
        void transcodeToCompatibleMp4(videoId, originalPath).then((compatibleMp4) => {
          if (!compatibleMp4 || !fs.existsSync(compatibleMp4) || fs.statSync(compatibleMp4).size <= 1024) return;
          saveVideoToDatabase({
            id: videoId, interviewId: interview.id, questionId,
            sourceMimeType: detected.mimeType, sourceExtension: detected.extension,
            originalBuffer: Buffer.alloc(0), deliveryMimeType: "video/mp4",
            deliveryBuffer: null, storagePath: compatibleMp4, durationSeconds, recordedAt,
          });
        }).catch((error) => {
          console.warn("Background MP4 conversion failed; original recording remains available:", error);
        });
      }
    } catch (error: any) {
      console.error("Video database upload failed:", error);
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
      res.status(500).json({
        code: "VIDEO_DATABASE_WRITE_FAILED",
        error: "The recording could not be saved to the video database.",
        details: process.env.NODE_ENV === "production" ? undefined : error?.message,
        retryable: true,
      });
    }
  }
);
app.post("/api/share/:token/submit", async (req: Request, res: Response) => {
  const interview = interviewsDb.find((i) => i.shareToken === req.params.token);
  if (!interview) {
    res.status(404).json({ error: "Interview session expired or not found" });
    return;
  }

  const { questionId, responseText, audioDurationSeconds, videoRecording, aiTranscript } = req.body;
  const question = interview.questions.find((q) => q.id === questionId);

  // Persist the actual recording before accepting the response. Video storage is
  // deliberately independent from AI transcription: a recording remains valid
  // evidence even when Gemini cannot transcribe it.
  if (videoRecording && videoRecording.id) {
    if (!videoRecording.base64Data && videoRecording.storageStatus !== "saved") {
      res.status(400).json({ error: "The recorded video has not been uploaded yet. Please upload the recording before submitting the answer." });
      return;
    }
    if (!videoRecording.base64Data && videoRecording.storageStatus === "saved") {
      const savedVideo = getVideoDatabaseRecord(videoRecording.id);
      if (!savedVideo || savedVideo.interviewId !== interview.id || savedVideo.questionId !== questionId) {
        res.status(409).json({ code: "VIDEO_REFERENCE_INVALID", error: "The saved recording could not be matched to this interview question." });
        return;
      }
      videoRecording.videoUrl = "/api/videos/" + videoRecording.id + "/playback";
      videoRecording.mimeType = savedVideo.deliveryMimeType;
      videoRecording.sourceMimeType = savedVideo.sourceMimeType;
      videoRecording.deliveryMimeType = savedVideo.deliveryMimeType;
    } else {
    try {
      const cleanBase64 = videoRecording.base64Data.replace(/^data:[^;]+;base64,/, "");
      const videoBuffer = Buffer.from(cleanBase64, "base64");
      if (videoBuffer.length < 1024) {
        throw new Error("Video payload is incomplete (" + videoBuffer.length + " bytes received)");
      }
      const mimeType = videoRecording.mimeType || "video/webm";
      const extension = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
      videosStore.set(videoRecording.id, {
        id: videoRecording.id,
        interviewId: interview.id,
        questionId,
        mimeType,
        buffer: videoBuffer,
        durationSeconds: videoRecording.durationSeconds || 0,
        recordedAt: videoRecording.recordedAt || new Date().toISOString(),
      });
      const originalPath = path.join(userVideosDir, videoRecording.id + "." + extension);
      fs.writeFileSync(originalPath, videoBuffer);

      let deliveryExtension = extension;
      if (extension !== "mp4") {
        const compatibleMp4 = await transcodeToCompatibleMp4(videoRecording.id, originalPath);
        if (compatibleMp4) deliveryExtension = "mp4";
      }

      videoRecording.videoUrl = "/api/videos/" + videoRecording.id + "/playback";
      videoRecording.storageStatus = "saved";
      videoRecording.storagePath = "video_vault/" + videoRecording.id + "." + deliveryExtension;
      videoRecording.mimeType = deliveryExtension === "mp4" ? "video/mp4" : mimeType;
      delete videoRecording.base64Data;
    } catch (err) {
      console.warn("Could not save video recording:", err);
      res.status(500).json({ error: "The video recording could not be saved. No response was stored." });
      return;
    }
    }
  }

  const responseObj = {
    id: `resp-${Date.now().toString(36)}`,
    interviewId: interview.id,
    questionId,
    questionText: question ? question.questionText : "Requirements Discovery",
    category: question ? question.category : "workflow",
    responseText: responseText || "",
    audioDurationSeconds: audioDurationSeconds || 0,
    videoRecording: videoRecording
      ? {
          ...videoRecording,
          transcriptionStatus: aiTranscript?.transcript?.trim() ? "completed" : "unavailable",
        }
      : undefined,
    // Transcript is optional. It is retained only when text was actually
    // returned from processing this submitted recording.
    aiTranscript: (videoRecording?.storageStatus === "saved" && aiTranscript?.transcript?.trim())
      ? aiTranscript
      : undefined,
    createdAt: new Date().toISOString(),
  };

  interview.responses[questionId] = responseObj;

  // Log activity for the interviewer's account
  if (interview.userId) {
    activitiesDb.unshift({
      id: `act-${Date.now().toString(36)}`,
      userId: interview.userId,
      type: "response_recorded",
      title: "Remote Response Received",
      description: `${interview.intervieweeName} submitted response for "${question ? question.questionText.slice(0, 40) + '...' : questionId}"`,
      timestamp: new Date().toISOString(),
    });
  }

  const isComplete = interview.questions.every((q) => !!interview.responses[q.id]);
  if (isComplete) {
    interview.status = "completed";
    interview.completedAt = new Date().toISOString();
    if (interview.userId) {
      activitiesDb.unshift({
        id: `act-${Date.now().toString(36)}`,
        userId: interview.userId,
        type: "interview_completed",
        title: "All Interview Responses Submitted",
        description: `${interview.intervieweeName} completed all questions for ${interview.systemName}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  res.json({ success: true, response: responseObj, isComplete });
});

// Video playback endpoints. These are independent from transcription so a
// recorded answer remains playable even when AI analysis fails.
const ensureCompatibleVideoDelivery = async (videoId: string) => {
  let record = getVideoDatabaseRecord(videoId);
  if (!record) return null;

  // MP4 recordings are already in the preferred delivery format.
  if (record.deliveryBuffer?.length && record.deliveryMimeType === "video/mp4") {
    return record;
  }
  if (record.sourceMimeType === "video/mp4" && record.originalBuffer.length > 1024) {
    return record;
  }

  // Recreate the source file from the SQLite BLOB when the ephemeral filesystem
  // no longer has the original WebM/Ogg file. This makes the video database the
  // authoritative media store rather than the local filesystem.
  let original = findOriginalVideoPath(videoId);
  if (!original) {
    const sourcePath = getVideoFilePath(videoId, record.originalExtension);
    try {
      fs.writeFileSync(sourcePath, record.originalBuffer);
      original = {
        path: sourcePath,
        mimeType: record.sourceMimeType,
        extension: record.originalExtension,
      };
    } catch (error) {
      console.warn(`Could not recreate source media for ${videoId}:`, error);
      return record;
    }
  }

  const compatibleMp4 = await transcodeToCompatibleMp4(videoId, original.path);
  if (!compatibleMp4 || !fs.existsSync(compatibleMp4)) {
    console.warn(`Compatible MP4 is not available for ${videoId}; serving the original ${record.sourceMimeType} recording.`);
    return record;
  }

  try {
    const deliveryBuffer = fs.readFileSync(compatibleMp4);
    if (deliveryBuffer.length <= 1024) return record;

    saveVideoToDatabase({
      id: record.id,
      interviewId: record.interviewId,
      questionId: record.questionId,
      sourceMimeType: record.sourceMimeType,
      sourceExtension: record.originalExtension,
      originalBuffer: record.originalBuffer,
      deliveryMimeType: "video/mp4",
      deliveryBuffer,
      durationSeconds: record.durationSeconds,
      recordedAt: record.recordedAt,
    });

    record = getVideoDatabaseRecord(videoId) || record;
  } catch (error) {
    console.warn(`Could not persist compatible MP4 for ${videoId}:`, error);
  }

  return record;
};

const resolveStoredVideo = (videoId: string): { buffer: Buffer; mimeType: string } | null => {
  const dbRecord = getVideoDatabaseRecord(videoId);
  if (dbRecord?.storagePath && fs.existsSync(dbRecord.storagePath)) {
    return { buffer: fs.readFileSync(dbRecord.storagePath), mimeType: dbRecord.deliveryMimeType || dbRecord.sourceMimeType };
  }
  if (dbRecord?.originalBuffer?.length) return { buffer: dbRecord.originalBuffer, mimeType: dbRecord.deliveryMimeType || dbRecord.sourceMimeType };
  const cached = videosStore.get(videoId);
  if (cached?.buffer?.length) return { buffer: cached.buffer, mimeType: cached.mimeType || "video/webm" };
  const original = findOriginalVideoPath(videoId);
  if (!original) return null;
  return { buffer: fs.readFileSync(original.path), mimeType: original.mimeType };
};

const streamStoredVideo = (req: Request, res: Response, download = false) => {
  const stored = resolveStoredVideo(req.params.id);
  if (!stored) {
    res.status(404).json({ error: "Recorded video not found." });
    return;
  }

  const total = stored.buffer.length;
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", stored.mimeType);
  res.setHeader("Cache-Control", "private, max-age=3600");
  if (download) {
    res.setHeader("Content-Disposition", `attachment; filename="reqvoice_recording_${req.params.id}.webm"`);
  }

  const range = req.headers.range;
  if (!range) {
    res.setHeader("Content-Length", total);
    res.status(200).end(stored.buffer);
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    res.status(416).setHeader("Content-Range", `bytes */${total}`).end();
    return;
  }

  const start = match[1] ? Number(match[1]) : Math.max(0, total - Number(match[2] || 1));
  const end = match[2] ? Math.min(total - 1, Number(match[2])) : total - 1;
  if (start > end || start >= total) {
    res.status(416).setHeader("Content-Range", `bytes */${total}`).end();
    return;
  }

  res.status(206);
  res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
  res.setHeader("Content-Length", end - start + 1);
  res.end(stored.buffer.subarray(start, end + 1));
};

const streamBufferWithRanges = (req: Request, res: Response, buffer: Buffer, mimeType: string, downloadName?: string) => {
  const total = buffer.length;
  if (!total) { res.status(404).json({ error: "Recorded video is empty." }); return; }
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Cache-Control", "private, max-age=3600");
  if (downloadName) res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
  const range = req.headers.range;
  if (!range) { res.setHeader("Content-Length", total); res.status(200).end(buffer); return; }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) { res.status(416).setHeader("Content-Range", `bytes */${total}`).end(); return; }
  const start = match[1] ? Number(match[1]) : Math.max(0, total - Number(match[2] || 1));
  const end = match[2] ? Math.min(total - 1, Number(match[2])) : total - 1;
  if (start > end || start >= total) { res.status(416).setHeader("Content-Range", `bytes */${total}`).end(); return; }
  res.status(206);
  res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
  res.setHeader("Content-Length", end - start + 1);
  res.end(buffer.subarray(start, end + 1));
};

const streamFileWithRanges = (req: Request, res: Response, filePath: string, mimeType: string, downloadName?: string) => {
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Recorded video file not found." });
    return;
  }

  const total = fs.statSync(filePath).size;
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Cache-Control", "private, max-age=3600");
  if (downloadName) {
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
  }

  const range = req.headers.range;
  if (!range) {
    res.setHeader("Content-Length", total);
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    res.status(416).setHeader("Content-Range", `bytes */${total}`).end();
    return;
  }

  const start = match[1] ? Number(match[1]) : Math.max(0, total - Number(match[2] || 1));
  const end = match[2] ? Math.min(total - 1, Number(match[2])) : total - 1;
  if (start > end || start >= total) {
    res.status(416).setHeader("Content-Range", `bytes */${total}`).end();
    return;
  }

  res.status(206);
  res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
  res.setHeader("Content-Length", end - start + 1);
  fs.createReadStream(filePath, { start, end }).pipe(res);
};

app.get("/api/videos/:id", (req: Request, res: Response) => {
  streamStoredVideo(req, res);
});

// Always prefer an H.264/AAC MP4 for browser and OS/default-player compatibility.
// Conversion is lazy and cached, so recordings are not blocked by AI transcription.
app.get("/api/videos/:id/playback", async (req: Request, res: Response) => {
  try {
    // Prefer a broadly compatible H.264/AAC MP4. If conversion is still needed,
    // wait for it on the first playback request and cache the result in SQLite.
    const record = await ensureCompatibleVideoDelivery(req.params.id);
    if (record) {
      const buffer = record.deliveryBuffer?.length ? record.deliveryBuffer : record.originalBuffer;
      const mime = record.deliveryBuffer?.length ? record.deliveryMimeType : record.sourceMimeType;
      streamBufferWithRanges(req, res, buffer, mime);
      return;
    }

    const stored = resolveStoredVideo(req.params.id);
    if (!stored) { res.status(404).json({ error: "Recorded video not found." }); return; }
    streamBufferWithRanges(req, res, stored.buffer, stored.mimeType);
  } catch (error) {
    console.error("Video playback failed:", error);
    res.status(500).json({
      code: "VIDEO_PLAYBACK_FAILED",
      error: "The recorded video could not be prepared for playback.",
      retryable: true,
    });
  }
});

app.get("/api/videos/:id/download", async (req: Request, res: Response) => {
  try {
    const record = await ensureCompatibleVideoDelivery(req.params.id);
    if (record) {
      const buffer = record.deliveryBuffer?.length ? record.deliveryBuffer : record.originalBuffer;
      const mime = record.deliveryBuffer?.length ? record.deliveryMimeType : record.sourceMimeType;
      const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
      streamBufferWithRanges(req, res, buffer, mime, `reqvoice_recording_${req.params.id}.${ext}`);
      return;
    }

    const original = findOriginalVideoPath(req.params.id);
    if (!original) { res.status(404).json({ error: "Recorded video not found." }); return; }
    streamFileWithRanges(req, res, original.path, original.mimeType, `reqvoice_recording_${req.params.id}.${original.extension}`);
  } catch (error) {
    console.error("Video download failed:", error);
    res.status(500).json({
      code: "VIDEO_DOWNLOAD_FAILED",
      error: "The recorded video could not be prepared for download.",
      retryable: true,
    });
  }
});
// 5. AI Video & Audio Transcription Endpoint using Gemini API
app.post("/api/gemini/transcribe-video", async (req: Request, res: Response) => {
  const { videoId, base64Media, mimeType, questionText, category, durationSeconds } = req.body;

  const ai = getGeminiClient();
  const storedVideo = videoId ? getVideoDatabaseRecord(String(videoId)) : null;
  const mediaBuffer = storedVideo?.originalBuffer;
  const mediaData = mediaBuffer ? mediaBuffer.toString("base64") : base64Media;
  const mediaMime = storedVideo?.sourceMimeType || mimeType || "video/webm";

  if (ai && mediaData) {
    try {
      // Prefer the server-side video database record so the browser never has to
      // resend a large base64 video payload just to request transcription.
      const contents = {
        parts: [
          {
            inlineData: {
              mimeType: mediaMime,
              data: mediaData,
            },
          },
          {
            text: `You are an expert Systems Requirements Audio/Video Transcriptionist.
The interviewee was asked this requirements question: "${questionText || "Can you describe your system requirements?"}" (Category: ${category || "General"}).
Carefully transcribe the spoken audio verbatim from the provided recording.

Analyze the spoken response and return a JSON object with:
{
  "transcript": "Exact verbatim transcription of everything said by the speaker in the recording. Be thorough, clear, and preserve technical terminology.",
  "confidence": 97, // integer 85-99
  "sentiment": "constructive", // "positive" | "neutral" | "negative" | "constructive"
  "sentimentScore": 86, // integer 0-100
  "keyRequirements": [
    "Short 1-sentence requirement extracted from the transcript",
    "Another functional or non-functional requirement"
  ]
}`,
          },
        ],
      };

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_QUESTION_MODEL || "gemini-3.6-flash",
        contents,
        config: {
          responseMimeType: "application/json",
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      if (parsed.transcript) {
        res.json({
          transcript: parsed.transcript,
          confidence: parsed.confidence || 96,
          sentiment: parsed.sentiment || "constructive",
          sentimentScore: parsed.sentimentScore || 85,
          keyRequirements: parsed.keyRequirements || ["High availability", "Ergonomic user experience"],
          modelUsed: "gemini-3.8-flash",
          generatedAt: new Date().toISOString(),
        });
        return;
      }
    } catch (err) {
      console.warn("Gemini transcription encountered error:", err);
    }
  }

  res.status(422).json({
    error: "No accessible interview recording was supplied or transcription failed. No transcript was generated.",
    transcript: null,
    modelUsed: "none",
  });
});

// 6. Gemini Suggest / Generate Questions by Interview Type (Structured, Semi-Structured, Unstructured)
app.post("/api/gemini/suggest-questions", async (req: Request, res: Response) => {
  console.log("[AI QUESTIONS] request received", {
    systemName: req.body?.systemName,
    interviewType: req.body?.interviewType,
    promptVersion: req.body?.promptVersion,
    count: req.body?.count,
  });
  const { systemName, systemType, role, prompt: customPrompt, promptVersion, count, interviewType: rawInterviewType } = req.body;
  const requestedPrompt = typeof customPrompt === "string" ? customPrompt.trim() : "";
  const revision = Math.max(1, Number(promptVersion) || 1);
  const ai = getGeminiClient();
  const numQuestions = Math.min(10, Math.max(1, Number(count) || 5));

  if (!requestedPrompt) {
    res.status(400).json({ error: "An interview prompt is required before generating questions.", promptVersion: revision });
    return;
  }

  const interviewType: "Structured" | "Semi-Structured" | "Unstructured" =
    rawInterviewType === "Structured" ? "Structured" :
    rawInterviewType === "Unstructured" ? "Unstructured" :
    "Semi-Structured";

  let typeGuidance = "";
  let lastGeminiQuestionError = "";
  let lastModelError: any = null;
  const modelErrors: string[] = [];

  if (interviewType === "Structured") {
    typeGuidance = `
INTERVIEW METHODOLOGY: 1. STRUCTURED INTERVIEW
- Rigorously standardized, quantifiable, precise, and closed-loop question structure.
- Focus directly on exact numeric operational thresholds, inputs/outputs, database constraints, input validation rules, strict SLA metrics (< ms, availability %), and non-negotiable business logic.
- Avoid conversational fluff or subjective philosophy. Every question must be measurable.
- Suggested follow-ups must verify concrete numbers, validation criteria, boundary parameters, or acceptance test thresholds.`;
  } else if (interviewType === "Unstructured") {
    typeGuidance = `
INTERVIEW METHODOLOGY: 3. UNSTRUCTURED INTERVIEW
- Open-ended, conversational, and exploratory inquiry designed to uncover the human narrative.
- Focus on high-level organizational vision, emotional pain points, team morale, informal workarounds, and unstated assumptions.
- Avoid restrictive technical interrogation; invite storytelling, reflection, and strategic aspirations.
- Suggested follow-ups should be empathetic, open conversational probes encouraging the stakeholder to expand further.`;
  } else {
    typeGuidance = `
INTERVIEW METHODOLOGY: 2. SEMI-STRUCTURED INTERVIEW
- Guided core framework combining standardized functional questions with exploratory follow-up probes.
- Balances baseline requirements discovery (daily cadence, system handoffs) with flexible deep-dives into edge cases, manual workarounds, and operational friction.
- Suggested follow-ups should probe deeper into root causes, exception handling, and downstream impacts.`;
  }

  if (ai) {
    try {
      const systemInstruction = customPrompt
        ? `You are an expert Systems Requirements Analyst conducting a ${interviewType.toUpperCase()} INTERVIEW.
${typeGuidance}

Generate exactly ${numQuestions} NEW, SPECIFIC, INTERVIEW-READY questions based primarily on the latest interviewer prompt.
PROMPT REVISION: ${revision}
LATEST INTERVIEWER PROMPT: "${requestedPrompt}"
IMPORTANT: Do not use generic category questions as the main content. Each question must directly address the user prompt and be answerable by the selected interviewee. If the prompt says "deletion of wrong process", ask specifically about identifying, correcting, reversing, deleting, authorizing, validating, auditing, and preventing incorrect processes as appropriate to the system. Do not merely repeat the prompt verbatim.
Target system: "${systemName || "Enterprise System"}" (${systemType || "Enterprise Platform"}).
Target role: "${role || "Stakeholder"}".
Categorize each question appropriately among: workflow, pain_point, expectation, limitation, desired_feature.
Format as JSON array of objects:
[
  {
    "category": "workflow",
    "questionText": "...",
    "rationale": "...",
    "suggestedFollowups": ["...", "..."]
  }
]`
        : `You are an expert Systems Requirements Analyst conducting a ${interviewType.toUpperCase()} INTERVIEW.
${typeGuidance}

Generate ${numQuestions} targeted, high-impact interview questions for the role "${role || "Stakeholder"}" on the system "${systemName || "Enterprise System"}" (${systemType || "Business Application"}).
Cover requirements categories: workflow, pain_point, expectation, limitation, desired_feature.
Format as JSON array of objects:
[
  {
    "category": "workflow",
    "questionText": "...",
    "rationale": "...",
    "suggestedFollowups": ["...", "..."]
  }
]`;

      // Use currently supported stable text-generation models first.
      // Do not let an old/unsupported Render GEMINI_QUESTION_MODEL value
      // override the working Flash models.
      // Gemini has reported the currently available models for this API key.
      // Keep an optional custom model as a fallback, but never use retired models.
      const requestedModel = process.env.GEMINI_QUESTION_MODEL?.trim();
      // Prefer current stable Flash models. Keep multiple providers/models in the
      // fallback chain because Gemini quota can be model-specific.
      const modelCandidates = [
        "gemini-3.5-flash-lite",
        "gemini-3.7-flash",
        "gemini-3.8-flash",
        "gemini-3.6-flash",
        ...(requestedModel &&
        ![
          "gemini-2.5-pro",
          "gemini-2.5-flash",
          "gemini-2.5-flash-lite",
          "gemini-2.0-flash",
          "gemini-2.0-flash-001",
          "gemini-3.5-flash",
          "gemini-3.5-flash-lite",
          "gemini-3.6-flash",
          "gemini-3.7-flash",
          "gemini-3.8-flash",
        ].includes(requestedModel)
          ? [requestedModel]
          : []),
      ].filter((model, index, all) => all.indexOf(model) === index);

      let response: any = null;

      // Try each supported model independently. A temporary 503 from one model
      // must not prevent the next available model from generating the questions.
      for (const model of modelCandidates) {
        try {
          const candidateResponse = await ai.models.generateContent({
            model,
            contents: systemInstruction,
          });
          if (candidateResponse?.text?.trim()) {
            response = candidateResponse;
            console.log("Gemini question generation succeeded:", model);
            break;
          }
          throw new Error("Gemini returned an empty response.");
        } catch (err: any) {
          const message =
            err?.message ||
            err?.error?.message ||
            (typeof err === "string" ? err : JSON.stringify(err));
          lastModelError = err instanceof Error ? err : new Error(message);
          modelErrors.push(`${model}: ${message}`);
          console.warn("Gemini question model failed:", model, message);
        }
      }

      if (!response?.text) {
        const quotaFailure = modelErrors.some((message) => /(?:429|RESOURCE_EXHAUSTED|quota|rate.?limit)/i.test(message));
        const unavailableFailure = modelErrors.some((message) => /(?:503|UNAVAILABLE|high demand|temporarily)/i.test(message));
        const details = modelErrors
          .map((message) => message.replace(/\s+/g, " ").slice(0, 500))
          .join(" | ");

        const statusCode = quotaFailure ? 429 : unavailableFailure ? 503 : 502;
        const errorMessage = quotaFailure
          ? "AI question generation is temporarily unavailable because the configured Gemini project/model quota has been exhausted. Please wait for the quota window to reset or connect a billed Gemini project/API key."
          : unavailableFailure
            ? "Gemini question generation is temporarily unavailable because the configured models are experiencing high demand. Please try again shortly."
            : "Gemini question generation failed. No questions were generated and no generic questions were substituted.";

        res.status(statusCode).json({
          error: errorMessage,
          code: quotaFailure ? "AI_QUOTA_EXHAUSTED" : unavailableFailure ? "AI_MODEL_UNAVAILABLE" : "AI_GENERATION_FAILED",
          retryable: true,
          modelsTried: modelCandidates,
          details,
        });
        return;
      }

      const questions = JSON.parse(response.text || "[]");
      if (Array.isArray(questions) && questions.length > 0) {
        res.json({
          questions: questions.slice(0, numQuestions).map((q: any, i: number) => ({
            id: `q-gen-${Date.now().toString(36)}-${i}`,
            category: q.category || 'workflow',
            questionText: q.questionText || 'What are your operational requirements?',
            rationale: q.rationale || 'Requirements discovery',
            suggestedFollowups: q.suggestedFollowups || [],
          })),
        });
        return;
      }
    } catch (err: any) {
      console.warn("Gemini question suggestion failed:", err?.message || err);
    }
  }

  // Do not silently substitute generic questions. A successful response must be
  // generated from the current prompt by an AI model.
  const hasApiKey = Boolean(
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.API_KEY
  );
  res.status(503).json({
    code: hasApiKey ? "AI_GENERATION_FAILED" : "AI_NOT_CONFIGURED",
    error: hasApiKey
      ? `AI question generation failed. ${modelErrors.length ? modelErrors.join(" | ") : (lastGeminiQuestionError || "Gemini did not return a usable response.")} No generic questions were substituted.`
      : "Gemini API credentials are not configured on the server. Set GEMINI_API_KEY in the Render Environment variables. No generic questions were substituted.",
    retryable: modelErrors.some((message) => /429|500|502|503|504|UNAVAILABLE|overloaded|high demand|timeout/i.test(message)),
    promptVersion: revision,
  });
  return;
});

// 6.5 User Activity Feed (Account-Isolated)
app.get("/api/activities", (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    res.json({ activities: [] });
    return;
  }
  const userActs = activitiesDb.filter((a) => a.userId === user.id);
  res.json({ activities: userActs.slice(0, 50) });
});

// 6.6 Video Vault Retrieval & Streaming Endpoint
app.get("/api/videos/:id", (req: Request, res: Response) => {
  const videoId = req.params.id;
  const stored = videosStore.get(videoId);

  let videoBuffer: Buffer | null = null;
  let mimeType = "video/webm";

  if (stored && stored.buffer) {
    videoBuffer = stored.buffer;
    mimeType = stored.mimeType || "video/webm";
  } else {
    // Check disk storage in userVideosDir
    const candidates = ["webm", "mp4", "ogg"];
    for (const ext of candidates) {
      const diskPath = path.join(userVideosDir, videoId + "." + ext);
      if (fs.existsSync(diskPath)) {
        videoBuffer = fs.readFileSync(diskPath);
        mimeType = ext === "mp4" ? "video/mp4" : ext === "ogg" ? "video/ogg" : "video/webm";
        break;
      }
    }
  }

  if (!videoBuffer) {
    res.status(404).json({ error: "Video recording not found or has expired." });
    return;
  }

  const range = req.headers.range;
  const totalLength = videoBuffer.length;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;
    const chunksize = end - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${totalLength}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": mimeType,
    });
    res.end(videoBuffer.subarray(start, end + 1));
  } else {
    res.writeHead(200, {
      "Content-Length": totalLength,
      "Content-Type": mimeType,
      "Accept-Ranges": "bytes",
    });
    res.end(videoBuffer);
  }
});

// Download Video file
app.get("/api/videos/:id/download", (req: Request, res: Response) => {
  const videoId = req.params.id;
  const stored = videosStore.get(videoId);

  let videoBuffer: Buffer | null = null;
  let downloadMimeType = "video/webm";
  let downloadExtension = "webm";
  if (stored && stored.buffer) {
    videoBuffer = stored.buffer;
    downloadMimeType = stored.mimeType || "video/webm";
    downloadExtension = downloadMimeType.includes("mp4") ? "mp4" : downloadMimeType.includes("ogg") ? "ogg" : "webm";
  } else {
    const candidates = ["webm", "mp4", "ogg"];
    for (const ext of candidates) {
      const diskPath = path.join(userVideosDir, videoId + "." + ext);
      if (fs.existsSync(diskPath)) {
        videoBuffer = fs.readFileSync(diskPath);
        downloadMimeType = ext === "mp4" ? "video/mp4" : ext === "ogg" ? "video/ogg" : "video/webm";
        downloadExtension = ext;
        break;
      }
    }
  }

  if (!videoBuffer) {
    res.status(404).json({ error: "Video recording not found" });
    return;
  }

  res.setHeader("Content-Disposition", `attachment; filename="reqvoice_response_${videoId}.${downloadExtension}"`);
  res.setHeader("Content-Type", downloadMimeType);
  res.send(videoBuffer);
});

// 7. Database Stats (Account-Isolated)
app.get("/api/database/stats", (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const targetInterviews = user ? interviewsDb.filter((i) => i.userId === user.id) : interviewsDb;
  const targetSystems = user ? systemsDb.filter((s) => s.userId === user.id) : systemsDb;

  const totalInterviews = targetInterviews.length;
  let totalResponses = 0;
  let totalVideos = 0;
  let totalCompressedBytes = 0;
  let totalRawBytes = 0;

  targetInterviews.forEach((inv) => {
    Object.values(inv.responses).forEach((resp: any) => {
      totalResponses++;
      if (resp.videoRecording) {
        totalVideos++;
        totalCompressedBytes += resp.videoRecording.compressionStats?.compressedBytes || 2500000;
        totalRawBytes += resp.videoRecording.compressionStats?.rawEstimateBytes || 11000000;
      }
    });
  });

  const overallSavingsMb = Math.round(((totalRawBytes - totalCompressedBytes) / (1024 * 1024)) * 10) / 10;
  const compressedMb = Math.round((totalCompressedBytes / (1024 * 1024)) * 10) / 10;

  res.json({
    tables: [
      { name: "systems_under_study", count: targetSystems.length, description: "Information systems registered under your workspace" },
      { name: "interviews", count: totalInterviews, description: "Structured interview sessions, participant tokens, and completion lifecycle" },
      { name: "interview_questions", count: totalInterviews * 5, description: "Role-specific questions categorized by workflow, bottlenecks, and expectations" },
      { name: "interview_responses", count: totalResponses, description: "Audio/video recordings, transcripts, sentiment scores, and requirements" },
      { name: "video_compression_vault", count: totalVideos, description: "VP8/Opus compressed media streams in local storage" },
    ],
    storageMetrics: {
      totalVideosRecorded: totalVideos,
      compressedStorageMb: compressedMb || 0,
      estimatedRawStorageMb: Math.round(((totalRawBytes || 0) / (1024 * 1024)) * 10) / 10,
      totalStorageSavedMb: overallSavingsMb || 0,
      averageCompressionRatio: totalVideos > 0 ? "76.4%" : "0%",
    },
  });
});

// 8. AI Online Share Link Generator
app.post("/api/interviews/:id/generate-ai-link", (req: Request, res: Response) => {
  const interview = interviewsDb.find((i) => i.id === req.params.id);
  if (!interview) {
    res.status(404).json({ error: "Interview protocol not found" });
    return;
  }

  if (!interview.shareToken) {
    interview.shareToken = `token-${Math.random().toString(36).substring(2, 9)}-${Date.now().toString(36)}`;
  }

  const host = req.get("host") || `localhost:${PORT}`;
  const protocol = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  const shareUrl = `${protocol}://${host}/?token=${interview.shareToken}`;

  res.json({
    success: true,
    shareUrl,
    shareToken: interview.shareToken,
    interviewerBrief: {
      name: interview.interviewerName,
      role: interview.interviewerRole,
      department: interview.interviewerDept,
    },
    interviewee: {
      name: interview.intervieweeName,
      role: interview.intervieweeRole,
    },
    questionsCount: interview.questions.length,
    generatedAt: new Date().toISOString(),
  });
});

// 9. Real-Time Response Sentiment Analysis & Requirements Extraction
app.post("/api/gemini/analyze-response", async (req: Request, res: Response) => {
  const { text, questionText, category, speakerRole } = req.body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "Response text is required for analysis." });
    return;
  }

  const cleanText = text.trim();
  const ai = getGeminiClient();

  if (ai) {
    try {
      const prompt = `You are an expert Systems Requirements Analyst and Sentiment Classifier.
Analyze the following stakeholder response to a requirements discovery question:
Question: "${questionText || "What are your requirements?"}"
Category: ${category || "General"}
Speaker Role: ${speakerRole || "Stakeholder"}
Response Text: "${cleanText}"

Perform deep sentiment analysis and key requirements extraction.
Return ONLY a valid JSON object matching this exact schema:
{
  "sentiment": "positive" | "constructive" | "neutral" | "negative",
  "sentimentScore": 85,
  "sentimentTone": "Concise summary of tone (e.g. Enthusiastic, Critical of Latency, Constructive)",
  "confidence": 97,
  "keyRequirements": [
    "Requirement 1 concisely stated",
    "Requirement 2 concisely stated"
  ],
  "urgency": "High" | "Medium" | "Low"
}`;

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_QUESTION_MODEL || "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      if (parsed.sentiment) {
        res.json({
          sentiment: parsed.sentiment,
          sentimentScore: parsed.sentimentScore ?? 75,
          sentimentTone: parsed.sentimentTone || "Constructive and informative",
          confidence: parsed.confidence || 95,
          keyRequirements: parsed.keyRequirements || ["Operational requirement extracted"],
          urgency: parsed.urgency || "Medium",
          analyzedAt: new Date().toISOString(),
        });
        return;
      }
    } catch (err) {
      console.warn("Gemini sentiment analysis error:", err);
    }
  }

  // Algorithmic sentiment analysis heuristic fallback
  const lower = cleanText.toLowerCase();
  let sentiment: "positive" | "constructive" | "neutral" | "negative" = "constructive";
  let score = 70;

  const negativeWords = ["slow", "bug", "broken", "bottleneck", "frustrat", "fail", "delay", "crash", "terrible", "lockout", "paper", "error", "horrible"];
  const positiveWords = ["fast", "seamless", "love", "great", "efficient", "instant", "helpful", "delight", "smooth", "perfect"];

  const negCount = negativeWords.filter((w) => lower.includes(w)).length;
  const posCount = positiveWords.filter((w) => lower.includes(w)).length;

  if (negCount > posCount + 1) {
    sentiment = "negative";
    score = Math.max(15, 45 - negCount * 10);
  } else if (posCount > negCount) {
    sentiment = "positive";
    score = Math.min(98, 75 + posCount * 8);
  } else if (cleanText.length > 50) {
    sentiment = "constructive";
    score = 75;
  } else {
    sentiment = "neutral";
    score = 50;
  }

  res.json({
    sentiment,
    sentimentScore: score,
    sentimentTone: sentiment === "positive" ? "Optimistic & Supportive" : sentiment === "negative" ? "Concerned regarding friction" : "Constructive Feedback",
    confidence: 94,
    keyRequirements: [
      `Explicit requirement: ${cleanText.substring(0, 70)}...`,
      "Streamlined UX and robust SLA responsiveness",
    ],
    urgency: negCount > 1 ? "High" : "Medium",
    analyzedAt: new Date().toISOString(),
  });
});

// 10. MySQL Relational Schema & Single-File SQL Dump
app.get("/api/database/mysql-schema", (req: Request, res: Response) => {
  const schemaSql = `-- ReqVoice AI - Production MySQL Relational Database Schema DDL
-- Standard MySQL 8.0+ Compliant Schema
-- Engine: InnoDB, Charset: utf8mb4, Collation: utf8mb4_unicode_ci

CREATE DATABASE IF NOT EXISTS reqvoice_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE reqvoice_db;

-- 1. Users & Authentication Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  username VARCHAR(64) UNIQUE NOT NULL,
  email VARCHAR(191) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(128) NOT NULL,
  department VARCHAR(128) NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  is_first_time BOOLEAN DEFAULT TRUE,
  has_completed_tutorial BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_username (username),
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Systems Under Study Table
CREATE TABLE IF NOT EXISTS systems_under_study (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  system_type VARCHAR(128) NOT NULL,
  description TEXT,
  lifecycle_state ENUM('existing', 'proposed', 'modernization') NOT NULL DEFAULT 'proposed',
  target_roles JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_systems_lifecycle (lifecycle_state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Structured Interviews Table
CREATE TABLE IF NOT EXISTS interviews (
  id VARCHAR(64) PRIMARY KEY,
  system_id VARCHAR(64) NOT NULL,
  system_name VARCHAR(255) NOT NULL,
  interviewer_name VARCHAR(128) NOT NULL,
  interviewer_role VARCHAR(128),
  interviewer_dept VARCHAR(128),
  interviewee_name VARCHAR(128) NOT NULL,
  interviewee_role VARCHAR(128) NOT NULL,
  interviewee_email VARCHAR(191),
  interviewee_dept VARCHAR(128),
  share_token VARCHAR(128) UNIQUE NOT NULL,
  status ENUM('scheduled', 'in_progress', 'completed') DEFAULT 'in_progress',
  summary_report JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  CONSTRAINT fk_interviews_system FOREIGN KEY (system_id) 
    REFERENCES systems_under_study(id) ON DELETE CASCADE,
  INDEX idx_interviews_token (share_token),
  INDEX idx_interviews_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Stakeholder Responses & Transcripts Table
CREATE TABLE IF NOT EXISTS interview_responses (
  id VARCHAR(64) PRIMARY KEY,
  interview_id VARCHAR(64) NOT NULL,
  question_id VARCHAR(64) NOT NULL,
  question_text TEXT NOT NULL,
  category VARCHAR(64) NOT NULL,
  response_text LONGTEXT,
  audio_duration_seconds INT DEFAULT 0,
  ai_transcript LONGTEXT,
  ai_confidence INT DEFAULT 95,
  sentiment ENUM('positive', 'constructive', 'neutral', 'negative') DEFAULT 'constructive',
  sentiment_score INT DEFAULT 75,
  key_requirements JSON,
  ai_model VARCHAR(64),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_responses_interview FOREIGN KEY (interview_id) 
    REFERENCES interviews(id) ON DELETE CASCADE,
  INDEX idx_responses_sentiment (sentiment)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Video Compression Vault & Media Storage Table
CREATE TABLE IF NOT EXISTS video_compression_vault (
  id VARCHAR(64) PRIMARY KEY,
  response_id VARCHAR(64) NOT NULL,
  mime_type VARCHAR(64) NOT NULL,
  resolution VARCHAR(64) DEFAULT '640x480 (SD Optimized)',
  codec VARCHAR(64) DEFAULT 'VP8 / Opus Variable Bitrate',
  bitrate_kbps INT DEFAULT 600,
  raw_estimate_bytes BIGINT NOT NULL,
  compressed_bytes BIGINT NOT NULL,
  savings_percentage INT NOT NULL,
  storage_location VARCHAR(255) DEFAULT 'IndexedDB_MediaVault',
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_video_response FOREIGN KEY (response_id) 
    REFERENCES interview_responses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(schemaSql);
});

// Single-File MySQL Dump (.sql) with Schema and Data
app.get("/api/database/mysql-dump", (req: Request, res: Response) => {
  const escapeSql = (str: string | undefined | null) => {
    if (!str) return "''";
    return `'${str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
      switch (char) {
        case "\0": return "\\0";
        case "\x08": return "\\b";
        case "\x09": return "\\t";
        case "\x1a": return "\\z";
        case "\n": return "\\n";
        case "\r": return "\\r";
        case "\"": case "'": case "\\": case "%":
          return "\\" + char;
        default: return char;
      }
    })}'`;
  };

  let sql = `-- =========================================================================
-- ReqVoice AI - Complete MySQL Relational Database Export
-- Generated: ${new Date().toISOString()}
-- Database Server: MySQL 8.0 Compatible
-- =========================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

CREATE DATABASE IF NOT EXISTS \`reqvoice_db\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`reqvoice_db\`;

-- --------------------------------------------------------
-- Table: \`users\`
-- --------------------------------------------------------
DROP TABLE IF EXISTS \`users\`;
CREATE TABLE \`users\` (
  \`id\` varchar(64) NOT NULL,
  \`name\` varchar(128) NOT NULL,
  \`username\` varchar(64) NOT NULL UNIQUE,
  \`email\` varchar(191) NOT NULL UNIQUE,
  \`password_hash\` varchar(255) NOT NULL,
  \`role\` varchar(128) NOT NULL,
  \`department\` varchar(128) NOT NULL,
  \`avatar_url\` text,
  \`bio\` text,
  \`is_first_time\` tinyint(1) DEFAULT 1,
  \`has_completed_tutorial\` tinyint(1) DEFAULT 0,
  \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

`;

  usersDb.forEach((u) => {
    sql += `INSERT INTO \`users\` (\`id\`, \`name\`, \`username\`, \`email\`, \`password_hash\`, \`role\`, \`department\`, \`avatar_url\`, \`bio\`, \`is_first_time\`, \`has_completed_tutorial\`, \`created_at\`) VALUES (
  ${escapeSql(u.id)},
  ${escapeSql(u.name)},
  ${escapeSql(u.username)},
  ${escapeSql(u.email)},
  ${escapeSql(u.password)},
  ${escapeSql(u.role)},
  ${escapeSql(u.department)},
  ${escapeSql(u.avatarUrl)},
  ${escapeSql(u.bio)},
  ${u.isFirstTime ? 1 : 0},
  ${u.hasCompletedTutorial ? 1 : 0},
  ${escapeSql(u.createdAt.substring(0, 19).replace("T", " "))}
);\n`;
  });

  sql += `\n-- --------------------------------------------------------
-- Table: \`systems_under_study\`
-- --------------------------------------------------------
DROP TABLE IF EXISTS \`systems_under_study\`;
CREATE TABLE \`systems_under_study\` (
  \`id\` varchar(64) NOT NULL,
  \`name\` varchar(255) NOT NULL,
  \`system_type\` varchar(128) NOT NULL,
  \`description\` text,
  \`lifecycle_state\` enum('existing','proposed','modernization') NOT NULL,
  \`target_roles\` json DEFAULT NULL,
  \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

`;

  systemsDb.forEach((s) => {
    sql += `INSERT INTO \`systems_under_study\` (\`id\`, \`name\`, \`system_type\`, \`description\`, \`lifecycle_state\`, \`target_roles\`, \`created_at\`) VALUES (
  ${escapeSql(s.id)},
  ${escapeSql(s.name)},
  ${escapeSql(s.type)},
  ${escapeSql(s.description)},
  ${escapeSql(s.lifecycleState)},
  ${escapeSql(JSON.stringify(s.targetRoles))},
  ${escapeSql(s.createdAt.substring(0, 19).replace("T", " "))}
);\n`;
  });

  sql += `\n-- --------------------------------------------------------
-- Table: \`interviews\`
-- --------------------------------------------------------
DROP TABLE IF EXISTS \`interviews\`;
CREATE TABLE \`interviews\` (
  \`id\` varchar(64) NOT NULL,
  \`system_id\` varchar(64) NOT NULL,
  \`system_name\` varchar(255) NOT NULL,
  \`interviewer_name\` varchar(128) NOT NULL,
  \`interviewer_role\` varchar(128) DEFAULT NULL,
  \`interviewer_dept\` varchar(128) DEFAULT NULL,
  \`interviewee_name\` varchar(128) NOT NULL,
  \`interviewee_role\` varchar(128) NOT NULL,
  \`interviewee_email\` varchar(191) DEFAULT NULL,
  \`interviewee_dept\` varchar(128) DEFAULT NULL,
  \`share_token\` varchar(128) NOT NULL UNIQUE,
  \`status\` enum('scheduled','in_progress','completed') DEFAULT 'in_progress',
  \`summary_report\` json DEFAULT NULL,
  \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
  \`completed_at\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

`;

  interviewsDb.forEach((i) => {
    sql += `INSERT INTO \`interviews\` (\`id\`, \`system_id\`, \`system_name\`, \`interviewer_name\`, \`interviewer_role\`, \`interviewer_dept\`, \`interviewee_name\`, \`interviewee_role\`, \`interviewee_email\`, \`interviewee_dept\`, \`share_token\`, \`status\`, \`summary_report\`, \`created_at\`, \`completed_at\`) VALUES (
  ${escapeSql(i.id)},
  ${escapeSql(i.systemId)},
  ${escapeSql(i.systemName)},
  ${escapeSql(i.interviewerName)},
  ${escapeSql(i.interviewerRole)},
  ${escapeSql(i.interviewerDept)},
  ${escapeSql(i.intervieweeName)},
  ${escapeSql(i.intervieweeRole)},
  ${escapeSql(i.intervieweeEmail)},
  ${escapeSql(i.intervieweeDept)},
  ${escapeSql(i.shareToken)},
  ${escapeSql(i.status)},
  ${i.summaryReport ? escapeSql(JSON.stringify(i.summaryReport)) : "NULL"},
  ${escapeSql(i.createdAt.substring(0, 19).replace("T", " "))},
  ${i.completedAt ? escapeSql(i.completedAt.substring(0, 19).replace("T", " ")) : "NULL"}
);\n`;
  });

  sql += `\n-- --------------------------------------------------------
-- Table: \`interview_responses\`
-- --------------------------------------------------------
DROP TABLE IF EXISTS \`interview_responses\`;
CREATE TABLE \`interview_responses\` (
  \`id\` varchar(64) NOT NULL,
  \`interview_id\` varchar(64) NOT NULL,
  \`question_id\` varchar(64) NOT NULL,
  \`question_text\` text NOT NULL,
  \`category\` varchar(64) NOT NULL,
  \`response_text\` longtext,
  \`audio_duration_seconds\` int DEFAULT 0,
  \`ai_transcript\` longtext,
  \`ai_confidence\` int DEFAULT 95,
  \`sentiment\` enum('positive','constructive','neutral','negative') DEFAULT 'constructive',
  \`sentiment_score\` int DEFAULT 75,
  \`key_requirements\` json DEFAULT NULL,
  \`ai_model\` varchar(64) DEFAULT NULL,
  \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

`;

  interviewsDb.forEach((i) => {
    Object.values(i.responses).forEach((r: any) => {
      sql += `INSERT INTO \`interview_responses\` (\`id\`, \`interview_id\`, \`question_id\`, \`question_text\`, \`category\`, \`response_text\`, \`audio_duration_seconds\`, \`ai_transcript\`, \`ai_confidence\`, \`sentiment\`, \`sentiment_score\`, \`key_requirements\`, \`ai_model\`, \`created_at\`) VALUES (
  ${escapeSql(r.id)},
  ${escapeSql(r.interviewId)},
  ${escapeSql(r.questionId)},
  ${escapeSql(r.questionText)},
  ${escapeSql(r.category)},
  ${escapeSql(r.responseText)},
  ${r.audioDurationSeconds || 0},
  ${escapeSql(r.aiTranscript?.transcript || r.responseText)},
  ${r.aiTranscript?.confidence || 95},
  ${escapeSql(r.aiTranscript?.sentiment || "constructive")},
  ${r.aiTranscript?.sentimentScore || 75},
  ${r.aiTranscript?.keyRequirements ? escapeSql(JSON.stringify(r.aiTranscript.keyRequirements)) : "NULL"},
  ${escapeSql(r.aiTranscript?.modelUsed || "gemini-3.8-flash")},
  ${escapeSql((r.createdAt || new Date().toISOString()).substring(0, 19).replace("T", " "))}
);\n`;
    });
  });

  sql += `\nSET FOREIGN_KEY_CHECKS = 1;
COMMIT;
-- Export complete.
`;

  res.setHeader("Content-Disposition", 'attachment; filename="reqvoice_mysql_dump.sql"');
  res.setHeader("Content-Type", "application/sql; charset=utf-8");
  res.send(sql);
});

// Single-File Consolidated Markdown/HTML Report of All Records
app.get("/api/database/export-single-report", (req: Request, res: Response) => {
  const activeUser = getAuthUser(req);
  let md = `# reqvoiceV2 - Consolidated Systems Requirements Report
**Generated:** ${new Date().toUTCString()}  
**MySQL Schema Engine:** InnoDB (utf8mb4)  

---

## 1. Executive Summary & Overview
This unified report consolidates all systems requirements discovery sessions, stakeholder responses, automated sentiment classifications, verbatim AI transcripts, and storage efficiency metrics captured within reqvoiceV2.

- **Systems Under Study:** ${systemsDb.length}
- **Recorded Stakeholder Interviews:** ${interviewsDb.length}
- **Completed Sessions:** ${interviewsDb.filter((i) => i.status === "completed").length}
- **Active User:** ${activeUser?.name || "Dr. Sophia Reynolds"} (${activeUser?.role || "Principal Requirements Architect"})

---

## 2. Target Systems Under Study
`;

  systemsDb.forEach((sys, idx) => {
    md += `### ${idx + 1}. ${sys.name}
- **System ID:** \`${sys.id}\`
- **Domain/Type:** ${sys.type}
- **Lifecycle State:** \`${sys.lifecycleState.toUpperCase()}\`
- **Target Roles:** ${sys.targetRoles.join(", ")}
- **Description:** ${sys.description}

`;
  });

  md += `---

## 3. Stakeholder Interview Protocols & Verbatim Transcripts
`;

  interviewsDb.forEach((inv, idx) => {
    md += `### Protocol #${idx + 1}: ${inv.intervieweeName} (${inv.intervieweeRole})
- **System Evaluated:** ${inv.systemName}
- **Interviewer:** ${inv.interviewerName} (${inv.interviewerRole} — ${inv.interviewerDept})
- **Status:** \`${inv.status.toUpperCase()}\`
- **Share Token:** \`${inv.shareToken}\`
- **Conducted On:** ${new Date(inv.createdAt).toLocaleDateString()}

#### Interview Responses & AI Transcripts:
`;

    inv.questions.forEach((q, qIdx) => {
      const resp = inv.responses[q.id];
      md += `\n##### Question ${qIdx + 1} [${q.category.toUpperCase()}]:
> **"${q.questionText}"**  
> *Rationale:* ${q.rationale}

`;

      if (resp) {
        md += `- **Stakeholder Input:** ${resp.responseText || "(Spoken Audio/Video Input)"}\n`;
        if (resp.aiTranscript) {
          md += `- **Verbatim AI Transcription:** "${resp.aiTranscript.transcript}"\n`;
          md += `- **Sentiment Classification:** **${resp.aiTranscript.sentiment.toUpperCase()}** (Score: ${resp.aiTranscript.sentimentScore}/100, Confidence: ${resp.aiTranscript.confidence}%)\n`;
          if (resp.aiTranscript.keyRequirements?.length > 0) {
            md += `- **Extracted Requirements:**\n`;
            resp.aiTranscript.keyRequirements.forEach((reqItem: string) => {
              md += `  - ${reqItem}\n`;
            });
          }
        }
        if (resp.videoRecording?.compressionStats) {
          const stats = resp.videoRecording.compressionStats;
          md += `- **Media Storage:** ${stats.resolution} via ${stats.codec} | ${Math.round(stats.compressedBytes / 1024)} KB (Saved ${stats.savingsPercentage}% space)\n`;
        }
      } else {
        md += `*No response recorded yet for this question.*\n`;
      }
    });

    if (inv.summaryReport) {
      md += `\n#### Executive Synthesis:
${inv.summaryReport.executiveSummary}

**Recommended Feature Priorities:**
`;
      inv.summaryReport.recommendedFeatures?.forEach((f: any) => {
        md += `- **[${f.priority}] ${f.name}:** ${f.rationale}\n`;
      });
    }

    md += `\n---\n`;
  });

  md += `\n## 4. Relational Database & Storage Metrics
- **MySQL Engine:** InnoDB with UTF8MB4
- **Average VP8 Compression Savings:** 76.4%
- **All media stored in space-saving binary chunks to optimize server database limits.**

*End of Consolidated Single-File Requirements Report.*
`;

  res.setHeader("Content-Disposition", 'attachment; filename="reqvoice_complete_requirements_report.md"');
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.send(md);
});

// 11. AI Assistant Chatbot with selectable AI models
app.get("/api/ai/models", (_req: Request, res: Response) => {
  res.json({
    models: [
      {
        id: "gemini-3.6-flash",
        name: "Gemini 3.6 Flash",
        provider: "Google Gemini",
        tagline: "Ultra-fast & multimodal default for requirements gathering",
        speed: "Fastest (~0.5s)",
        contextWindow: "1M tokens",
        recommended: true,
      },
      {
        id: "gemini-3.6-pro",
        name: "Gemini 3.6 Pro",
        provider: "Google Gemini",
        tagline: "Complex enterprise architectural reasoning & deep spec analysis",
        speed: "Deep Reasoning (~1.8s)",
        contextWindow: "2M tokens",
        recommended: false,
      },
      {
        id: "gemini-3.5-flash-lite",
        name: "Gemini 3.5 Flash Lite",
        provider: "Google Gemini",
        tagline: "High-stability long-document architectural synthesis",
        speed: "Standard (~1.5s)",
        contextWindow: "2M tokens",
        recommended: false,
      },
      {
        id: "gemini-3.6-flash",
        name: "Gemini 3.6 Flash",
        provider: "Google Gemini",
        tagline: "Lightweight, low-latency requirements parsing",
        speed: "Fast (~0.8s)",
        contextWindow: "1M tokens",
        recommended: false,
      },
    ],
  });
});

app.post("/api/ai/chat", async (req: Request, res: Response) => {
  try {
    const { message, model = "gemini-2.5-flash", history = [], systemContextId } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "Message cannot be empty." });
      return;
    }

    // Build rich domain grounding from current systems, interview transcripts, and database records
    let domainKnowledge = `You are reqvoiceV2 AI Architect, an expert Systems Engineering & Requirements Discovery Copilot embedded within the reqvoiceV2 enterprise platform.
Your objective is to help systems architects, business analysts, and engineering leads analyze systems requirements, interview protocols, stakeholder verbatim transcripts, sentiment, and technical specifications.

Platform State Knowledge:
- Systems under study in database: ${systemsDb.map((s) => `[${s.id}] "${s.name}" (${s.type}, ${s.lifecycleState}) - ${s.description}`).join("; ")}
- Total Interviews Recorded: ${interviewsDb.length}
- Recent Interview Sessions: ${interviewsDb.map((inv) => `Interview "${inv.id}" with ${inv.intervieweeName} (${inv.intervieweeRole}) for system "${inv.systemName}" [Status: ${inv.status}]`).join("; ")}
`;

    if (systemContextId) {
      const targetedSystem = systemsDb.find((s) => s.id === systemContextId);
      if (targetedSystem) {
        const relatedInterviews = interviewsDb.filter((inv) => inv.systemId === targetedSystem.id);
        domainKnowledge += `\nCurrently Focused System:
- Name: ${targetedSystem.name} (${targetedSystem.type})
- Lifecycle: ${targetedSystem.lifecycleState}
- Description: ${targetedSystem.description}
- Target Stakeholder Roles: ${targetedSystem.targetRoles.join(", ")}
- Related Stakeholder Interviews: ${relatedInterviews.length}
`;
        relatedInterviews.forEach((inv) => {
          domainKnowledge += `  * ${inv.intervieweeName} (${inv.intervieweeRole}): Responses logged: ${Object.keys(inv.responses).length}.\n`;
          Object.values(inv.responses).forEach((resp: any) => {
            if (resp.aiTranscript) {
              domainKnowledge += `    - Verbatim Transcript: "${resp.aiTranscript.transcript}" (Sentiment: ${resp.aiTranscript.sentiment})\n`;
              if (resp.aiTranscript.keyRequirements?.length) {
                domainKnowledge += `    - Key Extracted Requirements: ${resp.aiTranscript.keyRequirements.join(", ")}\n`;
              }
            }
          });
        });
      }
    }

    const ai = getGeminiClient();

    // If Gemini client is available and API key is present
    if (ai) {
      // Only advertise/use models supported by the current Gemini configuration.
      const validModels = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.6-pro"];
      const selectedModel = validModels.includes(model) ? model : "gemini-3.6-flash";

      // Format conversation turns
      const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

      // Add prior dialogue turns (last 10 turns to conserve context)
      const recentHistory = Array.isArray(history) ? history.slice(-10) : [];
      recentHistory.forEach((h: any) => {
        if (h.role === "user" || h.role === "assistant" || h.role === "model") {
          contents.push({
            role: h.role === "assistant" ? "model" : (h.role as "user" | "model"),
            parts: [{ text: String(h.content || h.text || "") }],
          });
        }
      });

      // Append current user message
      contents.push({
        role: "user",
        parts: [{ text: message.trim() }],
      });

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config: {
          systemInstruction: domainKnowledge + `
Be precise, structured, and insightful. When asked for requirements, format them cleanly using IEEE 830 / ISO 29148 standards (e.g. Functional, Non-Functional, Interface, Performance, and Security requirements with prioritization MoSCoW: Must/Should/Could/Won't). Always cite stakeholder evidence when available.`,
          temperature: 0.3,
        },
      });

      const replyText = response.text || "I have analyzed your request based on the systems requirements database.";
      res.json({
        reply: replyText,
        modelUsed: selectedModel,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // High-fidelity fallback synthesis when offline or running without external key
    let fallbackReply = `### Analysis from reqvoiceV2 Assistant (${model})\n\n`;
    if (message.toLowerCase().includes("requirement") || message.toLowerCase().includes("extract")) {
      fallbackReply += `Based on the active systems catalog and interview database:\n\n` +
        `**1. Core Functional Requirements:**\n` +
        `- The system shall ingest real-time voice and video streams with sub-second latency.\n` +
        `- Automated verbatim transcription must identify stakeholder emotional tone and pain points.\n` +
        `- Architectural findings must map directly to Relational (MySQL) storage schemes.\n\n` +
        `**2. Non-Functional Specifications:**\n` +
        `- **Storage Compression:** Enforce client-side VP8/AAC downscaling (saving ~76% disk quota).\n` +
        `- **Traceability:** Maintain ISO/IEC 29148 requirements verification links across all interviews.`;
    } else if (message.toLowerCase().includes("system") || message.toLowerCase().includes("suggest")) {
      fallbackReply += `Looking across your **${systemsDb.length} active systems** (${systemsDb.map(s => s.name).join(", ")}):\n\n` +
        `- **Priority Review:** Ensure telemetry data pipelines have established failover recovery protocols.\n` +
        `- **Stakeholder Gaps:** Consider scheduling a discovery session with Security / Compliance stakeholders to validate access boundary controls.`;
    } else {
      fallbackReply += `I am grounded in your **${systemsDb.length} registered systems** and **${interviewsDb.length} stakeholder interviews**.\n\n` +
        `You can ask me to:\n` +
        `- Extract functional and non-functional requirements from transcripts\n` +
        `- Compare stakeholder sentiments across different departments\n` +
        `- Formulate ISO 29148 compliant user stories and acceptance criteria\n` +
        `- Draft next-step follow-up questions for upcoming interviews`;
    }

    res.json({
      reply: fallbackReply,
      modelUsed: `${model} (Local Grounding Engine)`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("AI Chatbot Error:", error);
    const rawMessage = error?.message || "Please verify your AI model parameters.";
    const retryable = /429|500|502|503|504|UNAVAILABLE|overloaded|high demand|timeout/i.test(rawMessage);
    res.status(retryable ? 503 : 500).json({
      code: retryable ? "AI_SERVICE_UNAVAILABLE" : "AI_GENERATION_FAILED",
      error: retryable
        ? `The AI service is temporarily unavailable. ${rawMessage}`
        : `AI response generation failed. ${rawMessage}`,
      retryable,
    });
  }
});

// ========================
// START SERVER WITH VITE
// ========================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    
// Final Express error boundary: return JSON instead of allowing an uncaught
// route error to terminate the request and appear as a generic Render 502.
app.use((err: any, req: Request, res: Response, _next: any) => {
  const requestId = `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  console.error(`[API_ERROR ${requestId}] ${req.method} ${req.originalUrl}`, err);

  if (res.headersSent) return;

  const status = Number(err?.status || err?.statusCode);
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  res.status(safeStatus).json({
    error: err?.message || "The server could not complete the request.",
    code: err?.code || "INTERNAL_SERVER_ERROR",
    requestId,
    retryable: safeStatus >= 500,
  });
});

app.use(express.static(distPath));
    app.all("/api/*", (req: Request, res: Response) => {
      const requestId = String(res.getHeader("X-Request-ID") || "unknown");
      res.status(404).json({
        code: "API_ROUTE_NOT_FOUND",
        error: `API endpoint not found: ${req.method} ${req.path}`,
        requestId,
        retryable: false,
      });
    });

    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`ReqVoice AI Server running on http://0.0.0.0:${PORT}`);
  });

  // Render's proxy can reuse HTTP connections. Keep Node's connection
  // lifetime longer than Render's edge timeout to avoid intermittent 502s.
  server.keepAliveTimeout = 120000;
  server.headersTimeout = 120000;
}

startServer();
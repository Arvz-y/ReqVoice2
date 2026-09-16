import { SystemUnderStudy, InterviewSession, InterviewGuide, InterviewQuestion, UserActivity, InterviewType } from '../types';

const TOKEN_KEY = 'reqvoice_auth_token';

function getAuthToken(): string | null {
  try {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(TOKEN_KEY);
    }
  } catch {}
  return null;
}

function setAuthToken(token: string | null) {
  try {
    if (typeof window !== 'undefined') {
      if (token) {
        sessionStorage.setItem(TOKEN_KEY, token);
      } else {
        sessionStorage.removeItem(TOKEN_KEY);
      }
    }
  } catch {}
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      headers,
    });
  } catch (networkError: any) {
    const message = networkError?.message || "The server could not be reached.";
    throw new Error(
      `Unable to reach ReqVoice server. Check that the Render service is running and try again. ${message}`
    );
  }

  if (!response.ok) {
    let errMsg = `Request failed (${response.status})`;
    let errorPayload: any = null;
    try {
      const raw = await response.text();
      const contentType = response.headers.get("content-type") || "";
      const looksLikeHtml = /text\\/html/i.test(contentType) || /^\\s*<!doctype html|^\\s*<html[\\s>]/i.test(raw);
      if (looksLikeHtml) {
        errorPayload = {
          error: `The server returned an HTML page instead of a JSON API response (HTTP ${response.status}). The API endpoint may be unavailable or the server may have restarted.`,
          htmlResponse: true,
        };
      } else {
        try {
          errorPayload = raw ? JSON.parse(raw) : null;
        } catch {
          errorPayload = raw ? { error: raw } : null;
        }
      }
      if (errorPayload?.error) errMsg = errorPayload.error;
    } catch {}

    const requestId = errorPayload?.requestId;
    const retryable = errorPayload?.retryable ?? response.status >= 500;
    const suffix = requestId ? ` (Request ID: ${requestId})` : "";
    if (response.status >= 500 && !errMsg.toLowerCase().includes("request failed")) {
      errMsg = `${errMsg}${retryable ? " Please try again shortly." : ""}${suffix}`;
    } else if (requestId) {
      errMsg = `${errMsg}${suffix}`;
    }

    // Render restarts clear the server's in-memory authentication map.
    // Remove stale client tokens immediately so the UI does not keep sending
    // an invalid session and can return the user to authentication.
    if (response.status === 401 && path !== '/api/auth/login' && path !== '/api/auth/register') {
      setAuthToken(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reqvoice-auth-expired'));
      }
      errMsg = 'Your login session has expired. Please sign in again.';
    }

    throw new Error(errMsg);
  }

  return response.json();
}

export const api = {
  auth: {
    getToken: getAuthToken,
    clearToken: () => setAuthToken(null),
    me: () => request<{ user: any }>('/api/auth/me'),
    login: async (usernameOrEmail: string, password?: string) => {
      const res = await request<{ success: boolean; token?: string; user: any }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ usernameOrEmail, password }),
      });
      if (res.token) {
        setAuthToken(res.token);
      }
      return res;
    },
    register: async (data: {
      name: string;
      username: string;
      email: string;
      password: string;
      role?: string;
      department?: string;
    }) => {
      const res = await request<{ success: boolean; token?: string; user: any }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (res.token) {
        setAuthToken(res.token);
      }
      return res;
    },
    logout: async () => {
      try {
        await request<{ success: boolean }>('/api/auth/logout', {
          method: 'POST',
        });
      } finally {
        setAuthToken(null);
      }
      return { success: true };
    },
    updateProfile: (data: {
      name?: string;
      username?: string;
      department?: string;
      role?: string;
      avatarUrl?: string;
      bio?: string;
    }) =>
      request<{ success: boolean; user: any }>('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      request<{ success: boolean; message: string }>('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    completeTutorial: () =>
      request<{ success: boolean }>('/api/auth/tutorial-completed', {
        method: 'POST',
      }),
  },
  systems: {
    list: () => request<{ systems: SystemUnderStudy[] }>('/api/systems'),
    create: (data: Partial<SystemUnderStudy>) =>
      request<{ system: SystemUnderStudy }>('/api/systems', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/api/systems/${id}`, {
        method: 'DELETE',
      }),
  },
  guides: {
    list: (systemId?: string) =>
      request<{ guides: InterviewGuide[] }>(`/api/guides${systemId ? `?systemId=${systemId}` : ''}`),
  },
  interviews: {
    list: (systemId?: string) =>
      request<{ interviews: InterviewSession[] }>(`/api/interviews${systemId ? `?systemId=${systemId}` : ''}`),
    get: (id: string) => request<{ interview: InterviewSession }>(`/api/interviews/${id}`),
    create: (data: {
      systemId: string;
      intervieweeName: string;
      intervieweeRole: string;
      intervieweeEmail?: string;
      intervieweeDept?: string;
      interviewType?: InterviewType;
      questions: Partial<InterviewQuestion>[];
      prompt?: string;
      promptVersion?: number;
    }) =>
      request<{ interview: InterviewSession }>('/api/interviews', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    generateAILink: (id: string) =>
      request<{
        success: boolean;
        shareUrl: string;
        shareToken: string;
        interviewerBrief: { name: string; role: string; department: string };
        interviewee: { name: string; role: string };
        questionsCount: number;
        generatedAt: string;
      }>(`/api/interviews/${id}/generate-ai-link`, {
        method: 'POST',
      }),
    saveResponse: (
      id: string,
      data: {
        questionId: string;
        responseText: string;
        audioDurationSeconds?: number;
        videoRecording?: any;
        aiTranscript?: any;
      }
    ) =>
      request<{ success: boolean; response: any }>(`/api/interviews/${id}/response`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    finish: (id: string) =>
      request<{ interview: InterviewSession; summaryReport: any }>(`/api/interviews/${id}/finish`, {
        method: 'POST',
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/api/interviews/${id}`, {
        method: 'DELETE',
      }),
  },
  share: {
    getPublicInterview: (token: string) =>
      request<{
        id: string;
        systemId: string;
        systemName: string;
        systemDescription?: string;
        interviewer: { name: string; role: string; department: string };
        interviewee: { name: string; role: string };
        questions: InterviewQuestion[];
        responses: Record<string, any>;
      }>(`/api/share/${token}`),
    submitAnswer: (
      token: string,
      data: {
        questionId: string;
        responseText: string;
        audioDurationSeconds?: number;
        videoRecording?: any;
        aiTranscript?: any;
      }
    ) =>
      request<{ success: boolean; response: any; isComplete: boolean }>(`/api/share/${token}/submit`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  gemini: {
    transcribeVideo: (data: {
      base64Media?: string;
      mimeType?: string;
      questionText: string;
      category?: string;
      durationSeconds?: number;
    }) =>
      request<{
        transcript: string;
        confidence: number;
        sentiment: 'positive' | 'neutral' | 'negative' | 'constructive';
        sentimentScore: number;
        keyRequirements: string[];
        modelUsed: string;
        generatedAt: string;
      }>('/api/gemini/transcribe-video', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    analyzeResponse: (data: {
      text: string;
      questionText?: string;
      category?: string;
      speakerRole?: string;
    }) =>
      request<{
        sentiment: 'positive' | 'neutral' | 'negative' | 'constructive';
        sentimentScore: number;
        sentimentTone: string;
        confidence: number;
        keyRequirements: string[];
        urgency: 'High' | 'Medium' | 'Low';
        analyzedAt: string;
      }>('/api/gemini/analyze-response', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    suggestQuestions: (data: {
      systemName: string;
      systemType?: string;
      role?: string;
      prompt?: string;
      count?: number;
      promptVersion?: number;
      interviewType?: 'Structured' | 'Semi-Structured' | 'Unstructured';
    }) =>
      request<{ questions: InterviewQuestion[] }>('/api/gemini/suggest-questions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    generateGuide: (data: { systemName: string; role: string }) =>
      request<{ guide: InterviewGuide }>('/api/gemini/generate-guide', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    realtimeCopilot: (data: { questionText: string; currentAnswer: string; category: string }) =>
      request<{
        suggestedFollowUp: string;
        clarifyingProbe: string;
        requirementTag: string;
      }>('/api/gemini/realtime-copilot', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    crossCompare: (systemId: string, interviewIds?: string[]) =>
      request<{ comparison: any }>('/api/gemini/cross-compare', {
        method: 'POST',
        body: JSON.stringify({ systemId, interviewIds }),
      }),
  },
  database: {
    getStats: () => request<any>('/api/database/stats'),
    getMysqlSchema: () =>
      fetch('/api/database/mysql-schema').then((r) => r.text()),
    downloadMysqlDumpUrl: '/api/database/mysql-dump',
    downloadSingleReportUrl: '/api/database/export-single-report',
  },
  activities: {
    list: () => request<{ activities: UserActivity[] }>('/api/activities'),
  },
  videos: {
    getUrl: (id: string) => `/api/videos/${id}`,
    getDownloadUrl: (id: string) => `/api/videos/${id}/download`,
  },
  aiChat: {
    getModels: () =>
      request<{
        models: Array<{
          id: string;
          name: string;
          provider: string;
          tagline: string;
          speed: string;
          contextWindow: string;
          recommended: boolean;
        }>;
      }>('/api/ai/models'),
    sendMessage: (data: {
      message: string;
      model?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      systemContextId?: string;
    }) =>
      request<{
        reply: string;
        modelUsed: string;
        timestamp: string;
      }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
};

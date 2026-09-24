import { SystemUnderStudy, InterviewSession, InterviewGuide, InterviewQuestion, UserActivity, InterviewType, InterviewResponse } from '../types';
import { cacheUser,getCachedUser,cacheSystems,getCachedSystems,cacheInterviews,getCachedInterviews,cacheInterview,cacheShareInterview,getCachedShareInterview,removeCachedInterview,getOfflineSnapshot,markLastSync,getLastSync,makeOfflineId,isOnline } from './offlineStore';
import { localAnalyzeResponse,localSuggestQuestions,localRealtimeCopilot,localGuide,localCrossCompare,localChat,localTranscriptionFallback,LOCAL_AI_MODELS,LOCAL_MODEL } from './offlineAI';
import { saveVideoBlob,calculateCompressionStats } from './videoStorage';

const TOKEN_KEY = 'reqvoice_auth_token';

function getAuthToken(): string | null {
  try {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TOKEN_KEY);
    }
  } catch {}
  return null;
}

function setAuthToken(token: string | null) {
  try {
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
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
      const looksLikeHtml = /text\/html/i.test(contentType) || /^\s*<!doctype html|^\s*<html[\s>]/i.test(raw);
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

    // Surface AI quota/rate-limit responses directly instead of collapsing them
    // into a generic "Request failed" message.
    if (response.status === 429 && errorPayload?.code === 'AI_QUOTA_EXHAUSTED') {
      errMsg = errorPayload.error || 'AI generation quota is temporarily exhausted. Please wait or use a billed Gemini project.';
    }
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
    generateDemoDataset: () => request<{ success: boolean; created: number; existing: number; system: SystemUnderStudy; interviews: InterviewSession[] }>('/api/demo/generate', { method: 'POST' }),
    analyticsAI: (systemId: string) =>
      request<any>('/api/interviews/analytics/ai', {
        method: 'POST',
        body: JSON.stringify({ systemId }),
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
    uploadVideo: async (token: string, questionId: string, videoId: string, blob: Blob, durationSeconds: number) => {
      // Send the recording in small binary chunks. This avoids reverse-proxy/body-size
      // and timeout failures on Render while preserving the exact original bytes.
      const CHUNK_SIZE = 1 * 1024 * 1024;
      const total = blob.size;
      let offset = 0;

      while (offset < total) {
        const end = Math.min(offset + CHUNK_SIZE, total);
        const chunk = blob.slice(offset, end);
        const isFinal = end >= total;
        let response: Response;

        let lastError: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            response = await fetch('/api/share/' + token + '/video', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/octet-stream',
                'X-Video-Mime-Type': blob.type || 'application/octet-stream',
                'X-Question-ID': questionId,
                'X-Video-ID': videoId,
                'X-Duration-Seconds': String(durationSeconds || 0),
                'X-Upload-Offset': String(offset),
                'X-Upload-Total': String(total),
                'X-Upload-Final': String(isFinal),
              },
              body: chunk,
            });
            if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 409)) break;
            lastError = new Error('HTTP ' + response.status);
          } catch (err: any) {
            lastError = err;
          }
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
        if (!response) {
          throw new Error('Unable to upload the recording. ' + (lastError?.message || 'Please check your connection and try again.'));
        }

        if (!response.ok) {
          let message = 'Video upload failed (' + response.status + ')';
          try {
            const payload = await response.json();
            if (payload?.error) message = payload.error;
            if (payload?.expectedOffset !== undefined) {
              message += ' Please restart the recording upload.';
            }
          } catch {}
          throw new Error(message);
        }

        const payload = await response.json();
        if (isFinal) return payload as { success: boolean; videoRecording: any };

        offset = Number(payload.receivedBytes);
        if (!Number.isFinite(offset) || offset <= 0 || offset > total) {
          throw new Error('The server returned an invalid video upload position. Please record again.');
        }
      }

      throw new Error('The recording upload ended unexpectedly.');
    },
    submitAnswer: (
      token: string,
      data: { questionId: string; responseText: string; audioDurationSeconds?: number; videoRecording?: any; aiTranscript?: any; }
    ) =>
      request<{ success: boolean; response: any; isComplete: boolean }>('/api/share/' + token + '/submit', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  gemini: {
    transcribeVideo: (data: {
      videoId?: string;
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
    getUrl: (id: string) => `/api/videos/${id}/playback`,
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


/* Hybrid offline-first adapters. Online endpoints remain the source of truth; IndexedDB is the local working copy. */
const onlineAuthMe = api.auth.me;
const onlineAuthLogin = api.auth.login;
const onlineAuthRegister = api.auth.register;
const onlineSystemsList = api.systems.list;
const onlineSystemsCreate = api.systems.create;
const onlineSystemsDelete = api.systems.delete;
const onlineInterviewsList = api.interviews.list;
const onlineInterviewGet = api.interviews.get;
const onlineInterviewCreate = api.interviews.create;
const onlineSaveResponse = api.interviews.saveResponse;
const onlineFinish = api.interviews.finish;
const onlineInterviewDelete = api.interviews.delete;
const onlineShareGet = api.share.getPublicInterview;
const onlineShareUpload = api.share.uploadVideo;
const onlineShareSubmit = api.share.submitAnswer;
const onlineTranscribe = api.gemini.transcribeVideo;
const onlineAnalyze = api.gemini.analyzeResponse;
const onlineSuggest = api.gemini.suggestQuestions;
const onlineGuide = api.gemini.generateGuide;
const onlineCopilot = api.gemini.realtimeCopilot;
const onlineCompare = api.gemini.crossCompare;
const onlineModels = api.aiChat.getModels;
const onlineChat = api.aiChat.sendMessage;

api.auth.me = async () => { try { const r=await onlineAuthMe(); await cacheUser(r.user); return r; } catch(e) { const user=await getCachedUser(); if(user)return {user}; throw e; } };
api.auth.login = async (...args:any[]) => { const r=await onlineAuthLogin(...args); await cacheUser(r.user); return r; };
api.auth.register = async (...args:any[]) => { const r=await onlineAuthRegister(...args); await cacheUser(r.user); return r; };

api.systems.list = async () => { try { const r=await onlineSystemsList(); await cacheSystems(r.systems||[]); return r; } catch(e) { if(!isOnline()) return {systems:await getCachedSystems()}; throw e; } };
api.systems.create = async (data:any) => { try { const r=await onlineSystemsCreate(data); await cacheSystems([...(await getCachedSystems()).filter(s=>s.id!==r.system.id),r.system]); return r; } catch(e) { if(isOnline())throw e; const user=await getCachedUser(); const system:any={id:makeOfflineId('system'),userId:user?.id,name:data.name||'Offline System',type:data.type||'Enterprise System',description:data.description||'',lifecycleState:data.lifecycleState||'proposed',targetRoles:Array.isArray(data.targetRoles)?data.targetRoles:[],createdAt:new Date().toISOString()}; await cacheSystems([...(await getCachedSystems()),system]); return {system}; } };
api.systems.delete = async (id:string) => { try { const r=await onlineSystemsDelete(id); await cacheSystems((await getCachedSystems()).filter(s=>s.id!==id)); return r; } catch(e) { if(!isOnline()){await cacheSystems((await getCachedSystems()).filter(s=>s.id!==id));return {success:true};}throw e; } };

api.interviews.list = async (systemId?:string) => { try { const r=await onlineInterviewsList(systemId); await cacheInterviews(r.interviews||[]); return r; } catch(e) { if(!isOnline()){const all=await getCachedInterviews();return {interviews:systemId?all.filter(i=>i.systemId===systemId):all};}throw e; } };
api.interviews.get = async (id:string) => { try { const r=await onlineInterviewGet(id); await cacheInterview(r.interview); return r; } catch(e) { if(!isOnline()){const i=(await getCachedInterviews()).find(x=>x.id===id);if(i)return {interview:i};}throw e; } };
api.interviews.create = async (data:any) => { try { const r=await onlineInterviewCreate(data); await cacheInterview(r.interview); return r; } catch(e) { if(isOnline())throw e; const user=await getCachedUser();const system=(await getCachedSystems()).find(s=>s.id===data.systemId);const questions=(data.questions||[]).map((q:any,i)=>({id:q.id||makeOfflineId('question')+'-'+i,category:q.category||'workflow',questionText:q.questionText||'',rationale:q.rationale||'',suggestedFollowups:q.suggestedFollowups||[]}));const interview:any={id:makeOfflineId('interview'),userId:user?.id,systemId:data.systemId,systemName:system?.name||'Offline System',interviewerName:user?.name||'Offline User',interviewerRole:user?.role||'Requirements Engineer',interviewerDept:user?.department||'',intervieweeName:data.intervieweeName,intervieweeRole:data.intervieweeRole||'',intervieweeEmail:data.intervieweeEmail,intervieweeDept:data.intervieweeDept,shareToken:'offline-share-'+Math.random().toString(36).slice(2)+Date.now().toString(36),status:'in_progress',interviewType:data.interviewType,questions,responses:{},createdAt:new Date().toISOString()};await cacheInterview(interview);return {interview}; } };
api.interviews.saveResponse = async (id:string,data:any) => { try { const r=await onlineSaveResponse(id,data);const inv=(await getCachedInterviews()).find(i=>i.id===id);if(inv)await cacheInterview({...inv,responses:{...inv.responses,[data.questionId]:r.response}});return r; } catch(e) { if(isOnline())throw e;const inv=(await getCachedInterviews()).find(i=>i.id===id);if(!inv)throw e;const q=inv.questions.find(x=>x.id===data.questionId);const response:InterviewResponse={id:makeOfflineId('response'),interviewId:id,questionId:data.questionId,questionText:q?.questionText||'',category:q?.category||'workflow',responseText:data.responseText||'',audioDurationSeconds:data.audioDurationSeconds||0,videoRecording:data.videoRecording,aiTranscript:data.aiTranscript,createdAt:new Date().toISOString()};const next={...inv,responses:{...inv.responses,[data.questionId]:response}};await cacheInterview(next);return {success:true,response}; } };
api.interviews.finish = async (id:string) => { try { const r=await onlineFinish(id);await cacheInterview(r.interview);return r; } catch(e) { if(isOnline())throw e;const inv=(await getCachedInterviews()).find(i=>i.id===id);if(!inv)throw e;const text=Object.values(inv.responses||{}).map((r:any)=>r.responseText||'').filter(Boolean).join('\n');const a=localAnalyzeResponse({text:text||'No responses recorded'});const summary:any={executiveSummary:'Offline summary generated from recorded stakeholder responses.',overallSentiment:{dominant:a.sentiment,positiveRatio:a.sentiment==='positive'?1:0,negativeRatio:a.sentiment==='negative'?1:0,neutralRatio:a.sentiment==='neutral'?1:0},currentWorkflows:inv.questions.filter(q=>q.category==='workflow').map(q=>q.questionText),userExpectations:inv.questions.filter(q=>q.category==='expectation').map(q=>q.questionText),systemLimitations:a.keyRequirements.filter(x=>/limit|problem|issue|error|slow/i.test(x)),recommendedFeatures:a.keyRequirements.slice(0,5).map(x=>({name:x,priority:'Medium',rationale:'Identified by local offline requirements analysis.'})),synthesizedAt:new Date().toISOString()};const next:any={...inv,status:'completed',completedAt:new Date().toISOString(),summaryReport:summary};await cacheInterview(next);return {interview:next,summaryReport:summary}; } };
api.interviews.delete = async (id:string) => { try {const r=await onlineInterviewDelete(id);await removeCachedInterview(id);return r;}catch(e){if(!isOnline()){await removeCachedInterview(id);return {success:true};}throw e;} };

api.share.getPublicInterview = async (token:string) => { try {const r:any=await onlineShareGet(token);await cacheShareInterview(token,r);return r;}catch(e){const c=await getCachedShareInterview(token);if(c)return c as any;throw e;} };
api.share.uploadVideo = async (token:string,questionId:string,videoId:string,blob:Blob,durationSeconds:number) => { if(isOnline())return onlineShareUpload(token,questionId,videoId,blob,durationSeconds);const blobUrl=await saveVideoBlob(videoId,blob,durationSeconds);const videoRecording:any={id:videoId,videoUrl:blobUrl,videoBlobKey:videoId,mimeType:blob.type||'video/webm',sourceMimeType:blob.type||'video/webm',deliveryMimeType:blob.type||'video/webm',storageStatus:'pending',durationSeconds,compressionStats:calculateCompressionStats(durationSeconds,blob.size),recordedAt:new Date().toISOString()};return {success:true,videoRecording}; };
api.share.submitAnswer = async (token:string,data:any) => { try {const r=await onlineShareSubmit(token,data);const c=await getCachedShareInterview(token);if(c)await cacheShareInterview(token,{...c,responses:{...c.responses,[data.questionId]:r.response}});return r;}catch(e){if(isOnline())throw e;const c=await getCachedShareInterview(token);if(!c)throw e;const q=c.questions.find(x=>x.id===data.questionId);const existing:any=(c.responses||{})[data.questionId];const response=existing?{...existing,...data}:{id:makeOfflineId('response'),interviewId:c.id,questionId:data.questionId,questionText:q?.questionText||'',category:q?.category||'workflow',responseText:data.responseText||'',audioDurationSeconds:data.audioDurationSeconds||0,videoRecording:data.videoRecording,aiTranscript:data.aiTranscript,createdAt:new Date().toISOString()};const next={...c,responses:{...c.responses,[data.questionId]:response}};await cacheShareInterview(token,next);await cacheInterview(next);return {success:true,response,isComplete:Object.keys(next.responses||{}).length>=next.questions.length};} };

api.gemini.transcribeVideo = (data:any) => onlineTranscribe(data).catch(()=>localTranscriptionFallback(data.questionText));
api.gemini.analyzeResponse = (data:any) => onlineAnalyze(data).catch(()=>localAnalyzeResponse(data) as any);
api.gemini.suggestQuestions = (data:any) => onlineSuggest(data).catch(()=>localSuggestQuestions(data) as any);
api.gemini.generateGuide = (data:any) => onlineGuide(data).catch(()=>localGuide(data.systemName,data.role) as any);
api.gemini.realtimeCopilot = (data:any) => onlineCopilot(data).catch(()=>localRealtimeCopilot(data) as any);
api.gemini.crossCompare = (systemId:string,interviewIds?:string[]) => onlineCompare(systemId,interviewIds).catch(async()=>localCrossCompare((await getCachedInterviews()).filter(i=>!interviewIds||interviewIds.includes(i.id))) as any);

api.aiChat.getModels = () => onlineModels().catch(()=>({models:LOCAL_AI_MODELS as any}));
api.aiChat.sendMessage = (data:any) => onlineChat(data).catch(()=>({reply:localChat(data.message,(data.history||[]).map((h:any)=>h.content).join('\n')),modelUsed:LOCAL_MODEL,timestamp:new Date().toISOString()} as any));

(api as any).offline = {
 snapshot:getOfflineSnapshot,lastSync:getLastSync,hasCachedUser:async()=>!!(await getCachedUser()),
 sync:async()=>{if(!isOnline())return{success:false,offline:true};const snapshot=await getOfflineSnapshot();const token=api.auth.getToken();if(!token||!snapshot.user)return{success:false,skipped:true};const response=await fetch('/api/offline/sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(snapshot)});if(!response.ok)throw new Error('Offline synchronization failed ('+response.status+')');const data=await response.json();await cacheSystems(data.systems||snapshot.systems);await cacheInterviews(data.interviews||snapshot.interviews);await markLastSync();return data;}
};

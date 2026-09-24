import type { InterviewSession, SystemUnderStudy, UserProfile } from '../types';

const DB_NAME = 'reqvoice_offline_v1';
const DB_VERSION = 1;
const STORE = 'kv';
type KVRecord = { key: string; value: any; updatedAt: string };
let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.reject(new Error('IndexedDB is not supported.'));
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => { const db=request.result; if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:'key'}); };
    request.onsuccess = () => { const db=request.result; db.onversionchange=()=>db.close(); resolve(db); };
    request.onerror = () => reject(request.error || new Error('Unable to open offline database.'));
  });
  return dbPromise;
}
async function put<T>(key:string,value:T){ try { const db=await getDB(); await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({key,value,updatedAt:new Date().toISOString()} satisfies KVRecord);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);}); } catch(e){console.warn('[ReqVoice offline] cache write failed',e);} }
async function get<T>(key:string):Promise<T|null>{ try{const db=await getDB();return await new Promise<T|null>((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).get(key);req.onsuccess=()=>resolve(req.result?.value??null);req.onerror=()=>reject(req.error);});}catch{return null;} }

export function isOnline(){ return typeof navigator==='undefined' ? true : navigator.onLine; }
export function makeOfflineId(prefix:string){ const random=typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36); return 'offline-'+prefix+'-'+random; }
export async function cacheUser(user:UserProfile|null){if(user) await put('user',user);}
export async function clearCachedUser(){await put('user',null);}
export function getCachedUser(){return get<UserProfile>('user');}
export async function cacheSystems(systems:SystemUnderStudy[]){await put('systems',systems);}
export function getCachedSystems(){return get<SystemUnderStudy[]>('systems').then(v=>v||[]);}
export async function cacheInterviews(interviews:InterviewSession[]){await put('interviews',sanitizeInterviews(interviews));}
export function getCachedInterviews(){return get<InterviewSession[]>('interviews').then(v=>v||[]);}
export async function cacheInterview(interview:InterviewSession){const all=await getCachedInterviews();const next=all.filter(i=>i.id!==interview.id);next.unshift(sanitizeInterview(interview));await cacheInterviews(next);if(interview.shareToken)await put('share:'+interview.shareToken,sanitizeInterview(interview));}
export async function cacheShareInterview(token:string,interview:InterviewSession){await put('share:'+token,sanitizeInterview(interview));}
export function getCachedShareInterview(token:string){return get<InterviewSession>('share:'+token);}
export async function removeCachedInterview(id:string){await cacheInterviews((await getCachedInterviews()).filter(i=>i.id!==id));}
export async function getOfflineSnapshot(){return {user:await getCachedUser(),systems:await getCachedSystems(),interviews:await getCachedInterviews()};}
export async function markLastSync(){await put('lastSync',new Date().toISOString());}
export function getLastSync(){return get<string>('lastSync');}
function sanitizeInterview(interview:InterviewSession){const cloned=JSON.parse(JSON.stringify(interview)) as InterviewSession;for(const response of Object.values(cloned.responses||{})){if(response?.videoRecording?.base64Data)delete response.videoRecording.base64Data;}return cloned;}
function sanitizeInterviews(interviews:InterviewSession[]){return interviews.map(sanitizeInterview);}

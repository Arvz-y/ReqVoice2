import fs from 'fs';

const patch = (file, replacer) => {
  const source = fs.readFileSync(file, 'utf8');
  const next = replacer(source);
  if (next !== source) fs.writeFileSync(file, next);
};

patch('server.ts', (source) => {
  if (source.includes("app.post('/api/offline/sync'")) return source;
  const marker = 'const server = app.listen(PORT, "0.0.0.0", () => {';
  const route = [
    "app.post('/api/offline/sync', async (req: Request, res: Response) => {",
    "  try {",
    "    const user = getAuthUser(req);",
    "    if (!user) return res.status(401).json({ error: 'Unauthorized' });",
    "    const incomingSystems = Array.isArray(req.body?.systems) ? req.body.systems : [];",
    "    const incomingInterviews = Array.isArray(req.body?.interviews) ? req.body.interviews : [];",
    "    for (const raw of incomingSystems) {",
    "      if (!raw || raw.userId !== user.id || !raw.id || !raw.name) continue;",
    "      const existing = systemsDb.find((s) => s.id === raw.id);",
    "      if (existing && existing.userId !== user.id) continue;",
    "      const system = { id:String(raw.id), userId:user.id, name:String(raw.name), type:String(raw.type || 'Enterprise System'), description:String(raw.description || ''), lifecycleState:['existing','proposed','modernization'].includes(raw.lifecycleState) ? raw.lifecycleState : 'proposed', targetRoles:Array.isArray(raw.targetRoles) ? raw.targetRoles.map(String) : [], createdAt:String(raw.createdAt || new Date().toISOString()) } as StoredSystem;",
    "      if (existing) systemsDb[systemsDb.indexOf(existing)] = system; else systemsDb.push(system);",
    "      await persistSystemRemotely(system);",
    "    }",
    "    for (const raw of incomingInterviews) {",
    "      if (!raw || raw.userId !== user.id || !raw.id || !raw.systemId || !raw.shareToken) continue;",
    "      const existing = interviewsDb.find((i) => i.id === raw.id);",
    "      if (existing && existing.userId !== user.id) continue;",
    "      const conflictingToken = interviewsDb.find((i) => i.shareToken === raw.shareToken && i.id !== raw.id && i.userId !== user.id);",
    "      if (conflictingToken) continue;",
    "      const interview = { ...raw, id:String(raw.id), userId:user.id, systemId:String(raw.systemId), systemName:String(raw.systemName || ''), responses:raw.responses && typeof raw.responses === 'object' ? raw.responses : {}, questions:Array.isArray(raw.questions) ? raw.questions : [], shareToken:String(raw.shareToken) } as StoredInterview;",
    "      if (existing) interviewsDb[interviewsDb.indexOf(existing)] = interview; else interviewsDb.push(interview);",
    "      saveInterviewToDatabase(interview);",
    "      await persistInterviewRemotely(interview);",
    "    }",
    "    res.json({ success:true, systems:systemsDb.filter(s=>s.userId===user.id), interviews:interviewsDb.filter(i=>i.userId===user.id), syncedAt:new Date().toISOString() });",
    "  } catch (error:any) {",
    "    console.error('[OFFLINE SYNC] failed:', error?.message || error);",
    "    res.status(500).json({ error:error?.message || 'Offline synchronization failed', retryable:true });",
    "  }",
    "});",
    ""
  ].join('\n');
  if (!source.includes(marker)) throw new Error('ReqVoice server patch marker not found');
  return source.replace(marker, route + marker);
});

patch('server.ts', (source) => {
  source = source.replace(
    "  if (ai && mediaData) {\n    try {\n      // Prefer the server-side video database record",
    "  if (ai && mediaData) {\n    let contents: any;\n    try {\n      // Prefer the server-side video database record"
  );
  source = source.replace("      const contents = {\n        parts:", "      contents = {\n        parts:");
  source = source.replace("        mediaBuffer = remoteVideo.buffer;", "        mediaBuffer = remoteVideo.buffer as any;");
  source = source.replace(
    "  const modelErrors: string[] = [];",
    "  const modelErrors: string[] = [];\n  const modelCandidates = [\"gemini-3.5-flash-lite\", \"gemini-3.8-flash\", \"gemini-3.7-flash\", \"gemini-3.6-flash\"];"
  );
  return source;
});

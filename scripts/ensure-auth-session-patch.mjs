import fs from 'node:fs';
import path from 'node:path';

const serverPath = path.resolve('server.ts');
const apiPath = path.resolve('src/lib/api.ts');
const serverSource = fs.readFileSync(serverPath, 'utf8');

let code = serverSource;

if (!code.includes('AUTH_TOKEN_TTL_SECONDS') || !code.includes('createAuthToken')) {
  code = code.replace(
    'import fs from "fs";\n',
    'import fs from "fs";\nimport crypto from "crypto";\n'
  );

  const authStart = code.indexOf('// Active authenticated sessions: token -> StoredUser');
  const authEnd = code.indexOf('// ========================\n// API ROUTES', authStart);
  if (authStart < 0 || authEnd < 0) {
    throw new Error('[auth-patch] Could not locate authentication block in server.ts');
  }

  const authBlock = `// Authentication is signed and stateless so a Render process restart does not
// invalidate a token issued moments earlier. The in-memory map remains a fast cache.
const activeSessions = new Map<string, StoredUser>();
const revokedTokens = new Set<string>();
const AUTH_SECRET = process.env.AUTH_SECRET || "reqvoiceV2-development-auth-secret-change-me";
const AUTH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

type AuthTokenPayload = Omit<StoredUser, "password"> & { iat: number; exp: number };

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function createAuthToken(user: StoredUser): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AuthTokenPayload = {
    ...sanitizeUser(user),
    iat: now,
    exp: now + AUTH_TOKEN_TTL_SECONDS,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", AUTH_SECRET).update(encoded).digest("base64url");
  return "rv2." + encoded + "." + signature;
}

function verifyAuthToken(token: string): StoredUser | null {
  if (revokedTokens.has(token)) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "rv2") return null;

  const encoded = parts[1];
  const providedSignature = parts[2];
  const expectedSignature = crypto.createHmac("sha256", AUTH_SECRET).update(encoded).digest("base64url");
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encoded));
    if (!payload?.id || !payload?.username || !payload?.exp) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

    const storedUser = usersDb.find((u) => u.id === payload.id);
    if (storedUser) return storedUser;

    // The account record may be missing after an in-memory restart, but the
    // signed identity is still valid for the active browser session.
    return {
      id: payload.id,
      name: payload.name || "ReqVoice User",
      username: payload.username,
      email: payload.email || "",
      password: "",
      role: payload.role || "Requirements Engineer",
      department: payload.department || "Systems Engineering",
      avatarUrl: payload.avatarUrl || "",
      bio: payload.bio || "",
      isFirstTime: Boolean(payload.isFirstTime),
      hasCompletedTutorial: Boolean(payload.hasCompletedTutorial),
      createdAt: payload.createdAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function getAuthUser(req: Request): StoredUser | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\\s+/i, "").trim();
  if (!token || revokedTokens.has(token)) return null;

  const cached = activeSessions.get(token);
  if (cached) return cached;

  const verified = verifyAuthToken(token);
  if (verified) activeSessions.set(token, verified);
  return verified;
}

function sanitizeUser(user: StoredUser) {
  const { password, ...safe } = user;
  return safe;
}

`;

  code = code.slice(0, authStart) + authBlock + code.slice(authEnd);

  code = code.replace(
    'const token = `rv2_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;\n  activeSessions.set(token, user);',
    'const token = createAuthToken(user);\n  activeSessions.set(token, user);'
  );
  code = code.replace(
    'const token = `rv2_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;\n  activeSessions.set(token, newUser);',
    'const token = createAuthToken(newUser);\n  activeSessions.set(token, newUser);'
  );

  code = code.replace(
    '    activeSessions.delete(token);',
    '    activeSessions.delete(token);\n    revokedTokens.add(token);'
  );

  const profileResponse = '  res.json({ success: true, user: sanitizeUser(user) });\n});\n\napp.put("/api/auth/password"';
  if (code.includes(profileResponse)) {
    code = code.replace(
      profileResponse,
      '  const authHeader = req.headers.authorization;\n  const oldToken = authHeader ? authHeader.replace(/^Bearer\\s+/i, "").trim() : "";\n  const token = createAuthToken(user);\n  if (oldToken) {\n    activeSessions.delete(oldToken);\n    revokedTokens.add(oldToken);\n  }\n  activeSessions.set(token, user);\n  res.json({ success: true, user: sanitizeUser(user), token });\n});\n\napp.put("/api/auth/password"'
    );
  }

  fs.writeFileSync(serverPath, code, 'utf8');
  process.stdout.write('[auth-patch] Applied stateless Render-safe authentication.\n');
} else {
  process.stdout.write('[auth-patch] Server auth patch already present.\n');
}

// Keep the browser-side auth token in sync when profile editing rotates it.
let apiSource = fs.readFileSync(apiPath, 'utf8');
const profileStart = apiSource.indexOf('    updateProfile: (data: {');
const profileEnd = apiSource.indexOf('    changePassword:', profileStart);
if (profileStart >= 0 && profileEnd > profileStart) {
  const profileBlock = `    updateProfile: async (data: {
      name?: string;
      username?: string;
      department?: string;
      role?: string;
      avatarUrl?: string;
      bio?: string;
    }) => {
      const res = await request<{ success: boolean; user: any; token?: string }>('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      if (res.token) setAuthToken(res.token);
      return res;
    },\n`;
  apiSource = apiSource.slice(0, profileStart) + profileBlock + apiSource.slice(profileEnd);
  fs.writeFileSync(apiPath, apiSource, 'utf8');
}

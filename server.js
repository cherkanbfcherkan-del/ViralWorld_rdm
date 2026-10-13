require("dotenv").config();
const express = require("express");
const session = require("express-session");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const PgSession = require("connect-pg-simple")(session);

const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const APP_BASE_URL = process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI || `${APP_BASE_URL}/auth/tiktok/callback`;

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
const pgPool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
}) : null;
const sessionConfig = {
  name: "vwrdm.sid",
  secret: process.env.SESSION_SECRET || "DEV-ONLY-change-this-before-deployment",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 8
  }
};
if (pgPool) {
  sessionConfig.store = new PgSession({ pool: pgPool, createTableIfMissing: true, tableName: "user_sessions" });
}
app.use(session(sessionConfig));
app.use(express.static(path.join(__dirname, "public")));

function configured() {
  return CLIENT_KEY && CLIENT_SECRET && REDIRECT_URI &&
    !CLIENT_KEY.startsWith("remplace_") &&
    !CLIENT_SECRET.startsWith("remplace_");
}

app.get("/api/status", (req, res) => {
  res.json({
    configured: Boolean(configured()),
    connected: Boolean(req.session.tiktok && req.session.tiktok.access_token),
    appName: "ViralWorld_rdm"
  });
});

app.get("/auth/tiktok", (req, res) => {
  if (!configured()) {
    return res.status(503).send("Connexion TikTok non configurée. Suis le guide README.md et remplis les variables .env.");
  }
  const state = crypto.randomBytes(24).toString("hex");
  req.session.tiktokOAuthState = state;
  const params = new URLSearchParams({
    client_key: CLIENT_KEY,
    response_type: "code",
    scope: "user.info.basic,video.list",
    redirect_uri: REDIRECT_URI,
    state
  });
  res.redirect(`https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`);
});

app.get("/auth/tiktok/callback", async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;
    if (error) return res.status(400).send(`Autorisation refusée : ${String(error_description || error)}`);
    if (!code || !state || state !== req.session.tiktokOAuthState) {
      return res.status(400).send("Échec de vérification OAuth (state). Réessaie depuis le site.");
    }
    delete req.session.tiktokOAuthState;

    const body = new URLSearchParams({
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      code: String(code),
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI
    });
    const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
      console.error("TikTok token exchange failed:", tokenData.error || tokenData.message || tokenResponse.status);
      return res.status(502).send("TikTok n'a pas confirmé la connexion. Vérifie les produits, scopes et Redirect URI dans le portail développeur.");
    }

    req.session.tiktok = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      expires_at: Date.now() + Number(tokenData.expires_in || 86400) * 1000,
      open_id: tokenData.open_id,
      scope: tokenData.scope || ""
    };
    res.redirect(`${APP_BASE_URL}/?tiktok=connected`);
  } catch (err) {
    console.error("OAuth callback error:", err.message);
    res.status(500).send("Une erreur est survenue pendant la connexion TikTok.");
  }
});

async function getValidAccessToken(req) {
  const token = req.session.tiktok;
  if (!token?.access_token) return null;
  if (Date.now() < token.expires_at - 60_000) return token.access_token;
  if (!token.refresh_token) return null;
  const body = new URLSearchParams({
    client_key: CLIENT_KEY,
    client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: token.refresh_token
  });
  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await response.json();
  if (!response.ok || data.error || !data.access_token) {
    delete req.session.tiktok;
    throw new Error("La session TikTok a expiré. Reconnecte ton compte.");
  }
  req.session.tiktok = {
    ...token,
    access_token: data.access_token,
    refresh_token: data.refresh_token || token.refresh_token,
    expires_at: Date.now() + Number(data.expires_in || 86400) * 1000
  };
  return req.session.tiktok.access_token;
}

async function tiktokGet(url, accessToken) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await response.json();
  if (!response.ok || data.error && data.error.code !== "ok") {
    throw new Error(data.error?.message || `TikTok API error ${response.status}`);
  }
  return data.data || {};
}

app.get("/api/tiktok/me", async (req, res) => {
  let token;
  try { token = await getValidAccessToken(req); } catch (err) { return res.status(401).json({ error: "reauth_required", message: err.message }); }
  if (!token) return res.status(401).json({ error: "not_connected" });
  try {
    const data = await tiktokGet(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",
      token
    );
    res.json(data.user || {});
  } catch (err) {
    res.status(502).json({ error: "tiktok_api_error", message: err.message });
  }
});

app.get("/api/tiktok/videos", async (req, res) => {
  let token;
  try { token = await getValidAccessToken(req); } catch (err) { return res.status(401).json({ error: "reauth_required", message: err.message }); }
  if (!token) return res.status(401).json({ error: "not_connected" });
  try {
    const url = "https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,duration,cover_image_url,share_url,like_count,comment_count,share_count,view_count,create_time";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ max_count: 20 })
    });
    const data = await response.json();
    if (!response.ok || data.error && data.error.code !== "ok") {
      return res.status(502).json({ error: "tiktok_api_error", message: data.error?.message || "TikTok API error" });
    }
    res.json(data.data || { videos: [] });
  } catch (err) {
    res.status(502).json({ error: "tiktok_api_error", message: err.message });
  }
});

app.post("/auth/tiktok/disconnect", (req, res) => {
  delete req.session.tiktok;
  req.session.save(() => res.json({ ok: true }));
});

app.get("/api/config", (_req, res) => {
  res.json({ privacyUrl: `${APP_BASE_URL}/privacy.html`, termsUrl: `${APP_BASE_URL}/terms.html` });
});

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`ViralWorld_rdm est lancé : ${APP_BASE_URL}`);
  if (!configured()) console.log("Mode local : configure les variables TikTok pour activer la connexion.");
  if (!pgPool && process.env.NODE_ENV === "production") console.warn("Attention : DATABASE_URL absent, les sessions seront perdues lors des redémarrages ou mises en veille.");
});

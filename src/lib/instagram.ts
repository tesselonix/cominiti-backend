/**
 * Instagram API with Business Login Service
 * Handles OAuth flow and data fetching from Instagram Graph API
 */

const INSTAGRAM_API_BASE = 'https://api.instagram.com';
const GRAPH_API_BASE = 'https://graph.instagram.com';

interface TokenResponse {
  access_token: string;
  user_id: number;
}

interface LongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface InstagramProfile {
  id: string;
  username: string;
  account_type: string;
  media_count: number;
}

interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url: string;
  permalink: string;
  timestamp: string;
  thumbnail_url?: string;
}

interface MediaResponse {
  data: InstagramMedia[];
  paging?: {
    cursors: { before: string; after: string };
    next?: string;
  };
}

export function getAuthUrl(redirectUri: string): string {
  const appId = process.env.INSTAGRAM_APP_ID;
  // Use Instagram Business Login scope
  const scope = 'instagram_business_basic';
  
  return `https://www.instagram.com/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`;
}

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<TokenResponse> {
  const response = await fetch(`${INSTAGRAM_API_BASE}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID!,
      client_secret: process.env.INSTAGRAM_APP_SECRET!,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code: code,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_message || 'Failed to exchange code for token');
  }

  return response.json();
}

export async function getLongLivedToken(shortLivedToken: string): Promise<LongLivedTokenResponse> {
  const url = new URL(`${GRAPH_API_BASE}/access_token`);
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', process.env.INSTAGRAM_APP_SECRET!);
  url.searchParams.set('access_token', shortLivedToken);

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to get long-lived token');
  }

  return response.json();
}

export async function refreshLongLivedToken(token: string): Promise<LongLivedTokenResponse> {
  const url = new URL(`${GRAPH_API_BASE}/refresh_access_token`);
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', token);

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to refresh token');
  }

  return response.json();
}

export async function getProfile(accessToken: string): Promise<InstagramProfile> {
  const url = new URL(`${GRAPH_API_BASE}/me`);
  url.searchParams.set('fields', 'id,username,account_type,media_count');
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch profile');
  }

  return response.json();
}

export async function getMedia(accessToken: string, limit = 25): Promise<InstagramMedia[]> {
  const url = new URL(`${GRAPH_API_BASE}/me/media`);
  url.searchParams.set('fields', 'id,caption,media_type,media_url,permalink,timestamp,thumbnail_url');
  url.searchParams.set('limit', limit.toString());
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch media');
  }

  const data: MediaResponse = await response.json();
  return data.data;
}

// ============================================================
// UPAg API Client — Resilient Government of India API Client
// Unified Portal for Agricultural Statistics (upag.gov.in)
// ============================================================

export interface UpagApiConfig {
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
}

export interface UpagCropQuery {
  state?: string;
  season?: string;
  crop?: string;
  year?: string;
}

export class UpagApiClient {
  private config: UpagApiConfig;
  private authToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.config = {
      baseUrl: (process.env.UPAG_API_BASE_URL || 'https://data.upag.gov.in').replace(/\/$/, ''),
      apiKey: process.env.UPAG_API_KEY || process.env.UPAG_TOKEN || undefined,
      timeoutMs: 5000, // 5s timeout
    };
  }

  /**
   * Check if client has authentication configured
   */
  hasAuth(): boolean {
    return Boolean(this.config.apiKey);
  }

  /**
   * Attempt authentication with UPAg Open API if credentials are provided
   */
  private async authenticate(): Promise<string | null> {
    if (this.authToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.authToken;
    }

    if (!this.config.apiKey) {
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      // UPAg OAuth2 login endpoint discovered from openapi.json
      const resp = await fetch(`${this.config.baseUrl}/v1/upag/api-data-share/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'password',
          username: process.env.UPAG_USERNAME || '',
          password: process.env.UPAG_PASSWORD || this.config.apiKey,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json() as { access_token?: string; expires_in?: number };
        if (data.access_token) {
          this.authToken = data.access_token;
          this.tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
          return this.authToken;
        }
      }
    } catch (err: any) {
      console.warn('[UpagApiClient] Auth attempt failed:', err?.message || err);
    }

    return null;
  }

  /**
   * Query crop master or domestic calendar from UPAg Open API
   */
  async fetchLiveCropData(query: UpagCropQuery): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const token = await this.authenticate();
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else if (this.config.apiKey) {
        headers['X-API-KEY'] = this.config.apiKey;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      // Use discovered endpoints from UPAg OpenAPI
      const url = `${this.config.baseUrl}/v1/upag/api-data-share/crop/master`;

      const resp = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        return {
          success: false,
          error: `UPAg API responded with status ${resp.status} (${resp.statusText})`,
        };
      }

      const data = await resp.json();
      return { success: true, data };
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError';
      return {
        success: false,
        error: isTimeout ? 'UPAg API request timed out (5s)' : (err?.message || 'Network failure'),
      };
    }
  }
}

export const upagApiClient = new UpagApiClient();

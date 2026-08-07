import { API_CONFIG } from '../config/Config';

export default class ApiService {
  static token = null; // Optional: token for auth

  static DEFAULT_TIMEOUT_MS = 15000;
  static MAX_RETRIES = 2;
  static RETRY_DELAY_MS = 700;

  static get getBaseUrl() {
    return API_CONFIG.BASE_URL;
  }

  static setToken(newToken) {
    this.token = newToken;
  }

  static sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static buildUrl(endpoint) {
    const separator = endpoint.includes('?') ? '&' : '?';
    return `${API_CONFIG.BASE_URL}/${endpoint}${separator}password=${encodeURIComponent(API_CONFIG.API_PASSWORD)}`;
  }

  static sanitizeUrl(url) {
    return url.replace(/password=[^&]+/i, 'password=***');
  }

  static isRetryableStatus(status) {
    return status === 408 || status === 429 || status >= 500;
  }

  static isRetryableNetworkError(error) {
    const message = (error?.message || '').toLowerCase();
    return (
      message.includes('network request failed') ||
      message.includes('failed to fetch') ||
      message.includes('timed out') ||
      message.includes('origin web server returned an invalid or incomplete response') ||
      message.includes('cloudflare')
    );
  }

  static formatErrorMessage(status, statusText, bodyText) {
    const body = (bodyText || '').toString();
    const lowerBody = body.toLowerCase();
    const cloudflareOriginIssue =
      lowerBody.includes('origin web server returned an invalid or incomplete response') ||
      lowerBody.includes('cloudflare') ||
      status === 520 ||
      status === 521 ||
      status === 522 ||
      status === 523 ||
      status === 524;

    if (cloudflareOriginIssue) {
      return 'The server is temporarily unavailable. Please try again in a moment.';
    }

    if (status === 401 || status === 403) {
      return 'Authorization failed. Please check API credentials.';
    }

    if (status === 404) {
      return 'Requested resource was not found.';
    }

    if (status >= 500) {
      return 'Server error. Please try again later.';
    }

    const compactBody = body.replace(/\s+/g, ' ').trim();
    return `HTTP ${status} ${statusText}${compactBody ? `: ${compactBody.slice(0, 300)}` : ''}`;
  }

  static toUserMessage(error) {
    if (error?.isCloudflareOriginError) {
      return 'Sunucu geçici olarak yanıt veremiyor. Lütfen birazdan tekrar deneyin.';
    }
    if (error?.isTimeoutError) {
      return 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.';
    }
    if (error?.isNetworkError) {
      return 'Ağ bağlantısı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.';
    }
    return error?.message || 'Beklenmeyen bir hata oluştu.';
  }

  static async request(endpoint, method = 'GET', body = null) {
    const urlWithPassword = this.buildUrl(endpoint);
    const safeUrlForLog = this.sanitizeUrl(urlWithPassword);
    
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    const maxAttempts = method === 'GET' ? this.MAX_RETRIES + 1 : 1;
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.DEFAULT_TIMEOUT_MS);
      try {
        const response = await fetch(urlWithPassword, { ...config, signal: controller.signal });
        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type') || '';

        if (!response.ok) {
          let message = `HTTP ${response.status} ${response.statusText}`;
          if (contentType.includes('application/json')) {
            const data = await response.json();
            message = data?.detail || data?.message || message;
          } else {
            const text = await response.text();
            message = this.formatErrorMessage(response.status, response.statusText, text);
          }

          const httpError = new Error(message);
          httpError.status = response.status;
          httpError.isCloudflareOriginError = message.toLowerCase().includes('temporarily unavailable');

          if (attempt < maxAttempts && this.isRetryableStatus(response.status)) {
            await this.sleep(this.RETRY_DELAY_MS * attempt);
            continue;
          }

          throw httpError;
        }

        if (contentType.includes('application/json')) {
          return await response.json();
        }

        const text = await response.text();
        throw new Error(`Unexpected content-type: ${contentType}. Body: ${text.slice(0, 300)}`);
      } catch (error) {
        clearTimeout(timeoutId);

        const message = (error?.message || '').toLowerCase();
        if (message.includes('aborted') || error?.name === 'AbortError') {
          error.isTimeoutError = true;
          error.message = 'Request timed out';
        }

        if (this.isRetryableNetworkError(error)) {
          error.isNetworkError = true;
        }

        lastError = error;

        if (attempt < maxAttempts && (error?.isNetworkError || this.isRetryableStatus(error?.status || 0))) {
          await this.sleep(this.RETRY_DELAY_MS * attempt);
          continue;
        }

        console.error(`[${method}] ${safeUrlForLog} error:`, error);
        throw error;
      }
    }

    console.error(`[${method}] ${safeUrlForLog} error:`, lastError);
    throw lastError || new Error('Request failed');
  }

  static get(endpoint) {
    return this.request(endpoint, 'GET');
  }
 
  static post(endpoint, body) {
    return this.request(endpoint, 'POST', body);
  }

  static put(endpoint, body) {
    return this.request(endpoint, 'PUT', body);
  }

  static delete(endpoint) {
    return this.request(endpoint, 'DELETE');
  }

  //_______________________Auth operations__________________________

  static async register(email, password) {
    return this.request('auth/register', 'POST', { email, password });
  }

  static async login(email, password) {
    return this.request('auth/login', 'POST', { email, password });
  }

  static async getMe() {
    return this.request('me', 'GET');
  }

  static async deleteAccount() {
    return this.request('auth/account', 'DELETE');
  }

  static async requestPasswordReset(email) {
    return this.request('auth/request-password-reset', 'POST', { email });
  }

  static async verifyResetCode(code) {
    return this.request('auth/verify-reset-code', 'POST', { code });
  }

  static async resetPassword(token, newPassword) {
    return this.request('auth/reset-password', 'POST', { token, new_password: newPassword });
  }

  //_______________________Favorites operations__________________________

  static async listFavorites() {
    return this.request('favorites', 'GET');
  }

  static async addFavorite(body) {
    return this.request('favorites', 'POST', body);
  }

  static async removeFavorite(ticker) {
    return this.request(`favorites/${encodeURIComponent(ticker)}`, 'DELETE');
  }

  //_______________________Finnhub operations__________________________
  
  // Get stock recommendation trends (proxy via backend)
  static async getFinnhubRecommendationTrends(symbol) {
    return this.request(`stocks/recommendation-trends/${encodeURIComponent(symbol)}`, 'GET');
  }

  // Company news (proxy via backend). Dates should be 'YYYY-MM-DD'
  static async getFinnhubCompanyNews(symbol, from, to) {
    return this.request(`stocks/company-news/${encodeURIComponent(symbol)}?start=${encodeURIComponent(from)}&end=${encodeURIComponent(to)}`, 'GET');
  }
}

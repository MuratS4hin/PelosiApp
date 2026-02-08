import { API_CONFIG, FINNHUB_CONFIG } from '../config/Config';

export default class ApiService {
  static token = null; // Optional: token for auth

  static get getBaseUrl() {
    return API_CONFIG.BASE_URL;
  }

  static setToken(newToken) {
    this.token = newToken;
  }

  static async request(endpoint, method = 'GET', body = null) {
    // Add password as query parameter
    const separator = endpoint.includes('?') ? '&' : '?';
    const urlWithPassword = `${API_CONFIG.BASE_URL}/${endpoint}${separator}password=${encodeURIComponent(API_CONFIG.API_PASSWORD)}`;
    
    const headers = {
      'Content-Type': 'application/json',
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

    try {
      const response = await fetch(urlWithPassword, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error(`[${method}] ${urlWithPassword} error:`, error);
      throw error;
    }
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

  // Fetch company news from Finnhub (free tier available). Dates should be 'YYYY-MM-DD'
  static async getFinnhubCompanyNews(symbol, from, to) {
    if (!FINNHUB_CONFIG.API_KEY) {
      throw new Error('FINNHUB_API_KEY not set in Config.js');
    }
    const url = `${FINNHUB_CONFIG.BASE_URL}/company-news?symbol=${encodeURIComponent(symbol)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&token=${encodeURIComponent(FINNHUB_CONFIG.API_KEY)}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Finnhub request failed');
      return data;
    } catch (err) {
      console.error('[FINNHUB] fetch error:', err);
      throw err;
    }
  }
}

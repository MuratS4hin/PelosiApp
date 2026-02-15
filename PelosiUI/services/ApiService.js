import { API_CONFIG } from '../config/Config';

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

  //_______________________Favorites operations__________________________

  static async listFavorites() {
    return this.request('favorites', 'GET');
  }

  static async addFavorite(ticker) {
    return this.request('favorites', 'POST', { ticker });
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

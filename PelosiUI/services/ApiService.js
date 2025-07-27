const BASE_URL = 'http://192.168.1.5:8000'; // Change this accordingly

export default class ApiService {
  static token = null; // Optional: token for auth

  static get getBaseUrl() {
    return BASE_URL;
  }

  static setToken(newToken) {
    this.token = newToken;
  }

  static async request(endpoint, method = 'GET', body = null) {
    const url = `${BASE_URL}/${endpoint}`;
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
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error(`[${method}] ${url} error:`, error);
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
}

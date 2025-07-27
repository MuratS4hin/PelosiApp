import AsyncStorage from '@react-native-async-storage/async-storage';

export default class StorageService {
  static async setItem(key, value) {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (e) {
      console.error(`Error saving ${key}:`, e);
    }
  }

  static async getItem(key) {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
      console.error(`Error loading ${key}:`, e);
      return null;
    }
  }

  static async removeItem(key) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.error(`Error removing ${key}:`, e);
    }
  }

  static async clearAll() {
    try {
      await AsyncStorage.clear();
    } catch (e) {
      console.error('Error clearing storage:', e);
    }
  }
}

//ProfilelScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, FlatList } from 'react-native';
import ApiService from '../services/ApiService';
import UseAppStore from '../store/UseAppStore';

export default function ProfileScreen({ navigation, route }) {
  const { redirectTo, redirectParams } = route.params || {};
  const user = UseAppStore((s) => s.user);
  const token = UseAppStore((s) => s.token);
  const setAuth = UseAppStore((s) => s.setAuth);
  const logout = UseAppStore((s) => s.logout);
  const setMyAssets = UseAppStore((s) => s.setMyAssets);

  const [activeTab, setActiveTab] = useState('favorites');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [favLoading, setFavLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = isLogin
        ? await ApiService.login(email, password)
        : await ApiService.register(email, password);
      ApiService.setToken(res.token);
      setAuth({ user: res.user, token: res.token });
      if (redirectTo) {
        navigation.replace(redirectTo, redirectParams || {});
      }
    } catch (e) {
      Alert.alert('Authentication failed', e.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    ApiService.setToken(null);
    logout();
  };

  useEffect(() => {
    const loadFavorites = async () => {
      if (!user || !token || activeTab !== 'favorites') {
        setFavorites([]);
        return;
      }
      setFavLoading(true);
      try {
        const res = await ApiService.listFavorites();
        const favs = Array.isArray(res) ? res : [];
        setFavorites(favs);
        setMyAssets(
          favs.map((f) => ({
            ticker: f.ticker,
            addedDate: f.created_at,
            id: `${f.ticker}-${f.created_at || Date.now()}`,
          }))
        );
      } catch (e) {
        console.warn('Could not load favorites:', e.message || e);
        setFavorites([]);
      } finally {
        setFavLoading(false);
      }
    };
    loadFavorites();
  }, [user, activeTab]);

  const formatFavoriteDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const daysAgo = Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
    return `${d.toLocaleDateString()}${Number.isFinite(daysAgo) ? ` • ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago` : ''}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'favorites' && styles.tabButtonActive]}
          onPress={() => setActiveTab('favorites')}
        >
          <Text style={[styles.tabText, activeTab === 'favorites' && styles.tabTextActive]}>Favorites</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'account' && styles.tabButtonActive]}
          onPress={() => setActiveTab('account')}
        >
          <Text style={[styles.tabText, activeTab === 'account' && styles.tabTextActive]}>Account</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'favorites' ? (
        <View style={styles.card}>
          {!user ? (
            <Text style={styles.label}>Log in to see your favorites.</Text>
          ) : favLoading ? (
            <Text style={styles.label}>Loading...</Text>
          ) : favorites.length ? (
            <FlatList
              data={favorites}
              keyExtractor={(item, idx) => `${item.ticker}-${idx}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.favRow}
                  onPress={() => navigation.navigate('StockDetail', { ticker: item.ticker })}
                >
                  <View style={styles.favLeft}>
                    <Text style={styles.favTicker}>{item.ticker}</Text>
                    <Text style={styles.favDate}>
                      {formatFavoriteDate(item.created_at)}
                    </Text>
                  </View>
                  <Text style={styles.favChevron}>›</Text>
                </TouchableOpacity>
              )}
            />
          ) : (
            <Text style={styles.label}>No favorites yet.</Text>
          )}
        </View>
      ) : user ? (
        <View style={styles.card}>
          <Text style={styles.label}>Signed in as</Text>
          <Text style={styles.value}>{user.email}</Text>
          <TouchableOpacity style={styles.buttonSecondary} onPress={handleLogout}>
            <Text style={styles.buttonTextSecondary}>Log out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.subtitle}>{isLogin ? 'Log in' : 'Create account'}</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity
            style={styles.button}
            onPress={handleAuth}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Please wait...' : (isLogin ? 'Log in' : 'Sign up')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.link}
            onPress={() => setIsLogin(!isLogin)}
          >
            <Text style={styles.linkText}>
              {isLogin ? 'Need an account? Sign up' : 'Already have an account? Log in'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F9FAFB' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tabButton: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#F3F4F6' },
  tabButtonActive: { backgroundColor: '#007AFF' },
  tabText: { textAlign: 'center', color: '#111827', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#eee' },
  subtitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  label: { fontSize: 14, color: '#6B7280' },
  value: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  favRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderColor: '#E5E7EB' },
  favLeft: { flexDirection: 'column' },
  favTicker: { fontSize: 16, fontWeight: '600' },
  favDate: { color: '#6B7280' },
  favChevron: { fontSize: 22, color: '#9CA3AF' },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    marginVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  button: { backgroundColor: '#007AFF', padding: 14, borderRadius: 8, marginTop: 10 },
  buttonText: { textAlign: 'center', color: '#fff', fontSize: 16 },
  buttonSecondary: { backgroundColor: '#F3F4F6', padding: 12, borderRadius: 8, marginTop: 12 },
  buttonTextSecondary: { textAlign: 'center', color: '#111827', fontSize: 16 },
  link: { marginTop: 12 },
  linkText: { color: '#007AFF', textAlign: 'center' },
});

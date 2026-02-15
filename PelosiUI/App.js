import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import { ActivityIndicator, View } from 'react-native';
import UseAppStore from './store/UseAppStore';
import ApiService from './services/ApiService';

export default function App() {
  const [loading, setLoading] = useState(true);
  const token = UseAppStore((s) => s.token);

  useEffect(() => {
    const init = async () => {
      setLoading(false);
    };

    init();
  }, []);

  useEffect(() => {
    ApiService.setToken(token);
  }, [token]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
}

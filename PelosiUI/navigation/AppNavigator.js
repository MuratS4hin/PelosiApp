import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, Image, View } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import InsightsScreen from '../screens/InsightsScreen';
import SimulatorScreen from '../screens/SimulatorScreen';
import TransparencyScreen from '../screens/TransparencyScreen';
import NotificationPrefsScreen from '../screens/NotificationPrefsScreen';
import MyAssetsScreen from '../screens/MyAssetsScreen';
import AddAssetScreen from '../screens/AddAssetScreen';
import StockDetailScreen from '../screens/StockDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import UseAppStore from '../store/UseAppStore';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const user = UseAppStore((s) => s.user);
  const hasSeenOnboarding = UseAppStore((s) => s.hasSeenOnboarding);

  return (
    <Stack.Navigator initialRouteName={hasSeenOnboarding ? 'Home' : 'Onboarding'}>
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }) => ({
          title: 'Portrace',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 6 }}>
              <TouchableOpacity
                style={{ padding: 4 }}
                onPress={() => navigation.navigate('Insights')}
              >
                <Icon name="bell-outline" size={24} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={{ padding: 4 }}
                onPress={() => navigation.navigate('MyAssetsScreen')}
              >
                <Icon name="bookmark-outline" size={24} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={{ padding: 4, marginLeft: 2 }}
                onPress={() => navigation.navigate('ProfileScreen')}
              >
                <Image
                  source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }}
                  style={{ width: 28, height: 28, borderRadius: 20 }}
                />
              </TouchableOpacity>
            </View>
          ),
        })}
      />

      <Stack.Screen
        name="MyAssetsScreen"
        component={MyAssetsScreen}
        options={({ navigation }) => ({
          title: 'My Assets',
          headerRight: () => (
            <TouchableOpacity
              style={{ marginRight: 10 }}
              onPress={() => navigation.navigate('AddAssetScreen')}
            >
              <Icon name="plus" size={28} color="#000"
              />
            </TouchableOpacity>
          ),
        })}
      />

      <Stack.Screen
        name="AddAssetScreen"
        component={AddAssetScreen}
        options={{
          title: 'Add New Asset',
        }}
      />

      <Stack.Screen
        name="ProfileScreen"
        component={ProfileScreen}
        options={{
          title: 'Profile',
        }}
      />

      <Stack.Screen
        name="StockDetail"
        component={StockDetailScreen}
        options={{
          title: 'Stock Detail',
        }}
      />

      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{
          title: 'Forgot Password',
          headerBackTitle: 'Back',
        }}
      />

      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{
          title: 'Reset Password',
          headerBackTitle: 'Back',
        }}
      />

      <Stack.Screen
        name="Insights"
        component={InsightsScreen}
        options={{ title: 'Insights' }}
      />

      <Stack.Screen
        name="Simulator"
        component={SimulatorScreen}
        options={{ title: 'Trade Simulator' }}
      />

      <Stack.Screen
        name="Transparency"
        component={TransparencyScreen}
        options={{ title: 'Data Transparency' }}
      />

      <Stack.Screen
        name="NotificationPrefs"
        component={NotificationPrefsScreen}
        options={{ title: 'Alert Preferences' }}
      />
    </Stack.Navigator>
  );
}

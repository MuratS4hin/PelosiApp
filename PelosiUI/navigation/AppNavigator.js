import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, Image } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import MyAssetsScreen from '../screens/MyAssetsScreen';
import AddAssetScreen from '../screens/AddAssetScreen';
import StockDetailScreen from '../screens/StockDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import UseAppStore from '../store/UseAppStore';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const user = UseAppStore((s) => s.user);

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }) => ({
          title: 'Portrace',
          headerRight: () => (
            <TouchableOpacity
              style={{ marginRight: 10 }}
              onPress={() => navigation.navigate('ProfileScreen')}
            >
              <Image
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }}
                style={{ width: 28, height: 28, borderRadius: 20 }}
              />
            </TouchableOpacity>
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
    </Stack.Navigator>
  );
}

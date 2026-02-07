import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, Image } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import MyAssetsScreen from '../screens/MyAssetsScreen';
import AddAssetScreen from '../screens/AddAssetScreen';
import StockDetailScreen from '../screens/StockDetailScreen';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }) => ({
          title: 'Pellosi App',
          headerRight: () => (
            <TouchableOpacity
              style={{ marginRight: 10 }}
              onPress={() => navigation.navigate('MyAssetsScreen')}
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
        name="StockDetail"
        component={StockDetailScreen}
        options={{
          title: 'Stock Detail',
        }}
      />
    </Stack.Navigator>
  );
}

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import CustomDrawerComponent from '../components/CustomDrawerComponent';
import ProfileScreen from '../screens/ProfileScreen';
import StockDetailScreen from '../screens/StockDetailScreen';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

// ✅ Reusable Header Icon Component (Consistent alignment)
// function HeaderIcon({ onPress, iconName }) {
//   return (
//     <TouchableOpacity
//       onPress={onPress}
//       style={{
//         width: 50,
//         height: 50,
//         alignItems: 'center',
//         justifyContent: 'center',
//       }}
//     >
//       <Ionicons name={iconName} size={25} color="black" />
//     </TouchableOpacity>
//   );
// }

// ✅ Stack Navigator
function MainStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }) => ({
          title: 'Pellosi App',
          // headerLeft: () => (
          //   <HeaderIcon
          //     onPress={() => navigation.openDrawer()}
          //     iconName="menu-outline"
          //   />
          // ),
          // headerRight: () => (
          //   <HeaderIcon
          //     onPress={() => navigation.navigate('ProfileScreen')}
          //     iconName="person-circle-outline"
          //   />
          // ),
        })}
      />
      <Stack.Screen name="ProfileScreen" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="StockDetail" component={StockDetailScreen} />
    </Stack.Navigator>
  );
}

// ✅ Drawer Navigator
export default function AppNavigator() {
  return (
    <Drawer.Navigator
      screenOptions={{ headerShown: false }}
      drawerContent={(props) => <CustomDrawerComponent {...props} />}
    >
      <Drawer.Screen name="Main" component={MainStackNavigator} options={{ title: 'Home' }} />
    </Drawer.Navigator>
  );
}

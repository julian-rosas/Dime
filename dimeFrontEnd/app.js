import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [session, setSession] = useState(null);

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash">
          {(props) => (
            <SplashScreen
              {...props}
              session={session}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Login">
          {(props) => (
            <LoginScreen
              {...props}
              onAuthenticated={setSession}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Register">
          {(props) => (
            <RegisterScreen
              {...props}
              onAuthenticated={setSession}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Home">
          {(props) => (
            <HomeScreen
              {...props}
              session={session}
              onLogout={() => {
                setSession(null);
                props.navigation.reset({
                  index: 0,
                  routes: [{ name: 'Splash' }],
                });
              }}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

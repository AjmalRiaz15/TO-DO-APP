// App.tsx
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { auth } from '../firebaseConfig';

import ChatListScreen from '../Screens/ChatListScreen';
import ChatScreen from '../Screens/ChatScreen';
import LoginScreen from '../Screens/LoginScreen';
import OnboardingScreen from '../Screens/OnboardingScreen';
import ProfileScreen from '../Screens/ProfileScreen';
import SignupScreen from '../Screens/SignupScreen';
import TodoScreen from '../Screens/TodoScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (initializing) setInitializing(false);
    });

    return unsubscribe;
  }, [initializing]);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4a69bd" />
      </View>
    );
  }

  return (

      <Stack.Navigator 
        initialRouteName={user ? "Todo" : "Onboarding"} 
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Todo" component={TodoScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="ChatList" component={ChatListScreen} />
      </Stack.Navigator>
    
  );
}
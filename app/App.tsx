import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import ChatScreen from '../Screens/ChatScreen';
import LoginScreen from '../Screens/LoginScreen';
import OnboardingScreen from '../Screens/OnboardingScreen';
import ProfileScreen from '../Screens/ProfileScreen';
import SignupScreen from '../Screens/SignupScreen';
import TodoScreen from '../Screens/TodoScreen';

const Stack = createNativeStackNavigator();

export default function App() {
    return (

        <Stack.Navigator initialRouteName="Onboarding" screenOptions={{ headerShown: false}}>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="Todo" component={TodoScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
        </Stack.Navigator>

    );
}

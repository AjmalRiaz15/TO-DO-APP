// Screens/LoginScreen.js
import { Ionicons } from '@expo/vector-icons';
import { yupResolver } from '@hookform/resolvers/yup';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from "react-native-responsive-screen";
import * as Yup from 'yup';
import AuthService from '../Services/AuthService';

const loginSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().required('Password is required'),
});

export default function LoginScreen({ navigation }) {
  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(loginSchema)
  });

  const [secureText, setSecureText] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [animation] = useState(new Animated.Value(0));

  React.useEffect(() => {
    Animated.timing(animation, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

const login = async (data) => {
  setIsLoading(true);
  try {
    const result = await AuthService.signIn(data.email, data.password);
    
    if (result.success) {
      Alert.alert("Welcome Back", "Login successful!");
      navigation.replace('ChatList')
    } else {
      Alert.alert("Login Error", result.error);
    }
  } catch (error) {
    Alert.alert("Login Error", error.message);
  } finally {
    setIsLoading(false);
  }
};

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0]
  });

  const opacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1]
  });

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <View style={styles.logoContainer}>
            <Animated.View style={[styles.logoCircle, { opacity }]}>
              <Ionicons name="checkmark-circle" size={wp("20%")} color="#fff" />
            </Animated.View>
            <Animated.Text style={[styles.appTitle, { opacity }]}>
              TaskFlow
            </Animated.Text>
            <Text style={styles.appSubtitle}>
              Organize your life, one task at a time
            </Text>
          </View>

          <Animated.View
            style={[
              styles.formContainer,
              {
                transform: [{ translateY }],
                opacity
              }
            ]}
          >
            <Text style={styles.formTitle}>Welcome Back</Text>

            {/* Email */}
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={wp("5%")} color="#999" style={styles.inputIcon} />
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    placeholder="Email address"
                    placeholderTextColor="#999"
                    value={value}
                    onChangeText={onChange}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                )}
              />
            </View>
            {errors.email && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={wp("3.5%")} color="#ff6b6b" />
                <Text style={styles.error}>{errors.email.message}</Text>
              </View>
            )}

            {/* Password */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={wp("5%")} color="#999" style={styles.inputIcon} />
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Password"
                    placeholderTextColor="#999"
                    value={value}
                    onChangeText={onChange}
                    secureTextEntry={secureText}
                    autoCapitalize="none"
                  />
                )}
              />
              <TouchableOpacity
                onPress={() => setSecureText(!secureText)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={secureText ? "eye-off-outline" : "eye-outline"}
                  size={wp("5%")}
                  color="#999"
                />
              </TouchableOpacity>
            </View>
            {errors.password && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={wp("3.5%")} color="#ff6b6b" />
                <Text style={styles.error}>{errors.password.message}</Text>
              </View>
            )}

            {/* Forgot Password */}
            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleSubmit(login)}
              disabled={isLoading}
            >
              <LinearGradient
                colors={isLoading ? ['#ccc', '#ccc'] : ['#43e97b', '#38f9d7']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isLoading ? (
                  <Ionicons name="refresh" size={wp("6%")} color="#fff" style={styles.loadingIcon} />
                ) : (
                  <Text style={styles.buttonText}>Login</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Sign Up Link */}
            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: hp("5%"),
    paddingHorizontal: wp("5%"),
  },
  logoCircle: {
    width: wp("30%"),
    height: wp("30%"),
    borderRadius: wp("15%"),
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp("2%"),
  },
  appTitle: {
    fontSize: wp("9%"),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: hp("1%"),
  },
  appSubtitle: {
    fontSize: wp("4%"),
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginHorizontal: wp("5%"),
    borderRadius: 20,
    padding: wp("6%"),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  formTitle: {
    fontSize: wp("6%"),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: hp("3%"),
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: hp("1.5%"),
    paddingHorizontal: wp("4%"),
    height: hp("7%"),
  },
  inputIcon: {
    marginRight: wp("2%"),
  },
  input: {
    flex: 1,
    fontSize: wp("4%"),
    color: '#333',
    height: '100%',
  },
  eyeIcon: {
    padding: wp("1%"),
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp("2%"),
    marginTop: -hp("0.5%"),
  },
  error: {
    color: '#ff6b6b',
    marginLeft: wp("1%"),
    fontSize: wp("3%"),
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: hp("2%"),
  },
  forgotText: {
    color: '#667eea',
    fontSize: wp("3.5%"),
  },
  button: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: hp("3%"),
    height: hp("7%"),
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  buttonText: {
    color: '#fff',
    fontSize: wp("4.5%"),
    fontWeight: 'bold',
  },
  loadingIcon: {
    marginRight: wp("2%"),
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp("3%"),
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e9ecef',
  },
  dividerText: {
    color: '#6c757d',
    marginHorizontal: wp("2%"),
    fontSize: wp("3.5%"),
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signupText: {
    color: '#6c757d',
    fontSize: wp("3.5%"),
  },
  signupLink: {
    color: '#667eea',
    fontSize: wp("3.5%"),
    fontWeight: 'bold',
  },
});
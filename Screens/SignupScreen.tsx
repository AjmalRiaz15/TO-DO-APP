// Screens/SignupScreen.js
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
  ScrollView,
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

const signupSchema = Yup.object().shape({
  name: Yup.string().required('Name is required').min(2, 'Name must be at least 2 characters'),
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase and number')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    .required('Confirm password is required'),
});

export default function SignupScreen({ navigation }) {
  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(signupSchema)
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [animation] = useState(new Animated.Value(0));

  React.useEffect(() => {
    Animated.timing(animation, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  const signup = async (data) => {
    setIsLoading(true);
    try {
      const result = await AuthService.signUp(data.email, data.password, {
        name: data.name,
        createdAt: Date.now(),
        lastLogin: Date.now()
      });
      
      if (result.success) {
        Alert.alert("Success", "Account created successfully!");
        navigation.replace('Login');
      } else {
        Alert.alert("Signup Error", result.error);
      }
    } catch (error) {
      Alert.alert("Signup Error", error.message);
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
      colors={['#764ba2', '#667eea']}
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.logoContainer}>
              <Animated.View style={[styles.logoCircle, { opacity }]}>
                <Ionicons name="person-add" size={wp("15%")} color="#fff" />
              </Animated.View>
              <Animated.Text style={[styles.appTitle, { opacity }]}>
                Join TaskFlow
              </Animated.Text>
              <Text style={styles.appSubtitle}>
                Create your account to get started
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
              <Text style={styles.formTitle}>Create Account</Text>

              {/* Name */}
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={wp("5%")} color="#999" style={styles.inputIcon} />
                <Controller
                  control={control}
                  name="name"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      style={styles.input}
                      placeholder="Full Name"
                      placeholderTextColor="#999"
                      value={value}
                      onChangeText={onChange}
                      autoCapitalize="words"
                    />
                  )}
                />
              </View>
              {errors.name && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={wp("3.5%")} color="#ff6b6b" />
                  <Text style={styles.error}>{errors.name.message}</Text>
                </View>
              )}

              {/* Email */}
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={wp("5%")} color="#999" style={styles.inputIcon} />
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      style={styles.input}
                      placeholder="Email Address"
                      placeholderTextColor="#999"
                      value={value}
                      onChangeText={onChange}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
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
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                  )}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
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

              {/* Confirm Password */}
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={wp("5%")} color="#999" style={styles.inputIcon} />
                <Controller
                  control={control}
                  name="confirmPassword"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Confirm Password"
                      placeholderTextColor="#999"
                      value={value}
                      onChangeText={onChange}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                    />
                  )}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                    size={wp("5%")}
                    color="#999"
                  />
                </TouchableOpacity>
              </View>
              {errors.confirmPassword && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={wp("3.5%")} color="#ff6b6b" />
                  <Text style={styles.error}>{errors.confirmPassword.message}</Text>
                </View>
              )}

              {/* Sign Up Button */}
              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleSubmit(signup)}
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
                    <Text style={styles.buttonText}>Create Account</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Login Link */}
              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.loginLink}>Login</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
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
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: hp("2%"),
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: hp("4%"),
    paddingHorizontal: wp("5%"),
  },
  logoCircle: {
    width: wp("25%"),
    height: wp("25%"),
    borderRadius: wp("12.5%"),
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp("2%"),
  },
  appTitle: {
    fontSize: wp("7%"),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: hp("1%"),
    textAlign: "center",
  },
  appSubtitle: {
    fontSize: wp("3.8%"),
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginHorizontal: wp("5%"),
    borderRadius: wp("5%"),
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
    marginBottom: hp("2%"),
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: wp("3%"),
    marginBottom: hp("1.5%"),
    paddingHorizontal: wp("4%"),
    height: hp("6%"),
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
    padding: wp("2%"),
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp("2%"),
    marginTop: -hp("0.5%"),
  },
  error: {
    color: '#ff6b6b',
    marginLeft: wp("2%"),
    fontSize: wp("3.2%"),
  },
  button: {
    borderRadius: wp("3%"),
    overflow: 'hidden',
    marginBottom: hp("2.5%"),
    height: hp("6.5%"),
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
    marginBottom: hp("2.5%"),
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
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginText: {
    color: '#6c757d',
    fontSize: wp("3.5%"),
  },
  loginLink: {
    color: '#667eea',
    fontSize: wp("3.5%"),
    fontWeight: 'bold',
  },
});
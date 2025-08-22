import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from "react-native-responsive-screen";

const { width, height } = Dimensions.get('window');

export default function OnboardingScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  React.useEffect(() => {
    // Parallel animations for better visual effect
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.elastic(1),
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  return (
    <LinearGradient 
      colors={['#667eea', '#764ba2']} 
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.innerContainer}>
        {/* Animated Logo */}
        <Animated.View 
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <View style={styles.logoCircle}>
            <Ionicons name="checkmark-done" size={80} color="#fff" />
          </View>
        </Animated.View>

        {/* Animated Text Content */}
        <Animated.View 
          style={[
            styles.textContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Text style={styles.title}>Welcome to TaskFlow</Text>
          <Text style={styles.subtitle}>
            Organize your tasks, boost your productivity, and achieve more every day
          </Text>
        </Animated.View>

        {/* Feature List */}
        <Animated.View 
          style={[
            styles.featuresContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={24} color="#43e97b" />
            <Text style={styles.featureText}>Manage tasks effortlessly</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={24} color="#43e97b" />
            <Text style={styles.featureText}>Set priorities and deadlines</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={24} color="#43e97b" />
            <Text style={styles.featureText}>Sync across all your devices</Text>
          </View>
        </Animated.View>

        {/* Animated Button */}
        <Animated.View 
          style={[
            styles.buttonContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <TouchableOpacity 
            onPress={() => navigation.replace('Login')} 
            style={styles.button}
            activeOpacity={0.9}
          >
            <LinearGradient 
              colors={['#43e97b', '#38f9d7']} 
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.buttonText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={22} color="#fff" style={styles.buttonIcon} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Footer Text */}
        <Animated.View 
          style={[
            styles.footer,
            {
              opacity: fadeAnim,
            }
          ]}
        >
          <Text style={styles.footerText}>
            Already have an account?{' '}
            <Text 
              style={styles.footerLink}
              onPress={() => navigation.replace('Login')}
            >
              Sign In
            </Text>
          </Text>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  innerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: wp("6%"),
  },
  logoContainer: {
    marginBottom: hp("4%"),
    alignItems: 'center',
  },
  logoCircle: {
    width: wp("40%"),
    height: wp("40%"),
    borderRadius: wp("20%"),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: hp("5%"),
  },
  title: { 
    fontSize: wp("8%"), 
    fontWeight: 'bold', 
    marginBottom: hp("2%"), 
    color: '#fff', 
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  subtitle: { 
    fontSize: wp("4%"), 
    color: 'rgba(255, 255, 255, 0.9)', 
    textAlign: 'center', 
    lineHeight: hp("3%"),
    maxWidth: wp("90%"),
  },
  featuresContainer: {
    marginBottom: hp("5%"),
    width: '100%',
    maxWidth: wp("80%"),
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp("2%"),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: wp("4%"),
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#43e97b',
  },
  featureText: {
    color: '#fff',
    fontSize: wp("3.8%"),
    marginLeft: wp("3%"),
    fontWeight: '500',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: hp("4%"),
  },
  button: { 
    borderRadius: 30, 
    overflow: 'hidden',
    width: '100%',
    maxWidth: wp("80%"),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  buttonGradient: { 
    paddingVertical: hp("2.2%"),
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonText: { 
    color: '#fff', 
    fontSize: wp("4.5%"), 
    fontWeight: 'bold',
    marginRight: wp("2%"),
  },
  buttonIcon: {
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: hp("5%"),
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: wp("3.5%"),
  },
  footerLink: {
    color: '#fff',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});
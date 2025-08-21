import { FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from 'expo-linear-gradient';
import { EmailAuthProvider, getAuth, reauthenticateWithCredential, signOut, updatePassword, updateProfile } from "firebase/auth";
import React, { useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";

export default function ProfileScreen({ navigation }) {
  const auth = getAuth();
  const user = auth.currentUser;

  const [isLocationOn, setIsLocationOn] = useState(false);
  const [isEmailNotiOn, setIsEmailNotiOn] = useState(true);
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [photoURL, setPhotoURL] = useState(user?.photoURL || null);

  // Password states
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Modals
  const [editModal, setEditModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  // Logout
  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Logout", 
          onPress: async () => {
            await signOut(auth);
            navigation.replace("Login");
          }
        }
      ]
    );
  };

  // Pick Image
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert("Permission required", "Sorry, we need camera roll permissions to change your profile picture.");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setPhotoURL(uri);
      await updateProfile(user, { photoURL: uri });
      Alert.alert("Success", "Profile image updated successfully!");
    }
  };

  // Update Name
  const updateUserName = async () => {
    if (!displayName.trim()) {
      Alert.alert("Error", "Please enter a valid name");
      return;
    }
    
    try {
      await updateProfile(user, { displayName: displayName.trim() });
      Alert.alert("Success", "Name updated successfully!");
      setEditModal(false);
    } catch (error) {
      Alert.alert("Error", "Failed to update name. Please try again.");
    }
  };

  // Change Password
  const changePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match!");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters long");
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      Alert.alert("Success", "Password updated successfully!");
      setPasswordModal(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      Alert.alert("Error", "Old password is incorrect!");
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient 
        colors={['#667eea', '#764ba2']} 
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.profileImage} />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Ionicons name="person" size={40} color="#fff" />
                </View>
              )}
              <View style={styles.cameraIcon}>
                <Ionicons name="camera" size={18} color="#fff" />
              </View>
            </TouchableOpacity>
            
            <Text style={styles.name}>{displayName || "User Name"}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            
            <TouchableOpacity 
              style={styles.editProfileButton}
              onPress={() => setEditModal(true)}
            >
              <Text style={styles.editProfileText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Menu Items */}
          <View style={styles.menuContainer}>
            <Text style={styles.menuSectionTitle}>Account Settings</Text>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => setPasswordModal(true)}>
              <View style={[styles.menuIcon, { backgroundColor: '#ff9f43' }]}>
                <Ionicons name="lock-closed" size={20} color="#fff" />
              </View>
              <Text style={styles.menuText}>Change Password</Text>
              <Ionicons name="chevron-forward" size={20} color="#ddd" />
            </TouchableOpacity>

            <View style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: '#54a0ff' }]}>
                <Ionicons name="notifications" size={20} color="#fff" />
              </View>
              <Text style={styles.menuText}>Email Notifications</Text>
              <Switch 
                value={isEmailNotiOn} 
                onValueChange={setIsEmailNotiOn}
                trackColor={{ false: '#ddd', true: '#43e97b' }}
                thumbColor={isEmailNotiOn ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: '#a55eea' }]}>
                <Ionicons name="location" size={20} color="#fff" />
              </View>
              <Text style={styles.menuText}>Location Services</Text>
              <Switch 
                value={isLocationOn} 
                onValueChange={setIsLocationOn}
                trackColor={{ false: '#ddd', true: '#43e97b' }}
                thumbColor={isLocationOn ? '#fff' : '#f4f3f4'}
              />
            </View>

            <Text style={styles.menuSectionTitle}>Preferences</Text>
            
            <TouchableOpacity style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: '#fd9644' }]}>
                <FontAwesome5 name="cog" size={18} color="#fff" />
              </View>
              <Text style={styles.menuText}>App Settings</Text>
              <Ionicons name="chevron-forward" size={20} color="#ddd" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: '#26de81' }]}>
                <Ionicons name="help-circle" size={20} color="#fff" />
              </View>
              <Text style={styles.menuText}>Help & Support</Text>
              <Ionicons name="chevron-forward" size={20} color="#ddd" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <View style={[styles.menuIcon, { backgroundColor: '#fc5c65' }]}>
                <MaterialIcons name="logout" size={20} color="#fff" />
              </View>
              <Text style={[styles.menuText, { color: '#fc5c65' }]}>Logout</Text>
              <Ionicons name="chevron-forward" size={20} color="#fc5c65" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Edit Name Modal */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContainer}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <TouchableOpacity onPress={() => setEditModal(false)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              
              <TextInput
                style={styles.modalInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter your name"
                placeholderTextColor="#999"
              />
              
              <TouchableOpacity 
                style={[styles.modalButton, !displayName.trim() && styles.modalButtonDisabled]} 
                onPress={updateUserName}
                disabled={!displayName.trim()}
              >
                <Text style={styles.modalButtonText}>Update Name</Text>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={passwordModal} transparent animationType="slide" onRequestClose={() => setPasswordModal(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContainer}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Change Password</Text>
                <TouchableOpacity onPress={() => setPasswordModal(false)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              
              <TextInput
                style={styles.modalInput}
                value={oldPassword}
                onChangeText={setOldPassword}
                placeholder="Current Password"
                placeholderTextColor="#999"
                secureTextEntry
              />
              
              <TextInput
                style={styles.modalInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New Password"
                placeholderTextColor="#999"
                secureTextEntry
              />
              
              <TextInput
                style={styles.modalInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm New Password"
                placeholderTextColor="#999"
                secureTextEntry
              />
              
              <TouchableOpacity 
                style={[styles.modalButton, (!oldPassword || !newPassword || !confirmPassword) && styles.modalButtonDisabled]} 
                onPress={changePassword}
                disabled={!oldPassword || !newPassword || !confirmPassword}
              >
                <Text style={styles.modalButtonText}>Update Password</Text>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f8f9fa" 
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  scrollContainer: {
    flex: 1,
  },
  profileSection: {
    alignItems: "center",
    padding: 25,
    backgroundColor: "#fff",
    marginBottom: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#43e97b',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2d3436",
    marginBottom: 5,
  },
  email: {
    fontSize: 16,
    color: "#636e72",
    marginBottom: 20,
  },
  editProfileButton: {
    backgroundColor: '#f1f2f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  editProfileText: {
    color: '#667eea',
    fontWeight: '600',
  },
  menuContainer: {
    padding: 20,
  },
  menuSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#636e72',
    marginBottom: 15,
    marginTop: 10,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  menuText: { 
    flex: 1, 
    fontSize: 16, 
    color: "#2d3436",
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 25,
    minHeight: '40%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2d3436",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    color: "#2d3436",
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  modalButton: {
    backgroundColor: "#667eea",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  modalButtonDisabled: {
    backgroundColor: "#ccc",
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
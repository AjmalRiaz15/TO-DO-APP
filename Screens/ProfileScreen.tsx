import { FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from 'expo-linear-gradient';
import {
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
  updateProfile
} from "firebase/auth";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
// Add responsive screen imports
import {
  heightPercentageToDP as hp,
  listenOrientationChange as lor,
  removeOrientationListener as rol,
  widthPercentageToDP as wp
} from 'react-native-responsive-screen';

export default function ProfileScreen({ navigation }) {
  const auth = getAuth();
  const storage = getStorage();
  const user = auth.currentUser;

  const [isLocationOn, setIsLocationOn] = useState(false);
  const [isEmailNotiOn, setIsEmailNotiOn] = useState(true);
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [photoURL, setPhotoURL] = useState(user?.photoURL || null);
  const [uploading, setUploading] = useState(false);

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

    // Listen for orientation changes
    lor();

    return () => {
      rol(); // Remove orientation listener
    };
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

  // Function to convert URI to Blob (needed for Firebase upload)
  const uriToBlob = (uri) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function() {
        resolve(xhr.response);
      };
      xhr.onerror = function() {
        reject(new Error('Failed to convert URI to blob'));
      };
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });
  };

  // Upload image to Firebase Storage
  const uploadImage = async (uri) => {
    setUploading(true);
    
    try {
      // Convert image to blob
      const blob = await uriToBlob(uri);
      
      // Create a reference to the file in Firebase Storage
      // Using user UID as filename to ensure uniqueness
      const storageRef = ref(storage, `profileImages/${user.uid}`);
      
      // Upload the file
      const snapshot = await uploadBytes(storageRef, blob);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      // Update user profile with the new photo URL
      await updateProfile(user, { photoURL: downloadURL });
      setPhotoURL(downloadURL);
      
      Alert.alert("Success", "Profile image updated successfully!");
    } catch (error) {
      console.error("Error uploading image:", error);
      Alert.alert("Error", "Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // Pick Image
  const pickImage = async () => {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert("Permission required", "Sorry, we need camera roll permissions to change your profile picture.");
      return;
    }

    // Launch image picker
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      await uploadImage(uri);
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
            <Ionicons name="arrow-back" size={wp('6%')} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: wp('6%') }} />
        </View>
      </LinearGradient>

      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <TouchableOpacity onPress={pickImage} style={styles.imageContainer} disabled={uploading}>
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.profileImage} />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Ionicons name="person" size={wp('10%')} color="#fff" />
                </View>
              )}
              <View style={styles.cameraIcon}>
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={wp('4.5%')} color="#fff" />
                )}
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
                <Ionicons name="lock-closed" size={wp('5%')} color="#fff" />
              </View>
              <Text style={styles.menuText}>Change Password</Text>
              <Ionicons name="chevron-forward" size={wp('5%')} color="#ddd" />
            </TouchableOpacity>

            <View style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: '#54a0ff' }]}>
                <Ionicons name="notifications" size={wp('5%')} color="#fff" />
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
                <Ionicons name="location" size={wp('5%')} color="#fff" />
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
                <FontAwesome5 name="cog" size={wp('4.5%')} color="#fff" />
              </View>
              <Text style={styles.menuText}>App Settings</Text>
              <Ionicons name="chevron-forward" size={wp('5%')} color="#ddd" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: '#26de81' }]}>
                <Ionicons name="help-circle" size={wp('5%')} color="#fff" />
              </View>
              <Text style={styles.menuText}>Help & Support</Text>
              <Ionicons name="chevron-forward" size={wp('5%')} color="#ddd" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <View style={[styles.menuIcon, { backgroundColor: '#fc5c65' }]}>
                <MaterialIcons name="logout" size={wp('5%')} color="#fff" />
              </View>
              <Text style={[styles.menuText, { color: '#fc5c65' }]}>Logout</Text>
              <Ionicons name="chevron-forward" size={wp('5%')} color="#fc5c65" />
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
                  <Ionicons name="close" size={wp('6%')} color="#666" />
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
                  <Ionicons name="close" size={wp('6%')} color="#666" />
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
    paddingTop: Platform.OS === 'ios' ? hp('6%') : hp('4%'),
    paddingBottom: hp('2.5%'),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: wp('5%'),
  },
  backButton: {
    padding: wp('1.2%'),
  },
  headerTitle: {
    fontSize: hp('2.5%'),
    fontWeight: "bold",
    color: "#fff",
  },
  scrollContainer: {
    flex: 1,
  },
  profileSection: {
    alignItems: "center",
    padding: hp('3%'),
    backgroundColor: "#fff",
    marginBottom: hp('1.2%'),
    borderBottomLeftRadius: wp('5%'),
    borderBottomRightRadius: wp('5%'),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: hp('2%'),
  },
  profileImage: {
    width: wp('30%'),
    height: wp('30%'),
    borderRadius: wp('15%'),
  },
  profileImagePlaceholder: {
    width: wp('30%'),
    height: wp('30%'),
    borderRadius: wp('15%'),
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#43e97b',
    width: wp('9%'),
    height: wp('9%'),
    borderRadius: wp('4.5%'),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  name: {
    fontSize: hp('3%'),
    fontWeight: "bold",
    color: "#2d3436",
    marginBottom: hp('0.6%'),
  },
  email: {
    fontSize: hp('2%'),
    color: "#636e72",
    marginBottom: hp('2.5%'),
  },
  editProfileButton: {
    backgroundColor: '#f1f2f6',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.2%'),
    borderRadius: wp('5%'),
  },
  editProfileText: {
    color: '#667eea',
    fontWeight: '600',
    fontSize: hp('1.8%'),
  },
  menuContainer: {
    padding: wp('5%'),
  },
  menuSectionTitle: {
    fontSize: hp('2%'),
    fontWeight: '600',
    color: '#636e72',
    marginBottom: hp('2%'),
    marginTop: hp('1.2%'),
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: hp('2.2%'),
    paddingHorizontal: wp('4%'),
    backgroundColor: '#fff',
    borderRadius: wp('4%'),
    marginBottom: hp('1.2%'),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  menuIcon: {
    width: wp('10%'),
    height: wp('10%'),
    borderRadius: wp('3%'),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp('4%'),
  },
  menuText: { 
    flex: 1, 
    fontSize: hp('2%'), 
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
    borderTopLeftRadius: wp('6%'),
    borderTopRightRadius: wp('6%'),
    padding: wp('6%'),
    minHeight: hp('40%'),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('2.5%'),
  },
  modalTitle: {
    fontSize: hp('2.5%'),
    fontWeight: "bold",
    color: "#2d3436",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: wp('3%'),
    padding: hp('1.8%'),
    marginBottom: hp('1.8%'),
    color: "#2d3436",
    fontSize: hp('2%'),
    backgroundColor: '#f8f9fa',
  },
  modalButton: {
    backgroundColor: "#667eea",
    padding: hp('2%'),
    borderRadius: wp('3%'),
    alignItems: "center",
    marginTop: hp('1.2%'),
  },
  modalButtonDisabled: {
    backgroundColor: "#ccc",
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: hp('2%'),
  },
});
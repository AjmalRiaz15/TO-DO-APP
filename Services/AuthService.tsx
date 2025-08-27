// services/AuthService.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

class AuthService {
  // Sign up with email and password
  async signUp(email, password, userData) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Prepare user data for Firestore
      const userDBData = {
        uid: user.uid,
        email: user.email,
        displayName: userData.name || '',
        createdAt: new Date(),
        lastLogin: new Date(),
        ...userData
      };

      // Save to Firestore
      await setDoc(doc(db, "users", user.uid), userDBData);
      
      // Update Firebase Auth profile
      if (userData.name) {
        await updateProfile(user, {
          displayName: userData.name
        });
      }
      
      return { success: true, user: userDBData };

    } catch (error) {
      console.error('Sign up error:', error);
      let errorMessage = error.message;
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please sign in instead.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      }
      
      return { success: false, error: errorMessage };
    }
  }

  // Sign in with email and password
  async signIn(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update last login time in Firestore
      await updateDoc(doc(db, "users", user.uid), {
        lastLogin: new Date()
      });
      
      // Get user data from Firestore
      const userData = await this.getUserData(user.uid);
      
      return { success: true, user: { ...user, ...userData } };

    } catch (error) {
      console.error('Sign in error:', error);
      let errorMessage = error.message;
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email. Please sign up first.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      }
      
      return { success: false, error: errorMessage };
    }
  }

  // Sign out
  async signOut() {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get user data from Firestore
  async getUserData(userId) {
    try {
      const docRef = doc(db, "users", userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data();
      } else {
        console.log('No such user document!');
        return null;
      }
    } catch (error) {
      console.error('Get user data error:', error);
      throw error;
    }
  }

  // Get all users from Firestore (for chat functionality)
  async getAllUsers(currentUserId) {
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("uid", "!=", currentUserId));
      const querySnapshot = await getDocs(q);
      
      const users = [];
      querySnapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });
      
      return users;
    } catch (error) {
      console.error('Get all users error:', error);
      throw error;
    }
  }

  // Get current user
  getCurrentUser() {
    return auth.currentUser;
  }

  // Update user profile in Firestore
  async updateProfile(userId, updates) {
    try {
      await updateDoc(doc(db, "users", userId), updates);
      return { success: true };
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new AuthService();
// services/AuthService.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import { get, ref, set, update } from 'firebase/database';
import { auth, database } from '../firebaseConfig';

class AuthService {
  // Sign up with email and password
  async signUp(email, password, userData) {
    try {
      // ✅ CORRECT: Use createUserWithEmailAndPassword function with auth object
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Prepare user data for database
      const userDBData = {
        uid: user.uid,
        email: user.email,
        displayName: userData.name || '',
        createdAt: Date.now(),
        lastLogin: Date.now(),
        ...userData
      };

      // ✅ CORRECT: Use ref and set functions with database object
      await set(ref(database, `users/${user.uid}`), userDBData);
      
      // Update user profile with name
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
        errorMessage = 'This email is already registered. Please login instead.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters.';
      }
      
      return { success: false, error: errorMessage };
    }
  }

  // Sign in with email and password
  async signIn(email, password) {
    try {
      // ✅ CORRECT: Use signInWithEmailAndPassword function with auth object
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update last login time
      await update(ref(database, `users/${user.uid}`), {
        lastLogin: Date.now()
      });
      
      // Get user data from database
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
      // ✅ CORRECT: Use signOut function with auth object
      await signOut(auth);
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get user data from database
  async getUserData(userId) {
    try {
      // ✅ CORRECT: Use ref function with database object
      const snapshot = await get(ref(database, `users/${userId}`));
      return snapshot.val();
    } catch (error) {
      console.error('Get user data error:', error);
      throw error;
    }
  }

  // Get current user
  getCurrentUser() {
    // ✅ CORRECT: Access currentUser directly from auth object
    return auth.currentUser;
  }

  // Update user profile
  async updateProfile(userId, updates) {
    try {
      // ✅ CORRECT: Use ref and update functions with database object
      await update(ref(database, `users/${userId}`), updates);
      return { success: true };
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new AuthService();
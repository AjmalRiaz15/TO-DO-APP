import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import {
  heightPercentageToDP as hp,
  widthPercentageToDP as wp,
} from 'react-native-responsive-screen';
import { auth, db } from '../firebaseConfig';

const ChatListScreen = ({ navigation }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        loadAllUsers(user.uid);
      } else {
        setLoading(false);
        setError('Not authenticated');
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  const loadAllUsers = async (currentUserId) => {
    try {
      setLoading(true);
      setError(null);
      
      // Get all users from Firestore
      const usersRef = collection(db, 'users');
      const querySnapshot = await getDocs(usersRef);
      
      const usersList = [];
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        // Filter out current user
        if (userData.uid !== currentUserId) {
          usersList.push({
            uid: userData.uid,
            email: userData.email,
            displayName: userData.displayName || userData.name || userData.email.split('@')[0],
            // Include any other fields you need
          });
        }
      });
      
      console.log('Users from Firestore:', usersList);
      setUsers(usersList);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error loading users from Firestore:', error);
      setError(error.message);
      setLoading(false);
      setRefreshing(false);
    }
  };

  // For real-time updates (optional)
  const setupRealTimeUsersListener = (currentUserId) => {
    const usersRef = collection(db, 'users');
    
    return onSnapshot(usersRef, (querySnapshot) => {
      const usersList = [];
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.uid !== currentUserId) {
          usersList.push({
            uid: userData.uid,
            email: userData.email,
            displayName: userData.displayName || userData.name || userData.email.split('@')[0],
          });
        }
      });
      setUsers(usersList);
    }, (error) => {
      console.error('Real-time users listener error:', error);
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (currentUser) {
      loadAllUsers(currentUser.uid);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Yes", 
          onPress: () => {
            signOut(auth).catch(error => {
              Alert.alert("Error", error.message);
            });
          }
        }
      ]
    );
  };

  const renderUserItem = ({ item }) => {
    // Ensure consistent chat ID format
    const chatId = [currentUser.uid, item.uid].sort().join('_');
    
    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => navigation.navigate('Chat', { 
          recipient: item,
          chatId: chatId
        })}
      >
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {item.displayName ? item.displayName.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.displayName || 'Unknown User'}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {item.email}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={wp('5%')} color="#747d8c" />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4a69bd" />
        <Text style={styles.loadingText}>Loading users...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={wp('15%')} color="#ff6b6b" />
        <Text style={styles.errorText}>Error Loading Users</Text>
        <Text style={styles.errorSubtext}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => currentUser && loadAllUsers(currentUser.uid)}
        >
          <Ionicons name="refresh" size={wp('4%')} color="#fff" />
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Ionicons name="chatbubble-ellipses-outline" size={wp('15%')} color="#ccc" />
        <Text style={styles.errorText}>You need to be logged in to view users</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Connected as: {currentUser?.email}
        </Text>
        <Text style={styles.userCount}>
          {users.length} user(s) available
        </Text>
      </View>

      {users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={wp('15%')} color="#ccc" />
          <Text style={styles.emptyText}>No other users found</Text>
          <Text style={styles.emptySubtext}>
            Other users will appear here once they register in the app.
          </Text>
          
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={() => currentUser && loadAllUsers(currentUser.uid)}
          >
            <Ionicons name="refresh" size={wp('3.5%')} color="#4a69bd" />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.uid}
          renderItem={renderUserItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#4a69bd']}
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>
                Available Users ({users.length})
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    top: hp('4%'),
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: wp('5%'),
  },
  loadingText: {
    marginTop: hp('2%'),
    fontSize: wp('4%'),
    color: '#747d8c',
  },
  errorText: {
    marginTop: hp('2%'),
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#2f3542',
    textAlign: 'center',
  },
  errorSubtext: {
    marginTop: hp('1%'),
    fontSize: wp('3.5%'),
    color: '#747d8c',
    textAlign: 'center',
    marginBottom: hp('2%'),
  },
  header: {
    padding: wp('4%'),
    borderBottomWidth: 1,
    borderBottomColor: '#f1f2f6',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  headerTitle: {
    fontSize: wp('6%'),
    fontWeight: 'bold',
    color: '#2f3542',
  },
  headerSubtitle: {
    fontSize: wp('3.5%'),
    color: '#747d8c',
    marginBottom: hp('0.5%'),
  },
  userCount: {
    fontSize: wp('3%'),
    color: '#999',
    fontStyle: 'italic',
  },
  listContent: {
    padding: wp('4%'),
  },
  listHeader: {
    marginBottom: hp('1.5%'),
    paddingBottom: hp('1%'),
    borderBottomWidth: 1,
    borderBottomColor: '#f1f2f6',
  },
  listHeaderText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#2f3542',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp('4%'),
    marginBottom: hp('1.5%'),
    backgroundColor: '#f8f9fa',
    borderRadius: wp('3%'),
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  avatarContainer: {
    marginRight: wp('3%'),
  },
  avatar: {
    width: wp('12%'),
    height: wp('12%'),
    borderRadius: wp('6%'),
  },
  avatarPlaceholder: {
    backgroundColor: '#4a69bd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: wp('4.5%'),
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
    marginRight: wp('3%'),
  },
  userName: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#2f3542',
    marginBottom: hp('0.5%'),
  },
  userEmail: {
    fontSize: wp('3.5%'),
    color: '#747d8c',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('5%'),
  },
  emptyText: {
    marginTop: hp('2%'),
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#2f3542',
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: hp('1%'),
    fontSize: wp('3.5%'),
    color: '#747d8c',
    textAlign: 'center',
    marginBottom: hp('2%'),
    lineHeight: hp('2.5%'),
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#4a69bd',
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1%'),
    borderRadius: wp('1.5%'),
    marginTop: hp('1%'),
  },
  refreshText: {
    color: '#4a69bd',
    marginLeft: wp('1.5%'),
    fontWeight: '600',
    fontSize: wp('3%'),
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4a69bd',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    borderRadius: wp('2%'),
  },
  retryText: {
    color: '#fff',
    marginLeft: wp('2%'),
    fontWeight: '600',
    fontSize: wp('3.5%'),
  },
});

export default ChatListScreen;
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastMessages, setLastMessages] = useState({});
  const [chatDataMap, setChatDataMap] = useState({}); // To store chat data by participant ID

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

  // Listen for chat documents where current user is a participant
  useEffect(() => {
    if (!currentUser) return;

    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('participants', 'array-contains', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const counts = {};
        const messages = {};
        const chatMap = {};
        
        querySnapshot.forEach((doc) => {
          const chatData = doc.data();
          const chatId = doc.id;
          
          // Find the other participant
          const otherParticipant = chatData.participants.find(
            id => id !== currentUser.uid
          );
          
          if (otherParticipant) {
            // Store chat data by participant ID
            chatMap[otherParticipant] = {
              chatId,
              ...chatData
            };
            
            // Store unread count if available
            if (chatData.unreadCounts && chatData.unreadCounts[currentUser.uid]) {
              counts[otherParticipant] = chatData.unreadCounts[currentUser.uid];
            } else {
              counts[otherParticipant] = 0;
            }
            
            // Store last message if available
            if (chatData.lastMessage) {
              messages[otherParticipant] = {
                text: chatData.lastMessage.text,
                createdAt: chatData.lastMessage.createdAt?.toDate() || new Date(0)
              };
            }
          }
        });
        
        setUnreadCounts(counts);
        setLastMessages(messages);
        setChatDataMap(chatMap);
      },
      (error) => {
        console.log('Error listening to chats:', error);
        // If we can't access chats, initialize with zero counts
        const initialCounts = {};
        users.forEach(user => {
          initialCounts[user.uid] = 0;
        });
        setUnreadCounts(initialCounts);
      }
    );

    return () => unsubscribe();
  }, [currentUser, users]);

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
          });
        }
      });
      
      setUsers(usersList);
      
      // Initialize unread counts for all users
      const initialCounts = {};
      usersList.forEach(user => {
        initialCounts[user.uid] = 0;
      });
      setUnreadCounts(initialCounts);
      
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error loading users from Firestore:', error);
      setError(error.message);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (currentUser) {
      loadAllUsers(currentUser.uid);
    }
  };

  // Sort users by last message time and unread status
  const getSortedUsers = () => {
    return [...users].sort((a, b) => {
      // First, prioritize users with unread messages
      const aUnread = unreadCounts[a.uid] || 0;
      const bUnread = unreadCounts[b.uid] || 0;
      
      if (aUnread > 0 && bUnread === 0) return -1;
      if (aUnread === 0 && bUnread > 0) return 1;
      
      // Then sort by last message time (newest first)
      const aTime = lastMessages[a.uid]?.createdAt || new Date(0);
      const bTime = lastMessages[b.uid]?.createdAt || new Date(0);
      
      return bTime - aTime;
    });
  };

  const markAsRead = async (userId) => {
    try {
      const chatData = chatDataMap[userId];
      if (!chatData) return;
      
      const chatRef = doc(db, 'chats', chatData.chatId);
      const updatedUnreadCounts = {
        ...chatData.unreadCounts,
        [currentUser.uid]: 0
      };
      
      await updateDoc(chatRef, {
        unreadCounts: updatedUnreadCounts
      });
      
      // Update local state
      setUnreadCounts(prev => ({
        ...prev,
        [userId]: 0
      }));
    } catch (error) {
      console.log('Error marking as read:', error);
    }
  };

  const renderUserItem = ({ item }) => {
    const unreadCount = unreadCounts[item.uid] || 0;
    const lastMessage = lastMessages[item.uid];
    
    return (
      <TouchableOpacity
        style={[
          styles.userItem,
          unreadCount > 0 && styles.unreadUserItem
        ]}
        onPress={async () => {
          // Mark as read before navigating
          if (unreadCount > 0) {
            await markAsRead(item.uid);
          }
          navigation.navigate('Chat', { 
            recipient: item,
            chatId: chatDataMap[item.uid]?.chatId || [currentUser.uid, item.uid].sort().join('_')
          });
        }}
      >
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {item.displayName ? item.displayName.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.userInfo}>
          <Text 
            style={[
              styles.userName, 
              unreadCount > 0 && styles.unreadUserName
            ]} 
            numberOfLines={1}
          >
            {item.displayName || 'Unknown User'}
          </Text>
          {lastMessage ? (
            <Text 
              style={[
                styles.lastMessage,
                unreadCount > 0 && styles.unreadLastMessage
              ]} 
              numberOfLines={1}
            >
              {lastMessage.text}
            </Text>
          ) : (
            <Text style={styles.userEmail} numberOfLines={1}>
              {item.email}
            </Text>
          )}
        </View>

        <View style={styles.rightContainer}>
          {lastMessage && (
            <Text style={styles.timestamp}>
              {formatTime(lastMessage.createdAt)}
            </Text>
          )}
          <Ionicons name="chevron-forward" size={wp('5%')} color="#747d8c" />
        </View>
      </TouchableOpacity>
    );
  };

  // Helper function to format time
  const formatTime = (date) => {
    if (!date) return '';
    
    const now = new Date();
    const messageDate = new Date(date);
    const diffInHours = (now - messageDate) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
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

  const sortedUsers = getSortedUsers();

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

      {sortedUsers.length === 0 ? (
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
          data={sortedUsers}
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
                Available Users ({sortedUsers.length})
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
  unreadUserItem: {
    backgroundColor: '#e6f7ff',
    borderColor: '#91d5ff',
  },
  avatarContainer: {
    marginRight: wp('3%'),
    position: 'relative',
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
  unreadBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ff4d4f',
    borderRadius: wp('3%'),
    minWidth: wp('5%'),
    height: wp('5%'),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp('1%'),
  },
  unreadText: {
    color: '#fff',
    fontSize: wp('2.5%'),
    fontWeight: 'bold',
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
  unreadUserName: {
    fontWeight: 'bold',
    color: '#1890ff',
  },
  userEmail: {
    fontSize: wp('3.5%'),
    color: '#747d8c',
  },
  lastMessage: {
    fontSize: wp('3.5%'),
    color: '#747d8c',
  },
  unreadLastMessage: {
    fontWeight: '600',
    color: '#1890ff',
  },
  rightContainer: {
    alignItems: 'flex-end',
  },
  timestamp: {
    fontSize: wp('3%'),
    color: '#999',
    marginBottom: hp('0.5%'),
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
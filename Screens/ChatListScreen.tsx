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
  Animated,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
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
  const [chatDataMap, setChatDataMap] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  
  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        loadAllUsers(user.uid);
        
        // Start animations
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          })
        ]).start();
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
            photoURL: userData.photoURL || null,
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

  // Filter users based on search query
  const filteredUsers = users.filter(user => 
    user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort users by last message time and unread status
  const getSortedUsers = () => {
    return [...filteredUsers].sort((a, b) => {
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

  const renderUserItem = ({ item, index }) => {
    const unreadCount = unreadCounts[item.uid] || 0;
    const lastMessage = lastMessages[item.uid];
    
    return (
      <Animated.View
        style={[
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
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
          activeOpacity={0.7}
        >
          <View style={styles.avatarContainer}>
            {item.photoURL ? (
              <Image
                source={{ uri: item.photoURL }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {item.displayName ? item.displayName.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
            )}
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
            
            {/* Online status indicator */}
            <View style={styles.onlineIndicator} />
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
            <Ionicons name="chevron-forward" size={wp('4.5%')} color="#cbd5e0" />
          </View>
        </TouchableOpacity>
      </Animated.View>
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
        <ActivityIndicator size="large" color="#6c5ce7" />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={wp('20%')} color="#e74c3c" />
        <Text style={styles.errorText}>Error Loading Conversations</Text>
        <Text style={styles.errorSubtext}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => currentUser && loadAllUsers(currentUser.uid)}
        >
          <Ionicons name="refresh" size={wp('4%')} color="#fff" />
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Ionicons name="chatbubble-ellipses-outline" size={wp('20%')} color="#ddd" />
        <Text style={styles.errorText}>You need to be logged in to view conversations</Text>
      </SafeAreaView>
    );
  }

  const sortedUsers = getSortedUsers();

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Messages</Text>
          <TouchableOpacity style={styles.newChatButton}>
            <Ionicons name="create-outline" size={wp('5.5%')} color="#6c5ce7" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={wp('5%')} color="#a0aec0" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor="#a0aec0"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={wp('5%')} color="#a0aec0" />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.headerStats}>
          <Text style={styles.userCount}>
            {sortedUsers.length} conversation{sortedUsers.length !== 1 ? 's' : ''}
          </Text>
          {Object.values(unreadCounts).some(count => count > 0) && (
            <View style={styles.totalUnreadBadge}>
              <Text style={styles.totalUnreadText}>
                {Object.values(unreadCounts).reduce((sum, count) => sum + count, 0)} unread
              </Text>
            </View>
          )}
        </View>
      </Animated.View>

      {sortedUsers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={wp('25%')} color="#e2e8f0" />
          <Text style={styles.emptyText}>
            {searchQuery ? 'No matches found' : 'No conversations yet'}
          </Text>
          <Text style={styles.emptySubtext}>
            {searchQuery ? 
              'Try a different search term' : 
              'Start a conversation by messaging another user'
            }
          </Text>
          
          {!searchQuery && (
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={() => currentUser && loadAllUsers(currentUser.uid)}
            >
              <Ionicons name="refresh" size={wp('4%')} color="#6c5ce7" />
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          )}
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
              colors={['#6c5ce7']}
              tintColor="#6c5ce7"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    color: '#64748b',
    fontFamily: 'Inter-Medium',
  },
  errorText: {
    marginTop: hp('3%'),
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#2d3748',
    textAlign: 'center',
    fontFamily: 'Inter-SemiBold',
  },
  errorSubtext: {
    marginTop: hp('1%'),
    fontSize: wp('3.8%'),
    color: '#718096',
    textAlign: 'center',
    marginBottom: hp('3%'),
    fontFamily: 'Inter-Regular',
    maxWidth: '80%',
  },
  header: {
    padding: wp('5%'),
    paddingBottom: hp('2%'),
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  headerTitle: {
    fontSize: wp('6.5%'),
    fontWeight: 'bold',
    color: '#1e293b',
    fontFamily: 'Inter-Bold',
  },
  newChatButton: {
    padding: wp('2%'),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: wp('3%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.2%'),
    marginBottom: hp('1.5%'),
  },
  searchIcon: {
    marginRight: wp('2%'),
  },
  searchInput: {
    flex: 1,
    fontSize: wp('4%'),
    color: '#334155',
    fontFamily: 'Inter-Regular',
    padding: 0,
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userCount: {
    fontSize: wp('3.5%'),
    color: '#64748b',
    fontFamily: 'Inter-Medium',
  },
  totalUnreadBadge: {
    backgroundColor: '#6c5ce7',
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('0.5%'),
    borderRadius: wp('2%'),
  },
  totalUnreadText: {
    color: '#fff',
    fontSize: wp('3%'),
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  listContent: {
    padding: wp('4%'),
    paddingBottom: hp('2%'),
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp('4%'),
    marginBottom: hp('1.5%'),
    backgroundColor: '#fff',
    borderRadius: wp('4%'),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  unreadUserItem: {
    backgroundColor: '#f0f9ff',
    borderLeftWidth: 3,
    borderLeftColor: '#6c5ce7',
  },
  avatarContainer: {
    marginRight: wp('4%'),
    position: 'relative',
  },
  avatar: {
    width: wp('14%'),
    height: wp('14%'),
    borderRadius: wp('7%'),
  },
  avatarImage: {
    width: wp('14%'),
    height: wp('14%'),
    borderRadius: wp('7%'),
  },
  avatarPlaceholder: {
    backgroundColor: '#6c5ce7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  avatarText: {
    color: '#fff',
    fontSize: wp('5%'),
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  unreadBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ef4444',
    borderRadius: wp('3%'),
    minWidth: wp('5.5%'),
    height: wp('5.5%'),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp('1%'),
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  unreadText: {
    color: '#fff',
    fontSize: wp('2.8%'),
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: wp('3%'),
    height: wp('3%'),
    borderRadius: wp('1.5%'),
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userInfo: {
    flex: 1,
    marginRight: wp('3%'),
  },
  userName: {
    fontSize: wp('4.2%'),
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: hp('0.5%'),
    fontFamily: 'Inter-SemiBold',
  },
  unreadUserName: {
    color: '#6c5ce7',
  },
  userEmail: {
    fontSize: wp('3.5%'),
    color: '#64748b',
    fontFamily: 'Inter-Regular',
  },
  lastMessage: {
    fontSize: wp('3.8%'),
    color: '#64748b',
    fontFamily: 'Inter-Regular',
  },
  unreadLastMessage: {
    color: '#6c5ce7',
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
  rightContainer: {
    alignItems: 'flex-end',
  },
  timestamp: {
    fontSize: wp('3.2%'),
    color: '#94a3b8',
    marginBottom: hp('1%'),
    fontFamily: 'Inter-Regular',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('10%'),
  },
  emptyText: {
    marginTop: hp('3%'),
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
    fontFamily: 'Inter-SemiBold',
  },
  emptySubtext: {
    marginTop: hp('1%'),
    fontSize: wp('4%'),
    color: '#64748b',
    textAlign: 'center',
    marginBottom: hp('3%'),
    fontFamily: 'Inter-Regular',
    lineHeight: hp('2.8%'),
    maxWidth: '80%',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#6c5ce7',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.2%'),
    borderRadius: wp('2%'),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  refreshText: {
    color: '#6c5ce7',
    marginLeft: wp('2%'),
    fontWeight: '600',
    fontSize: wp('3.5%'),
    fontFamily: 'Inter-SemiBold',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6c5ce7',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.8%'),
    borderRadius: wp('2.5%'),
    shadowColor: '#6c5ce7',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3.84,
    elevation: 5,
  },
  retryText: {
    color: '#fff',
    marginLeft: wp('2%'),
    fontWeight: '600',
    fontSize: wp('4%'),
    fontFamily: 'Inter-SemiBold',
  },
});

export default ChatListScreen;
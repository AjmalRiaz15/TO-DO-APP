import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { get, off, onValue, orderByChild, push, query, ref, set, update } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import { auth, database } from '../firebaseConfig';

const ChatScreen = ({ route, navigation }) => {
  const { recipient, chatId } = route.params;
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatInitialized, setChatInitialized] = useState(false);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        initializeChat(user).then(() => {
          loadMessages(chatId);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      // Clean up the realtime listener when component unmounts
      const messagesRef = ref(database, `chats/${chatId}/messages`);
      off(messagesRef);
    };
  }, [chatId]);

  const initializeChat = async (user) => {
    try {
      const chatRef = ref(database, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      
      if (!chatSnapshot.exists()) {
        
        await set(chatRef, {
          participants: {
            [user.uid]: true,
            [recipient.uid]: true
          },
          lastMessage: '',
          lastMessageTime: Date.now(),
        });
      } else {
        // Ensure current user is a participant
        const participants = chatSnapshot.val().participants || {};
        if (!participants[user.uid]) {
          await update(ref(database, `chats/${chatId}/participants`), {
            [user.uid]: true
          });
        }
      }
      
      setChatInitialized(true);
    } catch (error) {
      console.error('Error initializing chat:', error);
      Alert.alert('Error', 'Failed to initialize chat. Please try again.');
    }
  };

  const loadMessages = (chatId) => {
    setLoading(true);
    const messagesRef = ref(database, `chats/${chatId}/messages`);
    const messagesQuery = query(messagesRef, orderByChild('timestamp'));
    
    onValue(messagesQuery, (snapshot) => {
      const messagesData = snapshot.val();
      if (messagesData) {
        // Convert messages object to array
        const messagesArray = Object.keys(messagesData)
          .map(key => ({
            id: key,
            ...messagesData[key]
          }))
          .sort((a, b) => a.timestamp - b.timestamp);
        
        setMessages(messagesArray);
        
        // Scroll to bottom when new messages arrive
        setTimeout(() => {
          if (flatListRef.current && messagesArray.length > 0) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, 100);
      } else {
        setMessages([]);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error loading messages:', error);
      
      if (error.code === 'PERMISSION_DENIED') {
        Alert.alert(
          'Permission Error', 
          'Cannot access this chat. Please check your security rules.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to load messages: ' + error.message);
      }
      setLoading(false);
    });
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !currentUser || sending) return;
    
    setSending(true);
    try {
      // First, ensure the chat exists with proper participants
      const chatRef = ref(database, `chats/${chatId}`);
      
      // Check if chat exists and get current data
      const chatSnapshot = await get(chatRef);
      
      if (!chatSnapshot.exists()) {
        // Create the chat structure if it doesn't exist
        await set(chatRef, {
          participants: {
            [currentUser.uid]: true,
            [recipient.uid]: true
          },
          lastMessage: messageText.trim(),
          lastMessageTime: Date.now(),
        });
      } else {
        // Only update last message and time for existing chats
        await update(chatRef, {
          lastMessage: messageText.trim(),
          lastMessageTime: Date.now(),
        });
      }
      
      // Now send the message
      const messagesRef = ref(database, `chats/${chatId}/messages`);
      const newMessageRef = push(messagesRef);
      
      const messageData = {
        id: newMessageRef.key,
        text: messageText.trim(),
        senderId: currentUser.uid,
        timestamp: Date.now(),
      };
      
      await set(newMessageRef, messageData);
      
      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
      
      if (error.code === 'PERMISSION_DENIED') {
        Alert.alert(
          'Permission Error', 
          'Cannot send message. Please check your security rules.'
        );
      } else {
        Alert.alert('Error', 'Failed to send message: ' + error.message);
      }
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isCurrentUser = item.senderId === currentUser?.uid;

    return (
      <View style={[
        styles.messageContainer,
        isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage
      ]}>
        {!isCurrentUser && (
          recipient.photoURL ? (
            <Image
              source={{ uri: recipient.photoURL }}
              style={styles.avatarSmall}
            />
          ) : (
            <View style={[styles.avatarSmall, styles.avatarPlaceholderSmall]}>
              <Text style={styles.avatarSmallText}>
                {recipient.displayName ? recipient.displayName.charAt(0).toUpperCase() :
                  recipient.email ? recipient.email.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
          )
        )}

        <View style={[
          styles.messageBubble,
          isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble
        ]}>
          <Text style={isCurrentUser ? styles.currentUserText : styles.otherUserText}>
            {item.text}
          </Text>
          <Text style={[
            styles.timestamp,
            isCurrentUser ? styles.currentUserTimestamp : styles.otherUserTimestamp
          ]}>
            {new Date(item.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>

        {isCurrentUser && (
          currentUser.photoURL ? (
            <Image
              source={{ uri: currentUser.photoURL }}
              style={styles.avatarSmall}
            />
          ) : (
            <View style={[styles.avatarSmall, styles.avatarPlaceholderSmall, styles.currentUserAvatar]}>
              <Text style={styles.avatarSmallText}>
                {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() :
                  currentUser.email ? currentUser.email.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
          )
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4a69bd" />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </SafeAreaView>
    );
  }

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Ionicons name="chatbubble-ellipses-outline" size={wp('15%')} color="#ccc" />
        <Text style={styles.errorText}>You need to be logged in to use the chat</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={wp('5%')} color="#4a69bd" />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {recipient.displayName || recipient.email || 'Unknown User'}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {isTyping ? 'Typing...' : recipient.email}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {recipient.photoURL ? (
            <Image
              source={{ uri: recipient.photoURL }}
              style={styles.headerAvatar}
            />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
              <Text style={styles.headerAvatarText}>
                {recipient.displayName ? recipient.displayName.charAt(0).toUpperCase() :
                  recipient.email ? recipient.email.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => {
          if (flatListRef.current && messages.length > 0) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }}
        onLayout={() => {
          if (flatListRef.current && messages.length > 0) {
            flatListRef.current.scrollToEnd({ animated: false });
          }
        }}
        inverted={false} // Ensure this is false to start from bottom
        ListEmptyComponent={
          <View style={styles.emptyChatContainer}>
            <Ionicons name="chatbubbles-outline" size={wp('15%')} color="#ccc" />
            <Text style={styles.emptyChatText}>No messages yet</Text>
            <Text style={styles.emptyChatSubtext}>
              Start the conversation by sending a message
            </Text>
          </View>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? hp('6%') : 0}
        style={styles.inputContainer}
      >
        <TextInput
          style={styles.textInput}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!messageText.trim() || sending) && styles.disabledButton]}
          onPress={handleSendMessage}
          disabled={!messageText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={wp('4.5%')} color="#fff" />
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    marginTop: hp('4%')
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
    fontSize: wp('4%'),
    color: '#747d8c',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp('4%'),
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f2f6',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  backButton: {
    marginRight: wp('3%'),
    padding: wp('1%'),
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#2f3542',
  },
  headerSubtitle: {
    fontSize: wp('3.5%'),
    color: '#747d8c',
    marginTop: hp('0.5%'),
  },
  headerRight: {
    marginLeft: wp('3%'),
  },
  headerAvatar: {
    width: wp('12%'),
    height: wp('12%'),
    borderRadius: wp('6%'),
  },
  headerAvatarPlaceholder: {
    backgroundColor: '#4a69bd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    color: '#fff',
    fontSize: wp('5%'),
    fontWeight: '600',
  },
  messagesList: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  messagesContent: {
    padding: wp('4%'),
    paddingBottom: hp('1%'),
    flexGrow: 1, // This ensures content starts from bottom
    justifyContent: 'flex-end',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: hp('2%'),
  },
  currentUserMessage: {
    justifyContent: 'flex-end',
  },
  otherUserMessage: {
    justifyContent: 'flex-start',
  },
  avatarSmall: {
    width: wp('8%'),
    height: wp('8%'),
    borderRadius: wp('4%'),
    marginHorizontal: wp('1.5%'),
  },
  avatarPlaceholderSmall: {
    backgroundColor: '#4a69bd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentUserAvatar: {
    backgroundColor: '#74b9ff',
  },
  avatarSmallText: {
    color: '#fff',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: '70%',
    padding: wp('3.5%'),
    borderRadius: wp('4%'),
    marginHorizontal: wp('1.5%'),
  },
  currentUserBubble: {
    backgroundColor: '#4a69bd',
    borderBottomRightRadius: wp('1%'),
  },
  otherUserBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: wp('1%'),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  currentUserText: {
    color: 'white',
    fontSize: wp('4%'),
    lineHeight: hp('2.5%'),
  },
  otherUserText: {
    color: '#2f3542',
    fontSize: wp('4%'),
    lineHeight: hp('2.5%'),
  },
  timestamp: {
    fontSize: wp('2.5%'),
    marginTop: hp('0.5%'),
    alignSelf: 'flex-end',
  },
  currentUserTimestamp: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherUserTimestamp: {
    color: 'rgba(47,53,66,0.5)',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: wp('3%'),
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#f1f2f6',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: wp('6%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: wp('3%'),
    marginRight: wp('2%'),
    maxHeight: hp('15%'),
    fontSize: wp('4%'),
    backgroundColor: '#f8f9fa',
  },
  sendButton: {
    backgroundColor: '#4a69bd',
    width: wp('13%'),
    height: wp('13%'),
    borderRadius: wp('6.5%'),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: wp('0.5%'),
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  emptyChatContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('10%'),
    minHeight: hp('50%'),
  },
  emptyChatText: {
    marginTop: hp('2%'),
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#2f3542',
    textAlign: 'center',
  },
  emptyChatSubtext: {
    marginTop: hp('1%'),
    fontSize: wp('3.5%'),
    color: '#747d8c',
    textAlign: 'center',
  },
});

export default ChatScreen;
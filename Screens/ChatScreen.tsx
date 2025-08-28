import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { onAuthStateChanged } from 'firebase/auth';
import { get, off, onValue, orderByChild, push, query, ref, set, update } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import {
  heightPercentageToDP as hp,
  widthPercentageToDP as wp,
} from 'react-native-responsive-screen';
import EmojiPicker from 'rn-emoji-keyboard';
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
  
  // New states for media features
  const [showMediaDrawer, setShowMediaDrawer] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [audioPermission, setAudioPermission] = useState(null);
  const recordTimeRef = useRef(null);

  const drawerAnimation = useRef(new Animated.Value(0)).current;
  const drawerHeight = hp('30%');

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

    // Request audio permissions
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      setAudioPermission(status === 'granted');
    })();

    return () => {
      unsubscribeAuth();
      // Clean up the realtime listener when component unmounts
      const messagesRef = ref(database, `chats/${chatId}/messages`);
      off(messagesRef);
      
      // Stop recording if component unmounts
      if (recording) {
        recording.stopAndUnloadAsync();
      }
      if (recordTimeRef.current) {
        clearInterval(recordTimeRef.current);
      }
    };
  }, [chatId]);

  useEffect(() => {
    if (showMediaDrawer) {
      Animated.spring(drawerAnimation, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 0,
      }).start();
    } else {
      Animated.spring(drawerAnimation, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }).start();
    }
  }, [showMediaDrawer]);

  const translateY = drawerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [drawerHeight, 0],
  });

  const openMediaDrawer = () => {
    setShowMediaDrawer(true);
  };

  const closeMediaDrawer = () => {
    Animated.spring(drawerAnimation, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start(() => setShowMediaDrawer(false));
  };

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

  const handleSendMessage = async (text = messageText, type = 'text', mediaUrl = null) => {
    if ((!text.trim() && !mediaUrl) || !currentUser || sending) return;
    
    setSending(true);
    try {
      // First, ensure the chat exists with proper participants
      const chatRef = ref(database, `chats/${chatId}`);
      
      // Check if chat exists and get current data
      const chatSnapshot = await get(chatRef);
      
      const messagePreview = type === 'text' 
        ? text.trim() 
        : type === 'image' 
          ? '📷 Image' 
          : type === 'audio' 
            ? '🎤 Audio message' 
            : '📎 Attachment';
      
      if (!chatSnapshot.exists()) {
        // Create the chat structure if it doesn't exist
        await set(chatRef, {
          participants: {
            [currentUser.uid]: true,
            [recipient.uid]: true
          },
          lastMessage: messagePreview,
          lastMessageTime: Date.now(),
        });
      } else {
        // Only update last message and time for existing chats
        await update(chatRef, {
          lastMessage: messagePreview,
          lastMessageTime: Date.now(),
        });
      }
      
      // Now send the message
      const messagesRef = ref(database, `chats/${chatId}/messages`);
      const newMessageRef = push(messagesRef);
      
      const messageData = {
        id: newMessageRef.key,
        text: text.trim(),
        senderId: currentUser.uid,
        timestamp: Date.now(),
        type,
      };
      
      if (mediaUrl) {
        messageData.mediaUrl = mediaUrl;
      }
      
      await set(newMessageRef, messageData);
      
      if (type === 'text') {
        setMessageText('');
      }
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

  const pickImage = async () => {
    closeMediaDrawer();
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        // Here you would typically upload the image to storage
        // and get a URL, then call handleSendMessage with the URL
        const imageUrl = result.assets[0].uri;
        handleSendMessage('', 'image', imageUrl);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async () => {
    closeMediaDrawer();
    
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        // Upload image and send message
        const imageUrl = result.assets[0].uri;
        handleSendMessage('', 'image', imageUrl);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickDocument = async () => {
    closeMediaDrawer();
    
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.type === 'success') {
        // Upload file and send message
        const fileUrl = result.uri;
        handleSendMessage(result.name, 'file', fileUrl);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const recordAudio = async () => {
    closeMediaDrawer();
    
    try {
      if (audioPermission !== 'granted') {
        Alert.alert('Permission needed', 'Microphone permission is required to record audio');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
      
      // Start timer
      setRecordTime(0);
      recordTimeRef.current = setInterval(() => {
        setRecordTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    
    try {
      await recording.stopAndUnloadAsync();
      setIsRecording(false);
      
      if (recordTimeRef.current) {
        clearInterval(recordTimeRef.current);
        recordTimeRef.current = null;
      }
      
      const uri = recording.getURI();
      
      // Send audio message
      handleSendMessage('', 'audio', uri);
      
      setRecording(null);
      setRecordTime(0);
    } catch (error) {
      console.error('Failed to stop recording', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const formatRecordTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleEmojiPick = (emojiObject) => {
    setMessageText(prevText => prevText + emojiObject.emoji);
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
          {item.type === 'image' && item.mediaUrl ? (
            <Image 
              source={{ uri: item.mediaUrl }} 
              style={styles.mediaPreview}
              resizeMode="cover"
            />
          ) : item.type === 'audio' && item.mediaUrl ? (
            <View style={styles.audioMessage}>
              <MaterialIcons name="audiotrack" size={24} color={isCurrentUser ? 'white' : '#4a69bd'} />
              <Text style={[styles.audioDuration, { color: isCurrentUser ? 'rgba(255,255,255,0.7)' : 'rgba(47,53,66,0.5)' }]}>
                0:30
              </Text>
            </View>
          ) : item.type === 'file' && item.mediaUrl ? (
            <View style={styles.fileMessage}>
              <MaterialIcons name="insert-drive-file" size={24} color={isCurrentUser ? 'white' : '#4a69bd'} />
              <Text style={[styles.fileName, { color: isCurrentUser ? 'white' : '#2f3542' }]} numberOfLines={1}>
                {item.text}
              </Text>
            </View>
          ) : (
            <Text style={isCurrentUser ? styles.currentUserText : styles.otherUserText}>
              {item.text}
            </Text>
          )}
          
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

      <KeyboardAvoidingView 
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? hp('6%') : 0}
      >
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
          inverted={false}
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

        {isRecording && (
          <View style={styles.recordingContainer}>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording... {formatRecordTime(recordTime)}</Text>
            </View>
            <TouchableOpacity onPress={stopRecording} style={styles.stopButton}>
              <Text style={styles.stopButtonText}>Stop</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Input Container with Text Input, Emoji Picker, and Media Picker */}
        <View style={styles.inputContainer}>
          <TouchableOpacity 
            onPress={() => setShowEmojiPicker(true)}
            style={styles.emojiButton}
          >
            <Ionicons name="happy-outline" size={wp('5.5%')} color="#747d8c" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={openMediaDrawer}
            style={styles.attachButton}
          >
            <Ionicons name="add" size={wp('5.5%')} color="#747d8c" />
          </TouchableOpacity>
          
          <TextInput
            style={styles.textInput}
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
          />
          
          {messageText.trim() ? (
            <TouchableOpacity
              style={[styles.sendButton, sending && styles.disabledButton]}
              onPress={() => handleSendMessage()}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={wp('4.5%')} color="#fff" />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={recordAudio}
              style={styles.micButton}
            >
              <Ionicons name="mic" size={wp('5.5%')} color="#747d8c" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Media Picker Bottom Sheet */}
      {showMediaDrawer && (
        <Modal
          transparent
          visible={showMediaDrawer}
          animationType="none"
          onRequestClose={closeMediaDrawer}
        >
          <TouchableWithoutFeedback onPress={closeMediaDrawer}>
            <View style={styles.drawerOverlay} />
          </TouchableWithoutFeedback>
          
          <Animated.View 
            style={[
              styles.mediaDrawer,
              { transform: [{ translateY }] }
            ]}
          >
            <View style={styles.drawerHandle} />
            
            <View style={styles.mediaOptions}>
              <TouchableOpacity style={styles.mediaOption} onPress={takePhoto}>
                <View style={[styles.mediaOptionIcon, { backgroundColor: '#4a69bd' }]}>
                  <Ionicons name="camera" size={wp('6%')} color="white" />
                </View>
                <Text style={styles.mediaOptionText}>Camera</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.mediaOption} onPress={pickImage}>
                <View style={[styles.mediaOptionIcon, { backgroundColor: '#e74c3c' }]}>
                  <Ionicons name="image" size={wp('6%')} color="white" />
                </View>
                <Text style={styles.mediaOptionText}>Gallery</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.mediaOption} onPress={recordAudio}>
                <View style={[styles.mediaOptionIcon, { backgroundColor: '#9b59b6' }]}>
                  <Ionicons name="mic" size={wp('6%')} color="white" />
                </View>
                <Text style={styles.mediaOptionText}>Audio</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.mediaOption} onPress={pickDocument}>
                <View style={[styles.mediaOptionIcon, { backgroundColor: '#f39c12' }]}>
                  <Ionicons name="document" size={wp('6%')} color="white" />
                </View>
                <Text style={styles.mediaOptionText}>Document</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Modal>
      )}

      {/* Emoji Picker */}
      <EmojiPicker
        onEmojiSelected={handleEmojiPick}
        open={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        theme={{
          backdrop: '#00000080',
          container: '#f8f9fa',
          header: '#4a69bd',
          skinTonesContainer: '#ffffff',
          category: {
            icon: '#4a69bd',
            iconActive: '#1e3a8a'
          },
          search: {
            background: '#ffffff',
            placeholder: '#747d8c',
            icon: '#747d8c',
            text: '#2f3542'
          }
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    marginTop: hp('4%')
  },
  flex1: {
    flex: 1,
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
    flexGrow: 1,
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
  mediaPreview: {
    width: wp('60%'),
    height: wp('45%'),
    borderRadius: wp('2%'),
    marginBottom: hp('1%'),
  },
  audioMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  audioDuration: {
    marginLeft: wp('2%'),
    fontSize: wp('3.5%'),
  },
  fileMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  fileName: {
    marginLeft: wp('2%'),
    fontSize: wp('3.5%'),
    maxWidth: wp('45%'),
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
  emojiButton: {
    padding: wp('2%'),
    marginRight: wp('1%'),
    marginBottom: wp('1%'),
  },
  attachButton: {
    padding: wp('2%'),
    marginRight: wp('2%'),
    marginBottom: wp('1%'),
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
  micButton: {
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
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  mediaDrawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: wp('5%'),
    borderTopRightRadius: wp('5%'),
    padding: wp('5%'),
    paddingBottom: hp('5%'),
  },
  drawerHandle: {
    width: wp('15%'),
    height: wp('1.5%'),
    backgroundColor: '#ddd',
    borderRadius: wp('1%'),
    alignSelf: 'center',
    marginBottom: hp('2%'),
  },
  mediaOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  mediaOption: {
    alignItems: 'center',
  },
  mediaOptionIcon: {
    width: wp('15%'),
    height: wp('15%'),
    borderRadius: wp('3%'),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  mediaOptionText: {
    fontSize: wp('3.5%'),
    color: '#2f3542',
    marginTop: hp('0.5%'),
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: wp('4%'),
    backgroundColor: '#ff6b6b',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingDot: {
    width: wp('3%'),
    height: wp('3%'),
    borderRadius: wp('1.5%'),
    backgroundColor: 'white',
    marginRight: wp('3%'),
  },
  recordingText: {
    color: 'white',
    fontSize: wp('4%'),
    fontWeight: '500',
  },
  stopButton: {
    paddingHorizontal: wp('4%'),
    paddingVertical: wp('2%'),
    backgroundColor: 'white',
    borderRadius: wp('2%'),
  },
  stopButtonText: {
    color: '#ff6b6b',
    fontWeight: 'bold',
  },
});

export default ChatScreen;
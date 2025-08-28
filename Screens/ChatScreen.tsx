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

  // Animation values
  const inputFocusAnimation = useRef(new Animated.Value(0)).current;
  const sendButtonAnimation = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    // Animate send button when text changes
    if (messageText.trim().length > 0) {
      Animated.spring(sendButtonAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.spring(sendButtonAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [messageText]);

  const translateY = drawerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [drawerHeight, 0],
  });

  const sendButtonScale = sendButtonAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const sendButtonOpacity = sendButtonAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
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

  const renderMessage = ({ item, index }) => {
    const isCurrentUser = item.senderId === currentUser?.uid;
    const showAvatar = index === 0 || messages[index - 1].senderId !== item.senderId;
    const showName = !isCurrentUser && (index === 0 || messages[index - 1].senderId !== item.senderId);

    return (
      <View style={[
        styles.messageContainer,
        isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage
      ]}>
        {!isCurrentUser && showAvatar && (
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

        {!isCurrentUser && !showAvatar && <View style={styles.avatarSpacer} />}

        <View style={[
          styles.messageContent,
          isCurrentUser ? styles.currentUserContent : styles.otherUserContent
        ]}>
          {showName && !isCurrentUser && (
            <Text style={styles.senderName}>
              {recipient.displayName || recipient.email || 'Unknown User'}
            </Text>
          )}
          
          <View style={[
            styles.messageBubble,
            isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble,
            showAvatar && (isCurrentUser ? styles.currentUserFirstBubble : styles.otherUserFirstBubble)
          ]}>
            {item.type === 'image' && item.mediaUrl ? (
              <TouchableOpacity activeOpacity={0.9}>
                <Image 
                  source={{ uri: item.mediaUrl }} 
                  style={styles.mediaPreview}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : item.type === 'audio' && item.mediaUrl ? (
              <View style={styles.audioMessage}>
                <TouchableOpacity style={styles.audioPlayButton}>
                  <MaterialIcons name="play-arrow" size={28} color={isCurrentUser ? 'white' : '#4a69bd'} />
                </TouchableOpacity>
                <View style={styles.audioWaveform}>
                  <View style={[styles.audioWaveBar, { height: 20, backgroundColor: isCurrentUser ? 'rgba(255,255,255,0.6)' : 'rgba(74,105,189,0.4)' }]} />
                  <View style={[styles.audioWaveBar, { height: 30, backgroundColor: isCurrentUser ? 'rgba(255,255,255,0.8)' : 'rgba(74,105,189,0.6)' }]} />
                  <View style={[styles.audioWaveBar, { height: 25, backgroundColor: isCurrentUser ? 'rgba(255,255,255,0.7)' : 'rgba(74,105,189,0.5)' }]} />
                  <View style={[styles.audioWaveBar, { height: 15, backgroundColor: isCurrentUser ? 'rgba(255,255,255,0.5)' : 'rgba(74,105,189,0.3)' }]} />
                </View>
                <Text style={[styles.audioDuration, { color: isCurrentUser ? 'rgba(255,255,255,0.7)' : 'rgba(47,53,66,0.5)' }]}>
                  {formatRecordTime(30)}
                </Text>
              </View>
            ) : item.type === 'file' && item.mediaUrl ? (
              <TouchableOpacity style={styles.fileMessage} activeOpacity={0.7}>
                <View style={[styles.fileIconContainer, { backgroundColor: isCurrentUser ? 'rgba(255,255,255,0.2)' : 'rgba(74,105,189,0.1)' }]}>
                  <MaterialIcons name="insert-drive-file" size={24} color={isCurrentUser ? 'white' : '#4a69bd'} />
                </View>
                <View style={styles.fileInfo}>
                  <Text style={[styles.fileName, { color: isCurrentUser ? 'white' : '#2f3542' }]} numberOfLines={1}>
                    {item.text}
                  </Text>
                  <Text style={[styles.fileSize, { color: isCurrentUser ? 'rgba(255,255,255,0.7)' : 'rgba(47,53,66,0.5)' }]}>
                    2.4 MB • PDF
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <Text style={isCurrentUser ? styles.currentUserText : styles.otherUserText}>
                {item.text}
              </Text>
            )}
            
            <View style={styles.messageFooter}>
              <Text style={[
                styles.timestamp,
                isCurrentUser ? styles.currentUserTimestamp : styles.otherUserTimestamp
              ]}>
                {new Date(item.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
              {isCurrentUser && (
                <Ionicons 
                  name="checkmark-done" 
                  size={14} 
                  color={item.read ? '#4a69bd' : 'rgba(255,255,255,0.5)'} 
                  style={styles.readIndicator} 
                />
              )}
            </View>
          </View>
        </View>

        {isCurrentUser && showAvatar && (
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

        {isCurrentUser && !showAvatar && <View style={styles.avatarSpacer} />}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6c5ce7" />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </SafeAreaView>
    );
  }

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Ionicons name="chatbubble-ellipses-outline" size={wp('15%')} color="#ddd" />
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
          <Ionicons name="chevron-back" size={wp('5.5%')} color="#2d3436" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerInfo} onPress={() => {}}>
          <View style={styles.headerUser}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {recipient.displayName || recipient.email || 'Unknown User'}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {isTyping ? 'Typing...' : 'Online'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="videocam" size={wp('5.5%')} color="#2d3436" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="call" size={wp('5%')} color="#2d3436" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="ellipsis-vertical" size={wp('4.5%')} color="#2d3436" />
          </TouchableOpacity>
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
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyChatContainer}>
              <View style={styles.emptyChatIcon}>
                <Ionicons name="chatbubbles-outline" size={wp('20%')} color="#dfe6e9" />
              </View>
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
              <View style={styles.recordingPulse} />
              <Text style={styles.recordingText}>Recording... {formatRecordTime(recordTime)}</Text>
            </View>
            <TouchableOpacity onPress={stopRecording} style={styles.stopButton}>
              <Ionicons name="stop" size={wp('5%')} color="white" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Container with Text Input, Emoji Picker, and Media Picker */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TouchableOpacity 
              onPress={() => setShowEmojiPicker(true)}
              style={styles.emojiButton}
            >
              <Ionicons name="happy-outline" size={wp('6%')} color="#636e72" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={openMediaDrawer}
              style={styles.attachButton}
            >
              <Ionicons name="attach" size={wp('6%')} color="#636e72" />
            </TouchableOpacity>
            
            <TextInput
              style={styles.textInput}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Type a message..."
              placeholderTextColor="#b2bec3"
              multiline
              maxLength={500}
            />
          </View>
          
          {messageText.trim().length > 0 ? (
            <TouchableOpacity
              style={[styles.sendButton, sending && styles.disabledButton]}
              onPress={() => handleSendMessage()}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={wp('5%')} color="#fff" />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={recordAudio}
              style={styles.micButton}
            >
              <Ionicons name="mic" size={wp('6%')} color="#636e72" />
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
                <View style={[styles.mediaOptionIcon, styles.cameraOption]}>
                  <Ionicons name="camera" size={wp('7%')} color="white" />
                </View>
                <Text style={styles.mediaOptionText}>Camera</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.mediaOption} onPress={pickImage}>
                <View style={[styles.mediaOptionIcon, styles.galleryOption]}>
                  <Ionicons name="image" size={wp('7%')} color="white" />
                </View>
                <Text style={styles.mediaOptionText}>Gallery</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.mediaOption} onPress={recordAudio}>
                <View style={[styles.mediaOptionIcon, styles.audioOption]}>
                  <Ionicons name="mic" size={wp('7%')} color="white" />
                </View>
                <Text style={styles.mediaOptionText}>Audio</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.mediaOption} onPress={pickDocument}>
                <View style={[styles.mediaOptionIcon, styles.documentOption]}>
                  <Ionicons name="document" size={wp('7%')} color="white" />
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
          container: '#fff',
          header: '#6c5ce7',
          skinTonesContainer: '#ffffff',
          category: {
            icon: '#6c5ce7',
            iconActive: '#3b3b98'
          },
          search: {
            background: '#f8f9fa',
            placeholder: '#b2bec3',
            icon: '#b2bec3',
            text: '#2d3436'
          }
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop:hp('4%'),
    flex: 1,
    backgroundColor: '#f8f9fa',
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
    color: '#636e72',
    fontFamily: 'Inter-Medium',
  },
  errorText: {
    marginTop: hp('2%'),
    fontSize: wp('4%'),
    color: '#636e72',
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp('4%'),
    paddingTop: hp('2%'),
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f2f6',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 10,
  },
  backButton: {
    padding: wp('1%'),
    marginRight: wp('2%'),
  },
  headerInfo: {
    flex: 1,
  },
  headerUser: {
    flex: 1,
  },
  headerTitle: {
    fontSize: wp('4.8%'),
    fontWeight: '600',
    color: '#2d3436',
    fontFamily: 'Inter-SemiBold',
  },
  headerSubtitle: {
    fontSize: wp('3.5%'),
    color: '#636e72',
    marginTop: hp('0.3%'),
    fontFamily: 'Inter-Regular',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: wp('2%'),
    marginLeft: wp('1%'),
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
    alignItems: 'flex-start',
    marginBottom: hp('1.2%'),
  },
  messageContent: {
    flex: 1,
    marginHorizontal: wp('1.5%'),
  },
  senderName: {
    fontSize: wp('3.2%'),
    color: '#636e72',
    marginBottom: hp('0.5%'),
    marginLeft: wp('1%'),
    fontFamily: 'Inter-Medium',
  },
  currentUserMessage: {
    justifyContent: 'flex-end',
  },
  otherUserMessage: {
    justifyContent: 'flex-start',
  },
  currentUserContent: {
    alignItems: 'flex-end',
  },
  otherUserContent: {
    alignItems: 'flex-start',
  },
  avatarSmall: {
    width: wp('8%'),
    height: wp('8%'),
    borderRadius: wp('4%'),
  },
  avatarSpacer: {
    width: wp('8%'),
  },
  avatarPlaceholderSmall: {
    backgroundColor: '#6c5ce7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  currentUserAvatar: {
    backgroundColor: '#00b894',
  },
  avatarSmallText: {
    color: '#fff',
    fontSize: wp('3.5%'),
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: wp('3.5%'),
    borderRadius: wp('4%'),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  currentUserBubble: {
    backgroundColor: '#6c5ce7',
  },
  otherUserBubble: {
    backgroundColor: '#fff',
  },
  currentUserFirstBubble: {
    borderBottomRightRadius: wp('1%'),
  },
  otherUserFirstBubble: {
    borderBottomLeftRadius: wp('1%'),
  },
  currentUserText: {
    color: 'white',
    fontSize: wp('4%'),
    lineHeight: hp('2.5%'),
    fontFamily: 'Inter-Regular',
  },
  otherUserText: {
    color: '#2d3436',
    fontSize: wp('4%'),
    lineHeight: hp('2.5%'),
    fontFamily: 'Inter-Regular',
  },
  mediaPreview: {
    width: wp('60%'),
    height: wp('45%'),
    borderRadius: wp('3%'),
    marginBottom: hp('1%'),
  },
  audioMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('0.5%'),
  },
  audioPlayButton: {
    padding: wp('2%'),
    marginRight: wp('2%'),
  },
  audioWaveform: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: wp('8%'),
    marginRight: wp('3%'),
  },
  audioWaveBar: {
    width: wp('1.5%'),
    borderRadius: wp('0.75%'),
    marginHorizontal: wp('0.5%'),
  },
  audioDuration: {
    fontSize: wp('3.2%'),
    fontFamily: 'Inter-Medium',
  },
  fileMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('0.5%'),
  },
  fileIconContainer: {
    padding: wp('2.5%'),
    borderRadius: wp('2%'),
    marginRight: wp('3%'),
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: wp('3.8%'),
    fontFamily: 'Inter-Medium',
    marginBottom: hp('0.3%'),
  },
  fileSize: {
    fontSize: wp('3%'),
    fontFamily: 'Inter-Regular',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: hp('0.5%'),
  },
  timestamp: {
    fontSize: wp('2.8%'),
    fontFamily: 'Inter-Regular',
  },
  currentUserTimestamp: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherUserTimestamp: {
    color: 'rgba(45,52,54,0.5)',
  },
  readIndicator: {
    marginLeft: wp('1.5%'),
  },
   inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1%'),
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#f1f2f6',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 5,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f8f9fa',
    borderRadius: wp('5%'),
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.8%'),
  },
  emojiButton: {
    padding: wp('2%'),
  },
  attachButton: {
    padding: wp('2%'),
  },
  textInput: {
    flex: 1,
    fontSize: wp('4%'),
    maxHeight: hp('20%'),
    paddingVertical: hp('0.8%'),
    paddingHorizontal: wp('2%'),
    color: '#2d3436',
    fontFamily: 'Inter-Regular',
  },
  sendButton: {
    marginLeft: wp('2%'),
    backgroundColor: '#6c5ce7',
    borderRadius: wp('6%'),
    padding: wp('3%'),
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  micButton: {
    marginLeft: wp('2%'),
    backgroundColor: '#f1f2f6',
    borderRadius: wp('6%'),
    padding: wp('3%'),
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ff7675',
    marginHorizontal: wp('3%'),
    marginBottom: hp('1%'),
    borderRadius: wp('4%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingPulse: {
    width: wp('3%'),
    height: wp('3%'),
    borderRadius: wp('1.5%'),
    backgroundColor: 'white',
    marginRight: wp('2%'),
  },
  recordingText: {
    color: 'white',
    fontSize: wp('3.5%'),
    fontFamily: 'Inter-Medium',
  },
  stopButton: {
    backgroundColor: '#d63031',
    borderRadius: wp('5%'),
    padding: wp('2.5%'),
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: '#00000060',
  },
  mediaDrawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: wp('6%'),
    borderTopRightRadius: wp('6%'),
    paddingBottom: hp('3%'),
    paddingTop: hp('1%'),
    paddingHorizontal: wp('5%'),
  },
  drawerHandle: {
    alignSelf: 'center',
    width: wp('15%'),
    height: hp('0.8%'),
    borderRadius: hp('0.4%'),
    backgroundColor: '#dfe6e9',
    marginBottom: hp('2%'),
  },
  mediaOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  mediaOption: {
    alignItems: 'center',
    width: wp('20%'),
  },
  mediaOptionIcon: {
    width: wp('14%'),
    height: wp('14%'),
    borderRadius: wp('7%'),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  cameraOption: {
    backgroundColor: '#0984e3',
  },
  galleryOption: {
    backgroundColor: '#6c5ce7',
  },
  audioOption: {
    backgroundColor: '#00b894',
  },
  documentOption: {
    backgroundColor: '#fd79a8',
  },
  mediaOptionText: {
    fontSize: wp('3.2%'),
    color: '#2d3436',
    fontFamily: 'Inter-Medium',
  },
  emptyChatContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: hp('20%'),
  },
  emptyChatIcon: {
    marginBottom: hp('2%'),
  },
  emptyChatText: {
    fontSize: wp('4.5%'),
    fontFamily: 'Inter-SemiBold',
    color: '#2d3436',
    marginBottom: hp('0.5%'),
  },
  emptyChatSubtext: {
    fontSize: wp('3.5%'),
    fontFamily: 'Inter-Regular',
    color: '#636e72',
    textAlign: 'center',
    paddingHorizontal: wp('10%'),
  },
});
export default ChatScreen;

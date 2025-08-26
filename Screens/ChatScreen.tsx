import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const ChatScreen = () => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    // Set initial message
    setMessages([
      {
        id: '1',
        text: 'Hello! How can I help you today?',
        createdAt: new Date(),
        user: {
          id: '2',
          name: 'Assistant',
        },
        isUser: false,
      },
    ]);
  }, []);

  const handleSend = useCallback(() => {
    if (inputText.trim().length === 0) return;

    const newMessage = {
      id: Date.now().toString(),
      text: inputText,
      createdAt: new Date(),
      user: {
        id: '1',
        name: 'You',
      },
      isUser: true,
    };

    setMessages(prevMessages => [newMessage, ...prevMessages]);
    setInputText('');

    // Simulate a reply after a short delay
    setTimeout(() => {
      const replyMessage = {
        id: (Date.now() + 1).toString(),
        text: 'Thanks for your message! How can I assist you further?',
        createdAt: new Date(),
        user: {
          id: '2',
          name: 'Assistant',
        },
        isUser: false,
      };
      setMessages(prevMessages => [replyMessage, ...prevMessages]);
    }, 1000);
  }, [inputText]);

  const renderMessage = ({ item }) => (
    <View style={[
      styles.messageContainer,
      item.isUser ? styles.userMessageContainer : styles.assistantMessageContainer
    ]}>
      <Text style={styles.messageUser}>{item.user.name}</Text>
      <View style={[
        styles.messageBubble,
        item.isUser ? styles.userMessageBubble : styles.assistantMessageBubble
      ]}>
        <Text style={item.isUser ? styles.userMessageText : styles.assistantMessageText}>
          {item.text}
        </Text>
      </View>
      <Text style={styles.messageTime}>
        {item.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.chatContainer}>
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            inverted
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
          />
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              multiline
              maxHeight={100}
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSend}
              disabled={inputText.trim().length === 0}
            >
              <Ionicons
                name="send"
                size={24}
                color={inputText.trim().length === 0 ? '#ccc' : '#007AFF'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
    padding: 16,
  },
  messagesList: {
    paddingVertical: 8,
  },
  messageContainer: {
    marginVertical: 8,
    maxWidth: '80%',
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  assistantMessageContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  messageUser: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
    marginBottom: 4,
  },
  userMessageBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  assistantMessageBubble: {
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 4,
  },
  userMessageText: {
    color: 'white',
    fontSize: 16,
  },
  assistantMessageText: {
    color: 'black',
    fontSize: 16,
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 4,
  },
  sendButton: {
    padding: 8,
    marginLeft: 8,
  },
});

export default ChatScreen;
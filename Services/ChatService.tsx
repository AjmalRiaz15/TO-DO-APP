// services/ChatService.js
import { limitToLast, onValue, orderByChild, push, query, ref, set, update } from 'firebase/database';
import { database } from '../firebaseConfig';

class ChatService {
  // Create a new chat
  async createChat(participantIds, chatName = '') {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('User not authenticated');

      // Create chat in database
      const chatRef = push(ref(database, 'chats'));
      const chatId = chatRef.key;

      const chatData = {
        id: chatId,
        name: chatName,
        createdAt: Date.now(),
        participants: {}
      };

      // Add all participants including current user
      participantIds.forEach(pid => {
        chatData.participants[pid] = true;
      });
      chatData.participants[currentUser.uid] = true;

      await set(chatRef, chatData);

      // Add chat reference to each user's userChats
      const updates = {};
      Object.keys(chatData.participants).forEach(uid => {
        updates[`userChats/${uid}/${chatId}`] = true;
      });

      await update(ref(database), updates);

      return { success: true, chatId };

    } catch (error) {
      console.error('Create chat error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send a message
  async sendMessage(chatId, text) {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('User not authenticated');

      const messageData = {
        text: text.trim(),
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'Unknown',
        timestamp: Date.now(),
        chatId: chatId
      };

      // Add message to chat
      const messageRef = push(ref(database, `chats/${chatId}/messages`));
      await set(messageRef, messageData);

      // Update chat last message and timestamp
      await update(ref(database, `chats/${chatId}`), {
        lastMessage: messageData.text,
        lastMessageTime: messageData.timestamp,
        lastMessageSender: currentUser.uid
      });

      return { success: true, messageId: messageRef.key };

    } catch (error) {
      console.error('Send message error:', error);
      return { success: false, error: error.message };
    }
  }

  // Listen for messages in a chat
  listenToMessages(chatId, callback) {
    const messagesRef = query(
      ref(database, `chats/${chatId}/messages`),
      orderByChild('timestamp'),
      limitToLast(100)
    );

    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const messages = [];
      snapshot.forEach((childSnapshot) => {
        messages.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      callback(messages);
    }, (error) => {
      console.error('Listen to messages error:', error);
    });

    return unsubscribe;
  }

  // Get chat participants
  async getChatParticipants(chatId) {
    try {
      const snapshot = await get(ref(database, `chats/${chatId}/participants`));
      if (snapshot.exists()) {
        return snapshot.val();
      }
      return {};
    } catch (error) {
      console.error('Get participants error:', error);
      throw error;
    }
  }

  // Add participant to chat
  async addParticipant(chatId, userId) {
    try {
      const updates = {};
      updates[`chats/${chatId}/participants/${userId}`] = true;
      updates[`userChats/${userId}/${chatId}`] = true;

      await update(ref(database), updates);
      return { success: true };

    } catch (error) {
      console.error('Add participant error:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new ChatService();
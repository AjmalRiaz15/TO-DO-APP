import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";
import { auth, db } from "../firebaseConfig";
// Responsive screen imports
import {
  heightPercentageToDP as hp,
  widthPercentageToDP as wp
} from 'react-native-responsive-screen';

export default function TodoScreen() {
  const navigation = useNavigation();
  const [todos, setTodos] = useState([]);
  const [filteredTodos, setFilteredTodos] = useState([]);
  const [text, setText] = useState("");
  const [userName, setUserName] = useState("");
  const [priority, setPriority] = useState("Low");
  const [editingId, setEditingId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [orientation, setOrientation] = useState(
    Dimensions.get('window').height >= Dimensions.get('window').width ? 'portrait' : 'landscape'
  );

  useEffect(() => {
    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        setUserName(user.displayName || user.email);
        loadTodos(user.uid);
      } else {
        // Redirect to login if not authenticated
        navigation.replace('Login');
      }
    });

    // Set up orientation listener with updated API
    const dimensionChangeSubscription = Dimensions.addEventListener(
      'change',
      ({ window }) => {
        setOrientation(window.height >= window.width ? 'portrait' : 'landscape');
      }
    );

    return () => {
      unsubscribe(); // Cleanup auth listener
      dimensionChangeSubscription?.remove(); // Cleanup orientation listener using the new API
    };
  }, []);

  useEffect(() => {
    filterTodos();
  }, [todos, filter]);

  const filterTodos = () => {
    switch (filter) {
      case "Active":
        setFilteredTodos(todos.filter(todo => !todo.completed));
        break;
      case "Completed":
        setFilteredTodos(todos.filter(todo => todo.completed));
        break;
      default:
        setFilteredTodos(todos);
    }
  };

  const loadTodos = async (userId) => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "todos"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      
      const todosData = [];
      querySnapshot.forEach((doc) => {
        todosData.push({ id: doc.id, ...doc.data() });
      });
      
      setTodos(todosData);
      setLoading(false);
    } catch (error) {
      console.error("Error loading todos:", error);
      if (error.code === 'permission-denied') {
        Alert.alert(
          "Permissions Error", 
          "Please check your Firestore security rules",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("Error", "Failed to load tasks");
      }
      setLoading(false);
    }
  };

  const saveTodo = async (todoData) => {
    try {
      if (!user) {
        Alert.alert("Error", "You must be logged in to save tasks");
        return;
      }

      if (editingId) {
        // Update existing todo
        const todoRef = doc(db, "todos", editingId);
        await updateDoc(todoRef, {
          text: todoData.text,
          priority: todoData.priority,
          updatedAt: new Date(),
        });
      } else {
        // Create new todo
        const newTodoRef = doc(collection(db, "todos"));
        await setDoc(newTodoRef, {
          ...todoData,
          id: newTodoRef.id,
          userId: user.uid,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      // Reload todos after saving
      loadTodos(user.uid);
    } catch (error) {
      console.error("Error saving todo:", error);
      Alert.alert("Error", "Failed to save task");
    }
  };

  const handleAddOrEditTodo = () => {
    if (text.trim()) {
      const todoData = { text: text.trim(), priority };
      saveTodo(todoData);
      setText("");
      setPriority("Low");
      setEditingId(null);
      setModalVisible(false);
    }
  };

  const toggleTodo = async (id) => {
    try {
      const todo = todos.find(t => t.id === id);
      const todoRef = doc(db, "todos", id);
      await updateDoc(todoRef, {
        completed: !todo.completed,
        updatedAt: new Date(),
      });
      
      // Reload todos after updating
      if (user) loadTodos(user.uid);
    } catch (error) {
      console.error("Error toggling todo:", error);
      Alert.alert("Error", "Failed to update task");
    }
  };

  const deleteTodo = async (id) => {
    try {
      await deleteDoc(doc(db, "todos", id));
      
      // Reload todos after deleting
      if (user) loadTodos(user.uid);
    } catch (error) {
      console.error("Error deleting todo:", error);
      Alert.alert("Error", "Failed to delete task");
    }
  };

  const editTodo = (item) => {
    setText(item.text);
    setPriority(item.priority);
    setEditingId(item.id);
    setModalVisible(true);
  };

  const clearTodos = async () => {
    Alert.alert("Confirm", "Are you sure you want to delete all tasks?", [
      { text: "Cancel" },
      {
        text: "Yes",
        onPress: async () => {
          try {
            if (!user) {
              Alert.alert("Error", "You must be logged in to clear tasks");
              return;
            }
            
            // Get all user's todos
            const q = query(
              collection(db, "todos"),
              where("userId", "==", user.uid)
            );
            const querySnapshot = await getDocs(q);
            
            // Delete all todos in a batch
            const batch = writeBatch(db);
            querySnapshot.forEach((doc) => {
              batch.delete(doc.ref);
            });
            
            await batch.commit();
            
            // Reload todos after clearing
            loadTodos(user.uid);
          } catch (error) {
            console.error("Error clearing todos:", error);
            Alert.alert("Error", "Failed to clear tasks");
          }
        },
      },
    ]);
  };

  const handleChatNavigation = () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to access chat");
      navigation.replace('Login');
      return;
    }
    
    // Navigate to Chat screen with user info
    navigation.navigate("ChatList", { 
      userId: user.uid,
      userName: user.displayName || user.email,
      // Add these parameters to match what your ChatScreen expects
      chatName: `${user.displayName || user.email}'s Chat`,
      chatImage: user.photoURL || null
    });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "High":
        return "#ff4757";
      case "Medium":
        return "#ffa502";
      default:
        return "#2ed573";
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case "High":
        return "🔴";
      case "Medium":
        return "🟡";
      default:
        return "🟢";
    }
  };

  const resetModal = () => {
    setText("");
    setPriority("Low");
    setEditingId(null);
    setModalVisible(false);
  };

  const renderTodoItem = ({ item }) => (
    <View
      style={[
        styles.todoItem,
        { borderLeftColor: getPriorityColor(item.priority) },
      ]}
    >
      <TouchableOpacity
        onPress={() => toggleTodo(item.id)}
        style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
      >
        <View style={[styles.checkbox, item.completed && styles.checkedBox]}>
          {item.completed && <Ionicons name="checkmark" size={wp('4%')} color="#fff" />}
        </View>
        <View style={styles.todoContent}>
          <Text
            style={[styles.todoText, item.completed && styles.completed]}
            numberOfLines={2}
          >
            {item.text}
          </Text>
          <View style={styles.priorityContainer}>
            <Text style={[styles.priorityLabel, { color: getPriorityColor(item.priority) }]}>
              {getPriorityIcon(item.priority)} {item.priority} Priority
            </Text>
          </View>
        </View>
      </TouchableOpacity>
      <View style={styles.actionButtons}>
        <TouchableOpacity onPress={() => editTodo(item)} style={styles.actionButton}>
          <Ionicons name="create-outline" size={wp('5.5%')} color="#3498db" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => deleteTodo(item.id)} style={styles.actionButton}>
          <Ionicons name="trash-outline" size={wp('5.5%')} color="#e74c3c" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a69bd" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {userName}</Text>
          <Text style={styles.subtitle}>What's your plan for today?</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={handleChatNavigation} style={styles.headerButton}>
            <Ionicons name="chatbubble-ellipses-outline" size={wp('8.5%')} color="#4A90E2" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Profile")} style={styles.headerButton}>
            <Ionicons name="person-circle-outline" size={wp('8.5%')} color="#4A90E2" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {["All", "Active", "Completed"].map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.filterButton,
              filter === option && styles.activeFilter,
            ]}
            onPress={() => setFilter(option)}
          >
            <Text
              style={[
                styles.filterText,
                filter === option && styles.activeFilterText,
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{todos.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {todos.filter(todo => !todo.completed).length}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {todos.filter(todo => todo.completed).length}
          </Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      {/* Todo List */}
      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#4a69bd" />
          <Text style={styles.emptyStateText}>Loading tasks...</Text>
        </View>
      ) : filteredTodos.length > 0 ? (
        <FlatList
          data={filteredTodos}
          keyExtractor={(item) => item.id}
          renderItem={renderTodoItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-done-circle-outline" size={wp('15%')} color="#ddd" />
          <Text style={styles.emptyStateText}>No tasks found</Text>
          <Text style={styles.emptyStateSubtext}>
            {filter === "All" 
              ? "Add a new task to get started" 
              : `No ${filter.toLowerCase()} tasks`}
          </Text>
        </View>
      )}

      {/* Clear All Button */}
      {todos.length > 0 && (
        <TouchableOpacity style={styles.clearButton} onPress={clearTodos}>
          <Ionicons name="trash-outline" size={wp('5%')} color="#fff" />
          <Text style={styles.clearText}>Clear All</Text>
        </TouchableOpacity>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={wp('7.5%')} color="#fff" />
      </TouchableOpacity>

      {/* Add/Edit Task Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={resetModal}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingId ? "Edit Task" : "Add New Task"}
              </Text>
              
              <TextInput
                style={styles.modalInput}
                placeholder="What needs to be done?"
                placeholderTextColor="#999"
                value={text}
                onChangeText={setText}
                multiline={true}
                autoFocus={true}
              />
              
              <Text style={styles.priorityTitle}>Priority</Text>
              <View style={styles.priorityOptions}>
                {["Low", "Medium", "High"].map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityOption,
                      { backgroundColor: priority === p ? getPriorityColor(p) : "#f1f2f6" },
                    ]}
                    onPress={() => setPriority(p)}
                  >
                    <Text style={[
                      styles.priorityOptionText,
                      { color: priority === p ? "#fff" : "#57606f" }
                    ]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]} 
                  onPress={resetModal}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton, !text.trim() && styles.disabledButton]} 
                  onPress={handleAddOrEditTodo}
                  disabled={!text.trim()}
                >
                  <Text style={styles.saveButtonText}>
                    {editingId ? "Update" : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    paddingHorizontal: wp('5%'),
    paddingTop: Platform.OS === 'ios' ? hp('6%') : hp('4%'),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  loadingText: {
    marginTop: hp('1%'),
    fontSize: hp('2%'),
    color: '#747d8c',
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: hp('2.5%'),
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: wp('4%'),
  },
  greeting: {
    fontSize: hp('3%'),
    fontWeight: "bold",
    color: "#2f3542",
  },
  subtitle: {
    fontSize: hp('1.8%'),
    color: "#747d8c",
    marginTop: hp('0.5%'),
  },
  filterContainer: {
    flexDirection: "row",
    backgroundColor: "#f1f2f6",
    borderRadius: wp('2.5%'),
    padding: wp('1%'),
    marginBottom: hp('2.5%'),
  },
  filterButton: {
    flex: 1,
    paddingVertical: hp('1%'),
    borderRadius: wp('2%'),
    alignItems: "center",
  },
  activeFilter: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  filterText: {
    fontSize: hp('1.8%'),
    color: "#747d8c",
    fontWeight: "500",
  },
  activeFilterText: {
    color: "#4a69bd",
    fontWeight: "600",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: hp('2.5%'),
    backgroundColor: "#fff",
    borderRadius: wp('3%'),
    padding: wp('4%'),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: hp('2.5%'),
    fontWeight: "bold",
    color: "#2f3542",
  },
  statLabel: {
    fontSize: hp('1.6%'),
    color: "#747d8c",
    marginTop: hp('0.5%'),
  },
  listContainer: {
    paddingBottom: hp('12%'),
  },
  todoItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: wp('4%'),
    borderRadius: wp('3%'),
    marginBottom: hp('1.5%'),
    alignItems: "center",
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  checkbox: {
    width: wp('5.5%'),
    height: wp('5.5%'),
    borderRadius: wp('1.5%'),
    borderWidth: 2,
    borderColor: "#ddd",
    marginRight: wp('3%'),
    alignItems: "center",
    justifyContent: "center",
  },
  checkedBox: {
    backgroundColor: "#2ed573",
    borderColor: "#2ed573",
  },
  todoContent: {
    flex: 1,
  },
  todoText: {
    fontSize: hp('2%'),
    color: "#2f3542",
    marginBottom: hp('0.5%'),
  },
  completed: {
    textDecorationLine: "line-through",
    color: "#747d8c",
  },
  priorityContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  priorityLabel: {
    fontSize: hp('1.6%'),
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
  },
  actionButton: {
    padding: wp('2%'),
    marginLeft: wp('2%'),
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: hp('7%'),
  },
  emptyStateText: {
    fontSize: hp('2.2%'),
    color: "#747d8c",
    fontWeight: "600",
    marginTop: hp('2%'),
  },
  emptyStateSubtext: {
    fontSize: hp('1.8%'),
    color: "#a4b0be",
    marginTop: hp('1%'),
  },
  clearButton: {
    position: "absolute",
    bottom: hp('11%'),
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ff6b6b",
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.2%'),
    borderRadius: wp('6%'),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  clearText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: wp('1.5%'),
    fontSize: hp('1.8%'),
  },
  fab: {
    position: "absolute",
    bottom: hp('3%'),
    right: wp('5%'),
    width: wp('15%'),
    height: wp('15%'),
    borderRadius: wp('7.5%'),
    backgroundColor: "#4a69bd",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: wp('5%'),
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: wp('4%'),
    padding: wp('6%'),
    width: "100%",
    maxWidth: wp('90%'),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  modalTitle: {
    fontSize: hp('2.5%'),
    fontWeight: "bold",
    color: "#2f3542",
    marginBottom: hp('2.5%'),
    textAlign: "center",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: wp('2.5%'),
    padding: wp('3.5%'),
    fontSize: hp('2%'),
    minHeight: hp('12%'),
    textAlignVertical: "top",
    marginBottom: hp('2.5%'),
  },
  priorityTitle: {
    fontSize: hp('2%'),
    fontWeight: "600",
    color: "#2f3542",
    marginBottom: hp('1.5%'),
  },
  priorityOptions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: hp('3%'),
  },
  priorityOption: {
    flex: 1,
    paddingVertical: hp('1.2%'),
    marginHorizontal: wp('1%'),
    borderRadius: wp('2.5%'),
    alignItems: "center",
  },
  priorityOptionText: {
    fontSize: hp('1.8%'),
    fontWeight: "600",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 1,
    paddingVertical: hp('1.7%'),
    borderRadius: wp('2.5%'),
    alignItems: "center",
    marginHorizontal: wp('1.5%'),
  },
  cancelButton: {
    backgroundColor: "#f1f2f6",
  },
  cancelButtonText: {
    color: "#747d8c",
    fontWeight: "600",
    fontSize: hp('1.8%'),
  },
  saveButton: {
    backgroundColor: "#4a69bd",
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: hp('1.8%'),
  },
});
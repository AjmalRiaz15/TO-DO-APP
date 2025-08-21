import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { getAuth } from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

export default function TodoScreen() {
  const navigation = useNavigation();
  const [todos, setTodos] = useState([]);
  const [filteredTodos, setFilteredTodos] = useState([]);
  const [text, setText] = useState("");
  const [userName, setUserName] = useState("");
  const [priority, setPriority] = useState("Low");
  const [editingId, setEditingId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [filter, setFilter] = useState("All"); // All, Active, Completed

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      setUserName(user.displayName || user.email);
    }
    loadTodos();
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

  const saveTodos = async (data) => {
    try {
      await AsyncStorage.setItem("todos", JSON.stringify(data));
    } catch (e) {
      console.log(e);
    }
  };

  const loadTodos = async () => {
    try {
      const stored = await AsyncStorage.getItem("todos");
      if (stored) setTodos(JSON.parse(stored));
    } catch (e) {
      console.log(e);
    }
  };

  const handleAddOrEditTodo = () => {
    if (text.trim()) {
      let updatedTodos;
      if (editingId) {
        updatedTodos = todos.map((todo) =>
          todo.id === editingId ? { ...todo, text, priority } : todo
        );
        setEditingId(null);
      } else {
        updatedTodos = [
          ...todos,
          { id: Date.now().toString(), text, completed: false, priority },
        ];
      }
      setTodos(updatedTodos);
      saveTodos(updatedTodos);
      setText("");
      setPriority("Low");
      setModalVisible(false);
    }
  };

  const toggleTodo = (id) => {
    const updatedTodos = todos.map((todo) =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    setTodos(updatedTodos);
    saveTodos(updatedTodos);
  };

  const deleteTodo = (id) => {
    const updatedTodos = todos.filter((todo) => todo.id !== id);
    setTodos(updatedTodos);
    saveTodos(updatedTodos);
  };

  const editTodo = (item) => {
    setText(item.text);
    setPriority(item.priority);
    setEditingId(item.id);
    setModalVisible(true);
  };

  const clearTodos = () => {
    Alert.alert("Confirm", "Are you sure you want to delete all tasks?", [
      { text: "Cancel" },
      {
        text: "Yes",
        onPress: async () => {
          setTodos([]);
          await AsyncStorage.removeItem("todos");
        },
      },
    ]);
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
          {item.completed && <Ionicons name="checkmark" size={16} color="#fff" />}
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
          <Ionicons name="create-outline" size={22} color="#3498db" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => deleteTodo(item.id)} style={styles.actionButton}>
          <Ionicons name="trash-outline" size={22} color="#e74c3c" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {userName}</Text>
          <Text style={styles.subtitle}>What's your plan for today?</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
          <Ionicons name="person-circle-outline" size={44} color="#4A90E2" />
        </TouchableOpacity>
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
      {filteredTodos.length > 0 ? (
        <FlatList
          data={filteredTodos}
          keyExtractor={(item) => item.id}
          renderItem={renderTodoItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-done-circle-outline" size={60} color="#ddd" />
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
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.clearText}>Clear All</Text>
        </TouchableOpacity>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={30} color="#fff" />
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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2f3542",
  },
  subtitle: {
    fontSize: 14,
    color: "#747d8c",
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: "row",
    backgroundColor: "#f1f2f6",
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
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
    fontSize: 14,
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
    marginBottom: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
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
    fontSize: 20,
    fontWeight: "bold",
    color: "#2f3542",
  },
  statLabel: {
    fontSize: 12,
    color: "#747d8c",
    marginTop: 4,
  },
  listContainer: {
    paddingBottom: 100,
  },
  todoItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#ddd",
    marginRight: 12,
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
    fontSize: 16,
    color: "#2f3542",
    marginBottom: 4,
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
    fontSize: 12,
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    color: "#747d8c",
    fontWeight: "600",
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#a4b0be",
    marginTop: 8,
  },
  clearButton: {
    position: "absolute",
    bottom: 90,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ff6b6b",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  clearText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 6,
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
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
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2f3542",
    marginBottom: 20,
    textAlign: "center",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  priorityTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2f3542",
    marginBottom: 12,
  },
  priorityOptions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 10,
    alignItems: "center",
  },
  priorityOptionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 6,
  },
  cancelButton: {
    backgroundColor: "#f1f2f6",
  },
  cancelButtonText: {
    color: "#747d8c",
    fontWeight: "600",
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
  },
});
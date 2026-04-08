import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, SafeAreaView, Platform, StatusBar, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

const USERNAME = 'username';

const TRANSACTIONS = [
  { id: '1', type: 'income', label: 'Ingreso - Salario', date: 'Abril 1, 2026', amount: 3000 },
  { id: '2', type: 'expense', label: 'Pago - Renta', date: 'Abril 5, 2026', amount: -1200 },
  { id: '3', type: 'expense', label: 'Compra - Supermercado', date: 'Abril 6, 2026', amount: -156.5 },
  { id: '4', type: 'income', label: 'Ingreso - Freelance', date: 'Abril 7, 2026', amount: 850 },
  { id: '5', type: 'expense', label: 'Pago - Internet', date: 'Abril 7, 2026', amount: -45 },
  { id: '6', type: 'income', label: 'Reembolso - Seguro', date: 'Abril 8, 2026', amount: 210 },
];

const BALANCE = 5420.0;

const CONTACTS = [
  { id: '1', name: 'Ana Martínez', description: 'Transferencia frecuente', initials: 'AM', color: '#e8d5f5' },
  { id: '2', name: 'Luis García', description: 'Pagos compartidos', initials: 'LG', color: '#d5e8f5' },
  { id: '3', name: 'Sofía Reyes', description: 'Compañera de trabajo', initials: 'SR', color: '#d5f5e0' },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos Días';
  if (h < 18) return 'Buenas Tardes';
  return 'Buenas Noches';
}

function getFormattedDate() {
  const now = new Date();
  const opts = { year: 'numeric', month: 'long', day: 'numeric' };
  return now.toLocaleDateString('es-MX', opts);
}

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState('wallet');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.content}>
        {activeTab === 'wallet' && <WalletTab />}
        {activeTab === 'chat' && (
          <ChatTab
            messages={messages}
            setMessages={setMessages}
            inputText={inputText}
            setInputText={setInputText}
            isRecording={isRecording}
            setIsRecording={setIsRecording}
          />
        )}
        {activeTab === 'contacts' && <ContactsTab />}
      </View>

      <View style={styles.tabBar}>
        <TabButton
          icon="wallet-outline"
          active={activeTab === 'wallet'}
          onPress={() => setActiveTab('wallet')}
        />
        <TabButton
          icon="sparkles-outline"
          active={activeTab === 'chat'}
          onPress={() => setActiveTab('chat')}
          isCenter
        />
        <TabButton
          icon="book-outline"
          active={activeTab === 'contacts'}
          onPress={() => setActiveTab('contacts')}
        />
      </View>
    </SafeAreaView>
  );
}

function TabButton({ icon, active, onPress, isCenter }) {
  return (
    <TouchableOpacity style={[styles.tabBtn, isCenter && styles.tabBtnCenter]} onPress={onPress}>
      <Ionicons
        name={icon}
        size={isCenter ? 28 : 24}
        color={active ? '#3a7bd5' : '#999'}
      />
    </TouchableOpacity>
  );
}

function WalletTab() {
  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Ionicons name="chatbubble-outline" size={22} color="#555" />
          <Ionicons name="person-circle-outline" size={26} color="#555" />
        </View>
        <Text style={styles.greeting}>{getGreeting()},</Text>
        <Text style={styles.username}>{USERNAME}</Text>
        <Text style={styles.dateText}>{getFormattedDate()}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tu cuentas</Text>
          <Ionicons name="add-circle-outline" size={20} color="#3a7bd5" />
        </View>

        <View style={styles.accountGroup}>
          <Text style={styles.accountGroupTitle}>Cuentas Bancarias (1)</Text>
          <View style={styles.accountRow}>
            <Text style={styles.accountName}></Text>
            <View>
              <Text style={styles.accountBalance}>$3,043.57</Text>
              <Text style={styles.accountSub}>Saldo Disponible</Text>
            </View>
          </View>
        </View>

        <View style={[styles.accountGroup, { marginTop: 8 }]}>
          <Text style={styles.accountGroupTitle}>Tarjetas de Crédito (1)</Text>
          <View style={styles.accountRow}>
            <Text style={styles.accountName}></Text>
            <View>
              <Text style={[styles.accountBalance, { color: '#e04040' }]}>-$1,240.00</Text>
              <Text style={styles.accountSub}>Saldo Actual</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Flujo de Dinero</Text>
        </View>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo Real</Text>
          <Text style={styles.balanceAmount}>${BALANCE.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        </View>

        {TRANSACTIONS.map((tx) => (
          <View key={tx.id} style={styles.txRow}>
            <View style={[styles.txDot, { backgroundColor: tx.type === 'income' ? '#e4f5ea' : '#fde8e8' }]}>
              <Ionicons
                name={tx.type === 'income' ? 'arrow-down' : 'arrow-up'}
                size={14}
                color={tx.type === 'income' ? '#27a24a' : '#e04040'}
              />
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txLabel}>{tx.label}</Text>
              <Text style={styles.txDate}>{tx.date}</Text>
            </View>
            <Text style={[styles.txAmount, { color: tx.amount > 0 ? '#27a24a' : '#e04040' }]}>
              {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function ChatTab({ messages, setMessages, inputText, setInputText, isRecording, setIsRecording }) {
  const scrollRef = useRef(null);

  const sendMessage = () => {
    if (!inputText.trim()) return;
    const newMsg = { id: Date.now().toString(), text: inputText, from: 'user' };
    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleMic = async () => {
    if (isRecording) {
      setIsRecording(false);
      setInputText((prev) => prev + ' [mensaje de voz]');
    } else {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status === 'granted') {
          setIsRecording(true);
          setTimeout(() => {
            setIsRecording(false);
            setInputText((prev) => prev + 'Muéstrame mi saldo');
          }, 2000);
        }
      } catch (e) {
        setInputText((prev) => prev + '[voz no disponible]');
      }
    }
  };

  return (
    <View style={styles.chatContainer}>
      <Text style={styles.chatTitle}>Asistente DIME</Text>

      <ScrollView
        ref={scrollRef}
        style={styles.chatMessages}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {messages.length === 0 && (
          <Text style={styles.chatPlaceholder}>¿En qué te puedo ayudar hoy?</Text>
        )}
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[styles.bubble, msg.from === 'user' ? styles.bubbleUser : styles.bubbleBot]}
          >
            <Text style={[styles.bubbleText, msg.from === 'user' && { color: '#fff' }]}>
              {msg.text}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.chatInput}
          placeholder="¿Qué quieres saber?"
          placeholderTextColor="#aaa"
          value={inputText}
          onChangeText={setInputText}
          multiline
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity onPress={handleMic} style={styles.micBtn}>
          <Ionicons name={isRecording ? 'mic' : 'mic-outline'} size={22} color={isRecording ? '#e04040' : '#666'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
          <Ionicons name="arrow-up" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ContactsTab() {
  return (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle} style={[styles.sectionTitle, { padding: 20, fontSize: 22, fontWeight: '700', color: '#1a1a2e' }]}>
        Contactos
      </Text>
      {CONTACTS.map((c) => (
        <View key={c.id} style={styles.contactRow}>
          <View style={[styles.avatar, { backgroundColor: c.color }]}>
            <Text style={styles.avatarText}>{c.initials}</Text>
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{c.name}</Text>
            <Text style={styles.contactDesc}>{c.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f0f6ff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e8edf5',
    height: 64,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'ios' ? 8 : 0,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabBtnCenter: {
    borderRadius: 16,
    marginHorizontal: 8,
  },
  tabContent: {
    flex: 1,
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2fa',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 22,
    color: '#1a1a2e',
    fontWeight: '700',
  },
  username: {
    fontSize: 22,
    color: '#1a1a2e',
    fontWeight: '700',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  accountGroup: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e8edf5',
  },
  accountGroupTitle: {
    backgroundColor: '#1a3a6e',
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  accountName: {
    fontSize: 13,
    color: '#444',
    flex: 1,
  },
  accountBalance: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    textAlign: 'right',
  },
  accountSub: {
    fontSize: 11,
    color: '#888',
    textAlign: 'right',
  },
  balanceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e8edf5',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#555',
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#27a24a',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#eef2fa',
  },
  txDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txInfo: {
    flex: 1,
  },
  txLabel: {
    fontSize: 14,
    color: '#1a1a2e',
    fontWeight: '500',
  },
  txDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#f0f6ff',
  },
  chatTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
    padding: 20,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2fa',
  },
  chatMessages: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  chatPlaceholder: {
    color: '#bbb',
    textAlign: 'center',
    marginTop: 60,
    fontSize: 15,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8edf5',
    alignSelf: 'flex-start',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#3a7bd5',
    borderColor: '#3a7bd5',
  },
  bubbleText: {
    fontSize: 14,
    color: '#1a1a2e',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e8edf5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#f4f7fc',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a2e',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#dde4f0',
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f4f7fc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dde4f0',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3a7bd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eef2fa',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#444',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  contactDesc: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
});

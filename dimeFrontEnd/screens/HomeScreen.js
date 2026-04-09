import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, SafeAreaView, Platform, StatusBar, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import {
  createConversation,
  createConversationMessage,
  listContacts,
  listConversationMessages,
  listConversations,
} from '../services/api';

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

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
  });
}

function formatMessageTime(value) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HomeScreen({ navigation, session, onLogout }) {
  const [activeTab, setActiveTab] = useState('wallet');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [screenError, setScreenError] = useState('');
  const [contacts, setContacts] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [conversationCount, setConversationCount] = useState(0);
  const [walletState, setWalletState] = useState({
    balance: session?.user?.balanceAvailable ?? 0,
    savings: [],
  });

  useEffect(() => {
    if (!session?.token) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Splash' }],
      });
      return;
    }

    let isMounted = true;

    async function bootstrap() {
      setIsBootstrapping(true);
      setScreenError('');

      try {
        const [conversationsResult, contactsResult] = await Promise.all([
          listConversations(session.token),
          listContacts(session.token),
        ]);

        if (!isMounted) {
          return;
        }

        const conversations = conversationsResult.conversations || [];
        const nextConversationId = conversations[0]?.conversationId || null;

        setConversationCount(conversations.length);
        setContacts(contactsResult.contacts || []);

        if (nextConversationId) {
          const messagesResult = await listConversationMessages(
            session.token,
            nextConversationId,
          );

          if (!isMounted) {
            return;
          }

          setConversationId(nextConversationId);
          setMessages(messagesResult.messages || []);
        } else {
          setConversationId(null);
          setMessages([]);
        }
      } catch (err) {
        if (isMounted) {
          setScreenError(err.message || 'No se pudo cargar tu información.');
        }
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [navigation, session]);

  const handleStateFromReply = (state) => {
    if (!state) {
      return;
    }

    setWalletState({
      balance: state.balance ?? 0,
      savings: state.savings ?? [],
    });
  };

  const ensureConversation = async () => {
    if (conversationId) {
      return conversationId;
    }

    const conversation = await createConversation(session.token, {
      title: 'Nuevo chat',
      agentMode: 'default',
    });

    setConversationId(conversation.conversationId);
    setConversationCount((prev) => prev + 1);
    return conversation.conversationId;
  };

  const sendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    const optimisticMessage = {
      messageId: `local-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText('');
    setScreenError('');
    setIsSending(true);

    try {
      const activeConversationId = await ensureConversation();
      const result = await createConversationMessage(session.token, activeConversationId, {
        message: trimmed,
      });

      setMessages((prev) => [
        ...prev.filter((item) => item.messageId !== optimisticMessage.messageId),
        result.message,
        result.reply,
      ]);
      handleStateFromReply(result.state);
    } catch (err) {
      setMessages((prev) => prev.filter((item) => item.messageId !== optimisticMessage.messageId));
      setScreenError(err.message || 'No se pudo enviar el mensaje.');
    } finally {
      setIsSending(false);
    }
  };

  const handleMic = async () => {
    if (isRecording) {
      setIsRecording(false);
      setInputText((prev) => `${prev} [mensaje de voz]`.trim());
      return;
    }

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status === 'granted') {
        setIsRecording(true);
        setTimeout(() => {
          setIsRecording(false);
          setInputText('Muéstrame mi saldo');
        }, 1500);
      }
    } catch (err) {
      setScreenError('No se pudo activar el micrófono.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.content}>
        {activeTab === 'wallet' && (
          <WalletTab
            user={session?.user}
            walletState={walletState}
            conversationCount={conversationCount}
            onLogout={onLogout}
          />
        )}
        {activeTab === 'chat' && (
          <ChatTab
            messages={messages}
            inputText={inputText}
            setInputText={setInputText}
            isRecording={isRecording}
            isSending={isSending}
            onSend={sendMessage}
            onMic={handleMic}
            screenError={screenError}
            isBootstrapping={isBootstrapping}
          />
        )}
        {activeTab === 'contacts' && (
          <ContactsTab
            contacts={contacts}
            isBootstrapping={isBootstrapping}
            screenError={screenError}
          />
        )}
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

function WalletTab({ user, walletState, conversationCount, onLogout }) {
  const savings = walletState.savings || [];

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Ionicons name="chatbubble-outline" size={22} color="#555" />
          <TouchableOpacity onPress={onLogout}>
            <Ionicons name="log-out-outline" size={24} color="#555" />
          </TouchableOpacity>
        </View>
        <Text style={styles.greeting}>{getGreeting()},</Text>
        <Text style={styles.username}>{user?.displayName || 'Usuario Dime'}</Text>
        <Text style={styles.dateText}>{getFormattedDate()}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.balanceHero}>
          <Text style={styles.balanceHeroLabel}>Saldo disponible</Text>
          <Text style={styles.balanceHeroAmount}>{formatCurrency(walletState.balance)}</Text>
          <Text style={styles.balanceHeroHint}>
            {conversationCount} conversación{conversationCount === 1 ? '' : 'es'} activa{conversationCount === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tu perfil</Text>
        <InfoRow label="Correo" value={user?.email || 'No registrado'} />
        <InfoRow label="Teléfono" value={user?.phone || 'No registrado'} />
        <InfoRow label="Idioma" value={user?.preferredLanguage || 'es-MX'} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cajitas de ahorro</Text>
        {savings.length === 0 ? (
          <Text style={styles.emptyCardText}>
            Aún no tienes cajitas. Crea una desde el chat escribiendo algo como "quiero ahorrar para vacaciones, meta 3000".
          </Text>
        ) : (
          savings.map((goal) => {
            const progress = goal.target ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
            return (
              <View key={goal.id} style={styles.savingsCard}>
                <View style={styles.savingsHeader}>
                  <Text style={styles.savingsName}>{goal.name}</Text>
                  <Text style={styles.savingsPercent}>{progress}%</Text>
                </View>
                <Text style={styles.savingsAmount}>
                  {formatCurrency(goal.current)} de {formatCurrency(goal.target)}
                </Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ChatTab({
  messages,
  inputText,
  setInputText,
  isRecording,
  isSending,
  onSend,
  onMic,
  screenError,
  isBootstrapping,
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);

    return () => clearTimeout(timeout);
  }, [messages, isSending]);

  return (
    <View style={styles.chatContainer}>
      <Text style={styles.chatTitle}>Asistente DIME</Text>

      <ScrollView
        ref={scrollRef}
        style={styles.chatMessages}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {isBootstrapping ? (
          <ActivityIndicator style={{ marginTop: 32 }} color="#3a7bd5" />
        ) : null}

        {!isBootstrapping && messages.length === 0 ? (
          <Text style={styles.chatPlaceholder}>¿En qué te puedo ayudar hoy?</Text>
        ) : null}

        {messages.map((msg) => (
          <View
            key={msg.messageId}
            style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}
          >
            <Text style={[styles.bubbleText, msg.role === 'user' && styles.bubbleTextUser]}>
              {msg.content}
            </Text>
            <Text style={[styles.bubbleTime, msg.role === 'user' && styles.bubbleTimeUser]}>
              {formatMessageTime(msg.createdAt)}
            </Text>
          </View>
        ))}

        {isSending ? (
          <View style={[styles.bubble, styles.bubbleBot]}>
            <Text style={styles.bubbleText}>Pensando...</Text>
          </View>
        ) : null}
      </ScrollView>

      {screenError ? <Text style={styles.screenError}>{screenError}</Text> : null}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.chatInput}
          placeholder="¿Qué quieres saber?"
          placeholderTextColor="#aaa"
          value={inputText}
          onChangeText={setInputText}
          multiline
          onSubmitEditing={onSend}
        />
        <TouchableOpacity onPress={onMic} style={styles.micBtn}>
          <Ionicons name={isRecording ? 'mic' : 'mic-outline'} size={22} color={isRecording ? '#e04040' : '#666'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onSend} style={styles.sendBtn} disabled={isSending}>
          {isSending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="arrow-up" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ContactsTab({ contacts, isBootstrapping, screenError }) {
  return (
    <ScrollView style={styles.tabContent}>
      <Text style={[styles.sectionTitle, styles.contactsTitle]}>
        Contactos
      </Text>

      {isBootstrapping ? <ActivityIndicator style={{ marginTop: 24 }} color="#3a7bd5" /> : null}
      {!isBootstrapping && contacts.length === 0 ? (
        <Text style={styles.emptyCardText}>
          Aún no tienes contactos sincronizados en Dime.
        </Text>
      ) : null}

      {contacts.map((contact) => {
        const displayName = contact.nickname || contact.contactUser?.displayName || 'Contacto';
        const initials = displayName
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase())
          .join('');

        return (
          <View key={contact.contactUserId} style={styles.contactRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials || 'DI'}</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{displayName}</Text>
              <Text style={styles.contactDesc}>
                {contact.contactUser?.phone || contact.contactUser?.email || 'Sin dato de contacto'}
              </Text>
            </View>
            {contact.isFavorite ? <Ionicons name="star" size={18} color="#f4b400" /> : null}
          </View>
        );
      })}

      {screenError ? <Text style={styles.screenError}>{screenError}</Text> : null}
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 12,
  },
  balanceHero: {
    backgroundColor: '#1a3a6e',
    borderRadius: 18,
    padding: 20,
  },
  balanceHeroLabel: {
    color: '#cdd9ef',
    fontSize: 14,
  },
  balanceHeroAmount: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
    marginTop: 8,
  },
  balanceHeroHint: {
    color: '#d7e3f8',
    marginTop: 8,
    fontSize: 13,
  },
  infoRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eef2fa',
  },
  infoLabel: {
    fontSize: 12,
    color: '#7b8ba7',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    color: '#1a1a2e',
    fontWeight: '600',
  },
  savingsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eef2fa',
  },
  savingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  savingsName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  savingsPercent: {
    fontSize: 13,
    color: '#3a7bd5',
    fontWeight: '700',
  },
  savingsAmount: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
    marginBottom: 10,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#e7eef9',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3a7bd5',
    borderRadius: 999,
  },
  emptyCardText: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eef2fa',
    color: '#667085',
    lineHeight: 20,
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
    maxWidth: '82%',
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
  bubbleBot: {
    alignSelf: 'flex-start',
  },
  bubbleText: {
    fontSize: 14,
    color: '#1a1a2e',
    lineHeight: 20,
  },
  bubbleTextUser: {
    color: '#fff',
  },
  bubbleTime: {
    fontSize: 11,
    color: '#6f7d95',
    marginTop: 6,
  },
  bubbleTimeUser: {
    color: '#dce8ff',
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
  screenError: {
    color: '#d62839',
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontSize: 13,
  },
  contactsTitle: {
    paddingHorizontal: 20,
    paddingTop: 20,
    fontSize: 22,
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
    backgroundColor: '#dbeafe',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1d4f91',
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

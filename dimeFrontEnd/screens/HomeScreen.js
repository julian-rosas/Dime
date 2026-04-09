import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, SafeAreaView, Platform, StatusBar, ActivityIndicator, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import {
  createContact,
  archiveConversation,
  createConversation,
  createConversationMessage,
  listContacts,
  listConversationMessages,
  listConversations,
  searchUsers,
  updateConversation,
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

function formatCurrencyForSpeech(value) {
  return Number(value || 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
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

function SecurityBanner({ compact = false }) {
  return (
    <View style={[styles.securityBanner, compact && styles.securityBannerCompact]}>
      <View style={styles.securityBannerHeader}>
        <Ionicons name="shield-checkmark-outline" size={compact ? 18 : 20} color="#fff4cf" />
        <Text style={[styles.securityBannerTitle, compact && styles.securityBannerTitleCompact]}>
          Mantente alerta ante estafadores
        </Text>
      </View>
      <Text style={[styles.securityBannerText, compact && styles.securityBannerTextCompact]}>
        Nunca compartas codigos, NIP o contrasenas. Suelen usar urgencia, hacerse pasar por el banco
        o por alguien cercano, y mandar ligas o QR falsos.
      </Text>
    </View>
  );
}

function getConversationSummary(conversation) {
  const pending = conversation?.linkedPendingOperation;
  const preview = conversation?.lastMessagePreview?.trim();
  const extractPersonName = (value) => {
    if (!value) {
      return '';
    }

    const directQuoted = value.match(/"([^"]+)"/);
    if (directQuoted?.[1]) {
      return directQuoted[1].trim();
    }

    const afterATransfer = value.match(/\ba\s+([A-Za-zÁÉÍÓÚáéíóúÑñ ]{2,})(?:[?.!,]|$)/i);
    if (afterATransfer?.[1]) {
      return afterATransfer[1].trim().split(/\s+/).slice(0, 2).join(' ');
    }

    const cleaned = value
      .replace(/^[¿?¡!]+|[¿?¡!]+$/g, '')
      .replace(/\b(no tengo a|quieres que lo agregue|o lo escribiste diferente|tambien puedo|también puedo|ayudarte|ver tu saldo|empezar un ahorro|dime que prefieres)\b.*$/i, '')
      .replace(/\b(transferir|depositar|depositarle|enviar|mandar|pesos|mxn|a|de|para)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const words = cleaned
      .split(' ')
      .filter(Boolean)
      .filter((word) => /^[A-Za-zÁÉÍÓÚáéíóúÑñ]+$/.test(word));

    return words.slice(-2).join(' ').trim();
  };

  if (pending?.type === 'transfer') {
    return {
      title: 'Deposito',
      subtitle: extractPersonName(pending.recipient) || 'Destinatario pendiente',
    };
  }

  if (pending?.type === 'savings_create') {
    return {
      title: 'Crear cajita',
      subtitle: pending.savingsGoalName || 'Meta pendiente',
    };
  }

  if (pending?.type === 'savings_deposit') {
    return {
      title: 'Deposito',
      subtitle: 'A tu ahorro',
    };
  }

  if (!preview) {
    return {
      title: conversation?.title || 'Nuevo chat',
      subtitle: 'Sin destinatario',
    };
  }

  if (/transfer|enviar|mandar|depositar/i.test(preview)) {
    return {
      title: 'Deposito',
      subtitle: extractPersonName(preview) || 'Destinatario',
    };
  }

  const savingsCreateMatch = preview.match(/cajita\s+\*?"?([^"*.\n]+)"?/i);
  if (savingsCreateMatch) {
    return {
      title: 'Crear cajita',
      subtitle: extractAmount(preview) || 'Sin monto',
    };
  }

  if (/guardar|ahorro|cajita/i.test(preview)) {
    return {
      title: 'Deposito a ahorro',
      subtitle: 'A tu ahorro',
    };
  }

  if (/saldo|cuanto tengo|dinero disponible/i.test(preview)) {
    return {
      title: 'Consulta de saldo',
      subtitle: 'Cuenta principal',
    };
  }

  return {
    title: conversation?.title || 'Operacion',
    subtitle: extractPersonName(preview) || 'Sin destinatario',
  };
}

function getSpeechRecognition() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function speakOnWeb(text) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return false;
  }

  const trimmed = text?.trim();
  if (!trimmed) {
    return false;
  }

  const utterance = new SpeechSynthesisUtterance(trimmed);
  const voices = window.speechSynthesis.getVoices?.() || [];
  const spanishVoice = voices.find(
    (voice) => voice.lang?.toLowerCase().startsWith('es')
  );

  utterance.lang = spanishVoice?.lang || 'es-MX';
  if (spanishVoice) {
    utterance.voice = spanishVoice;
  }
  utterance.rate = 0.95;
  utterance.pitch = 1;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

function speakAssistantMessage(text) {
  const trimmed = text?.trim();
  if (!trimmed) {
    return;
  }

  if (Platform.OS === 'web' && speakOnWeb(trimmed)) {
    return;
  }

  Speech.stop();
  Speech.speak(trimmed, {
    language: 'es-MX',
    rate: 0.95,
    pitch: 1,
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
  const [contactSearchText, setContactSearchText] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState('');
  const [contactsError, setContactsError] = useState('');
  const [showContactFallbackForm, setShowContactFallbackForm] = useState(false);
  const [contactEmptyState, setContactEmptyState] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [conversationCount, setConversationCount] = useState(0);
  const [lastAssistantReply, setLastAssistantReply] = useState('');
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState('');
  const [conversationDraftTitle, setConversationDraftTitle] = useState('');
  const [isArchivingConversation, setIsArchivingConversation] = useState('');
  const [walletState, setWalletState] = useState({
    balance: session?.user?.balanceAvailable ?? 0,
    savings: [],
  });
  const recognitionRef = useRef(null);
  const spokenMessageIdsRef = useRef(new Set());

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    let isMounted = true;

    async function bootstrap() {
      setIsBootstrapping(true);
      setScreenError('');

      try {
        const [conversationsResult] = await Promise.all([
          listConversations(session.token),
          loadContacts(session.token),
        ]);

        if (!isMounted) {
          return;
        }

        const conversations = conversationsResult.conversations || [];
        const nextConversationId = conversations[0]?.conversationId || null;

        setConversations(conversations);
        setConversationCount(conversations.length);
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

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.speechSynthesis) {
      return undefined;
    }

    const loadVoices = () => {
      window.speechSynthesis.getVoices?.();
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    const latestAssistantMessage = [...messages]
      .reverse()
      .find((message) => message.role === 'assistant');

    if (!latestAssistantMessage?.messageId) {
      return;
    }

    if (spokenMessageIdsRef.current.has(latestAssistantMessage.messageId)) {
      setLastAssistantReply(latestAssistantMessage.content);
      return;
    }

    setLastAssistantReply(latestAssistantMessage.content);

    if (activeTab !== 'chat') {
      return;
    }

    spokenMessageIdsRef.current.add(latestAssistantMessage.messageId);
    speakAssistantMessage(latestAssistantMessage.content);
  }, [activeTab, messages]);

  const loadContacts = async (token = session?.token) => {
    const contactsResult = await listContacts(token);
    setContacts(contactsResult.contacts || []);
    return contactsResult;
  };

  const loadConversations = async (token = session?.token) => {
    const conversationsResult = await listConversations(token);
    const nextConversations = conversationsResult.conversations || [];
    setConversations(nextConversations);
    setConversationCount(nextConversations.length);
    return nextConversations;
  };

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

    setIsCreatingConversation(true);

    const conversation = await createConversation(session.token, {
      title: 'Nuevo chat',
      agentMode: 'default',
    });

    const updatedConversations = await loadConversations();
    setConversationId(conversation.conversationId);
    setMessages([]);
    setConversationCount(updatedConversations.length);
    setIsCreatingConversation(false);
    return conversation.conversationId;
  };

  const handleSelectConversation = async (nextConversationId) => {
    setConversationId(nextConversationId);
    setScreenError('');
    setIsBootstrapping(true);

    try {
      const messagesResult = await listConversationMessages(session.token, nextConversationId);
      setMessages(messagesResult.messages || []);
    } catch (err) {
      setScreenError(err.message || 'No se pudo abrir la conversacion.');
    } finally {
      setIsBootstrapping(false);
    }
  };

  const handleCreateConversation = async () => {
    setScreenError('');
    setIsCreatingConversation(true);

    try {
      const conversation = await createConversation(session.token, {
        title: 'Nuevo chat',
        agentMode: 'default',
      });
      await loadConversations();
      setConversationId(conversation.conversationId);
      setMessages([]);
      setActiveTab('chat');
    } catch (err) {
      setScreenError(err.message || 'No se pudo crear el chat.');
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const handleStartEditingConversation = (conversation) => {
    setEditingConversationId(conversation.conversationId);
    setConversationDraftTitle(conversation.title || 'Nuevo chat');
  };

  const handleSaveConversationTitle = async () => {
    const trimmed = conversationDraftTitle.trim();
    if (!editingConversationId || !trimmed) {
      setEditingConversationId('');
      return;
    }

    try {
      await updateConversation(session.token, editingConversationId, {
        title: trimmed,
      });
      await loadConversations();
      setEditingConversationId('');
      setConversationDraftTitle('');
    } catch (err) {
      setScreenError(err.message || 'No se pudo actualizar el nombre del chat.');
    }
  };

  const handleArchiveConversation = async (targetConversationId) => {
    setIsArchivingConversation(targetConversationId);
    setScreenError('');

    try {
      await archiveConversation(session.token, targetConversationId);
      const remainingConversations = await loadConversations();

      if (conversationId === targetConversationId) {
        const nextConversationId = remainingConversations[0]?.conversationId || null;
        setConversationId(nextConversationId);

        if (nextConversationId) {
          const messagesResult = await listConversationMessages(session.token, nextConversationId);
          setMessages(messagesResult.messages || []);
        } else {
          setMessages([]);
        }
      }
    } catch (err) {
      setScreenError(err.message || 'No se pudo archivar el chat.');
    } finally {
      setIsArchivingConversation('');
    }
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

  const handleVoiceInput = async () => {
    if (isRecording) {
      recognitionRef.current?.stop?.();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      if (Platform.OS === 'web') {
        setScreenError('Este navegador no soporta transcripcion por voz.');
      }
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-MX';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setScreenError('');
        setIsRecording(true);
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0]?.transcript || '')
          .join(' ')
          .trim();

        setInputText(transcript);
      };

      recognition.onerror = () => {
        setScreenError('No se pudo transcribir el audio. Intenta otra vez.');
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setScreenError('No se pudo activar el microfono.');
      setIsRecording(false);
    }
  };

  const handleSearchContacts = async () => {
    const trimmed = contactSearchText.trim();
    if (!trimmed) {
      setContactsError('Escribe el nombre del contacto.');
      setSearchResults([]);
      return;
    }

    setContactsError('');
    setContactEmptyState('');
    setShowContactFallbackForm(false);
    setIsSearchingContacts(true);

    try {
      const query = { displayName: trimmed };
      const result = await searchUsers(session.token, query);
      const users = result.users || [];
      setSearchResults(users);

      if (users.length === 0) {
        setContactEmptyState(`No encontré a "${trimmed}" en Dime. Si quieres, prueba con su correo y teléfono.`);
        setShowContactFallbackForm(true);
      }
    } catch (err) {
      setContactsError(err.message || 'No se pudo buscar usuarios.');
      setSearchResults([]);
    } finally {
      setIsSearchingContacts(false);
    }
  };

  const handleAddContact = async (user) => {
    setContactsError('');
    setIsAddingContact(user.userId);

    try {
      await createContact(session.token, {
        contactUserId: user.userId,
        nickname: user.displayName,
        aliasForMe: [],
        isFavorite: false,
      });

      await loadContacts();
      setSearchResults((prev) => prev.map((item) => (
        item.userId === user.userId
          ? { ...item, isAlreadyContact: true }
          : item
      )));
    } catch (err) {
      setContactsError(err.message || 'No se pudo agregar el contacto.');
    } finally {
      setIsAddingContact('');
    }
  };

  const handleSearchByContactDetails = async () => {
    if (!contactEmail.trim() && !contactPhone.trim()) {
      setContactsError('Escribe un correo o un teléfono para seguir buscando.');
      return;
    }

    setContactsError('');
    setContactEmptyState('');
    setIsSearchingContacts(true);

    try {
      const result = await searchUsers(session.token, {
        email: contactEmail.trim() || undefined,
        phone: contactPhone.trim() || undefined,
      });
      const users = result.users || [];
      setSearchResults(users);

      if (users.length === 0) {
        setContactEmptyState('Ese contacto todavía no existe en Dime. Hoy el backend solo permite agregar usuarios que ya tengan cuenta.');
      }
    } catch (err) {
      setContactsError(err.message || 'No se pudo buscar con correo y teléfono.');
      setSearchResults([]);
    } finally {
      setIsSearchingContacts(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === 'web' ? undefined : Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      enabled={Platform.OS !== 'web'}
    >
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.content}>
          {activeTab === 'wallet' && (
            <WalletTab
              user={session?.user}
              walletState={walletState}
              conversationCount={conversationCount}
              onLogout={onLogout}
              onReadBalance={() => speakAssistantMessage(`Saldo disponible ${formatCurrencyForSpeech(walletState.balance)}`)}
            />
          )}
          {activeTab === 'chat' && (
            <ChatTab
              conversations={conversations}
              conversationId={conversationId}
              messages={messages}
              inputText={inputText}
              setInputText={setInputText}
              isRecording={isRecording}
              isSending={isSending}
              isCreatingConversation={isCreatingConversation}
              editingConversationId={editingConversationId}
              conversationDraftTitle={conversationDraftTitle}
              setConversationDraftTitle={setConversationDraftTitle}
              isArchivingConversation={isArchivingConversation}
              onCreateConversation={handleCreateConversation}
              onSelectConversation={handleSelectConversation}
              onStartEditingConversation={handleStartEditingConversation}
              onSaveConversationTitle={handleSaveConversationTitle}
              onCancelEditingConversation={() => {
                setEditingConversationId('');
                setConversationDraftTitle('');
              }}
              onArchiveConversation={handleArchiveConversation}
              onSend={sendMessage}
              onMic={handleVoiceInput}
              onReplaySpeech={() => speakAssistantMessage(lastAssistantReply)}
              lastAssistantReply={lastAssistantReply}
              screenError={screenError}
              isBootstrapping={isBootstrapping}
            />
          )}
          {activeTab === 'contacts' && (
            <ContactsTab
              contacts={contacts}
              isBootstrapping={isBootstrapping}
              screenError={contactsError || screenError}
              contactSearchText={contactSearchText}
              setContactSearchText={setContactSearchText}
              onSearchContacts={handleSearchContacts}
              searchResults={searchResults}
              isSearchingContacts={isSearchingContacts}
              onAddContact={handleAddContact}
              isAddingContact={isAddingContact}
              showContactFallbackForm={showContactFallbackForm}
              contactEmptyState={contactEmptyState}
              contactEmail={contactEmail}
              setContactEmail={setContactEmail}
              contactPhone={contactPhone}
              setContactPhone={setContactPhone}
              onSearchByContactDetails={handleSearchByContactDetails}
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
            icon="chatbubble-ellipses-outline"
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
    </KeyboardAvoidingView>
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

function WalletTab({ user, walletState, conversationCount, onLogout, onReadBalance }) {
  const savings = walletState.savings || [];

  return (
    <ScrollView
      style={styles.tabContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps={Platform.OS === 'web' ? 'always' : 'handled'}
      keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={onLogout}>
            <Ionicons name="log-out-outline" size={24} color="#555" />
          </TouchableOpacity>
        </View>
        <Text style={styles.greeting}>{getGreeting()},</Text>
        <Text style={styles.username}>{user?.displayName || 'Usuario Dime'}</Text>
        <Text style={styles.dateText}>{getFormattedDate()}</Text>
      </View>

      <View style={styles.section}>
        <SecurityBanner compact />
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.balanceHero} onPress={onReadBalance} activeOpacity={0.9}>
          <View style={styles.balanceHeroTopRow}>
            <Text style={styles.balanceHeroLabel}>Saldo disponible</Text>
            <Ionicons name="volume-high" size={24} color="#d7e3f8" />
          </View>
          <Text style={styles.balanceHeroAmount}>{formatCurrency(walletState.balance)}</Text>
          <Text style={styles.balanceHeroHint}>
            {conversationCount} conversación{conversationCount === 1 ? '' : 'es'} activa{conversationCount === 1 ? '' : 's'}
          </Text>
        </TouchableOpacity>
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
  conversations,
  conversationId,
  messages,
  inputText,
  setInputText,
  isRecording,
  isSending,
  isCreatingConversation,
  editingConversationId,
  conversationDraftTitle,
  setConversationDraftTitle,
  isArchivingConversation,
  onCreateConversation,
  onSelectConversation,
  onStartEditingConversation,
  onSaveConversationTitle,
  onCancelEditingConversation,
  onArchiveConversation,
  onSend,
  onMic,
  onReplaySpeech,
  lastAssistantReply,
  screenError,
  isBootstrapping,
}) {
  const scrollRef = useRef(null);
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    const timeout = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);

    return () => clearTimeout(timeout);
  }, [messages, isSending]);

  return (
    <View style={styles.chatContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.conversationStrip}
        contentContainerStyle={styles.conversationStripContent}
      >
        <TouchableOpacity
          style={styles.newConversationButton}
          onPress={onCreateConversation}
          disabled={isCreatingConversation}
        >
          {isCreatingConversation ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.newConversationButtonText}>Nuevo chat</Text>
            </>
          )}
        </TouchableOpacity>

        {conversations.map((conversation) => (
          <TouchableOpacity
            key={conversation.conversationId}
            style={[
              styles.conversationPill,
              conversation.conversationId === conversationId && styles.conversationPillActive,
            ]}
            onPress={() => onSelectConversation(conversation.conversationId)}
          >
            <View style={styles.conversationPillBody}>
              {editingConversationId !== conversation.conversationId ? (
                <TouchableOpacity
                  onPress={() => onArchiveConversation(conversation.conversationId)}
                  style={[styles.conversationIconBtn, styles.conversationArchiveBtn, styles.conversationTrashInside]}
                  disabled={isArchivingConversation === conversation.conversationId}
                >
                  {isArchivingConversation === conversation.conversationId ? (
                    <ActivityIndicator color="#1a3a6e" size="small" />
                  ) : (
                    <Ionicons name="trash-outline" size={34} color="#8b1e2d" />
                  )}
                </TouchableOpacity>
              ) : null}

              {editingConversationId === conversation.conversationId ? (
                <TextInput
                  style={styles.conversationTitleInput}
                  value={conversationDraftTitle}
                  onChangeText={setConversationDraftTitle}
                  onSubmitEditing={onSaveConversationTitle}
                  autoFocus
                />
              ) : (
                <>
                  <Text
                    style={[
                      styles.conversationPillTitle,
                      conversation.conversationId === conversationId && styles.conversationPillTitleActive,
                    ]}
                  >
                    {getConversationSummary(conversation).title}
                  </Text>
                  <Text
                    style={[
                      styles.conversationPreview,
                      conversation.conversationId === conversationId && styles.conversationPreviewActive,
                    ]}
                  >
                    {getConversationSummary(conversation).subtitle}
                  </Text>
                </>
              )}
            </View>
            {editingConversationId === conversation.conversationId ? (
              <View style={styles.conversationActions}>
                <TouchableOpacity onPress={onSaveConversationTitle} style={styles.conversationIconBtn}>
                  <Ionicons name="checkmark" size={16} color="#1a3a6e" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onCancelEditingConversation} style={styles.conversationIconBtn}>
                  <Ionicons name="close" size={16} color="#6b7280" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.conversationActions} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.chatHeader}>
        <View style={styles.chatHeaderActions}>
          <TouchableOpacity
            style={[
              styles.speakerButton,
              !lastAssistantReply && styles.speakerButtonDisabled,
            ]}
            onPress={onReplaySpeech}
            disabled={!lastAssistantReply}
          >
            <Ionicons
              name="volume-high"
              size={32}
              color={lastAssistantReply ? '#fff' : '#9aa7bf'}
            />
            <Text
              style={[
                styles.speakerButtonText,
                !lastAssistantReply && styles.speakerButtonTextDisabled,
              ]}
            >
              Repetir
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onMic}
            style={[
              styles.headerMicButton,
              isRecording && styles.headerMicButtonActive,
            ]}
          >
            <Ionicons
              name={isRecording ? 'mic' : 'mic-outline'}
              size={42}
              color={isRecording ? '#fff' : '#1a3a6e'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.chatMessages}
        keyboardShouldPersistTaps={Platform.OS === 'web' ? 'always' : 'handled'}
        keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
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
          multiline={!isWeb}
          blurOnSubmit={false}
          onSubmitEditing={!isWeb ? onSend : undefined}
          onKeyPress={
            isWeb
              ? (event) => {
                  if (event.nativeEvent.key === 'Enter') {
                    event.preventDefault?.();
                    onSend();
                  }
                }
              : undefined
          }
        />
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

function ContactsTab({
  contacts,
  isBootstrapping,
  screenError,
  contactSearchText,
  setContactSearchText,
  onSearchContacts,
  searchResults,
  isSearchingContacts,
  onAddContact,
  isAddingContact,
  showContactFallbackForm,
  contactEmptyState,
  contactEmail,
  setContactEmail,
  contactPhone,
  setContactPhone,
  onSearchByContactDetails,
}) {
  return (
    <ScrollView
      style={styles.tabContent}
      keyboardShouldPersistTaps={Platform.OS === 'web' ? 'always' : 'handled'}
      keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
    >
      <Text style={[styles.sectionTitle, styles.contactsTitle]}>
        Contactos
      </Text>

      <View style={styles.contactSearchCard}>
        <Text style={styles.contactSearchTitle}>Agregar contacto</Text>
        <Text style={styles.contactSearchHint}>
          Pon el nombre del contacto. Si no aparece, te pediremos su correo y teléfono para buscarlo mejor.
        </Text>
        <TextInput
          style={styles.contactSearchInput}
          placeholder="Pon el nombre del contacto"
          placeholderTextColor="#98a2b3"
          value={contactSearchText}
          onChangeText={setContactSearchText}
          autoCapitalize="words"
        />
        <TouchableOpacity style={styles.contactSearchButton} onPress={onSearchContacts}>
          {isSearchingContacts ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.contactSearchButtonText}>Buscar contacto</Text>
          )}
        </TouchableOpacity>

        {contactEmptyState ? (
          <Text style={styles.contactEmptyState}>{contactEmptyState}</Text>
        ) : null}

        {showContactFallbackForm ? (
          <View style={styles.contactFallbackForm}>
            <Text style={styles.contactFallbackTitle}>No apareció por nombre</Text>
            <TextInput
              style={styles.contactSearchInput}
              placeholder="Correo del contacto"
              placeholderTextColor="#98a2b3"
              value={contactEmail}
              onChangeText={setContactEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.contactSearchInput}
              placeholder="Teléfono del contacto"
              placeholderTextColor="#98a2b3"
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
            />
            <TouchableOpacity style={styles.secondarySearchButton} onPress={onSearchByContactDetails}>
              {isSearchingContacts ? (
                <ActivityIndicator color="#1a3a6e" />
              ) : (
                <Text style={styles.secondarySearchButtonText}>Buscar con correo y teléfono</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {searchResults.length > 0 ? (
        <View style={styles.searchResultsSection}>
          <Text style={styles.sectionTitle}>Resultados</Text>
          {searchResults.map((user) => (
            <View key={user.userId} style={styles.contactRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(user.displayName || 'DI')
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join('') || 'DI'}
                </Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{user.displayName || 'Usuario Dime'}</Text>
                <Text style={styles.contactDesc}>{user.phone || user.email || 'Sin dato de contacto'}</Text>
              </View>
              {user.isAlreadyContact ? (
                <Text style={styles.alreadyContactText}>Agregado</Text>
              ) : (
                <TouchableOpacity
                  style={styles.addContactButton}
                  onPress={() => onAddContact(user)}
                  disabled={isAddingContact === user.userId}
                >
                  {isAddingContact === user.userId ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.addContactButtonText}>Agregar</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      ) : null}

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
    fontSize: 28,
    color: '#1a1a2e',
    fontWeight: '700',
  },
  username: {
    fontSize: 28,
    color: '#1a1a2e',
    fontWeight: '700',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 16,
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
  securityBanner: {
    backgroundColor: '#243349',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#334a69',
  },
  securityBannerCompact: {
    backgroundColor: '#2a3a54',
  },
  securityBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  securityBannerTitle: {
    color: '#fff7d6',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  securityBannerTitleCompact: {
    fontSize: 16,
  },
  securityBannerText: {
    color: '#edf2fa',
    fontSize: 16,
    lineHeight: 22,
  },
  securityBannerTextCompact: {
    fontSize: 16,
    lineHeight: 22,
  },
  balanceHero: {
    backgroundColor: '#1a3a6e',
    borderRadius: 18,
    padding: 20,
  },
  balanceHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceHeroLabel: {
    color: '#cdd9ef',
    fontSize: 16,
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
    fontSize: 16,
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
    fontSize: 16,
    color: '#7b8ba7',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
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
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  savingsPercent: {
    fontSize: 16,
    color: '#3a7bd5',
    fontWeight: '700',
  },
  savingsAmount: {
    fontSize: 16,
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
  conversationStrip: {
    maxHeight: 124,
    backgroundColor: '#eef4ff',
  },
  conversationStripContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  newConversationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a3a6e',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 120,
  },
  newConversationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 6,
  },
  conversationPill: {
    width: 210,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d9e4f4',
    padding: 12,
  },
  conversationPillActive: {
    borderColor: '#3a7bd5',
    backgroundColor: '#eef5ff',
  },
  conversationPillBody: {
    minHeight: 48,
    paddingRight: 42,
  },
  conversationPillTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 5,
  },
  conversationPillTitleActive: {
    color: '#1a3a6e',
  },
  conversationPreview: {
    fontSize: 16,
    color: '#667085',
    lineHeight: 21,
  },
  conversationPreviewActive: {
    color: '#3c5d8a',
  },
  conversationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 0,
  },
  conversationIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d5e2f5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginLeft: 8,
  },
  conversationArchiveBtn: {
    borderColor: '#f2c7cc',
    backgroundColor: '#fff7f8',
  },
  conversationTrashInside: {
    position: 'absolute',
    top: -2,
    right: -2,
    zIndex: 2,
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  conversationTitleInput: {
    borderWidth: 1,
    borderColor: '#bdd0ec',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    color: '#1a1a2e',
    marginBottom: 4,
  },
  chatHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
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
    fontSize: 16,
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
    fontSize: 16,
    color: '#1a1a2e',
    lineHeight: 23,
  },
  bubbleTextUser: {
    color: '#fff',
  },
  bubbleTime: {
    fontSize: 16,
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
    fontSize: 16,
    color: '#1a1a2e',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#dde4f0',
  },
  speakerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a3a6e',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    minHeight: 84,
  },
  speakerButtonDisabled: {
    backgroundColor: '#eef2fa',
  },
  speakerButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginLeft: 8,
  },
  speakerButtonTextDisabled: {
    color: '#9aa7bf',
  },
  headerMicButton: {
    flex: 1,
    minHeight: 84,
    borderRadius: 20,
    backgroundColor: '#eef4ff',
    borderWidth: 1,
    borderColor: '#c9d8f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMicButtonActive: {
    backgroundColor: '#d62839',
    borderColor: '#d62839',
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
    fontSize: 16,
  },
  contactsTitle: {
    paddingHorizontal: 20,
    paddingTop: 20,
    fontSize: 22,
  },
  contactSearchCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eef2fa',
  },
  contactSearchTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 6,
  },
  contactSearchHint: {
    fontSize: 16,
    color: '#667085',
    lineHeight: 22,
    marginBottom: 12,
  },
  contactSearchInput: {
    backgroundColor: '#f7f9fc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dde4f0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a2e',
    marginBottom: 12,
  },
  contactSearchButton: {
    backgroundColor: '#1a3a6e',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  contactSearchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  contactEmptyState: {
    color: '#b42318',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 12,
  },
  contactFallbackForm: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#e9eef7',
  },
  contactFallbackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 10,
  },
  secondarySearchButton: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#1a3a6e',
    backgroundColor: '#f8fbff',
  },
  secondarySearchButtonText: {
    color: '#1a3a6e',
    fontSize: 16,
    fontWeight: '700',
  },
  searchResultsSection: {
    marginBottom: 16,
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
    fontSize: 16,
    fontWeight: '700',
    color: '#1d4f91',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  contactDesc: {
    fontSize: 16,
    color: '#888',
    marginTop: 2,
  },
  addContactButton: {
    backgroundColor: '#3a7bd5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 76,
    alignItems: 'center',
  },
  addContactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  alreadyContactText: {
    color: '#2f855a',
    fontSize: 16,
    fontWeight: '700',
  },
});

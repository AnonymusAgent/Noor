import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../constants/theme';
import { useApp, AIMessage } from '../contexts/AppContext';

// ── System Prompt ────────────────────────────────────────────────────────────

const ISLAMIC_SYSTEM_PROMPT = `You are an expert Islamic scholar assistant trained on the Quran, Sahih al-Bukhari, Sahih Muslim, the four Sunans (Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah), and major scholarly works.

STRICT RULES:
1. ALWAYS cite specific Quran references in format: (Surah Name, Chapter:Verse)
2. ALWAYS cite Hadith with full reference: (Sahih al-Bukhari, Hadith No.) or (Sahih Muslim, Hadith No.)
3. NEVER fabricate or paraphrase Quran verses — only cite real verses
4. NEVER fabricate or attribute fake hadiths — only cite verified narrations
5. Present all four Sunni madhab views (Hanafi, Maliki, Shafi'i, Hanbali) when rulings differ
6. NEVER issue personal fatwas. For personal legal matters always say: "Please consult a qualified Islamic scholar"
7. Mention hadith authenticity grade (Sahih, Hasan, Da'if) where relevant
8. Format: Answer → Quranic Evidence → Hadith Evidence → Scholarly Notes
9. Be respectful, scholarly, and thorough
10. For non-Islamic topics: "I am an Islamic guidance assistant. Please ask about Islamic topics."`;

const AI_API_URL = process.env.EXPO_PUBLIC_AI_API_URL?.trim();
const AI_MODEL = process.env.EXPO_PUBLIC_AI_MODEL?.trim() || 'google/gemini-3-flash-preview';

// ── Suggested Questions ──────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  'What does the Quran say about patience in hardship?',
  'What is the importance and reward of Salah?',
  'Explain the five pillars of Islam with evidence',
  'What are the conditions for a valid Wudu?',
  'What is Tawakkul and how to practice it?',
  'What is the ruling on missing a prayer?',
  'Explain the concept of Tawbah (repentance)',
  'What are the virtues of Surah Al-Baqarah?',
  'How to perform Ghusl correctly?',
  'What does Islam say about kindness to parents?',
];

const TOPIC_CATEGORIES = [
  { icon: '📖', label: 'Quran', queries: ['What is the greatest verse in the Quran?', 'Explain Surah Al-Fatiha', 'What does Surah Al-Ikhlas mean?'] },
  { icon: '📚', label: 'Hadith', queries: ['What is the most important hadith?', 'Explain the hadith of Jibreel', 'What did the Prophet say about character?'] },
  { icon: '🕌', label: 'Prayer', queries: ['How to perform Fajr prayer?', 'What are the pillars of Salah?', 'What invalidates the prayer?'] },
  { icon: '🌙', label: 'Ramadan', queries: ['What are the virtues of Ramadan?', 'When should one break the fast?', 'What is Laylatul Qadr?'] },
  { icon: '🤲', label: 'Duas', queries: ['Best dua for anxiety?', 'Dua for seeking forgiveness?', 'Morning and evening azkar'] },
  { icon: '⚖️', label: 'Fiqh', queries: ['Is music permissible in Islam?', 'What is Zakat and who pays it?', 'Ruling on keeping a beard'] },
];

export default function AIGuideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    aiMessages, addAIMessage, clearAIChat,
    createConversation, activeConversationId,
    updateConversationTitle,
    colors: C,
  } = useApp();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [showTopics, setShowTopics] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 150);
  }, []);

  useEffect(() => {
    if (aiMessages.length > 0 || streamingText) scrollToBottom();
  }, [aiMessages.length, streamingText, scrollToBottom]);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isLoading) return;

    setInput('');
    setIsLoading(true);
    setStreamingText('');
    setShowTopics(false);

    // Ensure there is a conversation to attach the exchange to, otherwise the
    // message list can never be restored from storage.
    if (!activeConversationId) createConversation();
    await addAIMessage({ role: 'user', content: msg });

    // Build conversation context (last 12 messages)
    const contextMessages = aiMessages.slice(-12).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    try {
      if (!AI_API_URL) throw new Error('AI_BACKEND_NOT_CONFIGURED');

      const response = await fetch(AI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: 'system', content: ISLAMIC_SYSTEM_PROMPT },
            ...contextMessages,
            { role: 'user', content: msg },
          ],
          stream: true,
          max_tokens: 1500,
          temperature: 0.3,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      let fullText = '';

      if (reader) {
        const decoder = new TextDecoder();
        let buffer = '';
        const handleLine = (line: string) => {
          if (!line.startsWith('data:')) return;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') return;
          try {
            const data = JSON.parse(payload);
            const delta = data.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              setStreamingText(fullText);
            }
          } catch { /* skip malformed */ }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // A network chunk can end mid-line — only consume complete lines and
          // carry the remainder into the next read.
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) handleLine(line);
        }
        if (buffer) handleLine(buffer);
      } else {
        const data = await response.json();
        fullText = data.choices?.[0]?.message?.content || 'Unable to generate a response. Please try again.';
      }

      setStreamingText('');
      if (fullText) {
        await addAIMessage({ role: 'assistant', content: fullText });
        // Auto-title the conversation from its first user message.
        if (aiMessages.length <= 1 && activeConversationId) {
          const shortTitle = msg.length > 40 ? msg.slice(0, 40) + '...' : msg;
          updateConversationTitle(activeConversationId, shortTitle);
        }
      }
    } catch (error) {
      setStreamingText('');
      const failureMessage = error instanceof Error && error.message === 'AI_BACKEND_NOT_CONFIGURED'
        ? 'AI responses are not configured. Set EXPO_PUBLIC_AI_API_URL to a trusted server endpoint. Keep provider credentials on that server, never in the mobile app.'
        : 'I am unable to connect right now. Please check your internet connection and try again.';
      await addAIMessage({
        role: 'assistant',
        content: [
          AI_API_URL ? '**Connection Error**' : '**AI Service Not Configured**',
          '',
          failureMessage,
          '',
          'In the meantime, explore the **Quran**, **Hadith**, and **Duas** sections for authentic Islamic guidance.',
        ].join('\n'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const shareMessage = useCallback(async (content: string) => {
    try {
      await Share.share({ message: content + '\n\n— Islamic Guide App' });
    } catch { /* silent */ }
  }, []);

  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;

  const renderMessage = useCallback(({ item, index }: { item: AIMessage; index: number }) => {
    const isUser = item.role === 'user';
    const showTime = index === 0 ||
      item.timestamp - aiMessages[index - 1]?.timestamp > 300000; // 5 min gap

    return (
      <View>
        {showTime && (
          <Text style={[styles.timeLabel, { color: C.textMuted }]}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
        <View style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}>
          {!isUser && (
            <View style={[styles.aiAvatar, { backgroundColor: C.primary, borderColor: `${C.gold}40` }]}>
              <Text style={styles.aiAvatarText}>☪</Text>
            </View>
          )}
          <View style={[
            styles.bubble,
            isUser
              ? [styles.userBubble, { backgroundColor: C.userMessage, borderColor: `${C.gold}25` }]
              : [styles.aiBubble, { backgroundColor: C.aiMessage, borderColor: `${C.cardBorder}` }],
          ]}>
            {/* Simple markdown-like rendering */}
            {renderMarkdown(item.content, C)}

            {/* Message actions */}
            {!isUser && (
              <View style={[styles.msgActions, { borderTopColor: C.divider }]}>
                <Pressable
                  style={styles.msgAction}
                  onPress={() => shareMessage(item.content)}
                >
                  <MaterialIcons name="share" size={13} color={C.textMuted} />
                </Pressable>
                <Pressable
                  style={styles.msgAction}
                  onPress={() => sendMessageRef.current('Please elaborate on that.')}
                >
                  <MaterialIcons name="refresh" size={13} color={C.textMuted} />
                  <Text style={[styles.msgActionText, { color: C.textMuted }]}>Elaborate</Text>
                </Pressable>
              </View>
            )}
          </View>
          {isUser && (
            <View style={[styles.userAvatar, { backgroundColor: `${C.gold}20`, borderColor: `${C.gold}30` }]}>
              <MaterialIcons name="person" size={18} color={C.gold} />
            </View>
          )}
        </View>
      </View>
    );
  }, [C, aiMessages, shareMessage]);

  const showEmpty = aiMessages.length === 0 && !isLoading;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: C.textPrimary }]}>AI Islamic Guide</Text>
            <View style={styles.headerMeta}>
              <View style={[styles.onlineDot, { backgroundColor: AI_API_URL ? C.success : C.warning }]} />
              <Text style={[styles.headerSub, { color: C.textSecondary }]}>
                {AI_API_URL ? 'AI endpoint configured · Cites Quran & Hadith' : 'AI service not configured'}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={[styles.headerBtn, { backgroundColor: `${C.gold}20` }]}
              onPress={() => setShowTopics(!showTopics)}
            >
              <MaterialIcons name="apps" size={20} color={C.gold} />
            </Pressable>
            <Pressable onPress={clearAIChat} style={styles.headerBtn}>
              <MaterialIcons name="delete-outline" size={20} color={C.textMuted} />
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      {/* Disclaimer */}
      <View style={[styles.disclaimer, { backgroundColor: `${C.warning}12`, borderColor: `${C.warning}25` }]}>
        <MaterialIcons name="info-outline" size={13} color={C.warning} />
        <Text style={[styles.disclaimerText, { color: C.textSecondary }]}>
          Always verify with qualified scholars. Not a fatwa service.
        </Text>
      </View>

      {/* Topic Categories Panel */}
      {showTopics && (
        <View style={[styles.topicsPanel, { backgroundColor: C.surface, borderBottomColor: C.cardBorder }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicsScroll}>
            {TOPIC_CATEGORIES.map((cat, i) => (
              <Pressable
                key={i}
                style={[
                  styles.topicChip,
                  { backgroundColor: selectedCategory === i ? `${C.gold}20` : C.card, borderColor: selectedCategory === i ? C.gold : C.cardBorder },
                ]}
                onPress={() => setSelectedCategory(selectedCategory === i ? null : i)}
              >
                <Text style={styles.topicIcon}>{cat.icon}</Text>
                <Text style={[styles.topicLabel, { color: selectedCategory === i ? C.gold : C.textSecondary }]}>
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {selectedCategory !== null && (
            <View style={[styles.topicQuestions, { borderTopColor: C.cardBorder }]}>
              {TOPIC_CATEGORIES[selectedCategory].queries.map((q, i) => (
                <Pressable
                  key={i}
                  style={[styles.topicQuestion, { borderBottomColor: C.divider }]}
                  onPress={() => { sendMessage(q); setShowTopics(false); }}
                >
                  <MaterialIcons name="chevron-right" size={16} color={C.gold} />
                  <Text style={[styles.topicQuestionText, { color: C.textPrimary }]}>{q}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={aiMessages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={[styles.messages, showEmpty && styles.messagesEmpty]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={[`${C.primary}30`, `${C.primaryDark}20`]}
              style={[styles.welcomeGradient, { borderColor: `${C.gold}20` }]}
            >
              <Text style={styles.welcomeEmoji}>☪️</Text>
              <Text style={[styles.welcomeArabic, { color: C.gold }]}>
                بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
              </Text>
              <Text style={[styles.welcomeTitle, { color: C.textPrimary }]}>
                AI Islamic Guide
              </Text>
              <Text style={[styles.welcomeDesc, { color: C.textSecondary }]}>
                Ask questions about the Quran, Hadith, Islamic rulings, prayer, fasting, and more.
                All answers include authentic citations from primary sources.
              </Text>
            </LinearGradient>
          </View>
        }
        ListFooterComponent={
          (isLoading || streamingText) ? (
            <View style={[styles.messageRow, styles.aiRow, { paddingHorizontal: Spacing.md, paddingBottom: 8 }]}>
              <View style={[styles.aiAvatar, { backgroundColor: C.primary, borderColor: `${C.gold}40` }]}>
                <Text style={styles.aiAvatarText}>☪</Text>
              </View>
              <View style={[styles.bubble, styles.aiBubble, { backgroundColor: C.aiMessage, borderColor: C.cardBorder }]}>
                {streamingText ? (
                  <Text style={[styles.msgText, { color: C.textPrimary }]}>{streamingText}</Text>
                ) : (
                  <View style={styles.typingRow}>
                    <ActivityIndicator size="small" color={C.gold} />
                    <Text style={[styles.typingText, { color: C.textMuted }]}>
                      Researching sources...
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : null
        }
      />

      {/* Suggested Questions (only when chat is empty) */}
      {showEmpty && (
        <View style={[styles.suggestions, { borderTopColor: C.divider }]}>
          <Text style={[styles.suggestLabel, { color: C.textMuted }]}>Suggested Questions</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestScroll}
          >
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <Pressable
                key={i}
                style={[styles.suggestChip, { backgroundColor: C.card, borderColor: `${C.gold}25` }]}
                onPress={() => sendMessage(q)}
              >
                <Text style={[styles.suggestText, { color: C.textSecondary }]}>{q}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Input Area */}
      <View style={[styles.inputArea, {
        backgroundColor: C.surface,
        borderTopColor: C.cardBorder,
        paddingBottom: Math.max(insets.bottom + 8, 16),
      }]}>
        <View style={[styles.inputRow, { backgroundColor: C.chatInput, borderColor: C.cardBorder }]}>
          <TextInput
            ref={inputRef}
            style={[styles.textInput, { color: C.textPrimary }]}
            placeholder="Ask an Islamic question..."
            placeholderTextColor={C.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={1500}
          />
          <Pressable
            style={[
              styles.sendBtn,
              {
                backgroundColor: input.trim() && !isLoading ? C.gold : `${C.gold}30`,
              },
            ]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={C.primaryDark} />
            ) : (
              <MaterialIcons
                name="send"
                size={18}
                color={input.trim() && !isLoading ? C.primaryDark : C.textMuted}
              />
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Simple Markdown Renderer ──────────────────────────────────────────────────

function renderMarkdown(text: string, C: any) {
  const lines = text.split('\n');
  return (
    <View style={{ gap: 3 }}>
      {lines.map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
          const content = line.slice(2, -2);
          return <Text key={i} style={[styles.msgBold, { color: C.textPrimary }]}>{content}</Text>;
        }
        if (line.startsWith('## ')) {
          return <Text key={i} style={[styles.msgHeading, { color: C.gold }]}>{line.slice(3)}</Text>;
        }
        if (line.startsWith('# ')) {
          return <Text key={i} style={[styles.msgH1, { color: C.gold }]}>{line.slice(2)}</Text>;
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <View key={i} style={styles.msgListItem}>
              <Text style={[styles.msgBullet, { color: C.gold }]}>•</Text>
              <Text style={[styles.msgText, { color: C.textPrimary, flex: 1 }]}>{line.slice(2)}</Text>
            </View>
          );
        }
        if (line === '') return <View key={i} style={{ height: 4 }} />;
        // Bold within text
        if (line.includes('**')) {
          const parts = line.split(/\*\*(.*?)\*\*/g);
          return (
            <Text key={i} style={[styles.msgText, { color: C.textPrimary }]}>
              {parts.map((p, pi) =>
                pi % 2 === 1
                  ? <Text key={pi} style={{ fontWeight: '700', color: C.textPrimary }}>{p}</Text>
                  : p
              )}
            </Text>
          );
        }
        return <Text key={i} style={[styles.msgText, { color: C.textPrimary }]}>{line}</Text>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: 4 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },
  headerSub: { fontSize: 11 },
  headerActions: { flexDirection: 'row', gap: 4 },

  disclaimer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  disclaimerText: { flex: 1, fontSize: 11, lineHeight: 15 },

  topicsPanel: { borderBottomWidth: 1 },
  topicsScroll: { paddingHorizontal: Spacing.md, paddingVertical: 8, gap: 8 },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.round,
    borderWidth: 1,
  },
  topicIcon: { fontSize: 14 },
  topicLabel: { fontSize: 13, fontWeight: '600' },
  topicQuestions: { borderTopWidth: 1 },
  topicQuestion: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1 },
  topicQuestionText: { fontSize: 14, flex: 1 },

  messages: { padding: Spacing.md, paddingBottom: 20, gap: 12 },
  messagesEmpty: { flex: 1, justifyContent: 'center' },

  emptyState: { alignItems: 'center', paddingHorizontal: Spacing.lg },
  welcomeGradient: {
    padding: Spacing.lg,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
    maxWidth: 360,
    width: '100%',
  },
  welcomeEmoji: { fontSize: 44 },
  welcomeArabic: { fontSize: 18, textAlign: 'center' },
  welcomeTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  welcomeDesc: { fontSize: 14, textAlign: 'center', lineHeight: 22 },

  timeLabel: { textAlign: 'center', fontSize: 11, marginVertical: 6 },
  messageRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  userRow: { justifyContent: 'flex-end' },
  aiRow: { justifyContent: 'flex-start' },

  aiAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    flexShrink: 0,
  },
  aiAvatarText: { fontSize: 17 },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },

  bubble: { maxWidth: '80%', padding: 12, borderRadius: Radius.lg, borderWidth: 1 },
  userBubble: { borderBottomRightRadius: 4 },
  aiBubble: { borderBottomLeftRadius: 4 },

  msgText: { fontSize: 14, lineHeight: 22 },
  msgBold: { fontSize: 14, fontWeight: '700', lineHeight: 22 },
  msgHeading: { fontSize: 15, fontWeight: '700', lineHeight: 22, marginTop: 4 },
  msgH1: { fontSize: 16, fontWeight: '800', lineHeight: 24, marginTop: 4 },
  msgListItem: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  msgBullet: { fontSize: 14, lineHeight: 22, fontWeight: '700' },

  msgActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  msgAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  msgActionText: { fontSize: 11 },

  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 2 },
  typingText: { fontSize: 13 },

  suggestions: { paddingTop: 8, borderTopWidth: 1 },
  suggestLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: Spacing.md,
    marginBottom: 6,
  },
  suggestScroll: { paddingHorizontal: Spacing.md, paddingBottom: 8, gap: 8 },
  suggestChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.lg,
    borderWidth: 1,
    maxWidth: 230,
  },
  suggestText: { fontSize: 13, lineHeight: 18 },

  inputArea: { borderTopWidth: 1, padding: Spacing.sm },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingLeft: Spacing.md,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  textInput: { flex: 1, fontSize: 15, maxHeight: 120, paddingTop: 6, paddingBottom: 6 },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  ScrollView, Share, Alert, Modal, SectionList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../constants/theme';
import { useApp, Note, Highlight } from '../contexts/AppContext';
import { SURAH_LIST } from '../constants/quranData';

// ─── Constants ────────────────────────────────────────────────────────────────

type TabKey = 'all' | 'highlights' | 'bysurah';
type ColorFilter = 'all' | 'yellow' | 'green' | 'blue' | 'red';

const HIGHLIGHT_COLORS = {
  yellow: { bg: 'rgba(255,215,0,0.18)', border: 'rgba(255,215,0,0.5)', solid: '#FFD700', label: 'Gold' },
  green: { bg: 'rgba(76,175,80,0.18)', border: 'rgba(76,175,80,0.5)', solid: '#4CAF50', label: 'Green' },
  blue: { bg: 'rgba(33,150,243,0.18)', border: 'rgba(33,150,243,0.5)', solid: '#2196F3', label: 'Blue' },
  red: { bg: 'rgba(244,67,54,0.18)', border: 'rgba(244,67,54,0.5)', solid: '#F44336', label: 'Red' },
};

const COLOR_FILTER_OPTIONS: { key: ColorFilter; label: string; color: string }[] = [
  { key: 'all', label: 'All', color: '#9BA5A0' },
  { key: 'yellow', label: 'Gold', color: '#FFD700' },
  { key: 'green', label: 'Green', color: '#4CAF50' },
  { key: 'blue', label: 'Blue', color: '#2196F3' },
  { key: 'red', label: 'Red', color: '#F44336' },
];

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function surahName(num?: number): string {
  if (!num) return '';
  const s = SURAH_LIST[num - 1];
  return s ? `${s.transliteration} (${num})` : `Surah ${num}`;
}

// ─── Note Card ────────────────────────────────────────────────────────────────

function NoteCard({
  note, onDelete, onShare, colors: C, onNavigate,
}: {
  note: Note;
  onDelete: () => void;
  onShare: () => void;
  colors: any;
  onNavigate?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const colorDef = note.color ? HIGHLIGHT_COLORS[note.color] : null;

  return (
    <Pressable
      style={[
        styles.noteCard,
        { backgroundColor: C.card, borderColor: C.cardBorder },
        colorDef && { borderLeftWidth: 4, borderLeftColor: colorDef.solid },
      ]}
      onPress={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <View style={styles.noteCardHeader}>
        <View style={styles.noteCardMeta}>
          {note.surahNumber ? (
            <View style={[styles.noteRefBadge, { backgroundColor: `${C.primary}15` }]}>
              <MaterialIcons name="menu-book" size={10} color={C.textSecondary} />
              <Text style={[styles.noteRefText, { color: C.textSecondary }]}>
                {surahName(note.surahNumber)}{note.ayahNumber ? `:${note.ayahNumber}` : ''}
              </Text>
            </View>
          ) : (
            <View style={[styles.noteRefBadge, { backgroundColor: `${C.primary}15` }]}>
              <MaterialIcons
                name={note.type === 'hadith' ? 'library-books' : 'favorite'}
                size={10}
                color={C.textSecondary}
              />
              <Text style={[styles.noteRefText, { color: C.textSecondary }]}>
                {note.type === 'hadith' ? 'Hadith' : note.type === 'dua' ? 'Dua' : 'Quran'}
              </Text>
            </View>
          )}
          {colorDef && (
            <View style={[styles.colorDot, { backgroundColor: colorDef.solid }]} />
          )}
        </View>
        <Text style={[styles.noteTime, { color: C.textMuted }]}>{timeAgo(note.timestamp)}</Text>
      </View>

      {/* Content */}
      <Text
        style={[styles.noteContent, { color: C.textPrimary }]}
        numberOfLines={expanded ? undefined : 3}
      >
        {note.content}
      </Text>

      {/* Tags */}
      {note.tags && note.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {note.tags.map(tag => (
            <View key={tag} style={[styles.tagChip, { backgroundColor: `${C.gold}12`, borderColor: `${C.gold}25` }]}>
              <Text style={[styles.tagText, { color: C.gold }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={[styles.noteActions, { borderTopColor: C.cardBorder }]}>
        {onNavigate && (
          <Pressable style={styles.noteActionBtn} onPress={onNavigate}>
            <MaterialIcons name="open-in-new" size={16} color={C.textMuted} />
            <Text style={[styles.noteActionText, { color: C.textMuted }]}>Open</Text>
          </Pressable>
        )}
        <Pressable style={styles.noteActionBtn} onPress={onShare}>
          <MaterialIcons name="share" size={16} color={C.textMuted} />
          <Text style={[styles.noteActionText, { color: C.textMuted }]}>Share</Text>
        </Pressable>
        <Pressable style={styles.noteActionBtn} onPress={onDelete}>
          <MaterialIcons name="delete-outline" size={16} color={C.error} />
          <Text style={[styles.noteActionText, { color: C.error }]}>Delete</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => setExpanded(!expanded)}>
          <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={18} color={C.textMuted} />
        </Pressable>
      </View>
    </Pressable>
  );
}

// ─── Highlight Card ───────────────────────────────────────────────────────────

function HighlightCard({
  highlight, onRemove, onNavigate, colors: C,
}: {
  highlight: Highlight;
  onRemove: () => void;
  onNavigate: () => void;
  colors: any;
}) {
  const colorDef = HIGHLIGHT_COLORS[highlight.color];
  const surah = SURAH_LIST[highlight.surahNumber - 1];

  return (
    <Pressable
      style={[
        styles.highlightCard,
        {
          backgroundColor: colorDef.bg,
          borderColor: colorDef.border,
          borderLeftWidth: 4,
          borderLeftColor: colorDef.solid,
        },
      ]}
      onPress={onNavigate}
    >
      <View style={styles.highlightHeader}>
        <View style={[styles.highlightRef, { backgroundColor: `${colorDef.solid}20` }]}>
          <Text style={[styles.highlightRefText, { color: colorDef.solid }]}>
            {surah?.transliteration || `Surah ${highlight.surahNumber}`} {highlight.surahNumber}:{highlight.ayahNumber}
          </Text>
        </View>
        <Text style={[styles.noteTime, { color: C.textMuted }]}>{timeAgo(highlight.timestamp)}</Text>
      </View>
      {highlight.verseText ? (
        <Text style={[styles.highlightVerse, { color: C.textPrimary }]} numberOfLines={3}>
          {highlight.verseText}
        </Text>
      ) : (
        <Text style={[styles.highlightVerse, { color: C.textMuted, fontStyle: 'italic' }]}>
          Tap to read verse in Quran reader
        </Text>
      )}
      <View style={[styles.noteActions, { borderTopColor: `${colorDef.solid}30` }]}>
        <Pressable style={styles.noteActionBtn} onPress={onNavigate}>
          <MaterialIcons name="menu-book" size={14} color={colorDef.solid} />
          <Text style={[styles.noteActionText, { color: colorDef.solid }]}>Read</Text>
        </Pressable>
        <Pressable style={styles.noteActionBtn} onPress={onRemove}>
          <MaterialIcons name="highlight-off" size={14} color={C.error} />
          <Text style={[styles.noteActionText, { color: C.error }]}>Remove</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotesLibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    colors: C, notes, addNote, removeNote, highlights, removeHighlight,
  } = useApp();

  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [colorFilter, setColorFilter] = useState<ColorFilter>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteTags, setNewNoteTags] = useState('');

  // ── Filtered notes ──────────────────────────────────────────────────────────

  const filteredNotes = useMemo(() => {
    let list = [...notes];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n =>
        n.content.toLowerCase().includes(q) ||
        (n.tags || []).some(t => t.toLowerCase().includes(q)) ||
        (n.reference || '').toLowerCase().includes(q)
      );
    }
    if (colorFilter !== 'all') {
      list = list.filter(n => n.color === colorFilter);
    }
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [notes, search, colorFilter]);

  const filteredHighlights = useMemo(() => {
    let list = [...highlights];
    if (colorFilter !== 'all') list = list.filter(h => h.color === colorFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(h => (h.verseText || '').toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [highlights, search, colorFilter]);

  // Group notes by surah for "By Surah" tab
  const notesBySurah = useMemo(() => {
    const surahNotes = filteredNotes.filter(n => n.surahNumber);
    const map = new Map<number, Note[]>();
    for (const n of surahNotes) {
      const sn = n.surahNumber!;
      if (!map.has(sn)) map.set(sn, []);
      map.get(sn)!.push(n);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([surahNumber, items]) => ({
        title: `${SURAH_LIST[surahNumber - 1]?.transliteration || `Surah ${surahNumber}`} (${surahNumber})`,
        data: items,
      }));
  }, [filteredNotes]);

  const handleDeleteNote = (id: string) => {
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeNote(id) },
    ]);
  };

  const handleShareNote = (note: Note) => {
    let text = note.content;
    if (note.surahNumber) text += `\n\n— Quran ${note.surahNumber}:${note.ayahNumber || ''}`;
    if (note.tags && note.tags.length) text += `\nTags: ${note.tags.join(', ')}`;
    Share.share({ message: text });
  };

  const handleRemoveHighlight = (h: Highlight) => {
    Alert.alert('Remove Highlight', 'Remove this verse highlight?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeHighlight(h.surahNumber, h.ayahNumber) },
    ]);
  };

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;
    const tags = newNoteTags.trim()
      ? newNoteTags.split(',').map(t => t.trim()).filter(Boolean)
      : [];
    addNote({ type: 'quran', reference: 'manual', content: newNoteText.trim(), tags });
    setNewNoteText('');
    setNewNoteTags('');
    setShowAddModal(false);
  };

  const handleExport = () => {
    const lines = notes.map(n => {
      let line = `[${new Date(n.timestamp).toLocaleDateString()}] ${n.content}`;
      if (n.surahNumber) line += ` (Quran ${n.surahNumber}:${n.ayahNumber || ''})`;
      if (n.tags && n.tags.length) line += ` | Tags: ${n.tags.join(', ')}`;
      return line;
    });
    Share.share({
      message: `My Quran Notes\n${'─'.repeat(30)}\n\n${lines.join('\n\n')}`,
      title: 'Quran Notes Export',
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const renderNote = ({ item }: { item: Note }) => (
    <NoteCard
      note={item}
      colors={C}
      onDelete={() => handleDeleteNote(item.id)}
      onShare={() => handleShareNote(item)}
      onNavigate={item.surahNumber ? () => router.push(`/quran/${item.surahNumber}` as any) : undefined}
    />
  );

  const renderHighlight = ({ item }: { item: Highlight }) => (
    <HighlightCard
      highlight={item}
      colors={C}
      onRemove={() => handleRemoveHighlight(item)}
      onNavigate={() => router.push(`/quran/${item.surahNumber}` as any)}
    />
  );

  const EmptyState = ({ icon, title, desc }: { icon: string; title: string; desc: string }) => (
    <View style={styles.emptyState}>
      <MaterialIcons name={icon as any} size={52} color={C.textMuted} />
      <Text style={[styles.emptyTitle, { color: C.textPrimary }]}>{title}</Text>
      <Text style={[styles.emptyDesc, { color: C.textMuted }]}>{desc}</Text>
    </View>
  );


  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Notes & Highlights</Text>
            <Text style={[styles.headerSub, { color: C.textSecondary }]}>
              {notes.length} notes · {highlights.length} highlights
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={[styles.headerBtn, { backgroundColor: `${C.gold}15` }]}
              onPress={handleExport}
            >
              <MaterialIcons name="ios-share" size={18} color={C.gold} />
            </Pressable>
            <Pressable
              style={[styles.headerBtn, { backgroundColor: `${C.gold}15` }]}
              onPress={() => setShowAddModal(true)}
            >
              <MaterialIcons name="add" size={20} color={C.gold} />
            </Pressable>
          </View>
        </View>

        {/* Search */}
        <View style={[styles.searchBox, { backgroundColor: C.surface, borderColor: `${C.gold}25` }]}>
          <MaterialIcons name="search" size={18} color={C.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: C.textPrimary }]}
            placeholder="Search notes..."
            placeholderTextColor={C.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <MaterialIcons name="close" size={16} color={C.textMuted} />
            </Pressable>
          )}
        </View>
      </LinearGradient>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <View style={[styles.tabBar, { backgroundColor: C.surface, borderBottomColor: C.cardBorder }]}>
        {([
          { key: 'all', label: 'All Notes', icon: 'notes', count: filteredNotes.length },
          { key: 'highlights', label: 'Highlights', icon: 'format-color-fill', count: filteredHighlights.length },
          { key: 'bysurah', label: 'By Surah', icon: 'menu-book', count: notesBySurah.length },
        ] as const).map(t => (
          <Pressable
            key={t.key}
            style={[
              styles.tabBtn,
              tab === t.key && [styles.tabBtnActive, { borderBottomColor: C.gold }],
            ]}
            onPress={() => setTab(t.key)}
          >
            <MaterialIcons
              name={t.icon as any}
              size={15}
              color={tab === t.key ? C.gold : C.textMuted}
            />
            <Text style={[styles.tabLabel, { color: tab === t.key ? C.gold : C.textMuted }]}>
              {t.label}
            </Text>
            <View style={[
              styles.tabCount,
              { backgroundColor: tab === t.key ? `${C.gold}20` : C.cardBorder },
            ]}>
              <Text style={[styles.tabCountText, { color: tab === t.key ? C.gold : C.textMuted }]}>
                {t.count}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {/* ── Color Filter ───────────────────────────────────────────────────── */}
      {(tab === 'highlights' || tab === 'all') && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.colorFilterBar, { backgroundColor: C.surface, borderBottomColor: C.cardBorder }]}
          contentContainerStyle={styles.colorFilterContent}
        >
          {COLOR_FILTER_OPTIONS.map(opt => (
            <Pressable
              key={opt.key}
              style={[
                styles.colorChip,
                { borderColor: opt.color + '40' },
                colorFilter === opt.key && { backgroundColor: opt.color + '20', borderColor: opt.color },
              ]}
              onPress={() => setColorFilter(colorFilter === opt.key && opt.key !== 'all' ? 'all' : opt.key)}
            >
              {opt.key !== 'all' && (
                <View style={[styles.colorDotSmall, { backgroundColor: opt.color }]} />
              )}
              <Text style={[
                styles.colorChipText,
                { color: colorFilter === opt.key ? opt.color : C.textMuted },
              ]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {tab === 'all' && (
        filteredNotes.length === 0 ? (
          <EmptyState
            icon="note-add"
            title="No Notes Yet"
            desc="Tap the + button to add a note, or long-press any verse in the Quran reader to add notes and highlights."
          />
        ) : (
          <FlatList
            data={filteredNotes}
            renderItem={renderNote}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        )
      )}

      {tab === 'highlights' && (
        filteredHighlights.length === 0 ? (
          <EmptyState
            icon="format-color-fill"
            title="No Highlights Yet"
            desc="Tap any verse in the Quran reader and select a highlight color to mark important verses."
          />
        ) : (
          <FlatList
            data={filteredHighlights}
            renderItem={renderHighlight}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        )
      )}

      {tab === 'bysurah' && (
        notesBySurah.length === 0 ? (
          <EmptyState
            icon="menu-book"
            title="No Surah Notes"
            desc="Notes linked to specific Quran verses will appear here, grouped by surah."
          />
        ) : (
          <SectionList
            sections={notesBySurah}
            keyExtractor={item => item.id}
            renderItem={renderNote}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled
            renderSectionHeader={({ section }) => (
              <View style={[styles.sectionHeader, { backgroundColor: C.surface, borderBottomColor: C.cardBorder }]}>
                <MaterialIcons name="menu-book" size={14} color={C.gold} />
                <Text style={[styles.sectionHeaderText, { color: C.textPrimary }]}>{section.title}</Text>
                <Text style={[styles.sectionCount, { color: C.textMuted }]}>{section.data.length}</Text>
              </View>
            )}
            SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          />
        )
      )}

      {/* ── Add Note Modal ─────────────────────────────────────────────────── */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: C.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: C.cardBorder }]}>
              <Text style={[styles.modalTitle, { color: C.textPrimary }]}>New Note</Text>
              <Pressable onPress={() => setShowAddModal(false)}>
                <MaterialIcons name="close" size={22} color={C.textPrimary} />
              </Pressable>
            </View>

            <Text style={[styles.inputLabel, { color: C.textMuted }]}>Note</Text>
            <TextInput
              style={[styles.modalTextInput, { color: C.textPrimary, backgroundColor: C.card, borderColor: C.cardBorder }]}
              placeholder="Write your note or reflection..."
              placeholderTextColor={C.textMuted}
              value={newNoteText}
              onChangeText={setNewNoteText}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              autoFocus
            />

            <Text style={[styles.inputLabel, { color: C.textMuted }]}>Tags (comma-separated)</Text>
            <TextInput
              style={[styles.modalTagInput, { color: C.textPrimary, backgroundColor: C.card, borderColor: C.cardBorder }]}
              placeholder="faith, prayer, reflection..."
              placeholderTextColor={C.textMuted}
              value={newNoteTags}
              onChangeText={setNewNoteTags}
            />

            <View style={styles.modalBtns}>
              <Pressable
                style={[styles.modalCancelBtn, { backgroundColor: C.card, borderColor: C.cardBorder }]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: C.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSaveBtn, { backgroundColor: C.gold }]}
                onPress={handleAddNote}
              >
                <MaterialIcons name="save" size={16} color={C.primaryDark} />
                <Text style={[styles.modalSaveText, { color: C.primaryDark }]}>Save Note</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: 4,
    marginBottom: Spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {},
  tabLabel: { fontSize: 11, fontWeight: '600' },
  tabCount: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 18,
    alignItems: 'center',
  },
  tabCountText: { fontSize: 10, fontWeight: '700' },

  colorFilterBar: { borderBottomWidth: 1 },
  colorFilterContent: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    gap: 8,
  },
  colorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  colorDotSmall: { width: 8, height: 8, borderRadius: 4 },
  colorChipText: { fontSize: 12, fontWeight: '600' },

  listContent: { padding: Spacing.md, paddingBottom: 100 },

  noteCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  noteCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingBottom: 6,
  },
  noteCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteRefBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  noteRefText: { fontSize: 11, fontWeight: '600' },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  noteTime: { fontSize: 11 },
  noteContent: { fontSize: 14, lineHeight: 22, paddingHorizontal: 12, paddingBottom: 8 },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  tagText: { fontSize: 11, fontWeight: '600' },
  noteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 4,
  },
  noteActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 4, paddingHorizontal: 6 },
  noteActionText: { fontSize: 12 },

  highlightCard: { borderRadius: Radius.lg, borderWidth: 1, padding: 12, overflow: 'hidden' },
  highlightHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  highlightRef: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  highlightRefText: { fontSize: 12, fontWeight: '700' },
  highlightVerse: { fontSize: 14, lineHeight: 22, marginBottom: 8 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyDesc: { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  sectionHeaderText: { flex: 1, fontSize: 14, fontWeight: '700' },
  sectionCount: { fontSize: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.md },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  inputLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
  modalTextInput: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    minHeight: 120,
    marginBottom: Spacing.md,
  },
  modalTagInput: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    marginBottom: Spacing.md,
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginBottom: Spacing.sm },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  modalCancelText: { fontSize: 15, fontWeight: '600' },
  modalSaveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.md,
  },
  modalSaveText: { fontSize: 15, fontWeight: '700' },
});

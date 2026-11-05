/**
 * Mosque Finder — GPS-based nearby mosque & Islamic center discovery
 * Uses platform-split map renderer + OpenStreetMap Overpass API (no key required)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  ActivityIndicator, Linking, TextInput, ScrollView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Spacing, Radius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { MosqueMapRenderer } from '../components/MosqueMapRenderer';
import type { Mosque } from '../components/MosqueMapRenderer.types';

type ViewMode = 'map' | 'list';
type RadiusKm = 1 | 3 | 5 | 10;

const CACHE_KEY = 'mosque_finder_cache';

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)} km`;
}

async function fetchNearbyMosques(lat: number, lng: number, radiusM: number): Promise<Mosque[]> {
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusM},${lat},${lng});
      way["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusM},${lat},${lng});
      relation["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusM},${lat},${lng});
      node["amenity"="place_of_worship"]["building"="mosque"](around:${radiusM},${lat},${lng});
      way["building"="mosque"](around:${radiusM},${lat},${lng});
    );
    out center tags;
  `.trim();

  // Overpass rejects requests without a descriptive User-Agent / Referer
  // (it is a shared community endpoint), and has no CORS headers for a plain
  // browser POST, so web has to go through a CORS-friendly mirror.
  let lastError: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!response.ok) throw new Error(`Overpass responded ${response.status}`);
      return parseMosques(await response.json(), lat, lng);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Network request failed');
}

const USER_AGENT = 'IslamicGuide/1.0 (Expo; mosque finder)';

// Main instance first, community mirror as a fallback when it is rate-limited.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function parseMosques(data: any, lat: number, lng: number): Mosque[] {
  const mosques: Mosque[] = (data.elements || [])
    .map((el: any) => {
      // Nodes carry lat/lon directly; ways and relations only report `center`.
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      if (typeof elLat !== 'number' || typeof elLon !== 'number') return null;

      const tags = el.tags || {};
      const name = tags.name || tags['name:en'] || tags['name:ar'] || 'Mosque';
      const lowerName = name.toLowerCase();
      const type: Mosque['type'] =
        tags.building === 'mosque' || tags.amenity === 'place_of_worship' && lowerName.includes('masjid')
          ? 'mosque'
          : lowerName.includes('centre') || lowerName.includes('center')
          ? 'islamic_centre'
          : 'prayer_room';

      const address = [
        [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
        tags['addr:city'],
      ].filter(Boolean).join(', ');

      return {
        id: `${el.type ?? 'node'}/${el.id}`,
        name,
        type,
        lat: elLat,
        lng: elLon,
        address: address || undefined,
        phone: tags.phone || tags['contact:phone'] || undefined,
        website: tags.website || tags['contact:website'] || undefined,
        openingHours: tags.opening_hours || undefined,
        distance: haversineDistance(lat, lng, elLat, elLon),
      } as Mosque;
    })
    .filter((mosque: Mosque | null): mosque is Mosque => mosque !== null)
    .sort((a: Mosque, b: Mosque) => (a.distance || 0) - (b.distance || 0));

  return mosques;
}

const RADIUS_OPTIONS: RadiusKm[] = [1, 3, 5, 10];

const MOSQUE_TYPE_INFO = {
  mosque: { icon: 'mosque', label: 'Mosque', color: '#C9A84C' },
  islamic_centre: { icon: 'apartment', label: 'Islamic Centre', color: '#4CAF7D' },
  prayer_room: { icon: 'meeting-room', label: 'Prayer Room', color: '#5B8DEF' },
};

export default function MosqueFinderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C } = useApp();
  const mapRef = useRef<any>(null);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [selectedRadius, setSelectedRadius] = useState<RadiusKm>(3);
  const [selectedMosque, setSelectedMosque] = useState<Mosque | null>(null);
  const [search, setSearch] = useState('');
  const [fromCache, setFromCache] = useState(false);

  // Restore the last result set while the GPS fix is in flight.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached && !cancelled) {
          const { data, loc } = JSON.parse(cached);
          if (Array.isArray(data) && loc) {
            setMosques(data);
            setLocation(loc);
            setFromCache(true);
          }
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const searchMosquesRef = useRef<((loc: { lat: number; lng: number }, radiusKm: RadiusKm) => Promise<void>) | null>(null);

  const requestLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status: existing } = await Location.getForegroundPermissionsAsync();
      const { status } = existing === 'granted'
        ? { status: existing }
        : await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission required to find nearby mosques.');
        setLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLocation(loc);
      await searchMosquesRef.current?.(loc, selectedRadius);
    } catch {
      setError('Unable to get your location. Please try again.');
      setLoading(false);
    }
  }, [selectedRadius]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const searchMosques = useCallback(async (loc: { lat: number; lng: number }, radiusKm: RadiusKm) => {
    setLoading(true);
    setError(null);
    setFromCache(false);
    try {
      const results = await fetchNearbyMosques(loc.lat, loc.lng, radiusKm * 1000);
      setMosques(results);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: results, loc }));
    } catch {
      setError('Failed to fetch mosques. Try a different radius or check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Keep the ref the location callback uses in sync with the latest closure.
  useEffect(() => { searchMosquesRef.current = searchMosques; }, [searchMosques]);

  const getMarkerColor = (type: Mosque['type']): string =>
    MOSQUE_TYPE_INFO[type]?.color ?? MOSQUE_TYPE_INFO.mosque.color;

  const openNavigation = (mosque: Mosque) => {
    const url =
      Platform.OS === 'ios'
        ? `maps:0,0?q=${mosque.lat},${mosque.lng}(${encodeURIComponent(mosque.name)})`
        : `geo:${mosque.lat},${mosque.lng}?q=${mosque.lat},${mosque.lng}(${encodeURIComponent(mosque.name)})`;

    Linking.canOpenURL(url).then(supported => {
      Linking.openURL(
        supported ? url : `https://www.google.com/maps/dir/?api=1&destination=${mosque.lat},${mosque.lng}`
      );
    });
  };

  const filteredMosques = mosques.filter(m =>
    !search.trim() ||
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.address?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Mosque Finder</Text>
            <Text style={[styles.headerSub, { color: C.textSecondary }]}>
              {mosques.length > 0 ? `${mosques.length} places found` : 'Find mosques near you'}
            </Text>
          </View>
          <Pressable
            onPress={requestLocation}
            style={[styles.refreshBtn, { backgroundColor: `${C.gold}20` }]}
          >
            <MaterialIcons name="my-location" size={20} color={C.gold} />
          </Pressable>
        </View>

        {/* Radius + View Toggle */}
        <View style={styles.controlsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.radiusScroll}>
            {RADIUS_OPTIONS.map(r => (
              <Pressable
                key={r}
                style={[
                  styles.radiusChip,
                  { backgroundColor: selectedRadius === r ? C.gold : `${C.gold}15`, borderColor: `${C.gold}30` },
                ]}
                onPress={() => {
                  setSelectedRadius(r);
                  if (location) searchMosques(location, r);
                }}
              >
                <Text style={[styles.radiusText, { color: selectedRadius === r ? C.primaryDark : C.gold }]}>
                  {r} km
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={[styles.viewToggle, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}25` }]}>
            <Pressable
              style={[styles.viewBtn, viewMode === 'map' && { backgroundColor: C.gold }]}
              onPress={() => setViewMode('map')}
            >
              <MaterialIcons name="map" size={18} color={viewMode === 'map' ? C.primaryDark : C.gold} />
            </Pressable>
            <Pressable
              style={[styles.viewBtn, viewMode === 'list' && { backgroundColor: C.gold }]}
              onPress={() => setViewMode('list')}
            >
              <MaterialIcons name="list" size={18} color={viewMode === 'list' ? C.primaryDark : C.gold} />
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      {/* Search Bar */}
      <View style={[styles.searchBar, { backgroundColor: C.surface, borderBottomColor: C.cardBorder }]}>
        <MaterialIcons name="search" size={18} color={C.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: C.textPrimary }]}
          placeholder="Search mosques..."
          placeholderTextColor={C.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <Pressable onPress={() => setSearch('')}>
            <MaterialIcons name="close" size={16} color={C.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {error && !loading && (
        <View style={[styles.errorBanner, { backgroundColor: `${C.error}15`, borderColor: `${C.error}25` }]}>
          <MaterialIcons name="error-outline" size={18} color={C.error} />
          <Text style={[styles.errorText, { color: C.error, flex: 1 }]}>{error}</Text>
          <Pressable onPress={requestLocation}>
            <Text style={[styles.retryText, { color: C.gold }]}>Retry</Text>
          </Pressable>
        </View>
      )}

      {fromCache && !loading && (
        <View style={[styles.cacheBanner, { backgroundColor: `${C.info}10`, borderColor: `${C.info}20` }]}>
          <MaterialIcons name="offline-bolt" size={13} color={C.info} />
          <Text style={[styles.cacheText, { color: C.textMuted }]}>Showing cached results.</Text>
        </View>
      )}

      {loading && (
        <View style={[styles.loadingOverlay, { backgroundColor: `${C.background}CC` }]}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={[styles.loadText, { color: C.textSecondary }]}>Finding mosques...</Text>
        </View>
      )}

      {/* MAP VIEW */}
      {viewMode === 'map' && location && (
        <View style={{ flex: 1 }}>
          <MosqueMapRenderer
            mapRef={mapRef}
            location={location}
            mosques={filteredMosques}
            selectedRadius={selectedRadius}
            gold={C.gold}
            onMarkerPress={setSelectedMosque}
            getMarkerColor={getMarkerColor}
          />

          {/* Selected Mosque Card */}
          {selectedMosque && (
            <View style={[styles.selectedCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <View style={styles.selectedCardHeader}>
                <View style={[styles.typeIcon, { backgroundColor: `${C.gold}15` }]}>
                  <MaterialIcons name="mosque" size={22} color={C.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mosqueName, { color: C.textPrimary }]}>{selectedMosque.name}</Text>
                  {selectedMosque.address && (
                    <Text style={[styles.mosqueAddress, { color: C.textMuted }]} numberOfLines={1}>
                      {selectedMosque.address}
                    </Text>
                  )}
                  {selectedMosque.distance !== undefined && (
                    <Text style={[styles.mosqueDistance, { color: C.gold }]}>
                      {formatDistance(selectedMosque.distance)}
                    </Text>
                  )}
                </View>
                <Pressable onPress={() => setSelectedMosque(null)}>
                  <MaterialIcons name="close" size={20} color={C.textMuted} />
                </Pressable>
              </View>
              <View style={styles.selectedCardActions}>
                <Pressable
                  style={[styles.navBtn, { backgroundColor: C.gold }]}
                  onPress={() => openNavigation(selectedMosque)}
                >
                  <MaterialIcons name="directions" size={18} color={C.primaryDark} />
                  <Text style={[styles.navBtnText, { color: C.primaryDark }]}>Directions</Text>
                </Pressable>
                {selectedMosque.phone && (
                  <Pressable
                    style={[styles.actionIconBtn, { backgroundColor: `${C.success}15`, borderColor: `${C.success}25` }]}
                    onPress={() => Linking.openURL(`tel:${selectedMosque.phone}`)}
                  >
                    <MaterialIcons name="call" size={18} color={C.success} />
                  </Pressable>
                )}
                {selectedMosque.website && (
                  <Pressable
                    style={[styles.actionIconBtn, { backgroundColor: `${C.info}15`, borderColor: `${C.info}25` }]}
                    onPress={() => {
                      const url = selectedMosque.website!.startsWith('http')
                        ? selectedMosque.website!
                        : `https://${selectedMosque.website}`;
                      Linking.openURL(url);
                    }}
                  >
                    <MaterialIcons name="language" size={18} color={C.info} />
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </View>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <FlatList
          data={filteredMosques}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="mosque" size={56} color={C.textMuted} />
                <Text style={[styles.emptyTitle, { color: C.textPrimary }]}>No Mosques Found</Text>
                <Text style={[styles.emptySub, { color: C.textMuted }]}>
                  Try increasing the radius or check your location settings.
                </Text>
                <Pressable style={[styles.emptyBtn, { backgroundColor: C.primary }]} onPress={requestLocation}>
                  <Text style={[styles.emptyBtnText, { color: C.gold }]}>Refresh Location</Text>
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item: mosque }) => (
            <Pressable
              style={({ pressed }) => [
                styles.mosqueCard,
                { backgroundColor: C.card, borderColor: C.cardBorder },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => { setSelectedMosque(mosque); setViewMode('map'); }}
            >
              <View style={[styles.mosqueIconBox, { backgroundColor: `${C.gold}15` }]}>
                <MaterialIcons
                  name={MOSQUE_TYPE_INFO[mosque.type].icon as any}
                  size={24}
                  color={MOSQUE_TYPE_INFO[mosque.type].color}
                />
              </View>
              <View style={styles.mosqueInfo}>
                <Text style={[styles.mosqueName, { color: C.textPrimary }]} numberOfLines={1}>
                  {mosque.name}
                </Text>
                {mosque.address && (
                  <Text style={[styles.mosqueAddress, { color: C.textMuted }]} numberOfLines={1}>
                    {mosque.address}
                  </Text>
                )}
                <View style={styles.mosqueMeta}>
                  <View style={[styles.typeChip, { backgroundColor: `${MOSQUE_TYPE_INFO[mosque.type].color}15` }]}>
                    <Text style={[styles.typeChipText, { color: MOSQUE_TYPE_INFO[mosque.type].color }]}>
                      {MOSQUE_TYPE_INFO[mosque.type].label}
                    </Text>
                  </View>
                  {mosque.distance !== undefined && (
                    <Text style={[styles.distanceText, { color: C.gold }]}>
                      {formatDistance(mosque.distance)}
                    </Text>
                  )}
                </View>
              </View>
              <Pressable
                style={[styles.dirBtn, { backgroundColor: C.gold }]}
                onPress={() => openNavigation(mosque)}
                hitSlop={8}
              >
                <MaterialIcons name="directions" size={16} color={C.primaryDark} />
              </Pressable>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: 4,
    marginBottom: Spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  refreshBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 1 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radiusScroll: { gap: 8, paddingRight: 4 },
  radiusChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.round, borderWidth: 1 },
  radiusText: { fontSize: 12, fontWeight: '600' },
  viewToggle: { flexDirection: 'row', borderRadius: Radius.md, borderWidth: 1, overflow: 'hidden' },
  viewBtn: { width: 38, height: 34, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, height: 36 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    marginHorizontal: Spacing.md,
    marginTop: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  errorText: { fontSize: 13 },
  retryText: { fontSize: 13, fontWeight: '600' },
  cacheBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  cacheText: { fontSize: 12 },
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 10,
  },
  loadText: { fontSize: 14 },
  selectedCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    padding: Spacing.md,
  },
  selectedCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.sm },
  typeIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  selectedCardActions: { flexDirection: 'row', gap: 10 },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  navBtnText: { fontSize: 15, fontWeight: '700' },
  actionIconBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  listContent: { padding: Spacing.md, paddingBottom: 100 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.md, marginTop: 8 },
  emptyBtnText: { fontWeight: '600' },
  mosqueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  mosqueIconBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mosqueInfo: { flex: 1 },
  mosqueName: { fontSize: 15, fontWeight: '600' },
  mosqueAddress: { fontSize: 12, marginTop: 2 },
  mosqueDistance: { fontSize: 12, fontWeight: '700', marginTop: 1 },
  mosqueMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  typeChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.sm },
  typeChipText: { fontSize: 10, fontWeight: '600' },
  distanceText: { fontSize: 12, fontWeight: '600' },
  dirBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  Animated, Dimensions, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius, Shadow } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useQibla } from '../hooks/usePrayer';
import { Accelerometer, Magnetometer } from 'expo-sensors';

const { width } = Dimensions.get('window');
const COMPASS_SIZE = Math.min(width - 64, 320);
const NEEDLE_LENGTH = COMPASS_SIZE * 0.38;

// Cardinal directions with degrees
const CARDINALS = [
  { label: 'N', deg: 0 },
  { label: 'NE', deg: 45 },
  { label: 'E', deg: 90 },
  { label: 'SE', deg: 135 },
  { label: 'S', deg: 180 },
  { label: 'SW', deg: 225 },
  { label: 'W', deg: 270 },
  { label: 'NW', deg: 315 },
];

// Generate degree tick marks
const TICKS = Array.from({ length: 72 }, (_, i) => ({
  deg: i * 5,
  major: i % 6 === 0,
  medium: i % 3 === 0 && i % 6 !== 0,
}));

/**
 * Tilt-compensated compass heading.
 *
 * A phone held flat can use the raw magnetometer X/Y pair, but as soon as it is
 * tilted towards the horizon that pair is no longer horizontal and the reading
 * drifts by up to tens of degrees — exactly the orientation people hold a phone
 * in when lining up the Qibla. Projecting the magnetic vector onto the
 * horizontal plane using the accelerometer gravity vector removes that error.
 */
function tiltCompensatedHeading(
  mag: { x: number; y: number; z: number },
  grav: { x: number; y: number; z: number } | null,
): number | null {
  if (!grav) return null;
  const norm = Math.hypot(grav.x, grav.y, grav.z);
  if (norm < 0.5) return null;

  const gx = grav.x / norm;
  const gy = grav.y / norm;
  const gz = grav.z / norm;

  // East = gravity x magnetic, North = magnetic x East (right-handed frame).
  const ex = gy * mag.z - gz * mag.y;
  const ey = gz * mag.x - gx * mag.z;
  const ez = gx * mag.y - gy * mag.x;
  if (Math.hypot(ex, ey, ez) < 1e-6) return null;

  // North (horizontal component of the magnetic vector) only needs X/Y here,
  // because the heading is the angle between East and North in that plane.
  const nx = mag.y * ez - mag.z * ey;

  const heading = Math.atan2(ey, nx) * (180 / Math.PI);
  return (heading + 360) % 360;
}

function getCardinalLabel(deg: number): string {
  const d = ((deg % 360) + 360) % 360;
  if (d < 22.5 || d >= 337.5) return 'N';
  if (d < 67.5) return 'NE';
  if (d < 112.5) return 'E';
  if (d < 157.5) return 'SE';
  if (d < 202.5) return 'S';
  if (d < 247.5) return 'SW';
  if (d < 292.5) return 'W';
  return 'NW';
}

/**
 * expo-sensors' Magnetometer does not expose a calibration level, so estimate
 * it from how stable the reading is: a device that needs the "figure 8" shake
 * produces jittery values.
 */
function getAccuracyLevel(jitter: number): { label: string; color: string; icon: string } {
  if (jitter > 12) return { label: 'Poor — move in a figure 8', color: '#F06A5A', icon: 'error-outline' };
  if (jitter > 5) return { label: 'Fair', color: '#F0B450', icon: 'warning-amber' };
  return { label: 'Good', color: '#52C98A', icon: 'check-circle' };
}

export default function QiblaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C } = useApp();
  const { direction, distance, loading, error, coordinates, reload } = useQibla();

  const [compassHeading, setCompassHeading] = useState(0);
  const [magnetometerAvailable, setMagnetometerAvailable] = useState<boolean | null>(null);

  const [sensorJitter, setSensorJitter] = useState(0);
  const headingRef = useRef(0);
  const jitterRef = useRef(0);

  // Animated values
  const compassRotAnim = useRef(new Animated.Value(0)).current;
  const needleRotAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation when pointing at Qibla
  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    startPulse();
    let sub: ReturnType<typeof Magnetometer.addListener> | undefined;
    let accelSub: ReturnType<typeof Accelerometer.addListener> | undefined;

    // Latest gravity vector; null until the accelerometer emits a sample, in
    // which case the raw (flat-device) magnetometer pair is used instead.
    let gravity: { x: number; y: number; z: number } | null = null;

    Accelerometer.isAvailableAsync()
      .then(available => {
        if (!available) return;
        Accelerometer.setUpdateInterval(120);
        accelSub = Accelerometer.addListener(({ x, y, z }) => {
          gravity = { x, y, z };
        });
      })
      .catch(() => { /* heading falls back to the raw magnetometer */ });

    Magnetometer.isAvailableAsync().then(available => {
      setMagnetometerAvailable(available);
      if (available) {
        Magnetometer.setUpdateInterval(80);
        sub = Magnetometer.addListener(data => {
          // Tilt-compensated when gravity is known, otherwise the flat-device
          // approximation of the same computation.
          const compensated = tiltCompensatedHeading(data, gravity);
          let angle = compensated
            ?? (() => {
              const raw = Math.atan2(data.y, data.x) * (180 / Math.PI);
              return raw < 0 ? raw + 360 : raw;
            })();

          // The raw magnetometer is very noisy at 80 ms intervals; blend with
          // the previous value, taking the shortest way around the circle so
          // 359° -> 1° does not spin the whole compass backwards.
          const prev = headingRef.current;
          const delta = ((angle - prev + 540) % 360) - 180;
          const next = (prev + delta * 0.25 + 360) % 360;

          headingRef.current = next;
          jitterRef.current = jitterRef.current * 0.8 + Math.abs(delta) * 0.2;
          setCompassHeading(next);
          setSensorJitter(Math.round(jitterRef.current * 10) / 10);
        });
      }
    });

    return () => {
      sub?.remove();
      accelSub?.remove();
    };
  }, [startPulse]);

  // Animate compass rose and qibla needle
  useEffect(() => {
    const compassTarget = -compassHeading;
    // The needle overlays (rather than nests inside) the rotated rose, so it
    // must be counter-rotated by the heading itself.
    const qiblaTarget = direction !== null ? direction - compassHeading : 0;

    Animated.parallel([
      Animated.spring(compassRotAnim, {
        toValue: compassTarget,
        useNativeDriver: true,
        damping: 15,
        stiffness: 120,
        mass: 0.8,
      }),
      Animated.spring(needleRotAnim, {
        toValue: qiblaTarget,
        useNativeDriver: true,
        damping: 15,
        stiffness: 120,
        mass: 0.8,
      }),
    ]).start();

    // Glow when the device camera points at the Kaaba (within 5°).
    if (direction !== null) {
      const facing = (((direction - compassHeading) % 360) + 360) % 360;
      const aligned = facing < 5 || facing > 355;
      Animated.timing(glowAnim, { toValue: aligned ? 1 : 0, duration: 300, useNativeDriver: true }).start();
    }
  }, [direction, compassHeading, compassRotAnim, needleRotAnim, glowAnim]);

  const compassRotStr = compassRotAnim.interpolate({
    inputRange: [-720, 720],
    outputRange: ['-720deg', '720deg'],
  });

  const needleRotStr = needleRotAnim.interpolate({
    inputRange: [-720, 720],
    outputRange: ['-720deg', '720deg'],
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: C.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.gold} />
        <Text style={[styles.statusText, { color: C.textSecondary }]}>Locating your position...</Text>
        <Text style={[styles.statusSub, { color: C.textMuted }]}>Finding direction to the Holy Ka'bah</Text>
      </View>
    );
  }

  const accuracy = getAccuracyLevel(sensorJitter);
  const qiblaAngle = direction !== null ? Math.round(direction) : null;
  const headingAngle = Math.round(compassHeading);
  const cardinal = getCardinalLabel(compassHeading);

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityLabel="Go back"
          accessibilityRole="button" style={styles.headerBtn}>
            <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Qibla Direction</Text>
            <Text style={[styles.headerArabic, { color: C.gold }]}>القِبْلَة</Text>
          </View>
          <Pressable onPress={reload} style={[styles.headerBtn, { backgroundColor: `${C.gold}20` }]}>
            <MaterialIcons name="my-location" size={22} color={C.gold} />
          </Pressable>
        </View>

        {/* Location info */}
        {coordinates ? (
          <View style={[styles.locationBar, { backgroundColor: `${C.gold}10`, borderColor: `${C.gold}20` }]}>
            <MaterialIcons name="location-on" size={14} color={C.gold} />
            <Text style={[styles.locationText, { color: C.textSecondary }]}>
              {coordinates.lat.toFixed(4)}°N, {coordinates.lng.toFixed(4)}°E
            </Text>
            {distance !== null && (
              <>
                <View style={styles.locationDot} />
                <MaterialIcons name="mosque" size={12} color={C.gold} />
                <Text style={[styles.locationText, { color: C.gold }]}>
                  {distance.toLocaleString()} km
                </Text>
              </>
            )}
          </View>
        ) : null}
      </LinearGradient>

      {error ? (
        <View style={[styles.errorState, { margin: Spacing.md }]}>
          <View style={[styles.errorCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <MaterialIcons name="location-off" size={48} color={C.error} />
            <Text style={[styles.errorTitle, { color: C.textPrimary }]}>Location Required</Text>
            <Text style={[styles.errorDesc, { color: C.textSecondary }]}>
              Enable location services to accurately determine your Qibla direction.
            </Text>
            <Pressable
              style={[styles.errorBtn, { backgroundColor: C.gold }]}
              onPress={reload}
            >
              <MaterialIcons name="location-on" size={18} color={C.primaryDark} />
              <Text style={[styles.errorBtnText, { color: C.primaryDark }]}>Enable Location</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.compassSection}>
          {/* Compass Container */}
          <View style={[styles.compassOuter, { width: COMPASS_SIZE + 32, height: COMPASS_SIZE + 32 }]}>
            {/* Outer ring glow */}
            <Animated.View
              style={[
                styles.outerGlow,
                {
                  width: COMPASS_SIZE + 32,
                  height: COMPASS_SIZE + 32,
                  borderRadius: (COMPASS_SIZE + 32) / 2,
                  borderColor: C.gold,
                  opacity: glowAnim,
                },
              ]}
            />

            {/* Compass rose — rotates with device */}
            <Animated.View
              style={[
                styles.compassRose,
                {
                  width: COMPASS_SIZE,
                  height: COMPASS_SIZE,
                  borderRadius: COMPASS_SIZE / 2,
                  backgroundColor: C.card,
                  borderColor: `${C.gold}30`,
                  transform: [{ rotate: compassRotStr }],
                },
              ]}
            >
              {/* Degree ticks */}
              {TICKS.map(tick => (
                <View
                  key={tick.deg}
                  style={[
                    styles.tick,
                    {
                      height: tick.major ? 16 : tick.medium ? 10 : 6,
                      width: tick.major ? 2 : 1.5,
                      backgroundColor: tick.major ? C.gold : tick.medium ? `${C.gold}60` : `${C.gold}30`,
                      top: 8,
                      left: COMPASS_SIZE / 2 - (tick.major ? 1 : 0.75),
                      transform: [
                        { rotate: `${tick.deg}deg` },
                        { translateY: 0 },
                      ],
                      transformOrigin: `${tick.major ? 1 : 0.75}px ${COMPASS_SIZE / 2 - 8}px`,
                    },
                  ]}
                />
              ))}

              {/* Cardinal direction labels */}
              {CARDINALS.map(({ label, deg }) => {
                const radians = (deg - 90) * (Math.PI / 180);
                const r = COMPASS_SIZE / 2 - 32;
                const x = COMPASS_SIZE / 2 + r * Math.cos(radians) - 12;
                const y = COMPASS_SIZE / 2 + r * Math.sin(radians) - 10;
                return (
                  <View key={label} style={[styles.cardinalLabel, { left: x, top: y }]}>
                    <Text style={[
                      styles.cardinalText,
                      { color: label === 'N' ? C.gold : `${C.textSecondary}90` },
                      label === 'N' && styles.cardinalNorth,
                    ]}>
                      {label}
                    </Text>
                  </View>
                );
              })}

              {/* Center circle */}
              <View style={[styles.compassCenter, { backgroundColor: C.background, borderColor: `${C.gold}40` }]} />
            </Animated.View>

            {/* Qibla Needle — rotates to point at Qibla */}
            <Animated.View
              style={[
                styles.needleContainer,
                {
                  width: COMPASS_SIZE,
                  height: COMPASS_SIZE,
                  transform: [{ rotate: needleRotStr }],
                },
              ]}
            >
              {/* Needle up (toward Qibla) */}
              <View style={[styles.needleUp, {
                height: NEEDLE_LENGTH,
                backgroundColor: C.gold,
                top: COMPASS_SIZE / 2 - NEEDLE_LENGTH - 4,
                left: COMPASS_SIZE / 2 - 4,
              }]} />

              {/* Needle tip */}
              <View style={[styles.needleTip, {
                backgroundColor: C.gold,
                top: COMPASS_SIZE / 2 - NEEDLE_LENGTH - 12,
                left: COMPASS_SIZE / 2 - 8,
              }]} />

              {/* Needle back */}
              <View style={[styles.needleDown, {
                height: NEEDLE_LENGTH * 0.4,
                backgroundColor: `${C.gold}50`,
                top: COMPASS_SIZE / 2 + 4,
                left: COMPASS_SIZE / 2 - 3,
              }]} />
            </Animated.View>

            {/* Kaaba icon at needle tip direction */}
            <Animated.View
              style={[
                styles.kaabaContainer,
                { transform: [{ rotate: needleRotStr }] },
              ]}
            >
              <View style={[styles.kaabaWrapper, {
                top: COMPASS_SIZE / 2 + 16 - COMPASS_SIZE / 2 - NEEDLE_LENGTH - 14,
                left: COMPASS_SIZE / 2 + 16 - 16,
              }]}>
                <Text style={styles.kaabaEmoji}>🕋</Text>
              </View>
            </Animated.View>

            {/* Center pivot */}
            <Animated.View
              style={[
                styles.pivot,
                {
                  backgroundColor: C.gold,
                  borderColor: C.primaryDark,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
          </View>

          {/* Heading display */}
          <View style={[styles.headingDisplay, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30` }]}>
            <Text style={[styles.headingDeg, { color: C.gold }]}>{headingAngle}°</Text>
            <Text style={[styles.headingCard, { color: C.textMuted }]}>{cardinal}</Text>
          </View>
        </View>
      )}

      {/* Info Cards */}
      {!error && (
        <View style={[styles.infoCards, { paddingHorizontal: Spacing.md }]}>
          {[
            {
              icon: 'explore',
              label: 'Qibla',
              value: qiblaAngle !== null ? `${qiblaAngle}°` : '--',
              sub: 'from North',
              color: C.gold,
            },
            {
              icon: 'mosque',
              label: 'Distance',
              value: distance !== null ? `${distance.toLocaleString()}` : '--',
              sub: 'km to Ka\'bah',
              color: C.success,
            },
            {
              icon: 'navigation',
              label: 'Heading',
              value: `${headingAngle}°`,
              sub: getCardinalLabel(compassHeading),
              color: C.info,
            },
          ].map(card => (
            <View
              key={card.label}
              style={[styles.infoCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}
            >
              <View style={[styles.infoIconBox, { backgroundColor: `${card.color}15` }]}>
                <MaterialIcons name={card.icon as any} size={18} color={card.color} />
              </View>
              <Text style={[styles.infoValue, { color: card.color }]}>{card.value}</Text>
              <Text style={[styles.infoLabel, { color: C.textMuted }]}>{card.label}</Text>
              <Text style={[styles.infoSub, { color: C.textMuted }]}>{card.sub}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Sensor status / Calibration note */}
      {!error && (
        <View style={[styles.statusBar, { marginHorizontal: Spacing.md, backgroundColor: `${C.info}10`, borderColor: `${C.info}20` }]}>
          <MaterialIcons
            name={magnetometerAvailable ? accuracy.icon as any : 'sensors-off'}
            size={14}
            color={magnetometerAvailable ? accuracy.color : C.warning}
          />
          <Text style={[styles.statusBarText, { color: C.textMuted }]}>
            {Platform.OS === 'web'
              ? 'Compass sensors are not available in the browser. Use the bearing below with a physical compass, or open the app on a phone.'
              : magnetometerAvailable
                ? `Compass accuracy: ${accuracy.label}. Move in a figure-8 pattern to recalibrate.`
                : 'Magnetometer unavailable. Qibla direction calculated from GPS only.'}
          </Text>
        </View>
      )}

      {/* Compass instruction */}
      {!error && direction !== null && (
        <View style={[styles.instructionCard, { marginHorizontal: Spacing.md, backgroundColor: `${C.gold}08`, borderColor: `${C.gold}20` }]}>
          <Text style={styles.instructionEmoji}>🕋</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.instructionTitle, { color: C.textPrimary }]}>Face the Qibla</Text>
            <Text style={[styles.instructionSub, { color: C.textSecondary }]}>
              Align the golden needle with the Ka'bah icon pointing forward.
              Hold device flat and away from metal objects.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', gap: 16 },
  statusText: { fontSize: 16, fontWeight: '600' },
  statusSub: { fontSize: 13 },

  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  headerBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerArabic: { fontSize: 16, marginTop: 2 },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  locationText: { fontSize: 12 },
  locationDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#666' },

  compassSection: { alignItems: 'center', paddingTop: Spacing.lg },
  compassOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  outerGlow: {
    position: 'absolute',
    borderWidth: 2,
    ...Shadow.gold,
  },
  compassRose: {
    position: 'absolute',
    borderWidth: 1.5,
    overflow: 'hidden',
    ...Shadow.medium,
  },
  tick: {
    position: 'absolute',
    borderRadius: 1,
  },
  cardinalLabel: {
    position: 'absolute',
    width: 24,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardinalText: { fontSize: 11, fontWeight: '600' },
  cardinalNorth: { fontSize: 14, fontWeight: '800' },
  compassCenter: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    top: '50%',
    left: '50%',
    marginTop: -12,
    marginLeft: -12,
  },

  needleContainer: {
    position: 'absolute',
  },
  needleUp: {
    position: 'absolute',
    width: 8,
    borderRadius: 4,
  },
  needleTip: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    ...Shadow.gold,
  },
  needleDown: {
    position: 'absolute',
    width: 6,
    borderRadius: 3,
    opacity: 0.5,
  },

  kaabaContainer: {
    position: 'absolute',
    width: COMPASS_SIZE + 32,
    height: COMPASS_SIZE + 32,
  },
  kaabaWrapper: {
    position: 'absolute',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kaabaEmoji: { fontSize: 22 },

  pivot: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    ...Shadow.gold,
  },

  headingDisplay: {
    marginTop: Spacing.lg,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.round,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headingDeg: { fontSize: 20, fontWeight: '700' },
  headingCard: { fontSize: 14, fontWeight: '600' },

  errorState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorCard: {
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.md,
    maxWidth: 320,
  },
  errorTitle: { fontSize: 18, fontWeight: '700' },
  errorDesc: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  errorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: Radius.md,
    marginTop: 4,
  },
  errorBtnText: { fontSize: 15, fontWeight: '700' },

  infoCards: { flexDirection: 'row', gap: 10, marginTop: Spacing.lg },
  infoCard: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    gap: 4,
  },
  infoIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoValue: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  infoLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoSub: { fontSize: 10 },

  statusBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  statusBarText: { flex: 1, fontSize: 12, lineHeight: 18 },

  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  instructionEmoji: { fontSize: 32 },
  instructionTitle: { fontSize: 15, fontWeight: '700' },
  instructionSub: { fontSize: 12, lineHeight: 18, marginTop: 3 },
});

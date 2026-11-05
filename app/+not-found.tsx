import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing, Radius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

export default function NotFoundScreen() {
  const { colors: C } = useApp();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
      <LinearGradient
        colors={[C.background, C.surface]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.content}>
        <MaterialIcons name="explore-off" size={80} color={C.gold} />
        <Text style={[styles.title, { color: C.textPrimary }]}>Page Not Found</Text>
        <Text style={[styles.message, { color: C.textSecondary }]}>
          This page does not exist. It may have been moved, or the link was mistyped.
        </Text>

        <TouchableOpacity
          style={[styles.homeButton, { backgroundColor: C.gold }]}
          onPress={() => router.replace('/')}
        >
          <Text style={[styles.homeButtonText, { color: C.primaryDark }]}>Return Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  homeButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.round,
  },
  homeButtonText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
});

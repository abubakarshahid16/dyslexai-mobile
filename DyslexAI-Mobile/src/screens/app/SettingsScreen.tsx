import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, borderRadius, fonts } from '../../theme';

export default function SettingsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.body}>Sign in or create an account from the home screen to sync your progress and use DyslexAI across devices.</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <Text style={styles.body}>Daily reminders for practice can be added in a future update. For now, open the app when you want to practice.</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data & storage</Text>
        <Text style={styles.body}>Your practice progress and saved scans are stored on this device. Signing out does not delete local data.</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Accessibility</Text>
        <Text style={styles.body}>DyslexAI uses the Lexend font and clear layouts to support readability. Use your device’s display and text size settings for more comfort.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.lg, fontFamily: fonts.bold },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, fontFamily: fonts.semiBold },
  body: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, fontFamily: fonts.regular },
});

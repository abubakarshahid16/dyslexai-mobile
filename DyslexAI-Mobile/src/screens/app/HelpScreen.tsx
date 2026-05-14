import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, fonts } from '../../theme';

export default function HelpScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Help</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scanning text</Text>
        <Text style={styles.body}>Tap “Scan Text” on the home screen, then take a photo of handwritten text. The app will detect lines, recognize the text, and correct grammar and spelling. You can save the result to My Library.</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily exercises</Text>
        <Text style={styles.body}>Open “Daily Exercises” to choose Word Typing or Sentence Builder. “Start practice” gives you a mix of exercises. Complete each one by typing your answer and submitting. You’ll get a score and feedback after each attempt.</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Library</Text>
        <Text style={styles.body}>Scans you save from the Scan Results screen appear here. Open any item to view the corrected text again.</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Progress and XP</Text>
        <Text style={styles.body}>Your dashboard shows accuracy, sessions, and words practiced. You earn XP for completing exercises and saving scans, and unlock badges and levels as you go.</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backend not reachable</Text>
        <Text style={styles.body}>If the app says the scan or exercise server is unreachable, ensure both backends are running (see project docs). On a physical device, use your computer’s IP address in the app’s .env; on an emulator, use 10.0.2.2.</Text>
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

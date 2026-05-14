import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, borderRadius, fonts } from '../../theme';

const APP_VERSION = '1.0.0';

export default function AboutScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>About DyslexAI</Text>
      <Text style={styles.tagline}>Supporting reading and writing for everyone</Text>
      <View style={styles.section}>
        <Text style={styles.body}>
          DyslexAI is a mobile app designed to support people with dyslexia and others who benefit from extra help with reading and writing. It combines scanning and correction of handwritten text with structured practice exercises.
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What DyslexAI does</Text>
        <Text style={styles.body}>
          • <Text style={styles.bold}>Scan & correct</Text> — Photograph handwritten notes; get corrected, easy-to-read text with grammar and spelling improvements.{'\n'}
          • <Text style={styles.bold}>Daily exercises</Text> — Word typing and sentence builder with adaptive difficulty and instant feedback.{'\n'}
          • <Text style={styles.bold}>My Library</Text> — Save and revisit your corrected scans.{'\n'}
          • <Text style={styles.bold}>Progress & gamification</Text> — Track accuracy, streaks, and earn badges.
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Version</Text>
        <Text style={styles.body}>DyslexAI version {APP_VERSION}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.xs, fontFamily: fonts.bold },
  tagline: { fontSize: 16, color: colors.primary, marginBottom: spacing.lg, fontFamily: fonts.medium },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, fontFamily: fonts.semiBold },
  body: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, fontFamily: fonts.regular },
  bold: { fontWeight: '600', color: colors.text, fontFamily: fonts.semiBold },
});

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, fonts } from '../../theme';

export default function PrivacyPolicyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.updated}>Last updated: 2025</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <Text style={styles.body}>
          DyslexAI is designed with privacy in mind. This policy describes what data the app uses and where it is stored.
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data stored on your device</Text>
        <Text style={styles.body}>
          The app stores the following locally on your device: your account token (if you sign in), practice progress (e.g. exercise student ID, XP, level, badges, streaks), and saved scans (corrected text and image references). This data stays on the device unless you use a backend that syncs it.
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data sent to our servers</Text>
        <Text style={styles.body}>
          When you use Scan or Daily Exercises, the app sends data to the backends you connect to (e.g. scan backend for images and text, exercise backend for practice answers and scores). If you run these backends yourself, that data is under your control. If you use a hosted service, that service’s privacy policy applies to the data they process.
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Third-party services</Text>
        <Text style={styles.body}>
          The scan pipeline may use third-party APIs (e.g. for grammar or language models) when configured. Check your backend configuration and the respective providers’ privacy policies for how they handle data.
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Children</Text>
        <Text style={styles.body}>
          DyslexAI may be used by learners of various ages. If the app is used by a minor, a parent or guardian should review this policy and ensure they are comfortable with the data practices described.
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Changes</Text>
        <Text style={styles.body}>
          We may update this privacy policy from time to time. The “Last updated” date at the top will be revised when changes are made. Continued use of the app after changes constitutes acceptance of the updated policy.
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact</Text>
        <Text style={styles.body}>
          For questions about this privacy policy or DyslexAI’s data practices, use the contact details provided in the app or project documentation.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.xs, fontFamily: fonts.bold },
  updated: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.lg, fontFamily: fonts.regular },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, fontFamily: fonts.semiBold },
  body: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, fontFamily: fonts.regular },
});

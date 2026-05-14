import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, fonts } from '../../theme';

export default function TermsOfUseScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Terms of Use</Text>
      <Text style={styles.updated}>Last updated: 2025</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acceptance</Text>
        <Text style={styles.body}>
          By using DyslexAI, you agree to these terms. If you do not agree, please do not use the app.
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Use of the app</Text>
        <Text style={styles.body}>
          DyslexAI is provided to support learning and reading. You may use it for personal or educational purposes in accordance with this app and any backend services you connect to. You are responsible for ensuring your use complies with applicable laws and any institutional or parental guidelines.
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>No warranty</Text>
        <Text style={styles.body}>
          The app and any connected services are provided “as is.” We do not guarantee that scan results, corrections, or exercise feedback are error-free or suitable for any particular purpose. Use your judgment, especially in educational or medical contexts.
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Limitation of liability</Text>
        <Text style={styles.body}>
          To the extent permitted by law, the developers and providers of DyslexAI are not liable for any indirect, incidental, or consequential damages arising from your use of the app or any third-party services.
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Changes to terms</Text>
        <Text style={styles.body}>
          We may update these terms. The “Last updated” date will be revised when changes are made. Continued use of the app after changes constitutes acceptance of the updated terms.
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact</Text>
        <Text style={styles.body}>
          For questions about these terms, use the contact details provided in the app or project documentation.
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

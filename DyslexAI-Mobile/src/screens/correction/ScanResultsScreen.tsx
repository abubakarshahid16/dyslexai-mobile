import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Image,
  Alert,
  LayoutChangeEvent,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { colors, spacing, borderRadius, fonts } from '../../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { saveScanResult } from '../../utils/libraryStorage';
import { awardScanSavedXP } from '../../utils/gamification';

type ScanResultsRoute = RouteProp<RootStackParamList, 'ScanResults'>;
type ScanResultsNav = NativeStackNavigationProp<RootStackParamList, 'ScanResults'>;

export default function ScanResultsScreen() {
  const route = useRoute<ScanResultsRoute>();
  const navigation = useNavigation<ScanResultsNav>();
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  const params = route.params;
  const [saved, setSaved] = useState(false);
  const [imageLayout, setImageLayout] = useState<{ width: number; height: number } | null>(null);

  const hasResult = params && params.correctedText != null;
  const errorRegions = params?.errorRegions ?? [];
  const imageWidth = params?.imageWidth ?? 1;
  const imageHeight = params?.imageHeight ?? 1;
  const scanDurationMs =
    typeof route.params?.scanDurationMs === 'number'
      ? route.params.scanDurationMs
      : Number(route.params?.scanDurationMs);
  const hasValidDuration = typeof scanDurationMs === 'number' && !isNaN(scanDurationMs) && scanDurationMs >= 0;
  const hasHighlights = errorRegions.length > 0 && imageLayout && imageWidth > 0 && imageHeight > 0;
  const scaleX = imageLayout ? imageLayout.width / imageWidth : 0;
  const scaleY = imageLayout ? imageLayout.height / imageHeight : 0;

  const scanTimeLabel = hasValidDuration
    ? scanDurationMs >= 60000
      ? `Scan completed in ${Math.floor(scanDurationMs / 60000)}m ${Math.round((scanDurationMs % 60000) / 1000)}s`
      : `Scan completed in ${Math.round(scanDurationMs / 1000)}s`
    : null;

  const handleSaveToLibrary = async () => {
    if (!hasResult || !params) return;
    try {
      await saveScanResult(params);
      await awardScanSavedXP(userId);
      setSaved(true);
      Alert.alert('Saved', 'Scan saved to My Library. +10 XP');
    } catch (e) {
      Alert.alert('Error', 'Could not save. Try again.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {hasResult && (
        <View style={styles.timerRow}>
          <MaterialIcons name="timer" size={20} color={colors.primary} />
          <Text style={styles.timerText}>
            {scanTimeLabel ?? 'Scan completed'}
          </Text>
        </View>
      )}

      {/* Original Scan with error highlights */}
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <MaterialIcons name="zoom-in" size={20} color={colors.textSecondary} />
          <Text style={styles.sectionLabel}>
            Original Scan{errorRegions.length > 0 ? ` — ${errorRegions.length} correction(s) highlighted` : ''}
          </Text>
        </View>
        {hasResult && params!.imageUri ? (
          <View
            style={[
              styles.previewImageWrap,
              imageWidth > 0 && imageHeight > 0 && { aspectRatio: imageWidth / imageHeight },
            ]}
            onLayout={(e: LayoutChangeEvent) => {
              const { width, height } = e.nativeEvent.layout;
              if (width > 0 && height > 0) setImageLayout({ width, height });
            }}
          >
            <Image
              source={{ uri: params!.imageUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
            {hasHighlights &&
              errorRegions.map((region, idx) => {
                const [xMin, yMin, xMax, yMax] = region.bbox;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.errorOverlay,
                      {
                        left: xMin * scaleX,
                        top: yMin * scaleY,
                        width: (xMax - xMin) * scaleX,
                        height: (yMax - yMin) * scaleY,
                      },
                    ]}
                  />
                );
              })}
          </View>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderText}>[Scan preview]</Text>
          </View>
        )}
      </View>

      {/* Corrected Text */}
      <View style={styles.section}>
        <Text style={styles.heading}>Corrected Text</Text>
        <Pressable style={styles.listenRow}>
          <MaterialIcons name="volume-up" size={22} color={colors.primary} />
          <Text style={styles.listenText}>Listen</Text>
        </Pressable>
        <View style={styles.textBlock}>
          <Text style={styles.correctedParagraph}>
            {hasResult ? params!.correctedText : 'The quick brown fox jumps over the lazy dog. He was looking for bread but found a bird instead.'}
          </Text>
        </View>
        <View style={styles.infoBox}>
          <MaterialIcons name="info-outline" size={18} color={colors.warning} />
          <Text style={styles.infoText}>
            {hasResult ? 'OCR: DocTR + TrOCR. Context fix: Groq (Llama 3.3).' : 'Yellow underlines show corrected dyslexia patterns.'}
          </Text>
        </View>
      </View>

      {/* Lines (if from API) */}
      {hasResult && params!.lines && params!.lines.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.heading}>Lines detected ({params!.lineCount})</Text>
          {params!.lines!.slice(0, 5).map((line) => (
            <View key={line.line_number} style={styles.lineRow}>
              <Text style={styles.lineNum}>{line.line_number}.</Text>
              <Text style={styles.lineText}>{line.text}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton}>
          <MaterialIcons name="fitness-center" size={20} color={colors.text} />
          <Text style={styles.primaryButtonText}>Practice These Words</Text>
        </TouchableOpacity>
        <View style={styles.secondaryRow}>
          <TouchableOpacity
            style={[styles.iconButton, saved && styles.iconButtonSaved]}
            onPress={handleSaveToLibrary}
            disabled={!hasResult || saved}
          >
            <MaterialIcons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={saved ? colors.primary : colors.text}
            />
            <Text style={styles.iconButtonText}>
              {saved ? 'Saved to Library' : 'Save to Library'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Upload')}>
            <MaterialIcons name="history" size={22} color={colors.text} />
            <Text style={styles.iconButtonText}>Rescan</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  timerText: { fontSize: 15, color: colors.text, fontFamily: fonts.medium },
  section: { marginBottom: spacing.lg },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  sectionLabel: { fontSize: 14, color: colors.textSecondary, fontFamily: fonts.regular },
  previewImageWrap: {
    width: '100%',
    maxHeight: 320,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: { width: '100%', height: '100%', borderRadius: borderRadius.md },
  errorOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 193, 7, 0.35)',
    borderWidth: 2,
    borderColor: 'rgba(255, 152, 0, 0.8)',
    borderRadius: 2,
  },
  imagePlaceholder: {
    height: 160,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: colors.textMuted, fontFamily: fonts.regular },
  heading: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.sm, fontFamily: fonts.semiBold },
  listenRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  listenText: { fontSize: 15, color: colors.primary, fontFamily: fonts.regular },
  textBlock: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  correctedParagraph: { fontSize: 16, color: colors.text, lineHeight: 24, fontFamily: fonts.regular },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  infoText: { fontSize: 13, color: colors.textSecondary, flex: 1, fontFamily: fonts.regular },
  lineRow: { flexDirection: 'row', marginBottom: 4, gap: 8 },
  lineNum: { fontSize: 14, color: colors.textMuted, minWidth: 24, fontFamily: fonts.regular },
  lineText: { fontSize: 14, color: colors.text, flex: 1, fontFamily: fonts.regular },
  actions: { marginTop: spacing.md },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  primaryButtonText: { color: colors.text, fontWeight: '600', fontSize: 16, fontFamily: fonts.semiBold },
  secondaryRow: { flexDirection: 'row', gap: spacing.sm },
  iconButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  iconButtonText: { color: colors.text, fontSize: 14, fontFamily: fonts.regular },
  iconButtonSaved: { opacity: 0.9 },
});

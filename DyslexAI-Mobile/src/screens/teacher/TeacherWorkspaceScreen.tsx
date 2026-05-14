import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { colors, spacing, borderRadius, fonts } from '../../theme';
import { scanImage, type ScanResponse, type ErrorRegion } from '../../api/scan';
import { useAuth } from '../../context/AuthContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function TeacherWorkspaceScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();

  const [pickedImage, setPickedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [imageLayout, setImageLayout] = useState<{ width: number; height: number } | null>(null);

  const errorRegions = scan?.error_regions ?? [];
  const imageWidth = scan?.image_width ?? 1;
  const imageHeight = scan?.image_height ?? 1;

  const hasHighlights = useMemo(() => {
    return errorRegions.length > 0 && imageLayout && imageWidth > 0 && imageHeight > 0;
  }, [errorRegions.length, imageLayout, imageWidth, imageHeight]);

  const scaleX = imageLayout ? imageLayout.width / imageWidth : 0;
  const scaleY = imageLayout ? imageLayout.height / imageHeight : 0;

  const requestPermission = async (type: 'camera' | 'library') => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  };

  const openCamera = async () => {
    const ok = await requestPermission('camera');
    if (!ok) {
      Alert.alert('Permission needed', 'Camera access is required to photograph handwriting.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setPickedImage(result.assets[0].uri);
  };

  const openGallery = async () => {
    const ok = await requestPermission('library');
    if (!ok) {
      Alert.alert('Permission needed', 'Photo library access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setPickedImage(result.assets[0].uri);
  };

  const handleScan = async () => {
    if (!pickedImage) return;
    setLoading(true);
    setScan(null);
    try {
      const startMs = Date.now();
      const data = await scanImage(pickedImage);
      const scanDurationMs = Date.now() - startMs;
      setScan({ ...data, scanDurationMs } as ScanResponse & { scanDurationMs?: number });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Scan failed';
      Alert.alert('OCR failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssignment = () => {
    if (!scan?.corrected_text) return;
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in first.');
      return;
    }

    const corrected = scan.corrected_text.toLowerCase();
    const words = corrected
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/g)
      .map((w) => w.trim())
      .filter((w) => w.length >= 3 && w.length <= 8);

    const uniqueSeeds: string[] = [];
    for (const w of words) {
      if (!uniqueSeeds.includes(w)) uniqueSeeds.push(w);
      if (uniqueSeeds.length >= 12) break;
    }

    navigation.navigate('CreateTeacherAssignment', { seedWords: uniqueSeeds });
  };

  const renderOverlay = (region: ErrorRegion, idx: number) => {
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
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {loading && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.processingTitle}>Reading your handwriting</Text>
          <Text style={styles.processingSub}>DocTR + TrOCR are processing each line.</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.headerTitle}>Teacher Workspace</Text>
        <Text style={styles.headerSub}>Upload handwriting, then generate an assignment from corrected text.</Text>

        <View style={styles.uploadCard}>
          {!pickedImage ? (
            <View style={styles.uploadEmpty}>
              <MaterialIcons name="document-scanner" size={56} color={colors.textMuted} />
              <Text style={styles.uploadEmptyText}>Take a photo or choose from gallery</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.btn} onPress={openCamera} disabled={loading}>
                  <MaterialIcons name="camera-alt" size={22} color={colors.text} />
                  <Text style={styles.btnText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btn} onPress={openGallery} disabled={loading}>
                  <MaterialIcons name="photo-library" size={22} color={colors.text} />
                  <Text style={styles.btnText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.previewWrap}>
                <Image
                  source={{ uri: pickedImage }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              </View>
              <TouchableOpacity style={[styles.scanButton, loading && styles.scanButtonDisabled]} onPress={handleScan} disabled={loading}>
                <Text style={styles.scanButtonText}>{loading ? 'Scanning…' : 'Scan & Correct'}</Text>
              </TouchableOpacity>
              <Text style={styles.smallHint}>Tip: Use good lighting and keep the writing flat.</Text>
            </>
          )}
        </View>
      </View>

      {scan && (
        <>
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <MaterialIcons name="zoom-in" size={20} color={colors.textSecondary} />
              <Text style={styles.sectionLabel}>
                Original + highlights{errorRegions.length > 0 ? ` (${errorRegions.length})` : ''}
              </Text>
            </View>

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
              <Image source={{ uri: pickedImage ?? '' }} style={styles.previewImage} resizeMode="contain" />
              {hasHighlights && errorRegions.map(renderOverlay)}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <MaterialIcons name="edit-note" size={20} color={colors.textSecondary} />
              <Text style={styles.heading}>Corrected Text</Text>
              <Pressable onPress={() => navigation.navigate('TeacherAssignments')} style={{ marginLeft: 'auto' }}>
                <Text style={styles.linkText}>View Assignments</Text>
              </Pressable>
            </View>
            <View style={styles.textBlock}>
              <Text style={styles.correctedParagraph}>{scan.corrected_text}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleCreateAssignment}
            disabled={!scan.corrected_text}
          >
            <MaterialIcons name="assignment" size={20} color={colors.text} />
            <Text style={styles.primaryButtonText}>Create Assignment</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  section: { marginBottom: spacing.lg },
  headerTitle: { fontSize: 26, fontWeight: '700', color: colors.text, fontFamily: fonts.bold, marginBottom: 6 },
  headerSub: { fontSize: 14, color: colors.textSecondary, fontFamily: fonts.regular, lineHeight: 20, marginBottom: spacing.md },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  sectionLabel: { fontSize: 14, color: colors.textSecondary, fontFamily: fonts.regular, flex: 1 },
  heading: { fontSize: 18, fontWeight: '600', color: colors.text, fontFamily: fonts.semiBold },
  linkText: { color: colors.primary, fontFamily: fonts.semiBold, fontSize: 13 },

  uploadCard: { backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md },
  uploadEmpty: { alignItems: 'center' },
  uploadEmptyText: { marginTop: spacing.sm, fontSize: 14, color: colors.textSecondary, fontFamily: fonts.regular, textAlign: 'center', lineHeight: 20 },
  buttonRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  btn: {
    flex: 1,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnText: { fontSize: 14, color: colors.text, fontFamily: fonts.semiBold },

  previewWrap: { height: 260, borderRadius: borderRadius.md, overflow: 'hidden', backgroundColor: colors.surfaceElevated },
  previewImage: { width: '100%', height: '100%' },

  scanButton: { marginTop: spacing.md, backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
  scanButtonDisabled: { opacity: 0.6 },
  scanButtonText: { color: colors.text, fontWeight: '700', fontFamily: fonts.semiBold, fontSize: 16 },
  smallHint: { marginTop: spacing.sm, fontSize: 12, color: colors.textMuted, fontFamily: fonts.regular },

  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    zIndex: 10,
    borderRadius: 10,
  },
  processingTitle: { marginTop: spacing.md, fontSize: 18, fontWeight: '600', color: colors.text, fontFamily: fonts.semiBold },
  processingSub: { marginTop: spacing.xs, fontSize: 14, color: colors.textSecondary, fontFamily: fonts.regular, textAlign: 'center' },

  previewImageWrap: {
    width: '100%',
    maxHeight: 320,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    position: 'relative',
  },
  errorOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 193, 7, 0.35)',
    borderWidth: 2,
    borderColor: 'rgba(255, 152, 0, 0.8)',
    borderRadius: 2,
  },

  textBlock: { backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md },
  correctedParagraph: { fontSize: 16, color: colors.text, lineHeight: 24, fontFamily: fonts.regular },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
  },
  primaryButtonText: { color: colors.text, fontWeight: '600', fontFamily: fonts.semiBold, fontSize: 16 },
});


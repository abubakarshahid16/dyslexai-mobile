import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { colors, spacing, borderRadius, fonts } from '../../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { scanImage } from '../../api/scan';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function UploadScreen() {
  const navigation = useNavigation<Nav>();
  const [pickedImage, setPickedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestPermission = async (type: 'camera' | 'library') => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  };

  const openCamera = async (allowCrop: boolean) => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: allowCrop,
      // No aspect when cropping so the user can crop however they want
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedImage(result.assets[0].uri);
    }
  };

  const openGallery = async (allowCrop: boolean) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: allowCrop,
      // No aspect when cropping so the user can crop however they want
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedImage(result.assets[0].uri);
    }
  };

  const showImageSourceOptions = (source: 'camera' | 'library') => {
    const useFull = () =>
      source === 'camera' ? openCamera(false) : openGallery(false);
    const useCrop = () =>
      source === 'camera' ? openCamera(true) : openGallery(true);

    if (Platform.OS === 'ios' && ActionSheetIOS) {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Use entire image', 'Choose and crop'],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) useFull();
          else if (index === 2) useCrop();
        }
      );
      return;
    }
    Alert.alert(
      source === 'camera' ? 'Take photo' : 'Choose from gallery',
      'Use the full image or crop before scanning?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Use entire image', onPress: useFull },
        { text: 'Choose and crop', onPress: useCrop },
      ]
    );
  };

  const handleTakePhoto = async () => {
    const ok = await requestPermission('camera');
    if (!ok) {
      Alert.alert('Permission needed', 'Camera access is required to take a photo.');
      return;
    }
    showImageSourceOptions('camera');
  };

  const handlePickImage = async () => {
    const ok = await requestPermission('library');
    if (!ok) {
      Alert.alert('Permission needed', 'Photo library access is required.');
      return;
    }
    showImageSourceOptions('library');
  };

  const handleScan = async () => {
    if (!pickedImage) return;
    setLoading(true);
    const startMs = Date.now();
    try {
      const data = await scanImage(pickedImage);
      const scanDurationMs = Date.now() - startMs;
      navigation.navigate('ScanResults', {
        imageUri: pickedImage,
        rawText: data.raw_text,
        correctedText: data.corrected_text,
        lineCount: data.line_count,
        lines: data.lines,
        imageWidth: data.image_width,
        imageHeight: data.image_height,
        errorRegions: data.error_regions,
        scanDurationMs,
      });
    } catch (e) {
      let message = e instanceof Error ? e.message : 'Scan failed. Is the backend running?';
      if (/network|failed to fetch|connection/i.test(message)) {
        message =
          'Cannot reach the scan server. Ensure the scan backend is running (port 8000), the app URL is correct (emulator: 10.0.2.2:8000), and firewall allows port 8000. First scan can take 1–2 minutes.';
      }
      Alert.alert('Scan failed', message);
    } finally {
      setLoading(false);
    }
  };

  const showProcessingOverlay = loading;

  return (
    <View style={styles.container}>
      {showProcessingOverlay && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.processingTitle}>Reading your handwriting</Text>
          <Text style={styles.processingSub}>
            DocTR + TrOCR are processing each line. This may take 30–90 seconds.
          </Text>
        </View>
      )}
      <View style={styles.placeholder}>
        {pickedImage ? (
          <Image source={{ uri: pickedImage }} style={styles.preview} resizeMode="cover" />
        ) : (
          <>
            <MaterialIcons name="document-scanner" size={64} color={colors.textMuted} />
            <Text style={styles.placeholderText}>Take a photo or choose from gallery</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.btn} onPress={handleTakePhoto}>
                <MaterialIcons name="camera-alt" size={24} color={colors.text} />
                <Text style={styles.btnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={handlePickImage}>
                <MaterialIcons name="photo-library" size={24} color={colors.text} />
                <Text style={styles.btnText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
      <TouchableOpacity
        style={[styles.scanButton, (!pickedImage || loading) && styles.scanButtonDisabled]}
        onPress={handleScan}
        disabled={!pickedImage || loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.scanButtonText}>
            {pickedImage ? 'Scan & Correct' : 'Add a photo to continue'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  placeholder: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  preview: { width: '100%', height: '100%', borderRadius: borderRadius.md },
  placeholderText: { color: colors.textSecondary, marginTop: spacing.md, fontFamily: fonts.regular },
  buttonRow: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.md },
  btn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    minWidth: 100,
  },
  btnText: { color: colors.text, marginTop: 4, fontFamily: fonts.regular },
  scanButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  scanButtonDisabled: { opacity: 0.5 },
  scanButtonText: { color: colors.text, fontWeight: '600', fontSize: 16, fontFamily: fonts.semiBold },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    zIndex: 10,
  },
  processingTitle: {
    marginTop: spacing.md,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    fontFamily: fonts.semiBold,
  },
  processingSub: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
});

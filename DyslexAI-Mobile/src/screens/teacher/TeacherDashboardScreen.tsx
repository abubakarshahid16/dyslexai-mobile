import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { colors, spacing, borderRadius, fonts } from '../../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function TeacherDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { user, logout } = useAuth();
  const [menuVisible, setMenuVisible] = React.useState(false);

  const tools: Array<{
    id: string;
    title: string;
    subtitle: string;
    icon: keyof typeof MaterialIcons.glyphMap;
    onPress: () => void;
  }> = [
    {
      id: 'workspace',
      title: 'OCR Workspace',
      subtitle: 'Scan handwriting and see corrections',
      icon: 'photo-size-select-actual',
      onPress: () => navigation.navigate('TeacherWorkspace'),
    },
    {
      id: 'assignments',
      title: 'Assignments',
      subtitle: 'Create and review student tasks',
      icon: 'assignment',
      onPress: () => navigation.navigate('TeacherAssignments'),
    },
    {
      id: 'createAssignment',
      title: 'Create Assignment',
      subtitle: 'Manual or AI-generated exercises',
      icon: 'add-circle' as any,
      onPress: () => navigation.navigate('CreateTeacherAssignment'),
    },
    {
      id: 'progress',
      title: 'Student Progress',
      subtitle: 'Combined view + individual details',
      icon: 'insights' as any,
      onPress: () => navigation.navigate('TeacherStudentProgress'),
    },
  ];

  return (
    <>
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.menuBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.menuCard}>
                <Text style={styles.menuTitle}>Menu</Text>
                {[
                  { key: 'Settings', label: 'Settings', icon: 'settings' },
                  { key: 'About', label: 'About DyslexAI', icon: 'info-outline' },
                  { key: 'Help', label: 'Help', icon: 'help-outline' },
                  { key: 'PrivacyPolicy', label: 'Privacy Policy', icon: 'privacy-tip' },
                  { key: 'TermsOfUse', label: 'Terms of Use', icon: 'description' },
                ].map((item) => (
                  <Pressable
                    key={item.key}
                    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                    onPress={() => {
                      setMenuVisible(false);
                      navigation.navigate(item.key as keyof RootStackParamList);
                    }}
                  >
                    <MaterialIcons name={item.icon as any} size={22} color={colors.primary} />
                    <Text style={styles.menuItemLabel}>{item.label}</Text>
                    <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                  </Pressable>
                ))}
                <Pressable
                  style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                  onPress={async () => {
                    setMenuVisible(false);
                    await logout();
                    navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
                  }}
                >
                  <MaterialIcons name="logout" size={22} color={colors.error} />
                  <Text style={[styles.menuItemLabel, { color: colors.error }]}>Sign out</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Teacher</Text>
          <Text style={styles.subtitle}>{user ? `Hi, ${user.name}` : 'Welcome'}</Text>
        </View>
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuBtn} hitSlop={12}>
          <MaterialIcons name="menu" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {tools.map((t) => (
        <TouchableOpacity key={t.id} style={styles.card} onPress={t.onPress} activeOpacity={0.85}>
          <View style={styles.iconWrap}>
            <MaterialIcons name={t.icon} size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{t.title}</Text>
            <Text style={styles.cardSub}>{t.subtitle}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      ))}

      <View style={styles.footerHint}>
        <Text style={styles.footerText}>Tip: Start with OCR Workspace, then create an assignment.</Text>
      </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  header: {
    marginBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, fontFamily: fonts.bold, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.textSecondary, fontFamily: fonts.regular, lineHeight: 20 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardTitle: { fontSize: 16, color: colors.text, fontFamily: fonts.semiBold, marginBottom: 2 },
  cardSub: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.regular, lineHeight: 18 },

  footerHint: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
  },
  footerText: { fontSize: 13, color: colors.textMuted, fontFamily: fonts.regular, lineHeight: 18 },

  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingRight: spacing.md,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    minWidth: 240,
    paddingVertical: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    fontFamily: fonts.semiBold,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  menuItemPressed: { backgroundColor: colors.surfaceElevated },
  menuItemLabel: { flex: 1, fontSize: 15, color: colors.text, fontFamily: fonts.regular },
});


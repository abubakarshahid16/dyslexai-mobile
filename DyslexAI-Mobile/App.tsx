import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Lexend_400Regular, Lexend_500Medium, Lexend_600SemiBold, Lexend_700Bold } from '@expo-google-fonts/lexend';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors, fonts } from './src/theme';
import type { RootStackParamList } from './src/types/navigation';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LandingScreen from './src/screens/Auth/LandingScreen';
import SignupScreen from './src/screens/Auth/SignupScreen';
import LoginScreen from './src/screens/Auth/LoginScreen';
import StudentDashboardScreen from './src/screens/dashboard/StudentDashboardScreen';
import ScanResultsScreen from './src/screens/correction/ScanResultsScreen';
import LearningExercisesScreen from './src/screens/exercises/LearningExercisesScreen';
import PracticeScreen from './src/screens/exercises/PracticeScreen';
import UploadScreen from './src/screens/upload/UploadScreen';
import LibraryScreen from './src/screens/Library/LibraryScreen';
import TeacherDashboardScreen from './src/screens/teacher/TeacherDashboardScreen';
import TeacherWorkspaceScreen from './src/screens/teacher/TeacherWorkspaceScreen';
import TeacherAssignmentsScreen from './src/screens/teacher/TeacherAssignmentsScreen';
import CreateTeacherAssignmentScreen from './src/screens/teacher/CreateTeacherAssignmentScreen';
import TeacherStudentProgressScreen from './src/screens/teacher/TeacherStudentProgressScreen';
import GameHomeScreen from './src/screens/game/GameHomeScreen';
import GameSessionScreen from './src/screens/game/GameSessionScreen';
import GameCompleteScreen from './src/screens/game/GameCompleteScreen';
import GamePuzzleScreen from './src/screens/game/GamePuzzleScreen';
import SettingsScreen from './src/screens/app/SettingsScreen';
import AboutScreen from './src/screens/app/AboutScreen';
import HelpScreen from './src/screens/app/HelpScreen';
import PrivacyPolicyScreen from './src/screens/app/PrivacyPolicyScreen';
import TermsOfUseScreen from './src/screens/app/TermsOfUseScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
};

function AppNavigator() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={appStyles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={appStyles.loadingText}>Loading…</Text>
      </View>
    );
  }
  return (
    <Stack.Navigator
            initialRouteName={
              user ? (user.role === 'teacher' ? 'TeacherDashboard' : 'Dashboard') : 'Landing'
            }
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerTitleStyle: { fontFamily: fonts.semiBold },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen
            name="Landing"
            component={LandingScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Signup"
            component={SignupScreen}
            options={{ title: 'Create account' }}
          />
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ title: 'Sign in' }}
          />
          <Stack.Screen
            name="Dashboard"
            component={StudentDashboardScreen}
            options={{ title: 'DyslexAI' }}
          />
          <Stack.Screen
            name="TeacherDashboard"
            component={TeacherDashboardScreen}
            options={{ title: 'Teacher' }}
          />
          <Stack.Screen
            name="Upload"
            component={UploadScreen}
            options={{ title: 'Scan Text' }}
          />
          <Stack.Screen
            name="ScanResults"
            component={ScanResultsScreen}
            options={{ title: 'Scan Results' }}
          />
          <Stack.Screen
            name="LearningExercises"
            component={LearningExercisesScreen}
            options={{ title: 'Learning Exercises' }}
          />
          <Stack.Screen
            name="Practice"
            component={PracticeScreen}
            options={{ title: 'Practice' }}
          />
          <Stack.Screen
            name="TeacherWorkspace"
            component={TeacherWorkspaceScreen}
            options={{ title: 'Workspace' }}
          />
          <Stack.Screen
            name="TeacherAssignments"
            component={TeacherAssignmentsScreen}
            options={{ title: 'Assignments' }}
          />
          <Stack.Screen
            name="CreateTeacherAssignment"
            component={CreateTeacherAssignmentScreen}
            options={{ title: 'Create Assignment' }}
          />
          <Stack.Screen
            name="TeacherStudentProgress"
            component={TeacherStudentProgressScreen}
            options={{ title: 'Student Progress' }}
          />
          <Stack.Screen
            name="GameHome"
            component={GameHomeScreen}
            options={{ title: 'Game Mode' }}
          />
          <Stack.Screen
            name="GameSession"
            component={GameSessionScreen}
            options={{ title: 'Game Session' }}
          />
          <Stack.Screen
            name="GameComplete"
            component={GameCompleteScreen}
            options={{ title: 'Complete Day' }}
          />
          <Stack.Screen
            name="GamePuzzle"
            component={GamePuzzleScreen}
            options={{ title: 'Puzzle' }}
          />
          <Stack.Screen
            name="Library"
            component={LibraryScreen}
            options={{ title: 'My Library' }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Settings' }}
          />
          <Stack.Screen
            name="About"
            component={AboutScreen}
            options={{ title: 'About' }}
          />
          <Stack.Screen
            name="Help"
            component={HelpScreen}
            options={{ title: 'Help' }}
          />
          <Stack.Screen
            name="PrivacyPolicy"
            component={PrivacyPolicyScreen}
            options={{ title: 'Privacy Policy' }}
          />
          <Stack.Screen
            name="TermsOfUse"
            component={TermsOfUseScreen}
            options={{ title: 'Terms of Use' }}
          />
        </Stack.Navigator>
  );
}

const appStyles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 8, fontSize: 16, color: colors.textSecondary, fontFamily: fonts.regular },
});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={[appStyles.loading, { padding: 24 }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={appStyles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <AuthProvider>
        <NavigationContainer theme={navTheme}>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </>
  );
}

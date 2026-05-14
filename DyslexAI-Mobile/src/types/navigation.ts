export type ErrorRegionPayload = {
  bbox: [number, number, number, number];
  original?: string;
  corrected?: string;
};

export type ScanResultPayload = {
  imageUri: string;
  rawText: string;
  correctedText: string;
  lineCount: number;
  lines?: Array<{ line_number: number; text: string }>;
  imageWidth?: number;
  imageHeight?: number;
  errorRegions?: ErrorRegionPayload[];
  /** Time in ms from start of scan to result (shown as "Scan completed in Xm Ys"). */
  scanDurationMs?: number;
};

export type RootStackParamList = {
  Landing: undefined;
  Signup: { defaultRole?: 'student' | 'teacher' } | undefined;
  Login: undefined;
  Dashboard: undefined;
  TeacherDashboard: undefined;
  TeacherWorkspace: undefined;
  TeacherAssignments: undefined;
  CreateTeacherAssignment: { seedWords?: string[] } | undefined;
  TeacherStudentProgress: undefined;
  GameHome: undefined;
  GameSession: undefined;
  GameComplete: { scores?: number[]; dayNumber?: number } | undefined;
  GamePuzzle: { phaseId: number } | undefined;
  Upload: undefined;
  ScanResults: ScanResultPayload | undefined;
  LearningExercises: undefined;
  Practice:
    | {
        exerciseType?: 'word_typing' | 'sentence_typing' | 'handwriting' | 'tracing';
        assignmentId?: number;
      }
    | undefined;
  Library: undefined;
  Settings: undefined;
  About: undefined;
  Help: undefined;
  PrivacyPolicy: undefined;
  TermsOfUse: undefined;
};

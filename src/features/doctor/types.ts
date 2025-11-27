/**
 * Doctor Feature - Types
 * Diagnostic and repair utilities for storage health
 */

export interface DiagnosisResult {
  totalGalleryItems: number;
  inIndexedDB: number;
  cleanupCandidates: string[];
  estimatedCleanupTimeMs: number;
  estimatedFreedMB: number;
}

export interface CleanupResult {
  diagnosis: DiagnosisResult;
  cleaned: number;
  failed: string[];
  durationMs: number;
  freedMB: number;
}

export interface CleanupProgress {
  current: number;
  total: number;
  key: string;
}

export interface PassDocument {
  id: string;
  passId: string;
  fileName: string;
  uploadedAt: string;
  uploadedByUserId: string;
  fileSizeBytes: number;
}

export interface DocumentCleanupResult {
  orphanedFilesDeleted: number;
  missingFileRecordsDeleted: number;
  bytesFreed: number;
}

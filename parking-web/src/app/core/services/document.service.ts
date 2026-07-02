import { Signal } from '@angular/core';
import { Observable } from 'rxjs';
import { PassDocument, DocumentCleanupResult } from '../models/document.model';
import { UserRole } from '../models/user.model';

export interface CreateDocumentRequest {
  passId: string;
  file: File;
}

export abstract class DocumentService {
  abstract readonly documents: Signal<PassDocument[]>;

  abstract load(role: UserRole | null, userId: string | undefined): void;
  abstract getVisibleDocuments(role: UserRole | null, userId: string | undefined): PassDocument[];
  abstract addDocument(request: CreateDocumentRequest): PassDocument;
  abstract uploadDocument(request: CreateDocumentRequest): Observable<PassDocument>;
  abstract downloadDocument(documentId: string, fileName: string): Observable<void>;
  abstract getDocumentBlobUrl(documentId: string): Observable<string>;
  abstract cleanupFiles(): Observable<DocumentCleanupResult>;
  abstract deleteDocument(documentId: string): Observable<void>;
}

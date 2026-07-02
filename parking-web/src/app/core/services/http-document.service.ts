import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, tap } from 'rxjs';
import { PassDocument, DocumentCleanupResult } from '../models/document.model';
import { UserRole } from '../models/user.model';
import { API_BASE_URL } from '../config/api.config';
import { CreateDocumentRequest, DocumentService } from './document.service';

@Injectable()
export class HttpDocumentService extends DocumentService {
  private readonly documentsSignal = signal<PassDocument[]>([]);

  readonly documents = this.documentsSignal.asReadonly();

  constructor(private readonly http: HttpClient) {
    super();
  }

  load(_role: UserRole | null, _userId: string | undefined): void {
    this.http.get<PassDocument[]>(`${API_BASE_URL}/documents`).subscribe({
      next: (documents) => this.documentsSignal.set(documents),
    });
  }

  getVisibleDocuments(_role: UserRole | null, _userId: string | undefined): PassDocument[] {
    return this.documentsSignal();
  }

  addDocument(_request: CreateDocumentRequest): PassDocument {
    throw new Error('Use uploadDocument() for async API call');
  }

  uploadDocument(request: CreateDocumentRequest) {
    const formData = new FormData();
    formData.append('passId', request.passId);
    formData.append('file', request.file);

    return this.http.post<PassDocument>(`${API_BASE_URL}/documents/upload`, formData).pipe(
      tap((document) => this.documentsSignal.update((documents) => [document, ...documents])),
    );
  }

  downloadDocument(documentId: string, fileName: string) {
    return this.http
      .get(`${API_BASE_URL}/documents/${documentId}/download`, { responseType: 'blob' })
      .pipe(
        tap((blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
          URL.revokeObjectURL(url);
        }),
        map(() => void 0),
      );
  }

  getDocumentBlobUrl(documentId: string) {
    return this.http
      .get(`${API_BASE_URL}/documents/${documentId}/download`, { responseType: 'blob' })
      .pipe(map((blob) => URL.createObjectURL(blob)));
  }

  cleanupFiles() {
    return this.http.post<DocumentCleanupResult>(`${API_BASE_URL}/documents/cleanup`, {}).pipe(
      tap(() => this.load(null, undefined)),
    );
  }

  deleteDocument(documentId: string) {
    return this.http.delete<void>(`${API_BASE_URL}/documents/${documentId}`).pipe(
      tap(() =>
        this.documentsSignal.update((documents) =>
          documents.filter((document) => document.id !== documentId),
        ),
      ),
    );
  }
}

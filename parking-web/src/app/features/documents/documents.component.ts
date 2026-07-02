import { DatePipe } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { AuthService } from '../../core/services/auth.service';
import { DocumentService } from '../../core/services/document.service';
import { PassService } from '../../core/services/pass.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { PassDocument } from '../../core/models/document.model';
import { isImageFile } from '../../core/utils/file-type.util';
import { DocumentPreviewDialogComponent } from './document-preview-dialog/document-preview-dialog.component';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
  ],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.scss',
})
export class DocumentsComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly documentService = inject(DocumentService);
  private readonly passService = inject(PassService);
  private readonly referenceData = inject(ReferenceDataService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);

  private readonly previewUrls = signal<Record<string, string>>({});

  readonly user = this.auth.currentUser;
  readonly role = this.auth.userRole;

  readonly visiblePasses = computed(() => {
    const user = this.user();
    return this.passService.getVisiblePasses(this.role(), user?.id);
  });

  readonly uploadForm = this.fb.nonNullable.group({
    passId: [''],
  });

  readonly documents = computed(() => {
    const user = this.user();
    return this.documentService.getVisibleDocuments(this.role(), user?.id);
  });

  readonly displayedColumns = ['fileName', 'pass', 'uploadedBy', 'uploadedAt', 'size', 'actions'];

  constructor() {
    const user = this.user();
    this.passService.load();
    this.documentService.load(this.role(), user?.id);

    effect(() => {
      for (const document of this.documents()) {
        if (isImageFile(document.fileName)) {
          this.ensurePreview(document.id);
        }
      }
    });
  }

  ngOnDestroy(): void {
    for (const url of Object.values(this.previewUrls())) {
      URL.revokeObjectURL(url);
    }
  }

  getPassLabel(passId: string): string {
    const pass = this.passService.passes().find((item) => item.id === passId);
    return pass ? `${pass.vehiclePlate} · ${pass.type}` : '—';
  }

  getUserName(userId: string): string {
    return this.referenceData.getUserById(userId)?.fullName ?? '—';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  isImage(fileName: string): boolean {
    return isImageFile(fileName);
  }

  getPreviewUrl(documentId: string): string | null {
    return this.previewUrls()[documentId] ?? null;
  }

  openPreview(document: PassDocument): void {
    const cachedUrl = this.previewUrls()[document.id];
    if (cachedUrl) {
      this.dialog.open(DocumentPreviewDialogComponent, {
        data: { fileName: document.fileName, imageUrl: cachedUrl },
        maxWidth: '90vw',
      });
      return;
    }

    this.documentService.getDocumentBlobUrl(document.id).subscribe({
      next: (url) => {
        this.previewUrls.update((current) => ({ ...current, [document.id]: url }));
        this.dialog.open(DocumentPreviewDialogComponent, {
          data: { fileName: document.fileName, imageUrl: url },
          maxWidth: '90vw',
        });
      },
      error: () => {
        this.snackBar.open('Не удалось открыть изображение', 'OK', { duration: 3000 });
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const passId = this.uploadForm.controls.passId.value;
    const user = this.user();

    if (!file || !passId || !user) {
      return;
    }

    this.documentService.uploadDocument({
      passId,
      file,
    }).subscribe({
      next: () => {
        input.value = '';
        this.snackBar.open('Документ прикреплён', 'OK', { duration: 2500 });
      },
      error: () => {
        this.snackBar.open('Не удалось загрузить документ', 'OK', { duration: 3000 });
      },
    });
  }

  downloadDocument(documentId: string, fileName: string): void {
    this.documentService.downloadDocument(documentId, fileName).subscribe({
      error: () => {
        this.snackBar.open('Не удалось скачать файл', 'OK', { duration: 3000 });
      },
    });
  }

  canDelete(document: PassDocument): boolean {
    const role = this.role();
    if (role === 'Admin') {
      return true;
    }

    if (role !== 'Employee') {
      return false;
    }

    const userId = this.user()?.id;
    if (!userId) {
      return false;
    }

    const pass = this.passService.passes().find((item) => item.id === document.passId);
    return pass?.ownerUserId === userId;
  }

  deleteDocument(document: PassDocument): void {
    if (!confirm(`Удалить документ «${document.fileName}»?`)) {
      return;
    }

    this.documentService.deleteDocument(document.id).subscribe({
      next: () => {
        const previewUrl = this.previewUrls()[document.id];
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          this.previewUrls.update((current) => {
            const next = { ...current };
            delete next[document.id];
            return next;
          });
        }
        this.snackBar.open('Документ удалён', 'OK', { duration: 2500 });
      },
      error: () => {
        this.snackBar.open('Не удалось удалить документ', 'OK', { duration: 3000 });
      },
    });
  }

  cleanupFiles(): void {
    if (
      !confirm(
        'Удалить файлы без записи в системе и очистить записи документов, у которых нет файла на диске?',
      )
    ) {
      return;
    }

    this.documentService.cleanupFiles().subscribe({
      next: (result) => {
        const freed = this.formatFileSize(result.bytesFreed);
        this.snackBar.open(
          `Удалено файлов: ${result.orphanedFilesDeleted}, записей: ${result.missingFileRecordsDeleted}, освобождено: ${freed}`,
          'OK',
          { duration: 5000 },
        );
      },
      error: () => {
        this.snackBar.open('Не удалось выполнить очистку', 'OK', { duration: 3000 });
      },
    });
  }

  private ensurePreview(documentId: string): void {
    if (this.previewUrls()[documentId]) {
      return;
    }

    this.documentService.getDocumentBlobUrl(documentId).subscribe({
      next: (url) => {
        this.previewUrls.update((current) => ({ ...current, [documentId]: url }));
      },
    });
  }
}

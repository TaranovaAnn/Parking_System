import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { PassService } from '../../core/services/pass.service';
import { Pass, PassStatus, PassType } from '../../core/models/pass.model';
import { GuestPassRequest, GuestRequestStatus } from '../../core/models/guest-pass-request.model';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { PassCountdownComponent } from '../../shared/components/pass-countdown/pass-countdown.component';
import {
  PassStatusChipComponent,
  PassTypeChipComponent,
} from '../../shared/components/pass-status-chip/pass-status-chip.component';
import { GuestPassDialogComponent } from './guest-pass-dialog/guest-pass-dialog.component';
import { GuestPassRequestDialogComponent } from './guest-pass-request-dialog/guest-pass-request-dialog.component';
import { GuestPassReviewDialogComponent } from './guest-pass-review-dialog/guest-pass-review-dialog.component';
import { PermanentPassDialogComponent } from './permanent-pass-dialog/permanent-pass-dialog.component';
import { getHttpErrorMessage } from '../../core/utils/http-error.util';

@Component({
  selector: 'app-passes',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    PassCountdownComponent,
    PassStatusChipComponent,
    PassTypeChipComponent,
  ],
  templateUrl: './passes.component.html',
  styleUrl: './passes.component.scss',
})
export class PassesComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly passService = inject(PassService);
  private readonly referenceData = inject(ReferenceDataService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  readonly user = this.auth.currentUser;
  readonly role = this.auth.userRole;

  readonly canCreateGuest = computed(() => this.role() === 'Admin');
  readonly canSubmitGuestRequest = computed(() => this.role() === 'Employee');

  readonly canCreatePermanent = computed(() => this.role() === 'Admin');
  readonly canManageRequests = computed(() => {
    const role = this.role();
    return role === 'Admin' || role === 'Guard';
  });
  readonly canViewRequests = computed(() => {
    const role = this.role();
    return role === 'Admin' || role === 'Guard' || role === 'Employee';
  });
  readonly canBlock = computed(() => this.role() === 'Admin');

  readonly filters = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<PassType | 'All'>('All'),
    status: this.fb.nonNullable.control<PassStatus | 'All'>('All'),
    search: [''],
  });

  private readonly filterValues = signal(this.filters.getRawValue());

  readonly filteredPasses = computed(() => {
    this.passService.passes();
    const user = this.user();
    const visible = this.passService.getVisiblePasses(this.role(), user?.id);
    return this.passService.filterPasses(visible, this.filterValues());
  });

  readonly guestRequests = computed(() => {
    this.passService.guestRequests();
    const user = this.user();
    return this.passService.getVisibleGuestRequests(this.role(), user?.id);
  });

  readonly displayedColumns = computed(() => {
    const cols = ['plate', 'type', 'status', 'zone', 'period', 'countdown', 'owner'];
    if (this.canBlock()) {
      cols.push('actions');
    }
    return cols;
  });

  readonly guestRequestColumns = computed(() => {
    const cols = ['guestFullName', 'plate', 'zone', 'duration', 'status', 'createdAt', 'requestedBy'];
    if (this.canManageRequests()) {
      cols.push('requestActions');
    }
    return cols;
  });

  readonly passTypes: Array<PassType | 'All'> = ['All', 'Permanent', 'Temporary', 'Guest'];
  readonly passStatuses: Array<PassStatus | 'All'> = [
    'All',
    'Active',
    'Expired',
    'Blocked',
    'Draft',
  ];

  constructor() {
    this.filters.valueChanges.subscribe(() => {
      this.filterValues.set(this.filters.getRawValue());
    });
  }

  ngOnInit(): void {
    this.referenceData.loadAll();
    this.passService.load();
    this.passService.loadGuestRequests(this.role(), this.user()?.id);
  }

  typeLabel(type: PassType | 'All'): string {
    const map: Record<PassType | 'All', string> = {
      All: 'Все типы',
      Permanent: 'Постоянный',
      Temporary: 'Временный',
      Guest: 'Гостевой',
    };
    return map[type];
  }

  statusLabel(status: PassStatus | 'All'): string {
    const map: Record<PassStatus | 'All', string> = {
      All: 'Все статусы',
      Active: 'Активен',
      Expired: 'Истёк',
      Blocked: 'Заблокирован',
      Draft: 'Черновик',
    };
    return map[status];
  }

  getZoneName(zoneId?: string): string {
    if (!zoneId) {
      return '—';
    }
    return this.referenceData.getZoneById(zoneId)?.name ?? '—';
  }

  getOwnerName(ownerUserId: string): string {
    return this.referenceData.getUserById(ownerUserId)?.fullName ?? '—';
  }

  getRequesterName(userId: string): string {
    return this.referenceData.getUserById(userId)?.fullName ?? '—';
  }

  requestStatusLabel(status: GuestRequestStatus): string {
    const map: Record<GuestRequestStatus, string> = {
      Pending: 'На согласовании',
      Approved: 'Одобрена',
      Rejected: 'Отклонена',
    };
    return map[status];
  }

  openCreateDialog(): void {
    const user = this.user();
    if (!user) {
      return;
    }

    this.referenceData.loadZones();

    const ref = this.dialog.open(GuestPassDialogComponent, { width: '440px' });

    ref.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }

      this.passService
        .createGuestPassRequest({
          ...result,
          ownerUserId: user.id,
          createdByUserId: user.id,
        })
        .subscribe({
          next: () => {
            this.passService.load();
            this.snackBar.open('Гостевой пропуск создан', 'OK', { duration: 3000 });
          },
          error: (error) => {
            this.snackBar.open(
              getHttpErrorMessage(error, 'Не удалось создать пропуск. Проверьте данные и попробуйте снова.'),
              'OK',
              { duration: 4000 },
            );
          },
        });
    });
  }

  openGuestRequestDialog(): void {
    const ref = this.dialog.open(GuestPassRequestDialogComponent, { width: '440px' });

    ref.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }

      this.passService.submitGuestPassRequest(result).subscribe({
        next: () => {
          this.passService.loadGuestRequests(this.role(), this.user()?.id);
          this.snackBar.open('Гостевая заявка отправлена', 'OK', { duration: 3000 });
        },
        error: (error) => {
          this.snackBar.open(
            getHttpErrorMessage(error, 'Не удалось отправить заявку. Проверьте данные и попробуйте снова.'),
            'OK',
            { duration: 4000 },
          );
        },
      });
    });
  }

  openPermanentDialog(): void {
    const ref = this.dialog.open(PermanentPassDialogComponent, { width: '440px' });

    ref.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }

      this.passService.createPermanentPassRequest(result).subscribe({
        next: () => {
          this.passService.load();
          this.snackBar.open('Постоянный пропуск создан', 'OK', { duration: 3000 });
        },
        error: (error) => {
          this.snackBar.open(
            getHttpErrorMessage(error, 'Не удалось создать пропуск. Проверьте данные и попробуйте снова.'),
            'OK',
            { duration: 4000 },
          );
        },
      });
    });
  }

  blockPass(pass: Pass): void {
    if (pass.status === 'Blocked') {
      return;
    }

    this.passService.blockPassRequest(pass.id).subscribe(() => {
      this.snackBar.open(`Пропуск ${pass.vehiclePlate} заблокирован`, 'OK', { duration: 3000 });
    });
  }

  approveRequest(request: GuestPassRequest): void {
    const ref = this.dialog.open(GuestPassReviewDialogComponent, {
      width: '420px',
      data: { action: 'approve', plate: request.vehiclePlate },
    });

    ref.afterClosed().subscribe((review) => {
      if (!review) {
        return;
      }

      this.passService.approveGuestPassRequest(request.id, review).subscribe({
        next: () => {
          this.snackBar.open('Заявка одобрена, пропуск создан', 'OK', { duration: 3000 });
        },
        error: (error) => {
          this.snackBar.open(
            getHttpErrorMessage(error, 'Не удалось одобрить заявку.'),
            'OK',
            { duration: 4000 },
          );
        },
      });
    });
  }

  rejectRequest(request: GuestPassRequest): void {
    const ref = this.dialog.open(GuestPassReviewDialogComponent, {
      width: '420px',
      data: { action: 'reject', plate: request.vehiclePlate },
    });

    ref.afterClosed().subscribe((review) => {
      if (!review) {
        return;
      }

      this.passService.rejectGuestPassRequest(request.id, review).subscribe({
        next: () => {
          this.snackBar.open('Заявка отклонена', 'OK', { duration: 3000 });
        },
        error: (error) => {
          this.snackBar.open(
            getHttpErrorMessage(error, 'Не удалось отклонить заявку.'),
            'OK',
            { duration: 4000 },
          );
        },
      });
    });
  }

  onPassExpired(passId: string): void {
    this.passService.refreshStatuses();
    const pass = this.passService.passes().find((p) => p.id === passId);
    if (pass?.status === 'Expired') {
      this.snackBar.open(`Пропуск ${pass.vehiclePlate} истёк`, 'OK', { duration: 4000 });
    }
  }
}

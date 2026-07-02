import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { AuthService } from '../../core/services/auth.service';
import { AccessService, PassValidation } from '../../core/services/access.service';
import { ParkingHubService } from '../../core/services/parking-hub.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import {
  PassStatusChipComponent,
  PassTypeChipComponent,
} from '../../shared/components/pass-status-chip/pass-status-chip.component';
import {
  normalizePlate,
  PLATE_FORMAT_ERROR,
  PLATE_FORMAT_HINT,
  vehiclePlateValidator,
} from '../../core/utils/plate.util';

@Component({
  selector: 'app-access',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    PassStatusChipComponent,
    PassTypeChipComponent,
  ],
  templateUrl: './access.component.html',
  styleUrl: './access.component.scss',
})
export class AccessComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly accessService = inject(AccessService);
  private readonly hub = inject(ParkingHubService);
  private readonly referenceData = inject(ReferenceDataService);

  readonly user = this.auth.currentUser;
  readonly vehicleCount = this.hub.vehicleCount;
  readonly freeSpots = this.hub.freeSpots;
  readonly totalCapacity = this.hub.totalCapacity;

  readonly form = this.fb.nonNullable.group({
    vehiclePlate: ['', [Validators.required, vehiclePlateValidator()]],
  });

  readonly plateHint = PLATE_FORMAT_HINT;
  readonly plateFormatError = PLATE_FORMAT_ERROR;

  readonly validation = signal<PassValidation | null>(null);
  readonly lastMessage = signal<{ success: boolean; text: string } | null>(null);
  readonly processing = signal(false);

  checkPass(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const plate = normalizePlate(this.form.controls.vehiclePlate.value);
    this.accessService.validatePass(plate).subscribe((result) => {
      this.validation.set(result);
      this.lastMessage.set(null);
    });
  }

  registerEntry(): void {
    this.processAccess('entry');
  }

  registerExit(): void {
    this.processAccess('exit');
  }

  getZoneName(zoneId?: string): string {
    if (!zoneId) {
      return '—';
    }
    return this.referenceData.getZoneById(zoneId)?.name ?? '—';
  }

  isInside(): boolean {
    const plate = this.form.controls.vehiclePlate.value;
    if (!plate) {
      return false;
    }
    return this.hub.isVehicleInside(normalizePlate(plate));
  }

  private processAccess(type: 'entry' | 'exit'): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const operatorId = this.user()?.id;
    if (!operatorId) {
      return;
    }

    this.processing.set(true);
    const plate = normalizePlate(this.form.controls.vehiclePlate.value);

    const request =
      type === 'entry'
        ? this.accessService.registerEntry(plate, operatorId)
        : this.accessService.registerExit(plate, operatorId);

    request.subscribe({
      next: (result) => {
        this.lastMessage.set({ success: result.success, text: result.message });
        this.accessService.validatePass(plate).subscribe((validation) => {
          this.validation.set(validation);
          this.processing.set(false);
        });
      },
      error: () => {
        this.lastMessage.set({ success: false, text: 'Ошибка связи с сервером' });
        this.processing.set(false);
      },
    });
  }
}

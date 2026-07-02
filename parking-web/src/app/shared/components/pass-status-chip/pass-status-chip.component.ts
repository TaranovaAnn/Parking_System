import { Component, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { PassStatus, PassType } from '../../../core/models/pass.model';

@Component({
  selector: 'app-pass-status-chip',
  standalone: true,
  imports: [MatChipsModule],
  template: `<mat-chip [class]="chipClass()">{{ label() }}</mat-chip>`,
  styles: `
    mat-chip {
      font-size: 12px;
      min-height: 28px;
    }

    .status-active {
      --mdc-chip-label-text-color: #047857;
      background: #ecfdf5 !important;
    }

    .status-expired {
      --mdc-chip-label-text-color: #b45309;
      background: #fffbeb !important;
    }

    .status-blocked {
      --mdc-chip-label-text-color: #b91c1c;
      background: #fef2f2 !important;
    }

    .status-draft {
      --mdc-chip-label-text-color: #475569;
      background: #f1f5f9 !important;
    }
  `,
})
export class PassStatusChipComponent {
  readonly status = input.required<PassStatus>();

  label(): string {
    const map: Record<PassStatus, string> = {
      Active: 'Активен',
      Expired: 'Истёк',
      Blocked: 'Заблокирован',
      Draft: 'Черновик',
    };
    return map[this.status()];
  }

  chipClass(): string {
    return `status-${this.status().toLowerCase()}`;
  }
}

@Component({
  selector: 'app-pass-type-chip',
  standalone: true,
  imports: [MatChipsModule],
  template: `<mat-chip class="type-chip">{{ label() }}</mat-chip>`,
  styles: `
    .type-chip {
      --mdc-chip-label-text-color: #1e40af;
      background: #eff6ff !important;
      font-size: 12px;
      min-height: 28px;
    }
  `,
})
export class PassTypeChipComponent {
  readonly type = input.required<PassType>();

  label(): string {
    const map: Record<PassType, string> = {
      Permanent: 'Постоянный',
      Temporary: 'Временный',
      Guest: 'Гостевой',
    };
    return map[this.type()];
  }
}

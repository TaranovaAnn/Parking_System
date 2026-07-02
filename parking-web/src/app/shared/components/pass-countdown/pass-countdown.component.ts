import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { PassStatus } from '../../../core/models/pass.model';

@Component({
  selector: 'app-pass-countdown',
  standalone: true,
  template: `
    @if (showCountdown()) {
      <span class="countdown" [class.warning]="isWarning()" [class.expired]="isExpired()">
        {{ display() }}
      </span>
    } @else {
      <span class="muted">—</span>
    }
  `,
  styles: `
    .countdown {
      font-family: 'Roboto Mono', monospace;
      font-weight: 600;
      font-size: 13px;
      color: #0284c7;
    }

    .warning {
      color: #d97706;
    }

    .expired {
      color: #b91c1c;
    }

    .muted {
      color: #94a3b8;
    }
  `,
})
export class PassCountdownComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly validTo = input.required<string>();
  readonly status = input.required<PassStatus>();
  readonly type = input<string>('Guest');

  readonly expired = output<void>();

  readonly display = signal('00:00:00');
  readonly isWarning = signal(false);
  readonly isExpired = signal(false);

  private hasEmittedExpired = false;

  ngOnInit(): void {
    this.tick();
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.tick());
  }

  showCountdown(): boolean {
    return this.type() === 'Guest' && this.status() === 'Active';
  }

  private tick(): void {
    if (!this.showCountdown()) {
      return;
    }

    const remainingMs = new Date(this.validTo()).getTime() - Date.now();

    if (remainingMs <= 0) {
      this.display.set('00:00:00');
      this.isExpired.set(true);
      this.isWarning.set(false);
      if (!this.hasEmittedExpired) {
        this.hasEmittedExpired = true;
        this.expired.emit();
      }
      return;
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    this.display.set(
      `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
    );

    this.isWarning.set(remainingMs < 30 * 60 * 1000);
    this.isExpired.set(false);
  }
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

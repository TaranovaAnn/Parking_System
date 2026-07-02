import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { Pass, PassStatus, PassType } from '../models/pass.model';
import { GuestPassRequest } from '../models/guest-pass-request.model';
import { UserRole } from '../models/user.model';
import { API_BASE_URL } from '../config/api.config';
import { normalizePlate } from '../utils/plate.util';
import {
  CreateGuestPassRequest,
  CreateGuestPassRequestSubmission,
  CreatePermanentPassRequest,
  PassService,
  ReviewGuestPassRequest,
} from './pass.service';

@Injectable()
export class HttpPassService extends PassService {
  private readonly passesSignal = signal<Pass[]>([]);
  private readonly guestRequestsSignal = signal<GuestPassRequest[]>([]);
  private loaded = false;
  private guestRequestsLoaded = false;
  private guestRequestsLoading = false;

  readonly passes = this.passesSignal.asReadonly();
  readonly guestRequests = this.guestRequestsSignal.asReadonly();

  constructor(private readonly http: HttpClient) {
    super();
  }

  load(): void {
    this.http.get<Pass[]>(`${API_BASE_URL}/passes`).subscribe({
      next: (passes) => {
        this.loaded = true;
        this.passesSignal.set(sortPassesByNewest(passes));
      },
      error: () => {
        this.loaded = false;
        this.passesSignal.set([]);
      },
    });
  }

  loadGuestRequests(_role: UserRole | null, _userId: string | undefined): void {
    if (this.guestRequestsLoading || this.guestRequestsLoaded) {
      return;
    }

    this.guestRequestsLoading = true;
    this.http.get<GuestPassRequest[]>(`${API_BASE_URL}/guest-requests`).subscribe({
      next: (requests) => {
        this.guestRequestsLoading = false;
        this.guestRequestsLoaded = true;
        this.guestRequestsSignal.set(sortGuestRequestsByNewest(requests));
      },
      error: () => {
        this.guestRequestsLoading = false;
        this.guestRequestsLoaded = true;
        this.guestRequestsSignal.set([]);
      },
    });
  }

  getVisiblePasses(role: UserRole | null, userId: string | undefined): Pass[] {
    if (!this.loaded) {
      this.load();
    }

    const all = this.passesSignal();
    if (role === 'Admin' || role === 'Guard') {
      return all;
    }

    if (role === 'Employee' && userId) {
      return all.filter((pass) => pass.ownerUserId === userId);
    }

    return [];
  }

  getVisibleGuestRequests(role: UserRole | null, userId: string | undefined): GuestPassRequest[] {
    if (!this.guestRequestsLoaded) {
      this.loadGuestRequests(role, userId);
    }

    const all = this.guestRequestsSignal();
    if (role === 'Admin' || role === 'Guard') {
      return all;
    }

    if (role === 'Employee' && userId) {
      return all.filter((request) => request.requestedByUserId === userId);
    }

    return [];
  }

  createGuestPass(request: CreateGuestPassRequest): Pass {
    throw new Error('Use createGuestPassRequest() for async API call');
  }

  createGuestPassRequest(request: CreateGuestPassRequest) {
    const body = {
      vehiclePlate: request.vehiclePlate,
      zoneId: request.zoneId,
      durationHours: request.durationHours,
      notes: request.notes,
    };

    return this.http.post<Pass>(`${API_BASE_URL}/passes/guest`, body).pipe(
      tap((pass) =>
        this.passesSignal.update((passes) => sortPassesByNewest([pass, ...passes])),
      ),
    );
  }

  createPermanentPassRequest(request: CreatePermanentPassRequest) {
    const body = {
      vehiclePlate: request.vehiclePlate,
      zoneId: request.zoneId,
      ownerUserId: request.ownerUserId,
      validTo: request.validTo,
      notes: request.notes,
    };

    return this.http.post<Pass>(`${API_BASE_URL}/passes/permanent`, body).pipe(
      tap((pass) =>
        this.passesSignal.update((passes) => sortPassesByNewest([pass, ...passes])),
      ),
    );
  }

  submitGuestPassRequest(request: CreateGuestPassRequestSubmission) {
    const body = {
      vehiclePlate: request.vehiclePlate,
      zoneId: request.zoneId,
      durationHours: request.durationHours,
      guestFullName: request.guestFullName,
      notes: request.notes,
    };

    return this.http.post<GuestPassRequest>(`${API_BASE_URL}/guest-requests`, body).pipe(
      tap((guestRequest) => {
        this.guestRequestsLoaded = true;
        this.guestRequestsSignal.update((requests) =>
          sortGuestRequestsByNewest([guestRequest, ...requests]),
        );
      }),
    );
  }

  approveGuestPassRequest(requestId: string, review: ReviewGuestPassRequest) {
    return this.http
      .post<GuestPassRequest>(`${API_BASE_URL}/guest-requests/${requestId}/approve`, review)
      .pipe(
        tap((updatedRequest) => {
          this.guestRequestsSignal.update((requests) =>
            requests.map((request) => (request.id === updatedRequest.id ? updatedRequest : request)),
          );
          this.load();
        }),
      );
  }

  rejectGuestPassRequest(requestId: string, review: ReviewGuestPassRequest) {
    return this.http
      .post<GuestPassRequest>(`${API_BASE_URL}/guest-requests/${requestId}/reject`, review)
      .pipe(
        tap((updatedRequest) =>
          this.guestRequestsSignal.update((requests) =>
            requests.map((request) => (request.id === updatedRequest.id ? updatedRequest : request)),
          ),
        ),
      );
  }

  blockPass(passId: string): void {
    throw new Error('Use blockPassRequest() for async API call');
  }

  blockPassRequest(passId: string) {
    return this.http.post<Pass>(`${API_BASE_URL}/passes/${passId}/block`, {}).pipe(
      tap((updated) =>
        this.passesSignal.update((passes) =>
          passes.map((pass) => (pass.id === updated.id ? updated : pass)),
        ),
      ),
    );
  }

  refreshStatuses(): void {
    this.load();
  }

  findByPlate(plate: string): Pass | undefined {
    const normalized = normalizePlate(plate);
    return this.passesSignal().find((pass) => normalizePlate(pass.vehiclePlate) === normalized);
  }

  filterPasses(
    passes: Pass[],
    filters: { type: PassType | 'All'; status: PassStatus | 'All'; search: string },
  ): Pass[] {
    const search = filters.search.trim().toLowerCase();

    return passes.filter((pass) => {
      if (filters.type !== 'All' && pass.type !== filters.type) {
        return false;
      }
      if (filters.status !== 'All' && pass.status !== filters.status) {
        return false;
      }
      if (search && !pass.vehiclePlate.toLowerCase().includes(search)) {
        return false;
      }
      return true;
    });
  }
}

function sortPassesByNewest(passes: Pass[]): Pass[] {
  return [...passes].sort((left, right) => {
    const fromDiff = new Date(right.validFrom).getTime() - new Date(left.validFrom).getTime();
    if (fromDiff !== 0) {
      return fromDiff;
    }

    return new Date(right.validTo).getTime() - new Date(left.validTo).getTime();
  });
}

function sortGuestRequestsByNewest(requests: GuestPassRequest[]): GuestPassRequest[] {
  return [...requests].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

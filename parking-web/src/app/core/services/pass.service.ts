import { Signal } from '@angular/core';
import { Observable } from 'rxjs';
import { Pass, PassStatus, PassType } from '../models/pass.model';
import { GuestPassRequest } from '../models/guest-pass-request.model';
import { UserRole } from '../models/user.model';

export interface CreateGuestPassRequest {
  vehiclePlate: string;
  zoneId: string;
  durationHours: number;
  notes?: string;
  ownerUserId: string;
  createdByUserId: string;
}

export interface CreatePermanentPassRequest {
  vehiclePlate: string;
  zoneId: string;
  ownerUserId: string;
  validTo: string;
  notes?: string;
}

export interface CreateGuestPassRequestSubmission {
  vehiclePlate: string;
  zoneId: string;
  durationHours: number;
  guestFullName?: string;
  notes?: string;
}

export interface ReviewGuestPassRequest {
  reviewComment?: string;
}

export abstract class PassService {
  abstract readonly passes: Signal<Pass[]>;
  abstract readonly guestRequests: Signal<GuestPassRequest[]>;

  abstract getVisiblePasses(role: UserRole | null, userId: string | undefined): Pass[];
  abstract getVisibleGuestRequests(role: UserRole | null, userId: string | undefined): GuestPassRequest[];
  abstract load(): void;
  abstract loadGuestRequests(role: UserRole | null, userId: string | undefined): void;
  abstract createGuestPass(request: CreateGuestPassRequest): Pass;
  abstract createGuestPassRequest(request: CreateGuestPassRequest): Observable<Pass>;
  abstract createPermanentPassRequest(request: CreatePermanentPassRequest): Observable<Pass>;
  abstract submitGuestPassRequest(request: CreateGuestPassRequestSubmission): Observable<GuestPassRequest>;
  abstract approveGuestPassRequest(
    requestId: string,
    review: ReviewGuestPassRequest,
  ): Observable<GuestPassRequest>;
  abstract rejectGuestPassRequest(
    requestId: string,
    review: ReviewGuestPassRequest,
  ): Observable<GuestPassRequest>;
  abstract blockPass(passId: string): void;
  abstract blockPassRequest(passId: string): Observable<Pass>;
  abstract refreshStatuses(): void;
  abstract findByPlate(plate: string): Pass | undefined;
  abstract filterPasses(
    passes: Pass[],
    filters: { type: PassType | 'All'; status: PassStatus | 'All'; search: string },
  ): Pass[];
}

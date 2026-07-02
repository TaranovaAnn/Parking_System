import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AccessEvent } from '../models/access-event.model';
import { Pass } from '../models/pass.model';
import { API_BASE_URL } from '../config/api.config';
import { normalizePlate } from '../utils/plate.util';

export interface PassValidation {
  found: boolean;
  pass: Pass | null;
  error?: string;
}

export interface AccessResult {
  success: boolean;
  message: string;
  event: AccessEvent;
}

@Injectable({ providedIn: 'root' })
export class AccessService {
  constructor(private readonly http: HttpClient) {}

  validatePass(plate: string): Observable<PassValidation> {
    return this.http.get<PassValidation>(
      `${API_BASE_URL}/access/validate/${encodeURIComponent(normalizePlate(plate))}`,
    );
  }

  registerEntry(plate: string, _operatorUserId: string): Observable<AccessResult> {
    return this.http.post<AccessResult>(`${API_BASE_URL}/access/entry`, {
      vehiclePlate: normalizePlate(plate),
    });
  }

  registerExit(plate: string, _operatorUserId: string): Observable<AccessResult> {
    return this.http.post<AccessResult>(`${API_BASE_URL}/access/exit`, {
      vehiclePlate: normalizePlate(plate),
    });
  }
}

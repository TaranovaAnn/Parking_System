import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ParkingZone } from '../models/zone.model';
import { User } from '../models/user.model';
import { API_BASE_URL } from '../config/api.config';

@Injectable({ providedIn: 'root' })
export class ReferenceDataService {
  private readonly usersSignal = signal<User[]>([]);
  private readonly zonesSignal = signal<ParkingZone[]>([]);
  private readonly zonesLoadedSignal = signal(false);
  private readonly zonesLoadingSignal = signal(false);

  readonly users = this.usersSignal.asReadonly();
  readonly zones = this.zonesSignal.asReadonly();
  readonly zonesLoaded = this.zonesLoadedSignal.asReadonly();
  readonly zonesLoading = this.zonesLoadingSignal.asReadonly();

  constructor(private readonly http: HttpClient) {}

  loadAll(): void {
    this.loadUsers();
    this.loadZones();
  }

  loadUsers(attempt = 0): void {
    this.http.get<User[]>(`${API_BASE_URL}/lookups/users`).subscribe({
      next: (users) => this.usersSignal.set(users),
      error: () => {
        if (attempt < 3) {
          window.setTimeout(() => this.loadUsers(attempt + 1), 1000 * (attempt + 1));
          return;
        }
        this.usersSignal.set([]);
      },
    });
  }

  setUsers(users: User[]): void {
    this.usersSignal.set(users);
  }

  loadZones(attempt = 0): void {
    if (this.zonesLoadingSignal()) {
      return;
    }

    this.zonesLoadingSignal.set(true);

    this.http.get<ParkingZone[]>(`${API_BASE_URL}/lookups/zones`).subscribe({
      next: (zones) => {
        this.zonesSignal.set(zones);
        this.zonesLoadedSignal.set(true);
        this.zonesLoadingSignal.set(false);
      },
      error: () => {
        if (attempt < 3) {
          window.setTimeout(() => {
            this.zonesLoadingSignal.set(false);
            this.loadZones(attempt + 1);
          }, 1000 * (attempt + 1));
          return;
        }

        this.zonesSignal.set([]);
        this.zonesLoadedSignal.set(true);
        this.zonesLoadingSignal.set(false);
      },
    });
  }

  getUserById(id: string): User | undefined {
    return this.usersSignal().find((user) => user.id === id);
  }

  getZoneById(id: string): ParkingZone | undefined {
    return this.zonesSignal().find((zone) => zone.id === id);
  }
}

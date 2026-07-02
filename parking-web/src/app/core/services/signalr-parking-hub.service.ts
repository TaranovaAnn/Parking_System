import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { AccessEvent } from '../models/access-event.model';
import { API_BASE_URL, HUB_URL } from '../config/api.config';
import { normalizePlate } from '../utils/plate.util';
import { AuthService } from './auth.service';
import { ParkingHubService, HubConnectionState } from './parking-hub.service';

interface DashboardSummary {
  vehiclesInside: number;
  freeSpots: number;
  totalCapacity: number;
  todayEvents: number;
}

@Injectable()
export class SignalrParkingHubService extends ParkingHubService {
  private connection: signalR.HubConnection | null = null;
  private connectPromise: Promise<void> | null = null;

  private readonly eventsSignal = signal<AccessEvent[]>([]);
  private readonly summarySignal = signal<DashboardSummary>({
    vehiclesInside: 0,
    freeSpots: 0,
    totalCapacity: 0,
    todayEvents: 0,
  });

  readonly connectionState = signal<HubConnectionState>('idle');
  readonly isConnected = computed(() => this.connectionState() === 'connected');
  readonly events = this.eventsSignal.asReadonly();
  readonly vehicleCount = computed(() => this.summarySignal().vehiclesInside);
  readonly freeSpots = computed(() => this.summarySignal().freeSpots);
  readonly totalCapacity = computed(() => this.summarySignal().totalCapacity);
  readonly todayEventCount = computed(() => this.summarySignal().todayEvents);
  readonly recentEvents = computed(() => this.eventsSignal().slice(0, 15));

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
  ) {
    super();
  }

  async connect(): Promise<void> {
    if (this.connectionState() === 'connected' || this.connectPromise) {
      return this.connectPromise ?? Promise.resolve();
    }

    const role = this.auth.userRole();
    if (role !== 'Admin' && role !== 'Guard') {
      return;
    }

    this.connectPromise = this.startConnection();
    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
    this.connectionState.set('idle');
  }

  addAccessEvent(_event: Omit<AccessEvent, 'id'>): AccessEvent {
    throw new Error('Client should not add events directly when using API');
  }

  isVehicleInside(vehiclePlate: string): boolean {
    const normalized = normalizePlate(vehiclePlate);
    const latest = this.eventsSignal().find(
      (event) => normalizePlate(event.vehiclePlate) === normalized && event.success,
    );
    return latest?.direction === 'Entry';
  }

  private async startConnection(): Promise<void> {
    this.connectionState.set('connecting');
    this.loadInitialData();

    const token = this.auth.getToken();
    if (!token) {
      this.connectionState.set('offline');
      return;
    }

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => this.auth.getToken() ?? '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .build();

    this.connection.on('VehicleCountChanged', (count: number) => {
      this.summarySignal.update((summary) => ({
        ...summary,
        vehiclesInside: count,
        freeSpots: Math.max(0, summary.totalCapacity - count),
      }));
    });

    this.connection.on('AccessEvent', (event: AccessEvent) => {
      this.eventsSignal.update((events) =>
        [event, ...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      );
      this.summarySignal.update((summary) => ({
        ...summary,
        todayEvents: summary.todayEvents + 1,
      }));
    });

    this.connection.onreconnected(() => {
      this.connectionState.set('connected');
      this.loadInitialData();
    });

    this.connection.onclose(() => {
      if (this.connectionState() !== 'idle') {
        this.connectionState.set('offline');
      }
    });

    try {
      await this.connection.start();
      this.connectionState.set('connected');
    } catch {
      this.connectionState.set('offline');
    }
  }

  private loadInitialData(): void {
    this.http.get<DashboardSummary>(`${API_BASE_URL}/dashboard/summary`).subscribe({
      next: (summary) => this.summarySignal.set(summary),
    });

    this.http.get<AccessEvent[]>(`${API_BASE_URL}/access-events`).subscribe({
      next: (events) =>
        this.eventsSignal.set(
          [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
        ),
    });
  }
}

import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { ParkingHubService } from './core/services/parking-hub.service';
import { SignalrParkingHubService } from './core/services/signalr-parking-hub.service';
import { PassService } from './core/services/pass.service';
import { HttpPassService } from './core/services/http-pass.service';
import { ZoneService } from './core/services/zone.service';
import { HttpZoneService } from './core/services/http-zone.service';
import { DocumentService } from './core/services/document.service';
import { HttpDocumentService } from './core/services/http-document.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    { provide: ParkingHubService, useClass: SignalrParkingHubService },
    HttpPassService,
    { provide: PassService, useExisting: HttpPassService },
    HttpZoneService,
    { provide: ZoneService, useExisting: HttpZoneService },
    HttpDocumentService,
    { provide: DocumentService, useExisting: HttpDocumentService },
  ],
};

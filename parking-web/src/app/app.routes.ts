import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';
import { ShellComponent } from './layout/shell/shell.component';
import { LoginComponent } from './features/auth/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { PassesComponent } from './features/passes/passes.component';
import { AccessComponent } from './features/access/access.component';
import { AccessLogComponent } from './features/access-log/access-log.component';
import { ZonesComponent } from './features/zones/zones.component';
import { UsersComponent } from './features/users/users.component';
import { DocumentsComponent } from './features/documents/documents.component';
import { ReportsComponent } from './features/reports/reports.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        component: DashboardComponent,
        canActivate: [roleGuard(['Admin', 'Guard'])],
      },
      {
        path: 'passes',
        component: PassesComponent,
      },
      {
        path: 'access',
        component: AccessComponent,
        canActivate: [roleGuard(['Admin', 'Guard'])],
      },
      {
        path: 'access-log',
        component: AccessLogComponent,
        canActivate: [roleGuard(['Admin', 'Guard'])],
      },
      {
        path: 'zones',
        component: ZonesComponent,
        canActivate: [roleGuard(['Admin'])],
      },
      {
        path: 'users',
        component: UsersComponent,
        canActivate: [roleGuard(['Admin'])],
      },
      {
        path: 'documents',
        component: DocumentsComponent,
        canActivate: [roleGuard(['Admin', 'Employee'])],
      },
      {
        path: 'reports',
        component: ReportsComponent,
        canActivate: [roleGuard(['Admin'])],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

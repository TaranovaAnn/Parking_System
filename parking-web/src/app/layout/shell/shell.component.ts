import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ParkingHubService } from '../../core/services/parking-hub.service';
import { PassService } from '../../core/services/pass.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ZoneService } from '../../core/services/zone.service';
import { UserRole } from '../../core/models/user.model';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  roles: UserRole[];
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly hub = inject(ParkingHubService);
  private readonly passService = inject(PassService);
  private readonly zoneService = inject(ZoneService);
  private readonly referenceData = inject(ReferenceDataService);

  readonly user = this.auth.currentUser;

  readonly navItems: NavItem[] = [
    { label: 'Дашборд', route: '/dashboard', icon: 'dashboard', roles: ['Admin', 'Guard'] },
    { label: 'Пропуска', route: '/passes', icon: 'badge', roles: ['Admin', 'Guard', 'Employee'] },
    { label: 'Въезд / Выезд', route: '/access', icon: 'garage', roles: ['Admin', 'Guard'] },
    { label: 'Журнал', route: '/access-log', icon: 'history', roles: ['Admin', 'Guard'] },
    { label: 'Зоны', route: '/zones', icon: 'local_parking', roles: ['Admin'] },
    { label: 'Пользователи', route: '/users', icon: 'people', roles: ['Admin'] },
    { label: 'Документы', route: '/documents', icon: 'attach_file', roles: ['Admin', 'Employee'] },
    { label: 'Отчёты', route: '/reports', icon: 'assessment', roles: ['Admin'] },
  ];

  readonly visibleNavItems = computed(() => {
    const role = this.auth.userRole();
    if (!role) {
      return [];
    }
    return this.navItems.filter((item) => item.roles.includes(role));
  });

  readonly roleLabel = computed(() => {
    const role = this.auth.userRole();
    switch (role) {
      case 'Admin':
        return 'Администратор';
      case 'Guard':
        return 'Охранник';
      case 'Employee':
        return 'Сотрудник';
      default:
        return '';
    }
  });

  ngOnInit(): void {
    this.referenceData.loadAll();
    this.passService.load();
    this.zoneService.load();

    window.setTimeout(() => {
      void this.hub.connect();
    }, 0);
  }

  ngOnDestroy(): void {
    void this.hub.disconnect();
  }

  logout(): void {
    this.auth.logout();
  }
}

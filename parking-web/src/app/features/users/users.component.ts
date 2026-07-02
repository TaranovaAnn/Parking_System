import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { API_BASE_URL } from '../../core/config/api.config';
import { CreateUserRequest, User, UserRole } from '../../core/models/user.model';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { getHttpErrorMessage } from '../../core/utils/http-error.util';
import { UserCreateDialogComponent } from './user-create-dialog/user-create-dialog.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatTableModule,
    MatChipsModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent {
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly referenceData = inject(ReferenceDataService);

  readonly users = this.referenceData.users;
  readonly displayedColumns = ['fullName', 'username', 'email', 'role'];

  constructor() {
    this.loadUsers();
  }

  roleLabel(role: UserRole): string {
    const map: Record<UserRole, string> = {
      Admin: 'Администратор',
      Guard: 'Охранник',
      Employee: 'Сотрудник',
    };
    return map[role];
  }

  roleClass(role: UserRole): string {
    return `role-${role.toLowerCase()}`;
  }

  roleIcon(role: UserRole): string {
    const map: Record<UserRole, string> = {
      Admin: 'admin_panel_settings',
      Guard: 'security',
      Employee: 'badge',
    };
    return map[role];
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(UserCreateDialogComponent, { width: '460px' });

    ref.afterClosed().subscribe((result: CreateUserRequest | undefined) => {
      if (!result) {
        return;
      }

      this.http.post<User>(`${API_BASE_URL}/users`, result).subscribe({
        next: () => {
          this.loadUsers();
          this.snackBar.open('Пользователь создан', 'OK', { duration: 3000 });
        },
        error: (error) => {
          this.snackBar.open(getHttpErrorMessage(error, 'Не удалось создать пользователя'), 'OK', {
            duration: 4000,
          });
        },
      });
    });
  }

  private loadUsers(): void {
    this.http.get<User[]>(`${API_BASE_URL}/users`).subscribe({
      next: (users) => this.referenceData.setUsers(users),
      error: () => this.referenceData.setUsers([]),
    });
  }
}

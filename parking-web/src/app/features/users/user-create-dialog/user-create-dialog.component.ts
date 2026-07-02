import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CreateUserRequest, UserRole } from '../../../core/models/user.model';

@Component({
  selector: 'app-user-create-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>Новый пользователь</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>ФИО</mat-label>
          <input matInput formControlName="fullName" />
          @if (form.controls.fullName.touched && form.controls.fullName.hasError('required')) {
            <mat-error>Укажите ФИО</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Логин</mat-label>
          <input matInput formControlName="username" autocomplete="off" />
          @if (form.controls.username.touched && form.controls.username.hasError('required')) {
            <mat-error>Укажите логин</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" />
          @if (form.controls.email.touched && form.controls.email.hasError('required')) {
            <mat-error>Укажите email</mat-error>
          }
          @if (form.controls.email.touched && form.controls.email.hasError('email')) {
            <mat-error>Некорректный email</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Роль</mat-label>
          <mat-select formControlName="role">
            @for (role of roles; track role.value) {
              <mat-option [value]="role.value">{{ role.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Пароль</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="new-password" />
          @if (form.controls.password.touched && form.controls.password.hasError('required')) {
            <mat-error>Укажите пароль</mat-error>
          }
          @if (form.controls.password.touched && form.controls.password.hasError('minlength')) {
            <mat-error>Минимум 6 символов</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Отмена</button>
      <button mat-flat-button color="primary" type="button" (click)="submit()">Создать</button>
    </mat-dialog-actions>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 380px;
      padding-top: 8px;
    }

    .full-width {
      width: 100%;
    }
  `,
})
export class UserCreateDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly dialogRef = inject(MatDialogRef<UserCreateDialogComponent>);

  readonly roles: Array<{ value: UserRole; label: string }> = [
    { value: 'Admin', label: 'Администратор' },
    { value: 'Guard', label: 'Охранник' },
    { value: 'Employee', label: 'Сотрудник' },
  ];

  readonly form = this.fb.nonNullable.group({
    fullName: ['', Validators.required],
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    role: this.fb.nonNullable.control<UserRole>('Guard', Validators.required),
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const result: CreateUserRequest = {
      fullName: value.fullName.trim(),
      username: value.username.trim(),
      email: value.email.trim(),
      role: value.role,
      password: value.password,
    };

    this.dialogRef.close(result);
  }
}

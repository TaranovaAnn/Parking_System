import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

function getDefaultRouteForRole(role: UserRole | null): string[] {
  if (role === 'Employee') {
    return ['/passes'];
  }
  return ['/dashboard'];
}

export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }

    if (auth.hasAnyRole(allowedRoles)) {
      return true;
    }

    return router.createUrlTree(getDefaultRouteForRole(auth.userRole()));
  };
};

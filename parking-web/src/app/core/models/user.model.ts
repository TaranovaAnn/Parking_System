export type UserRole = 'Admin' | 'Guard' | 'Employee';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface CreateUserRequest {
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  password: string;
}

import type { User } from '../types';
import { api } from './api';

export const authService = {
  login: (email: string, password: string) => api.post<{ token: string; user: User }>('/auth/login', { email, password }).then((r) => r.data),
  register: (body: { name: string; email: string; password: string; phone?: string }) =>
    api.post<{ token: string; user: User }>('/auth/register', body).then((r) => r.data),
  me: () => api.get<{ user: User }>('/auth/me').then((r) => r.data.user),
  update: (body: Partial<User>) => api.patch<{ user: User }>('/auth/me', body).then((r) => r.data.user),
  changePassword: (currentPassword: string, newPassword: string) => api.post('/auth/change-password', { currentPassword, newPassword }),
};

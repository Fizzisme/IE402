import { apiClient } from './api-client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthResult {
  accessToken: string;
  user: AuthUser;
}

function parseAuthResponse(data: any): AuthResult {
  const d = data?.data ?? {};
  return {
    accessToken: String(d.access_token ?? ''),
    user: {
      id: String(d.user?.id ?? ''),
      name: String(d.user?.name ?? ''),
      email: String(d.user?.email ?? ''),
      role: String(d.user?.role ?? 'user'),
    },
  };
}

export async function loginRequest(p: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const res = await apiClient.post('/auth/login', {
    email: p.email,
    password: p.password,
  });
  return parseAuthResponse(res.data);
}

export async function registerRequest(p: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<AuthResult> {
  const res = await apiClient.post('/auth/register', {
    name: p.name,
    email: p.email,
    password: p.password,
    ...(p.phone ? { phone: p.phone } : {}),
  });
  return parseAuthResponse(res.data);
}

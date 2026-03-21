export type AuthUser = {
  id: string;
  email: string;
  username: string;
  nombre: string;
  activo: boolean;
  roles: string[];
  permisos: string[];
};

export type LoginResponse = {
  ok: boolean;
  token?: string;
  data?: AuthUser;
  error?: string;
};

const TOKEN_KEY = "erp_token";
const USER_KEY = "erp_user";

export function getApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}

export function saveToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

export function saveUser(user: AuthUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getSavedUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearUser() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_KEY);
}

export function clearSession() {
  clearToken();
  clearUser();
}

export async function readJsonSafe(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || "Respuesta no válida del servidor");
  }
}

export async function loginRequest(login: string, password: string) {
  const res = await fetch(`${getApiUrl()}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ login, password }),
  });

  const data = (await readJsonSafe(res)) as LoginResponse;

  if (!res.ok || !data.ok || !data.token || !data.data) {
    throw new Error(data.error || "No se pudo iniciar sesión");
  }

  saveToken(data.token);
  saveUser(data.data);

  return data;
}

export async function meRequest(token?: string) {
  const authToken = token || getToken();

  const res = await fetch(`${getApiUrl()}/auth/me`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  const data = await readJsonSafe(res);

  if (!res.ok || !data.ok) {
    throw new Error(data.error || "No se pudo obtener la sesión");
  }

  saveUser(data.data);
  return data.data as AuthUser;
}

export function hasPermission(
  user: AuthUser | null,
  ...permissions: string[]
) {
  if (!user) return false;
  return permissions.some((p) => user.permisos?.includes(p));
}
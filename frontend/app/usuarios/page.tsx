"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getApiUrl, getToken, readJsonSafe } from "../../lib/auth-client";
import { useAuth } from "../components/auth/AuthProvider";

type Rol = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  activo?: boolean;
  rolPermisos?: { permiso: Permiso }[];
};

type Permiso = {
  id: string;
  codigo: string;
  nombre: string;
  modulo: string;
};

type Usuario = {
  id: string;
  email: string;
  username: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
  ultimoLogin?: string | null;
  usuarioRoles: { rol: Rol }[];
  usuarioPermisos: { permiso: Permiso }[];
};

type TabKey = "usuarios" | "roles" | "permisos";

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

function formatDateTime(v?: string | null) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("es-PE");
  } catch {
    return v;
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function SeguridadAccesosPage() {
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>("usuarios");

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [loading, setLoading] = useState(true);

  const [qUsuarios, setQUsuarios] = useState("");
  const [qRoles, setQRoles] = useState("");
  const [qPermisos, setQPermisos] = useState("");

  const [modalUsuarioOpen, setModalUsuarioOpen] = useState(false);
  const [modalRolOpen, setModalRolOpen] = useState(false);

  const [usuarioActivo, setUsuarioActivo] = useState<Usuario | null>(null);
  const [rolActivo, setRolActivo] = useState<Rol | null>(null);

  const [guardando, setGuardando] = useState(false);

  const [uEmail, setUEmail] = useState("");
  const [uUsername, setUUsername] = useState("");
  const [uNombre, setUNombre] = useState("");
  const [uPassword, setUPassword] = useState("");
  const [uActivo, setUActivo] = useState(true);
  const [uRoles, setURoles] = useState<string[]>([]);
  const [uPermisos, setUPermisos] = useState<string[]>([]);

  const [rCodigo, setRCodigo] = useState("");
  const [rNombre, setRNombre] = useState("");
  const [rDescripcion, setRDescripcion] = useState("");
  const [rPermisos, setRPermisos] = useState<string[]>([]);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "usuarios" || t === "roles" || t === "permisos") {
      setTab(t);
    }
  }, [searchParams]);

  function changeTab(next: TabKey) {
    setTab(next);
    router.replace(`/usuarios?tab=${next}`);
  }

  async function cargarTodo() {
    try {
      setLoading(true);

      const requests: Promise<Response>[] = [];
      const mapIndex: Record<string, number> = {};

      if (can("usuarios.ver")) {
        mapIndex.usuarios = requests.length;
        requests.push(fetch(`${getApiUrl()}/usuarios`, { headers: authHeaders() }));
      }

      if (can("usuarios.roles")) {
        mapIndex.roles = requests.length;
        requests.push(fetch(`${getApiUrl()}/roles`, { headers: authHeaders() }));
      }

      if (can("usuarios.permisos", "usuarios.roles")) {
        mapIndex.permisos = requests.length;
        requests.push(fetch(`${getApiUrl()}/permisos`, { headers: authHeaders() }));
      }

      const responses = await Promise.all(requests);

      if (mapIndex.usuarios !== undefined) {
        const res = responses[mapIndex.usuarios];
        const data = await readJsonSafe(res);
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Error cargando usuarios");
        }
        setUsuarios(data.data || []);
      }

      if (mapIndex.roles !== undefined) {
        const res = responses[mapIndex.roles];
        const data = await readJsonSafe(res);
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Error cargando roles");
        }
        setRoles(data.data || []);
      }

      if (mapIndex.permisos !== undefined) {
        const res = responses[mapIndex.permisos];
        const data = await readJsonSafe(res);
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Error cargando permisos");
        }
        setPermisos(data.data || []);
      }
    } catch (error: unknown) {
      alert(getErrorMessage(error, "No se pudo cargar Seguridad y Accesos"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const permisosPorModulo = useMemo(() => {
    const grouped = new Map<string, Permiso[]>();

    for (const p of permisos) {
      if (!grouped.has(p.modulo)) grouped.set(p.modulo, []);
      grouped.get(p.modulo)?.push(p);
    }

    return Array.from(grouped.entries())
      .map(([modulo, items]) => [
        modulo,
        [...items].sort((a, b) => a.codigo.localeCompare(b.codigo)),
      ] as const)
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [permisos]);

  const usuariosFiltrados = useMemo(() => {
    const t = qUsuarios.trim().toLowerCase();
    if (!t) return usuarios;

    return usuarios.filter((u) => {
      const rolesText = (u.usuarioRoles || [])
        .map((x) => `${x.rol?.codigo || ""} ${x.rol?.nombre || ""}`)
        .join(" ")
        .toLowerCase();

      return (
        u.nombre.toLowerCase().includes(t) ||
        u.username.toLowerCase().includes(t) ||
        u.email.toLowerCase().includes(t) ||
        rolesText.includes(t)
      );
    });
  }, [usuarios, qUsuarios]);

  const rolesFiltrados = useMemo(() => {
    const t = qRoles.trim().toLowerCase();
    if (!t) return roles;

    return roles.filter((r) => {
      const permsText = (r.rolPermisos || [])
        .map((x) => x.permiso?.codigo || "")
        .join(" ")
        .toLowerCase();

      return (
        r.codigo.toLowerCase().includes(t) ||
        r.nombre.toLowerCase().includes(t) ||
        String(r.descripcion || "").toLowerCase().includes(t) ||
        permsText.includes(t)
      );
    });
  }, [roles, qRoles]);

  const permisosFiltrados = useMemo(() => {
    const t = qPermisos.trim().toLowerCase();
    if (!t) return permisos;

    return permisos.filter((p) => {
      return (
        p.modulo.toLowerCase().includes(t) ||
        p.codigo.toLowerCase().includes(t) ||
        p.nombre.toLowerCase().includes(t)
      );
    });
  }, [permisos, qPermisos]);

  function resetUsuarioForm() {
    setUsuarioActivo(null);
    setUEmail("");
    setUUsername("");
    setUNombre("");
    setUPassword("");
    setUActivo(true);
    setURoles([]);
    setUPermisos([]);
  }

  function abrirNuevoUsuario() {
    resetUsuarioForm();
    setModalUsuarioOpen(true);
  }

  function abrirEditarUsuario(usuario: Usuario) {
    setUsuarioActivo(usuario);
    setUEmail(usuario.email);
    setUUsername(usuario.username);
    setUNombre(usuario.nombre);
    setUPassword("");
    setUActivo(usuario.activo);
    setURoles((usuario.usuarioRoles || []).map((x) => x.rol.id));
    setUPermisos((usuario.usuarioPermisos || []).map((x) => x.permiso.id));
    setModalUsuarioOpen(true);
  }

  async function guardarUsuario() {
    try {
      setGuardando(true);

      const isEdit = !!usuarioActivo;

      const res = await fetch(
        `${getApiUrl()}/usuarios${isEdit ? `/${usuarioActivo!.id}` : ""}`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            email: uEmail,
            username: uUsername,
            nombre: uNombre,
            password: uPassword,
            activo: uActivo,
          }),
        }
      );

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo guardar el usuario");
      }

      const userId = isEdit ? usuarioActivo!.id : data.data.id;

      const rolesRes = await fetch(`${getApiUrl()}/usuarios/${userId}/roles`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ roles: uRoles }),
      });

      const rolesData = await readJsonSafe(rolesRes);
      if (!rolesRes.ok || !rolesData.ok) {
        throw new Error(rolesData.error || "No se pudieron guardar los roles");
      }

      const permsRes = await fetch(
        `${getApiUrl()}/usuarios/${userId}/permisos`,
        {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({ permisos: uPermisos }),
        }
      );

      const permsData = await readJsonSafe(permsRes);
      if (!permsRes.ok || !permsData.ok) {
        throw new Error(
          permsData.error || "No se pudieron guardar los permisos"
        );
      }

      if (isEdit && uPassword.trim()) {
        const passRes = await fetch(
          `${getApiUrl()}/usuarios/${userId}/password`,
          {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify({ password: uPassword }),
          }
        );

        const passData = await readJsonSafe(passRes);
        if (!passRes.ok || !passData.ok) {
          throw new Error(
            passData.error || "No se pudo actualizar la contraseña"
          );
        }
      }

      await cargarTodo();
      setModalUsuarioOpen(false);
      resetUsuarioForm();
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Error guardando usuario"));
    } finally {
      setGuardando(false);
    }
  }

  function resetRolForm() {
    setRolActivo(null);
    setRCodigo("");
    setRNombre("");
    setRDescripcion("");
    setRPermisos([]);
  }

  function abrirNuevoRol() {
    resetRolForm();
    setModalRolOpen(true);
  }

  function abrirEditarRol(rol: Rol) {
    setRolActivo(rol);
    setRCodigo(rol.codigo);
    setRNombre(rol.nombre);
    setRDescripcion(rol.descripcion || "");
    setRPermisos((rol.rolPermisos || []).map((x) => x.permiso.id));
    setModalRolOpen(true);
  }

  async function guardarRol() {
    try {
      setGuardando(true);

      let rolId = rolActivo?.id || "";

      if (!rolActivo) {
        const createRes = await fetch(`${getApiUrl()}/roles`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            codigo: rCodigo,
            nombre: rNombre,
            descripcion: rDescripcion,
            activo: true,
          }),
        });

        const createData = await readJsonSafe(createRes);
        if (!createRes.ok || !createData.ok) {
          throw new Error(createData.error || "No se pudo crear el rol");
        }

        rolId = createData.data.id;
      }

      const permisosRes = await fetch(`${getApiUrl()}/roles/${rolId}/permisos`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          permisos: rPermisos,
        }),
      });

      const permisosData = await readJsonSafe(permisosRes);
      if (!permisosRes.ok || !permisosData.ok) {
        throw new Error(
          permisosData.error || "No se pudieron guardar permisos del rol"
        );
      }

      await cargarTodo();
      setModalRolOpen(false);
      resetRolForm();
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Error guardando rol"));
    } finally {
      setGuardando(false);
    }
  }

  const tabsDisponibles: { key: TabKey; label: string; visible: boolean }[] = [
    { key: "usuarios", label: "Usuarios", visible: can("usuarios.ver") },
    { key: "roles", label: "Roles", visible: can("usuarios.roles") },
    {
      key: "permisos",
      label: "Permisos",
      visible: can("usuarios.permisos", "usuarios.roles"),
    },
  ];

  const totalUsuariosActivos = usuarios.filter((u) => u.activo).length;
  const totalRolesActivos = roles.filter((r) => r.activo !== false).length;
  const totalModulos = new Set(permisos.map((p) => p.modulo)).size;

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900 sm:text-2xl">
              Seguridad y Accesos
            </h1>
            <p className="text-sm text-slate-500">
              Gestión centralizada de usuarios, roles y permisos
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="text-sm font-semibold text-slate-500">
              Usuarios activos
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">
              {totalUsuariosActivos}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="text-sm font-semibold text-slate-500">Roles</div>
            <div className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">
              {totalRolesActivos}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="text-sm font-semibold text-slate-500">
              Módulos con permisos
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">
              {totalModulos}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {tabsDisponibles
            .filter((t) => t.visible)
            .map((t) => (
              <button
                key={t.key}
                onClick={() => changeTab(t.key)}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold ${
                  tab === t.key
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </button>
            ))}
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Cargando seguridad...</p>
        ) : (
          <>
            {tab === "usuarios" && can("usuarios.ver") && (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <input
                    value={qUsuarios}
                    onChange={(e) => setQUsuarios(e.target.value)}
                    placeholder="Buscar usuario por nombre, email, username o rol"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm sm:max-w-xl"
                  />

                  {can("usuarios.crear") && (
                    <button
                      onClick={abrirNuevoUsuario}
                      className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto sm:py-2"
                    >
                      + Nuevo usuario
                    </button>
                  )}
                </div>

                <div className="hidden xl:block overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100 text-left text-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-bold">Nombre</th>
                        <th className="px-4 py-3 font-bold">Usuario</th>
                        <th className="px-4 py-3 font-bold">Email</th>
                        <th className="px-4 py-3 font-bold">Roles</th>
                        <th className="px-4 py-3 font-bold">Permisos directos</th>
                        <th className="px-4 py-3 font-bold">Último login</th>
                        <th className="px-4 py-3 font-bold">Estado</th>
                        <th className="px-4 py-3 font-bold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuariosFiltrados.map((u) => (
                        <tr key={u.id} className="border-t border-slate-200 bg-white">
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {u.nombre}
                          </td>
                          <td className="px-4 py-3">{u.username}</td>
                          <td className="px-4 py-3">{u.email}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {(u.usuarioRoles || []).map((x) => (
                                <span
                                  key={x.rol.id}
                                  className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700"
                                >
                                  {x.rol.codigo}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex max-w-[420px] flex-wrap gap-2">
                              {(u.usuarioPermisos || []).slice(0, 8).map((x) => (
                                <span
                                  key={x.permiso.id}
                                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
                                >
                                  {x.permiso.codigo}
                                </span>
                              ))}
                              {(u.usuarioPermisos || []).length > 8 && (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                                  +{(u.usuarioPermisos || []).length - 8}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">{formatDateTime(u.ultimoLogin)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                u.activo
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {u.activo ? "ACTIVO" : "INACTIVO"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {can("usuarios.editar") && (
                              <button
                                onClick={() => abrirEditarUsuario(u)}
                                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                              >
                                Editar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 xl:hidden">
                  {usuariosFiltrados.map((u) => (
                    <div
                      key={u.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-black text-slate-900">{u.nombre}</div>
                          <div className="text-sm text-slate-600">@{u.username}</div>
                          <div className="text-sm text-slate-500 break-all">{u.email}</div>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                            u.activo
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {u.activo ? "ACTIVO" : "INACTIVO"}
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                          Roles
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(u.usuarioRoles || []).length > 0 ? (
                            (u.usuarioRoles || []).map((x) => (
                              <span
                                key={x.rol.id}
                                className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700"
                              >
                                {x.rol.codigo}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-slate-500">Sin roles</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                          Permisos directos
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(u.usuarioPermisos || []).slice(0, 8).map((x) => (
                            <span
                              key={x.permiso.id}
                              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
                            >
                              {x.permiso.codigo}
                            </span>
                          ))}
                          {(u.usuarioPermisos || []).length === 0 && (
                            <span className="text-sm text-slate-500">Sin permisos directos</span>
                          )}
                          {(u.usuarioPermisos || []).length > 8 && (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                              +{(u.usuarioPermisos || []).length - 8}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 text-sm text-slate-600">
                        <span className="font-semibold">Último login:</span>{" "}
                        {formatDateTime(u.ultimoLogin)}
                      </div>

                      {can("usuarios.editar") && (
                        <button
                          onClick={() => abrirEditarUsuario(u)}
                          className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Editar usuario
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "roles" && can("usuarios.roles") && (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <input
                    value={qRoles}
                    onChange={(e) => setQRoles(e.target.value)}
                    placeholder="Buscar rol por código, nombre o permiso"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm sm:max-w-xl"
                  />

                  <button
                    onClick={abrirNuevoRol}
                    className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto sm:py-2"
                  >
                    + Nuevo rol
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {rolesFiltrados.map((rol) => (
                    <div key={rol.id} className="rounded-3xl border border-slate-200 p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-lg font-black text-slate-900">
                            {rol.codigo}
                          </div>
                          <div className="text-sm text-slate-600">
                            {rol.nombre}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {rol.descripcion || "Sin descripción"}
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                            rol.activo === false
                              ? "bg-red-100 text-red-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {rol.activo === false ? "INACTIVO" : "ACTIVO"}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {(rol.rolPermisos || []).slice(0, 10).map((x) => (
                          <span
                            key={x.permiso.id}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
                          >
                            {x.permiso.codigo}
                          </span>
                        ))}
                        {(rol.rolPermisos || []).length > 10 && (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                            +{(rol.rolPermisos || []).length - 10}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => abrirEditarRol(rol)}
                        className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:w-auto sm:py-2"
                      >
                        Gestionar permisos
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "permisos" && can("usuarios.permisos", "usuarios.roles") && (
              <div className="space-y-4">
                <input
                  value={qPermisos}
                  onChange={(e) => setQPermisos(e.target.value)}
                  placeholder="Buscar permiso por módulo, código o nombre"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm sm:max-w-xl"
                />

                <div className="hidden xl:block overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100 text-left text-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-bold">Módulo</th>
                        <th className="px-4 py-3 font-bold">Código</th>
                        <th className="px-4 py-3 font-bold">Nombre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {permisosFiltrados.map((p) => (
                        <tr key={p.id} className="border-t border-slate-200 bg-white">
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {p.modulo}
                          </td>
                          <td className="px-4 py-3">{p.codigo}</td>
                          <td className="px-4 py-3">{p.nombre}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 xl:hidden">
                  {permisosFiltrados.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        {p.modulo}
                      </div>
                      <div className="mt-1 font-black text-slate-900">{p.codigo}</div>
                      <div className="text-sm text-slate-600">{p.nombre}</div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {permisosPorModulo.map(([modulo, items]) => (
                    <div key={modulo} className="rounded-2xl border border-slate-200 p-4">
                      <div className="mb-3 text-sm font-black text-slate-900">
                        {modulo}
                      </div>
                      <div className="space-y-2">
                        {items.map((p) => (
                          <div
                            key={p.id}
                            className="rounded-xl border border-slate-100 px-3 py-2 text-sm"
                          >
                            <div className="font-semibold text-slate-900">
                              {p.codigo}
                            </div>
                            <div className="text-xs text-slate-500">
                              {p.nombre}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {modalUsuarioOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 p-0 sm:flex sm:items-start sm:justify-center sm:p-4">
          <div className="flex h-dvh w-full flex-col bg-white shadow-xl sm:mt-4 sm:h-auto sm:max-h-[94vh] sm:max-w-6xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4 sm:rounded-t-3xl sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
                    {usuarioActivo ? "Editar usuario" : "Nuevo usuario"}
                  </h2>
                  <p className="text-sm text-slate-500">
                    Configura cuenta, roles y permisos específicos
                  </p>
                </div>

                <button
                  onClick={() => setModalUsuarioOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-base font-black text-slate-900 sm:text-lg">
                    Datos básicos
                  </h3>
                  <div className="grid gap-3">
                    <input
                      value={uNombre}
                      onChange={(e) => setUNombre(e.target.value)}
                      placeholder="Nombre"
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    />
                    <input
                      value={uUsername}
                      onChange={(e) => setUUsername(e.target.value)}
                      placeholder="Username"
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    />
                    <input
                      value={uEmail}
                      onChange={(e) => setUEmail(e.target.value)}
                      placeholder="Email"
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    />
                    <input
                      type="password"
                      value={uPassword}
                      onChange={(e) => setUPassword(e.target.value)}
                      placeholder={
                        usuarioActivo
                          ? "Nueva contraseña (opcional)"
                          : "Contraseña"
                      }
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    />

                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={uActivo}
                        onChange={(e) => setUActivo(e.target.checked)}
                      />
                      Usuario activo
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-base font-black text-slate-900 sm:text-lg">Roles</h3>
                  <div className="grid gap-2">
                    {roles.map((r) => (
                      <label
                        key={r.id}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={uRoles.includes(r.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setURoles((prev) => [...prev, r.id]);
                            } else {
                              setURoles((prev) =>
                                prev.filter((x) => x !== r.id)
                              );
                            }
                          }}
                        />
                        <span className="font-semibold text-slate-900">
                          {r.codigo}
                        </span>
                        <span className="text-slate-500">{r.nombre}</span>
                      </label>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-4 lg:col-span-2">
                  <h3 className="mb-3 text-base font-black text-slate-900 sm:text-lg">
                    Permisos directos
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {permisosPorModulo.map(([modulo, items]) => (
                      <div key={modulo} className="rounded-2xl border border-slate-200 p-4">
                        <div className="mb-3 text-sm font-black text-slate-900">
                          {modulo}
                        </div>
                        <div className="space-y-2">
                          {items.map((p) => (
                            <label
                              key={p.id}
                              className="flex items-start gap-3 rounded-xl border border-slate-100 px-3 py-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={uPermisos.includes(p.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setUPermisos((prev) => [...prev, p.id]);
                                  } else {
                                    setUPermisos((prev) =>
                                      prev.filter((x) => x !== p.id)
                                    );
                                  }
                                }}
                              />
                              <div>
                                <div className="font-semibold text-slate-900">
                                  {p.codigo}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {p.nombre}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-slate-200 bg-white p-4 sm:rounded-b-3xl sm:p-6">
              <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
                <button
                  onClick={() => setModalUsuarioOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 sm:py-2"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarUsuario}
                  disabled={guardando}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:py-2"
                >
                  {guardando ? "Guardando..." : "Guardar usuario"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalRolOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 p-0 sm:flex sm:items-start sm:justify-center sm:p-4">
          <div className="flex h-dvh w-full flex-col bg-white shadow-xl sm:mt-4 sm:h-auto sm:max-h-[94vh] sm:max-w-5xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4 sm:rounded-t-3xl sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
                    {rolActivo ? `Permisos del rol ${rolActivo.codigo}` : "Nuevo rol"}
                  </h2>
                  <p className="text-sm text-slate-500">
                    Define qué puede hacer cada perfil del sistema
                  </p>
                </div>

                <button
                  onClick={() => setModalRolOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {!rolActivo && (
                <div className="mb-6 grid gap-3 md:grid-cols-3">
                  <input
                    value={rCodigo}
                    onChange={(e) => setRCodigo(e.target.value)}
                    placeholder="Código"
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  />
                  <input
                    value={rNombre}
                    onChange={(e) => setRNombre(e.target.value)}
                    placeholder="Nombre"
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  />
                  <input
                    value={rDescripcion}
                    onChange={(e) => setRDescripcion(e.target.value)}
                    placeholder="Descripción"
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  />
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {permisosPorModulo.map(([modulo, items]) => (
                  <div key={modulo} className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-3 text-sm font-black text-slate-900">
                      {modulo}
                    </div>
                    <div className="space-y-2">
                      {items.map((p) => (
                        <label
                          key={p.id}
                          className="flex items-start gap-3 rounded-xl border border-slate-100 px-3 py-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={rPermisos.includes(p.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setRPermisos((prev) => [...prev, p.id]);
                              } else {
                                setRPermisos((prev) =>
                                  prev.filter((x) => x !== p.id)
                                );
                              }
                            }}
                          />
                          <div>
                            <div className="font-semibold text-slate-900">
                              {p.codigo}
                            </div>
                            <div className="text-xs text-slate-500">
                              {p.nombre}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-slate-200 bg-white p-4 sm:rounded-b-3xl sm:p-6">
              <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
                <button
                  onClick={() => setModalRolOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 sm:py-2"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarRol}
                  disabled={guardando}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:py-2"
                >
                  {guardando ? "Guardando..." : "Guardar rol"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
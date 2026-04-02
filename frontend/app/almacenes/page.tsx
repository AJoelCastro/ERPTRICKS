"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Almacen = {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type ApiSuccessResponse<T> = {
  ok?: boolean;
  data?: T;
  error?: string;
};

async function readJsonSafe<T>(res: Response): Promise<T> {
  const text = await res.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      text?.includes("<!DOCTYPE")
        ? "El backend respondió HTML en vez de JSON. Verifica que el backend esté reiniciado."
        : text || "La respuesta del servidor no es JSON válido"
    );
  }
}

function formatFecha(v?: string) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("es-PE");
  } catch {
    return v;
  }
}

export default function AlmacenesPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [filasPorPagina, setFilasPorPagina] = useState(10);

  const [modalCrearOpen, setModalCrearOpen] = useState(false);
  const [modalEditarOpen, setModalEditarOpen] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [cambiandoEstadoId, setCambiandoEstadoId] = useState("");

  const [formCrear, setFormCrear] = useState({
    codigo: "",
    nombre: "",
  });

  const [formEditar, setFormEditar] = useState({
    id: "",
    codigo: "",
    nombre: "",
  });

  const cargarAlmacenes = useCallback(async () => {
    if (!apiUrl) {
      setLoading(false);
      alert("NEXT_PUBLIC_API_URL no está configurado");
      return;
    }

    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (estadoFiltro) params.set("activo", estadoFiltro);

      const res = await fetch(
        `${apiUrl}/almacenes${params.toString() ? `?${params.toString()}` : ""}`
      );

      const data = await readJsonSafe<ApiSuccessResponse<Almacen[]>>(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudieron cargar los almacenes");
      }

      setAlmacenes(data.data || []);
    } catch (error) {
      console.error("Error cargando almacenes:", error);
      alert(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los almacenes"
      );
    } finally {
      setLoading(false);
    }
  }, [apiUrl, q, estadoFiltro]);

  useEffect(() => {
    void cargarAlmacenes();
  }, [cargarAlmacenes]);

  const almacenesFiltrados = useMemo(() => {
    return almacenes;
  }, [almacenes]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(almacenesFiltrados.length / filasPorPagina)
  );

  const almacenesPagina = useMemo(() => {
    const start = (paginaActual - 1) * filasPorPagina;
    const end = start + filasPorPagina;
    return almacenesFiltrados.slice(start, end);
  }, [almacenesFiltrados, paginaActual, filasPorPagina]);

  useEffect(() => {
    setPaginaActual(1);
  }, [q, estadoFiltro, filasPorPagina]);

  function abrirModalCrear() {
    setFormCrear({
      codigo: "",
      nombre: "",
    });
    setModalCrearOpen(true);
  }

  function cerrarModalCrear() {
    if (guardando) return;
    setModalCrearOpen(false);
    setFormCrear({
      codigo: "",
      nombre: "",
    });
  }

  function abrirModalEditar(almacen: Almacen) {
    setFormEditar({
      id: almacen.id,
      codigo: almacen.codigo,
      nombre: almacen.nombre,
    });
    setModalEditarOpen(true);
  }

  function cerrarModalEditar() {
    if (guardando) return;
    setModalEditarOpen(false);
    setFormEditar({
      id: "",
      codigo: "",
      nombre: "",
    });
  }

  function updateFormCrear<K extends keyof typeof formCrear>(
    key: K,
    value: (typeof formCrear)[K]
  ) {
    setFormCrear((prev) => ({ ...prev, [key]: value }));
  }

  function updateFormEditar<K extends keyof typeof formEditar>(
    key: K,
    value: (typeof formEditar)[K]
  ) {
    setFormEditar((prev) => ({ ...prev, [key]: value }));
  }

  async function guardarCrear(e: React.FormEvent) {
    e.preventDefault();
    if (!apiUrl) return;

    try {
      setGuardando(true);

      const payload = {
        codigo: formCrear.codigo.trim().toUpperCase(),
        nombre: formCrear.nombre.trim(),
      };

      const res = await fetch(`${apiUrl}/almacenes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await readJsonSafe<ApiSuccessResponse<Almacen>>(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo crear el almacén");
        return;
      }

      await cargarAlmacenes();
      cerrarModalCrear();
      alert("Almacén creado correctamente");
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al crear el almacén"
      );
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEditar(e: React.FormEvent) {
    e.preventDefault();
    if (!apiUrl || !formEditar.id) return;

    try {
      setGuardando(true);

      const payload = {
        codigo: formEditar.codigo.trim().toUpperCase(),
        nombre: formEditar.nombre.trim(),
      };

      const res = await fetch(`${apiUrl}/almacenes/${formEditar.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await readJsonSafe<ApiSuccessResponse<Almacen>>(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo actualizar el almacén");
        return;
      }

      await cargarAlmacenes();
      cerrarModalEditar();
      alert("Almacén actualizado correctamente");
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al actualizar el almacén"
      );
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo(almacen: Almacen) {
    if (!apiUrl) return;

    const accion = almacen.activo ? "desactivar" : "activar";
    const confirmado = window.confirm(
      `¿Deseas ${accion} el almacén ${almacen.codigo}?`
    );

    if (!confirmado) return;

    try {
      setCambiandoEstadoId(almacen.id);

      const res = await fetch(`${apiUrl}/almacenes/${almacen.id}/estado`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          activo: !almacen.activo,
        }),
      });

      const data = await readJsonSafe<ApiSuccessResponse<Almacen>>(res);

      if (!res.ok || !data.ok) {
        alert(data.error || `No se pudo ${accion} el almacén`);
        return;
      }

      await cargarAlmacenes();
      alert(`Almacén ${accion}do correctamente`);
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : `Ocurrió un error al ${accion} el almacén`
      );
    } finally {
      setCambiandoEstadoId("");
    }
  }

  function badgeEstado(activo: boolean) {
    return activo ? (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
        ACTIVO
      </span>
    ) : (
      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
        INACTIVO
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Almacenes</h1>
            <p className="text-sm text-slate-500">
              Gestión de almacenes del sistema
            </p>
          </div>

          <button
            onClick={abrirModalCrear}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Nuevo almacén
          </button>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por código o nombre..."
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />

          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="">Todos los estados</option>
            <option value="true">ACTIVO</option>
            <option value="false">INACTIVO</option>
          </select>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="font-semibold">Total:</span>
            <span>{almacenesFiltrados.length}</span>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Cargando almacenes...</p>
        ) : almacenesFiltrados.length === 0 ? (
          <p className="text-sm text-slate-500">No hay almacenes registrados.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-bold">Código</th>
                    <th className="px-4 py-3 font-bold">Nombre</th>
                    <th className="px-4 py-3 font-bold">Estado</th>
                    <th className="px-4 py-3 font-bold">Creado</th>
                    <th className="px-4 py-3 font-bold">Actualizado</th>
                    <th className="px-4 py-3 font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {almacenesPagina.map((almacen) => (
                    <tr
                      key={almacen.id}
                      className="border-t border-slate-200 bg-white hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {almacen.codigo}
                      </td>
                      <td className="px-4 py-3">{almacen.nombre}</td>
                      <td className="px-4 py-3">{badgeEstado(almacen.activo)}</td>
                      <td className="px-4 py-3">{formatFecha(almacen.createdAt)}</td>
                      <td className="px-4 py-3">{formatFecha(almacen.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => abrirModalEditar(almacen)}
                            className="rounded-lg border border-blue-300 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() => toggleActivo(almacen)}
                            disabled={cambiandoEstadoId === almacen.id}
                            className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                              almacen.activo
                                ? "border border-red-300 text-red-700 hover:bg-red-50"
                                : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            } disabled:opacity-60`}
                          >
                            {cambiandoEstadoId === almacen.id
                              ? "Procesando..."
                              : almacen.activo
                              ? "Desactivar"
                              : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>Mostrar</span>
                <select
                  value={filasPorPagina}
                  onChange={(e) => setFilasPorPagina(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>filas</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={paginaActual <= 1}
                  onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ◀ Anterior
                </button>

                <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  Página {paginaActual} de {totalPaginas}
                </div>

                <button
                  disabled={paginaActual >= totalPaginas}
                  onClick={() =>
                    setPaginaActual((p) => Math.min(totalPaginas, p + 1))
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Siguiente ▶
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {modalCrearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  Crear almacén
                </h2>
                <p className="text-sm text-slate-500">
                  Registra un nuevo almacén
                </p>
              </div>

              <button
                onClick={cerrarModalCrear}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={guardarCrear} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Código
                </label>
                <input
                  value={formCrear.codigo}
                  onChange={(e) => updateFormCrear("codigo", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm uppercase outline-none focus:border-blue-500"
                  placeholder="Ejemplo: ALM-01"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Nombre
                </label>
                <input
                  value={formCrear.nombre}
                  onChange={(e) => updateFormCrear("nombre", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  placeholder="Ejemplo: Almacén Principal"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={cerrarModalCrear}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={guardando}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {guardando ? "Guardando..." : "Crear almacén"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalEditarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  Editar almacén
                </h2>
                <p className="text-sm text-slate-500">
                  Actualiza los datos del almacén
                </p>
              </div>

              <button
                onClick={cerrarModalEditar}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={guardarEditar} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Código
                </label>
                <input
                  value={formEditar.codigo}
                  onChange={(e) => updateFormEditar("codigo", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm uppercase outline-none focus:border-blue-500"
                  placeholder="Ejemplo: ALM-01"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Nombre
                </label>
                <input
                  value={formEditar.nombre}
                  onChange={(e) => updateFormEditar("nombre", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  placeholder="Ejemplo: Almacén Principal"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={cerrarModalEditar}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={guardando}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
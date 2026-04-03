"use client";

import { useEffect, useMemo, useState } from "react";

type PagoYape = {
  id: string;
  appOrigen?: string | null;
  titulo?: string | null;
  mensaje?: string | null;
  fechaHoraTexto?: string | null;
  timestampMs?: string | number | null;
  numerosDestino?: string | null;
  estadoSms?: string | null;
  detalleSms?: string | null;
  payloadJson?: string | null;
  estado: "POR_VALIDAR" | "CONFIRMADO";
  observacion?: string | null;
  createdAt: string;
  updatedAt: string;
};

function formatDate(v?: string | null) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleDateString("es-PE");
  } catch {
    return v;
  }
}

function formatDateTime(v?: string | null) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("es-PE");
  } catch {
    return v;
  }
}

async function readJsonSafe(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || "Respuesta no válida del servidor");
  }
}

function badgeEstado(estado: string) {
  const map: Record<string, string> = {
    POR_VALIDAR: "bg-yellow-100 text-yellow-700",
    CONFIRMADO: "bg-emerald-100 text-emerald-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
        map[estado] || "bg-slate-100 text-slate-700"
      }`}
    >
      {estado}
    </span>
  );
}

function badgeEstadoSms(estado?: string | null) {
  const map: Record<string, string> = {
    ENVIADO: "bg-blue-100 text-blue-700",
    ERROR: "bg-red-100 text-red-700",
    PROCESADO: "bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
        map[String(estado || "").toUpperCase()] || "bg-slate-100 text-slate-700"
      }`}
    >
      {estado || "-"}
    </span>
  );
}

export default function PagosYapePage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const [items, setItems] = useState<PagoYape[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);

  const [q, setQ] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");

  const [detalleOpen, setDetalleOpen] = useState(false);
  const [itemActivo, setItemActivo] = useState<PagoYape | null>(null);
  const [nuevoEstado, setNuevoEstado] = useState<"POR_VALIDAR" | "CONFIRMADO">(
    "POR_VALIDAR"
  );
  const [observacion, setObservacion] = useState("");

  async function cargarTodo() {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (estadoFiltro) params.set("estado", estadoFiltro);

      const res = await fetch(`${apiUrl}/notificaciones-yape?${params.toString()}`);
      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo cargar Pagos Yape");
        return;
      }

      setItems(data.data || []);
    } catch (error) {
      console.error(error);
      alert("No se pudo cargar Pagos Yape");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function abrirDetalle(id: string) {
    try {
      const res = await fetch(`${apiUrl}/notificaciones-yape/${id}`);
      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo abrir el detalle");
        return;
      }

      setItemActivo(data.data);
      setNuevoEstado(data.data.estado || "POR_VALIDAR");
      setObservacion(data.data.observacion || "");
      setDetalleOpen(true);
    } catch (error) {
      console.error(error);
      alert("Error abriendo detalle");
    }
  }

  async function guardarEstado() {
    if (!itemActivo) return;

    try {
      setProcesando(true);

      const res = await fetch(`${apiUrl}/notificaciones-yape/${itemActivo.id}/estado`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          estado: nuevoEstado,
          observacion,
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        alert(data.error || "No se pudo actualizar estado");
        return;
      }

      await cargarTodo();
      await abrirDetalle(itemActivo.id);
      alert("Estado actualizado correctamente");
    } catch (error) {
      console.error(error);
      alert("Error actualizando estado");
    } finally {
      setProcesando(false);
    }
  }

  const resumen = useMemo(() => {
    return {
      total: items.length,
      porValidar: items.filter((x) => x.estado === "POR_VALIDAR").length,
      confirmados: items.filter((x) => x.estado === "CONFIRMADO").length,
      enviados: items.filter((x) => String(x.estadoSms).toUpperCase() === "ENVIADO")
        .length,
      errores: items.filter((x) => String(x.estadoSms).toUpperCase() === "ERROR")
        .length,
    };
  }, [items]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Pagos Yape</h1>
            <p className="text-sm text-slate-500">
              Historial de notificaciones Yape y validación manual
            </p>
          </div>

          <button
            onClick={cargarTodo}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Recargar
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-500">Total</div>
            <div className="mt-2 text-3xl font-black text-slate-900">{resumen.total}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-500">Por validar</div>
            <div className="mt-2 text-3xl font-black text-yellow-700">
              {resumen.porValidar}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-500">Confirmados</div>
            <div className="mt-2 text-3xl font-black text-emerald-700">
              {resumen.confirmados}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-500">SMS enviados</div>
            <div className="mt-2 text-3xl font-black text-blue-700">
              {resumen.enviados}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-500">SMS error</div>
            <div className="mt-2 text-3xl font-black text-red-700">
              {resumen.errores}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, mensaje, app o fecha"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />

          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="POR_VALIDAR">POR_VALIDAR</option>
            <option value="CONFIRMADO">CONFIRMADO</option>
          </select>

          <button
            onClick={cargarTodo}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Aplicar filtros
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Cargando pagos Yape...</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 lg:block">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-bold">Fecha</th>
                    <th className="px-4 py-3 font-bold">Título</th>
                    <th className="px-4 py-3 font-bold">Mensaje</th>
                    <th className="px-4 py-3 font-bold">Estado</th>
                    <th className="px-4 py-3 font-bold">SMS</th>
                    <th className="px-4 py-3 font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-slate-200 bg-white">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {item.fechaHoraTexto || formatDateTime(item.createdAt)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatDateTime(item.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {item.titulo || "-"}
                      </td>
                      <td className="max-w-[500px] px-4 py-3 text-slate-700">
                        <div className="line-clamp-2">{item.mensaje || "-"}</div>
                      </td>
                      <td className="px-4 py-3">{badgeEstado(item.estado)}</td>
                      <td className="px-4 py-3">{badgeEstadoSms(item.estadoSms)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => abrirDetalle(item.id)}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))}

                  {items.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-sm text-slate-500"
                      >
                        No hay registros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 lg:hidden">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-black text-slate-900">
                        {item.titulo || "Pago Yape"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.fechaHoraTexto || formatDateTime(item.createdAt)}
                      </div>
                    </div>
                    <div>{badgeEstado(item.estado)}</div>
                  </div>

                  <div className="mt-3 text-sm text-slate-700">{item.mensaje || "-"}</div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {badgeEstadoSms(item.estadoSms)}
                  </div>

                  <button
                    onClick={() => abrirDetalle(item.id)}
                    className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Ver detalle
                  </button>
                </div>
              ))}

              {items.length === 0 && (
                <div className="rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                  No hay registros.
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {detalleOpen && itemActivo && (
        <div className="fixed inset-0 z-50 bg-black/40 p-2 sm:p-4">
          <div className="mx-auto max-h-[96vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-4 shadow-xl sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Detalle Pago Yape</h2>
                <p className="text-sm text-slate-500">{itemActivo.id}</p>
              </div>

              <button
                onClick={() => setDetalleOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                Cerrar
              </button>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <section className="space-y-4">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-lg font-black text-slate-900">Datos</h3>

                  <div className="space-y-2 text-sm text-slate-700">
                    <div><b>App origen:</b> {itemActivo.appOrigen || "-"}</div>
                    <div><b>Título:</b> {itemActivo.titulo || "-"}</div>
                    <div><b>Mensaje:</b> {itemActivo.mensaje || "-"}</div>
                    <div><b>Fecha texto:</b> {itemActivo.fechaHoraTexto || "-"}</div>
                    <div><b>Destino SMS:</b> {itemActivo.numerosDestino || "-"}</div>
                    <div><b>Estado SMS:</b> {itemActivo.estadoSms || "-"}</div>
                    <div><b>Detalle SMS:</b> {itemActivo.detalleSms || "-"}</div>
                    <div><b>Creado:</b> {formatDateTime(itemActivo.createdAt)}</div>
                    <div><b>Actualizado:</b> {formatDateTime(itemActivo.updatedAt)}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-lg font-black text-slate-900">Payload</h3>

                  <pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                    {itemActivo.payloadJson || "-"}
                  </pre>
                </div>
              </section>

              <section className="space-y-4">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-lg font-black text-slate-900">
                    Validación
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Estado
                      </label>
                      <select
                        value={nuevoEstado}
                        onChange={(e) =>
                          setNuevoEstado(e.target.value as "POR_VALIDAR" | "CONFIRMADO")
                        }
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                      >
                        <option value="POR_VALIDAR">POR_VALIDAR</option>
                        <option value="CONFIRMADO">CONFIRMADO</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Observación
                      </label>
                      <textarea
                        value={observacion}
                        onChange={(e) => setObservacion(e.target.value)}
                        className="min-h-[120px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={guardarEstado}
                        disabled={procesando}
                        className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        Guardar cambios
                      </button>

                      <div className="flex items-center">{badgeEstado(itemActivo.estado)}</div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
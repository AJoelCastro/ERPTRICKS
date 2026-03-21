const express = require("express");

const router = express.Router();

function normalizarTexto(v) {
  return String(v || "").trim().toUpperCase();
}

function normalizarTextoLibre(v) {
  return String(v || "").trim();
}

function normalizarDoc(v) {
  return String(v || "").trim();
}

function generarCodigoCliente(numero) {
  return `CLI-${String(numero).padStart(6, "0")}`;
}

function nombreMostrarCliente(cliente) {
  if (cliente.tipoCliente === "PERSONA_JURIDICA") {
    return cliente.razonSocial || "";
  }
  return `${cliente.nombres || ""} ${cliente.apellidos || ""}`.trim();
}

/**
 * GET /clientes
 * filtros:
 * ?q=
 * ?estado=
 * ?tipoCliente=
 * ?categoria=
 */
router.get("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { q = "", estado = "", tipoCliente = "", categoria = "" } = req.query;

    const where = {};

    if (estado) {
      where.estado = normalizarTexto(estado);
    }

    if (tipoCliente) {
      where.tipoCliente = normalizarTexto(tipoCliente);
    }

    if (categoria) {
      where.categoria = normalizarTexto(categoria);
    }

    if (q) {
      const texto = String(q).trim();

      where.OR = [
        { codigo: { contains: texto, mode: "insensitive" } },
        { dni: { contains: texto, mode: "insensitive" } },
        { ruc: { contains: texto, mode: "insensitive" } },
        { nombres: { contains: texto, mode: "insensitive" } },
        { apellidos: { contains: texto, mode: "insensitive" } },
        { razonSocial: { contains: texto, mode: "insensitive" } },
        { telefono: { contains: texto, mode: "insensitive" } },
        { ciudad: { contains: texto, mode: "insensitive" } },
        { distrito: { contains: texto, mode: "insensitive" } },
        { direccion: { contains: texto, mode: "insensitive" } },
        { agencia: { contains: texto, mode: "insensitive" } },
        { local: { contains: texto, mode: "insensitive" } },
      ];
    }

    const clientes = await prisma.cliente.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      ok: true,
      data: clientes.map((c) => ({
        ...c,
        nombreCompleto: nombreMostrarCliente(c),
        documentoPrincipal:
          c.tipoCliente === "PERSONA_JURIDICA" ? c.ruc || "" : c.dni || "",
      })),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * GET /clientes/buscar
 * autocomplete para ventas / pedidos
 * ?q=juan
 * ?tipoCliente=PERSONA_NATURAL
 */
router.get("/buscar", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { q = "", tipoCliente = "" } = req.query;

    const texto = String(q || "").trim();

    if (!texto) {
      return res.json({
        ok: true,
        data: [],
      });
    }

    const where = {
      estado: "ACTIVO",
      OR: [
        { codigo: { contains: texto, mode: "insensitive" } },
        { dni: { contains: texto, mode: "insensitive" } },
        { ruc: { contains: texto, mode: "insensitive" } },
        { nombres: { contains: texto, mode: "insensitive" } },
        { apellidos: { contains: texto, mode: "insensitive" } },
        { razonSocial: { contains: texto, mode: "insensitive" } },
        { telefono: { contains: texto, mode: "insensitive" } },
      ],
    };

    if (tipoCliente) {
      where.tipoCliente = normalizarTexto(tipoCliente);
    }

    const clientes = await prisma.cliente.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: 12,
    });

    res.json({
      ok: true,
      data: clientes.map((c) => ({
        ...c,
        nombreCompleto: nombreMostrarCliente(c),
        documentoPrincipal:
          c.tipoCliente === "PERSONA_JURIDICA" ? c.ruc || "" : c.dni || "",
      })),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * GET /clientes/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;

    const cliente = await prisma.cliente.findUnique({
      where: { id },
    });

    if (!cliente) {
      return res.status(404).json({
        ok: false,
        error: "Cliente no encontrado",
      });
    }

    res.json({
      ok: true,
      data: {
        ...cliente,
        nombreCompleto: nombreMostrarCliente(cliente),
        documentoPrincipal:
          cliente.tipoCliente === "PERSONA_JURIDICA"
            ? cliente.ruc || ""
            : cliente.dni || "",
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * POST /clientes
 */
router.post("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const {
      tipoCliente,
      dni,
      ruc,
      nombres,
      apellidos,
      razonSocial,
      telefono,
      categoria,
      departamento,
      ciudad,
      distrito,
      direccion,
      agencia,
      local,
    } = req.body;

    const tipo = normalizarTexto(tipoCliente || "PERSONA_NATURAL");

    if (!["PERSONA_NATURAL", "PERSONA_JURIDICA"].includes(tipo)) {
      return res.status(400).json({
        ok: false,
        error: "tipoCliente inválido. Usa PERSONA_NATURAL o PERSONA_JURIDICA",
      });
    }

    if (!telefono || !categoria) {
      return res.status(400).json({
        ok: false,
        error: "telefono y categoria son obligatorios",
      });
    }

    if (tipo === "PERSONA_NATURAL") {
      if (!dni || !nombres || !apellidos) {
        return res.status(400).json({
          ok: false,
          error: "Para PERSONA_NATURAL debes enviar dni, nombres y apellidos",
        });
      }

      const dniN = normalizarDoc(dni);

      const existenteDni = await prisma.cliente.findFirst({
        where: { dni: dniN },
      });

      if (existenteDni) {
        return res.status(400).json({
          ok: false,
          error: "Ya existe un cliente con ese DNI",
        });
      }
    }

    if (tipo === "PERSONA_JURIDICA") {
      if (!ruc || !razonSocial) {
        return res.status(400).json({
          ok: false,
          error: "Para PERSONA_JURIDICA debes enviar ruc y razonSocial",
        });
      }

      const rucN = normalizarDoc(ruc);

      const existenteRuc = await prisma.cliente.findFirst({
        where: { ruc: rucN },
      });

      if (existenteRuc) {
        return res.status(400).json({
          ok: false,
          error: "Ya existe un cliente con ese RUC",
        });
      }
    }

    const total = await prisma.cliente.count();
    const codigo = generarCodigoCliente(total + 1);

    const nuevoCliente = await prisma.cliente.create({
      data: {
        codigo,
        tipoCliente: tipo,
        dni: tipo === "PERSONA_NATURAL" ? normalizarDoc(dni) : null,
        ruc: tipo === "PERSONA_JURIDICA" ? normalizarDoc(ruc) : null,
        nombres: tipo === "PERSONA_NATURAL" ? normalizarTexto(nombres) : null,
        apellidos:
          tipo === "PERSONA_NATURAL" ? normalizarTexto(apellidos) : null,
        razonSocial:
          tipo === "PERSONA_JURIDICA" ? normalizarTexto(razonSocial) : null,
        telefono: normalizarTextoLibre(telefono),
        categoria: normalizarTexto(categoria),
        departamento: departamento ? normalizarTexto(departamento) : null,
        ciudad: ciudad ? normalizarTexto(ciudad) : null,
        distrito: distrito ? normalizarTexto(distrito) : null,
        direccion: direccion ? normalizarTextoLibre(direccion) : null,
        agencia: agencia ? normalizarTextoLibre(agencia) : null,
        local: local ? normalizarTextoLibre(local) : null,
        estado: "ACTIVO",
      },
    });

    res.status(201).json({
      ok: true,
      data: {
        ...nuevoCliente,
        nombreCompleto: nombreMostrarCliente(nuevoCliente),
        documentoPrincipal:
          nuevoCliente.tipoCliente === "PERSONA_JURIDICA"
            ? nuevoCliente.ruc || ""
            : nuevoCliente.dni || "",
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * PUT /clientes/:id
 */
router.put("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;

    const {
      tipoCliente,
      dni,
      ruc,
      nombres,
      apellidos,
      razonSocial,
      telefono,
      categoria,
      departamento,
      ciudad,
      distrito,
      direccion,
      agencia,
      local,
    } = req.body;

    const cliente = await prisma.cliente.findUnique({
      where: { id },
    });

    if (!cliente) {
      return res.status(404).json({
        ok: false,
        error: "Cliente no encontrado",
      });
    }

    const tipo = normalizarTexto(tipoCliente || cliente.tipoCliente);

    if (!["PERSONA_NATURAL", "PERSONA_JURIDICA"].includes(tipo)) {
      return res.status(400).json({
        ok: false,
        error: "tipoCliente inválido",
      });
    }

    if (!telefono || !categoria) {
      return res.status(400).json({
        ok: false,
        error: "telefono y categoria son obligatorios",
      });
    }

    if (tipo === "PERSONA_NATURAL") {
      if (!dni || !nombres || !apellidos) {
        return res.status(400).json({
          ok: false,
          error: "Para PERSONA_NATURAL debes enviar dni, nombres y apellidos",
        });
      }

      const dniN = normalizarDoc(dni);

      const otro = await prisma.cliente.findFirst({
        where: {
          dni: dniN,
          NOT: { id },
        },
      });

      if (otro) {
        return res.status(400).json({
          ok: false,
          error: "Ya existe otro cliente con ese DNI",
        });
      }
    }

    if (tipo === "PERSONA_JURIDICA") {
      if (!ruc || !razonSocial) {
        return res.status(400).json({
          ok: false,
          error: "Para PERSONA_JURIDICA debes enviar ruc y razonSocial",
        });
      }

      const rucN = normalizarDoc(ruc);

      const otro = await prisma.cliente.findFirst({
        where: {
          ruc: rucN,
          NOT: { id },
        },
      });

      if (otro) {
        return res.status(400).json({
          ok: false,
          error: "Ya existe otro cliente con ese RUC",
        });
      }
    }

    const actualizado = await prisma.cliente.update({
      where: { id },
      data: {
        tipoCliente: tipo,
        dni: tipo === "PERSONA_NATURAL" ? normalizarDoc(dni) : null,
        ruc: tipo === "PERSONA_JURIDICA" ? normalizarDoc(ruc) : null,
        nombres: tipo === "PERSONA_NATURAL" ? normalizarTexto(nombres) : null,
        apellidos:
          tipo === "PERSONA_NATURAL" ? normalizarTexto(apellidos) : null,
        razonSocial:
          tipo === "PERSONA_JURIDICA" ? normalizarTexto(razonSocial) : null,
        telefono: normalizarTextoLibre(telefono),
        categoria: normalizarTexto(categoria),
        departamento: departamento ? normalizarTexto(departamento) : null,
        ciudad: ciudad ? normalizarTexto(ciudad) : null,
        distrito: distrito ? normalizarTexto(distrito) : null,
        direccion: direccion ? normalizarTextoLibre(direccion) : null,
        agencia: agencia ? normalizarTextoLibre(agencia) : null,
        local: local ? normalizarTextoLibre(local) : null,
      },
    });

    res.json({
      ok: true,
      data: {
        ...actualizado,
        nombreCompleto: nombreMostrarCliente(actualizado),
        documentoPrincipal:
          actualizado.tipoCliente === "PERSONA_JURIDICA"
            ? actualizado.ruc || ""
            : actualizado.dni || "",
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * PATCH /clientes/:id/estado
 */
router.patch("/:id/estado", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;
    const { estado } = req.body;

    const estadoN = normalizarTexto(estado);

    if (!["ACTIVO", "INACTIVO"].includes(estadoN)) {
      return res.status(400).json({
        ok: false,
        error: "Estado inválido. Usa ACTIVO o INACTIVO",
      });
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id },
    });

    if (!cliente) {
      return res.status(404).json({
        ok: false,
        error: "Cliente no encontrado",
      });
    }

    const actualizado = await prisma.cliente.update({
      where: { id },
      data: {
        estado: estadoN,
      },
    });

    res.json({
      ok: true,
      data: actualizado,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;
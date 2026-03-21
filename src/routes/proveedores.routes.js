const express = require("express");

const router = express.Router();

function normalizarTexto(v) {
  return String(v || "").trim().toUpperCase();
}

function normalizarEmail(v) {
  return String(v || "").trim().toLowerCase();
}

async function generarCodigoProveedor(prisma) {
  const total = await prisma.proveedor.count();
  return `PRV-${String(total + 1).padStart(6, "0")}`;
}

// GET /proveedores
router.get("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { q, estado, tipoProveedor } = req.query;

    const where = {};

    if (estado) {
      where.estado = normalizarTexto(estado);
    }

    if (tipoProveedor) {
      where.tipoProveedor = normalizarTexto(tipoProveedor);
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
        { contacto: { contains: texto, mode: "insensitive" } },
      ];
    }

    const data = await prisma.proveedor.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// GET /proveedores/:id
router.get("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;

    const proveedor = await prisma.proveedor.findUnique({
      where: { id },
      include: {
        compras: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!proveedor) {
      return res.status(404).json({
        ok: false,
        error: "Proveedor no encontrado",
      });
    }

    res.json({
      ok: true,
      data: proveedor,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// POST /proveedores
router.post("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const {
      tipoProveedor,
      dni,
      ruc,
      nombres,
      apellidos,
      razonSocial,
      telefono,
      email,
      direccion,
      contacto,
    } = req.body;

    const tipo = normalizarTexto(tipoProveedor);

    if (!["PERSONA_NATURAL", "PERSONA_JURIDICA"].includes(tipo)) {
      return res.status(400).json({
        ok: false,
        error: "tipoProveedor debe ser PERSONA_NATURAL o PERSONA_JURIDICA",
      });
    }

    if (tipo === "PERSONA_NATURAL") {
      if (!dni || !nombres || !apellidos) {
        return res.status(400).json({
          ok: false,
          error: "Para PERSONA_NATURAL son obligatorios: dni, nombres, apellidos",
        });
      }

      const existeDni = await prisma.proveedor.findFirst({
        where: {
          dni: String(dni).trim(),
        },
      });

      if (existeDni) {
        return res.status(400).json({
          ok: false,
          error: "Ya existe un proveedor con ese DNI",
        });
      }
    }

    if (tipo === "PERSONA_JURIDICA") {
      if (!ruc || !razonSocial) {
        return res.status(400).json({
          ok: false,
          error: "Para PERSONA_JURIDICA son obligatorios: ruc, razonSocial",
        });
      }

      const existeRuc = await prisma.proveedor.findFirst({
        where: {
          ruc: String(ruc).trim(),
        },
      });

      if (existeRuc) {
        return res.status(400).json({
          ok: false,
          error: "Ya existe un proveedor con ese RUC",
        });
      }
    }

    const codigo = await generarCodigoProveedor(prisma);

    const nuevo = await prisma.proveedor.create({
      data: {
        codigo,
        tipoProveedor: tipo,
        dni: dni ? String(dni).trim() : null,
        ruc: ruc ? String(ruc).trim() : null,
        nombres: nombres ? normalizarTexto(nombres) : null,
        apellidos: apellidos ? normalizarTexto(apellidos) : null,
        razonSocial: razonSocial ? normalizarTexto(razonSocial) : null,
        telefono: telefono ? String(telefono).trim() : null,
        email: email ? normalizarEmail(email) : null,
        direccion: direccion ? normalizarTexto(direccion) : null,
        contacto: contacto ? normalizarTexto(contacto) : null,
        estado: "ACTIVO",
      },
    });

    res.status(201).json({
      ok: true,
      data: nuevo,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// PUT /proveedores/:id
router.put("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;

    const {
      tipoProveedor,
      dni,
      ruc,
      nombres,
      apellidos,
      razonSocial,
      telefono,
      email,
      direccion,
      contacto,
    } = req.body;

    const actual = await prisma.proveedor.findUnique({
      where: { id },
    });

    if (!actual) {
      return res.status(404).json({
        ok: false,
        error: "Proveedor no encontrado",
      });
    }

    const tipo = tipoProveedor
      ? normalizarTexto(tipoProveedor)
      : actual.tipoProveedor;

    if (!["PERSONA_NATURAL", "PERSONA_JURIDICA"].includes(tipo)) {
      return res.status(400).json({
        ok: false,
        error: "tipoProveedor inválido",
      });
    }

    const dniVal = dni !== undefined ? String(dni || "").trim() : actual.dni;
    const rucVal = ruc !== undefined ? String(ruc || "").trim() : actual.ruc;
    const nombresVal =
      nombres !== undefined ? (nombres ? normalizarTexto(nombres) : null) : actual.nombres;
    const apellidosVal =
      apellidos !== undefined ? (apellidos ? normalizarTexto(apellidos) : null) : actual.apellidos;
    const razonSocialVal =
      razonSocial !== undefined
        ? razonSocial
          ? normalizarTexto(razonSocial)
          : null
        : actual.razonSocial;

    if (tipo === "PERSONA_NATURAL") {
      if (!dniVal || !nombresVal || !apellidosVal) {
        return res.status(400).json({
          ok: false,
          error: "Para PERSONA_NATURAL son obligatorios: dni, nombres, apellidos",
        });
      }
    }

    if (tipo === "PERSONA_JURIDICA") {
      if (!rucVal || !razonSocialVal) {
        return res.status(400).json({
          ok: false,
          error: "Para PERSONA_JURIDICA son obligatorios: ruc, razonSocial",
        });
      }
    }

    if (dniVal) {
      const existeDni = await prisma.proveedor.findFirst({
        where: {
          dni: dniVal,
          id: { not: id },
        },
      });

      if (existeDni) {
        return res.status(400).json({
          ok: false,
          error: "Ya existe otro proveedor con ese DNI",
        });
      }
    }

    if (rucVal) {
      const existeRuc = await prisma.proveedor.findFirst({
        where: {
          ruc: rucVal,
          id: { not: id },
        },
      });

      if (existeRuc) {
        return res.status(400).json({
          ok: false,
          error: "Ya existe otro proveedor con ese RUC",
        });
      }
    }

    const actualizado = await prisma.proveedor.update({
      where: { id },
      data: {
        tipoProveedor: tipo,
        dni: tipo === "PERSONA_NATURAL" ? dniVal || null : null,
        ruc: tipo === "PERSONA_JURIDICA" ? rucVal || null : null,
        nombres: tipo === "PERSONA_NATURAL" ? nombresVal || null : null,
        apellidos: tipo === "PERSONA_NATURAL" ? apellidosVal || null : null,
        razonSocial: tipo === "PERSONA_JURIDICA" ? razonSocialVal || null : null,
        telefono: telefono !== undefined ? String(telefono || "").trim() || null : actual.telefono,
        email: email !== undefined ? (email ? normalizarEmail(email) : null) : actual.email,
        direccion:
          direccion !== undefined ? (direccion ? normalizarTexto(direccion) : null) : actual.direccion,
        contacto:
          contacto !== undefined ? (contacto ? normalizarTexto(contacto) : null) : actual.contacto,
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

// PATCH /proveedores/:id/estado
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

    const proveedor = await prisma.proveedor.findUnique({
      where: { id },
    });

    if (!proveedor) {
      return res.status(404).json({
        ok: false,
        error: "Proveedor no encontrado",
      });
    }

    const actualizado = await prisma.proveedor.update({
      where: { id },
      data: { estado: estadoN },
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
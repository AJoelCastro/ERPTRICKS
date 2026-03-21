const express = require("express");

const router = express.Router();

console.log("PRODUCTOS ROUTES V3 CARGADO ✅");

function normalizarTexto(v) {
  return String(v || "").trim().toUpperCase();
}

async function generarCodigoProducto(prisma) {
  const total = await prisma.producto.count();
  return `PROD-${String(total + 1).padStart(6, "0")}`;
}

function slugTexto(v) {
  return normalizarTexto(v).replace(/\s+/g, "-");
}

function generarSku(producto) {
  return [
    slugTexto(producto.modelo),
    slugTexto(producto.color),
    slugTexto(producto.material),
    slugTexto(producto.taco),
    String(producto.talla),
  ].join("-");
}

async function generarCodigoBarrasUnico(prisma) {
  while (true) {
    const candidato = `775${Date.now()}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`.slice(0, 13);

    const existe = await prisma.inventario.findFirst({
      where: { codigoBarras: candidato },
    });

    if (!existe) return candidato;
  }
}

// GET /productos
router.get("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const productos = await prisma.producto.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.json({
      ok: true,
      version: "PRODUCTOS_V3",
      data: productos,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// GET /productos/:id
router.get("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;

    const producto = await prisma.producto.findUnique({
      where: { id },
    });

    if (!producto) {
      return res.status(404).json({
        ok: false,
        error: "Producto no encontrado",
      });
    }

    res.json({
      ok: true,
      version: "PRODUCTOS_V3",
      data: producto,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// POST /productos
router.post("/", async (req, res) => {
  try {
    console.log("POST /productos V3 ejecutado ✅");
    console.log("BODY:", req.body);

    const prisma = req.app.locals.prisma;

    const {
      modelo,
      color,
      material,
      taco,
      coleccion,
      costo,
      precio,
      talla,
      tallaDesde,
      tallaHasta,
    } = req.body;

    if (
      !modelo ||
      !color ||
      !material ||
      !taco ||
      costo === undefined ||
      precio === undefined
    ) {
      return res.status(400).json({
        ok: false,
        error: "modelo, color, material, taco, costo y precio son obligatorios",
      });
    }

    const costoNum = Number(costo);
    const precioNum = Number(precio);

    if (isNaN(costoNum) || isNaN(precioNum)) {
      return res.status(400).json({
        ok: false,
        error: "Costo y precio deben ser numéricos",
      });
    }

    let tallas = [];

    if (talla !== undefined && talla !== null && talla !== "") {
      const t = Number(talla);
      if (isNaN(t)) {
        return res.status(400).json({
          ok: false,
          error: "La talla es inválida",
        });
      }
      tallas = [t];
    } else if (
      tallaDesde !== undefined &&
      tallaHasta !== undefined &&
      tallaDesde !== "" &&
      tallaHasta !== ""
    ) {
      const desde = Number(tallaDesde);
      const hasta = Number(tallaHasta);

      if (isNaN(desde) || isNaN(hasta) || desde > hasta) {
        return res.status(400).json({
          ok: false,
          error: "Rango de tallas inválido",
        });
      }

      for (let t = desde; t <= hasta; t++) {
        tallas.push(t);
      }
    } else {
      return res.status(400).json({
        ok: false,
        error: "Debes enviar una talla o un rango tallaDesde/tallaHasta",
      });
    }

    const modeloN = normalizarTexto(modelo);
    const colorN = normalizarTexto(color);
    const materialN = normalizarTexto(material);
    const tacoN = normalizarTexto(taco);
    const coleccionN = coleccion ? normalizarTexto(coleccion) : null;

    const almacenFabrica = await prisma.almacen.findFirst({
      where: {
        codigo: "FABRICA",
      },
    });

    if (!almacenFabrica) {
      return res.status(400).json({
        ok: false,
        error: "No existe el almacén FABRICA. Créalo primero.",
      });
    }

    const creados = [];

    for (const t of tallas) {
      const existente = await prisma.producto.findFirst({
        where: {
          modelo: modeloN,
          color: colorN,
          material: materialN,
          taco: tacoN,
          coleccion: coleccionN,
          talla: t,
        },
      });

      if (existente) {
        continue;
      }

      const creado = await prisma.$transaction(async (tx) => {
        const codigo = await generarCodigoProducto(tx);

        const nuevoProducto = await tx.producto.create({
          data: {
            codigo,
            modelo: modeloN,
            color: colorN,
            material: materialN,
            taco: tacoN,
            coleccion: coleccionN,
            talla: t,
            costo: costoNum,
            precio: precioNum,
          },
        });

        const sku = generarSku(nuevoProducto);
        const codigoBarras = await generarCodigoBarrasUnico(tx);

        const inventario = await tx.inventario.create({
          data: {
            productoId: nuevoProducto.id,
            almacenId: almacenFabrica.id,
            codigoBarras,
            sku,
            stock: 0,
          },
        });

        return {
          producto: nuevoProducto,
          inventario,
        };
      });

      creados.push(creado);
    }

    res.status(201).json({
      ok: true,
      version: "PRODUCTOS_V3",
      message: `${creados.length} producto(s) creado(s) con inventario automático`,
      data: creados,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// PUT /productos/:id
router.put("/:id", async (req, res) => {
  try {
    console.log("PUT /productos/:id V3 ejecutado ✅");

    const prisma = req.app.locals.prisma;
    const { id } = req.params;

    const {
      modelo,
      color,
      material,
      taco,
      coleccion,
      talla,
      costo,
      precio,
    } = req.body;

    const producto = await prisma.producto.findUnique({
      where: { id },
    });

    if (!producto) {
      return res.status(404).json({
        ok: false,
        error: "Producto no encontrado",
      });
    }

    const actualizado = await prisma.producto.update({
      where: { id },
      data: {
        modelo:
          modelo !== undefined ? normalizarTexto(modelo) : producto.modelo,
        color: color !== undefined ? normalizarTexto(color) : producto.color,
        material:
          material !== undefined
            ? normalizarTexto(material)
            : producto.material,
        taco: taco !== undefined ? normalizarTexto(taco) : producto.taco,
        coleccion:
          coleccion !== undefined
            ? coleccion
              ? normalizarTexto(coleccion)
              : null
            : producto.coleccion,
        talla: talla !== undefined ? Number(talla) : producto.talla,
        costo: costo !== undefined ? Number(costo) : producto.costo,
        precio: precio !== undefined ? Number(precio) : producto.precio,
      },
    });

    res.json({
      ok: true,
      version: "PRODUCTOS_V3",
      data: actualizado,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// PATCH /productos/:id/estado
router.patch("/:id/estado", async (req, res) => {
  try {
    console.log("PATCH /productos/:id/estado V3 ejecutado ✅");

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

    const producto = await prisma.producto.findUnique({
      where: { id },
    });

    if (!producto) {
      return res.status(404).json({
        ok: false,
        error: "Producto no encontrado",
      });
    }

    const actualizado = await prisma.producto.update({
      where: { id },
      data: {
        estado: estadoN,
      },
    });

    res.json({
      ok: true,
      version: "PRODUCTOS_V3",
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
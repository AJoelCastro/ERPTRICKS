const bcrypt = require("bcryptjs");
const prisma = require("../src/lib/prisma");

const permisosBase = [
  ["dashboard.ver", "Ver dashboard", "DASHBOARD"],
  ["productos.ver", "Ver productos", "PRODUCTOS"],
  ["productos.crear", "Crear productos", "PRODUCTOS"],
  ["productos.editar", "Editar productos", "PRODUCTOS"],
  ["productos.inactivar", "Inactivar productos", "PRODUCTOS"],

  ["inventario.ver", "Ver inventario", "INVENTARIO"],
  ["inventario.movimientos", "Registrar movimientos inventario", "INVENTARIO"],
  ["inventario.scanner", "Usar scanner inventario", "INVENTARIO"],

  ["clientes.ver", "Ver clientes", "CLIENTES"],
  ["clientes.crear", "Crear clientes", "CLIENTES"],
  ["clientes.editar", "Editar clientes", "CLIENTES"],

  ["pedidos.ver", "Ver pedidos", "PEDIDOS"],
  ["pedidos.crear", "Crear pedidos", "PEDIDOS"],
  ["pedidos.editar", "Editar pedidos", "PEDIDOS"],
  ["pedidos.pagos", "Registrar pagos pedidos", "PEDIDOS"],
  ["pedidos.produccion", "Mandar pedidos a producción", "PEDIDOS"],

  ["ventas.ver", "Ver ventas", "VENTAS"],
  ["ventas.crear", "Crear ventas", "VENTAS"],
  ["ventas.pagos", "Registrar pagos ventas", "VENTAS"],
  ["ventas.imprimir", "Imprimir comprobantes", "VENTAS"],

  ["produccion.ver", "Ver producción", "PRODUCCION"],
  ["produccion.iniciar", "Iniciar etapas producción", "PRODUCCION"],
  ["produccion.finalizar", "Finalizar etapas producción", "PRODUCCION"],
  ["produccion.etiquetas", "Emitir etiquetas", "PRODUCCION"],
  ["produccion.scanner", "Usar scanner producción", "PRODUCCION"],

  ["caja.ver", "Ver caja", "CAJA"],
  ["caja.abrir", "Abrir caja", "CAJA"],
  ["caja.cerrar", "Cerrar caja", "CAJA"],
  ["caja.movimientos", "Registrar movimientos caja", "CAJA"],

  ["proveedores.ver", "Ver proveedores", "PROVEEDORES"],
  ["proveedores.crear", "Crear proveedores", "PROVEEDORES"],
  ["proveedores.editar", "Editar proveedores", "PROVEEDORES"],

  ["compras.ver", "Ver compras", "COMPRAS"],
  ["compras.crear", "Crear compras", "COMPRAS"],
  ["compras.pagos", "Registrar pagos compras", "COMPRAS"],
  ["compras.ingresar_inventario", "Ingresar compras a inventario", "COMPRAS"],

  ["usuarios.ver", "Ver usuarios", "USUARIOS"],
  ["usuarios.crear", "Crear usuarios", "USUARIOS"],
  ["usuarios.editar", "Editar usuarios", "USUARIOS"],
  ["usuarios.roles", "Gestionar roles", "USUARIOS"],
  ["usuarios.permisos", "Gestionar permisos", "USUARIOS"],
];

async function main() {
  for (const [codigo, nombre, modulo] of permisosBase) {
    await prisma.permiso.upsert({
      where: { codigo },
      update: { nombre, modulo },
      create: { codigo, nombre, modulo },
    });
  }

  const adminRole = await prisma.rol.upsert({
    where: { codigo: "ADMIN" },
    update: {
      nombre: "Administrador",
      descripcion: "Acceso total",
      activo: true,
    },
    create: {
      codigo: "ADMIN",
      nombre: "Administrador",
      descripcion: "Acceso total",
      activo: true,
    },
  });

  const allPermisos = await prisma.permiso.findMany();

  await prisma.rolPermiso.deleteMany({
    where: { rolId: adminRole.id },
  });

  if (allPermisos.length > 0) {
    await prisma.rolPermiso.createMany({
      data: allPermisos.map((p) => ({
        rolId: adminRole.id,
        permisoId: p.id,
      })),
      skipDuplicates: true,
    });
  }

  const passwordHash = await bcrypt.hash("Admin123*", 10);

  let adminUser = await prisma.usuario.findUnique({
    where: { email: "admin@erp.com" },
  });

  if (adminUser) {
    adminUser = await prisma.usuario.update({
      where: { id: adminUser.id },
      data: {
        username: adminUser.username || "admin",
        passwordHash: adminUser.passwordHash || passwordHash,
        nombre: adminUser.nombre || "Administrador ERP",
        activo: true,
      },
    });
  } else {
    adminUser = await prisma.usuario.create({
      data: {
        email: "admin@erp.com",
        username: "admin",
        passwordHash,
        nombre: "Administrador ERP",
        activo: true,
      },
    });
  }

  const yaTieneRol = await prisma.usuarioRol.findFirst({
    where: {
      usuarioId: adminUser.id,
      rolId: adminRole.id,
    },
  });

  if (!yaTieneRol) {
    await prisma.usuarioRol.create({
      data: {
        usuarioId: adminUser.id,
        rolId: adminRole.id,
      },
    });
  }

  console.log("Seed completado correctamente");
  console.log("Usuario:", adminUser.username);
  console.log("Password: Admin123*");
}

main()
  .catch((e) => {
    console.error("Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
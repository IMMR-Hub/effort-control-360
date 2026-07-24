/**
 * Tests de integración contra PostgreSQL real.
 *
 * Verifican lo que los dobles de prueba no pueden: que el SQL sea correcto, que
 * las restricciones de la base se apliquen, y que los disparadores de
 * inmutabilidad frenen de verdad.
 *
 * Corren en un esquema propio que se destruye al final. Si no hay base
 * configurada, se saltean.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HAY_BASE_DE_DATOS, crearEntorno, type EntornoDePrueba } from './entorno.js';
import { UsuariosPrisma } from '../../src/repositorios/usuarios.js';
import { SesionesPrisma } from '../../src/repositorios/sesiones.js';
import { ClientesPrisma } from '../../src/repositorios/clientes.js';
import { ContactosPrisma } from '../../src/repositorios/contactos.js';
import { BitacoraPrisma } from '../../src/repositorios/bitacora.js';
import { prepararEntrada } from '../../src/bitacora.js';

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

describeSiHayBase('repositorios contra PostgreSQL real', () => {
  let entorno: EntornoDePrueba;
  let usuarios: UsuariosPrisma;
  let sesiones: SesionesPrisma;
  let clientes: ClientesPrisma;
  let contactos: ContactosPrisma;
  let bitacora: BitacoraPrisma;

  let idAuxiliar = '';
  let idDireccion = '';
  let idClienteAsignado = '';
  let idClienteAjeno = '';

  beforeAll(async () => {
    entorno = await crearEntorno();

    usuarios = new UsuariosPrisma(entorno.prisma);
    sesiones = new SesionesPrisma(entorno.prisma);
    clientes = new ClientesPrisma(entorno.prisma);
    contactos = new ContactosPrisma(entorno.prisma);
    bitacora = new BitacoraPrisma(entorno.prisma);

    const auxiliar = await entorno.prisma.usuario.create({
      data: {
        nombre: 'Aracely', apellido: 'Gaona', email: 'aracely@effort.com.py',
        rol: 'auxiliar', hashContrasena: '$argon2id$prueba', veTodosLosClientes: false,
      },
    });
    idAuxiliar = auxiliar.id;

    const direccion = await entorno.prisma.usuario.create({
      data: {
        nombre: 'Lili', apellido: 'Dirección', email: 'lili@effort.com.py',
        rol: 'direccion', hashContrasena: '$argon2id$prueba', veTodosLosClientes: true,
      },
    });
    idDireccion = direccion.id;

    const asignado = await entorno.prisma.cliente.create({
      data: { nombre: 'GARSO S.A.', ruc: '80017726-6', tipoPersona: 'JURIDICA' },
    });
    idClienteAsignado = asignado.id;

    const ajeno = await entorno.prisma.cliente.create({
      data: { nombre: 'CLIENTE AJENO S.A.', ruc: '80019012-2', tipoPersona: 'JURIDICA' },
    });
    idClienteAjeno = ajeno.id;

    await entorno.prisma.asignacionCliente.create({
      data: { clienteId: idClienteAsignado, usuarioId: idAuxiliar, rol: 'auxiliar' },
    });
  }, 120_000);

  afterAll(async () => {
    await entorno?.destruir();
  }, 60_000);

  /* --- Usuarios ---------------------------------------------------------- */

  describe('usuarios', () => {
    it('encuentra por correo y devuelve las credenciales que el acceso necesita', async () => {
      const usuario = await usuarios.buscarPorEmail('aracely@effort.com.py');

      expect(usuario?.id).toBe(idAuxiliar);
      expect(usuario?.rol).toBe('auxiliar');
      expect(usuario?.hashContrasena).toBe('$argon2id$prueba');
    });

    it('devuelve null para un correo inexistente, sin lanzar', async () => {
      expect(await usuarios.buscarPorEmail('nadie@effort.com.py')).toBeNull();
    });

    it('el correo es único: no se pueden crear dos usuarios con el mismo', async () => {
      await expect(
        entorno.prisma.usuario.create({
          data: {
            nombre: 'Impostor', apellido: 'X', email: 'aracely@effort.com.py',
            rol: 'auxiliar', hashContrasena: '$argon2id$otro',
          },
        }),
      ).rejects.toThrow();
    });

    it('trae los clientes asignados vigentes', async () => {
      expect(await usuarios.clientesAsignados(idAuxiliar)).toEqual([idClienteAsignado]);
    });

    it('una asignación terminada deja de contar', async () => {
      const temporal = await entorno.prisma.cliente.create({
        data: { nombre: 'CLIENTE TEMPORAL', ruc: '80022588-0', tipoPersona: 'JURIDICA' },
      });

      await entorno.prisma.asignacionCliente.create({
        data: {
          clienteId: temporal.id, usuarioId: idAuxiliar, rol: 'coordinador',
          hasta: new Date('2020-01-01'),
        },
      });

      const asignados = await usuarios.clientesAsignados(idAuxiliar);
      expect(asignados).not.toContain(temporal.id);
    });

    it('un usuario sin asignaciones devuelve lista vacía, no todos', async () => {
      expect(await usuarios.clientesAsignados(idDireccion)).toEqual([]);
    });

    it('registra el último acceso', async () => {
      const momento = new Date('2026-07-22T12:00:00Z');
      await usuarios.registrarAcceso(idAuxiliar, momento);

      const fila = await entorno.prisma.usuario.findUnique({
        where: { id: idAuxiliar }, select: { ultimoAccesoEn: true },
      });
      expect(fila?.ultimoAccesoEn?.toISOString()).toBe(momento.toISOString());
    });

    describe('alta, edición y cartera', () => {
      it('crea un usuario y lo devuelve sin credenciales en el tipo de listado', async () => {
        const nuevo = await usuarios.crear({
          nombre: 'Nueva', apellido: 'Persona', email: 'nueva.integracion@effort.com.py',
          telefono: null, cargo: null, rol: 'auxiliar', veTodosLosClientes: false,
          hashContrasena: '$argon2id$prueba', creadoPorUsuarioId: idDireccion,
        });

        expect(nuevo.email).toBe('nueva.integracion@effort.com.py');
        expect(nuevo.activo).toBe(true);
        expect('hashContrasena' in nuevo).toBe(false);

        // El hash sí se guardó — se comprueba directo contra la base, no por el
        // puerto de listado, que a propósito no lo expone.
        const credenciales = await usuarios.buscarPorEmail('nueva.integracion@effort.com.py');
        expect(credenciales?.hashContrasena).toBe('$argon2id$prueba');
      });

      it('la base impide crear dos usuarios con el mismo correo', async () => {
        await usuarios.crear({
          nombre: 'Uno', apellido: 'X', email: 'duplicado.integracion@effort.com.py',
          telefono: null, cargo: null, rol: 'auxiliar', veTodosLosClientes: false,
          hashContrasena: '$argon2id$prueba', creadoPorUsuarioId: idDireccion,
        });

        await expect(
          usuarios.crear({
            nombre: 'Dos', apellido: 'Y', email: 'duplicado.integracion@effort.com.py',
            telefono: null, cargo: null, rol: 'auxiliar', veTodosLosClientes: false,
            hashContrasena: '$argon2id$otro', creadoPorUsuarioId: idDireccion,
          }),
        ).rejects.toThrow();
      });

      it('listar trae el equipo completo, ordenado, y buscarListadoPorId respeta el id', async () => {
        const lista = await usuarios.listar();
        expect(lista.map((u) => u.id)).toContain(idAuxiliar);

        const encontrado = await usuarios.buscarListadoPorId(idAuxiliar);
        expect(encontrado?.email).toBe('aracely@effort.com.py');

        expect(await usuarios.buscarListadoPorId('00000000-0000-4000-8000-000000000000')).toBeNull();
      });

      it('actualizar cambia solo los campos indicados', async () => {
        const usuario = await usuarios.crear({
          nombre: 'Editable', apellido: 'Original', email: 'editable.integracion@effort.com.py',
          telefono: null, cargo: null, rol: 'auxiliar', veTodosLosClientes: false,
          hashContrasena: '$argon2id$prueba', creadoPorUsuarioId: idDireccion,
        });

        const actualizado = await usuarios.actualizar(
          usuario.id, { activo: false, cargo: 'Auxiliar contable' }, idDireccion,
        );

        expect(actualizado.activo).toBe(false);
        expect(actualizado.cargo).toBe('Auxiliar contable');
        // No se tocó: sigue siendo el mismo nombre con el que se creó.
        expect(actualizado.nombre).toBe('Editable');
      });

      it('reemplazarCartera abre lo nuevo y cierra lo que ya no corresponde', async () => {
        const usuario = await usuarios.crear({
          nombre: 'Cartera', apellido: 'Prueba', email: 'cartera.integracion@effort.com.py',
          telefono: null, cargo: null, rol: 'auxiliar', veTodosLosClientes: false,
          hashContrasena: '$argon2id$prueba', creadoPorUsuarioId: idDireccion,
        });

        const momento1 = new Date('2026-06-01T00:00:00Z');
        await usuarios.reemplazarCartera(usuario.id, [idClienteAsignado], 'auxiliar', momento1);
        expect(await usuarios.clientesAsignados(usuario.id)).toEqual([idClienteAsignado]);

        const momento2 = new Date('2026-06-15T00:00:00Z');
        await usuarios.reemplazarCartera(usuario.id, [idClienteAjeno], 'auxiliar', momento2);

        // El nuevo cliente entra, el viejo sale.
        const cartera = await usuarios.clientesAsignados(usuario.id);
        expect(cartera).toEqual([idClienteAjeno]);

        // Y la fila vieja no se borró: se cerró con `hasta`, para que el
        // historial siga contando quién llevó qué cliente y hasta cuándo.
        const filaVieja = await entorno.prisma.asignacionCliente.findFirst({
          where: { usuarioId: usuario.id, clienteId: idClienteAsignado },
        });
        expect(filaVieja?.hasta?.toISOString()).toBe(momento2.toISOString());
      });

      it('un ascenso de rol abre una fila nueva en el mismo cliente en vez de mutar la vieja', async () => {
        const usuario = await usuarios.crear({
          nombre: 'Asciende', apellido: 'Prueba', email: 'asciende.integracion@effort.com.py',
          telefono: null, cargo: null, rol: 'auxiliar', veTodosLosClientes: false,
          hashContrasena: '$argon2id$prueba', creadoPorUsuarioId: idDireccion,
        });

        const momento1 = new Date('2026-06-01T00:00:00Z');
        await usuarios.reemplazarCartera(usuario.id, [idClienteAsignado], 'auxiliar', momento1);

        const momento2 = new Date('2026-07-01T00:00:00Z');
        await usuarios.reemplazarCartera(usuario.id, [idClienteAsignado], 'coordinador', momento2);

        // Sigue viendo el mismo cliente...
        expect(await usuarios.clientesAsignados(usuario.id)).toEqual([idClienteAsignado]);

        // ...pero ahora hay dos filas: la de auxiliar, cerrada, y la de
        // coordinador, vigente. El historial dice desde cuándo ejerció cada rol.
        const filas = await entorno.prisma.asignacionCliente.findMany({
          where: { usuarioId: usuario.id, clienteId: idClienteAsignado },
          orderBy: { desde: 'asc' },
        });
        expect(filas).toHaveLength(2);
        expect(filas[0]?.rol).toBe('auxiliar');
        expect(filas[0]?.hasta?.toISOString()).toBe(momento2.toISOString());
        expect(filas[1]?.rol).toBe('coordinador');
        expect(filas[1]?.hasta).toBeNull();
      });

      it('reemplazarCartera con lista vacía cierra toda la cartera vigente', async () => {
        const usuario = await usuarios.crear({
          nombre: 'Vacia', apellido: 'Prueba', email: 'vacia.integracion@effort.com.py',
          telefono: null, cargo: null, rol: 'auxiliar', veTodosLosClientes: false,
          hashContrasena: '$argon2id$prueba', creadoPorUsuarioId: idDireccion,
        });

        await usuarios.reemplazarCartera(
          usuario.id, [idClienteAsignado], 'auxiliar', new Date('2026-06-01T00:00:00Z'),
        );
        await usuarios.reemplazarCartera(usuario.id, [], null, new Date('2026-06-20T00:00:00Z'));

        expect(await usuarios.clientesAsignados(usuario.id)).toEqual([]);
      });
    });
  });

  /* --- Sesiones ---------------------------------------------------------- */

  describe('sesiones', () => {
    it('crea la sesión trayendo el rol del usuario', async () => {
      const sesion = await sesiones.crear({
        hashDelToken: 'a'.repeat(64), usuarioId: idAuxiliar,
        segundoFactorSuperado: true, ipTruncada: '190.128.50.0', agenteUsuario: 'prueba',
      });

      expect(sesion.rol).toBe('auxiliar');
      expect(sesion.revocadaEn).toBeNull();
    });

    it('el rol se lee del usuario en cada consulta, no queda congelado en la sesión', async () => {
      const usuario = await entorno.prisma.usuario.create({
        data: {
          nombre: 'Cambia', apellido: 'Rol', email: 'cambia@effort.com.py',
          rol: 'auxiliar', hashContrasena: '$argon2id$prueba',
        },
      });

      const hash = 'b'.repeat(64);
      await sesiones.crear({
        hashDelToken: hash, usuarioId: usuario.id,
        segundoFactorSuperado: true, ipTruncada: null, agenteUsuario: null,
      });

      await entorno.prisma.usuario.update({
        where: { id: usuario.id }, data: { rol: 'solo_lectura' },
      });

      // Si el rol estuviera copiado en la tabla sesion, esta sesión seguiría
      // operando como auxiliar hasta que la persona cerrara sesión.
      const recuperada = await sesiones.buscarPorHash(hash);
      expect(recuperada?.rol).toBe('solo_lectura');
    });

    it('el hash del token es único: no puede haber dos sesiones con el mismo', async () => {
      const hash = 'c'.repeat(64);
      await sesiones.crear({
        hashDelToken: hash, usuarioId: idAuxiliar,
        segundoFactorSuperado: true, ipTruncada: null, agenteUsuario: null,
      });

      await expect(
        sesiones.crear({
          hashDelToken: hash, usuarioId: idDireccion,
          segundoFactorSuperado: true, ipTruncada: null, agenteUsuario: null,
        }),
      ).rejects.toThrow();
    });

    it('revoca una sesión con su motivo', async () => {
      const hash = 'd'.repeat(64);
      const sesion = await sesiones.crear({
        hashDelToken: hash, usuarioId: idAuxiliar,
        segundoFactorSuperado: true, ipTruncada: null, agenteUsuario: null,
      });

      const momento = new Date();
      await sesiones.revocar(sesion.id, momento, 'salida_voluntaria');

      const recuperada = await sesiones.buscarPorHash(hash);
      expect(recuperada?.revocadaEn).not.toBeNull();
    });

    it('revoca todas las del usuario sin pisar las ya cerradas', async () => {
      const usuario = await entorno.prisma.usuario.create({
        data: {
          nombre: 'Multi', apellido: 'Sesion', email: 'multi@effort.com.py',
          rol: 'auxiliar', hashContrasena: '$argon2id$prueba',
        },
      });

      const cerradaAntes = await sesiones.crear({
        hashDelToken: 'e'.repeat(64), usuarioId: usuario.id,
        segundoFactorSuperado: true, ipTruncada: null, agenteUsuario: null,
      });
      const revocacionOriginal = new Date('2026-01-01T00:00:00Z');
      await sesiones.revocar(cerradaAntes.id, revocacionOriginal, 'salida_voluntaria');

      await sesiones.crear({
        hashDelToken: 'f'.repeat(64), usuarioId: usuario.id,
        segundoFactorSuperado: true, ipTruncada: null, agenteUsuario: null,
      });

      await sesiones.revocarTodasDelUsuario(usuario.id, new Date(), 'baja_de_empleado');

      const previa = await sesiones.buscarPorHash('e'.repeat(64));
      const nueva = await sesiones.buscarPorHash('f'.repeat(64));

      // La ya cerrada conserva su fecha original: no se reescribe el historial.
      expect(previa?.revocadaEn?.toISOString()).toBe(revocacionOriginal.toISOString());
      expect(nueva?.revocadaEn).not.toBeNull();
    });

    it('renueva la ventana de inactividad', async () => {
      const hash = '1'.repeat(64);
      const sesion = await sesiones.crear({
        hashDelToken: hash, usuarioId: idAuxiliar,
        segundoFactorSuperado: true, ipTruncada: null, agenteUsuario: null,
      });

      const despues = new Date(Date.now() + 60_000);
      await sesiones.tocar(sesion.id, despues);

      const recuperada = await sesiones.buscarPorHash(hash);
      expect(recuperada!.ultimoUsoEn.getTime()).toBeGreaterThan(sesion.ultimoUsoEn.getTime());
    });
  });

  /* --- Clientes: el filtro de cartera aplicado en SQL --------------------- */

  describe('clientes', () => {
    it('sin filtro devuelve toda la cartera', async () => {
      const lista = await clientes.listar(null);
      const ids = lista.map((cliente) => cliente.id);

      expect(ids).toContain(idClienteAsignado);
      expect(ids).toContain(idClienteAjeno);
    });

    it('con filtro devuelve solo los de la cartera', async () => {
      const lista = await clientes.listar([idClienteAsignado]);

      expect(lista).toHaveLength(1);
      expect(lista[0]?.id).toBe(idClienteAsignado);
    });

    it('un filtro vacío no devuelve nada, en vez de devolver todo', async () => {
      // Es el caso que suele fallar: tratar el arreglo vacío como "sin filtro"
      // le mostraría la cartera entera a un usuario sin clientes asignados.
      expect(await clientes.listar([])).toEqual([]);
    });

    it('buscar un cliente fuera de la cartera devuelve null', async () => {
      expect(await clientes.buscarPorId(idClienteAjeno, [idClienteAsignado])).toBeNull();
    });

    it('buscar un cliente de la cartera lo devuelve', async () => {
      const cliente = await clientes.buscarPorId(idClienteAsignado, [idClienteAsignado]);
      expect(cliente?.nombre).toBe('GARSO S.A.');
    });

    it('devuelve el cliente pedido, no otro de la cartera', async () => {
      // Regresión: las dos condiciones se expresan sobre `id`, y combinarlas
      // con spread hacía que la segunda pisara a la primera. La consulta perdía
      // el identificador solicitado y devolvía cualquier cliente de la cartera:
      // pedir el cliente X devolvía el cliente Y.
      const cartera = [idClienteAsignado, idClienteAjeno];

      const primero = await clientes.buscarPorId(idClienteAsignado, cartera);
      const segundo = await clientes.buscarPorId(idClienteAjeno, cartera);

      expect(primero?.id).toBe(idClienteAsignado);
      expect(segundo?.id).toBe(idClienteAjeno);
      expect(primero?.id).not.toBe(segundo?.id);
    });

    it('devuelve null para un cliente inexistente aunque no haya filtro', async () => {
      expect(
        await clientes.buscarPorId('00000000-0000-4000-8000-000000000000', null),
      ).toBeNull();
    });

    it('el RUC es único: no se puede cargar dos veces el mismo cliente', async () => {
      await expect(
        entorno.prisma.cliente.create({
          data: { nombre: 'GARSO DUPLICADO', ruc: '80017726-6', tipoPersona: 'JURIDICA' },
        }),
      ).rejects.toThrow();
    });

    describe('alta y edición', () => {
      it('crea un cliente y lo encuentra después por RUC', async () => {
        const nuevo = await clientes.crear({
          nombre: 'Nuevo Cliente Integración S.A.', ruc: '80030001-7', tipoPersona: 'JURIDICA',
          regimenTributario: null, email: null, telefono: null, canalPreferido: null,
          observaciones: null, creadoPorUsuarioId: idDireccion,
        });

        expect(nuevo.ruc).toBe('80030001-7');
        expect(nuevo.activo).toBe(true);

        const encontrado = await clientes.buscarPorRuc('80030001-7');
        expect(encontrado?.id).toBe(nuevo.id);
      });

      it('la base impide crear dos clientes con el mismo RUC', async () => {
        await clientes.crear({
          nombre: 'Uno', ruc: '80066666-6', tipoPersona: 'JURIDICA',
          regimenTributario: null, email: null, telefono: null, canalPreferido: null,
          observaciones: null, creadoPorUsuarioId: idDireccion,
        });

        await expect(
          clientes.crear({
            nombre: 'Dos', ruc: '80066666-6', tipoPersona: 'JURIDICA',
            regimenTributario: null, email: null, telefono: null, canalPreferido: null,
            observaciones: null, creadoPorUsuarioId: idDireccion,
          }),
        ).rejects.toThrow();
      });

      it('buscarPorRuc devuelve null para un RUC inexistente', async () => {
        expect(await clientes.buscarPorRuc('80011111-7')).toBeNull();
      });

      it('actualizar cambia solo los campos indicados', async () => {
        const cliente = await clientes.crear({
          nombre: 'Editable Integración S.A.', ruc: '80022222-9', tipoPersona: 'JURIDICA',
          regimenTributario: null, email: null, telefono: null, canalPreferido: null,
          observaciones: null, creadoPorUsuarioId: idDireccion,
        });

        const actualizado = await clientes.actualizar(
          cliente.id, { activo: false, observaciones: 'Baja temporal.' }, idDireccion,
        );

        expect(actualizado.activo).toBe(false);
        expect(actualizado.observaciones).toBe('Baja temporal.');
        // No se tocó: sigue siendo el mismo nombre con el que se creó.
        expect(actualizado.nombre).toBe('Editable Integración S.A.');
      });

      it('actualizar puede corregir el RUC', async () => {
        const cliente = await clientes.crear({
          nombre: 'RUC a corregir S.A.', ruc: '80033333-0', tipoPersona: 'JURIDICA',
          regimenTributario: null, email: null, telefono: null, canalPreferido: null,
          observaciones: null, creadoPorUsuarioId: idDireccion,
        });

        const actualizado = await clientes.actualizar(cliente.id, { ruc: '80044444-2' }, idDireccion);

        expect(actualizado.ruc).toBe('80044444-2');
        expect(await clientes.buscarPorRuc('80033333-0')).toBeNull();
      });
    });
  });

  /* --- Contactos --------------------------------------------------------- */

  describe('bitácora de contactos', () => {
    it('registra un contacto y lo recupera por cliente y período', async () => {
      await contactos.registrar({
        clienteId: idClienteAsignado, periodo: '2026-03', canal: 'LLAMADA',
        direccion: 'SALIENTE', origenContacto: 'MANUAL',
        ocurridoEn: new Date('2026-04-10T13:00:00Z'), registradoPorUsuarioId: idAuxiliar,
        huboRespuesta: true, quienAtendio: 'Sra. González',
        resumen: 'Se pidieron las facturas de marzo.', evidenciaId: null,
      });

      const lista = await contactos.listarPorCliente(idClienteAsignado, '2026-03');

      expect(lista).toHaveLength(1);
      expect(lista[0]?.quienAtendio).toBe('Sra. González');
      expect(lista[0]?.origenContacto).toBe('MANUAL');
    });

    it('no mezcla períodos', async () => {
      await contactos.registrar({
        clienteId: idClienteAsignado, periodo: '2026-04', canal: 'WHATSAPP',
        direccion: 'SALIENTE', origenContacto: 'AUTOMATICO',
        ocurridoEn: new Date('2026-05-02T10:00:00Z'), registradoPorUsuarioId: idAuxiliar,
        huboRespuesta: false, quienAtendio: null,
        resumen: 'Recordatorio de abril.', evidenciaId: null,
      });

      expect(await contactos.listarPorCliente(idClienteAsignado, '2026-03')).toHaveLength(1);
      expect(await contactos.listarPorCliente(idClienteAsignado, '2026-04')).toHaveLength(1);
      expect(await contactos.listarPorCliente(idClienteAsignado, null)).toHaveLength(2);
    });

    it('ordena del más reciente al más antiguo', async () => {
      const lista = await contactos.listarPorCliente(idClienteAsignado, null);
      expect(lista[0]!.ocurridoEn.getTime()).toBeGreaterThan(lista[1]!.ocurridoEn.getTime());
    });

    it('un contacto no se puede borrar: es evidencia', async () => {
      const lista = await contactos.listarPorCliente(idClienteAsignado, '2026-03');
      const id = lista[0]!.id;

      await expect(
        entorno.prisma.$executeRawUnsafe(`DELETE FROM registro_contacto WHERE id = '${id}'`),
      ).rejects.toThrow();

      // Y sigue ahí después del intento.
      expect(await contactos.listarPorCliente(idClienteAsignado, '2026-03')).toHaveLength(1);
    });
  });

  /* --- Bitácora de eventos: inmutabilidad real ---------------------------- */

  describe('registro de eventos', () => {
    it('escribe una entrada saneada', async () => {
      await bitacora.registrar(
        prepararEntrada({
          usuarioId: idAuxiliar,
          accion: 'contacto.registrado',
          entidad: 'registro_contacto',
          entidadId: 'algun-id',
          clienteId: idClienteAsignado,
          datosDespues: { canal: 'LLAMADA', password: 'secreta', email: 'x@y.com' },
          ip: '190.128.50.77',
          agenteUsuario: 'Mozilla/5.0',
          peticionId: 'pet-abc',
        }),
      );

      const filas = await entorno.prisma.eventLog.findMany({
        where: { accion: 'contacto.registrado' },
      });

      expect(filas).toHaveLength(1);
      expect(filas[0]?.ipTruncada).toBe('190.128.50.0');

      const datos = filas[0]?.datosDespues as Record<string, unknown>;
      expect(datos['password']).toBe('[oculto]');
      expect(datos['email']).toBe('x***@y.com');
    });

    it('no se puede modificar una entrada ya escrita', async () => {
      const fila = await entorno.prisma.eventLog.create({
        data: { accion: 'prueba.inmutable', entidad: 'sistema' },
      });

      await expect(
        entorno.prisma.$executeRawUnsafe(
          `UPDATE event_log SET accion = 'alterado' WHERE id = '${fila.id}'`,
        ),
      ).rejects.toThrow();

      const sinCambios = await entorno.prisma.eventLog.findUnique({ where: { id: fila.id } });
      expect(sinCambios?.accion).toBe('prueba.inmutable');
    });

    it('no se puede borrar una entrada', async () => {
      const fila = await entorno.prisma.eventLog.create({
        data: { accion: 'prueba.no.borrable', entidad: 'sistema' },
      });

      await expect(
        entorno.prisma.$executeRawUnsafe(`DELETE FROM event_log WHERE id = '${fila.id}'`),
      ).rejects.toThrow();

      expect(await entorno.prisma.eventLog.findUnique({ where: { id: fila.id } })).not.toBeNull();
    });

    it('no se puede vaciar la tabla con TRUNCATE', async () => {
      // TRUNCATE no dispara los disparadores de fila: sin uno propio a nivel de
      // sentencia, esta sola línea borraría toda la trazabilidad del sistema.
      await expect(entorno.prisma.$executeRawUnsafe('TRUNCATE event_log')).rejects.toThrow();

      const cuantas = await entorno.prisma.eventLog.count();
      expect(cuantas).toBeGreaterThan(0);
    });

    describe('consulta filtrable', () => {
      it('filtra por entidad y entidadId', async () => {
        await bitacora.registrar(
          prepararEntrada({
            usuarioId: idAuxiliar, accion: 'prueba.consulta.uno', entidad: 'prueba_consulta',
            entidadId: 'id-1', clienteId: null,
          }),
        );
        await bitacora.registrar(
          prepararEntrada({
            usuarioId: idAuxiliar, accion: 'prueba.consulta.dos', entidad: 'prueba_consulta',
            entidadId: 'id-2', clienteId: null,
          }),
        );

        const filtrada = await bitacora.listar(
          { entidad: 'prueba_consulta', entidadId: 'id-1' }, null, 50, 0,
        );

        expect(filtrada.map((e) => e.accion)).toEqual(['prueba.consulta.uno']);
      });

      it('filtra por rango de fechas', async () => {
        const anteayer = new Date('2020-01-01T00:00:00Z');
        const fila = await entorno.prisma.eventLog.create({
          data: {
            accion: 'prueba.fecha.vieja', entidad: 'prueba_fecha', ocurridoEn: anteayer,
          },
        });

        // Falla si la fila anterior queda dentro de un rango que empieza hoy.
        const desdeHoy = await bitacora.listar(
          { entidad: 'prueba_fecha', desde: new Date('2026-01-01T00:00:00Z') }, null, 50, 0,
        );
        expect(desdeHoy.map((e) => e.id)).not.toContain(fila.id);

        const incluyeVieja = await bitacora.listar(
          { entidad: 'prueba_fecha', hasta: new Date('2020-12-31T00:00:00Z') }, null, 50, 0,
        );
        expect(incluyeVieja.map((e) => e.id)).toContain(fila.id);
      });

      it('devuelve la más reciente primero', async () => {
        await entorno.prisma.eventLog.create({
          data: { accion: 'prueba.orden.a', entidad: 'prueba_orden', ocurridoEn: new Date('2026-01-01T00:00:00Z') },
        });
        await entorno.prisma.eventLog.create({
          data: { accion: 'prueba.orden.b', entidad: 'prueba_orden', ocurridoEn: new Date('2026-06-01T00:00:00Z') },
        });

        const lista = await bitacora.listar({ entidad: 'prueba_orden' }, null, 50, 0);

        expect(lista.map((e) => e.accion)).toEqual(['prueba.orden.b', 'prueba.orden.a']);
      });

      it('respeta el límite y el desplazamiento', async () => {
        for (let i = 0; i < 3; i += 1) {
          await entorno.prisma.eventLog.create({
            data: { accion: `prueba.pagina.${i}`, entidad: 'prueba_pagina' },
          });
        }

        const primeraPagina = await bitacora.listar({ entidad: 'prueba_pagina' }, null, 2, 0);
        const segundaPagina = await bitacora.listar({ entidad: 'prueba_pagina' }, null, 2, 2);

        expect(primeraPagina).toHaveLength(2);
        expect(segundaPagina).toHaveLength(1);
      });

      it('el filtro de cartera excluye eventos de otros clientes y los que no tienen dueño', async () => {
        await entorno.prisma.eventLog.create({
          data: { accion: 'prueba.cartera.propia', entidad: 'prueba_cartera', clienteId: idClienteAsignado },
        });
        await entorno.prisma.eventLog.create({
          data: { accion: 'prueba.cartera.ajena', entidad: 'prueba_cartera', clienteId: idClienteAjeno },
        });
        await entorno.prisma.eventLog.create({
          data: { accion: 'prueba.cartera.sin_cliente', entidad: 'prueba_cartera' },
        });

        const acotado = await bitacora.listar(
          { entidad: 'prueba_cartera' }, [idClienteAsignado], 50, 0,
        );
        expect(acotado.map((e) => e.accion)).toEqual(['prueba.cartera.propia']);

        const sinRestriccion = await bitacora.listar({ entidad: 'prueba_cartera' }, null, 50, 0);
        expect(sinRestriccion.map((e) => e.accion).sort()).toEqual([
          'prueba.cartera.ajena', 'prueba.cartera.propia', 'prueba.cartera.sin_cliente',
        ]);
      });

      it('el filtro explícito de cliente y el de cartera conviven sin pisarse', async () => {
        // Regresión de la misma familia que el bug de `buscarPorId`: dos
        // condiciones sobre `clienteId` en la misma consulta.
        await entorno.prisma.eventLog.create({
          data: { accion: 'prueba.doble.propia', entidad: 'prueba_doble', clienteId: idClienteAsignado },
        });
        await entorno.prisma.eventLog.create({
          data: { accion: 'prueba.doble.ajena', entidad: 'prueba_doble', clienteId: idClienteAjeno },
        });

        const pidiendoAjenaConCarteraPropia = await bitacora.listar(
          { entidad: 'prueba_doble', clienteId: idClienteAjeno }, [idClienteAsignado], 50, 0,
        );
        expect(pidiendoAjenaConCarteraPropia).toEqual([]);

        const pidiendoPropiaConCarteraPropia = await bitacora.listar(
          { entidad: 'prueba_doble', clienteId: idClienteAsignado }, [idClienteAsignado], 50, 0,
        );
        expect(pidiendoPropiaConCarteraPropia.map((e) => e.accion)).toEqual(['prueba.doble.propia']);
      });
    });
  });

  /* --- Dinero en la base -------------------------------------------------- */

  describe('dinero', () => {
    it('guarda y recupera importes grandes sin perder precisión', async () => {
      // Por encima del entero seguro de JavaScript (2^53). Con una columna
      // de coma flotante, este número volvería alterado.
      const importe = 9_007_199_254_740_993n;

      const balance = await entorno.prisma.balance.create({
        data: {
          clienteId: idClienteAsignado, periodo: '2026-12',
          activo: importe, pasivo: 0n, patrimonioNeto: importe, resultadoEjercicio: 0n,
        },
      });

      const recuperado = await entorno.prisma.balance.findUnique({ where: { id: balance.id } });

      expect(recuperado?.activo).toBe(importe);
      expect(typeof recuperado?.activo).toBe('bigint');
    });

    it('un cliente no puede tener dos balances del mismo período', async () => {
      await expect(
        entorno.prisma.balance.create({
          data: { clienteId: idClienteAsignado, periodo: '2026-12', activo: 1n },
        }),
      ).rejects.toThrow();
    });
  });
});

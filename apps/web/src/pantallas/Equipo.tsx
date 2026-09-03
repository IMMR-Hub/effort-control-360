/**
 * Pantalla de Equipo (tarea 104, pantalla 9 de 12).
 *
 * Alta y edición de usuarios, exclusivo de `direccion` — mismo control que
 * ya impone el servidor (`usuario: ['ver', 'crear', 'editar']` solo en ese
 * rol). La contraseña inicial la define dirección al crear; no existe
 * todavía un flujo de "primer acceso" donde la persona la elija ella misma
 * (ver bitácora de la tarea 83). La cartera reemplaza el conjunto entero al
 * guardar, nunca agrega o quita un cliente suelto.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus } from 'lucide-react';
import type { Rol } from '@effort/schema';

import { Badge, Boton, CampoSelect, CampoTexto, EncabezadoTarjeta, Indicador, Tabla, Tarjeta, Td, Th } from '../ui/Primitivos.jsx';
import { ErrorDeApi } from '../api/cliente.js';
import { listarClientes, type Cliente } from '../api/clientes.js';
import {
  actualizarUsuario,
  crearUsuario,
  listarUsuarios,
  obtenerCarteraDeUsuario,
  type Usuario,
} from '../api/usuarios.js';
import { useSesion } from '../contexts/SesionContext.js';

const ROLES_CON_CARTERA = new Set<Rol>(['responsable', 'coordinador', 'auxiliar', 'revisor_balance']);

const ETIQUETA_ROL: Record<Rol, string> = {
  direccion: 'Dirección',
  responsable: 'Responsable',
  coordinador: 'Coordinador',
  auxiliar: 'Auxiliar',
  revisor_balance: 'Revisor de balance',
  solo_lectura: 'Solo lectura',
};

const OPCIONES_ROL = Object.entries(ETIQUETA_ROL).map(([valor, etiqueta]) => ({ valor, etiqueta }));

interface FormularioUsuario {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  cargo: string;
  rol: Rol;
  veTodosLosClientes: boolean;
  activo: boolean;
  contrasenaInicial: string;
  clientesAsignados: string[];
}

function formularioVacio(): FormularioUsuario {
  return {
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    cargo: '',
    rol: 'auxiliar',
    veTodosLosClientes: false,
    activo: true,
    contrasenaInicial: '',
    clientesAsignados: [],
  };
}

function aFormulario(usuario: Usuario): FormularioUsuario {
  return {
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    telefono: usuario.telefono ?? '',
    cargo: usuario.cargo ?? '',
    rol: usuario.rol,
    veTodosLosClientes: usuario.veTodosLosClientes,
    activo: usuario.activo,
    contrasenaInicial: '',
    clientesAsignados: [],
  };
}

function vacioANulo(valor: string): string | null {
  return valor.trim() === '' ? null : valor.trim();
}

export default function Equipo() {
  const { sesion } = useSesion();
  const puedeEditar = sesion?.rol === 'direccion';

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<readonly Usuario[]>([]);
  const [clientes, setClientes] = useState<readonly Cliente[]>([]);

  const [edicion, setEdicion] = useState<Usuario | null>(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [formulario, setFormulario] = useState<FormularioUsuario>(formularioVacio());
  const [cargandoCartera, setCargandoCartera] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);

  async function recargar() {
    setCargando(true);
    setError(null);
    try {
      const [{ usuarios: lista }, { clientes: listaDeClientes }] = await Promise.all([
        listarUsuarios(),
        listarClientes(),
      ]);
      setUsuarios(lista);
      setClientes(listaDeClientes);
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void recargar();
  }, []);

  const clientesActivos = useMemo(() => clientes.filter((c) => c.activo), [clientes]);
  const activos = usuarios.filter((u) => u.activo).length;

  const mostrarCartera = ROLES_CON_CARTERA.has(formulario.rol) && !formulario.veTodosLosClientes;

  function abrirAlta() {
    setEdicion(null);
    setFormulario(formularioVacio());
    setErrorFormulario(null);
    setFormularioAbierto(true);
  }

  function abrirEdicion(usuario: Usuario) {
    setEdicion(usuario);
    setFormulario(aFormulario(usuario));
    setErrorFormulario(null);
    setFormularioAbierto(true);

    setCargandoCartera(true);
    void obtenerCarteraDeUsuario(usuario.id)
      .then(({ clienteIds }) => {
        setFormulario((actual) => ({ ...actual, clientesAsignados: [...clienteIds] }));
      })
      .catch(() => {
        // La cartera no se pudo precargar: el formulario sigue usable, solo
        // arranca sin marcar nada — reemplazarla igual pisa la anterior.
      })
      .finally(() => setCargandoCartera(false));
  }

  function cerrarFormulario() {
    setFormularioAbierto(false);
    setEdicion(null);
  }

  function alternarCliente(clienteId: string) {
    setFormulario((actual) => ({
      ...actual,
      clientesAsignados: actual.clientesAsignados.includes(clienteId)
        ? actual.clientesAsignados.filter((id) => id !== clienteId)
        : [...actual.clientesAsignados, clienteId],
    }));
  }

  async function manejarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrorFormulario(null);
    setGuardando(true);
    try {
      const cartera = mostrarCartera ? formulario.clientesAsignados : [];

      if (edicion) {
        await actualizarUsuario(edicion.id, {
          nombre: formulario.nombre.trim(),
          apellido: formulario.apellido.trim(),
          telefono: vacioANulo(formulario.telefono),
          cargo: vacioANulo(formulario.cargo),
          rol: formulario.rol,
          activo: formulario.activo,
          veTodosLosClientes: formulario.veTodosLosClientes,
          clientesAsignados: cartera,
        });
      } else {
        await crearUsuario({
          nombre: formulario.nombre.trim(),
          apellido: formulario.apellido.trim(),
          email: formulario.email.trim(),
          telefono: vacioANulo(formulario.telefono),
          cargo: vacioANulo(formulario.cargo),
          rol: formulario.rol,
          veTodosLosClientes: formulario.veTodosLosClientes,
          contrasenaInicial: formulario.contrasenaInicial,
          clientesAsignados: cartera,
        });
      }

      cerrarFormulario();
      await recargar();
    } catch (motivo) {
      setErrorFormulario(
        motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.',
      );
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-tinta-tenue">Cargando…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-critico">{error}</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-[86rem] space-y-5 px-5 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Equipo</h1>
          <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
            Usuarios y roles de EFFORT. {puedeEditar ? 'Alta y edición completas.' : 'Vista de solo lectura.'}
          </p>
        </div>
        {puedeEditar && (
          <Boton variante="primario" icono={Plus} onClick={abrirAlta}>
            Nuevo usuario
          </Boton>
        )}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Resumen del equipo">
        <Indicador etiqueta="Usuarios" valor={usuarios.length} tono="proceso" />
        <Indicador etiqueta="Activos" valor={activos} tono="completo" />
        <Indicador etiqueta="Inactivos" valor={usuarios.length - activos} tono="pendiente" />
      </section>

      <Tarjeta>
        <EncabezadoTarjeta titulo="Equipo" descripcion={`${usuarios.length} usuarios`} />
        <Tabla etiqueta="Equipo">
          <thead>
            <tr>
              <Th>Nombre</Th>
              <Th>Correo</Th>
              <Th>Cargo</Th>
              <Th>Rol</Th>
              <Th>Cartera</Th>
              <Th>Estado</Th>
              {puedeEditar && <Th>Acciones</Th>}
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id}>
                <Td className="font-medium">{usuario.nombre} {usuario.apellido}</Td>
                <Td className="text-tinta-suave">{usuario.email}</Td>
                <Td className="text-tinta-suave">{usuario.cargo ?? '—'}</Td>
                <Td className="text-tinta-suave">{ETIQUETA_ROL[usuario.rol]}</Td>
                <Td className="text-tinta-suave">
                  {usuario.veTodosLosClientes ? 'Cartera completa' : ROLES_CON_CARTERA.has(usuario.rol) ? 'Acotada' : '—'}
                </Td>
                <Td>
                  <Badge tono={usuario.activo ? 'completo' : 'pendiente'} conIcono={false}>
                    {usuario.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </Td>
                {puedeEditar && (
                  <Td>
                    <Boton
                      variante="fantasma"
                      icono={Pencil}
                      onClick={() => abrirEdicion(usuario)}
                      aria-label={`Editar ${usuario.nombre} ${usuario.apellido}`}
                    >
                      Editar
                    </Boton>
                  </Td>
                )}
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={puedeEditar ? 7 : 6} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                  Todavía no hay usuarios cargados.
                </td>
              </tr>
            )}
          </tbody>
        </Tabla>
      </Tarjeta>

      {formularioAbierto && puedeEditar && (
        <Tarjeta className="max-w-2xl">
          <EncabezadoTarjeta
            titulo={edicion ? `Editar — ${edicion.nombre} ${edicion.apellido}` : 'Nuevo usuario'}
            descripcion={
              edicion
                ? 'El correo no se puede cambiar acá — es la identidad de acceso.'
                : `La contraseña inicial la definís vos; mínimo 12 caracteres, no puede ser previsible.`
            }
          />
          <form onSubmit={manejarEnvio} className="space-y-4 px-5 py-4">
            {errorFormulario && (
              <p className="rounded border border-critico-borde bg-critico-fondo px-3 py-2 text-sm text-critico">
                {errorFormulario}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto
                id="nombre"
                etiqueta="Nombre"
                required
                value={formulario.nombre}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormulario({ ...formulario, nombre: e.target.value })
                }
              />
              <CampoTexto
                id="apellido"
                etiqueta="Apellido"
                required
                value={formulario.apellido}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormulario({ ...formulario, apellido: e.target.value })
                }
              />
              {edicion ? (
                <CampoTexto id="email" etiqueta="Correo" value={formulario.email} disabled />
              ) : (
                <CampoTexto
                  id="email"
                  etiqueta="Correo"
                  type="email"
                  required
                  value={formulario.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormulario({ ...formulario, email: e.target.value })
                  }
                />
              )}
              <CampoTexto
                id="telefono"
                etiqueta="Teléfono"
                value={formulario.telefono}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormulario({ ...formulario, telefono: e.target.value })
                }
              />
              <CampoTexto
                id="cargo"
                etiqueta="Cargo"
                value={formulario.cargo}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormulario({ ...formulario, cargo: e.target.value })
                }
              />
              <CampoSelect
                id="rol"
                etiqueta="Rol"
                opciones={OPCIONES_ROL}
                value={formulario.rol}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setFormulario({ ...formulario, rol: e.target.value as Rol })
                }
              />
              {!edicion && (
                <CampoTexto
                  id="contrasenaInicial"
                  etiqueta="Contraseña inicial"
                  type="password"
                  required
                  minLength={12}
                  value={formulario.contrasenaInicial}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormulario({ ...formulario, contrasenaInicial: e.target.value })
                  }
                />
              )}
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-tinta-suave">
                <input
                  type="checkbox"
                  checked={formulario.veTodosLosClientes}
                  onChange={(e) => setFormulario({ ...formulario, veTodosLosClientes: e.target.checked })}
                />
                Ve toda la cartera
              </label>
              {edicion && (
                <label className="flex items-center gap-2 self-end pb-2 text-sm text-tinta-suave">
                  <input
                    type="checkbox"
                    checked={formulario.activo}
                    onChange={(e) => setFormulario({ ...formulario, activo: e.target.checked })}
                  />
                  Usuario activo
                </label>
              )}
            </div>

            {mostrarCartera && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-tinta-suave">
                  Cartera asignada {cargandoCartera && '— cargando…'}
                </span>
                <div className="max-h-48 overflow-y-auto rounded border border-borde-fuerte bg-superficie p-2">
                  {clientesActivos.length === 0 && (
                    <p className="px-1 py-1 text-sm text-tinta-tenue">No hay clientes activos.</p>
                  )}
                  {clientesActivos.map((cliente) => (
                    <label key={cliente.id} className="flex items-center gap-2 px-1 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={formulario.clientesAsignados.includes(cliente.id)}
                        onChange={() => alternarCliente(cliente.id)}
                      />
                      {cliente.nombre}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Boton variante="fantasma" type="button" onClick={cerrarFormulario} disabled={guardando}>
                Cancelar
              </Boton>
              <Boton variante="primario" type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : edicion ? 'Guardar cambios' : 'Crear usuario'}
              </Boton>
            </div>
          </form>
        </Tarjeta>
      )}
    </main>
  );
}

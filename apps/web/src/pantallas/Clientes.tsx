/**
 * Pantalla de clientes (tarea 104, pantalla 2 de 12).
 *
 * Cartera completa (o la que le toque a la cartera del usuario, según RBAC),
 * con alta y edición para `direccion`/`responsable` — el resto de los roles
 * ve la lista pero no puede tocarla, mismo control de acceso que ya aplica el
 * servidor en `apps/api/src/rutas/clientes.ts`.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, Search } from 'lucide-react';

import {
  Badge,
  Boton,
  CampoSelect,
  CampoTexto,
  EncabezadoTarjeta,
  Indicador,
  Tabla,
  Tarjeta,
  Td,
  Th,
} from '../ui/Primitivos.jsx';
import { ErrorDeApi } from '../api/cliente.js';
import {
  actualizarCliente,
  crearCliente,
  listarClientes,
  type CanalRecepcion,
  type Cliente,
  type TipoPersona,
} from '../api/clientes.js';
import { useSesion } from '../contexts/SesionContext.js';

const ETIQUETA_CANAL: Record<CanalRecepcion, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Correo',
  ONEDRIVE: 'OneDrive',
  FISICO_ESCANEADO: 'Físico escaneado',
  SISTEMA: 'Sistema',
};

const OPCIONES_TIPO_PERSONA = [
  { valor: 'JURIDICA', etiqueta: 'Jurídica' },
  { valor: 'FISICA', etiqueta: 'Física' },
];

const OPCIONES_CANAL = Object.entries(ETIQUETA_CANAL).map(([valor, etiqueta]) => ({
  valor,
  etiqueta,
}));

interface FormularioCliente {
  readonly nombre: string;
  readonly ruc: string;
  readonly tipoPersona: TipoPersona;
  readonly regimenTributario: string;
  readonly email: string;
  readonly telefono: string;
  readonly canalPreferido: CanalRecepcion | '';
  readonly observaciones: string;
  readonly activo: boolean;
}

const FORMULARIO_VACIO: FormularioCliente = {
  nombre: '',
  ruc: '',
  tipoPersona: 'JURIDICA',
  regimenTributario: '',
  email: '',
  telefono: '',
  canalPreferido: '',
  observaciones: '',
  activo: true,
};

function aFormulario(cliente: Cliente): FormularioCliente {
  return {
    nombre: cliente.nombre,
    ruc: cliente.ruc,
    tipoPersona: cliente.tipoPersona as TipoPersona,
    regimenTributario: cliente.regimenTributario ?? '',
    email: cliente.email ?? '',
    telefono: cliente.telefono ?? '',
    canalPreferido: (cliente.canalPreferido as CanalRecepcion | null) ?? '',
    observaciones: cliente.observaciones ?? '',
    activo: cliente.activo,
  };
}

/** `''` en el formulario significa "sin definir": se manda `null`, no la cadena vacía. */
function vacioANulo(valor: string): string | null {
  return valor.trim() === '' ? null : valor.trim();
}

export default function Clientes() {
  const { sesion } = useSesion();
  const puedeEditar = sesion?.rol === 'direccion' || sesion?.rol === 'responsable';

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<readonly Cliente[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [soloActivos, setSoloActivos] = useState(true);

  const [edicion, setEdicion] = useState<Cliente | null>(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [formulario, setFormulario] = useState<FormularioCliente>(FORMULARIO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);

  async function recargar() {
    setCargando(true);
    setError(null);
    try {
      const { clientes: lista } = await listarClientes();
      setClientes(lista);
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void recargar();
  }, []);

  const clientesFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return clientes
      .filter((c) => !soloActivos || c.activo)
      .filter(
        (c) => !termino || c.nombre.toLowerCase().includes(termino) || c.ruc.includes(termino),
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [clientes, busqueda, soloActivos]);

  const activos = clientes.filter((c) => c.activo).length;

  function abrirAlta() {
    setEdicion(null);
    setFormulario(FORMULARIO_VACIO);
    setErrorFormulario(null);
    setFormularioAbierto(true);
  }

  function abrirEdicion(cliente: Cliente) {
    setEdicion(cliente);
    setFormulario(aFormulario(cliente));
    setErrorFormulario(null);
    setFormularioAbierto(true);
  }

  function cerrarFormulario() {
    setFormularioAbierto(false);
    setEdicion(null);
  }

  async function manejarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrorFormulario(null);
    setGuardando(true);
    try {
      const datosComunes = {
        nombre: formulario.nombre.trim(),
        ruc: formulario.ruc.trim(),
        tipoPersona: formulario.tipoPersona,
        regimenTributario: vacioANulo(formulario.regimenTributario),
        email: vacioANulo(formulario.email),
        telefono: vacioANulo(formulario.telefono),
        canalPreferido: formulario.canalPreferido === '' ? null : formulario.canalPreferido,
        observaciones: vacioANulo(formulario.observaciones),
      };

      if (edicion) {
        await actualizarCliente(edicion.id, { ...datosComunes, activo: formulario.activo });
      } else {
        await crearCliente(datosComunes);
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
            <h1 className="text-lg font-semibold">Clientes</h1>
            <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
              Cartera de EFFORT. {puedeEditar ? 'Alta y edición completas.' : 'Vista de solo lectura.'}
            </p>
          </div>
          {puedeEditar && (
            <Boton variante="primario" icono={Plus} onClick={abrirAlta}>
              Nuevo cliente
            </Boton>
          )}
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Resumen de la cartera">
          <Indicador etiqueta="Clientes" valor={clientes.length} detalle="en la cartera visible" tono="proceso" />
          <Indicador etiqueta="Activos" valor={activos} tono="completo" />
          <Indicador etiqueta="Inactivos" valor={clientes.length - activos} tono="pendiente" />
        </section>

        <Tarjeta>
          <EncabezadoTarjeta
            titulo="Cartera"
            descripcion={`${clientesFiltrados.length} de ${clientes.length} clientes`}
            acciones={
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-tinta-suave">
                  <input
                    type="checkbox"
                    checked={soloActivos}
                    onChange={(evento) => setSoloActivos(evento.target.checked)}
                  />
                  Solo activos
                </label>
                <div className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-tinta-tenue"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(evento) => setBusqueda(evento.target.value)}
                    placeholder="Buscar por nombre o RUC"
                    aria-label="Buscar cliente por nombre o RUC"
                    className="min-h-9 rounded border border-borde-fuerte bg-superficie py-1.5 pl-8 pr-3 text-sm text-tinta focus-visible:outline-none"
                  />
                </div>
              </div>
            }
          />
          <Tabla etiqueta="Cartera de clientes">
            <thead>
              <tr>
                <Th>Nombre</Th>
                <Th>RUC</Th>
                <Th>Tipo</Th>
                <Th>Canal preferido</Th>
                <Th>Estado</Th>
                {puedeEditar && <Th>Acciones</Th>}
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.map((cliente) => (
                <tr key={cliente.id} className="hover:bg-superficie-tenue">
                  <Td className="font-medium">{cliente.nombre}</Td>
                  <Td className="cifra text-tinta-suave">{cliente.ruc}</Td>
                  <Td className="text-tinta-suave">
                    {cliente.tipoPersona === 'JURIDICA' ? 'Jurídica' : 'Física'}
                  </Td>
                  <Td className="text-tinta-suave">
                    {cliente.canalPreferido
                      ? ETIQUETA_CANAL[cliente.canalPreferido as CanalRecepcion]
                      : '—'}
                  </Td>
                  <Td>
                    <Badge tono={cliente.activo ? 'completo' : 'pendiente'} conIcono={false}>
                      {cliente.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </Td>
                  {puedeEditar && (
                    <Td>
                      <Boton
                        variante="fantasma"
                        icono={Pencil}
                        onClick={() => abrirEdicion(cliente)}
                        aria-label={`Editar ${cliente.nombre}`}
                      >
                        Editar
                      </Boton>
                    </Td>
                  )}
                </tr>
              ))}
              {clientesFiltrados.length === 0 && (
                <tr>
                  <td
                    colSpan={puedeEditar ? 6 : 5}
                    className="px-4 py-8 text-center text-sm text-tinta-tenue"
                  >
                    Ningún cliente coincide con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </Tabla>
        </Tarjeta>

        {formularioAbierto && puedeEditar && (
          <Tarjeta className="max-w-2xl">
            <EncabezadoTarjeta
              titulo={edicion ? `Editar — ${edicion.nombre}` : 'Nuevo cliente'}
              descripcion={
                edicion
                  ? 'Todo campo es editable, incluido el RUC.'
                  : 'El RUC se valida con dígito verificador antes de guardar.'
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
                  etiqueta="Nombre / Razón social"
                  required
                  value={formulario.nombre}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormulario({ ...formulario, nombre: e.target.value })
                  }
                />
                <CampoTexto
                  id="ruc"
                  etiqueta="RUC"
                  required
                  placeholder="80012345-6"
                  value={formulario.ruc}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormulario({ ...formulario, ruc: e.target.value })
                  }
                />
                <CampoSelect
                  id="tipoPersona"
                  etiqueta="Tipo de persona"
                  opciones={OPCIONES_TIPO_PERSONA}
                  value={formulario.tipoPersona}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFormulario({ ...formulario, tipoPersona: e.target.value as TipoPersona })
                  }
                />
                <CampoTexto
                  id="regimenTributario"
                  etiqueta="Régimen tributario"
                  value={formulario.regimenTributario}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormulario({ ...formulario, regimenTributario: e.target.value })
                  }
                />
                <CampoTexto
                  id="email"
                  etiqueta="Correo"
                  type="email"
                  value={formulario.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormulario({ ...formulario, email: e.target.value })
                  }
                />
                <CampoTexto
                  id="telefono"
                  etiqueta="Teléfono"
                  value={formulario.telefono}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormulario({ ...formulario, telefono: e.target.value })
                  }
                />
                <CampoSelect
                  id="canalPreferido"
                  etiqueta="Canal preferido"
                  placeholder="Sin definir"
                  opciones={OPCIONES_CANAL}
                  value={formulario.canalPreferido}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFormulario({
                      ...formulario,
                      canalPreferido: e.target.value as CanalRecepcion | '',
                    })
                  }
                />
                {edicion && (
                  <label className="flex items-center gap-2 self-end pb-2 text-sm text-tinta-suave">
                    <input
                      type="checkbox"
                      checked={formulario.activo}
                      onChange={(e) => setFormulario({ ...formulario, activo: e.target.checked })}
                    />
                    Cliente activo
                  </label>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="observaciones" className="text-xs font-medium text-tinta-suave">
                  Observaciones
                </label>
                <textarea
                  id="observaciones"
                  rows={3}
                  value={formulario.observaciones}
                  onChange={(e) => setFormulario({ ...formulario, observaciones: e.target.value })}
                  className="rounded border border-borde-fuerte bg-superficie px-3 py-1.5 text-sm text-tinta focus-visible:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Boton variante="fantasma" type="button" onClick={cerrarFormulario} disabled={guardando}>
                  Cancelar
                </Boton>
                <Boton variante="primario" type="submit" disabled={guardando}>
                  {guardando ? 'Guardando…' : edicion ? 'Guardar cambios' : 'Crear cliente'}
                </Boton>
              </div>
            </form>
          </Tarjeta>
        )}
    </main>
  );
}

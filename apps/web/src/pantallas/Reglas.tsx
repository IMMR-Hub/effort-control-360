/**
 * Pantalla de Reglas (tarea 104, pantalla 10 de 12).
 *
 * Dos tableros independientes, cada uno con su propio RBAC: **impositivas**
 * (solo `direccion` da de alta o edita — dar de alta una tasa nueva cierra
 * automáticamente la vigente anterior, no hay forma de tocar `tasa` ni
 * `divisorIvaIncluido` de una regla ya creada) y **de notificación**
 * (`direccion` crea y edita, `responsable` solo edita, `coordinador` solo
 * mira). Importante — ver `docs/DISCREPANCIAS.md` punto 9: las reglas
 * impositivas todavía no están conectadas a ningún cálculo de IVA real;
 * editar una acá no cambia ningún número del sistema hoy.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, X } from 'lucide-react';

import { Badge, Boton, CampoSelect, CampoTexto, EncabezadoTarjeta, Tabla, Tarjeta, Td, Th } from '../ui/Primitivos.jsx';
import { ErrorDeApi } from '../api/cliente.js';
import { listarClientes, type Cliente } from '../api/clientes.js';
import {
  actualizarReglaImpositiva,
  crearReglaImpositiva,
  listarReglasImpositivas,
  type ReglaImpositiva,
  type TasaIva,
} from '../api/reglasImpositivas.js';
import {
  actualizarReglaDeNotificacion,
  crearReglaDeNotificacion,
  listarReglasDeNotificacion,
  type Destinatario,
  type EventoDisparador,
  type ReglaDeNotificacion,
  type TipoDestinatario,
} from '../api/reglasNotificacion.js';
import { useSesion } from '../contexts/SesionContext.js';

const ETIQUETA_TASA: Record<TasaIva, string> = { DIEZ: '10%', CINCO: '5%', EXENTA: 'Exenta' };
const OPCIONES_TASA = Object.entries(ETIQUETA_TASA).map(([valor, etiqueta]) => ({ valor, etiqueta }));

const ETIQUETA_EVENTO: Record<EventoDisparador, string> = {
  DOCUMENTACION_NO_ENTREGADA: 'Documentación no entregada',
  VENCIMIENTO_PROXIMO: 'Vencimiento próximo',
  BALANCE_OBSERVADO: 'Balance observado',
  BALANCE_LISTO_PARA_REVISION: 'Balance listo para revisión',
  LIQUIDACION_NO_ENVIADA: 'Liquidación no enviada',
  LIQUIDACION_SIN_CONFIRMAR: 'Liquidación sin confirmar',
  DIFERENCIAS_CON_SIGA: 'Diferencias con SIGA',
  CLIENTE_SIN_RESPUESTA: 'Cliente sin respuesta',
};
const OPCIONES_EVENTO = Object.entries(ETIQUETA_EVENTO).map(([valor, etiqueta]) => ({ valor, etiqueta }));

const ETIQUETA_TIPO_DESTINATARIO: Record<TipoDestinatario, string> = {
  CLIENTE: 'Cliente',
  RESPONSABLE_DEL_CLIENTE: 'Responsable del cliente',
  COORDINADOR_DEL_CLIENTE: 'Coordinador del cliente',
  ROL: 'Rol',
  USUARIO: 'Usuario (id)',
  CORREO_LIBRE: 'Correo libre',
};
const OPCIONES_TIPO_DESTINATARIO = Object.entries(ETIQUETA_TIPO_DESTINATARIO).map(([valor, etiqueta]) => ({
  valor,
  etiqueta,
}));
const TIPOS_QUE_EXIGEN_VALOR = new Set<TipoDestinatario>(['ROL', 'USUARIO', 'CORREO_LIBRE']);

function vacioANulo(valor: string): string | null {
  return valor.trim() === '' ? null : valor.trim();
}

/* ========================================================================== */
/* Editor de destinatarios — usado por iniciales y por escalamiento          */
/* ========================================================================== */

interface EditorDeDestinatariosProps {
  readonly etiqueta: string;
  readonly destinatarios: readonly Destinatario[];
  readonly onCambiar: (destinatarios: Destinatario[]) => void;
}

function EditorDeDestinatarios({ etiqueta, destinatarios, onCambiar }: EditorDeDestinatariosProps) {
  function agregar() {
    onCambiar([...destinatarios, { tipo: 'CORREO_LIBRE', valor: '' }]);
  }

  function quitar(indice: number) {
    onCambiar(destinatarios.filter((_, i) => i !== indice));
  }

  function cambiarTipo(indice: number, tipo: TipoDestinatario) {
    onCambiar(
      destinatarios.map((d, i) =>
        i === indice ? { tipo, valor: TIPOS_QUE_EXIGEN_VALOR.has(tipo) ? d.valor ?? '' : null } : d,
      ),
    );
  }

  function cambiarValor(indice: number, valor: string) {
    onCambiar(destinatarios.map((d, i) => (i === indice ? { ...d, valor } : d)));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-tinta-suave">{etiqueta}</span>
      <div className="flex flex-col gap-2">
        {destinatarios.map((d, indice) => (
          <div key={indice} className="flex items-center gap-2">
            <select
              aria-label={`${etiqueta} — tipo ${indice + 1}`}
              value={d.tipo}
              onChange={(e) => cambiarTipo(indice, e.target.value as TipoDestinatario)}
              className="min-h-9 rounded border border-borde-fuerte bg-superficie px-2 py-1.5 text-sm text-tinta"
            >
              {OPCIONES_TIPO_DESTINATARIO.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
            {TIPOS_QUE_EXIGEN_VALOR.has(d.tipo) && (
              <input
                aria-label={`${etiqueta} — valor ${indice + 1}`}
                value={d.valor ?? ''}
                onChange={(e) => cambiarValor(indice, e.target.value)}
                placeholder="correo, id de rol o de usuario…"
                className="min-h-9 flex-1 rounded border border-borde-fuerte bg-superficie px-2 py-1.5 text-sm text-tinta"
              />
            )}
            <Boton
              variante="fantasma"
              icono={X}
              type="button"
              aria-label={`Quitar destinatario ${indice + 1} de ${etiqueta}`}
              onClick={() => quitar(indice)}
            >
              Quitar
            </Boton>
          </div>
        ))}
      </div>
      <Boton variante="fantasma" icono={Plus} type="button" onClick={agregar}>
        Agregar destinatario
      </Boton>
    </div>
  );
}

/* ========================================================================== */
/* Reglas impositivas                                                        */
/* ========================================================================== */

interface FormularioImpositiva {
  nombre: string;
  tasa: TasaIva;
  divisorIvaIncluido: string;
  vigenteDesde: string;
  vigenteHasta: string;
  requiereConfirmacionCliente: boolean;
  fuente: string;
}

function impositivaVacia(): FormularioImpositiva {
  return {
    nombre: '',
    tasa: 'DIEZ',
    divisorIvaIncluido: '11',
    vigenteDesde: '',
    vigenteHasta: '',
    requiereConfirmacionCliente: false,
    fuente: '',
  };
}

function impositivaAFormulario(regla: ReglaImpositiva): FormularioImpositiva {
  return {
    nombre: regla.nombre,
    tasa: regla.tasa,
    divisorIvaIncluido: regla.divisorIvaIncluido?.toString() ?? '',
    vigenteDesde: regla.vigenteDesde,
    vigenteHasta: regla.vigenteHasta ?? '',
    requiereConfirmacionCliente: regla.requiereConfirmacionCliente,
    fuente: regla.fuente,
  };
}

function ReglasImpositivas() {
  const { sesion } = useSesion();
  const puedeEditar = sesion?.rol === 'direccion';

  const [reglas, setReglas] = useState<readonly ReglaImpositiva[]>([]);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<ReglaImpositiva | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [formulario, setFormulario] = useState<FormularioImpositiva>(impositivaVacia());
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);

  async function recargar() {
    try {
      const { reglas: lista } = await listarReglasImpositivas();
      setReglas(lista);
      setErrorCarga(null);
    } catch (motivo) {
      setErrorCarga(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    }
  }

  useEffect(() => {
    void recargar();
  }, []);

  function abrirAlta() {
    setEdicion(null);
    setFormulario(impositivaVacia());
    setErrorFormulario(null);
    setAbierto(true);
  }

  function abrirEdicion(regla: ReglaImpositiva) {
    setEdicion(regla);
    setFormulario(impositivaAFormulario(regla));
    setErrorFormulario(null);
    setAbierto(true);
  }

  async function manejarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario(null);
    try {
      if (edicion) {
        await actualizarReglaImpositiva(edicion.id, {
          nombre: formulario.nombre.trim(),
          vigenteHasta: vacioANulo(formulario.vigenteHasta),
          requiereConfirmacionCliente: formulario.requiereConfirmacionCliente,
          fuente: formulario.fuente.trim(),
        });
      } else {
        await crearReglaImpositiva({
          nombre: formulario.nombre.trim(),
          tasa: formulario.tasa,
          divisorIvaIncluido: formulario.tasa === 'EXENTA' ? null : Number(formulario.divisorIvaIncluido),
          vigenteDesde: formulario.vigenteDesde,
          fuente: formulario.fuente.trim(),
        });
      }
      setAbierto(false);
      await recargar();
    } catch (motivo) {
      setErrorFormulario(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <EncabezadoTarjeta
        titulo="Reglas impositivas"
        descripcion="Todavía no conectadas a ningún cálculo real — ver DISCREPANCIAS.md, punto 9."
        acciones={
          puedeEditar && (
            <Boton variante="primario" icono={Plus} onClick={abrirAlta}>
              Nueva tasa
            </Boton>
          )
        }
      />
      {errorCarga && (
        <p className="px-5 py-4 text-sm text-critico">{errorCarga}</p>
      )}
      {!errorCarga && (
      <Tabla etiqueta="Reglas impositivas">
        <thead>
          <tr>
            <Th>Nombre</Th>
            <Th>Tasa</Th>
            <Th>Vigente desde</Th>
            <Th>Vigente hasta</Th>
            <Th>Confirmación cliente</Th>
            <Th>Fuente</Th>
            {puedeEditar && <Th>Acciones</Th>}
          </tr>
        </thead>
        <tbody>
          {reglas.map((regla) => (
            <tr key={regla.id}>
              <Td className="font-medium">{regla.nombre}</Td>
              <Td>
                <Badge tono={regla.vigenteHasta ? 'pendiente' : 'completo'} conIcono={false}>
                  {ETIQUETA_TASA[regla.tasa]}
                </Badge>
              </Td>
              <Td className="cifra text-tinta-suave">{regla.vigenteDesde}</Td>
              <Td className="cifra text-tinta-suave">{regla.vigenteHasta ?? '—'}</Td>
              <Td className="text-tinta-suave">{regla.requiereConfirmacionCliente ? 'Sí' : 'No'}</Td>
              <Td className="max-w-xs text-tinta-suave">{regla.fuente}</Td>
              {puedeEditar && (
                <Td>
                  <Boton
                    variante="fantasma"
                    icono={Pencil}
                    aria-label={`Editar ${regla.nombre}`}
                    onClick={() => abrirEdicion(regla)}
                  >
                    Editar
                  </Boton>
                </Td>
              )}
            </tr>
          ))}
          {reglas.length === 0 && (
            <tr>
              <td colSpan={puedeEditar ? 7 : 6} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                Todavía no hay reglas impositivas cargadas.
              </td>
            </tr>
          )}
        </tbody>
      </Tabla>
      )}

      {abierto && puedeEditar && (
        <form onSubmit={manejarEnvio} className="space-y-4 border-t border-borde px-5 py-4">
          {errorFormulario && (
            <p className="rounded border border-critico-borde bg-critico-fondo px-3 py-2 text-sm text-critico">
              {errorFormulario}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              id="nombreImpositiva"
              etiqueta="Nombre"
              required
              value={formulario.nombre}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormulario({ ...formulario, nombre: e.target.value })}
            />
            {edicion ? (
              <CampoTexto id="tasaImpositiva" etiqueta="Tasa" value={ETIQUETA_TASA[formulario.tasa]} disabled />
            ) : (
              <CampoSelect
                id="tasaImpositiva"
                etiqueta="Tasa"
                opciones={OPCIONES_TASA}
                value={formulario.tasa}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setFormulario({ ...formulario, tasa: e.target.value as TasaIva })
                }
              />
            )}
            {!edicion && formulario.tasa !== 'EXENTA' && (
              <CampoTexto
                id="divisorImpositiva"
                etiqueta="Divisor de IVA incluido"
                type="number"
                min={1}
                required
                value={formulario.divisorIvaIncluido}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormulario({ ...formulario, divisorIvaIncluido: e.target.value })
                }
              />
            )}
            {!edicion && (
              <CampoTexto
                id="vigenteDesdeImpositiva"
                etiqueta="Vigente desde"
                type="date"
                required
                value={formulario.vigenteDesde}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormulario({ ...formulario, vigenteDesde: e.target.value })
                }
              />
            )}
            {edicion && (
              <CampoTexto
                id="vigenteHastaImpositiva"
                etiqueta="Vigente hasta"
                type="date"
                value={formulario.vigenteHasta}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormulario({ ...formulario, vigenteHasta: e.target.value })
                }
              />
            )}
            {edicion && (
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-tinta-suave">
                <input
                  type="checkbox"
                  checked={formulario.requiereConfirmacionCliente}
                  onChange={(e) => setFormulario({ ...formulario, requiereConfirmacionCliente: e.target.checked })}
                />
                Requiere confirmación del cliente
              </label>
            )}
          </div>
          <CampoTexto
            id="fuenteImpositiva"
            etiqueta="Fuente"
            required
            placeholder="Documento o comunicación de la que sale esta regla"
            value={formulario.fuente}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormulario({ ...formulario, fuente: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Boton variante="fantasma" type="button" onClick={() => setAbierto(false)} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton variante="primario" type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : edicion ? 'Guardar cambios' : 'Crear regla'}
            </Boton>
          </div>
        </form>
      )}
    </Tarjeta>
  );
}

/* ========================================================================== */
/* Reglas de notificación                                                    */
/* ========================================================================== */

interface FormularioNotificacion {
  nombre: string;
  activa: boolean;
  evento: EventoDisparador;
  diasHabilesDePlazo: string;
  horaDeEnvio: string;
  reintentarCadaDiasHabiles: string;
  maximoRecordatorios: string;
  escalarAPartirDelRecordatorio: string;
  destinatariosIniciales: Destinatario[];
  destinatariosDeEscalamiento: Destinatario[];
  clientesAlcanzados: string[];
}

function notificacionVacia(): FormularioNotificacion {
  return {
    nombre: '',
    activa: true,
    evento: 'DOCUMENTACION_NO_ENTREGADA',
    diasHabilesDePlazo: '3',
    horaDeEnvio: '09:00',
    reintentarCadaDiasHabiles: '2',
    maximoRecordatorios: '3',
    escalarAPartirDelRecordatorio: '2',
    destinatariosIniciales: [{ tipo: 'RESPONSABLE_DEL_CLIENTE', valor: null }],
    destinatariosDeEscalamiento: [],
    clientesAlcanzados: [],
  };
}

function notificacionAFormulario(regla: ReglaDeNotificacion): FormularioNotificacion {
  return {
    nombre: regla.nombre,
    activa: regla.activa,
    evento: regla.evento,
    diasHabilesDePlazo: String(regla.diasHabilesDePlazo),
    horaDeEnvio: regla.horaDeEnvio,
    reintentarCadaDiasHabiles: String(regla.reintentarCadaDiasHabiles),
    maximoRecordatorios: String(regla.maximoRecordatorios),
    escalarAPartirDelRecordatorio: String(regla.escalarAPartirDelRecordatorio),
    destinatariosIniciales: [...regla.destinatariosIniciales],
    destinatariosDeEscalamiento: [...regla.destinatariosDeEscalamiento],
    clientesAlcanzados: [...regla.clientesAlcanzados],
  };
}

function ReglasDeNotificacion({ clientes }: { readonly clientes: readonly Cliente[] }) {
  const { sesion } = useSesion();
  const puedeCrear = sesion?.rol === 'direccion';
  const puedeEditar = sesion?.rol === 'direccion' || sesion?.rol === 'responsable';

  const [reglas, setReglas] = useState<readonly ReglaDeNotificacion[]>([]);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<ReglaDeNotificacion | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [formulario, setFormulario] = useState<FormularioNotificacion>(notificacionVacia());
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);

  const clientesActivos = useMemo(() => clientes.filter((c) => c.activo), [clientes]);

  async function recargar() {
    try {
      const { reglas: lista } = await listarReglasDeNotificacion();
      setReglas(lista);
      setErrorCarga(null);
    } catch (motivo) {
      setErrorCarga(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    }
  }

  useEffect(() => {
    void recargar();
  }, []);

  function abrirAlta() {
    setEdicion(null);
    setFormulario(notificacionVacia());
    setErrorFormulario(null);
    setAbierto(true);
  }

  function abrirEdicion(regla: ReglaDeNotificacion) {
    setEdicion(regla);
    setFormulario(notificacionAFormulario(regla));
    setErrorFormulario(null);
    setAbierto(true);
  }

  function alternarCliente(clienteId: string) {
    setFormulario((actual) => ({
      ...actual,
      clientesAlcanzados: actual.clientesAlcanzados.includes(clienteId)
        ? actual.clientesAlcanzados.filter((id) => id !== clienteId)
        : [...actual.clientesAlcanzados, clienteId],
    }));
  }

  async function manejarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario(null);
    try {
      const datos = {
        nombre: formulario.nombre.trim(),
        activa: formulario.activa,
        evento: formulario.evento,
        diasHabilesDePlazo: Number(formulario.diasHabilesDePlazo),
        horaDeEnvio: formulario.horaDeEnvio,
        reintentarCadaDiasHabiles: Number(formulario.reintentarCadaDiasHabiles),
        maximoRecordatorios: Number(formulario.maximoRecordatorios),
        escalarAPartirDelRecordatorio: Number(formulario.escalarAPartirDelRecordatorio),
        destinatariosIniciales: formulario.destinatariosIniciales,
        destinatariosDeEscalamiento: formulario.destinatariosDeEscalamiento,
        clientesAlcanzados: formulario.clientesAlcanzados,
      };

      if (edicion) {
        await actualizarReglaDeNotificacion(edicion.id, datos);
      } else {
        await crearReglaDeNotificacion(datos);
      }
      setAbierto(false);
      await recargar();
    } catch (motivo) {
      setErrorFormulario(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <EncabezadoTarjeta
        titulo="Reglas de notificación"
        descripcion="Plazo, reintento y escalamiento de los recordatorios automáticos."
        acciones={
          puedeCrear && (
            <Boton variante="primario" icono={Plus} onClick={abrirAlta}>
              Nueva regla
            </Boton>
          )
        }
      />
      {errorCarga && (
        <p className="px-5 py-4 text-sm text-critico">{errorCarga}</p>
      )}
      {!errorCarga && (
      <Tabla etiqueta="Reglas de notificación">
        <thead>
          <tr>
            <Th>Nombre</Th>
            <Th>Evento</Th>
            <Th>Estado</Th>
            <Th numerica>Plazo (días hábiles)</Th>
            <Th>Hora de envío</Th>
            <Th>Cartera alcanzada</Th>
            {puedeEditar && <Th>Acciones</Th>}
          </tr>
        </thead>
        <tbody>
          {reglas.map((regla) => (
            <tr key={regla.id}>
              <Td className="font-medium">{regla.nombre}</Td>
              <Td className="text-tinta-suave">{ETIQUETA_EVENTO[regla.evento]}</Td>
              <Td>
                <Badge tono={regla.activa ? 'completo' : 'pendiente'} conIcono={false}>
                  {regla.activa ? 'Activa' : 'Inactiva'}
                </Badge>
              </Td>
              <Td numerica>{regla.diasHabilesDePlazo}</Td>
              <Td className="cifra text-tinta-suave">{regla.horaDeEnvio}</Td>
              <Td className="text-tinta-suave">
                {regla.clientesAlcanzados.length === 0 ? 'Toda la cartera' : `${regla.clientesAlcanzados.length} clientes`}
              </Td>
              {puedeEditar && (
                <Td>
                  <Boton
                    variante="fantasma"
                    icono={Pencil}
                    aria-label={`Editar ${regla.nombre}`}
                    onClick={() => abrirEdicion(regla)}
                  >
                    Editar
                  </Boton>
                </Td>
              )}
            </tr>
          ))}
          {reglas.length === 0 && (
            <tr>
              <td colSpan={puedeEditar ? 7 : 6} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                Todavía no hay reglas de notificación cargadas.
              </td>
            </tr>
          )}
        </tbody>
      </Tabla>
      )}

      {abierto && puedeEditar && (
        <form onSubmit={manejarEnvio} className="space-y-4 border-t border-borde px-5 py-4">
          {errorFormulario && (
            <p className="rounded border border-critico-borde bg-critico-fondo px-3 py-2 text-sm text-critico">
              {errorFormulario}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              id="nombreNotificacion"
              etiqueta="Nombre"
              required
              value={formulario.nombre}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormulario({ ...formulario, nombre: e.target.value })}
            />
            <CampoSelect
              id="eventoNotificacion"
              etiqueta="Evento"
              opciones={OPCIONES_EVENTO}
              value={formulario.evento}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFormulario({ ...formulario, evento: e.target.value as EventoDisparador })
              }
            />
            <CampoTexto
              id="plazoNotificacion"
              etiqueta="Plazo (días hábiles)"
              type="number"
              min={0}
              max={60}
              required
              value={formulario.diasHabilesDePlazo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormulario({ ...formulario, diasHabilesDePlazo: e.target.value })
              }
            />
            <CampoTexto
              id="horaNotificacion"
              etiqueta="Hora de envío"
              type="time"
              required
              value={formulario.horaDeEnvio}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormulario({ ...formulario, horaDeEnvio: e.target.value })
              }
            />
            <CampoTexto
              id="reintentoNotificacion"
              etiqueta="Reintentar cada (días hábiles)"
              type="number"
              min={1}
              max={60}
              required
              value={formulario.reintentarCadaDiasHabiles}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormulario({ ...formulario, reintentarCadaDiasHabiles: e.target.value })
              }
            />
            <CampoTexto
              id="maximoNotificacion"
              etiqueta="Máximo de recordatorios"
              type="number"
              min={1}
              max={20}
              required
              value={formulario.maximoRecordatorios}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormulario({ ...formulario, maximoRecordatorios: e.target.value })
              }
            />
            <CampoTexto
              id="escalarNotificacion"
              etiqueta="Escalar a partir del recordatorio"
              type="number"
              min={1}
              max={20}
              required
              value={formulario.escalarAPartirDelRecordatorio}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormulario({ ...formulario, escalarAPartirDelRecordatorio: e.target.value })
              }
            />
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-tinta-suave">
              <input
                type="checkbox"
                checked={formulario.activa}
                onChange={(e) => setFormulario({ ...formulario, activa: e.target.checked })}
              />
              Regla activa
            </label>
          </div>

          <EditorDeDestinatarios
            etiqueta="Destinatarios iniciales"
            destinatarios={formulario.destinatariosIniciales}
            onCambiar={(destinatariosIniciales) => setFormulario({ ...formulario, destinatariosIniciales })}
          />
          <EditorDeDestinatarios
            etiqueta="Destinatarios de escalamiento"
            destinatarios={formulario.destinatariosDeEscalamiento}
            onCambiar={(destinatariosDeEscalamiento) => setFormulario({ ...formulario, destinatariosDeEscalamiento })}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-tinta-suave">
              Cartera alcanzada (sin marcar ninguna, alcanza a toda la cartera)
            </span>
            <div className="max-h-48 overflow-y-auto rounded border border-borde-fuerte bg-superficie p-2">
              {clientesActivos.length === 0 && (
                <p className="px-1 py-1 text-sm text-tinta-tenue">No hay clientes activos.</p>
              )}
              {clientesActivos.map((cliente) => (
                <label key={cliente.id} className="flex items-center gap-2 px-1 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={formulario.clientesAlcanzados.includes(cliente.id)}
                    onChange={() => alternarCliente(cliente.id)}
                  />
                  {cliente.nombre}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Boton variante="fantasma" type="button" onClick={() => setAbierto(false)} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton variante="primario" type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : edicion ? 'Guardar cambios' : 'Crear regla'}
            </Boton>
          </div>
        </form>
      )}
    </Tarjeta>
  );
}

/* ========================================================================== */
/* Pantalla                                                                   */
/* ========================================================================== */

export default function Reglas() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<readonly Cliente[]>([]);

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

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
      <div>
        <h1 className="text-lg font-semibold">Reglas</h1>
        <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
          Tasas de IVA y reglas de recordatorio automático.
        </p>
      </div>

      <ReglasImpositivas />
      <ReglasDeNotificacion clientes={clientes} />
    </main>
  );
}

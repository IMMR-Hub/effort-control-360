/**
 * DATOS DE SEMILLA — NO SON DATOS REALES DE EFFORT.
 *
 * Existen para poder construir y revisar la interfaz antes de que lleguen los
 * archivos del piloto. Cada registro lleva `origen: 'SEMILLA'` y desaparece con
 * `npm run seed:purge`.
 *
 * Los nombres de clientes son los del handoff y están pendientes de confirmación
 * por parte de EFFORT (ver docs/DISCREPANCIAS.md, punto 3).
 *
 * Nada de lo que se muestra acá salió de una operación real. Las cifras que la
 * pantalla exhibe se calculan con @effort/core sobre estos registros: no hay
 * ningún número escrito a mano en la interfaz.
 */

export const ORIGEN = 'SEMILLA';

export const PERIODO_ACTIVO = { anio: 2026, mes: 3 };

export const CLIENTES = [
  { id: 'cli-garso', nombre: 'GARSO S.A.', responsable: 'Laura Sosa', coordinador: 'Karina Fretes' },
  { id: 'cli-lsosa', nombre: 'LAURA SOSA', responsable: 'Laura Sosa', coordinador: 'Karina Fretes' },
  { id: 'cli-rgarcia', nombre: 'RAMIRO GARCIA', responsable: 'Laura Sosa', coordinador: 'Aracely Gaona' },
  { id: 'cli-gsosa', nombre: 'GERARDO SOSA', responsable: 'Laura Sosa', coordinador: 'Aracely Gaona' },
  { id: 'cli-nrreg', nombre: 'NR REGISTROS GANADEROS', responsable: 'Laura Sosa', coordinador: 'Karina Fretes' },
];

/** Regla configurable: 2do día hábil, aviso 07:00, insistir cada 2, escalar al 3ro. */
export const REGLA_DOCUMENTACION = {
  id: 'regla-docs-mensual',
  nombre: 'Entrega de documentación mensual',
  activa: true,
  evento: 'DOCUMENTACION_NO_ENTREGADA',
  diasHabilesDePlazo: 2,
  horaDeEnvio: '07:00',
  reintentarCadaDiasHabiles: 2,
  maximoRecordatorios: 5,
  escalarAPartirDelRecordatorio: 3,
  destinatariosIniciales: [{ tipo: 'CLIENTE', valor: null }],
  destinatariosDeEscalamiento: [
    { tipo: 'ROL', valor: 'direccion' },
    { tipo: 'RESPONSABLE_DEL_CLIENTE', valor: null },
  ],
  plantillaId: 'plantilla-recordatorio-docs',
};

export const SOLICITUDES = [
  {
    id: 'sol-garso', clienteId: 'cli-garso', periodo: PERIODO_ACTIVO, estado: 'ENTREGADA',
    cuentaDesde: { anio: 2026, mes: 4, dia: 1 }, recordatoriosEnviados: 1,
    ultimoRecordatorioEn: { anio: 2026, mes: 4, dia: 8 },
  },
  {
    id: 'sol-lsosa', clienteId: 'cli-lsosa', periodo: PERIODO_ACTIVO, estado: 'ABIERTA',
    cuentaDesde: { anio: 2026, mes: 4, dia: 1 }, recordatoriosEnviados: 0,
    ultimoRecordatorioEn: null,
  },
  {
    id: 'sol-rgarcia', clienteId: 'cli-rgarcia', periodo: PERIODO_ACTIVO, estado: 'RESPONDIDA_SIN_ENTREGA',
    cuentaDesde: { anio: 2026, mes: 4, dia: 1 }, recordatoriosEnviados: 2,
    ultimoRecordatorioEn: { anio: 2026, mes: 4, dia: 10 },
  },
  {
    id: 'sol-gsosa', clienteId: 'cli-gsosa', periodo: PERIODO_ACTIVO, estado: 'ABIERTA',
    cuentaDesde: { anio: 2026, mes: 4, dia: 1 }, recordatoriosEnviados: 4,
    ultimoRecordatorioEn: { anio: 2026, mes: 4, dia: 16 },
  },
  {
    id: 'sol-nrreg', clienteId: 'cli-nrreg', periodo: PERIODO_ACTIVO, estado: 'ABIERTA',
    cuentaDesde: { anio: 2026, mes: 4, dia: 1 }, recordatoriosEnviados: 5,
    ultimoRecordatorioEn: { anio: 2026, mes: 4, dia: 20 },
  },
];

const contacto = (datos) => ({ evidenciaId: null, solicitudId: null, ...datos });

export const CONTACTOS = [
  contacto({
    id: 'c-01', clienteId: 'cli-garso', periodo: PERIODO_ACTIVO, solicitudId: 'sol-garso',
    canal: 'CORREO', direccion: 'SALIENTE', origen: 'AUTOMATICO',
    ocurridoEn: new Date('2026-04-08T10:00:00Z'), registradoPorUsuarioId: 'sistema',
    huboRespuesta: false, quienAtendio: null,
    resumen: 'Recordatorio automático 1 — documentación de marzo.', evidenciaId: 'ev-01',
  }),
  contacto({
    id: 'c-02', clienteId: 'cli-garso', periodo: PERIODO_ACTIVO, solicitudId: 'sol-garso',
    canal: 'WHATSAPP', direccion: 'ENTRANTE', origen: 'MANUAL',
    ocurridoEn: new Date('2026-04-09T12:20:00Z'), registradoPorUsuarioId: 'usr-karina',
    huboRespuesta: true, quienAtendio: 'Marta Ríos, administración',
    resumen: 'Avisan que dejan la carpeta el jueves.', evidenciaId: 'ev-02',
  }),

  contacto({
    id: 'c-03', clienteId: 'cli-rgarcia', periodo: PERIODO_ACTIVO, solicitudId: 'sol-rgarcia',
    canal: 'CORREO', direccion: 'SALIENTE', origen: 'AUTOMATICO',
    ocurridoEn: new Date('2026-04-08T10:00:00Z'), registradoPorUsuarioId: 'sistema',
    huboRespuesta: false, quienAtendio: null,
    resumen: 'Recordatorio automático 1 — documentación de marzo.', evidenciaId: 'ev-03',
  }),
  contacto({
    id: 'c-04', clienteId: 'cli-rgarcia', periodo: PERIODO_ACTIVO, solicitudId: 'sol-rgarcia',
    canal: 'LLAMADA', direccion: 'SALIENTE', origen: 'MANUAL',
    ocurridoEn: new Date('2026-04-10T13:40:00Z'), registradoPorUsuarioId: 'usr-aracely',
    huboRespuesta: true, quienAtendio: 'Sr. García',
    resumen: 'Dice que faltan extractos del banco; los pide y los manda la semana próxima.',
  }),
  contacto({
    id: 'c-05', clienteId: 'cli-rgarcia', periodo: PERIODO_ACTIVO, solicitudId: 'sol-rgarcia',
    canal: 'CORREO', direccion: 'SALIENTE', origen: 'AUTOMATICO',
    ocurridoEn: new Date('2026-04-10T10:00:00Z'), registradoPorUsuarioId: 'sistema',
    huboRespuesta: false, quienAtendio: null,
    resumen: 'Recordatorio automático 2 — documentación de marzo.', evidenciaId: 'ev-05',
  }),

  contacto({
    id: 'c-06', clienteId: 'cli-gsosa', periodo: PERIODO_ACTIVO, solicitudId: 'sol-gsosa',
    canal: 'CORREO', direccion: 'SALIENTE', origen: 'AUTOMATICO',
    ocurridoEn: new Date('2026-04-08T10:00:00Z'), registradoPorUsuarioId: 'sistema',
    huboRespuesta: false, quienAtendio: null, resumen: 'Recordatorio automático 1.', evidenciaId: 'ev-06',
  }),
  contacto({
    id: 'c-07', clienteId: 'cli-gsosa', periodo: PERIODO_ACTIVO, solicitudId: 'sol-gsosa',
    canal: 'WHATSAPP', direccion: 'SALIENTE', origen: 'MANUAL',
    ocurridoEn: new Date('2026-04-13T14:00:00Z'), registradoPorUsuarioId: 'usr-aracely',
    huboRespuesta: false, quienAtendio: null,
    resumen: 'Mensaje enviado, entregado pero sin respuesta.', evidenciaId: 'ev-07',
  }),
  contacto({
    id: 'c-08', clienteId: 'cli-gsosa', periodo: PERIODO_ACTIVO, solicitudId: 'sol-gsosa',
    canal: 'LLAMADA', direccion: 'SALIENTE', origen: 'MANUAL',
    ocurridoEn: new Date('2026-04-16T16:10:00Z'), registradoPorUsuarioId: 'usr-karina',
    huboRespuesta: false, quienAtendio: null, resumen: 'Llamada sin atender. Buzón lleno.',
  }),

  contacto({
    id: 'c-09', clienteId: 'cli-nrreg', periodo: PERIODO_ACTIVO, solicitudId: 'sol-nrreg',
    canal: 'CORREO', direccion: 'SALIENTE', origen: 'AUTOMATICO',
    ocurridoEn: new Date('2026-04-08T10:00:00Z'), registradoPorUsuarioId: 'sistema',
    huboRespuesta: false, quienAtendio: null, resumen: 'Recordatorio automático 1.', evidenciaId: 'ev-09',
  }),
  contacto({
    id: 'c-10', clienteId: 'cli-nrreg', periodo: PERIODO_ACTIVO, solicitudId: 'sol-nrreg',
    canal: 'CORREO', direccion: 'SALIENTE', origen: 'AUTOMATICO',
    ocurridoEn: new Date('2026-04-14T10:00:00Z'), registradoPorUsuarioId: 'sistema',
    huboRespuesta: false, quienAtendio: null,
    resumen: 'Recordatorio automático 3 — con copia a dirección.', evidenciaId: 'ev-10',
  }),
  contacto({
    id: 'c-11', clienteId: 'cli-nrreg', periodo: PERIODO_ACTIVO, solicitudId: 'sol-nrreg',
    canal: 'PRESENCIAL', direccion: 'SALIENTE', origen: 'MANUAL',
    ocurridoEn: new Date('2026-04-20T15:00:00Z'), registradoPorUsuarioId: 'usr-karina',
    huboRespuesta: false, quienAtendio: null,
    resumen: 'Se pasó por la oficina del cliente. Cerrado.',
  }),
];

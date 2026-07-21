import { describe, expect, it } from 'vitest';

import {
  ErrorDeSeguimiento,
  armarConstanciaDeGestion,
  correspondeEnviar,
  crearCalendario,
  diasSinContacto,
  esDiaHabil,
  fechaCivilDesdeIso,
  fechaLimiteDeEntrega,
  feriadosParaguay,
  planificarProximoRecordatorio,
  sumarDiasHabiles,
  validarRegistroContacto,
  validarReglaNotificacion,
  type RegistroContacto,
  type ReglaNotificacion,
  type SolicitudDocumentacion,
} from '../src/index.js';

const calendario = crearCalendario([
  ...feriadosParaguay(2026),
  ...feriadosParaguay(2027),
]);

/** Regla que refleja lo pedido: 2do día hábil, aviso 07:00, insistir cada 2 días, escalar al 3ro. */
const reglaDocumentacion: ReglaNotificacion = {
  id: 'regla-docs',
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

function solicitud(parcial: Partial<SolicitudDocumentacion> = {}): SolicitudDocumentacion {
  return {
    id: 'sol-1',
    clienteId: 'cli-1',
    periodo: { anio: 2026, mes: 3 },
    estado: 'ABIERTA',
    cuentaDesde: fechaCivilDesdeIso('2026-04-01'),
    recordatoriosEnviados: 0,
    ultimoRecordatorioEn: null,
    ...parcial,
  };
}

describe('días hábiles', () => {
  it('sábado y domingo no son hábiles', () => {
    // 2026-04-04 es sábado, 2026-04-05 domingo.
    expect(esDiaHabil(fechaCivilDesdeIso('2026-04-04'), calendario)).toBe(false);
    expect(esDiaHabil(fechaCivilDesdeIso('2026-04-05'), calendario)).toBe(false);
    expect(esDiaHabil(fechaCivilDesdeIso('2026-04-06'), calendario)).toBe(true);
  });

  it('un feriado nacional no es hábil aunque caiga entre semana', () => {
    // 1 de mayo de 2026 es viernes.
    expect(esDiaHabil(fechaCivilDesdeIso('2026-05-01'), calendario)).toBe(false);
  });

  it('el segundo día hábil salta el fin de semana', () => {
    // Jueves 2026-04-16 + 2 hábiles = lunes 2026-04-20 (viernes 17 y lunes 20).
    const resultado = sumarDiasHabiles(fechaCivilDesdeIso('2026-04-16'), 2, calendario);
    expect(resultado).toEqual({ anio: 2026, mes: 4, dia: 20 });
  });

  it('salta Semana Santa: en 2026 el Jueves y Viernes Santo son el 2 y 3 de abril', () => {
    // Miércoles 1 -> jueves 2 y viernes 3 son feriados, 4 y 5 fin de semana,
    // así que el primer hábil es el lunes 6 y el segundo el martes 7.
    expect(esDiaHabil(fechaCivilDesdeIso('2026-04-02'), calendario)).toBe(false);
    expect(esDiaHabil(fechaCivilDesdeIso('2026-04-03'), calendario)).toBe(false);
    expect(sumarDiasHabiles(fechaCivilDesdeIso('2026-04-01'), 2, calendario)).toEqual({
      anio: 2026, mes: 4, dia: 7,
    });
  });

  it('sumar cero días hábiles devuelve la misma fecha', () => {
    const fecha = fechaCivilDesdeIso('2026-04-01');
    expect(sumarDiasHabiles(fecha, 0, calendario)).toEqual(fecha);
  });
});

describe('plazo de entrega configurable', () => {
  it('el plazo de 2 días hábiles desde el 1 de abril de 2026 vence el 7, no el 3', () => {
    // El feriado de Semana Santa corre el vencimiento cuatro días corridos.
    // Contarlo en días calendario le habría descontado al cliente un plazo
    // que en realidad tenía.
    const limite = fechaLimiteDeEntrega(solicitud(), reglaDocumentacion, calendario);
    expect(limite).toEqual({ anio: 2026, mes: 4, dia: 7 });
  });

  it('el plazo se puede cambiar sin tocar código', () => {
    const reglaMasLarga = { ...reglaDocumentacion, diasHabilesDePlazo: 5 };
    const limite = fechaLimiteDeEntrega(solicitud(), reglaMasLarga, calendario);
    expect(limite).toEqual({ anio: 2026, mes: 4, dia: 10 });
  });
});

describe('primer recordatorio', () => {
  it('sale el día hábil siguiente al vencimiento del plazo, a la hora configurada', () => {
    // Plazo vence martes 7 de abril -> el aviso sale el miércoles 8 a las 07:00.
    const plan = planificarProximoRecordatorio(solicitud(), reglaDocumentacion, calendario);

    expect(plan?.numeroDeRecordatorio).toBe(1);
    expect(plan?.fecha).toEqual({ anio: 2026, mes: 4, dia: 8 });
    expect(plan?.hora).toBe('07:00');
  });

  it('no avisa el mismo día que vence el plazo: todavía está en término', () => {
    const plan = planificarProximoRecordatorio(solicitud(), reglaDocumentacion, calendario);
    const limite = fechaLimiteDeEntrega(solicitud(), reglaDocumentacion, calendario);

    expect(plan?.fecha).not.toEqual(limite);
  });

  it('va solo al cliente, sin molestar a nadie de EFFORT', () => {
    const plan = planificarProximoRecordatorio(solicitud(), reglaDocumentacion, calendario);

    expect(plan?.destinatarios).toEqual([{ tipo: 'CLIENTE', valor: null }]);
    expect(plan?.esEscalamiento).toBe(false);
  });

  it('la hora de envío se puede cambiar sin tocar código', () => {
    const plan = planificarProximoRecordatorio(
      solicitud(),
      { ...reglaDocumentacion, horaDeEnvio: '09:30' },
      calendario,
    );
    expect(plan?.hora).toBe('09:30');
  });
});

describe('insistencia y escalamiento a los dueños', () => {
  it('el segundo recordatorio sale dos días hábiles después del primero, todavía sin escalar', () => {
    const plan = planificarProximoRecordatorio(
      solicitud({ recordatoriosEnviados: 1, ultimoRecordatorioEn: fechaCivilDesdeIso('2026-04-08') }),
      reglaDocumentacion,
      calendario,
    );

    expect(plan?.numeroDeRecordatorio).toBe(2);
    expect(plan?.fecha).toEqual({ anio: 2026, mes: 4, dia: 10 });
    expect(plan?.esEscalamiento).toBe(false);
  });

  it('el tercer recordatorio suma a dirección y al responsable del cliente', () => {
    const plan = planificarProximoRecordatorio(
      solicitud({ recordatoriosEnviados: 2, ultimoRecordatorioEn: fechaCivilDesdeIso('2026-04-10') }),
      reglaDocumentacion,
      calendario,
    );

    expect(plan?.numeroDeRecordatorio).toBe(3);
    expect(plan?.esEscalamiento).toBe(true);
    expect(plan?.destinatarios).toEqual([
      { tipo: 'CLIENTE', valor: null },
      { tipo: 'ROL', valor: 'direccion' },
      { tipo: 'RESPONSABLE_DEL_CLIENTE', valor: null },
    ]);
  });

  it('el punto de escalamiento es configurable: con 1 escala desde el primer aviso', () => {
    const plan = planificarProximoRecordatorio(
      solicitud(),
      { ...reglaDocumentacion, escalarAPartirDelRecordatorio: 1 },
      calendario,
    );
    expect(plan?.esEscalamiento).toBe(true);
  });

  it('deja de insistir al agotar el máximo configurado', () => {
    const plan = planificarProximoRecordatorio(
      solicitud({ recordatoriosEnviados: 5, ultimoRecordatorioEn: fechaCivilDesdeIso('2026-04-20') }),
      reglaDocumentacion,
      calendario,
    );
    expect(plan).toBeNull();
  });

  it('no insiste si el cliente ya entregó', () => {
    expect(
      planificarProximoRecordatorio(solicitud({ estado: 'ENTREGADA' }), reglaDocumentacion, calendario),
    ).toBeNull();
  });

  it('no insiste si la solicitud se cerró a mano', () => {
    expect(
      planificarProximoRecordatorio(
        solicitud({ estado: 'CERRADA_MANUALMENTE' }),
        reglaDocumentacion,
        calendario,
      ),
    ).toBeNull();
  });

  it('una regla desactivada no envía nada', () => {
    expect(
      planificarProximoRecordatorio(solicitud(), { ...reglaDocumentacion, activa: false }, calendario),
    ).toBeNull();
  });

  it('sigue insistiendo si el cliente respondió pero no entregó', () => {
    const plan = planificarProximoRecordatorio(
      solicitud({ estado: 'RESPONDIDA_SIN_ENTREGA', recordatoriosEnviados: 1, ultimoRecordatorioEn: fechaCivilDesdeIso('2026-04-08') }),
      reglaDocumentacion,
      calendario,
    );
    expect(plan).not.toBeNull();
  });

  it('un recordatorio planificado para hoy corresponde enviarlo', () => {
    const plan = planificarProximoRecordatorio(solicitud(), reglaDocumentacion, calendario);
    expect(correspondeEnviar(plan!, fechaCivilDesdeIso('2026-04-08'))).toBe(true);
    expect(correspondeEnviar(plan!, fechaCivilDesdeIso('2026-04-09'))).toBe(true);
    expect(correspondeEnviar(plan!, fechaCivilDesdeIso('2026-04-07'))).toBe(false);
  });
});

describe('validación de reglas', () => {
  it('rechaza una hora de envío inválida', () => {
    expect(() =>
      validarReglaNotificacion({ ...reglaDocumentacion, horaDeEnvio: '25:00' }),
    ).toThrow(ErrorDeSeguimiento);
    expect(() => validarReglaNotificacion({ ...reglaDocumentacion, horaDeEnvio: '7' })).toThrow(
      ErrorDeSeguimiento,
    );
  });

  it('acepta 07:00', () => {
    expect(() => validarReglaNotificacion(reglaDocumentacion)).not.toThrow();
  });

  it('rechaza una regla sin destinatarios', () => {
    expect(() =>
      validarReglaNotificacion({ ...reglaDocumentacion, destinatariosIniciales: [] }),
    ).toThrow(ErrorDeSeguimiento);
  });
});

describe('bitácora de contactos', () => {
  function contacto(parcial: Partial<RegistroContacto> = {}): RegistroContacto {
    return {
      id: 'con-1',
      clienteId: 'cli-1',
      periodo: { anio: 2026, mes: 3 },
      solicitudId: 'sol-1',
      canal: 'LLAMADA',
      direccion: 'SALIENTE',
      origen: 'MANUAL',
      ocurridoEn: new Date('2026-04-06T13:00:00Z'),
      registradoPorUsuarioId: 'usr-karina',
      huboRespuesta: true,
      quienAtendio: 'Sra. González, administración',
      resumen: 'Se pidieron las facturas de compra de marzo.',
      evidenciaId: null,
      ...parcial,
    };
  }

  it('un contacto con respuesta debe decir quién atendió', () => {
    expect(() =>
      validarRegistroContacto(contacto({ huboRespuesta: true, quienAtendio: null })),
    ).toThrow(ErrorDeSeguimiento);
  });

  it('no se puede decir quién atendió si figura como sin respuesta', () => {
    expect(() =>
      validarRegistroContacto(contacto({ huboRespuesta: false, quienAtendio: 'Alguien' })),
    ).toThrow(ErrorDeSeguimiento);
  });

  it('un contacto sin respuesta es válido y es la evidencia más importante', () => {
    expect(() =>
      validarRegistroContacto(
        contacto({ huboRespuesta: false, quienAtendio: null, resumen: 'Llamada sin atender.' }),
      ),
    ).not.toThrow();
  });

  it('todo contacto queda atribuido a un usuario', () => {
    expect(() => validarRegistroContacto(contacto({ registradoPorUsuarioId: '  ' }))).toThrow(
      ErrorDeSeguimiento,
    );
  });

  it('un contacto manual debe describir qué se habló', () => {
    expect(() => validarRegistroContacto(contacto({ origen: 'MANUAL', resumen: '' }))).toThrow(
      ErrorDeSeguimiento,
    );
  });
});

describe('constancia de gestión ante un reclamo', () => {
  const contactos: RegistroContacto[] = [
    {
      id: 'c1', clienteId: 'cli-1', periodo: { anio: 2026, mes: 3 }, solicitudId: 'sol-1',
      canal: 'CORREO', direccion: 'SALIENTE', origen: 'AUTOMATICO',
      ocurridoEn: new Date('2026-04-06T11:00:00Z'), registradoPorUsuarioId: 'sistema',
      huboRespuesta: false, quienAtendio: null, resumen: 'Recordatorio automático 1.', evidenciaId: 'ev-1',
    },
    {
      id: 'c2', clienteId: 'cli-1', periodo: { anio: 2026, mes: 3 }, solicitudId: 'sol-1',
      canal: 'WHATSAPP', direccion: 'SALIENTE', origen: 'MANUAL',
      ocurridoEn: new Date('2026-04-09T14:30:00Z'), registradoPorUsuarioId: 'usr-karina',
      huboRespuesta: false, quienAtendio: null, resumen: 'Mensaje sin respuesta.', evidenciaId: 'ev-2',
    },
    {
      id: 'c3', clienteId: 'cli-1', periodo: { anio: 2026, mes: 3 }, solicitudId: 'sol-1',
      canal: 'LLAMADA', direccion: 'SALIENTE', origen: 'MANUAL',
      ocurridoEn: new Date('2026-04-16T13:00:00Z'), registradoPorUsuarioId: 'usr-karina',
      huboRespuesta: true, quienAtendio: 'Sra. González', resumen: 'Prometió enviar el lunes.', evidenciaId: null,
    },
    // Contacto de otro cliente: no debe contaminar la constancia.
    {
      id: 'c4', clienteId: 'cli-2', periodo: { anio: 2026, mes: 3 }, solicitudId: 'sol-9',
      canal: 'LLAMADA', direccion: 'SALIENTE', origen: 'MANUAL',
      ocurridoEn: new Date('2026-04-10T13:00:00Z'), registradoPorUsuarioId: 'usr-karina',
      huboRespuesta: false, quienAtendio: null, resumen: 'Otro cliente.', evidenciaId: null,
    },
  ];

  const constancia = armarConstanciaDeGestion('cli-1', { anio: 2026, mes: 3 }, contactos);

  it('cuenta solo los contactos del cliente y período pedidos', () => {
    expect(constancia.totalDeContactos).toBe(3);
  });

  it('desglosa por canal', () => {
    expect(constancia.contactosPorCanal).toEqual({
      LLAMADA: 1, MENSAJE: 0, WHATSAPP: 1, CORREO: 1, PRESENCIAL: 0,
    });
  });

  it('separa los envíos automáticos de los contactos cargados a mano', () => {
    expect(constancia.contactosAutomaticos).toBe(1);
    expect(constancia.contactosManuales).toBe(2);
  });

  it('registra quién atendió del lado del cliente', () => {
    expect(constancia.personasQueAtendieron).toEqual(['Sra. González']);
    expect(constancia.vecesQueRespondieron).toBe(1);
  });

  it('mide el lapso de la gestión', () => {
    expect(constancia.diasDeGestion).toBe(10);
    expect(constancia.primerContacto).toEqual(new Date('2026-04-06T11:00:00Z'));
    expect(constancia.ultimoContacto).toEqual(new Date('2026-04-16T13:00:00Z'));
  });

  it('redacta una síntesis usable como encabezado de la constancia', () => {
    expect(constancia.sintesis).toBe(
      'Se registran 3 intento(s) de contacto a lo largo de 10 día(s), con 1 respuesta(s) del cliente.',
    );
  });

  it('deja constancia explícita cuando el cliente nunca respondió', () => {
    const sinRespuesta = armarConstanciaDeGestion(
      'cli-1',
      { anio: 2026, mes: 3 },
      contactos.filter((c) => !c.huboRespuesta),
    );
    expect(sinRespuesta.sintesis).toContain('El cliente no respondió a ninguno de los intentos.');
  });

  it('un cliente sin gestión registrada lo dice, en vez de devolver un vacío ambiguo', () => {
    const vacia = armarConstanciaDeGestion('cli-9', { anio: 2026, mes: 3 }, contactos);
    expect(vacia.totalDeContactos).toBe(0);
    expect(vacia.sintesis).toBe('No se registran intentos de contacto para este cliente y período.');
  });

  it('ordena la prioridad de llamado por días sin contacto', () => {
    expect(diasSinContacto(contactos.filter((c) => c.clienteId === 'cli-1'), fechaCivilDesdeIso('2026-04-20'))).toBe(4);
    expect(diasSinContacto([], fechaCivilDesdeIso('2026-04-20'))).toBeNull();
  });
});

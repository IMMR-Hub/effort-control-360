/**
 * Tests del adaptador real, sin red: se reemplaza `fetch` global y se verifica
 * que arme las peticiones que Microsoft Graph espera. Todavía no hay una
 * cuenta real contra la cual probar de punta a punta (ver
 * `docs/DISCREPANCIAS.md`, punto 6) — esto prueba el código propio, no la API
 * de Microsoft.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DriveGraph } from '../src/adaptadorGraph.js';

const CONFIGURACION = {
  tenantId: 'tenant-123',
  clientId: 'client-abc',
  clientSecret: 'secreto',
  driveId: 'drive-xyz',
};

function respuestaToken(token = 'un-token', expiresIn = 3600): Response {
  return new Response(JSON.stringify({ access_token: token, expires_in: expiresIn }), {
    status: 200,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DriveGraph', () => {
  it('pide el token con client credentials antes de listar', async () => {
    const llamadas: { url: string; opciones: RequestInit | undefined }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, opciones?: RequestInit) => {
        llamadas.push({ url: url.toString(), opciones });
        if (url.toString().includes('login.microsoftonline.com')) return respuestaToken();
        return new Response(JSON.stringify({ value: [] }), { status: 200 });
      }),
    );

    const drive = new DriveGraph(CONFIGURACION);
    await drive.listar('EFFORT/comprobantes');

    expect(llamadas[0]?.url).toBe(
      'https://login.microsoftonline.com/tenant-123/oauth2/v2.0/token',
    );
    const cuerpo = new URLSearchParams(llamadas[0]?.opciones?.body as string);
    expect(cuerpo.get('client_id')).toBe('client-abc');
    expect(cuerpo.get('grant_type')).toBe('client_credentials');
    expect(cuerpo.get('scope')).toBe('https://graph.microsoft.com/.default');
  });

  it('reutiliza el token en la segunda llamada, sin pedirlo de nuevo', async () => {
    let pedidosDeToken = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.toString().includes('login.microsoftonline.com')) {
          pedidosDeToken += 1;
          return respuestaToken();
        }
        return new Response(JSON.stringify({ value: [] }), { status: 200 });
      }),
    );

    const drive = new DriveGraph(CONFIGURACION);
    await drive.listar('EFFORT/comprobantes');
    await drive.listar('EFFORT/siga');

    expect(pedidosDeToken).toBe(1);
  });

  it('listar arma la ruta por carpeta y excluye subcarpetas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.toString().includes('login.microsoftonline.com')) return respuestaToken();
        return new Response(
          JSON.stringify({
            value: [
              {
                id: 'item-1', name: 'marzo.xlsx', size: 1024,
                lastModifiedDateTime: '2026-03-15T12:00:00Z',
                file: { mimeType: 'application/vnd.ms-excel' },
              },
              { id: 'item-2', name: 'subcarpeta', size: 0, lastModifiedDateTime: '2026-03-01T00:00:00Z', folder: {} },
            ],
          }),
          { status: 200 },
        );
      }),
    );

    const drive = new DriveGraph(CONFIGURACION);
    const archivos = await drive.listar('EFFORT/comprobantes');

    expect(archivos).toHaveLength(1);
    expect(archivos[0]).toMatchObject({
      itemId: 'item-1', nombre: 'marzo.xlsx', rutaCarpeta: 'EFFORT/comprobantes',
      tamanoBytes: 1024, tipoMime: 'application/vnd.ms-excel',
    });
  });

  it('leer devuelve el contenido como Buffer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.toString().includes('login.microsoftonline.com')) return respuestaToken();
        return new Response(Buffer.from('contenido del archivo'), { status: 200 });
      }),
    );

    const drive = new DriveGraph(CONFIGURACION);
    const contenido = await drive.leer('item-1');

    expect(contenido.toString('utf8')).toBe('contenido del archivo');
  });

  it('escribir hace un PUT al endpoint de contenido con el cuerpo crudo', async () => {
    const llamadas: { url: string; metodo: string | undefined }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, opciones?: RequestInit) => {
        llamadas.push({ url: url.toString(), metodo: opciones?.method });
        if (url.toString().includes('login.microsoftonline.com')) return respuestaToken();
        return new Response(
          JSON.stringify({
            id: 'item-nuevo', name: 'marzo.xlsx', size: 5,
            lastModifiedDateTime: '2026-03-15T12:00:00Z',
          }),
          { status: 200 },
        );
      }),
    );

    const drive = new DriveGraph(CONFIGURACION);
    const meta = await drive.escribir('EFFORT/comprobantes', 'marzo.xlsx', Buffer.from('hola!'));

    expect(meta.itemId).toBe('item-nuevo');
    const llamadaGraph = llamadas.find((l) => l.url.includes('graph.microsoft.com'));
    expect(llamadaGraph?.metodo).toBe('PUT');
    expect(llamadaGraph?.url).toContain('/root:/EFFORT/comprobantes/marzo.xlsx:/content');
  });

  /**
   * Antes esto era un error. Se cambió el 2026-09-11 porque al sincronizar el
   * OneDrive real de EFFORT, el estatuto social de Copesa (5,7 MB) fallaba en
   * cada corrida y nunca iba a entrar.
   */
  it('un archivo de más de 4 MiB se sube abriendo una sesión de carga', async () => {
    const llamadas: { url: string; metodo: string | undefined; cabeceras: HeadersInit | undefined }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, opciones?: RequestInit) => {
        const direccion = url.toString();
        llamadas.push({ url: direccion, metodo: opciones?.method, cabeceras: opciones?.headers });

        if (direccion.includes('login.microsoftonline.com')) return respuestaToken();
        if (direccion.includes('createUploadSession')) {
          return new Response(JSON.stringify({ uploadUrl: 'https://subida.example/sesion-1' }), {
            status: 200,
          });
        }
        return new Response(
          JSON.stringify({
            id: 'item-grande', name: 'estatuto.pdf', size: 5_733_684,
            lastModifiedDateTime: '2026-03-15T12:00:00Z',
          }),
          { status: 200 },
        );
      }),
    );

    const drive = new DriveGraph(CONFIGURACION);
    const enorme = Buffer.alloc(4 * 1024 * 1024 + 1);
    const meta = await drive.escribir('EFFORT/legales', 'estatuto.pdf', enorme);

    expect(meta.itemId).toBe('item-grande');

    const sesion = llamadas.find((l) => l.url.includes('createUploadSession'));
    expect(sesion?.metodo).toBe('POST');

    const subida = llamadas.find((l) => l.url.startsWith('https://subida.example/'));
    expect(subida?.metodo).toBe('PUT');
    expect((subida?.cabeceras as Record<string, string>)['content-range']).toBe(
      `bytes 0-${enorme.byteLength - 1}/${enorme.byteLength}`,
    );
    // La URL de la sesión ya viene firmada: mandarle el token la hace fallar.
    expect((subida?.cabeceras as Record<string, string>)['authorization']).toBeUndefined();
  });

  it('un error de Graph incluye el código de estado y el cuerpo de la respuesta', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.toString().includes('login.microsoftonline.com')) return respuestaToken();
        return new Response('No tenés permiso sobre este drive.', { status: 403 });
      }),
    );

    const drive = new DriveGraph(CONFIGURACION);
    await expect(drive.listar('EFFORT/comprobantes')).rejects.toThrow(/403/);
  });

  it('un fallo de autenticación no llega a intentar la llamada a Graph', async () => {
    const fetchSimulado = vi.fn(async (url: string) => {
      if (url.toString().includes('login.microsoftonline.com')) {
        return new Response('client_secret inválido', { status: 401 });
      }
      throw new Error('No debería llamarse a Graph si la autenticación falló.');
    });
    vi.stubGlobal('fetch', fetchSimulado);

    const drive = new DriveGraph(CONFIGURACION);
    await expect(drive.listar('EFFORT/comprobantes')).rejects.toThrow(/autenticar/);
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

test('montaje normal no conecta cliente ni hace llamadas; el puerto explícito se libera al ocultar', async () => {
  let montajes = 0, conexiones = 0, desmontajes = 0, llamadas = 0;
  const contexto = createContext({});
  const modulos = new Map();
  function modulo(nombre, valores) {
    return new SyntheticModule(Object.keys(valores), function () {
      for (const [clave, valor] of Object.entries(valores)) this.setExport(clave, valor);
    }, { context: contexto, identifier: nombre });
  }
  modulos.set('./agente-ui.js', modulo('ui', {
    montarAgente: () => { montajes++; return { desmontar() {} }; },
    desmontarAgente: () => { desmontajes++; },
  }));
  modulos.set('./agente-memoria-conexion.js', modulo('memoria-conexion', {
    conectarMemoriaAgente: () => ({ desmontar() {}, actualizar: async () => ({ ok: true }) }),
  }));
  modulos.set('./catalogo.js', modulo('catalogo', { escucharSeleccionCatalogo: () => () => {} }));
  modulos.set('./agente-contexto-catalogo.js', modulo('contexto', {
    crearProductorContextoCatalogo: () => () => null,
  }));
  modulos.set('./agente-memoria.js', modulo('memoria', { POLITICA_PROVISIONAL_MEMORIA: Object.freeze({}) }));
  modulos.set('./agente-integracion-widget.js', modulo('integracion', {
    conectarClienteWidget: () => { conexiones++; return { desmontar() { llamadas++; } }; },
  }));
  const codigo = await readFile(new URL('../../js/agente-montaje.js', import.meta.url), 'utf8');
  const montaje = new SourceTextModule(codigo, { context: contexto, identifier: 'agente-montaje.js' });
  await montaje.link(nombre => modulos.get(nombre)); await montaje.evaluate();
  const eventos = new Map();
  const ventana = { addEventListener(tipo, f) { eventos.set(tipo, f); }, removeEventListener(tipo) { eventos.delete(tipo); } };
  const documento = { body: {}, defaultView: ventana, querySelector() { return null; } };
  const desconectar = montaje.namespace.iniciarAgente(documento);
  assert.equal(montajes, 1); assert.equal(conexiones, 0); assert.equal(llamadas, 0);
  desconectar(); assert.equal(desmontajes, 1);
  const desconectarActivo = montaje.namespace.iniciarAgente(documento, {
    integracion: { habilitada: true, cliente: { solicitar() {} } },
  });
  assert.equal(conexiones, 1); eventos.get('pagehide')(); assert.equal(llamadas, 1);
  desconectarActivo();
});

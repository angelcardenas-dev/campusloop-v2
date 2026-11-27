import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const fuente = await readFile(new URL('../js/publicaciones.js', import.meta.url), 'utf8');

function montar() {
  class Nodo {
    constructor() { this.children = []; this.dataset = {}; this.textContent = ''; this.className = ''; }
    append(...nodos) { this.children.push(...nodos); }
    replaceChildren(...nodos) { this.children = [...nodos]; }
  }
  const elementos = new Map([['estado-mis-publicaciones', new Nodo()], ['lista-mis-publicaciones', new Nodo()]]);
  const documento = { getElementById: id => elementos.get(id) ?? null, createElement: () => new Nodo(), addEventListener() {} };
  const window = { document: documento };
  runInNewContext(fuente, { window, document: documento, Object, Set, Map, Promise, URL, Date, Number, RegExp, String, Error });
  return { ui: window.CampusLoopPublicaciones, e: id => elementos.get(id) };
}

const articulo = { id: 'articulo-sintetico', titulo: '<img src=x onerror=alert(1)>', descripcion: 'Descripción de prueba',
  estado: 'disponible', precioCentimos: 2599, moneda: 'PEN', imagen: { url: 'https://no-debe-renderizarse.invalid/foto' } };

test('la vista inicial informa integración pendiente sin datos ficticios', () => {
  const { ui, e } = montar();
  assert.equal(ui.presentarMisPublicaciones({ documento: { getElementById: () => null } }), false);
  assert.equal(ui.presentarMisPublicaciones({ documento: { getElementById: id => e(id) }, estado: 'pendiente' }), true);
  assert.match(e('estado-mis-publicaciones').textContent, /Integración pendiente/);
  assert.equal(e('lista-mis-publicaciones').children.length, 0);
});

test('representa carga, error y lista vacía como estados accesibles', () => {
  const { ui, e } = montar();
  const documento = { getElementById: id => e(id) };
  for (const estado of ['cargando', 'error', 'vacio']) {
    assert.equal(ui.presentarMisPublicaciones({ documento, estado }), true);
    assert.equal(e('estado-mis-publicaciones').dataset.estado, estado);
    assert.ok(e('estado-mis-publicaciones').textContent.length > 0);
    assert.equal(e('lista-mis-publicaciones').children.length, 0);
  }
});

test('presenta solo campos permitidos y trata el contenido como texto', () => {
  const { ui, e } = montar();
  const documento = { getElementById: id => e(id), createElement: () => {
    const node = { children: [], append(...nodes) { this.children.push(...nodes); } };
    return node;
  } };
  assert.equal(ui.presentarMisPublicaciones({ documento, estado: 'listo', publicaciones: [articulo] }), true);
  assert.equal(e('lista-mis-publicaciones').children.length, 1);
  const tarjeta = e('lista-mis-publicaciones').children[0];
  assert.equal(tarjeta.children[0].textContent, articulo.titulo);
  assert.equal(tarjeta.children[2].textContent, 'S/ 25.99');
  assert.equal(tarjeta.children.some(n => String(n.textContent).includes('https://')), false);
});

test('rechaza estados no reconocidos y no presenta artículos con DTO inválido', () => {
  const { ui, e } = montar();
  const documento = { getElementById: id => e(id), createElement: () => ({ children: [], append(...nodes) { this.children.push(...nodes); } }) };
  assert.equal(ui.presentarMisPublicaciones({ documento, estado: 'vendido-por-ui', publicaciones: [articulo] }), false);
  assert.equal(ui.presentarMisPublicaciones({ documento, estado: 'listo', publicaciones: [{ ...articulo, estado: 'inventado' }] }), true);
  assert.equal(e('lista-mis-publicaciones').children.length, 0);
  assert.equal(e('estado-mis-publicaciones').dataset.estado, 'error');
});

// Exclusivos de pruebas: NO son catálogos ni el DTO del servicio de Bernabé.
export const IDS = Object.freeze({
  articulo: '2ae8c180-f4f7-4355-8c73-0ce9334ec9c1', otro: '3868a854-f027-4305-b6a8-438b75cfe952',
  categoria: 'cc20b59a-d8c6-4e46-9fc4-6fdfd72cd244', universidad: '7e1f552a-18fe-4427-929f-6b0c4ea26d46',
  otraUniversidad: '8dfe6497-a6a6-4dd1-b027-a61fbb1aef39', campus: 'a826a545-23d4-46db-bd47-7fa3085afca0',
  otroCampus: 'b56d71eb-109b-4311-a1bb-aa0eaf137a62',
});
export function opcionesPrueba() {
  return { categorias: [{ id: IDS.categoria, etiqueta: 'Categoría sintética' }],
    universidades: [{ id: IDS.universidad, etiqueta: 'Universidad de prueba A' }, { id: IDS.otraUniversidad, etiqueta: 'Universidad de prueba B' }],
    campus: [{ id: IDS.campus, universidadId: IDS.universidad, etiqueta: 'Campus de prueba A' },
      { id: IDS.otroCampus, universidadId: IDS.otraUniversidad, etiqueta: 'Campus de prueba B' }],
    estados: [{ valor: 'estado-fixture', etiqueta: 'Estado sintético' }],
    condiciones: [{ valor: 'condicion-fixture', etiqueta: 'Condición sintética' }] };
}
export function registrosPrueba() {
  return [{ claveSoloPrueba: IDS.articulo, rotuloSoloPrueba: 'Artículo sintético A', centimosSoloPrueba: 12345 },
    { claveSoloPrueba: IDS.otro, rotuloSoloPrueba: '<img src=x onerror=alert(1)>', centimosSoloPrueba: 99900 }];
}
export function adaptarRegistroPrueba(registro) {
  return { id: registro.claveSoloPrueba, titulo: registro.rotuloSoloPrueba, precioCentimos: registro.centimosSoloPrueba,
    moneda: 'PEN', categoriaTexto: 'Categoría de prueba', ubicacionTexto: 'Campus de prueba', vendedorTexto: null,
    estadoTexto: 'Etiqueta de prueba', tono: 'neutral',
    foto: { url: 'assets/images/productos/calculadora-casio-fx991ex.jpg', alt: 'Fotografía local de prueba' } };
}
export const respuestaPrueba = () => ({ ok: true, datos: registrosPrueba(), error: null });
export const pausa = () => new Promise(resolve => setImmediate(resolve));
export function diferida() { let resolver; const promesa = new Promise(resolve => { resolver = resolve; }); return { promesa, resolver }; }

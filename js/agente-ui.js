/* Datos: D1.1, interfaz informativa sin modelo, herramientas ni persistencia. */
const montajes = new WeakMap();
const MAX_TEXTO = 1000;
const MAX_MENSAJES = 20;
const BIENVENIDA = '¡Hola! Soy el asistente de CampusLoop. Pronto podré ayudarte a encontrar artículos, consultar tus reservas y preparar publicaciones.';
const LISTA = 'Demostración local · sin conexión a IA';
const PENDIENTE = 'Integración pendiente · mensaje solo en esta página';
const ERRORES_VOZ = {
  'not-allowed': 'El navegador bloqueó la voz por permisos, privacidad o seguridad. Revisa el permiso del micrófono; puedes escribir.',
  'service-not-allowed': 'El navegador no permite este servicio de reconocimiento. Puedes seguir escribiendo.',
  'audio-capture': 'No se pudo captar audio del micrófono. Comprueba que esté conectado y disponible; puedes escribir.',
  network: 'El servicio de voz del navegador no pudo transcribir por un fallo de conexión o disponibilidad. Puedes escribir.',
  'language-not-supported': 'El navegador no admite reconocimiento en es-PE. No se cambió el idioma; puedes escribir.',
  'no-speech': 'No se detectó voz. Puedes volver a intentarlo o escribir.',
  aborted: 'Reconocimiento cancelado. Puedes seguir escribiendo.',
};

/* Funciones y elementos: una instancia por documento, con APIs de voz inyectables. */
export function montarAgente({ documento = globalThis.document,
  Reconocimiento = documento?.defaultView?.SpeechRecognition ?? documento?.defaultView?.webkitSpeechRecognition,
  sintesis = documento?.defaultView?.speechSynthesis,
  Locucion = documento?.defaultView?.SpeechSynthesisUtterance,
} = {}) {
  if (!documento?.body || !documento.defaultView) throw new TypeError('Se requiere un documento cargado.');
  const anterior = montajes.get(documento);
  if (anterior?.raiz.isConnected) return anterior;
  anterior?.desmontar();
  const ventana = documento.defaultView;
  let viva = true, abierta = false, reconocimiento = null, locucion = null;
  let secuenciaVoz = 0, enviando = false;
  const historial = [], limpiezas = [], temporales = [];
  const accionesMemoria = new Set();
  const accionesEnvio = new Set(), accionesCancelacion = new Set();
  let mensajeMemoria = null;
  const diagnosticoVoz = { intentos: 0, eventos: [] };
  function registrarVoz(evento, codigo) {
    // Solo tipos y códigos controlados: nunca audio, texto reconocido ni errores internos.
    diagnosticoVoz.eventos.push({ evento, ...(codigo ? { codigo } : {}) });
    if (diagnosticoVoz.eventos.length > 12) diagnosticoVoz.eventos.shift();
  }
  const nodo = (tag, clase, texto) => {
    const e = documento.createElement(tag); e.className = `cl-agente-${clase}`;
    if (texto !== undefined) e.textContent = texto;
    return e;
  };
  const boton = (clase, texto) => { const e = nodo('button', clase, texto); e.type = 'button'; return e; };
  // SVG propios y constantes: ningún atributo ni trazado procede del usuario.
  function icono(nombre) {
    const ns = 'http://www.w3.org/2000/svg', svg = documento.createElementNS(ns, 'svg');
    for (const [clave, valor] of Object.entries({ viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(clave, valor);
    const trazos = {
      robot: [['rect', { x: 6, y: 10, width: 20, height: 17, rx: 7 }], ['path', { d: 'M16 6v4M3 16v6m26-6v6m-17 1h8' }], ['circle', { cx: 16, cy: 4, r: 2 }], ['circle', { cx: 12, cy: 17, r: 1, fill: 'currentColor' }], ['circle', { cx: 20, cy: 17, r: 1, fill: 'currentColor' }]],
      cerrar: [['path', { d: 'm9 9 14 14M23 9 9 23' }]],
      micro: [['rect', { x: 12, y: 4, width: 8, height: 16, rx: 4 }], ['path', { d: 'M8 15v2a8 8 0 0 0 16 0v-2M16 25v4m-5 0h10' }]],
      enviar: [['path', { d: 'm6 5 22 11L6 27l4-11L6 5Zm4 11h18' }]],
      borrar: [['path', { d: 'M7 9h18M12 9V5h8v4M9 9l1 19h12l1-19M14 14v9m4-9v9' }]],
      altavoz: [['path', { d: 'M6 13h5l7-6v18l-7-6H6v-6Zm16-3a8 8 0 0 1 0 12m3-16a13 13 0 0 1 0 20' }]],
      detener: [['rect', { x: 9, y: 9, width: 14, height: 14, rx: 2, fill: 'currentColor', stroke: 'none' }]],
    };
    for (const [tag, atributos] of trazos[nombre]) {
      const trazo = documento.createElementNS(ns, tag);
      for (const [clave, valor] of Object.entries(atributos)) trazo.setAttribute(clave, valor);
      svg.append(trazo);
    }
    return svg;
  }
  function botonIcono(clase, nombre, etiqueta) {
    const e = boton(clase); e.setAttribute('aria-label', etiqueta); e.title = etiqueta; e.append(icono(nombre)); return e;
  }
  const raiz = nodo('div', 'raiz');
  let prefijo = 'cl-agente';
  for (let i = 1; documento.getElementById(`${prefijo}-panel`); i++) prefijo = `cl-agente-${i}`;
  const abrir = botonIcono('abrir', 'robot', 'Abrir asistente CampusLoop');
  abrir.setAttribute('aria-expanded', 'false'); abrir.setAttribute('aria-controls', `${prefijo}-panel`);
  const panel = nodo('section', 'panel'); panel.id = `${prefijo}-panel`; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-labelledby', `${prefijo}-titulo`);
  const cabecera = nodo('div', 'cabecera');
  const avatar = nodo('div', 'avatar'); avatar.append(icono('robot')); avatar.setAttribute('aria-hidden', 'true');
  const identidad = nodo('div', 'identidad');
  const titulo = nodo('h2', 'titulo', 'Asistente CampusLoop'); titulo.id = `${prefijo}-titulo`;
  identidad.append(titulo, nodo('p', 'disponibilidad', 'En preparación'));
  const cerrarBoton = botonIcono('cerrar', 'cerrar', 'Cerrar asistente CampusLoop');
  cabecera.append(avatar, identidad, cerrarBoton);
  const estado = nodo('p', 'estado', LISTA);
  estado.setAttribute('role', 'status'); estado.setAttribute('aria-atomic', 'true');
  const mensajes = nodo('div', 'mensajes'); mensajes.setAttribute('role', 'log');
  mensajes.setAttribute('aria-label', 'Mensajes de prueba del asistente');
  mensajes.setAttribute('aria-live', 'polite'); mensajes.setAttribute('aria-relevant', 'additions');
  mensajes.setAttribute('aria-atomic', 'false'); mensajes.tabIndex = 0;
  const aviso = nodo('p', 'aviso', 'Mensajes escritos o dictados: temporales. El contexto de búsqueda permitido solo se guarda con consentimiento. IA no conectada.');
  aviso.id = `${prefijo}-aviso`;
  const vozAviso = nodo('p', 'aviso', typeof Reconocimiento === 'function'
    ? 'Voz: el micrófono se activa al pulsarlo. La transcripción puede usar un servicio del navegador; revisa el texto antes de enviarlo.'
    : 'Este navegador no ofrece reconocimiento de voz. Puedes continuar escribiendo.');
  vozAviso.id = `${prefijo}-voz-aviso`;
  const formulario = nodo('form', 'formulario'); formulario.noValidate = true;
  const etiqueta = nodo('label', 'sr', 'Tu mensaje de prueba'); etiqueta.htmlFor = `${prefijo}-texto`;
  const texto = nodo('textarea', 'texto'); texto.id = `${prefijo}-texto`; texto.rows = 1; texto.maxLength = MAX_TEXTO;
  texto.placeholder = 'Escribe un mensaje…';
  texto.setAttribute('aria-describedby', `${aviso.id} ${vozAviso.id} ${prefijo}-limite`);
  const limite = nodo('p', 'sr', 'Máximo 1000 caracteres. Enter envía; Shift+Enter añade una línea.'); limite.id = `${prefijo}-limite`;
  const error = nodo('p', 'error'); error.id = `${prefijo}-error`; error.hidden = true;
  error.setAttribute('role', 'alert');
  const composer = nodo('div', 'composer');
  const enviar = botonIcono('enviar', 'enviar', 'Enviar mensaje de prueba local'); enviar.type = 'submit';
  const cancelarSolicitud = boton('cancelar-solicitud', 'Cancelar solicitud'); cancelarSolicitud.hidden = true;
  const micro = botonIcono('micro', 'micro', 'Activar micrófono'); micro.disabled = typeof Reconocimiento !== 'function';
  micro.setAttribute('aria-pressed', 'false'); micro.setAttribute('aria-describedby', vozAviso.id);
  composer.append(texto, micro, cancelarSolicitud, enviar);
  formulario.append(etiqueta, limite, error, composer);
  const utilidades = nodo('div', 'utilidades');
  const borrar = botonIcono('borrar', 'borrar', 'Borrar conversación local');
  const leer = botonIcono('leer', 'altavoz', 'Leer bienvenida pública');
  leer.disabled = typeof sintesis?.speak !== 'function' || typeof sintesis?.cancel !== 'function' || typeof Locucion !== 'function';
  leer.setAttribute('aria-pressed', 'false');
  const ttsAviso = nodo('p', 'aviso', leer.disabled
    ? 'Lectura hablada no disponible. El texto sigue funcionando.'
    : 'Lectura opcional: solo la bienvenida pública, nunca tus mensajes.');
  const informacion = nodo('details', 'informacion');
  const detalles = nodo('div', 'detalles');
  const consentimiento = nodo('label', 'aviso'); consentimiento.hidden = true;
  const recordar = documento.createElement('input'); recordar.type = 'checkbox'; recordar.disabled = true;
  const consentimientoTexto = documento.createTextNode(' Recordar mi selección de búsqueda en esta pestaña durante la sesión');
  consentimiento.append(recordar, consentimientoTexto);
  detalles.append(consentimiento, aviso, vozAviso, ttsAviso);
  informacion.append(nodo('summary', 'resumen', 'Privacidad y voz'), detalles);
  utilidades.append(informacion, borrar);
  const pie = nodo('div', 'pie'); pie.append(utilidades, formulario);
  panel.append(cabecera, estado, mensajes, pie);
  raiz.append(abrir, panel); documento.body.append(raiz);

  function informar(mensaje) {
    if (viva && (!enviando || mensaje === 'Procesando solicitud…')) estado.textContent = mensaje;
  }
  function registrarTemporal(item, rol, limpiar = () => {}) {
    temporales.push({ item, rol, limpiar });
    if (temporales.length <= MAX_MENSAJES) return;
    const antiguo = temporales.shift(); antiguo.limpiar(); antiguo.item.remove();
    if (antiguo.rol === 'usuario') historial.shift();
  }
  function limpiarTemporales() {
    for (const entrada of temporales) { entrada.limpiar(); entrada.item.remove(); }
    temporales.length = 0; historial.length = 0;
  }
  function errorTexto(mensaje = '') {
    error.textContent = mensaje; error.hidden = !mensaje;
    texto.setAttribute('aria-invalid', String(!!mensaje));
    texto.setAttribute('aria-describedby', `${aviso.id} ${vozAviso.id} ${limite.id}${mensaje ? ' ' + error.id : ''}`);
    if (mensaje) informar('Mensaje no enviado · revisa el campo');
  }
  function agregarMensaje(rol, contenido, { bienvenida = false } = {}) {
    const cercaDelFinal = mensajes.scrollHeight - mensajes.scrollTop - mensajes.clientHeight < 48;
    const item = nodo('div', rol === 'usuario' ? 'mensaje-usuario' : 'mensaje-info');
    item.append(nodo('span', 'sr', rol === 'usuario'
      ? accionesEnvio.size ? 'Tú: ' : 'Tú · prueba local: '
      : 'Información del asistente: '), nodo('p', 'contenido', contenido));
    if (bienvenida) item.append(leer);
    mensajes.append(item);
    if (!bienvenida) registrarTemporal(item, rol);
    if (cercaDelFinal) mensajes.scrollTop = mensajes.scrollHeight;
    return item;
  }
  agregarMensaje('informacion', BIENVENIDA, { bienvenida: true });
  function estadoLectura(activa) {
    const etiqueta = activa ? 'Detener lectura de bienvenida' : 'Leer bienvenida pública';
    leer.setAttribute('aria-pressed', String(activa)); leer.setAttribute('aria-label', etiqueta); leer.title = etiqueta;
    leer.replaceChildren(icono(activa ? 'detener' : 'altavoz'));
  }
  function detenerLectura(anunciar = false) {
    const anterior = locucion; locucion = null; estadoLectura(false);
    if (anterior) { anterior.onend = null; anterior.onerror = null; try { sintesis.cancel(); } catch { /* El texto sigue disponible. */ } }
    if (anunciar && anterior) informar('Lectura detenida · integración pendiente');
  }
  function detenerVoz(anunciar = false) {
    const anterior = reconocimiento; reconocimiento = null; secuenciaVoz++;
    micro.replaceChildren(icono('micro')); micro.setAttribute('aria-label', 'Activar micrófono'); micro.title = 'Activar micrófono'; micro.setAttribute('aria-pressed', 'false');
    if (anterior) {
      registrarVoz('abort_solicitado');
      anterior.onstart = anterior.onresult = anterior.onerror = anterior.onend = null;
      try { anterior.abort(); } catch { /* No hay grabaciones propias que limpiar. */ }
    }
    if (anunciar) informar('Reconocimiento cancelado. Puedes escribir o volver a pulsar el micrófono.');
  }
  function cerrar({ devolverFoco = true } = {}) {
    if (!viva) return;
    abierta = false; detenerVoz(); detenerLectura(); panel.hidden = true; informacion.open = false;
    abrir.hidden = false; abrir.setAttribute('aria-expanded', 'false');
    informar(enviando ? 'Procesando solicitud…' : accionesEnvio.size ? 'Integración offline de prueba disponible' : LISTA);
    if (devolverFoco) abrir.focus({ preventScroll: true });
  }
  function abrirPanel() {
    if (!viva) return;
    abierta = true; panel.hidden = false; abrir.hidden = true; abrir.setAttribute('aria-expanded', 'true');
    texto.focus({ preventScroll: true }); actualizarGeometria();
    mensajes.scrollTop = mensajes.scrollHeight;
  }
  function enviarTexto(evento) {
    evento?.preventDefault();
    if (!viva || !abierta || enviando) return;
    const contenido = texto.value.trim();
    if (!contenido || texto.value.length > MAX_TEXTO) {
      errorTexto(contenido ? 'El mensaje admite como máximo 1000 caracteres.' : 'Escribe un mensaje antes de enviar.');
      texto.focus(); return;
    }
    enviando = true; enviar.disabled = true;
    try {
      detenerVoz(); errorTexto(); historial.push({ rol: 'usuario', texto: contenido });
      const item = agregarMensaje('usuario', contenido);
      if (accionesEnvio.size) {
        item.dataset.estado = 'pendiente'; cancelarSolicitud.hidden = false;
        informar('Procesando solicitud…');
        for (const accion of accionesEnvio) {
          try { Promise.resolve(accion(contenido)).catch(() => finalizarSolicitud('No se pudo completar la solicitud.')); }
          catch { finalizarSolicitud('No se pudo completar la solicitud.'); }
        }
      } else {
        item.dataset.estado = 'solo-local'; texto.value = ''; ajustarTexto(); informar(PENDIENTE);
        enviando = false; enviar.disabled = false;
      }
    } catch { finalizarSolicitud('No se pudo completar la solicitud.'); }
  }
  function finalizarSolicitud(mensaje, contenidoEnviado = null) {
    if (!viva) return;
    enviando = false; enviar.disabled = false; cancelarSolicitud.hidden = true;
    if (contenidoEnviado !== null && texto.value.trim() === contenidoEnviado) { texto.value = ''; ajustarTexto(); }
    informar(mensaje);
  }
  function presentarSalida(salida, aplicarBorrador) {
    if (!viva || !salida || typeof salida !== 'object') return false;
    if (salida.tipo === 'mensaje' && typeof salida.mensaje === 'string'
      && salida.mensaje.trim() && salida.mensaje.length <= 4000) {
      agregarMensaje('informacion', salida.mensaje); return true;
    }
    if (salida.tipo === 'resultado_titular' && salida.datos?.destino === 'titular'
      && Array.isArray(salida.datos.reservas) && salida.datos.reservas.length <= 24
      && salida.datos.reservas.every((r, i) => Object.hasOwn(salida.datos.reservas, i)
        && r && typeof r.id === 'string' && /^[0-9a-f-]{36}$/i.test(r.id)
        && ['pendiente', 'confirmada', 'cancelada', 'completada'].includes(r.estado))) {
      const resumen = salida.datos.reservas.length
        ? salida.datos.reservas.map(r => `Reserva ${r.id}: ${r.estado}`).join('\n')
        : 'No hay reservas propias registradas.';
      agregarMensaje('informacion', resumen); return true;
    }
    if (salida.tipo === 'borrador_revisable' && salida.datos?.tipo === 'borrador_publicacion'
      && salida.datos.requiereRevisionHumana === true) {
      const { titulo, descripcion } = salida.datos.borrador ?? {};
      if (typeof titulo !== 'string' || !titulo.trim() || Array.from(titulo).length > 100
        || typeof descripcion !== 'string' || !descripcion.trim() || Array.from(descripcion).length > 1000) return false;
      const item = nodo('div', 'mensaje-info');
      item.append(nodo('p', 'contenido', 'Borrador para revisión humana. No se ha publicado.'));
      const tituloEditable = nodo('input', 'borrador-titulo'); tituloEditable.value = titulo;
      tituloEditable.maxLength = 100; tituloEditable.setAttribute('aria-label', 'Título del borrador');
      const descripcionEditable = nodo('textarea', 'borrador-descripcion'); descripcionEditable.value = descripcion;
      descripcionEditable.maxLength = 1000; descripcionEditable.setAttribute('aria-label', 'Descripción del borrador');
      const usar = boton('borrador-usar', 'Usar borrador revisado');
      usar.disabled = typeof aplicarBorrador !== 'function';
      if (usar.disabled) usar.title = 'Integración con Publicar pendiente';
      let activo = true, pendiente = false, usado = false;
      const alUsar = async () => {
        if (!viva || !activo || pendiente || usado || !item.isConnected || typeof aplicarBorrador !== 'function') return;
        const borrador = { titulo: tituloEditable.value, descripcion: descripcionEditable.value };
        if (!borrador.titulo.trim() || borrador.titulo.length > 100
          || !borrador.descripcion.trim() || borrador.descripcion.length > 1000) {
          informar('Revisa el título y la descripción del borrador.'); return;
        }
        pendiente = true; usar.disabled = true;
        const vigente = () => viva && activo && item.isConnected
          && tituloEditable.value === borrador.titulo && descripcionEditable.value === borrador.descripcion;
        try {
          const aplicado = await aplicarBorrador(borrador, vigente);
          if (vigente()) {
            usado = aplicado === true;
            informar(usado ? 'Borrador trasladado para revisión en Publicar.'
              : 'No se pudo trasladar el borrador. Conservamos tus cambios.');
          }
        } catch { if (vigente()) informar('No se pudo trasladar el borrador. Conservamos tus cambios.'); }
        finally { pendiente = false; if (activo) usar.disabled = usado; }
      };
      usar.addEventListener('click', alUsar);
      item.append(tituloEditable, descripcionEditable, usar); mensajes.append(item);
      registrarTemporal(item, 'borrador', () => { activo = false; usar.disabled = true; usar.removeEventListener('click', alUsar); });
      return true;
    }
    return false;
  }
  function iniciarVoz() {
    if (!viva || !abierta || micro.disabled) return;
    if (reconocimiento) { detenerVoz(true); return; }
    detenerLectura();
    diagnosticoVoz.intentos++; diagnosticoVoz.eventos.length = 0;
    const turno = ++secuenciaVoz;
    let instancia;
    try { instancia = new Reconocimiento(); } catch { registrarVoz('error', 'constructor-fallido'); informar('No pudimos inicializar el reconocimiento del navegador. Puedes escribir.'); return; }
    reconocimiento = instancia;
    const actual = () => viva && abierta && reconocimiento === instancia && turno === secuenciaVoz;
    instancia.lang = 'es-PE'; instancia.continuous = false; instancia.interimResults = false;
    instancia.onstart = () => { if (actual()) { registrarVoz('start'); informar('Escuchando… pulsa Detener micrófono para cancelar.'); } };
    instancia.onresult = evento => {
      if (!actual()) return;
      registrarVoz('result');
      let transcripcion = '';
      for (let i = 0; i < (evento.results?.length ?? 0); i++) transcripcion += (evento.results[i]?.[0]?.transcript ?? '') + ' ';
      transcripcion = transcripcion.trim();
      if (!transcripcion) { detenerVoz(); informar('No se detectó voz. Puedes escribir o intentarlo de nuevo.'); return; }
      if (transcripcion.length > MAX_TEXTO) {
        detenerVoz(); informar('La transcripción supera 1000 caracteres. Conservamos tu texto anterior; prueba una frase más corta.'); return;
      }
      texto.value = transcripcion; errorTexto(); ajustarTexto(); detenerVoz();
      informar('Transcripción lista · revisa y envía cuando quieras'); texto.focus({ preventScroll: true });
    };
    instancia.onerror = evento => {
      if (!actual()) return;
      const codigo = Object.hasOwn(ERRORES_VOZ, evento.error) ? evento.error : 'desconocido';
      registrarVoz('error', codigo);
      detenerVoz(); informar(ERRORES_VOZ[codigo] ?? 'El navegador no pudo transcribir. Puedes seguir escribiendo.');
    };
    instancia.onend = () => { if (actual()) { registrarVoz('end'); detenerVoz(); informar('El navegador terminó sin transcripción. Puedes escribir o volver a intentarlo.'); } };
    micro.replaceChildren(icono('detener')); micro.setAttribute('aria-label', 'Detener micrófono'); micro.title = 'Detener micrófono'; micro.setAttribute('aria-pressed', 'true');
    informar('Activando reconocimiento… pulsa Detener micrófono para cancelar.');
    registrarVoz('start_solicitado');
    try { instancia.start(); } catch (fallo) {
      if (actual()) {
        const codigo = fallo?.name === 'NotAllowedError' ? 'not-allowed' : 'inicio-fallido';
        registrarVoz('error', codigo); detenerVoz();
        informar(ERRORES_VOZ[codigo] ?? 'No pudimos iniciar el reconocimiento del navegador. Puedes seguir escribiendo.');
      }
    }
  }
  function leerBienvenida() {
    if (!viva || !abierta || leer.disabled) return;
    detenerVoz(); detenerLectura();
    try {
      const nueva = new Locucion(BIENVENIDA); locucion = nueva; nueva.lang = 'es-PE';
      const voz = sintesis.getVoices?.().find(v => /^es(?:-|$)/i.test(v.lang));
      if (voz) nueva.voice = voz;
      nueva.onend = () => { if (viva && locucion === nueva) { locucion = null; estadoLectura(false); informar('Lectura finalizada · integración pendiente'); } };
      nueva.onerror = () => { if (viva && locucion === nueva) { detenerLectura(); informar('La lectura no está disponible. Puedes continuar con texto.'); } };
      estadoLectura(true); informar('Leyendo bienvenida pública'); sintesis.speak(nueva);
    } catch { detenerLectura(); informar('La lectura no está disponible. Puedes continuar con texto.'); }
  }
  function borrarHistorial() {
    if (!viva) return;
    for (const accion of accionesCancelacion) { try { accion(); } catch { /* Sin datos de dependencias. */ } }
    enviando = false; enviar.disabled = false; cancelarSolicitud.hidden = true;
    limpiarMemoria();
    detenerVoz(); detenerLectura(); limpiarTemporales(); mensajes.replaceChildren();
    agregarMensaje('informacion', BIENVENIDA, { bienvenida: true });
    informar(recordar.checked && !recordar.disabled
      ? 'Historial visible borrado. Comprobando el borrado del contexto guardado.'
      : 'Historial visible borrado. La memoria no está activa; no se confirmó borrado persistente.');
    if (abierta) texto.focus({ preventScroll: true });
  }
  // Puerto opcional D1.3A: recibir solo resúmenes deterministas del coordinador.
  // textContent protege el DOM; no clasifica texto libre como público/persistible.
  function limpiarMemoria() { mensajeMemoria?.remove(); mensajeMemoria = null; }
  function presentarMemoria({ estado: tipo, resumen = '' } = {}) {
    if (!viva) return false;
    const textos = {
      comprobando: 'Comprobando identidad y contexto permitido…',
      recordado: 'Contexto recordado: ', preparado: 'Contexto permitido preparado: ',
      conservado: 'Operación no completada. Contexto permitido en esta instancia: ',
      'sin-contexto': 'No hay contexto de búsqueda para recordar.',
      'sin-sesion': 'Sin sesión verificada: no se recupera memoria de una cuenta.',
      error: 'No se pudo recuperar o guardar el contexto. Puedes seguir escribiendo.',
      inactiva: 'Memoria no disponible: habilitación, configuración, productor o política pendientes. El chat sigue funcionando.',
      'sin-consentimiento': 'Memoria desactivada. Recordar contexto requiere tu consentimiento.',
      borrado: 'Historial visible y contexto guardado eliminados.',
      'error-borrado': 'Historial visible borrado. No se pudo confirmar la eliminación del contexto guardado.',
    };
    if (!Object.hasOwn(textos, tipo) || typeof resumen !== 'string' || resumen.length > 1000
      || (['recordado', 'preparado', 'conservado'].includes(tipo) && !resumen.trim())) return false;
    const cercaDelFinal = mensajes.scrollHeight - mensajes.scrollTop - mensajes.clientHeight < 48;
    limpiarMemoria(); mensajeMemoria = nodo('div', 'mensaje-info'); mensajeMemoria.dataset.memoria = tipo;
    mensajeMemoria.append(nodo('span', 'sr', 'Memoria de contexto; no es una respuesta de inteligencia artificial. '),
      nodo('p', 'contenido', textos[tipo] + (['recordado', 'preparado', 'conservado'].includes(tipo) ? resumen : '')));
    mensajes.append(mensajeMemoria);
    if (cercaDelFinal) mensajes.scrollTop = mensajes.scrollHeight;
    return true;
  }
  function limpiarPorIdentidad() {
    if (!viva) return;
    for (const accion of accionesCancelacion) { try { accion(); } catch { /* Sin datos de dependencias. */ } }
    recordar.checked = false;
    borrarHistorial(); texto.value = ''; errorTexto(); ajustarTexto(); cerrar({ devolverFoco: abierta });
  }
  function limpiarSesionAgente() {
    if (!viva) return;
    detenerVoz(); detenerLectura(); limpiarTemporales(); limpiarMemoria();
    mensajes.replaceChildren(); agregarMensaje('informacion', BIENVENIDA, { bienvenida: true });
    texto.value = ''; errorTexto(); ajustarTexto();
    enviando = false; enviar.disabled = false; cancelarSolicitud.hidden = true;
  }
  function notificarMemoria(accion) {
    for (const callback of accionesMemoria) {
      try { Promise.resolve(callback(accion)).catch(() => {}); } catch { /* No exponer errores del consumidor. */ }
    }
  }
  function actualizarGeometria() {
    if (!viva) return;
    const vista = ventana.visualViewport;
    const alto = vista?.height ?? ventana.innerHeight;
    const borde = alto + (vista?.offsetTop ?? 0);
    const nav = documento.querySelector('.home-bottom');
    const rect = nav?.getBoundingClientRect();
    const reserva = rect && ventana.getComputedStyle(nav).display !== 'none' && rect.bottom >= borde - 2 && rect.top < borde
      ? Math.min(rect.height, Math.max(0, borde - rect.top)) : 0;
    raiz.style.setProperty('--cl-agente-desplazamiento', `${Math.max(0, ventana.innerHeight - borde)}px`);
    raiz.style.setProperty('--cl-agente-nav', `${reserva}px`);
    raiz.style.setProperty('--cl-agente-alto', `${alto}px`);
  }
  function ajustarTexto() {
    texto.style.height = 'auto';
    texto.style.height = `${Math.min(88, Math.max(44, texto.scrollHeight))}px`;
  }
  function escuchar(destino, tipo, funcion) {
    destino.addEventListener(tipo, funcion); limpiezas.push(() => destino.removeEventListener(tipo, funcion));
  }
  const control = {
    raiz, abrir: abrirPanel, cerrar, borrarHistorial,
    finalizarSolicitud, presentarSalida,
    escucharEnvios(callback) {
      if (!viva || typeof callback !== 'function' || accionesEnvio.size) return () => {};
      accionesEnvio.add(callback);
      enviar.setAttribute('aria-label', 'Enviar mensaje al agente');
      etiqueta.textContent = 'Tu mensaje para el agente';
      mensajes.setAttribute('aria-label', 'Mensajes temporales del asistente');
      informar('Integración offline de prueba disponible');
      return () => {
        accionesEnvio.delete(callback);
        if (!accionesEnvio.size) {
          enviar.setAttribute('aria-label', 'Enviar mensaje de prueba local');
          etiqueta.textContent = 'Tu mensaje de prueba';
          mensajes.setAttribute('aria-label', 'Mensajes de prueba del asistente');
          informar(LISTA);
        }
      };
    },
    escucharCancelacion(callback) {
      if (!viva || typeof callback !== 'function') return () => {};
      accionesCancelacion.add(callback); return () => accionesCancelacion.delete(callback);
    },
    // Interfaz de memoria para D1.2: copia efímera, sin callbacks de guardado automático.
    // El futuro adaptador debe clasificar contexto permitido; no persistir este texto libre.
    obtenerHistorial: () => historial.map(item => ({ ...item })),
    presentarMemoria, limpiarMemoria, limpiarPorIdentidad, limpiarSesionAgente,
    prepararConsentimientoMemoria({ disponible = false, marcado = false } = {}) {
      consentimiento.hidden = false; recordar.checked = marcado; recordar.disabled = !disponible;
      recordar.setAttribute('aria-label', 'Recordar solo contexto permitido en este navegador');
      consentimientoTexto.textContent = disponible
        ? ' Recordar mi selección de búsqueda en esta pestaña durante la sesión'
        : ' Recordar contexto: pendiente de autorización y configuración';
    },
    escucharAccionesMemoria(callback) {
      if (!viva || typeof callback !== 'function') return () => {};
      accionesMemoria.add(callback); return () => accionesMemoria.delete(callback);
    },
    obtenerDiagnosticoVoz: () => ({
      apiDisponible: typeof Reconocimiento === 'function', botonHabilitado: viva && !micro.disabled,
      idiomaSolicitado: 'es-PE', intentos: diagnosticoVoz.intentos,
      eventos: diagnosticoVoz.eventos.map(item => ({ ...item })),
    }),
    desmontar() {
      if (!viva) return;
      const teniaFoco = raiz.contains(documento.activeElement);
      for (const accion of accionesCancelacion) { try { accion(); } catch { /* Sin datos de dependencias. */ } }
      notificarMemoria('desmontar'); accionesMemoria.clear(); accionesEnvio.clear(); accionesCancelacion.clear(); limpiarMemoria();
      cerrar({ devolverFoco: false }); viva = false;
      for (const limpiar of limpiezas) limpiar();
      limpiarTemporales(); diagnosticoVoz.eventos.length = 0; diagnosticoVoz.intentos = 0;
      texto.value = ''; mensajes.replaceChildren(); raiz.remove();
      if (montajes.get(documento) === control) montajes.delete(documento);
      if (teniaFoco) documento.body.focus({ preventScroll: true });
    },
  };

  /* Eventos: únicamente UI local; sin Auth, fetch, storage ni eventos IA históricos. */
  escuchar(abrir, 'click', () => abierta ? cerrar() : abrirPanel());
  escuchar(cerrarBoton, 'click', () => cerrar());
  escuchar(raiz, 'keydown', evento => { if (evento.key === 'Escape' && abierta) { evento.preventDefault(); cerrar(); } });
  escuchar(formulario, 'submit', enviarTexto);
  escuchar(cancelarSolicitud, 'click', () => {
    for (const accion of accionesCancelacion) { try { accion(); } catch { /* Sin datos de dependencias. */ } }
    finalizarSolicitud('Solicitud cancelada. Puedes revisar y reenviar tu texto.');
  });
  escuchar(texto, 'keydown', evento => {
    if (evento.key === 'Enter' && !evento.shiftKey && !evento.isComposing) enviarTexto(evento);
  });
  escuchar(texto, 'input', () => {
    errorTexto(); ajustarTexto();
    if (enviando) return;
    if (reconocimiento) detenerVoz(true);
    else if (!locucion) informar(texto.value.trim()
      ? accionesEnvio.size ? 'Escribiendo · revisa el mensaje antes de enviarlo' : 'Escribiendo · el mensaje será solo local'
      : accionesEnvio.size ? 'Integración offline de prueba disponible' : LISTA);
  });
  escuchar(micro, 'click', iniciarVoz); escuchar(leer, 'click', () => locucion ? detenerLectura(true) : leerBienvenida());
  escuchar(borrar, 'click', () => { borrarHistorial(); notificarMemoria('borrar'); });
  escuchar(recordar, 'change', () => notificarMemoria(recordar.checked ? 'consentir' : 'revocar'));
  escuchar(documento, 'visibilitychange', () => { if (documento.hidden) { detenerVoz(); detenerLectura(); } });
  escuchar(ventana, 'resize', actualizarGeometria);
  if (ventana.visualViewport) {
    escuchar(ventana.visualViewport, 'resize', actualizarGeometria);
    escuchar(ventana.visualViewport, 'scroll', actualizarGeometria);
  }
  if (typeof ventana.ResizeObserver === 'function') {
    const observer = new ventana.ResizeObserver(actualizarGeometria);
    const nav = documento.querySelector('.home-bottom'); if (nav) observer.observe(nav);
    limpiezas.push(() => observer.disconnect());
  }
  montajes.set(documento, control); actualizarGeometria(); return control;
}

export function desmontarAgente(documento = globalThis.document) { montajes.get(documento)?.desmontar(); }

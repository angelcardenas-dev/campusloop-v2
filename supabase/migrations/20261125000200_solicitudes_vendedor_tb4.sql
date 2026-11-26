-- TB4: solicitudes, revisi?n humana y notificaci?n durable.
BEGIN;
CREATE ROLE tb4_gestor_vendedores NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA tb4_ventas_privado;
REVOKE ALL ON SCHEMA tb4_ventas_privado FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public, tb4_ventas_privado, tb4_perfiles_privado TO tb4_gestor_vendedores;
GRANT EXECUTE ON FUNCTION tb4_perfiles_privado.actor_confirmado() TO tb4_gestor_vendedores;

CREATE TABLE tb4_ventas_privado.normas (
    version text PRIMARY KEY CHECK (char_length(version) BETWEEN 1 AND 80),
    vigente boolean NOT NULL DEFAULT false
);
CREATE TABLE tb4_ventas_privado.revisores (
    perfil_id uuid PRIMARY KEY REFERENCES public.perfiles(id) ON DELETE RESTRICT,
    habilitado boolean NOT NULL DEFAULT false
);
CREATE TABLE tb4_ventas_privado.solicitudes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitante_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
    clave_idempotencia uuid NOT NULL,
    tiene_experiencia boolean NOT NULL,
    campus_id_al_enviar uuid NOT NULL REFERENCES public.campus(id) ON DELETE RESTRICT,
    normas_version text NOT NULL REFERENCES tb4_ventas_privado.normas(version) ON DELETE RESTRICT,
    normas_aceptadas_en timestamptz NOT NULL,
    estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','rechazado')),
    enviada_en timestamptz NOT NULL,
    responder_antes_de timestamptz NOT NULL CHECK (responder_antes_de = enviada_en + interval '48 hours'),
    revisor_id uuid REFERENCES tb4_ventas_privado.revisores(perfil_id) ON DELETE RESTRICT,
    decidida_en timestamptz CHECK (decidida_en >= enviada_en),
    motivo_decision text CHECK (char_length(motivo_decision) BETWEEN 1 AND 1000 AND motivo_decision !~ '[[:cntrl:]<>]'),
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (solicitante_id, clave_idempotencia),
    UNIQUE (id, solicitante_id),
    CHECK (revisor_id IS DISTINCT FROM solicitante_id),
    CHECK ((estado = 'pendiente' AND revisor_id IS NULL AND decidida_en IS NULL AND motivo_decision IS NULL)
        OR (estado IN ('aprobado','rechazado') AND revisor_id IS NOT NULL AND decidida_en IS NOT NULL AND motivo_decision IS NOT NULL))
);
CREATE UNIQUE INDEX solicitudes_vendedor_pendiente ON tb4_ventas_privado.solicitudes(solicitante_id) WHERE estado='pendiente';
CREATE UNIQUE INDEX solicitudes_vendedor_aprobada ON tb4_ventas_privado.solicitudes(solicitante_id) WHERE estado='aprobado';
CREATE INDEX solicitudes_vendedor_cola ON tb4_ventas_privado.solicitudes(responder_antes_de,id) WHERE estado='pendiente';
CREATE TABLE tb4_ventas_privado.notificaciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_id uuid NOT NULL UNIQUE,
    destinatario_id uuid NOT NULL,
    tipo text NOT NULL CHECK (tipo IN ('aprobado','rechazado')),
    creada_en timestamptz NOT NULL,
    leida_en timestamptz CHECK (leida_en >= creada_en),
    FOREIGN KEY (solicitud_id,destinatario_id)
      REFERENCES tb4_ventas_privado.solicitudes(id,solicitante_id) ON DELETE RESTRICT
);

GRANT SELECT ON tb4_ventas_privado.normas, tb4_ventas_privado.revisores,
    tb4_ventas_privado.solicitudes,tb4_ventas_privado.notificaciones TO tb4_gestor_vendedores;
GRANT UPDATE (version) ON tb4_ventas_privado.normas TO tb4_gestor_vendedores;
GRANT UPDATE (perfil_id) ON tb4_ventas_privado.revisores TO tb4_gestor_vendedores;
GRANT INSERT ON tb4_ventas_privado.solicitudes,tb4_ventas_privado.notificaciones TO tb4_gestor_vendedores;
GRANT UPDATE (estado,revisor_id,decidida_en,motivo_decision,version) ON tb4_ventas_privado.solicitudes TO tb4_gestor_vendedores;
GRANT UPDATE (leida_en) ON tb4_ventas_privado.notificaciones TO tb4_gestor_vendedores;
-- Permisos de bloqueo sobre normas y revisores sin escritura efectiva.
ALTER TABLE tb4_ventas_privado.normas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tb4_ventas_privado.revisores ENABLE ROW LEVEL SECURITY;
CREATE POLICY normas_gestor_lectura ON tb4_ventas_privado.normas FOR SELECT TO tb4_gestor_vendedores USING (vigente);
CREATE POLICY normas_gestor_bloqueo ON tb4_ventas_privado.normas FOR UPDATE TO tb4_gestor_vendedores USING (vigente) WITH CHECK (false);
CREATE POLICY revisor_gestor_lectura ON tb4_ventas_privado.revisores FOR SELECT TO tb4_gestor_vendedores
  USING (perfil_id = (SELECT tb4_perfiles_privado.actor_confirmado()) AND habilitado);
CREATE POLICY revisor_gestor_bloqueo ON tb4_ventas_privado.revisores FOR UPDATE TO tb4_gestor_vendedores
  USING (perfil_id = (SELECT tb4_perfiles_privado.actor_confirmado()) AND habilitado) WITH CHECK (false);

GRANT SELECT (id,nombre_visible,campus_id,vendedor_activado,actualizado_en,version), UPDATE (vendedor_activado,actualizado_en,version)
    ON public.perfiles TO tb4_gestor_vendedores;
CREATE POLICY perfiles_gestor_vendedor_lectura ON public.perfiles FOR SELECT TO tb4_gestor_vendedores USING (true);
CREATE POLICY perfiles_gestor_vendedor_actualizacion ON public.perfiles FOR UPDATE TO tb4_gestor_vendedores
    USING (true) WITH CHECK (vendedor_activado AND nombre_visible IS NOT NULL AND campus_id IS NOT NULL);

CREATE FUNCTION tb4_ventas_privado.dto_solicitud(s tb4_ventas_privado.solicitudes)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = ''
AS $f$
    SELECT pg_catalog.jsonb_build_object('id',s.id,'tieneExperiencia',s.tiene_experiencia,
      'campusIdAlEnviar',s.campus_id_al_enviar,'normasVersion',s.normas_version,'estado',s.estado,
      'enviadaEn',s.enviada_en,'responderAntesDe',s.responder_antes_de,'decididaEn',s.decidida_en,
      'motivoDecision',s.motivo_decision,'version',s.version);
$f$;
REVOKE ALL ON FUNCTION tb4_ventas_privado.dto_solicitud(tb4_ventas_privado.solicitudes) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION tb4_ventas_privado.dto_solicitud(tb4_ventas_privado.solicitudes) TO tb4_gestor_vendedores;

CREATE FUNCTION public.enviar_solicitud_vendedor(p_clave_idempotencia uuid,p_tiene_experiencia boolean,
    p_acepta_normas boolean,p_normas_version text,p_actor_esperado uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $f$
DECLARE
    actor uuid := tb4_perfiles_privado.actor_confirmado();
    perfil record;
    s tb4_ventas_privado.solicitudes;
    instante timestamptz;
BEGIN
    IF actor IS NULL OR actor IS DISTINCT FROM p_actor_esperado THEN RAISE insufficient_privilege; END IF;
    IF p_clave_idempotencia IS NULL OR p_tiene_experiencia IS NULL OR p_acepta_normas IS NOT TRUE
       OR p_normas_version IS NULL OR char_length(p_normas_version) NOT BETWEEN 1 AND 80 THEN
        RAISE invalid_parameter_value;
    END IF;
    SELECT p.nombre_visible,p.campus_id,p.vendedor_activado INTO perfil
      FROM public.perfiles p WHERE p.id=actor FOR NO KEY UPDATE;
    IF NOT FOUND OR perfil.nombre_visible IS NULL OR perfil.campus_id IS NULL THEN RAISE invalid_parameter_value; END IF;
    SELECT * INTO s FROM tb4_ventas_privado.solicitudes
      WHERE solicitante_id=actor AND clave_idempotencia=p_clave_idempotencia;
    IF FOUND THEN
        IF s.tiene_experiencia IS DISTINCT FROM p_tiene_experiencia OR s.normas_version IS DISTINCT FROM p_normas_version THEN
          RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO';
        END IF;
        RETURN tb4_ventas_privado.dto_solicitud(s);
    END IF;
    IF perfil.vendedor_activado THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='YA_ACTIVADO'; END IF;
    IF EXISTS (SELECT FROM tb4_ventas_privado.solicitudes WHERE solicitante_id=actor AND estado='pendiente') THEN
      RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='SOLICITUD_PENDIENTE';
    END IF;
    PERFORM FROM tb4_ventas_privado.normas WHERE version=p_normas_version AND vigente FOR SHARE;
    IF NOT FOUND THEN RAISE invalid_parameter_value; END IF;
    instante := pg_catalog.clock_timestamp();
    INSERT INTO tb4_ventas_privado.solicitudes (solicitante_id,clave_idempotencia,tiene_experiencia,campus_id_al_enviar,
       normas_version,normas_aceptadas_en,enviada_en,responder_antes_de)
       VALUES (actor,p_clave_idempotencia,p_tiene_experiencia,perfil.campus_id,p_normas_version,instante,instante,instante+interval '48 hours')
       RETURNING * INTO s;
    RETURN tb4_ventas_privado.dto_solicitud(s);
END;
$f$;

CREATE FUNCTION public.consultar_mis_solicitudes(p_limite integer DEFAULT 20,p_antes_de timestamptz DEFAULT NULL,p_antes_id uuid DEFAULT NULL)
RETURNS SETOF jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $f$
DECLARE actor uuid := tb4_perfiles_privado.actor_confirmado();
BEGIN
    IF actor IS NULL THEN RAISE insufficient_privilege; END IF;
    IF p_limite IS NULL OR p_limite NOT BETWEEN 1 AND 50 OR (p_antes_de IS NULL) <> (p_antes_id IS NULL) THEN
      RAISE invalid_parameter_value;
    END IF;
    RETURN QUERY SELECT tb4_ventas_privado.dto_solicitud(s) FROM tb4_ventas_privado.solicitudes s
      WHERE s.solicitante_id=actor AND (p_antes_de IS NULL OR (s.enviada_en,s.id)<(p_antes_de,p_antes_id))
      ORDER BY s.enviada_en DESC,s.id DESC LIMIT p_limite;
END;
$f$;

CREATE FUNCTION public.consultar_estado_vendedor_tb4(p_actor_esperado uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $f$
DECLARE actor uuid := tb4_perfiles_privado.actor_confirmado(); activo boolean; ultimo text;
BEGIN
 IF actor IS NULL OR actor IS DISTINCT FROM p_actor_esperado THEN RAISE insufficient_privilege; END IF;
 SELECT vendedor_activado INTO activo FROM public.perfiles WHERE id=actor;
 IF NOT FOUND THEN RAISE insufficient_privilege; END IF;
 IF activo THEN RETURN pg_catalog.jsonb_build_object('actorId',actor,'estado','APROBADO'); END IF;
 SELECT estado INTO ultimo FROM tb4_ventas_privado.solicitudes WHERE solicitante_id=actor
   ORDER BY enviada_en DESC,id DESC LIMIT 1;
 IF ultimo='aprobado' THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO'; END IF;
 RETURN pg_catalog.jsonb_build_object('actorId',actor,'estado',
   CASE WHEN ultimo='pendiente' THEN 'PENDIENTE' WHEN ultimo='rechazado' THEN 'RECHAZADO' ELSE 'NO_SOLICITADO' END);
END;
$f$;

CREATE FUNCTION public.consultar_solicitudes_revision(p_limite integer DEFAULT 20,p_despues_de timestamptz DEFAULT NULL,p_despues_id uuid DEFAULT NULL)
RETURNS SETOF jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $f$
DECLARE actor uuid := tb4_perfiles_privado.actor_confirmado();
BEGIN
    IF actor IS NULL OR NOT EXISTS (SELECT FROM tb4_ventas_privado.revisores WHERE perfil_id=actor AND habilitado) THEN
      RAISE insufficient_privilege;
    END IF;
    IF p_limite IS NULL OR p_limite NOT BETWEEN 1 AND 50 OR (p_despues_de IS NULL) <> (p_despues_id IS NULL) THEN
      RAISE invalid_parameter_value;
    END IF;
    RETURN QUERY SELECT tb4_ventas_privado.dto_solicitud(s) FROM tb4_ventas_privado.solicitudes s
      WHERE s.estado='pendiente' AND s.solicitante_id<>actor
        AND (p_despues_de IS NULL OR (s.responder_antes_de,s.id)>(p_despues_de,p_despues_id))
      ORDER BY s.responder_antes_de,s.id LIMIT p_limite;
END;
$f$;

CREATE FUNCTION public.decidir_solicitud_vendedor(p_solicitud_id uuid,p_version_esperada integer,p_decision text,p_motivo text,p_actor_esperado uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $f$
DECLARE
    actor uuid := tb4_perfiles_privado.actor_confirmado();
    s tb4_ventas_privado.solicitudes;
    titular uuid;
    motivo text := pg_catalog.btrim(p_motivo);
    instante timestamptz;
BEGIN
    IF actor IS NULL OR actor IS DISTINCT FROM p_actor_esperado THEN RAISE insufficient_privilege; END IF;
    PERFORM FROM tb4_ventas_privado.revisores WHERE perfil_id=actor AND habilitado FOR SHARE;
    IF NOT FOUND THEN RAISE insufficient_privilege; END IF;
    IF p_version_esperada IS NULL OR p_version_esperada < 1 OR p_solicitud_id IS NULL OR p_decision IS NULL
      OR p_decision NOT IN ('aprobado','rechazado') OR motivo IS NULL OR char_length(motivo) NOT BETWEEN 1 AND 1000
      OR p_motivo ~ '[[:cntrl:]<>]' THEN RAISE invalid_parameter_value; END IF;
    SELECT solicitante_id INTO titular FROM tb4_ventas_privado.solicitudes WHERE id=p_solicitud_id;
    IF NOT FOUND OR titular=actor THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='NO_ENCONTRADO'; END IF;
    PERFORM FROM public.perfiles WHERE id=titular FOR NO KEY UPDATE;
    SELECT * INTO STRICT s FROM tb4_ventas_privado.solicitudes WHERE id=p_solicitud_id FOR UPDATE;
    IF s.estado<>'pendiente' OR s.version<>p_version_esperada THEN
      RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO';
    END IF;
    instante := pg_catalog.clock_timestamp();
    IF p_decision='aprobado' THEN
      UPDATE public.perfiles SET vendedor_activado=true,version=version+1,actualizado_en=GREATEST(actualizado_en,instante)
        WHERE id=titular AND NOT vendedor_activado;
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO'; END IF;
    END IF;
    UPDATE tb4_ventas_privado.solicitudes SET estado=p_decision,revisor_id=actor,decidida_en=instante,
       motivo_decision=motivo,version=version+1 WHERE id=p_solicitud_id RETURNING * INTO s;
    INSERT INTO tb4_ventas_privado.notificaciones(solicitud_id,destinatario_id,tipo,creada_en)
       VALUES (s.id,titular,p_decision,instante);
    RETURN tb4_ventas_privado.dto_solicitud(s);
END;
$f$;

CREATE FUNCTION public.consultar_mis_notificaciones(p_limite integer DEFAULT 20,p_solo_no_leidas boolean DEFAULT false,
    p_antes_de timestamptz DEFAULT NULL,p_antes_id uuid DEFAULT NULL)
RETURNS SETOF jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $f$
DECLARE actor uuid := tb4_perfiles_privado.actor_confirmado();
BEGIN
   IF actor IS NULL THEN RAISE insufficient_privilege; END IF;
   IF p_limite IS NULL OR p_limite NOT BETWEEN 1 AND 50 OR p_solo_no_leidas IS NULL
     OR (p_antes_de IS NULL) <> (p_antes_id IS NULL) THEN RAISE invalid_parameter_value; END IF;
   RETURN QUERY SELECT pg_catalog.jsonb_build_object('id',id,'solicitudId',solicitud_id,'tipo',tipo,
      'mensaje',CASE tipo WHEN 'aprobado' THEN 'Tu solicitud de vendedor fue aprobada.' ELSE 'Tu solicitud de vendedor fue rechazada.' END,
      'creadaEn',creada_en,'leidaEn',leida_en)
     FROM tb4_ventas_privado.notificaciones
     WHERE destinatario_id=actor AND (NOT p_solo_no_leidas OR leida_en IS NULL)
       AND (p_antes_de IS NULL OR (creada_en,id)<(p_antes_de,p_antes_id))
     ORDER BY creada_en DESC,id DESC LIMIT p_limite;
END;
$f$;

CREATE FUNCTION public.marcar_notificacion_leida(p_notificacion_id uuid,p_actor_esperado uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $f$
DECLARE actor uuid := tb4_perfiles_privado.actor_confirmado(); fecha timestamptz;
BEGIN
    IF actor IS NULL OR actor IS DISTINCT FROM p_actor_esperado THEN RAISE insufficient_privilege; END IF;
    UPDATE tb4_ventas_privado.notificaciones
      SET leida_en=coalesce(leida_en,pg_catalog.clock_timestamp())
      WHERE id=p_notificacion_id AND destinatario_id=actor RETURNING leida_en INTO fecha;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='NO_ENCONTRADO'; END IF;
    RETURN fecha;
END;
$f$;

GRANT tb4_gestor_vendedores TO CURRENT_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public TO tb4_gestor_vendedores;
DO $acl$
DECLARE firma regprocedure; permiso record;
BEGIN
  FOREACH firma IN ARRAY ARRAY[
     'public.enviar_solicitud_vendedor(uuid,boolean,boolean,text,uuid)'::regprocedure,
     'public.consultar_mis_solicitudes(integer,timestamptz,uuid)'::regprocedure,
     'public.consultar_estado_vendedor_tb4(uuid)'::regprocedure,
     'public.consultar_solicitudes_revision(integer,timestamptz,uuid)'::regprocedure,
     'public.decidir_solicitud_vendedor(uuid,integer,text,text,uuid)'::regprocedure,
     'public.consultar_mis_notificaciones(integer,boolean,timestamptz,uuid)'::regprocedure,
     'public.marcar_notificacion_leida(uuid,uuid)'::regprocedure]
  LOOP
     EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',firma);
     FOR permiso IN SELECT r.rolname FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
       JOIN pg_roles r ON r.oid=a.grantee WHERE p.oid=firma AND a.grantee<>p.proowner
     LOOP
       EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION %s FROM %I CASCADE',firma,permiso.rolname);
     END LOOP;
     EXECUTE pg_catalog.format('GRANT EXECUTE ON FUNCTION %s TO authenticated',firma);
     EXECUTE pg_catalog.format('ALTER FUNCTION %s OWNER TO tb4_gestor_vendedores',firma);
  END LOOP;
END;
$acl$;
REVOKE CREATE ON SCHEMA public FROM tb4_gestor_vendedores;
REVOKE tb4_gestor_vendedores FROM CURRENT_USER;
COMMIT;

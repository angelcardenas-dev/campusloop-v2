-- Mensajeria TB4: alta conversacion y envio bajo rol dedicado.
BEGIN;
ALTER TABLE public.mensajes ADD COLUMN posicion bigint;
WITH ordenadas AS (SELECT id, row_number() OVER (PARTITION BY conversacion_id ORDER BY creado_en,id) AS numero FROM public.mensajes)
UPDATE public.mensajes m SET posicion=o.numero FROM ordenadas o WHERE m.id=o.id;
ALTER TABLE public.mensajes ALTER COLUMN posicion SET NOT NULL;
ALTER TABLE public.mensajes ADD CONSTRAINT mensajes_posicion_positiva CHECK(posicion > 0);
ALTER TABLE public.mensajes ADD CONSTRAINT mensajes_conversacion_posicion_unique UNIQUE(conversacion_id,posicion);
CREATE ROLE tb4_escritor_mensajes NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public,tb4_perfiles_privado TO tb4_escritor_mensajes;
GRANT EXECUTE ON FUNCTION tb4_perfiles_privado.actor_confirmado() TO tb4_escritor_mensajes;

CREATE POLICY conversaciones_lectura_registrada ON public.conversaciones
 AS RESTRICTIVE FOR SELECT TO authenticated USING (
  (SELECT auth.uid()) IS NOT NULL AND ((SELECT auth.jwt()->'is_anonymous')='false'::jsonb) IS TRUE);
CREATE POLICY mensajes_lectura_registrada ON public.mensajes
 AS RESTRICTIVE FOR SELECT TO authenticated USING (
  (SELECT auth.uid()) IS NOT NULL AND ((SELECT auth.jwt()->'is_anonymous')='false'::jsonb) IS TRUE);

GRANT SELECT (id,vendedor_id,eliminado_en),UPDATE(id) ON public.articulos TO tb4_escritor_mensajes;
CREATE POLICY articulos_escritor_mensajes_lectura ON public.articulos FOR SELECT TO tb4_escritor_mensajes
 USING (eliminado_en IS NULL AND vendedor_id<>(SELECT tb4_perfiles_privado.actor_confirmado()));
CREATE POLICY articulos_escritor_mensajes_bloqueo ON public.articulos FOR UPDATE TO tb4_escritor_mensajes
 USING (eliminado_en IS NULL AND vendedor_id<>(SELECT tb4_perfiles_privado.actor_confirmado())) WITH CHECK (false);

GRANT SELECT (id,articulo_id,comprador_id,vendedor_id,creado_en),INSERT (articulo_id,comprador_id,vendedor_id),UPDATE(id)
 ON public.conversaciones TO tb4_escritor_mensajes;
CREATE POLICY conversaciones_escritor_lectura ON public.conversaciones FOR SELECT TO tb4_escritor_mensajes
 USING ((SELECT tb4_perfiles_privado.actor_confirmado()) IN (comprador_id,vendedor_id));
CREATE POLICY conversaciones_escritor_alta ON public.conversaciones FOR INSERT TO tb4_escritor_mensajes
 WITH CHECK (comprador_id=(SELECT tb4_perfiles_privado.actor_confirmado()) AND comprador_id<>vendedor_id);
CREATE POLICY conversaciones_escritor_bloqueo ON public.conversaciones FOR UPDATE TO tb4_escritor_mensajes
 USING ((SELECT tb4_perfiles_privado.actor_confirmado()) IN (comprador_id,vendedor_id)) WITH CHECK (false);

GRANT SELECT (id,conversacion_id,remitente_id,texto,creado_en,posicion),INSERT (id,conversacion_id,remitente_id,texto,posicion)
 ON public.mensajes TO tb4_escritor_mensajes;
GRANT SELECT (posicion) ON public.mensajes TO authenticated;
CREATE POLICY mensajes_escritor_lectura ON public.mensajes FOR SELECT TO tb4_escritor_mensajes
 USING (EXISTS(SELECT FROM public.conversaciones c WHERE c.id=conversacion_id));
CREATE POLICY mensajes_escritor_alta ON public.mensajes FOR INSERT TO tb4_escritor_mensajes
 WITH CHECK (remitente_id=(SELECT tb4_perfiles_privado.actor_confirmado())
   AND EXISTS(SELECT FROM public.conversaciones c WHERE c.id=conversacion_id));

CREATE FUNCTION public.iniciar_mi_conversacion(p_articulo_id uuid,p_actor_esperado uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE
 actor uuid := tb4_perfiles_privado.actor_confirmado();
 vendedor uuid;
 fila record;
BEGIN
 IF actor IS NULL OR actor IS DISTINCT FROM p_actor_esperado THEN RAISE insufficient_privilege; END IF;
 IF p_articulo_id IS NULL THEN RAISE invalid_parameter_value; END IF;
 SELECT id,articulo_id,comprador_id,vendedor_id,creado_en INTO fila
  FROM public.conversaciones WHERE articulo_id=p_articulo_id AND comprador_id=actor;
 IF NOT FOUND THEN
   SELECT vendedor_id INTO vendedor FROM public.articulos WHERE id=p_articulo_id FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='NO_ENCONTRADO'; END IF;
   INSERT INTO public.conversaciones(articulo_id,comprador_id,vendedor_id) VALUES(p_articulo_id,actor,vendedor)
     ON CONFLICT(articulo_id,comprador_id,vendedor_id) DO NOTHING
     RETURNING id,articulo_id,comprador_id,vendedor_id,creado_en INTO fila;
   IF NOT FOUND THEN
     SELECT id,articulo_id,comprador_id,vendedor_id,creado_en INTO STRICT fila
     FROM public.conversaciones WHERE articulo_id=p_articulo_id AND comprador_id=actor AND vendedor_id=vendedor;
   END IF;
 END IF;
 RETURN pg_catalog.jsonb_build_object('id',fila.id,'articuloId',fila.articulo_id,
   'compradorId',fila.comprador_id,'vendedorId',fila.vendedor_id,'creadoEn',fila.creado_en);
END;
$f$;

CREATE FUNCTION public.enviar_mi_mensaje(p_conversacion_id uuid,p_mensaje_id uuid,p_texto text,p_actor_esperado uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE
 actor uuid := tb4_perfiles_privado.actor_confirmado();
 contenido text := pg_catalog.regexp_replace(p_texto,'^[[:space:]]+|[[:space:]]+$','','g');
 fila record;
 siguiente bigint;
BEGIN
 IF actor IS NULL OR actor IS DISTINCT FROM p_actor_esperado THEN RAISE insufficient_privilege; END IF;
 IF p_conversacion_id IS NULL OR p_mensaje_id IS NULL OR contenido IS NULL
    OR char_length(contenido) NOT BETWEEN 1 AND 1000 THEN RAISE invalid_parameter_value; END IF;
 PERFORM FROM public.conversaciones WHERE id=p_conversacion_id FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='NO_ENCONTRADO';
 END IF;
 SELECT coalesce(max(posicion),0)+1 INTO siguiente FROM public.mensajes WHERE conversacion_id=p_conversacion_id;
 INSERT INTO public.mensajes(id,conversacion_id,remitente_id,texto,posicion)
   VALUES(p_mensaje_id,p_conversacion_id,actor,contenido,siguiente) ON CONFLICT(id) DO NOTHING
   RETURNING id,conversacion_id,remitente_id,texto,creado_en,posicion INTO fila;
 IF NOT FOUND THEN
   SELECT id,conversacion_id,remitente_id,texto,creado_en,posicion INTO fila FROM public.mensajes WHERE id=p_mensaje_id
       AND conversacion_id=p_conversacion_id AND remitente_id=actor AND texto=contenido;
   IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO'; END IF;
 END IF;
 RETURN pg_catalog.jsonb_build_object('id',fila.id,'conversacionId',fila.conversacion_id,
   'remitenteId',fila.remitente_id,'texto',fila.texto,'creadoEn',fila.creado_en,'posicion',fila.posicion);
END;
$f$;

GRANT tb4_escritor_mensajes TO CURRENT_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public TO tb4_escritor_mensajes;
DO $acl$
DECLARE firma regprocedure; permiso record;
BEGIN
 FOREACH firma IN ARRAY ARRAY['public.iniciar_mi_conversacion(uuid,uuid)'::regprocedure,
   'public.enviar_mi_mensaje(uuid,uuid,text,uuid)'::regprocedure]
 LOOP
   EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',firma);
   FOR permiso IN SELECT r.rolname FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
     JOIN pg_roles r ON r.oid=a.grantee WHERE p.oid=firma AND a.grantee<>p.proowner
   LOOP
     EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION %s FROM %I CASCADE',firma,permiso.rolname);
   END LOOP;
   EXECUTE pg_catalog.format('GRANT EXECUTE ON FUNCTION %s TO authenticated',firma);
   EXECUTE pg_catalog.format('ALTER FUNCTION %s OWNER TO tb4_escritor_mensajes',firma);
 END LOOP;
END;
$acl$;
REVOKE CREATE ON SCHEMA public FROM tb4_escritor_mensajes;
REVOKE tb4_escritor_mensajes FROM CURRENT_USER;
COMMIT;

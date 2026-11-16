-- SOLO PostgreSQL desechable. Requiere auth.users simulado y migraciones A aplicadas.
-- Nunca ejecutar en Supabase compartido. Todo dato de prueba termina en ROLLBACK.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
    u uuid := gen_random_uuid();
    c uuid := gen_random_uuid();
    k uuid := gen_random_uuid();
    vendedor uuid := gen_random_uuid();
    comprador uuid := gen_random_uuid();
    tercero uuid := gen_random_uuid();
    a uuid := gen_random_uuid();
    charla uuid := gen_random_uuid();
    r uuid := gen_random_uuid();
    n integer;
BEGIN
    SELECT count(*) INTO n FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    IF n <> 9 THEN RAISE EXCEPTION 'Se esperaban nueve tablas, hay %', n; END IF;

    INSERT INTO public.universidades(id,nombre,sigla) VALUES (u,'Universidad Sintética','SINT');
    INSERT INTO public.campus(id,universidad_id,nombre) VALUES(c,u,'Campus Sintético');
    INSERT INTO public.categorias(id,nombre) VALUES(k,'Categoría Sintética');
    INSERT INTO auth.users(id) VALUES(vendedor),(comprador),(tercero);
    INSERT INTO public.perfiles(id) VALUES(vendedor),(comprador),(tercero);
    IF EXISTS (SELECT FROM public.perfiles WHERE nombre_visible IS NOT NULL
        OR campus_id IS NOT NULL OR vendedor_activado OR version <> 1) THEN
        RAISE EXCEPTION 'Defaults de perfil mínimo incorrectos';
    END IF;
    INSERT INTO public.articulos(id,vendedor_id,titulo,descripcion,categoria_id,condicion,
        precio_centimos,campus_id,imagen_bucket,imagen_ruta,imagen_url,imagen_formato,
        imagen_bytes,imagen_ancho,imagen_alto)
    VALUES(a,vendedor,'Prueba','Descripción',k,'usado',3000000000,c,'articulos',
        vendedor::text || '/prueba.png','https://storage.invalid/prueba.png','image/png',100,1,1);
    INSERT INTO public.conversaciones(id,articulo_id,comprador_id,vendedor_id)
        VALUES(charla,a,comprador,vendedor);
    INSERT INTO public.reservas(id,articulo_id,comprador_id,vendedor_id,conversacion_id)
        VALUES(r,a,comprador,vendedor,charla);
    INSERT INTO public.lugares_publicos(nombre) VALUES('Lugar externo sintético');

    BEGIN
        INSERT INTO public.universidades(nombre,sigla) VALUES('universidad sintética','OTRA');
        RAISE EXCEPTION 'Aceptó nombre universitario duplicado';
    EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN
        INSERT INTO public.universidades(nombre,sigla) VALUES('Otra universidad','sint');
        RAISE EXCEPTION 'Aceptó sigla duplicada';
    EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN
        INSERT INTO public.campus(universidad_id,nombre) VALUES(u,'campus sintético');
        RAISE EXCEPTION 'Aceptó campus duplicado';
    EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN
        INSERT INTO public.categorias(nombre) VALUES('categoría sintética');
        RAISE EXCEPTION 'Aceptó categoría duplicada';
    EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN
        INSERT INTO public.perfiles(id) VALUES(gen_random_uuid());
        RAISE EXCEPTION 'Aceptó perfil sin Auth';
    EXCEPTION WHEN foreign_key_violation THEN NULL; END;
    BEGIN
        UPDATE public.articulos SET precio_centimos=0 WHERE id=a;
        RAISE EXCEPTION 'Aceptó precio cero';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
        UPDATE public.articulos SET precio_centimos=-1 WHERE id=a;
        RAISE EXCEPTION 'Aceptó precio negativo';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
        UPDATE public.articulos SET imagen_ruta=tercero::text || '/prueba.png' WHERE id=a;
        RAISE EXCEPTION 'Aceptó ruta de otro propietario';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
        INSERT INTO public.conversaciones(articulo_id,comprador_id,vendedor_id)
            VALUES(a,comprador,tercero);
        RAISE EXCEPTION 'Aceptó vendedor ajeno al artículo';
    EXCEPTION WHEN foreign_key_violation THEN NULL; END;
    BEGIN
        INSERT INTO public.reservas(articulo_id,comprador_id,vendedor_id,conversacion_id,estado)
            VALUES(a,tercero,vendedor,charla,'cancelada');
        RAISE EXCEPTION 'Aceptó conversación de otro comprador';
    EXCEPTION WHEN foreign_key_violation THEN NULL; END;
    BEGIN
        INSERT INTO public.reservas(articulo_id,comprador_id,vendedor_id)
            VALUES(a,tercero,vendedor);
        RAISE EXCEPTION 'Aceptó segunda reserva activa';
    EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN
        UPDATE public.reservas SET estado_punto='propuesto',punto_propuesto_por=comprador WHERE id=r;
        RAISE EXCEPTION 'Aceptó punto sin lugar';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
        UPDATE public.reservas SET estado_punto='propuesto',punto_propuesto_por=tercero,
            lugar_personalizado_nombre='Lugar sintético',lugar_referencia_publica='Entrada pública' WHERE id=r;
        RAISE EXCEPTION 'Aceptó proponente no participante';
    EXCEPTION WHEN check_violation THEN NULL; END;
    UPDATE public.reservas SET estado_punto='propuesto',punto_propuesto_por=comprador,
        lugar_personalizado_nombre='Lugar sintético',lugar_referencia_publica='Entrada pública' WHERE id=r;
    -- Solo comprueba que cancelada queda fuera del índice; no prueba RPC/liberación de artículo.
    UPDATE public.reservas SET estado='cancelada' WHERE id=r;
    INSERT INTO public.reservas(articulo_id,comprador_id,vendedor_id) VALUES(a,tercero,vendedor);
    UPDATE public.articulos SET eliminado_en=now() WHERE id=a;
    IF (SELECT count(*) FROM public.reservas WHERE articulo_id=a) <> 2 THEN
        RAISE EXCEPTION 'Se perdió historial';
    END IF;
    BEGIN
        DELETE FROM public.articulos WHERE id=a;
        RAISE EXCEPTION 'Aceptó borrar artículo con historial';
    EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN NULL; END;
    RAISE NOTICE 'Etapa A: nueve tablas, defaults, BIGINT, unicidad, FK, CHECK e índice parcial verificados';
END $$;
ROLLBACK;

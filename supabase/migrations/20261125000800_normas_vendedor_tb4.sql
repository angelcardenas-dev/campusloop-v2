BEGIN;
ALTER TABLE tb4_ventas_privado.normas ADD COLUMN contenido text;
INSERT INTO tb4_ventas_privado.normas(version,vigente,contenido)
VALUES ('1.0',true,$normas$
1. Publicar únicamente artículos de categorías autorizadas.
2. Proporcionar información veraz sobre precio, características, condición y disponibilidad.
3. Utilizar fotografías propias o autorizadas que representen correctamente el artículo.
4. No publicar productos robados, falsificados, ilegales o que infrinjan derechos de terceros.
5. Mantener una comunicación respetuosa.
6. Respetar reservas y acuerdos.
7. Mantener actualizada la disponibilidad y evitar comprometer un artículo con varios compradores.
8. Proteger la privacidad y coordinar encuentros preferentemente en lugares públicos y seguros.
9. Reconocer que CampusLoop no procesa pagos ni transferencias.
10. Emitir calificaciones honestas después de intercambios válidos.
$normas$);
CREATE UNIQUE INDEX normas_vigencia_unica ON tb4_ventas_privado.normas(vigente)
 WHERE vigente AND contenido IS NOT NULL;

CREATE FUNCTION public.consultar_normas_vendedor()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $f$
 SELECT pg_catalog.jsonb_build_object('version',version,'contenido',contenido)
 FROM tb4_ventas_privado.normas WHERE vigente AND contenido IS NOT NULL;
$f$;
REVOKE ALL ON FUNCTION public.consultar_normas_vendedor() FROM PUBLIC,anon,authenticated;
DO $acl$
BEGIN
 IF pg_catalog.to_regrole('service_role') IS NOT NULL THEN
   REVOKE ALL ON FUNCTION public.consultar_normas_vendedor() FROM service_role;
 END IF;
END;
$acl$;
GRANT EXECUTE ON FUNCTION public.consultar_normas_vendedor() TO authenticated;
GRANT tb4_gestor_vendedores TO CURRENT_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public TO tb4_gestor_vendedores;
ALTER FUNCTION public.consultar_normas_vendedor() OWNER TO tb4_gestor_vendedores;
REVOKE CREATE ON SCHEMA public FROM tb4_gestor_vendedores;
REVOKE tb4_gestor_vendedores FROM CURRENT_USER;
COMMIT;

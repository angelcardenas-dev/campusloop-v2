-- Etapa B / componente A. Solo revisión y PostgreSQL desechable.
-- No ejecutar en Supabase compartido sin autorización independiente.
BEGIN;

CREATE FUNCTION public.crear_perfil_minimo_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- No copiar raw_user_meta_data: identidad y privilegios no vienen del cliente.
    INSERT INTO public.perfiles (id) VALUES (NEW.id);
    -- No ocultar errores: Auth y perfil deben crearse en la misma transacción.
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_perfil_minimo_auth() FROM PUBLIC;

CREATE TRIGGER crear_perfil_minimo_tras_registro
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.crear_perfil_minimo_auth();

COMMIT;

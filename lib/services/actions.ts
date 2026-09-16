"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyBusinessAsAdmin } from "@/lib/businesses/queries";
import { MEDIA_BUCKET, isOwnMediaPath } from "@/lib/storage/media";
import { emptyToUndefined, type FormState } from "@/lib/forms";

const serviceSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(80, "Máximo 80"),
  description: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(500, "Máximo 500 caracteres").optional(),
  ),
  duration_minutes: z.coerce
    .number()
    .int("Debe ser un número entero")
    .min(5, "Mínimo 5 minutos")
    .max(1440, "Máximo 1440 minutos (24 h)"),
  price: z.coerce
    .number()
    .min(0, "No puede ser negativo")
    .max(99_999_999, "Precio demasiado alto"),
  buffer_minutes: z.coerce
    .number()
    .int("Debe ser un número entero")
    .min(0, "No puede ser negativo")
    .max(240, "Máximo 240 minutos"),
  image_path: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(300).optional(),
  ),
  color: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "Color hex, ej. #1e90ff")
      .optional(),
  ),
});

function parse(formData: FormData) {
  return serviceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    duration_minutes: formData.get("duration_minutes"),
    price: formData.get("price"),
    buffer_minutes: formData.get("buffer_minutes"),
    color: formData.get("color"),
    image_path: formData.get("image_path"),
  });
}

export async function createService(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await getMyBusinessAsAdmin();
  if (!business) return { error: "No autorizado." };

  const parsed = parse(formData);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const d = parsed.data;

  const imagen = d.image_path ?? null;
  if (imagen && !isOwnMediaPath(imagen, business.id, "services")) {
    return { error: "Imagen no válida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("services").insert({
    business_id: business.id,
    name: d.name,
    description: d.description ?? null,
    duration_minutes: d.duration_minutes,
    price: d.price,
    buffer_minutes: d.buffer_minutes,
    color: d.color ?? null,
    image_path: imagen,
  });
  if (error) return { error: "No se pudo crear el servicio." };

  revalidatePath("/dashboard/servicios");
  redirect("/dashboard/servicios");
}

export async function updateService(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await getMyBusinessAsAdmin();
  if (!business) return { error: "No autorizado." };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Servicio no encontrado." };

  const parsed = parse(formData);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const d = parsed.data;

  // La ruta llega en un input oculto: entrada del usuario. Sin comprobarla, se
  // podría apuntar (y hacer borrar) un fichero de otro negocio.
  const imagen = d.image_path ?? null;
  if (imagen && !isOwnMediaPath(imagen, business.id, "services")) {
    return { error: "Imagen no válida." };
  }

  const supabase = await createClient();
  const { data: previo } = await supabase
    .from("services")
    .select("image_path")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  const { error } = await supabase
    .from("services")
    .update({
      name: d.name,
      description: d.description ?? null,
      duration_minutes: d.duration_minutes,
      price: d.price,
      buffer_minutes: d.buffer_minutes,
      color: d.color ?? null,
      image_path: imagen,
    })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) return { error: "No se pudieron guardar los cambios." };

  // Después del UPDATE y sólo si fue bien: al revés dejaría el servicio
  // apuntando a un fichero ya borrado.
  if (previo?.image_path && previo.image_path !== imagen) {
    const viejo = previo.image_path;
    after(async () => {
      await createAdminClient().storage.from(MEDIA_BUCKET).remove([viejo]);
    });
  }

  revalidatePath("/dashboard/servicios");
  redirect("/dashboard/servicios");
}

export async function setServiceActive(
  id: string,
  active: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const business = await getMyBusinessAsAdmin();
  if (!business) return { ok: false, error: "No autorizado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ active })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) return { ok: false, error: "No se pudo actualizar." };

  revalidatePath("/dashboard/servicios");
  return { ok: true };
}

export async function deleteService(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const business = await getMyBusinessAsAdmin();
  if (!business) return { ok: false, error: "No autorizado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", id)
    .eq("business_id", business.id);

  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        error: "Tiene citas asociadas. Desactívalo en lugar de eliminarlo.",
      };
    }
    return { ok: false, error: "No se pudo eliminar." };
  }

  revalidatePath("/dashboard/servicios");
  return { ok: true };
}

/** Estado común de formularios manejados con `useActionState`. */
export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
};

/** Para `z.preprocess`: convierte "" (y espacios) en `undefined`. */
export const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

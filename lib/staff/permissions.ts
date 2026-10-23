/**
 * Permisos de un profesional sobre el panel. Viven como columnas de
 * `staff_members` (migración 20261023120000), donde la RLS los aplica; esto
 * es su forma en TypeScript, las plantillas rápidas y los textos.
 *
 * Archivo sin "server-only": lo usan también la tarjeta de permisos y el menú.
 */

export type BookingScope = "none" | "own" | "any";
export type CustomersScope = "none" | "own" | "all";

export type StaffPermissions = {
  viewAllAppointments: boolean;
  bookingScope: BookingScope;
  manageAllAppointments: boolean;
  customersScope: CustomersScope;
  editCustomers: boolean;
  seeCustomerContact: boolean;
};

/** Lo que tiene un profesional recién creado: lo de siempre, sólo su agenda. */
export const DEFAULT_PERMISSIONS: StaffPermissions = {
  viewAllAppointments: false,
  bookingScope: "none",
  manageAllAppointments: false,
  customersScope: "none",
  editCustomers: false,
  seeCustomerContact: true,
};

/** El admin del negocio: todo. */
export const FULL_PERMISSIONS: StaffPermissions = {
  viewAllAppointments: true,
  bookingScope: "any",
  manageAllAppointments: true,
  customersScope: "all",
  editCustomers: true,
  seeCustomerContact: true,
};

export const PRESETS: {
  id: string;
  label: string;
  description: string;
  permissions: StaffPermissions;
}[] = [
  {
    id: "basico",
    label: "Básico",
    description: "Solo ve y gestiona sus propias citas.",
    permissions: DEFAULT_PERMISSIONS,
  },
  {
    id: "profesional",
    label: "Profesional",
    description: "Agenda sus propias citas y lleva la ficha de sus clientes.",
    permissions: {
      viewAllAppointments: false,
      bookingScope: "own",
      manageAllAppointments: false,
      customersScope: "own",
      editCustomers: true,
      seeCustomerContact: true,
    },
  },
  {
    id: "recepcion",
    label: "Recepción",
    description: "Lleva la agenda de todo el equipo y todos los clientes.",
    permissions: FULL_PERMISSIONS,
  },
];

export function samePermissions(a: StaffPermissions, b: StaffPermissions): boolean {
  return (
    a.viewAllAppointments === b.viewAllAppointments &&
    a.bookingScope === b.bookingScope &&
    a.manageAllAppointments === b.manageAllAppointments &&
    a.customersScope === b.customersScope &&
    a.editCustomers === b.editCustomers &&
    a.seeCustomerContact === b.seeCustomerContact
  );
}

export function presetOf(p: StaffPermissions) {
  return PRESETS.find((x) => samePermissions(x.permissions, p)) ?? null;
}

/**
 * Las dependencias entre permisos, iguales a los CHECK de la base: gestionar
 * citas ajenas exige verlas y editar clientes exige poder abrirlos.
 */
export function normalizePermissions(p: StaffPermissions): StaffPermissions {
  return {
    ...p,
    manageAllAppointments: p.viewAllAppointments && p.manageAllAppointments,
    editCustomers: p.customersScope !== "none" && p.editCustomers,
  };
}

type StaffPermissionColumns = {
  can_view_all_appointments: boolean;
  booking_scope: string;
  can_manage_all_appointments: boolean;
  customers_scope: string;
  can_edit_customers: boolean;
  can_see_customer_contact: boolean;
};

const BOOKING: readonly string[] = ["none", "own", "any"];
const CUSTOMERS: readonly string[] = ["none", "own", "all"];

export function permissionsFromRow(row: StaffPermissionColumns): StaffPermissions {
  return {
    viewAllAppointments: row.can_view_all_appointments,
    bookingScope: (BOOKING.includes(row.booking_scope) ? row.booking_scope : "none") as BookingScope,
    manageAllAppointments: row.can_manage_all_appointments,
    customersScope: (CUSTOMERS.includes(row.customers_scope)
      ? row.customers_scope
      : "none") as CustomersScope,
    editCustomers: row.can_edit_customers,
    seeCustomerContact: row.can_see_customer_contact,
  };
}

export function permissionsToRow(p: StaffPermissions): StaffPermissionColumns {
  return {
    can_view_all_appointments: p.viewAllAppointments,
    booking_scope: p.bookingScope,
    can_manage_all_appointments: p.manageAllAppointments,
    customers_scope: p.customersScope,
    can_edit_customers: p.editCustomers,
    can_see_customer_contact: p.seeCustomerContact,
  };
}

/** Resumen corto para la lista de Staff ("Ve toda la agenda · Clientes"). */
export function permissionsSummary(p: StaffPermissions): string {
  const preset = presetOf(p);
  if (preset) return preset.label;
  const parts: string[] = [];
  if (p.viewAllAppointments) parts.push("Ve toda la agenda");
  if (p.bookingScope === "any") parts.push("Agenda a todos");
  else if (p.bookingScope === "own") parts.push("Agenda sus citas");
  if (p.customersScope === "all") parts.push("Todos los clientes");
  else if (p.customersScope === "own") parts.push("Sus clientes");
  if (!p.seeCustomerContact) parts.push("Sin contacto");
  return parts.length ? parts.join(" · ") : "Solo sus citas";
}

/** Oculta un teléfono dejando los 4 últimos dígitos. */
export function maskedPhone(last4: string | null): string | null {
  return last4 ? `•••• ${last4}` : null;
}

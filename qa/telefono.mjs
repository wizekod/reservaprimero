/**
 * Largo del teléfono según el país del negocio.
 *
 * No se fija en 10 dígitos: México y Argentina usan 10, España y Chile 9,
 * Uruguay y Panamá 8. Se valida contra el prefijo del negocio, o un negocio
 * español no podría dar de alta a sus clientes.
 */
import { expectedPhoneDigits, phoneLengthError, phoneKey } from "../lib/customers/phone.ts";
import { ok, section, summary } from "./lib.mjs";

section("1. dígitos esperados por país");
for (const [dial, esperado] of [["52", 10], ["34", 9], ["56", 9], ["598", 8]]) {
  ok(expectedPhoneDigits(dial) === esperado, `+${dial} → ${esperado} dígitos`);
}
ok(expectedPhoneDigits("999") === null, "un prefijo desconocido no impone largo");
ok(expectedPhoneDigits(null) === null, "sin prefijo tampoco");

section("2. México: 10 dígitos");
ok(phoneLengthError("3319101168", "52") === null, "10 dígitos vale");
ok(phoneLengthError("331 910 11 68", "52") === null, "con espacios también");
ok(phoneLengthError("+52 331 910 1168", "52") === null,
  "en forma internacional se mide la parte nacional");
ok(phoneLengthError("0052 3319101168", "52") === null, "y con 00 delante");

const corto = phoneLengthError("33191011", "52");
ok(corto === "El teléfono debe tener 10 dígitos.", `8 dígitos avisa: "${corto}"`);
const largo = phoneLengthError("33191011689", "52");
ok(largo === "El teléfono debe tener 10 dígitos.", `11 dígitos avisa: "${largo}"`);

section("3. España: 9 dígitos");
ok(phoneLengthError("600112233", "34") === null, "9 dígitos vale en España");
ok(phoneLengthError("+34600112233", "34") === null, "y su forma internacional");
ok(phoneLengthError("6001122334", "34") === "El teléfono debe tener 9 dígitos.",
  "10 dígitos NO vale en España");

section("4. lo ilegible se rechaza antes de medir");
for (const malo of ["", "   ", "abc", "12"]) {
  ok(phoneLengthError(malo, "52") === "Teléfono no válido.", `rechaza "${malo}"`);
}

section("5. la clave sigue siendo E.164");
ok(phoneKey("331 910 11 68", "52") === "+523319101168", "nacional → E.164");
ok(phoneKey("600112233", "34") === "+34600112233", "y en España");

summary();

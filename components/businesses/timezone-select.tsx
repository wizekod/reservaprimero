import { TIMEZONES } from "@/lib/businesses/constants";
import { cn } from "@/lib/utils";

export function TimezoneSelect({
  defaultValue,
  id = "timezone",
  name = "timezone",
}: {
  defaultValue?: string;
  id?: string;
  name?: string;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue ?? "America/Santiago"}
      className={cn(
        "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
      )}
    >
      {TIMEZONES.map((tz) => (
        <option key={tz.value} value={tz.value}>
          {tz.label}
        </option>
      ))}
    </select>
  );
}

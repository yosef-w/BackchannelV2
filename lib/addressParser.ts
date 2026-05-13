// Parse Places API (New) addressComponents into the 5 fields used by our
// profile address form. Returns empty strings for any component the result is
// missing, so the caller can safely spread the result into setState.
//
// Note: the new API uses camelCase fields (longText/shortText) where the legacy
// API used snake_case (long_name/short_name). This file targets the new shape.

export type ParsedAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

export type AddressComponent = {
  longText: string;
  shortText: string;
  types: string[];
};

const find = (
  components: AddressComponent[],
  type: string,
  field: "longText" | "shortText" = "longText",
): string => components.find((c) => c.types.includes(type))?.[field] ?? "";

export function parseAddressComponents(
  components: AddressComponent[] | undefined,
): ParsedAddress {
  if (!components) {
    return { street: "", city: "", state: "", zip: "", country: "" };
  }

  const streetNumber = find(components, "street_number");
  const route = find(components, "route");
  const street = [streetNumber, route].filter(Boolean).join(" ");

  // Some places (e.g. NYC boroughs) populate sublocality instead of locality.
  const city =
    find(components, "locality") ||
    find(components, "sublocality") ||
    find(components, "postal_town");

  return {
    street,
    city,
    state: find(components, "administrative_area_level_1"),
    zip: find(components, "postal_code"),
    country: find(components, "country"),
  };
}

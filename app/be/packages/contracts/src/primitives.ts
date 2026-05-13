import {
  Kind,
  Type,
  TypeRegistry,
  type SchemaOptions,
  type Static,
} from "@sinclair/typebox";

// Register once: a string with a closed `enum` set. We use a custom Kind
// instead of `Type.Union([Type.Literal(...)])` so OpenAPI emits
// `{ type: "string", enum: [...] }` (Swagger UI renders this as a real
// dropdown). Type.Unsafe alone would work for OpenAPI but TypeBox' runtime
// check would reject the schema as "Unknown type".
if (!TypeRegistry.Has("StringEnum")) {
  TypeRegistry.Set(
    "StringEnum",
    (schema: { enum?: readonly unknown[] }, value: unknown) =>
      typeof value === "string" &&
      Array.isArray(schema.enum) &&
      schema.enum.includes(value),
  );
}

export function StringEnum<T extends readonly string[]>(
  values: T,
  opts: SchemaOptions = {},
) {
  return Type.Unsafe<T[number]>({
    [Kind]: "StringEnum",
    type: "string",
    enum: [...values],
    ...opts,
  });
}

export const NodeId = Type.String({
  pattern: "^[a-z0-9-]{3,64}$",
  description: "Stable node identifier, lowercase alphanumeric and dashes",
});
export type NodeId = Static<typeof NodeId>;

export const Company = Type.String({ minLength: 1, maxLength: 128 });
export type Company = Static<typeof Company>;

export const Severity = StringEnum(["low", "medium", "high", "critical"] as const);
export type Severity = Static<typeof Severity>;

export const TLP = StringEnum(["RED", "AMBER", "GREEN", "WHITE"] as const);
export type TLP = Static<typeof TLP>;

export const IsoTimestamp = Type.String({
  format: "date-time",
  description: "ISO 8601 UTC timestamp",
});
export type IsoTimestamp = Static<typeof IsoTimestamp>;

export const Uuid = Type.String({ format: "uuid" });
export type Uuid = Static<typeof Uuid>;

export const Ed25519PublicKey = Type.String({
  pattern: "^[A-Za-z0-9+/]+=*$",
  description: "Base64-encoded raw Ed25519 public key (32 bytes)",
});
export type Ed25519PublicKey = Static<typeof Ed25519PublicKey>;

export const Ed25519Signature = Type.String({
  pattern: "^[A-Za-z0-9+/]+=*$",
  description: "Base64-encoded Ed25519 signature (64 bytes)",
});
export type Ed25519Signature = Static<typeof Ed25519Signature>;

export const EventSource = StringEnum(["manual", "siem", "syslog", "scanner", "scada", "mqtt", "custom"] as const);
export type EventSource = Static<typeof EventSource>;

export const IndicatorType = StringEnum(["ip", "domain", "hash", "url", "ttp", "email"] as const);
export type IndicatorType = Static<typeof IndicatorType>;

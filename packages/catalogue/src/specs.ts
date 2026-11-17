/**
 * Every product's `specs` JSON has exactly these keys, with null where a key
 * does not apply (a monitor has no ramGb). Filters and the assistant's reasons
 * read from here, so a key must never be missing or renamed.
 */
export interface ProductSpecs {
  processor: string | null;
  ramGb: number | null;
  storageGb: number | null;
  storageType: string | null;
  /** Display summary, for example "14-inch 2.2K". */
  screen: string | null;
  screenIn: number | null;
  resolution: string | null;
  refreshHz: number | null;
  gpu: string | null;
  batteryHrs: number | null;
  weightKg: number | null;
  os: string | null;
  ports: string | null;
}

export const SPEC_KEYS = [
  "processor",
  "ramGb",
  "storageGb",
  "storageType",
  "screen",
  "screenIn",
  "resolution",
  "refreshHz",
  "gpu",
  "batteryHrs",
  "weightKg",
  "os",
  "ports",
] as const satisfies readonly (keyof ProductSpecs)[];

const EMPTY_SPECS: ProductSpecs = {
  processor: null,
  ramGb: null,
  storageGb: null,
  storageType: null,
  screen: null,
  screenIn: null,
  resolution: null,
  refreshHz: null,
  gpu: null,
  batteryHrs: null,
  weightKg: null,
  os: null,
  ports: null,
};

/** Build a complete specs object: keys that are not given become null. */
export function makeSpecs(values: Partial<ProductSpecs>): ProductSpecs {
  return { ...EMPTY_SPECS, ...values };
}

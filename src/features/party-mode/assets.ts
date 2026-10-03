export const PARTY_RESULT_TITLES = {
  perfect: "PERFECT!!",
  great: "GREAT!",
  nice: "NICE",
  ok: "OK",
} as const;

export type PartyResultAssetUrls = Partial<Record<keyof typeof PARTY_RESULT_TITLES, string>>;

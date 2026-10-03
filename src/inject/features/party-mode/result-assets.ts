import { PARTY_RESULT_TITLES, type PartyResultAssetUrls } from "@/constants/party-mode";

let images: Record<string, HTMLImageElement> = {};

/** Decode only while ON. Replacing the cache also invalidates pending decodes. */
export const prepareResultAssets = (urls: PartyResultAssetUrls = {}) => {
  const cache: typeof images = {};
  images = cache;
  for (const key of Object.keys(PARTY_RESULT_TITLES) as (keyof typeof PARTY_RESULT_TITLES)[]) {
    const url = urls[key];
    if (typeof url !== "string") continue;
    const image = new Image();
    image.alt = PARTY_RESULT_TITLES[key];
    image.src = url;
    void image.decode().then(() => {
      if (images === cache) cache[image.alt] = image;
    }).catch(() => {}); // Missing/invalid assets keep the outlined text fallback.
  }
};

export const getResultAsset = (title: string) => images[title];
export const clearResultAssets = () => { images = {}; };

// art-cruise 起動中は tile png fetch を overlay 合成系から外し、生タイルを取得する。
// ゲームロジックとは独立した window.fetch への副作用のみを扱う。

import {
  setOriginalBlob,
  setOriginalLastModified,
} from "@/inject/features/tile-draw";

const TILE_URL_REGEX = /\/tiles?\/(\d+)\/(\d+)\.png(?:[?#].*)?$/;

const getFetchUrl = (requestInfo: RequestInfo | URL): string =>
  typeof requestInfo === "string"
    ? requestInfo
    : requestInfo instanceof Request
      ? requestInfo.url
      : requestInfo.toString();

const cacheOriginalTile = (tileX: string, tileY: string, response: Response) => {
  if (!response.ok) return;

  const cacheKey = `${tileX},${tileY}`;
  const lastModified = response.headers.get("last-modified");
  void response
    .clone()
    .blob()
    .then((blob) => {
      setOriginalBlob(cacheKey, blob);
      setOriginalLastModified(cacheKey, lastModified);
    })
    .catch((error) => {
      console.warn("🧑‍🎨 : Art cruise tile cache bypass failed", error);
    });
};

/**
 * tile png リクエストを未加工 fetch に迂回させる。
 * @returns 元の fetch に戻す restore 関数
 */
export const installTileFetchBypass = (): (() => void) => {
  const currentFetch = window.fetch;
  const rawFetch = window.mrWplaceOriginalFetch ?? currentFetch;
  const artCruiseFetch = ((
    ...args: Parameters<typeof fetch>
  ): Promise<Response> => {
    const tileMatch = getFetchUrl(args[0]).match(TILE_URL_REGEX);
    if (tileMatch) {
      return rawFetch.apply(window, args).then((response) => {
        cacheOriginalTile(tileMatch[1], tileMatch[2], response);
        return response;
      });
    }
    return currentFetch.apply(window, args);
  }) as typeof fetch;

  window.fetch = artCruiseFetch;
  return () => {
    if (window.fetch === artCruiseFetch) window.fetch = currentFetch;
  };
};

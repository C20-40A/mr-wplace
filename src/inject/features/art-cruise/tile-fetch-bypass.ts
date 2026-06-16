// art-cruise 起動中は tile png fetch を overlay 合成系から外し、生タイルを取得する。
// ゲームロジックとは独立した window.fetch への副作用のみを扱う。

const TILE_URL_REGEX = /\/tiles?\/(\d+)\/(\d+)\.png(?:[?#].*)?$/;

const getFetchUrl = (requestInfo: RequestInfo | URL): string =>
  typeof requestInfo === "string"
    ? requestInfo
    : requestInfo instanceof Request
      ? requestInfo.url
      : requestInfo.toString();

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
    if (TILE_URL_REGEX.test(getFetchUrl(args[0])))
      return rawFetch.apply(window, args);
    return currentFetch.apply(window, args);
  }) as typeof fetch;

  window.fetch = artCruiseFetch;
  return () => {
    if (window.fetch === artCruiseFetch) window.fetch = currentFetch;
  };
};

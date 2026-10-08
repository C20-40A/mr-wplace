const API = "https://backend.wplace.live/favorite-location";

const post = async (url: string, body: unknown) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(`${res.status} ${json?.error ?? ""}`);
  return json;
};

/**
 * 公式お気に入りを作成し、名前を反映する (cookie 認証のため page context で実行)
 * 作成 API は名前を受け取らないので、作成後に update で名前を上書きする
 */
export const handleCreateOfficialFavorite = async (data: {
  requestId: string;
  lat: number;
  lng: number;
  zoom: number;
  name?: string;
}): Promise<void> => {
  const respond = (payload: Record<string, unknown>) =>
    window.postMessage(
      { source: "mr-wplace-response-create-official-favorite", requestId: data.requestId, ...payload },
      "*",
    );

  try {
    const { success: _, ...created } = await post(API, {
      latitude: data.lat,
      longitude: data.lng,
      zoom: data.zoom,
    });
    if (!data.name) return respond({ ok: true, location: created });
    const { success: __, ...updated } = await post(`${API}/update`, { ...created, name: data.name });
    respond({ ok: true, location: updated });
  } catch (error) {
    console.warn("🧑‍🎨 : Failed to create official favorite", error);
    respond({ ok: false, error: String(error) });
  }
};

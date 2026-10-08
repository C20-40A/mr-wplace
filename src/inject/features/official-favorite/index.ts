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
  const { success: _, ...location } = json;
  return location;
};

/**
 * 公式 UI のユーザーストアへ最新の /me を反映する。
 * 公式は BroadcastChannel("user-channel") の {type:"refresh"} で data を差し替える (タブ間同期用) ので、
 * 同じページ内の別インスタンスから流せばリロードなしで favorites 一覧が更新される。
 * (/me の fetch は interceptor 経由なので拡張側の user data / favorites も同時に更新される)
 */
const syncOfficialUserStore = async (): Promise<void> => {
  const res = await fetch("https://backend.wplace.live/me", { credentials: "include" });
  if (!res.ok) return;
  const channel = new BroadcastChannel("user-channel");
  channel.postMessage(JSON.stringify({ type: "refresh", data: await res.json() }));
  channel.close();
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
    const created = await post(API, {
      latitude: data.lat,
      longitude: data.lng,
      zoom: data.zoom,
    });
    const location = data.name
      ? await post(`${API}/update`, { ...created, name: data.name })
      : created;
    await syncOfficialUserStore().catch((e) => console.warn("🧑‍🎨 : Failed to sync official user store", e));
    respond({ ok: true, location });
  } catch (error) {
    console.warn("🧑‍🎨 : Failed to create official favorite", error);
    respond({ ok: false, error: String(error) });
  }
};

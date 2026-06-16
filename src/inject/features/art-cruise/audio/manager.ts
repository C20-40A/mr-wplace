import type { ArtCruiseAudioUrls, ArtCruiseSeId } from "./types";

type TrackId = "stage" | "boss" | "gameOver";

type Track = {
  buffer: AudioBuffer;
  source: AudioBufferSourceNode | null;
  gain: GainNode;
};

const DEFAULT_BGM_VOLUME = 0.5;
const DEFAULT_SE_VOLUME = 0.6;
const CROSSFADE_SECONDS = 2.4;
const RAMP_TAIL_SECONDS = 0.05;

/**
 * Art cruise 用 BGM/SE マネージャー (WebAudio)
 * - stage はループ再生（端の繋ぎはフェードで緩和）
 * - stage -> boss は crossfade で滑らかに mix 移行
 * - SE は将来 playSe() で追加予定
 */
export class ArtCruiseAudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private seGain: GainNode | null = null;
  private readonly tracks = new Map<TrackId, Track>();
  private readonly seBuffers = new Map<ArtCruiseSeId, AudioBuffer>();
  private current: TrackId | null = null;
  private gameOverSource: AudioBufferSourceNode | null = null;
  private destroyed = false;
  private muted = false;

  constructor(private readonly urls: ArtCruiseAudioUrls) {}

  /** 非同期で音源を読み込み、stage BGM のループ再生を開始する */
  start = async () => {
    if (this.context || this.destroyed) return;

    const context = new AudioContext();
    this.context = context;
    const masterGain = context.createGain();
    masterGain.gain.value = this.muted ? 0 : DEFAULT_BGM_VOLUME;
    masterGain.connect(context.destination);
    this.masterGain = masterGain;

    // SE は BGM とは独立した gain にぶら下げて一括音量調整できるようにする
    const seGain = context.createGain();
    seGain.gain.value = this.muted ? 0 : DEFAULT_SE_VOLUME;
    seGain.connect(context.destination);
    this.seGain = seGain;

    await Promise.all([
      this.loadTrack("stage", this.urls.stage),
      this.loadTrack("boss", this.urls.boss),
      this.loadTrack("gameOver", this.urls.gameOver),
      this.loadAllSe(),
    ]);
    if (this.destroyed) return;

    // ユーザー操作起点なら resume 済みのはずだが念のため
    if (context.state === "suspended") void context.resume();
    this.playTrack("stage", { fadeInSeconds: 0 });
  };

  /**
   * SE を 1 発再生する。多重発射に耐えるよう毎回 BufferSource を生成する。
   * buffer 未ロード時は黙って無視する（発射より読み込みが遅れても進行を妨げない）。
   */
  playSe = (id: ArtCruiseSeId) => {
    const context = this.context;
    const seGain = this.seGain;
    const buffer = this.seBuffers.get(id);
    if (!context || !seGain || !buffer || this.destroyed) return;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(seGain);
    source.onended = () => source.disconnect();
    source.start();
  };

  /** stage から boss BGM へ crossfade で移行する */
  transitionToBoss = () => {
    if (this.current === "boss") return;
    this.playTrack("boss", { fadeInSeconds: CROSSFADE_SECONDS });
  };

  /** ゲームオーバーBGMを一回再生し、BGMをフェードアウトする */
  playGameOver = () => {
    const context = this.context;
    const masterGain = this.masterGain;
    if (!context || !masterGain || this.destroyed) return;

    this.stopGameOver();

    const now = context.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(0, now + CROSSFADE_SECONDS);
    for (const track of this.tracks.values()) {
      track.source?.stop(now + CROSSFADE_SECONDS + RAMP_TAIL_SECONDS);
      track.source = null;
    }
    this.current = null;

    const gameOverTrack = this.tracks.get("gameOver");
    if (!gameOverTrack) return;
    const source = context.createBufferSource();
    source.buffer = gameOverTrack.buffer;
    source.loop = false;
    source.connect(context.destination);
    source.start(now + CROSSFADE_SECONDS);
    source.onended = () => {
      source.disconnect();
      if (this.gameOverSource === source) this.gameOverSource = null;
    };
    this.gameOverSource = source;
  };

  /** stage BGM へ戻す（リトライ・ボス撃破後などに利用想定） */
  transitionToStage = () => {
    if (this.current === "stage") return;
    this.playTrack("stage", { fadeInSeconds: CROSSFADE_SECONDS });
  };

  /** リスタート時: フェードなしで即座に stage BGM へ戻す */
  resetToStage = () => {
    this.stopGameOver();
    for (const track of this.tracks.values()) {
      track.source?.stop();
      track.source = null;
      track.gain.gain.cancelScheduledValues(0);
      track.gain.gain.value = 0;
    }
    this.current = null;
    this.playTrack("stage", { fadeInSeconds: 0 });
  };

  /** BGM のみミュートする。SE（死亡音など）はポーズ/ゲームオーバー中も鳴らし切る */
  setMuted = (muted: boolean) => {
    this.muted = muted;
    const context = this.context;
    const masterGain = this.masterGain;
    if (!context || !masterGain) return;
    const now = context.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.linearRampToValueAtTime(
      muted ? 0 : DEFAULT_BGM_VOLUME,
      now + 0.2,
    );
  };

  destroy = () => {
    this.destroyed = true;
    this.stopGameOver();
    for (const track of this.tracks.values()) {
      track.source?.stop();
      track.source?.disconnect();
      track.gain.disconnect();
    }
    this.tracks.clear();
    this.seBuffers.clear();
    this.seGain?.disconnect();
    this.seGain = null;
    this.masterGain?.disconnect();
    this.masterGain = null;
    this.current = null;
    void this.context?.close();
    this.context = null;
  };

  private loadAllSe = async () => {
    const entries = Object.entries(this.urls.se) as [ArtCruiseSeId, string][];
    await Promise.all(entries.map(([id, url]) => this.loadSe(id, url)));
  };

  private loadSe = async (id: ArtCruiseSeId, url: string) => {
    const context = this.context;
    if (!context) return;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    if (this.destroyed) return;
    const buffer = await context.decodeAudioData(arrayBuffer);
    if (this.destroyed) return;
    this.seBuffers.set(id, buffer);
  };

  private loadTrack = async (id: TrackId, url: string) => {
    const context = this.context;
    if (!context) return;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    if (this.destroyed) return;
    const buffer = await context.decodeAudioData(arrayBuffer);
    if (this.destroyed) return;
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(this.masterGain!);
    this.tracks.set(id, { buffer, source: null, gain });
  };

  private playTrack = (id: TrackId, { fadeInSeconds }: { fadeInSeconds: number }) => {
    const context = this.context;
    const track = this.tracks.get(id);
    if (!context || !track) return;

    const now = context.currentTime;

    // 旧トラックをフェードアウトして停止
    if (this.current && this.current !== id) {
      const prev = this.tracks.get(this.current);
      if (prev?.source) {
        prev.gain.gain.cancelScheduledValues(now);
        prev.gain.gain.setValueAtTime(prev.gain.gain.value, now);
        prev.gain.gain.linearRampToValueAtTime(0, now + fadeInSeconds);
        prev.source.stop(now + fadeInSeconds + RAMP_TAIL_SECONDS);
        prev.source = null;
      }
    }

    // 再生中なら何もしない（フェードのみ）
    if (!track.source) {
      const source = context.createBufferSource();
      source.buffer = track.buffer;
      source.loop = true;
      source.connect(track.gain);
      source.start();
      track.source = source;
    }

    track.gain.gain.cancelScheduledValues(now);
    track.gain.gain.setValueAtTime(track.gain.gain.value, now);
    track.gain.gain.linearRampToValueAtTime(1, now + fadeInSeconds);
    this.current = id;
  };

  private stopGameOver = () => {
    const source = this.gameOverSource;
    if (!source) return;

    this.gameOverSource = null;
    source.onended = null;
    try {
      source.stop();
    } catch {
      // すでに終了済みの場合は止める必要がない
    }
    source.disconnect();
  };
}

import type { ArtCruiseAudioUrls, ArtCruiseSeId } from "./types";

type TrackId = "stage" | "boss" | "boss2" | "gameOver";

type Track = {
  buffer: AudioBuffer;
  source: AudioBufferSourceNode | null;
  gain: GainNode;
};

const DEFAULT_BGM_VOLUME = 0.5;
const DEFAULT_SE_VOLUME = 0.6;
const CROSSFADE_SECONDS = 2.4;
const RAMP_TAIL_SECONDS = 0.05;
const BOSS2_MIN_LEVEL = 4;

type ArtCruiseAudioManagerOptions = {
  musicVolume?: number;
  seVolume?: number;
};

type ArtCruiseAudioStartOptions = {
  bossLevel?: number | null;
};

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
  private gameOverGain: GainNode | null = null;
  private readonly tracks = new Map<TrackId, Track>();
  private readonly seBuffers = new Map<ArtCruiseSeId, AudioBuffer>();
  private current: TrackId | null = null;
  private gameOverSource: AudioBufferSourceNode | null = null;
  private destroyed = false;
  private muted = false;
  private musicVolume = DEFAULT_BGM_VOLUME;
  private seVolume = DEFAULT_SE_VOLUME;

  constructor(
    private readonly urls: ArtCruiseAudioUrls,
    options: ArtCruiseAudioManagerOptions = {},
  ) {
    this.musicVolume = this.clampVolume(
      options.musicVolume ?? DEFAULT_BGM_VOLUME,
    );
    this.seVolume = this.clampVolume(options.seVolume ?? DEFAULT_SE_VOLUME);
  }

  /** 非同期で音源を読み込み、初期 BGM のループ再生を開始する */
  start = async (options: ArtCruiseAudioStartOptions = {}) => {
    if (this.context || this.destroyed) return;

    const context = new AudioContext();
    this.context = context;
    const masterGain = context.createGain();
    masterGain.gain.value = this.muted ? 0 : this.musicVolume;
    masterGain.connect(context.destination);
    this.masterGain = masterGain;

    // SE は BGM とは独立した gain にぶら下げて一括音量調整できるようにする
    const seGain = context.createGain();
    seGain.gain.value = this.seVolume;
    seGain.connect(context.destination);
    this.seGain = seGain;

    await Promise.all([
      this.loadTrack("stage", this.urls.stage),
      this.loadTrack("boss", this.urls.boss),
      this.loadTrack("boss2", this.urls.boss2),
      this.loadTrack("gameOver", this.urls.gameOver),
      this.loadAllSe(),
    ]);
    if (this.destroyed) return;

    // ユーザー操作起点なら resume 済みのはずだが念のため
    if (context.state === "suspended") void context.resume();
    const initialTrack = this.getBossTrackId(options.bossLevel) ?? "stage";
    this.playTrack(initialTrack, { fadeInSeconds: 0 });
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
  transitionToBoss = (level = 1) => {
    const trackId = this.getBossTrackId(level) ?? "boss";
    if (this.current === trackId) return;
    this.playTrack(trackId, { fadeInSeconds: CROSSFADE_SECONDS });
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
    }
    this.current = null;

    const gameOverTrack = this.tracks.get("gameOver");
    if (!gameOverTrack) return;
    const gameOverGain = context.createGain();
    gameOverGain.gain.value = this.muted ? 0 : this.musicVolume;
    gameOverGain.connect(context.destination);
    const source = context.createBufferSource();
    source.buffer = gameOverTrack.buffer;
    source.loop = false;
    source.connect(gameOverGain);
    source.start(now + CROSSFADE_SECONDS);
    source.onended = () => {
      source.disconnect();
      gameOverGain.disconnect();
      if (this.gameOverSource === source) this.gameOverSource = null;
      if (this.gameOverGain === gameOverGain) this.gameOverGain = null;
    };
    this.gameOverSource = source;
    this.gameOverGain = gameOverGain;
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
      muted ? 0 : this.musicVolume,
      now + 0.2,
    );
    if (this.gameOverGain) {
      this.gameOverGain.gain.cancelScheduledValues(now);
      this.gameOverGain.gain.linearRampToValueAtTime(
        muted ? 0 : this.musicVolume,
        now + 0.2,
      );
    }
  };

  setMusicVolume = (volume: number) => {
    this.musicVolume = this.clampVolume(volume);
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    if (this.masterGain) {
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(
        this.muted ? 0 : this.musicVolume,
        now + 0.08,
      );
    }
    if (this.gameOverGain) {
      this.gameOverGain.gain.cancelScheduledValues(now);
      this.gameOverGain.gain.linearRampToValueAtTime(
        this.muted ? 0 : this.musicVolume,
        now + 0.08,
      );
    }
  };

  setSeVolume = (volume: number) => {
    this.seVolume = this.clampVolume(volume);
    const context = this.context;
    const seGain = this.seGain;
    if (!context || !seGain) return;
    const now = context.currentTime;
    seGain.gain.cancelScheduledValues(now);
    seGain.gain.linearRampToValueAtTime(this.seVolume, now + 0.08);
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
    this.gameOverGain?.disconnect();
    this.gameOverGain = null;
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

  private getBossTrackId = (level?: number | null): TrackId | null => {
    if (level === undefined || level === null) return null;
    return level >= BOSS2_MIN_LEVEL ? "boss2" : "boss";
  };

  private playTrack = (id: TrackId, { fadeInSeconds }: { fadeInSeconds: number }) => {
    const context = this.context;
    const track = this.tracks.get(id);
    const masterGain = this.masterGain;
    if (!context || !track || !masterGain) return;

    const now = context.currentTime;
    this.stopGameOver();
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(
      this.muted ? 0 : this.musicVolume,
      now + 0.08,
    );

    // 旧トラックをフェードアウトして停止
    for (const [trackId, prev] of this.tracks) {
      if (trackId === id || !prev.source) continue;
      if (this.current === trackId) {
        prev.gain.gain.cancelScheduledValues(now);
        prev.gain.gain.setValueAtTime(prev.gain.gain.value, now);
        prev.gain.gain.linearRampToValueAtTime(0, now + fadeInSeconds);
        this.stopTrackSource(prev, now + fadeInSeconds + RAMP_TAIL_SECONDS);
        continue;
      }
      this.stopTrackSource(prev);
    }

    if (track.source) {
      try {
        track.source.stop();
      } catch {
        // 停止済みまたは停止予約済みの source は作り直す
      }
      track.source.disconnect();
      track.source = null;
    }

    // AudioBufferSourceNode は再利用できないため、通常 BGM 復帰時は作り直す。
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
    const gain = this.gameOverGain;
    this.gameOverGain = null;
    source.onended = null;
    try {
      source.stop();
    } catch {
      // すでに終了済みの場合は止める必要がない
    }
    source.disconnect();
    gain?.disconnect();
  };

  private stopTrackSource = (track: Track, when?: number) => {
    const source = track.source;
    if (!source) return;

    track.source = null;
    source.onended = null;
    try {
      if (when === undefined) source.stop();
      else source.stop(when);
    } catch {
      // すでに終了済みの場合は止める必要がない
    }
    if (when === undefined) source.disconnect();
    else source.onended = () => source.disconnect();
  };

  private clampVolume = (volume: number) =>
    Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0));
}

export interface Tag {
  name?: string;
  color: string;
}

export interface Friend {
  id: number; // WPlace user ID
  name: string; // ユーザー名
  equippedFlag: number; // 装備フラグ
  allianceId?: number; // 同盟ID (optional)
  allianceName?: string; // 同盟名 (optional)
  picture?: string; // アイコン画像 base64 (optional)
  memo?: string; // 自由メモ
  tag?: Tag; // タグ
  addedDate: number; // unixtime
}

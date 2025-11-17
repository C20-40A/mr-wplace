// コマンド成功時に実行されるコールバックの型定義
type KonamiCallback = () => void;

/**
 * コナミコマンドの入力を監視し、成功時にコールバックを実行する関数を生成します。
 * * @param callback コマンド成功時に実行する関数
 * @returns document.addEventListener('keydown', ...) に渡すためのイベントリスナー関数
 */
const createKonamiCodeDetector = (callback: KonamiCallback) => {
  // コナミコマンドのキーコード配列を型注釈付きで定義
  const KONAMI_CODE: ReadonlyArray<string> = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "KeyB",
    "KeyA", // 'KeyB'と'KeyA'はevent.codeの値
  ];

  // ユーザーの直近のキー入力を保持する配列。letで再代入可能にし、初期化を可能にする
  let inputHistory: string[] = [];
  const COMMAND_LENGTH: number = KONAMI_CODE.length;

  // JSON.stringifyによる高速比較用の文字列
  const TARGET_CODE_STRING: string = JSON.stringify(KONAMI_CODE);

  // キーボードイベントリスナーとして使用するメインのアロー関数
  // event引数にKeyboardEvent型を明示的に指定
  const konamiCodeListener = (event: KeyboardEvent): void => {
    // キーコードを取得 (event.codeはstring型)
    const currentKey: string = event.code;

    // 1. 入力履歴に現在のキーコードを追加
    inputHistory.push(currentKey);

    // 2. 履歴の長さをコマンドの長さに維持（スライディングウィンドウ）
    if (inputHistory.length > COMMAND_LENGTH) {
      // 先頭のキーコードを破棄
      inputHistory.shift();
    }

    // 3. 履歴がコマンド長に達しているかチェック
    if (inputHistory.length === COMMAND_LENGTH) {
      // 現在の履歴を文字列化して、目標の文字列と比較
      if (JSON.stringify(inputHistory) === TARGET_CODE_STRING) {
        // コマンド成功！コールバックを実行
        callback();

        // 履歴をリセット
        inputHistory = [];
      }
    }
  };

  // 生成したリスナー関数を返す
  return konamiCodeListener;
};

export { createKonamiCodeDetector };

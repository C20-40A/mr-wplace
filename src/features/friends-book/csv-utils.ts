import { Friend, Tag } from "./types";

/**
 * CSV エクスケープ
 */
const escapeCsv = (value: string | number | undefined): string => {
  if (value === undefined || value === null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * CSV パース（シンプルな実装）
 */
const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // エスケープされたダブルクォート
        current += '"';
        i++; // 次の文字をスキップ
      } else {
        // クォートの開始/終了
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // フィールドの区切り
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
};

/**
 * Friends を CSV に変換
 */
export const friendsToCSV = (friends: Friend[]): string => {
  const header =
    "id,name,equippedFlag,allianceId,allianceName,memo,tagColor,tagName";
  const rows = friends.map((friend) => {
    return [
      escapeCsv(friend.id),
      escapeCsv(friend.name),
      escapeCsv(friend.equippedFlag),
      escapeCsv(friend.allianceId),
      escapeCsv(friend.allianceName),
      escapeCsv(friend.memo),
      escapeCsv(friend.tag?.color),
      escapeCsv(friend.tag?.name),
    ].join(",");
  });

  return [header, ...rows].join("\n");
};

/**
 * CSV を Friends に変換
 */
export const csvToFriends = (csv: string): Friend[] => {
  const lines = csv.trim().split("\n");
  if (lines.length <= 1) return [];

  const header = lines[0];
  const dataLines = lines.slice(1);

  // ヘッダー検証（後方互換性のため新旧両方を許容）
  const newHeader =
    "id,name,equippedFlag,allianceId,allianceName,memo,tagColor,tagName";
  const oldHeader = newHeader + ",addedDate";
  const hasAddedDate = header === oldHeader;

  if (header !== newHeader && header !== oldHeader) {
    throw new Error(
      "Invalid CSV format. Expected header: " + newHeader + " or " + oldHeader
    );
  }

  const friends: Friend[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue; // 空行をスキップ

    try {
      const fields = parseCsvLine(line);

      const id = parseInt(fields[0], 10);
      const name = fields[1];
      const equippedFlag = parseInt(fields[2], 10);
      const allianceId = fields[3] ? parseInt(fields[3], 10) : undefined;
      const allianceName = fields[4] || undefined;
      const memo = fields[5] || undefined;
      const tagColor = fields[6] || undefined;
      const tagName = fields[7] || undefined;
      // fields[8] (addedDate) は無視

      if (isNaN(id) || !name || isNaN(equippedFlag)) {
        console.warn(`🧑‍🎨 : Skipping invalid CSV line ${i + 2}: ${line}`);
        continue;
      }

      let tag: Tag | undefined = undefined;
      if (tagColor) {
        tag = { color: tagColor, name: tagName };
      }

      friends.push({
        id,
        name,
        equippedFlag,
        allianceId,
        allianceName,
        memo,
        tag,
      });
    } catch (error) {
      console.warn(
        `🧑‍🎨 : Failed to parse CSV line ${i + 2}: ${line}`,
        error
      );
      continue;
    }
  }

  return friends;
};

/**
 * CSV ダウンロード
 */
export const downloadCSV = (csv: string, filename: string): void => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * CSV ファイル選択
 */
export const selectCSVFile = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.style.display = "none";

    input.addEventListener("change", (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const csv = event.target?.result as string;
        resolve(csv);
      };
      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };
      reader.readAsText(file);
    });

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
};

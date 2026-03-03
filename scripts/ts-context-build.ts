#!/usr/bin/env bun

import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve, sep } from "path";

type ImportRecord = {
  module: string;
  resolvedPath?: string;
};

type ExportRecord = {
  name: string;
  kinds: string[];
};

type DeclarationRecord = {
  kind: string;
  name: string;
  signature: string;
  exported: boolean;
};

type FileRecord = {
  imports: ImportRecord[];
  exports: ExportRecord[];
  declarations: DeclarationRecord[];
  dependsOn: string[];
  usedBy: string[];
};

type IndexData = {
  generatedAt: string;
  files: Record<string, FileRecord>;
  meta?: {
    totalFiles?: number;
  };
};

type FileScore = {
  path: string;
  score: number;
  reasons: string[];
};

type CliOptions = {
  task: string;
  budget: number;
  indexPath: string;
  outPath: string;
  maxFiles: number;
};

const DEFAULT_BUDGET = 6000;
const DEFAULT_MAX_FILES = 24;
const ROOT = process.cwd();

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "then",
  "than",
  "when",
  "what",
  "where",
  "how",
  "why",
  "are",
  "was",
  "were",
  "will",
  "would",
  "should",
  "could",
  "can",
  "fix",
  "refactor",
  "analyze",
  "analysis",
  "対応",
  "修正",
  "追加",
  "実装",
  "改善",
  "して",
  "する",
  "です",
  "ます",
]);

const toPosixPath = (pathValue: string) => pathValue.split(sep).join("/");

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    task: "",
    budget: DEFAULT_BUDGET,
    indexPath: ".cache/ts-morph-index.json",
    outPath: ".cache/llm-context.md",
    maxFiles: DEFAULT_MAX_FILES,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg === "--task") {
      const taskParts: string[] = [];
      let cursor = index + 1;
      while (cursor < argv.length && !argv[cursor].startsWith("--")) {
        taskParts.push(argv[cursor]);
        cursor++;
      }
      if (!taskParts.length) throw new Error("Missing value for --task");
      options.task = taskParts.join(" ");
      index = cursor - 1;
      continue;
    }

    if (arg === "--budget") {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value) || value < 500) throw new Error("--budget must be >= 500");
      options.budget = Math.floor(value);
      index++;
      continue;
    }

    if (arg === "--index") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --index");
      options.indexPath = value;
      index++;
      continue;
    }

    if (arg === "--out") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --out");
      options.outPath = value;
      index++;
      continue;
    }

    if (arg === "--max-files") {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value) || value < 1) throw new Error("--max-files must be >= 1");
      options.maxFiles = Math.floor(value);
      index++;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log(`Usage: bun scripts/ts-context-build.ts [options]

Options:
  --task <text>          Task or question text for relevance scoring
  --budget <tokens>      Approx token budget for markdown output (default: ${DEFAULT_BUDGET})
  --max-files <count>    Max selected files before budget trimming (default: ${DEFAULT_MAX_FILES})
  --index <path>         ts-morph index path (default: .cache/ts-morph-index.json)
  --out <path>           Output markdown path (default: .cache/llm-context.md)
`);
      process.exit(0);
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
};

const estimateTokens = (text: string) => Math.ceil(text.length / 4);

const readLines = (command: string): string[] => {
  try {
    const output = execSync(command, { encoding: "utf8", cwd: ROOT });
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map(toPosixPath);
  } catch {
    return [];
  }
};

const getChangedFiles = () => {
  const tracked = readLines("git diff --name-only --relative HEAD");
  const untracked = readLines("git ls-files --others --exclude-standard");
  return new Set([...tracked, ...untracked].filter((pathValue) => pathValue.startsWith("src/") && pathValue.endsWith(".ts")));
};

const extractTokens = (task: string): string[] => {
  const normalized = task.toLowerCase();
  const asciiTokens = normalized.match(/[a-z0-9_/-]{2,}/g) ?? [];
  const jaTokens = normalized
    .split(/[\s、。,.!?:;()\[\]{}"'`]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && /[ぁ-んァ-ヶ一-龯]/.test(token));
  return [...new Set([...asciiTokens, ...jaTokens].filter((token) => !STOP_WORDS.has(token)))];
};

const readIndex = (indexPath: string): IndexData => {
  const absolutePath = resolve(ROOT, indexPath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Index not found: ${indexPath}. Run 'bun run analyze:ts' first.`);
  }

  const parsed = JSON.parse(readFileSync(absolutePath, "utf8")) as IndexData;
  if (!parsed.files || typeof parsed.files !== "object") {
    throw new Error(`Invalid index format: ${indexPath}`);
  }
  return parsed;
};

const scoreFile = (filePath: string, file: FileRecord, tokens: string[], changedFiles: Set<string>): FileScore => {
  const lowerPath = filePath.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  if (changedFiles.has(filePath)) {
    score += 220;
    reasons.push("changed");
  }

  const matchedTokens: string[] = [];
  for (const token of tokens) {
    if (lowerPath.includes(token)) {
      score += 70;
      matchedTokens.push(`path:${token}`);
    }
  }

  const declarationNames = file.declarations.map((item) => item.name.toLowerCase());
  const exportNames = file.exports.map((item) => item.name.toLowerCase());
  const modules = file.imports.map((item) => item.module.toLowerCase());

  for (const token of tokens) {
    const declHits = declarationNames.filter((name) => name.includes(token)).length;
    if (declHits > 0) {
      score += Math.min(80, declHits * 16);
      matchedTokens.push(`decl:${token}`);
    }

    const exportHits = exportNames.filter((name) => name.includes(token)).length;
    if (exportHits > 0) {
      score += Math.min(60, exportHits * 20);
      matchedTokens.push(`export:${token}`);
    }

    const moduleHits = modules.filter((name) => name.includes(token)).length;
    if (moduleHits > 0) {
      score += Math.min(36, moduleHits * 6);
      matchedTokens.push(`import:${token}`);
    }
  }

  if (tokens.length === 0) score += Math.min(20, file.usedBy.length);

  const uniqueReasons = [...new Set([...reasons, ...matchedTokens])];
  return { path: filePath, score, reasons: uniqueReasons };
};

const pushIfExists = (result: string[], seen: Set<string>, filePath: string, files: Record<string, FileRecord>, max: number) => {
  if (seen.size >= max) return;
  if (!files[filePath]) return;
  if (seen.has(filePath)) return;
  seen.add(filePath);
  result.push(filePath);
};

const selectFiles = (
  files: Record<string, FileRecord>,
  scores: FileScore[],
  changedFiles: Set<string>,
  maxFiles: number
) => {
  const selected: string[] = [];
  const seen = new Set<string>();
  const scoreMap = new Map(scores.map((item) => [item.path, item]));
  const sorted = [...scores].sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));
  const changed = [...changedFiles].filter((filePath) => files[filePath]).sort();

  for (const filePath of changed) pushIfExists(selected, seen, filePath, files, maxFiles);

  for (const item of sorted) {
    if (item.score <= 0) continue;
    pushIfExists(selected, seen, item.path, files, maxFiles);
  }

  const entryPoints = ["src/content.ts", "src/inject.ts", "src/popup.ts"];
  if (selected.length === 0) {
    for (const filePath of entryPoints) pushIfExists(selected, seen, filePath, files, maxFiles);
    for (const item of sorted) pushIfExists(selected, seen, item.path, files, maxFiles);
  }

  const seeds = [...selected];
  for (const filePath of seeds) {
    if (selected.length >= maxFiles) break;
    const file = files[filePath];
    if (!file) continue;

    const neighborCandidates = [...file.dependsOn, ...file.usedBy]
      .filter((neighborPath) => files[neighborPath] && !seen.has(neighborPath))
      .sort((left, right) => {
        const leftScore = scoreMap.get(left)?.score ?? 0;
        const rightScore = scoreMap.get(right)?.score ?? 0;
        return rightScore - leftScore || left.localeCompare(right);
      })
      .slice(0, 4);

    for (const neighbor of neighborCandidates) pushIfExists(selected, seen, neighbor, files, maxFiles);
  }

  return selected;
};

const renderList = (label: string, items: string[], max = 8) => {
  if (!items.length) return `${label}: -`;
  const picked = items.slice(0, max);
  const suffix = items.length > max ? ` ...(+${items.length - max})` : "";
  return `${label}: ${picked.join(", ")}${suffix}`;
};

const compactDeclaration = (declaration: DeclarationRecord) => {
  const signature = declaration.signature.replace(/\s+/g, " ").trim();
  const compact = signature.length > 120 ? `${signature.slice(0, 117)}...` : signature;
  const exported = declaration.exported ? "export " : "";
  return `${exported}${declaration.kind} ${declaration.name} :: ${compact}`;
};

const buildHeader = (
  options: CliOptions,
  index: IndexData,
  selectedCount: number,
  changedFiles: Set<string>,
  tokens: string[]
) => {
  const lines = [
    "# LLM Context Snapshot",
    "",
    `- task: ${options.task || "(none)"}`,
    `- budget_tokens: ${options.budget}`,
    `- generated_from: ${options.indexPath}`,
    `- index_generated_at: ${index.generatedAt}`,
    `- selected_files: ${selectedCount}`,
    `- changed_files_detected: ${[...changedFiles].length}`,
    `- query_tokens: ${tokens.length ? tokens.join(", ") : "(none)"}`,
    "",
    "## Selection Summary",
  ];
  return `${lines.join("\n")}\n`;
};

const buildSummaryTable = (
  selectedFiles: string[],
  scoreMap: Map<string, FileScore>,
  changedFiles: Set<string>
) => {
  const lines = ["| file | score | reason |", "|---|---:|---|"];
  for (const filePath of selectedFiles) {
    const fileScore = scoreMap.get(filePath);
    const reasons = fileScore?.reasons.length ? fileScore.reasons.join(", ") : changedFiles.has(filePath) ? "changed" : "graph";
    const score = fileScore?.score ?? 0;
    lines.push(`| ${filePath} | ${score} | ${reasons} |`);
  }
  return `${lines.join("\n")}\n\n## File Context\n`;
};

const buildFileSection = (filePath: string, file: FileRecord, score: FileScore | undefined) => {
  const lines: string[] = [];
  lines.push(`### ${filePath}`);
  lines.push(`- score: ${score?.score ?? 0}`);
  if (score?.reasons.length) lines.push(`- reasons: ${score.reasons.join(", ")}`);
  lines.push(`- imports: ${file.imports.length}, exports: ${file.exports.length}, declarations: ${file.declarations.length}`);
  lines.push(`- ${renderList("dependsOn", file.dependsOn)}`);
  lines.push(`- ${renderList("usedBy", file.usedBy)}`);

  const exportItems = file.exports.slice(0, 12).map((item) => `${item.name} (${item.kinds.join("/")})`);
  lines.push(`- ${renderList("exports", exportItems, 12)}`);

  const declarationItems = file.declarations.slice(0, 14).map(compactDeclaration);
  if (declarationItems.length) {
    lines.push("- declarations:");
    for (const item of declarationItems) lines.push(`  - ${item}`);
    if (file.declarations.length > declarationItems.length) {
      lines.push(`  - ...(+${file.declarations.length - declarationItems.length})`);
    }
  } else {
    lines.push("- declarations: -");
  }

  return `${lines.join("\n")}\n\n`;
};

const buildOutput = (
  options: CliOptions,
  index: IndexData,
  files: Record<string, FileRecord>,
  selectedFiles: string[],
  scoreMap: Map<string, FileScore>,
  changedFiles: Set<string>,
  tokens: string[]
) => {
  const budgetChars = options.budget * 4;
  let output = buildHeader(options, index, selectedFiles.length, changedFiles, tokens);

  const summary = buildSummaryTable(selectedFiles, scoreMap, changedFiles);
  if (output.length + summary.length <= budgetChars) {
    output += summary;
  } else {
    output += "(summary omitted due to budget)\n\n## File Context\n";
  }

  let includedCount = 0;
  for (const filePath of selectedFiles) {
    const file = files[filePath];
    if (!file) continue;
    const section = buildFileSection(filePath, file, scoreMap.get(filePath));
    if (output.length + section.length > budgetChars) break;
    output += section;
    includedCount++;
  }

  if (includedCount < selectedFiles.length) {
    output += `## Truncated\n- included_files: ${includedCount}\n- omitted_files: ${selectedFiles.length - includedCount}\n`;
  }

  const usedTokens = estimateTokens(output);
  output += `\n## Budget\n- used_tokens_approx: ${usedTokens}\n- budget_tokens: ${options.budget}\n`;
  return output;
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const index = readIndex(options.indexPath);
  const files = index.files;
  const changedFiles = getChangedFiles();
  const tokens = extractTokens(options.task);

  const scores = Object.entries(files).map(([filePath, file]) =>
    scoreFile(filePath, file, tokens, changedFiles)
  );
  const selectedFiles = selectFiles(files, scores, changedFiles, options.maxFiles);
  const scoreMap = new Map(scores.map((item) => [item.path, item]));

  const markdown = buildOutput(options, index, files, selectedFiles, scoreMap, changedFiles, tokens);
  const outAbsolutePath = resolve(ROOT, options.outPath);
  mkdirSync(dirname(outAbsolutePath), { recursive: true });
  writeFileSync(outAbsolutePath, markdown, "utf8");

  console.log(`🧑‍🎨 : Context written to ${options.outPath}`);
  console.log(`🧑‍🎨 : Selected ${selectedFiles.length} files, approx ${estimateTokens(markdown)} tokens`);
};

main();

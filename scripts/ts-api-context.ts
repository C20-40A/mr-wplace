#!/usr/bin/env bun

import { mkdirSync, writeFileSync } from "fs";
import { dirname, relative, resolve, sep } from "path";
import { Node, Project, type JSDoc, type Node as MorphNode, type SourceFile } from "ts-morph";

type CliOptions = {
  out: string;
  project: string;
  targets: string[];
};

type DeclarationDoc = {
  kind: string;
  name: string;
  exported: boolean;
  line: number;
  signature: string;
  summary?: string;
  tags: string[];
};

const ROOT = process.cwd();
const DEFAULT_TARGETS = ["src/utils", "src/components"];
const EXCLUDED_PATHS = [
  "src/components/color-palette/color-sorter.ts",
  "src/components/color-palette/storage.ts",
  "src/components/color-palette/types.ts",
  "src/components/color-palette/ui.ts",
  "src/components/color-palette/utils.ts",
];

const toPosixPath = (pathValue: string) => pathValue.split(sep).join("/");
const toRelativePath = (filePath: string) => toPosixPath(relative(ROOT, filePath));

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    out: ".prompts/context/utils-components-api.md",
    project: "tsconfig.json",
    targets: [...DEFAULT_TARGETS],
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg === "--out") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --out");
      options.out = value;
      index++;
      continue;
    }

    if (arg === "--project") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --project");
      options.project = value;
      index++;
      continue;
    }

    if (arg === "--targets") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --targets");
      options.targets = value.split(",").map((item) => item.trim()).filter(Boolean);
      index++;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log(`Usage: bun scripts/ts-api-context.ts [options]

Options:
  --out <path>           Output markdown path (default: ${options.out})
  --project <path>       tsconfig path (default: ${options.project})
  --targets <paths>      Comma-separated target directories (default: ${DEFAULT_TARGETS.join(",")})
`);
      process.exit(0);
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
};

const isTargetFile = (sourceFile: SourceFile, targets: string[]) => {
  const relativePath = toRelativePath(sourceFile.getFilePath());
  if (!relativePath.endsWith(".ts") || relativePath.endsWith(".d.ts")) return false;
  if (EXCLUDED_PATHS.includes(relativePath)) return false;
  return targets.some((target) => relativePath.startsWith(target.replace(/\/+$/, "")));
};

const getJsDocs = (node: MorphNode): JSDoc[] => {
  if (!("getJsDocs" in node) || typeof node.getJsDocs !== "function") return [];
  return node.getJsDocs();
};

const normalizeText = (value?: string) =>
  value
    ?.replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ") ?? "";

const getDocSummary = (node: MorphNode) => {
  const [doc] = getJsDocs(node);
  if (!doc) return undefined;
  const comment = normalizeText(doc.getCommentText());
  return comment || undefined;
};

const getDocTags = (node: MorphNode) => {
  const [doc] = getJsDocs(node);
  if (!doc) return [];
  return doc.getTags().map((tag) => {
    const name = tag.getTagName();
    const text = normalizeText(tag.getCommentText());
    return text ? `@${name} ${text}` : `@${name}`;
  });
};

const getFunctionSignature = (node: Node) => {
  if (!Node.isFunctionDeclaration(node)) return "";
  const name = node.getName() ?? "anonymous";
  const params = node.getParameters().map((parameter) => parameter.getText()).join(", ");
  const returnType = node.getReturnTypeNode()?.getText() ?? node.getReturnType().getText(node);
  const asyncPrefix = node.isAsync() ? "async " : "";
  return `${asyncPrefix}${name}(${params}) => ${returnType}`;
};

const getVariableSignature = (node: Node) => {
  if (!Node.isVariableDeclaration(node)) return "";
  return node.getTypeNode()?.getText() ?? node.getType().getText(node);
};

const getTypeSignature = (node: Node) => {
  if (!Node.isTypeAliasDeclaration(node)) return "";
  return node.getTypeNode().getText();
};

const getInterfaceSignature = (node: Node) => {
  if (!Node.isInterfaceDeclaration(node)) return "";
  const typeParams = node.getTypeParameters().map((param) => param.getText()).join(", ");
  const extendsText = node.getExtends().map((item) => item.getText()).join(", ");
  return [
    node.getName() + (typeParams ? `<${typeParams}>` : ""),
    extendsText ? `extends ${extendsText}` : "",
  ]
    .filter(Boolean)
    .join(" ");
};

const getClassSignature = (node: Node) => {
  if (!Node.isClassDeclaration(node)) return "";
  const extendsText = node.getExtends()?.getText();
  const implementsText = node.getImplements().map((item) => item.getText()).join(", ");
  return [
    node.getName() ?? "anonymous",
    extendsText ? `extends ${extendsText}` : "",
    implementsText ? `implements ${implementsText}` : "",
  ]
    .filter(Boolean)
    .join(" ");
};

const getDeclarationDocs = (sourceFile: SourceFile): DeclarationDoc[] => {
  const records: DeclarationDoc[] = [];

  for (const statement of sourceFile.getStatements()) {
    if (Node.isFunctionDeclaration(statement)) {
      const name = statement.getName();
      if (!name) continue;
      records.push({
        kind: "function",
        name,
        exported: statement.hasExportKeyword(),
        line: statement.getStartLineNumber(),
        signature: getFunctionSignature(statement),
        summary: getDocSummary(statement),
        tags: getDocTags(statement),
      });
      continue;
    }

    if (Node.isInterfaceDeclaration(statement)) {
      records.push({
        kind: "interface",
        name: statement.getName(),
        exported: statement.hasExportKeyword(),
        line: statement.getStartLineNumber(),
        signature: getInterfaceSignature(statement),
        summary: getDocSummary(statement),
        tags: getDocTags(statement),
      });
      continue;
    }

    if (Node.isTypeAliasDeclaration(statement)) {
      records.push({
        kind: "type",
        name: statement.getName(),
        exported: statement.hasExportKeyword(),
        line: statement.getStartLineNumber(),
        signature: getTypeSignature(statement),
        summary: getDocSummary(statement),
        tags: getDocTags(statement),
      });
      continue;
    }

    if (Node.isClassDeclaration(statement)) {
      const name = statement.getName();
      if (!name) continue;
      records.push({
        kind: "class",
        name,
        exported: statement.hasExportKeyword(),
        line: statement.getStartLineNumber(),
        signature: getClassSignature(statement),
        summary: getDocSummary(statement),
        tags: getDocTags(statement),
      });
      continue;
    }

    if (Node.isEnumDeclaration(statement)) {
      records.push({
        kind: "enum",
        name: statement.getName(),
        exported: statement.hasExportKeyword(),
        line: statement.getStartLineNumber(),
        signature: statement.getMembers().map((member) => member.getName()).join(", "),
        summary: getDocSummary(statement),
        tags: getDocTags(statement),
      });
      continue;
    }

    if (Node.isVariableStatement(statement)) {
      for (const declaration of statement.getDeclarations()) {
        records.push({
          kind: "variable",
          name: declaration.getName(),
          exported: statement.hasExportKeyword(),
          line: declaration.getStartLineNumber(),
          signature: getVariableSignature(declaration),
          summary: getDocSummary(statement),
          tags: getDocTags(statement),
        });
      }
    }
  }

  return records;
};

const formatTags = (tags: string[]) => {
  if (!tags.length) return "";
  return `\n  - tags: ${tags.join(" | ")}`;
};

const formatDeclaration = (record: DeclarationDoc) => {
  const exportPrefix = record.exported ? "export " : "";
  const summary = record.summary ? `\n  - summary: ${record.summary}` : "";
  return `- ${exportPrefix}${record.kind} \`${record.name}\` (L${record.line})
  - signature: \`${record.signature || "(no signature)"}\`${summary}${formatTags(record.tags)}`;
};

const buildMarkdown = (sourceFiles: SourceFile[], options: CliOptions) => {
  const lines: string[] = [];
  lines.push("# Utils / Components API Context");
  lines.push("");
  lines.push(`- generated_at: ${new Date().toISOString()}`);
  lines.push(`- project: ${options.project}`);
  lines.push(`- targets: ${options.targets.join(", ")}`);
  lines.push(`- files: ${sourceFiles.length}`);
  lines.push("");

  for (const sourceFile of sourceFiles) {
    const relativePath = toRelativePath(sourceFile.getFilePath());
    const declarations = getDeclarationDocs(sourceFile);
    const exportedCount = declarations.filter((item) => item.exported).length;

    lines.push(`## ${relativePath}`);
    lines.push("");
    lines.push(`- exports: ${exportedCount}`);
    lines.push(`- top_level_declarations: ${declarations.length}`);

    if (!declarations.length) {
      lines.push("- declarations: none");
      lines.push("");
      continue;
    }

    lines.push("- declarations:");
    for (const declaration of declarations) lines.push(formatDeclaration(declaration));
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const project = new Project({ tsConfigFilePath: resolve(ROOT, options.project) });
  const sourceFiles = project
    .getSourceFiles()
    .filter((sourceFile) => isTargetFile(sourceFile, options.targets))
    .sort((left, right) => toRelativePath(left.getFilePath()).localeCompare(toRelativePath(right.getFilePath())));

  const markdown = buildMarkdown(sourceFiles, options);
  const outputPath = resolve(ROOT, options.out);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, markdown, "utf8");

  console.log(`🧑‍🎨 : API context written to ${options.out}`);
  console.log(`🧑‍🎨 : Processed ${sourceFiles.length} files`);
};

main();

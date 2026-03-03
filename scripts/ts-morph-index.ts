#!/usr/bin/env bun

import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, relative, resolve, sep } from "path";
import { Node, Project, SourceFile } from "ts-morph";

type ImportRecord = {
  module: string;
  resolvedPath?: string;
  isTypeOnly: boolean;
  defaultImport?: string;
  namespaceImport?: string;
  namedImports: { name: string; alias?: string; isTypeOnly: boolean }[];
};

type ExportRecord = {
  name: string;
  kinds: string[];
  line: number;
  isTypeOnly: boolean;
};

type DeclarationRecord = {
  kind: string;
  name: string;
  signature: string;
  line: number;
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
  schemaVersion: number;
  generatedAt: string;
  projectRoot: string;
  changedOnly: boolean;
  files: Record<string, FileRecord>;
  meta: {
    totalFiles: number;
    parsedFiles: number;
    skippedFiles: number;
    changedFiles: string[];
  };
};

type CliOptions = {
  out: string;
  project: string;
  changedOnly: boolean;
};

const ROOT = process.cwd();

const toPosixPath = (pathValue: string) => pathValue.split(sep).join("/");

const toRelativePath = (filePath: string) => toPosixPath(relative(ROOT, filePath));

const isTargetFile = (pathValue: string) =>
  pathValue.startsWith("src/") && pathValue.endsWith(".ts") && !pathValue.endsWith(".d.ts");

const isTypeOnlyExportDeclaration = (node: Node) =>
  Node.isInterfaceDeclaration(node) || Node.isTypeAliasDeclaration(node);

const readLines = (command: string): string[] => {
  try {
    const output = execSync(command, { encoding: "utf8", cwd: ROOT });
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

const getChangedFiles = () => {
  const tracked = readLines("git diff --name-only --relative HEAD");
  const untracked = readLines("git ls-files --others --exclude-standard");
  return new Set(
    [...tracked, ...untracked]
      .map(toPosixPath)
      .filter((pathValue) => isTargetFile(pathValue))
  );
};

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    out: ".cache/ts-morph-index.json",
    project: "tsconfig.json",
    changedOnly: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg === "--changed") {
      options.changedOnly = true;
      continue;
    }

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

    if (arg === "--help" || arg === "-h") {
      console.log(`Usage: bun scripts/ts-morph-index.ts [options]

Options:
  --changed              Parse changed files only and merge into existing index
  --project <path>       tsconfig path (default: tsconfig.json)
  --out <path>           output path (default: .cache/ts-morph-index.json)
`);
      process.exit(0);
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
};

const readExistingIndex = (pathValue: string): IndexData | null => {
  if (!existsSync(pathValue)) return null;

  try {
    return JSON.parse(readFileSync(pathValue, "utf8")) as IndexData;
  } catch {
    return null;
  }
};

const buildFileGraphs = (sourceFiles: SourceFile[]) => {
  const dependsOn = new Map<string, Set<string>>();
  const usedBy = new Map<string, Set<string>>();

  for (const sourceFile of sourceFiles) {
    const filePath = toRelativePath(sourceFile.getFilePath());
    if (!isTargetFile(filePath)) continue;
    if (!dependsOn.has(filePath)) dependsOn.set(filePath, new Set());
    if (!usedBy.has(filePath)) usedBy.set(filePath, new Set());
  }

  for (const sourceFile of sourceFiles) {
    const fromPath = toRelativePath(sourceFile.getFilePath());
    if (!isTargetFile(fromPath)) continue;

    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const resolved = importDeclaration.getModuleSpecifierSourceFile();
      if (!resolved) continue;
      const toPath = toRelativePath(resolved.getFilePath());
      if (!isTargetFile(toPath) || toPath === fromPath) continue;
      dependsOn.get(fromPath)?.add(toPath);
      usedBy.get(toPath)?.add(fromPath);
    }
  }

  return { dependsOn, usedBy };
};

const getFunctionSignature = (node: Node) => {
  if (!Node.isFunctionDeclaration(node)) return "";
  const name = node.getName() ?? "anonymous";
  const params = node
    .getParameters()
    .map((parameter) => parameter.getText().replace(/\s*=\s*.+$/, "").trim())
    .join(", ");
  const returnType = node.getReturnTypeNode()?.getText() ?? node.getReturnType().getText(node);
  const asyncPrefix = node.isAsync() ? "async " : "";
  return `${asyncPrefix}${name}(${params}) => ${returnType}`;
};

const getClassSignature = (node: Node) => {
  if (!Node.isClassDeclaration(node)) return "";
  const name = node.getName() ?? "anonymous";
  const extendText = node.getExtends() ? ` extends ${node.getExtends()!.getText()}` : "";
  const implementsTexts = node.getImplements().map((item) => item.getText());
  const implementsText = implementsTexts.length ? ` implements ${implementsTexts.join(", ")}` : "";
  return `${name}${extendText}${implementsText}`;
};

const getDeclarationRecords = (sourceFile: SourceFile): DeclarationRecord[] => {
  const records: DeclarationRecord[] = [];

  for (const statement of sourceFile.getStatements()) {
    if (Node.isFunctionDeclaration(statement)) {
      const name = statement.getName();
      if (!name) continue;
      records.push({
        kind: "function",
        name,
        signature: getFunctionSignature(statement),
        line: statement.getStartLineNumber(),
        exported: statement.hasExportKeyword(),
      });
      continue;
    }

    if (Node.isClassDeclaration(statement)) {
      const name = statement.getName();
      if (!name) continue;
      records.push({
        kind: "class",
        name,
        signature: getClassSignature(statement),
        line: statement.getStartLineNumber(),
        exported: statement.hasExportKeyword(),
      });
      continue;
    }

    if (Node.isInterfaceDeclaration(statement)) {
      const name = statement.getName();
      records.push({
        kind: "interface",
        name,
        signature: `${name}${statement.getTypeParameters().length ? `<${statement.getTypeParameters().map((tp) => tp.getText()).join(", ")}>` : ""}`,
        line: statement.getStartLineNumber(),
        exported: statement.hasExportKeyword(),
      });
      continue;
    }

    if (Node.isTypeAliasDeclaration(statement)) {
      records.push({
        kind: "type",
        name: statement.getName(),
        signature: statement.getName(),
        line: statement.getStartLineNumber(),
        exported: statement.hasExportKeyword(),
      });
      continue;
    }

    if (Node.isEnumDeclaration(statement)) {
      records.push({
        kind: "enum",
        name: statement.getName(),
        signature: statement.getName(),
        line: statement.getStartLineNumber(),
        exported: statement.hasExportKeyword(),
      });
      continue;
    }

    if (Node.isVariableStatement(statement)) {
      for (const declaration of statement.getDeclarations()) {
        records.push({
          kind: "variable",
          name: declaration.getName(),
          signature: declaration.getTypeNode()?.getText() ?? declaration.getType().getText(declaration),
          line: declaration.getStartLineNumber(),
          exported: statement.hasExportKeyword(),
        });
      }
    }
  }

  return records;
};

const getImportRecords = (sourceFile: SourceFile): ImportRecord[] =>
  sourceFile.getImportDeclarations().map((importDeclaration) => {
    const resolved = importDeclaration.getModuleSpecifierSourceFile();
    const resolvedPath = resolved ? toRelativePath(resolved.getFilePath()) : undefined;
    return {
      module: importDeclaration.getModuleSpecifierValue(),
      resolvedPath: resolvedPath && isTargetFile(resolvedPath) ? resolvedPath : undefined,
      isTypeOnly: importDeclaration.isTypeOnly(),
      defaultImport: importDeclaration.getDefaultImport()?.getText() ?? undefined,
      namespaceImport: importDeclaration.getNamespaceImport()?.getText() ?? undefined,
      namedImports: importDeclaration.getNamedImports().map((namedImport) => ({
        name: namedImport.getName(),
        alias: namedImport.getAliasNode()?.getText() ?? undefined,
        isTypeOnly: namedImport.isTypeOnly(),
      })),
    };
  });

const getExportRecords = (sourceFile: SourceFile): ExportRecord[] => {
  const records: ExportRecord[] = [];
  const declarationsByName = sourceFile.getExportedDeclarations();

  for (const [name, declarations] of declarationsByName) {
    if (!declarations.length) continue;
    const kinds = [...new Set(declarations.map((declaration) => declaration.getKindName()))];
    const line = Math.min(...declarations.map((declaration) => declaration.getStartLineNumber()));
    const isTypeOnly = declarations.every((declaration) => isTypeOnlyExportDeclaration(declaration));
    records.push({ name, kinds, line, isTypeOnly });
  }

  return records.sort((left, right) => left.line - right.line);
};

const collectFileRecord = (
  sourceFile: SourceFile,
  dependsOnMap: Map<string, Set<string>>,
  usedByMap: Map<string, Set<string>>
): FileRecord => {
  const filePath = toRelativePath(sourceFile.getFilePath());
  return {
    imports: getImportRecords(sourceFile),
    exports: getExportRecords(sourceFile),
    declarations: getDeclarationRecords(sourceFile),
    dependsOn: [...(dependsOnMap.get(filePath) ?? [])].sort(),
    usedBy: [...(usedByMap.get(filePath) ?? [])].sort(),
  };
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const outAbsolutePath = resolve(ROOT, options.out);
  const existingIndex = readExistingIndex(outAbsolutePath);

  const shouldRunChangedOnly = options.changedOnly && Boolean(existingIndex);
  if (options.changedOnly && !existingIndex) {
    console.log("🧑‍🎨 : No existing index found. Running full parse instead of --changed mode.");
  }

  const project = new Project({
    tsConfigFilePath: resolve(ROOT, options.project),
  });

  const allSourceFiles = project
    .getSourceFiles()
    .filter((sourceFile) => isTargetFile(toRelativePath(sourceFile.getFilePath())));
  const totalFileCount = allSourceFiles.length;

  const { dependsOn, usedBy } = buildFileGraphs(allSourceFiles);

  let targetSourceFiles = allSourceFiles;
  const changedFiles = shouldRunChangedOnly ? [...getChangedFiles()].sort() : [];

  if (shouldRunChangedOnly) {
    const changedSet = new Set(changedFiles);
    targetSourceFiles = allSourceFiles.filter((sourceFile) =>
      changedSet.has(toRelativePath(sourceFile.getFilePath()))
    );
  }

  const files: Record<string, FileRecord> = shouldRunChangedOnly
    ? { ...(existingIndex?.files ?? {}) }
    : {};

  if (shouldRunChangedOnly) {
    for (const filePath of changedFiles) {
      if (!isTargetFile(filePath)) continue;
      const stillExists = allSourceFiles.some((sourceFile) => toRelativePath(sourceFile.getFilePath()) === filePath);
      if (!stillExists) delete files[filePath];
    }
  }

  for (const sourceFile of targetSourceFiles) {
    const filePath = toRelativePath(sourceFile.getFilePath());
    files[filePath] = collectFileRecord(sourceFile, dependsOn, usedBy);
  }

  if (shouldRunChangedOnly) {
    for (const [filePath, record] of Object.entries(files)) {
      record.dependsOn = [...(dependsOn.get(filePath) ?? [])].sort();
      record.usedBy = [...(usedBy.get(filePath) ?? [])].sort();
    }
  }

  const output: IndexData = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    projectRoot: ROOT,
    changedOnly: shouldRunChangedOnly,
    files,
    meta: {
      totalFiles: totalFileCount,
      parsedFiles: targetSourceFiles.length,
      skippedFiles: Math.max(0, totalFileCount - targetSourceFiles.length),
      changedFiles,
    },
  };

  mkdirSync(dirname(outAbsolutePath), { recursive: true });
  writeFileSync(outAbsolutePath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`🧑‍🎨 : Index written to ${options.out}`);
  console.log(
    `🧑‍🎨 : Total ${output.meta.totalFiles}, parsed ${output.meta.parsedFiles}, skipped ${output.meta.skippedFiles}`
  );
};

main();

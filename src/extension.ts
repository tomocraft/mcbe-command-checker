import * as vscode from 'vscode';
import { getCommandSyntax, validateCommand } from './validator';
import { BuiltinType, CommandDef, DiagnosticSeverity, ParamCategory, ParameterDef } from './types';
import { Edition, getAllCommands, getCommandMap, setEdition } from './commandData';
import { setCurrentLocale, t } from './i18n';

const COLLECTION_NAME = 'mcbe-command-checker';
const VALIDATE_COMMAND_ID = 'mcbeCommandChecker.validateSelectionOrFile';
const LEGACY_CONFIG_SECTION = 'mcfunctionCommandChecker';
const CONFIG_SECTION = 'mcbeCommandChecker';
const DEFAULT_INCLUDE_FILE_PATTERNS = ['**/*.mcfunction'];
const MAX_HINT_SYNTAX_VARIANTS = 3;
let targetSelector: vscode.DocumentSelector = buildFilePatternSelector(DEFAULT_INCLUDE_FILE_PATTERNS);

const SELECTOR_TYPES = ['@a', '@e', '@p', '@r', '@s', '@initiator'];
const SELECTOR_ARGS = [
  'name', 'type', 'family', 'x', 'y', 'z', 'dx', 'dy', 'dz',
  'r', 'rm', 'rx', 'rxm', 'ry', 'rym', 'l', 'lm', 'm',
  'scores', 'tag', 'haspermission', 'has_property', 'hasitem', 'c', 'gamemode',
];

export function activate(context: vscode.ExtensionContext): void {
  applyLocale();
  const diagnosticCollection = vscode.languages.createDiagnosticCollection(COLLECTION_NAME);
  const outputChannel = vscode.window.createOutputChannel('MCBE Command Checker');
  const syntaxHintDecoration = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor('editorCodeLens.foreground'),
      fontStyle: 'italic',
      textDecoration: 'none; font-size: 0.8em; opacity: 0.85;',
      margin: '0 0 0 0',
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  });

  let showSyntaxHints = true;

  const reloadSettings = (): void => {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const legacyConfig = vscode.workspace.getConfiguration(LEGACY_CONFIG_SECTION);
    const edition = config.get<Edition>('edition', legacyConfig.get<Edition>('edition', 'normal'));
    showSyntaxHints = config.get<boolean>('showSyntaxHints', legacyConfig.get<boolean>('showSyntaxHints', true));
    const includeFilePatterns = normalizePatterns(
      config.get<string[]>('includeFilePatterns', legacyConfig.get<string[]>('includeFilePatterns', DEFAULT_INCLUDE_FILE_PATTERNS))
    );
    targetSelector = buildFilePatternSelector(includeFilePatterns);
    setEdition(edition);
  };

  reloadSettings();

  context.subscriptions.push(diagnosticCollection);
  context.subscriptions.push(outputChannel);
  context.subscriptions.push(syntaxHintDecoration);

  const refreshDiagnostics = (document: vscode.TextDocument): void => {
    if (!isTargetDocument(document)) {
      diagnosticCollection.delete(document.uri);
      return;
    }

    const diagnostics: vscode.Diagnostic[] = [];

    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
      const lineText = document.lineAt(lineIndex).text;
      const result = validateCommand(lineText);

      for (const issue of result.diagnostics) {
        const start = clamp(issue.start, 0, lineText.length);
        const end = clamp(issue.end, start + 1, lineText.length + 1);
        const range = new vscode.Range(lineIndex, start, lineIndex, Math.min(end, lineText.length));

        const message = issue.suggestions && issue.suggestions.length > 0
          ? `${issue.message}\n${t('diag.suggestions')} ${issue.suggestions.slice(0, 5).join(', ')}`
          : issue.message;

        diagnostics.push(
          new vscode.Diagnostic(range, message, toVsCodeSeverity(issue.severity))
        );
      }
    }

    diagnosticCollection.set(document.uri, diagnostics);
  };

  const refreshSyntaxHints = (editor: vscode.TextEditor | undefined): void => {
    if (!editor || !isTargetDocument(editor.document)) {
      return;
    }

    if (!showSyntaxHints) {
      editor.setDecorations(syntaxHintDecoration, []);
      return;
    }

    const commandMap = getCommandMap();
    const options: vscode.DecorationOptions[] = [];

    for (let line = 0; line < editor.document.lineCount; line++) {
      const lineText = editor.document.lineAt(line).text;
      const text = lineText.trim();
      if (!text || text.startsWith('#')) {
        continue;
      }

      const token = text.split(/\s+/)[0].replace(/^\//, '').toLowerCase();
      const command = commandMap.get(token);
      if (!command) {
        continue;
      }

      const syntaxHint = buildFocusedSyntaxHint(lineText, command);
      if (!syntaxHint) {
        continue;
      }

      const lineEnd = editor.document.lineAt(line).range.end;
      options.push({
        range: new vscode.Range(lineEnd, lineEnd),
        hoverMessage: syntaxHint.hoverText,
        renderOptions: {
          after: {
            contentText: syntaxHint.inlineText,
          },
        },
      });
    }

    editor.setDecorations(syntaxHintDecoration, options);
  };

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      refreshDiagnostics(document);
      if (vscode.window.activeTextEditor?.document.uri.toString() === document.uri.toString()) {
        refreshSyntaxHints(vscode.window.activeTextEditor);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      refreshDiagnostics(event.document);
      if (vscode.window.activeTextEditor?.document.uri.toString() === event.document.uri.toString()) {
        refreshSyntaxHints(vscode.window.activeTextEditor);
      }
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      refreshDiagnostics(document);
      if (vscode.window.activeTextEditor?.document.uri.toString() === document.uri.toString()) {
        refreshSyntaxHints(vscode.window.activeTextEditor);
      }
    }),
    vscode.workspace.onDidCloseTextDocument((document) => diagnosticCollection.delete(document.uri)),
    vscode.window.onDidChangeActiveTextEditor((editor) => refreshSyntaxHints(editor)),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration(CONFIG_SECTION) && !event.affectsConfiguration(LEGACY_CONFIG_SECTION)) {
        return;
      }
      reloadSettings();
      for (const document of vscode.workspace.textDocuments) {
        refreshDiagnostics(document);
      }
      refreshSyntaxHints(vscode.window.activeTextEditor);
    })
  );

  const completionProvider = vscode.languages.registerCompletionItemProvider(
    [{ scheme: 'file', pattern: '**/*' }, { language: 'mcfunction' }],
    {
      provideCompletionItems(document, position) {
        if (!isTargetDocument(document)) {
          return [];
        }
        return provideMcfunctionCompletions(document, position);
      },
    },
    ' ',
    '[',
    ',',
    '=',
    ':',
    '@'
  );
  context.subscriptions.push(completionProvider);

  const validateCommandDisposable = vscode.commands.registerCommand(VALIDATE_COMMAND_ID, () => {
    validateSelectionOrFile(outputChannel);
  });
  context.subscriptions.push(validateCommandDisposable);

  for (const document of vscode.workspace.textDocuments) {
    refreshDiagnostics(document);
  }
  refreshSyntaxHints(vscode.window.activeTextEditor);
}

export function deactivate(): void {
  // Nothing to clean up manually.
}

function isTargetDocument(document: vscode.TextDocument): boolean {
  if (document.languageId === 'mcfunction') {
    return true;
  }
  return vscode.languages.match(targetSelector, document) > 0;
}

function buildFilePatternSelector(patterns: string[]): vscode.DocumentSelector {
  return patterns.map((pattern) => ({ scheme: 'file', pattern }));
}

function normalizePatterns(patterns: string[]): string[] {
  const cleaned = patterns
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern.length > 0);

  if (cleaned.length === 0) {
    return [...DEFAULT_INCLUDE_FILE_PATTERNS];
  }

  return Array.from(new Set(cleaned));
}

interface SyntaxHintText {
  inlineText: string;
  hoverText: string;
}

function buildFocusedSyntaxHint(lineText: string, command: CommandDef): SyntaxHintText | null {
  const trimmed = lineText.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const args = tokens.slice(1);
  const isAtTokenBoundary = /\s$/.test(lineText);
  const argIndex = isAtTokenBoundary ? args.length : Math.max(0, args.length - 1);
  const currentFragment = isAtTokenBoundary ? '' : args[args.length - 1] ?? '';

  const matchedOverloads = command.overloads.filter((overload) => {
    if (!matchesPreviousArguments(overload.parameters, args, argIndex)) {
      return false;
    }

    const currentParam = overload.parameters[argIndex];
    if (!currentParam || !currentFragment) {
      return true;
    }

    if (currentParam.type.category === ParamCategory.Enum && currentParam.enumValues) {
      return currentParam.enumValues.some((value) => value.toLowerCase().startsWith(currentFragment.toLowerCase()));
    }

    return true;
  });

  const candidateSyntaxes = matchedOverloads.length > 0
    ? matchedOverloads.map((overload) => formatOverloadSyntax(command.name, overload.parameters))
    : getCommandSyntax(command);

  const uniqueSyntaxes = Array.from(new Set(candidateSyntaxes));
  if (uniqueSyntaxes.length === 0) {
    return null;
  }

  const shown = uniqueSyntaxes.slice(0, MAX_HINT_SYNTAX_VARIANTS);
  const remainingCount = uniqueSyntaxes.length - shown.length;
  const suffix = remainingCount > 0 ? `  ... +${remainingCount}` : '';

  return {
    inlineText: `  ${shown.join('  |  ')}${suffix}`,
    hoverText: uniqueSyntaxes.join('\n'),
  };
}

function formatOverloadSyntax(commandName: string, params: ParameterDef[]): string {
  const paramSyntax = params.map((param) => formatParameterSyntax(param)).join(' ');
  return paramSyntax.length > 0 ? `/${commandName} ${paramSyntax}` : `/${commandName}`;
}

function formatParameterSyntax(param: ParameterDef): string {
  const token = summarizeParameterToken(param);
  return param.optional ? `[${token}]` : `<${token}>`;
}

function summarizeParameterToken(param: ParameterDef): string {
  if (param.type.category === ParamCategory.Enum && param.enumValues && param.enumValues.length > 0) {
    const limited = param.enumValues.slice(0, 3).join('|');
    return param.enumValues.length > 3 ? `${limited}|...` : limited;
  }

  return param.name || param.typeName;
}

function toVsCodeSeverity(severity: DiagnosticSeverity): vscode.DiagnosticSeverity {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return vscode.DiagnosticSeverity.Error;
    case DiagnosticSeverity.Warning:
      return vscode.DiagnosticSeverity.Warning;
    case DiagnosticSeverity.Info:
      return vscode.DiagnosticSeverity.Information;
    default:
      return vscode.DiagnosticSeverity.Error;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function provideMcfunctionCompletions(
  document: vscode.TextDocument,
  position: vscode.Position
): vscode.CompletionItem[] {
  const commandMap = getCommandMap();
  const allCommands = getAllCommands();
  const line = document.lineAt(position.line).text;
  const prefix = line.slice(0, position.character);
  const selectorContext = getSelectorCompletionContext(document, position, prefix);

  if (selectorContext) {
    return provideSelectorCompletions(selectorContext);
  }

  if (!prefix.trim() || prefix.trimStart().startsWith('#')) {
    return buildCommandItems(allCommands, '', currentWordRange(document, position, ''));
  }

  const tokens = prefix.trimStart().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return buildCommandItems(allCommands, '', currentWordRange(document, position, ''));
  }

  const isAtTokenBoundary = /\s$/.test(prefix);
  const firstToken = tokens[0].startsWith('/') ? tokens[0].slice(1) : tokens[0];

  // Completing the command itself.
  if (tokens.length === 1 && !isAtTokenBoundary) {
    const range = currentWordRange(document, position, tokens[0]);
    return buildCommandItems(allCommands, firstToken.toLowerCase(), range);
  }

  const command = commandMap.get(firstToken.toLowerCase());
  if (!command) {
    const range = currentWordRange(document, position, tokens[0]);
    return buildCommandItems(allCommands, firstToken.toLowerCase(), range);
  }

  const args = tokens.slice(1);
  const argIndex = isAtTokenBoundary ? args.length : Math.max(0, args.length - 1);
  const currentFragment = isAtTokenBoundary ? '' : args[args.length - 1] || '';
  const range = currentWordRange(document, position, currentFragment);

  return buildParameterItems(command, args, argIndex, currentFragment, range);
}

function buildCommandItems(
  allCommands: CommandDef[],
  fragment: string,
  range: vscode.Range
): vscode.CompletionItem[] {
  const seen = new Set<string>();
  return allCommands
    .map((cmd) => cmd.name)
    .filter((name) => {
      if (seen.has(name)) return false;
      seen.add(name);
      return name.startsWith(fragment);
    })
    .slice(0, 50)
    .map((name, idx) => {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
      item.insertText = name;
      item.range = range;
      item.detail = 'Minecraft command';
      item.sortText = `0_${String(idx).padStart(3, '0')}_${name}`;
      return item;
    });
}

function buildParameterItems(
  command: CommandDef,
  args: string[],
  argIndex: number,
  fragment: string,
  range: vscode.Range
): vscode.CompletionItem[] {
  const candidates = new Map<string, vscode.CompletionItem>();

  for (const overload of command.overloads) {
    if (!matchesPreviousArguments(overload.parameters, args, argIndex)) {
      continue;
    }
    const param = overload.parameters[argIndex];
    if (!param) {
      continue;
    }

    for (const value of suggestValuesForParam(param)) {
      if (!value.toLowerCase().startsWith(fragment.toLowerCase())) {
        continue;
      }
      if (candidates.has(value)) {
        continue;
      }
      const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Value);
      item.insertText = value;
      item.range = range;
      item.detail = `${command.name} ${param.name}`;
      candidates.set(value, item);
    }
  }

  return Array.from(candidates.values()).slice(0, 50);
}

function matchesPreviousArguments(params: ParameterDef[], args: string[], argIndex: number): boolean {
  for (let i = 0; i < argIndex && i < args.length; i++) {
    const param = params[i];
    const value = args[i];
    if (!param || !value) {
      continue;
    }
    if (param.type.category === ParamCategory.Enum && param.enumValues) {
      const ok = param.enumValues.some((enumValue) => enumValue.toLowerCase() === value.toLowerCase());
      if (!ok) {
        return false;
      }
    }
  }
  return true;
}

function suggestValuesForParam(param: ParameterDef): string[] {
  if (param.type.category === ParamCategory.Enum && param.enumValues) {
    return param.enumValues;
  }

  if (param.type.category === ParamCategory.Builtin) {
    switch (param.type.index) {
      case BuiltinType.Target:
        return SELECTOR_TYPES;
      case BuiltinType.CompareOperator:
        return ['<', '>', '<=', '>=', '='];
      case BuiltinType.Operator:
        return ['=', '+=', '-=', '*=', '/=', '%=', '><'];
      default:
        return [];
    }
  }

  return [];
}

function currentWordRange(document: vscode.TextDocument, position: vscode.Position, fragment: string): vscode.Range {
  const startCharacter = Math.max(0, position.character - fragment.length);
  return new vscode.Range(position.line, startCharacter, position.line, position.character);
}

interface SelectorCompletionContext {
  mode: 'selector' | 'selectorArgKey' | 'selectorArgValue';
  key?: string;
  fragment: string;
  range: vscode.Range;
}

function getSelectorCompletionContext(
  document: vscode.TextDocument,
  position: vscode.Position,
  prefix: string
): SelectorCompletionContext | null {
  const tokenStart = Math.max(prefix.lastIndexOf(' '), prefix.lastIndexOf('\t')) + 1;
  const token = prefix.slice(tokenStart);
  if (!token.startsWith('@')) {
    return null;
  }

  const openBracket = token.indexOf('[');
  const closeBracket = token.lastIndexOf(']');
  if (openBracket === -1 || closeBracket > openBracket) {
    return {
      mode: 'selector',
      fragment: token,
      range: currentWordRange(document, position, token),
    };
  }

  const inside = token.slice(openBracket + 1);
  const segment = inside.split(',').pop() ?? '';
  const eqIndex = segment.indexOf('=');
  if (eqIndex === -1) {
    const keyFragment = segment.trim();
    return {
      mode: 'selectorArgKey',
      fragment: keyFragment,
      range: currentWordRange(document, position, keyFragment),
    };
  }

  const rawKey = segment.slice(0, eqIndex).trim();
  const valueFragment = segment.slice(eqIndex + 1).trimStart();
  return {
    mode: 'selectorArgValue',
    key: rawKey.replace(/^!/, ''),
    fragment: valueFragment,
    range: currentWordRange(document, position, valueFragment),
  };
}

function provideSelectorCompletions(context: SelectorCompletionContext): vscode.CompletionItem[] {
  if (context.mode === 'selector') {
    return SELECTOR_TYPES
      .filter((value) => value.toLowerCase().startsWith(context.fragment.toLowerCase()))
      .map((value) => {
        const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Variable);
        item.range = context.range;
        item.insertText = value;
        item.detail = 'Selector';
        return item;
      });
  }

  if (context.mode === 'selectorArgKey') {
    const normalized = context.fragment.replace(/^!/, '').toLowerCase();
    return SELECTOR_ARGS
      .filter((arg) => arg.toLowerCase().startsWith(normalized))
      .map((arg) => {
        const item = new vscode.CompletionItem(`${arg}=`, vscode.CompletionItemKind.Field);
        item.range = context.range;
        item.insertText = `${arg}=`;
        item.detail = 'Selector argument';
        return item;
      });
  }

  const values = selectorArgumentValues(context.key);
  return values
    .filter((value) => value.toLowerCase().startsWith(context.fragment.toLowerCase()))
    .map((value) => {
      const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Value);
      item.range = context.range;
      item.insertText = value;
      item.detail = `Selector ${context.key ?? ''}`.trim();
      return item;
    });
}

function selectorArgumentValues(key?: string): string[] {
  switch ((key ?? '').toLowerCase()) {
    case 'gamemode':
    case 'm':
      return ['survival', 'creative', 'adventure', 'spectator'];
    case 'haspermission':
      return ['{camera=enabled}', '{movement=enabled}', '{operator_commands=enabled}'];
    case 'type':
      return ['player', 'zombie', 'skeleton', 'item'];
    case 'scores':
      return ['{objective=1..}', '{objective=..10}'];
    case 'tag':
      return ['builder', 'admin'];
    case 'c':
      return ['1', '-1'];
    default:
      return [];
  }
}

function validateSelectionOrFile(outputChannel: vscode.OutputChannel): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage(localizedText('openMcfunctionFirst'));
    return;
  }

  const hasSelection = !editor.selection.isEmpty;
  const startLine = hasSelection ? editor.selection.start.line : 0;
  const selectedText = hasSelection ? editor.document.getText(editor.selection) : editor.document.getText();
  const lines = selectedText.split(/\r?\n/);

  let errorCount = 0;
  let warningCount = 0;

  outputChannel.clear();
  outputChannel.appendLine(localizedText('validationStarted'));

  lines.forEach((line, idx) => {
    const result = validateCommand(line);
    for (const issue of result.diagnostics) {
      if (issue.severity === DiagnosticSeverity.Error) errorCount++;
      if (issue.severity === DiagnosticSeverity.Warning) warningCount++;
      outputChannel.appendLine(localizedText('validationLineMessage', startLine + idx + 1, issue.message));
    }
  });

  const summary = localizedText('validationSummary', errorCount, warningCount);
  outputChannel.appendLine(summary);
  outputChannel.show(true);

  if (errorCount > 0) {
    vscode.window.showWarningMessage(summary);
  } else {
    vscode.window.showInformationMessage(summary);
  }
}

function applyLocale(): void {
  setCurrentLocale(vscode.env.language.toLowerCase());
}

function localizedText(key: string, ...args: Array<string | number>): string {
  const isJa = vscode.env.language.toLowerCase().startsWith('ja');
  const ja: Record<string, string> = {
    openMcfunctionFirst: '対象ファイルを開いてください（設定: mcbeCommandChecker.includeFilePatterns）',
    validationStarted: 'コマンド検証を開始します',
    validationSummary: '検証完了: エラー {0} 件, 警告 {1} 件',
    validationLineMessage: '{0}行目: {1}',
  };
  const en: Record<string, string> = {
    openMcfunctionFirst: 'Open a target file first (setting: mcbeCommandChecker.includeFilePatterns).',
    validationStarted: 'Starting command validation.',
    validationSummary: 'Validation complete: {0} error(s), {1} warning(s)',
    validationLineMessage: 'Line {0}: {1}',
  };
  const table = isJa ? ja : en;
  let text = table[key] ?? key;
  args.forEach((value, i) => {
    text = text.replace(`{${i}}`, String(value));
  });
  return text;
}

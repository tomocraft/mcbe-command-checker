import {
  Token,
  TokenType,
  Diagnostic,
  DiagnosticSeverity,
  ValidationResult,
  CommandDef,
  OverloadDef,
  ParameterDef,
  ParamCategory,
  BuiltinType,
} from './types';
import { tokenize } from './tokenizer';
import { getCommandMap, getAllCommands, getAllowCustomItems } from './commandData';
import { t } from './i18n';

// ========================================
// Minecraft Bedrock Edition Command Validator
// ========================================

const MAX_CHAIN_DEPTH = 20;

/**
 * Validates a single command line.
 */
export function validateCommand(input: string): ValidationResult {
  const trimmed = input.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return { tokens: [], diagnostics: [], isValid: true };
  }

  const tokens = tokenize(trimmed);
  const diagnostics: Diagnostic[] = [];

  if (tokens.length === 0) {
    return { tokens, diagnostics, isValid: true };
  }

  const commandMap = getCommandMap();
  const cmdToken = tokens[0];
  const cmdName = cmdToken.value.toLowerCase();

  // Look up the command
  const commandDef = commandMap.get(cmdName);
  if (!commandDef) {
    const suggestions = findSimilarCommands(cmdName);
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      message: t('val.unknownCommand', cmdToken.value),
      start: cmdToken.start,
      end: cmdToken.end,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    });
    return { tokens, diagnostics, isValid: false };
  }

  // Additional validation: selector arguments
  for (const token of tokens) {
    if (token.type === TokenType.Selector) {
      const selectorDiags = validateSelector(token);
      diagnostics.push(...selectorDiags);
    }
  }

  // Validate parameters against overloads
  const paramTokens = tokens.slice(1);
  const result = validateOverloads(commandDef, paramTokens, tokens, 0);

  // Additional coordinate mixing check
  const coordDiags = validateCoordinateMixing(tokens);
  diagnostics.push(...coordDiags);

  const allDiags = [...diagnostics, ...result.diagnostics];

  return {
    tokens,
    diagnostics: allDiags,
    matchedCommand: commandDef,
    matchedOverload: result.matchedOverload,
    isValid: allDiags.filter(d => d.severity === DiagnosticSeverity.Error).length === 0,
  };
}

/**
 * Validates multiple lines of commands.
 */
export function validateMultipleCommands(input: string): ValidationResult[] {
  const lines = input.split('\n');
  return lines.map((line) => validateCommand(line));
}

// ===============================
// Selector Validation
// ===============================

const VALID_SELECTOR_ARGS = new Set([
  'name', 'type', 'family', 'x', 'y', 'z', 'dx', 'dy', 'dz',
  'r', 'rm', 'rx', 'rxm', 'ry', 'rym', 'l', 'lm', 'm',
  'scores', 'tag', 'haspermission', 'has_property',
  'hasitem', 'c', 'gamemode',
]);

const VALID_SELECTOR_TYPES = new Set(['a', 'e', 'p', 'r', 's', 'initiator']);

function validateSelector(token: Token): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const val = token.value;

  // Check the selector type
  if (val.length < 2 || val[0] !== '@') {
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      message: t('sel.required'),
      start: token.start,
      end: token.end,
    });
    return diagnostics;
  }

  // Extract selector type
  let typeEnd = 2;
  if (val.substring(1, 10) === 'initiator') {
    typeEnd = 10;
  }
  const selectorType = val.substring(1, typeEnd);
  
  if (!VALID_SELECTOR_TYPES.has(selectorType)) {
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      message: t('sel.unknownType', selectorType),
      start: token.start,
      end: token.start + typeEnd,
    });
  }

  // Parse selector arguments
  const bracketStart = val.indexOf('[');
  if (bracketStart !== -1) {
    const bracketEnd = val.lastIndexOf(']');
    if (bracketEnd === -1) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        message: t('sel.unclosed'),
        start: token.start + bracketStart,
        end: token.end,
      });
    } else {
      const argsStr = val.substring(bracketStart + 1, bracketEnd);
      if (argsStr.trim()) {
        const argDiags = validateSelectorArgs(argsStr, token.start + bracketStart + 1);
        diagnostics.push(...argDiags);
      }
    }
  }

  return diagnostics;
}

function validateSelectorArgs(argsStr: string, baseOffset: number): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  
  // Simple key=value pair parsing
  // Handle nested structures: scores={...}, hasitem={...}
  let pos = 0;
  while (pos < argsStr.length) {
    // Skip whitespace
    while (pos < argsStr.length && (argsStr[pos] === ' ' || argsStr[pos] === ',')) pos++;
    if (pos >= argsStr.length) break;

    // Read key
    const keyStart = pos;
    while (pos < argsStr.length && argsStr[pos] !== '=' && argsStr[pos] !== ',' && argsStr[pos] !== ']') pos++;
    const key = argsStr.substring(keyStart, pos).trim();

    if (!key) break;

    // Check for negation prefix (!)
    const cleanKey = key.startsWith('!') ? key.substring(1) : key;

    if (cleanKey && !VALID_SELECTOR_ARGS.has(cleanKey)) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        message: t('sel.unknownArg', cleanKey),
        start: baseOffset + keyStart,
        end: baseOffset + pos,
      });
    }

    // Skip = and value
    if (pos < argsStr.length && argsStr[pos] === '=') {
      pos++; // skip =
      // Handle nested braces/brackets in values
      if (pos < argsStr.length && (argsStr[pos] === '{' || argsStr[pos] === '[')) {
        pos = skipNestedBraces(argsStr, pos);
      } else {
        // Regular value
        const negated = pos < argsStr.length && argsStr[pos] === '!';
        if (negated) pos++;
        while (pos < argsStr.length && argsStr[pos] !== ',' && argsStr[pos] !== ']') pos++;
      }
    }
  }

  return diagnostics;
}

function skipNestedBraces(str: string, pos: number): number {
  const open = str[pos];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  while (pos < str.length) {
    if (str[pos] === open) depth++;
    else if (str[pos] === close) {
      depth--;
      if (depth === 0) return pos + 1;
    }
    pos++;
  }
  return pos;
}

// ===============================
// Coordinate Mixing Validation  
// ===============================

function validateCoordinateMixing(tokens: Token[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Find groups of 3 consecutive coordinate-like tokens
  for (let i = 0; i < tokens.length - 2; i++) {
    const t1 = tokens[i], t2 = tokens[i + 1], t3 = tokens[i + 2];
    const isCoord1 = isCoordinateToken(t1);
    const isCoord2 = isCoordinateToken(t2);
    const isCoord3 = isCoordinateToken(t3);

    if (isCoord1 && isCoord2 && isCoord3) {
      const hasRelative = [t1, t2, t3].some(tk => tk.type === TokenType.RelativeValue);
      const hasLocal = [t1, t2, t3].some(tk => tk.type === TokenType.LocalValue);

      if (hasRelative && hasLocal) {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          message: t('coord.mixing'),
          start: t1.start,
          end: t3.end,
        });
      }
      i += 2; // Skip this coord group
    }
  }

  return diagnostics;
}

function isCoordinateToken(token: Token): boolean {
  return (
    token.type === TokenType.RelativeValue ||
    token.type === TokenType.LocalValue ||
    token.type === TokenType.Number ||
    token.type === TokenType.Float
  );
}

// ===============================
// Overload Matching
// ===============================

interface OverloadMatchResult {
  diagnostics: Diagnostic[];
  matchedOverload?: OverloadDef;
}

function validateOverloads(
  command: CommandDef,
  paramTokens: Token[],
  allTokens: Token[],
  depth: number
): OverloadMatchResult {
  if (depth > MAX_CHAIN_DEPTH) {
    return { diagnostics: [] };
  }

  if (command.overloads.length === 0) {
    if (paramTokens.length > 0) {
      return {
        diagnostics: [{
          severity: DiagnosticSeverity.Error,
          message: t('val.noParams', command.name),
          start: paramTokens[0].start,
          end: paramTokens[paramTokens.length - 1].end,
        }],
      };
    }
    return { diagnostics: [] };
  }

  // Try each overload and collect match quality
  let bestScore = -1;
  const tiedMatches: { overload: OverloadDef; diagnostics: Diagnostic[]; score: number; failedParam?: ParameterDef }[] = [];

  for (const overload of command.overloads) {
    const result = tryMatchOverload(command, overload, paramTokens, depth);
    // Perfect match — return immediately
    if (result.score === Infinity) {
      return { diagnostics: [], matchedOverload: overload };
    }
    if (result.score > bestScore) {
      bestScore = result.score;
      tiedMatches.length = 0;
      tiedMatches.push({ overload, diagnostics: result.diagnostics, score: result.score, failedParam: result.failedParam });
    } else if (result.score === bestScore) {
      tiedMatches.push({ overload, diagnostics: result.diagnostics, score: result.score, failedParam: result.failedParam });
    }
  }

  if (tiedMatches.length > 1 && bestScore > 0) {
    // Multiple overloads tied at the same score — merge expected values
    const failedToken = tiedMatches[0].diagnostics[0];
    const expectedOptions: string[] = [];
    const allSuggestions: string[] = [];

    for (const m of tiedMatches) {
      const fp = m.failedParam;
      if (fp) {
        if (fp.enumValues && fp.enumValues.length <= 20) {
          expectedOptions.push(`${fp.name} (${fp.enumValues.join(', ')})`);
          allSuggestions.push(...fp.enumValues);
        } else if (fp.type.category === ParamCategory.Builtin) {
          expectedOptions.push(`${fp.name}: ${getBuiltinExpectedDescription(fp.type.index)}`);
        } else {
          expectedOptions.push(`${fp.name}: ${fp.typeName}`);
        }
      }
    }

    if (expectedOptions.length > 0 && failedToken) {
      // Get the actual token value from the first diagnostic
      const tokenValue = paramTokens[Math.floor(bestScore / 10)]?.value ?? '';
      const uniqueSuggestions = [...new Set(allSuggestions)];
      return {
        diagnostics: [{
          severity: DiagnosticSeverity.Error,
          message: t('val.paramErrorMulti', expectedOptions.join(' / '), tokenValue),
          start: failedToken.start,
          end: failedToken.end,
          suggestions: uniqueSuggestions.length > 0 ? uniqueSuggestions.slice(0, 10) : undefined,
        }],
        matchedOverload: tiedMatches[0].overload,
      };
    }
  }

  if (tiedMatches.length > 0 && bestScore > 0) {
    return {
      diagnostics: tiedMatches[0].diagnostics,
      matchedOverload: tiedMatches[0].overload,
    };
  }

  // No overloads matched
  const usageStr = formatOverloads(command);
  return {
    diagnostics: [{
      severity: DiagnosticSeverity.Error,
      message: t('val.syntaxError', command.name, usageStr),
      start: allTokens[0].start,
      end: allTokens[allTokens.length - 1].end,
    }],
  };
}

interface MatchResult {
  diagnostics: Diagnostic[];
  score: number;
  failedParam?: ParameterDef;
}

function tryMatchOverload(
  command: CommandDef,
  overload: OverloadDef,
  paramTokens: Token[],
  depth: number
): MatchResult {
  const diagnostics: Diagnostic[] = [];
  const params = overload.parameters;
  let tokenIdx = 0;
  let paramIdx = 0;
  let matchScore = 0;
  let chainTerminated = false; // true when a Command or ChainedCommand consumed remaining tokens

  while (paramIdx < params.length) {
    const param = params[paramIdx];

    if (tokenIdx >= paramTokens.length) {
      // No more tokens, check if remaining params are optional
      if (!param.optional) {
        // Special message for ChainedCommand (execute chain incomplete)
        if (param.type.category === ParamCategory.ChainedCommand) {
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            message: t('val.executeIncomplete'),
            start: paramTokens.length > 0 ? paramTokens[paramTokens.length - 1].end : 0,
            end: paramTokens.length > 0 ? paramTokens[paramTokens.length - 1].end + 1 : 1,
          });
        } else {
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            message: t('val.missingParam', param.name, getTypeDisplayName(param)),
            start: paramTokens.length > 0 ? paramTokens[paramTokens.length - 1].end : 0,
            end: paramTokens.length > 0 ? paramTokens[paramTokens.length - 1].end + 1 : 1,
          });
        }
        return { diagnostics, score: matchScore };
      }
      paramIdx++;
      continue;
    }

    const token = paramTokens[tokenIdx];

    // ===== Special: ChainedCommand → recursive chain validation =====
    if (param.type.category === ParamCategory.ChainedCommand) {
      const remainingTokens = paramTokens.slice(tokenIdx);
      const chainResult = validateOverloads(command, remainingTokens, remainingTokens, depth + 1);
      if (chainResult.diagnostics.length > 0) {
        diagnostics.push(...chainResult.diagnostics);
        return { diagnostics, score: matchScore };
      }
      matchScore += remainingTokens.length * 10;
      tokenIdx = paramTokens.length;
      chainTerminated = true;
      paramIdx++;
      continue;
    }

    // ===== Special: BuiltinType.Command → validate inner command =====
    if (param.type.category === ParamCategory.Builtin && param.type.index === BuiltinType.Command) {
      const remainingTokens = paramTokens.slice(tokenIdx);
      const innerResult = validateInnerCommand(remainingTokens);
      diagnostics.push(...innerResult.diagnostics);
      matchScore += remainingTokens.length * 10;
      tokenIdx = paramTokens.length;
      chainTerminated = true;
      paramIdx++;
      continue;
    }

    // Try to match this parameter
    const consumed = tryMatchParam(param, paramTokens, tokenIdx, diagnostics);
    if (consumed > 0) {
      matchScore += consumed * 10;
      tokenIdx += consumed;
      paramIdx++;
    } else if (consumed === 0) {
      // No match
      if (param.optional) {
        paramIdx++;
        continue;
      }
      // Required param failed — return with error score
      diagnostics.push(getParamError(param, token));
      return { diagnostics, score: matchScore, failedParam: param };
    } else {
      return { diagnostics, score: matchScore };
    }
  }

  // Check for extra tokens
  if (tokenIdx < paramTokens.length) {
    // Check if this is a chaining overload (execute)
    if (overload.chaining) {
      // Recursively validate remaining tokens as the next subcommand in the chain
      const remainingTokens = paramTokens.slice(tokenIdx);
      const chainResult = validateOverloads(command, remainingTokens, remainingTokens, depth + 1);
      if (chainResult.diagnostics.length > 0) {
        diagnostics.push(...chainResult.diagnostics);
        return { diagnostics, score: matchScore };
      }
      matchScore += remainingTokens.length * 10;
    } else {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        message: t('val.extraParams', paramTokens.slice(tokenIdx).map(tk => tk.value).join(' ')),
        start: paramTokens[tokenIdx].start,
        end: paramTokens[paramTokens.length - 1].end,
      });
      return { diagnostics, score: matchScore };
    }
  } else if (overload.chaining && !chainTerminated) {
    // All params consumed but the overload is a chain segment → incomplete
    // (skip this check if a Command/ChainedCommand param already terminated the chain)
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      message: t('val.executeIncomplete'),
      start: paramTokens.length > 0 ? paramTokens[paramTokens.length - 1].end : 0,
      end: paramTokens.length > 0 ? paramTokens[paramTokens.length - 1].end + 1 : 1,
    });
    return { diagnostics, score: matchScore };
  }

  if (diagnostics.length === 0) {
    return { diagnostics: [], score: Infinity };
  }

  return { diagnostics, score: matchScore };
}

/**
 * Validate an inner command (used after "run" in execute chains).
 * Treats the remaining tokens as a full command (name + params).
 */
function validateInnerCommand(tokens: Token[]): { diagnostics: Diagnostic[] } {
  if (tokens.length === 0) {
    return { diagnostics: [] };
  }

  const commandMap = getCommandMap();
  const cmdToken = tokens[0];
  const cmdName = cmdToken.value.toLowerCase();

  const commandDef = commandMap.get(cmdName);
  if (!commandDef) {
    const suggestions = findSimilarCommands(cmdName);
    return {
      diagnostics: [{
        severity: DiagnosticSeverity.Error,
        message: t('val.innerUnknownCommand', cmdToken.value),
        start: cmdToken.start,
        end: cmdToken.end,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      }],
    };
  }

  const paramTokens = tokens.slice(1);
  const result = validateOverloads(commandDef, paramTokens, tokens, 0);
  return { diagnostics: result.diagnostics };
}

/**
 * Match a parameter definition against token(s).
 * Returns number of tokens consumed (0 = no match, >0 = success).
 */
function tryMatchParam(
  param: ParameterDef,
  tokens: Token[],
  startIdx: number,
  diagnostics: Diagnostic[]
): number {
  const token = tokens[startIdx];
  const { category, index } = param.type;

  switch (category) {
    case ParamCategory.Builtin:
      return matchBuiltinType(index, param, tokens, startIdx, diagnostics);

    case ParamCategory.Enum:
      return matchEnumParam(param, token);

    case ParamCategory.DynamicEnum:
      return matchDynamicEnumParam(param, token);

    case ParamCategory.Postfix:
      return matchPostfixParam(token);

    case ParamCategory.ChainedCommand:
      // Handled specially in tryMatchOverload — should not reach here
      return tokens.length - startIdx;

    default:
      return 1;
  }
}

// ===============================
// Builtin Type Matching
// ===============================

function matchBuiltinType(
  builtinId: number,
  param: ParameterDef,
  tokens: Token[],
  startIdx: number,
  _diagnostics: Diagnostic[]
): number {
  const token = tokens[startIdx];

  switch (builtinId) {
    case BuiltinType.Int:
      return matchInt(token) ? 1 : 0;

    case BuiltinType.Float:
      return matchFloat(token) ? 1 : 0;

    case BuiltinType.Val:
      return matchVal(token) ? 1 : 0;

    case BuiltinType.WildcardInt:
      return matchWildcardInt(token) ? 1 : 0;

    case BuiltinType.Operator:
      return matchOperator(token) ? 1 : 0;

    case BuiltinType.CompareOperator:
      return matchCompareOperator(token) ? 1 : 0;

    case BuiltinType.Target:
      return matchTarget(token) ? 1 : 0;

    case BuiltinType.FilePath:
      return matchFilePath(token) ? 1 : 0;

    case BuiltinType.IntRange:
      return matchIntRange(token) ? 1 : 0;

    case BuiltinType.String:
      return 1; // Accepts any token

    case BuiltinType.BlockPosition:
      return matchBlockPosition(tokens, startIdx);

    case BuiltinType.Position:
      return matchPosition(tokens, startIdx);

    case BuiltinType.Message:
      return tokens.length - startIdx; // Consumes all remaining

    case BuiltinType.RawText:
      return 1;

    case BuiltinType.JSON:
      return matchJSON(token) ? 1 : 0;

    case BuiltinType.BlockStates:
      return matchBlockStates(token) ? 1 : 0;

    case BuiltinType.Command:
      // Handled specially in tryMatchOverload — should not reach here
      return tokens.length - startIdx;

    default:
      return 1;
  }
}

// ---- Individual type matchers ----

function matchInt(token: Token): boolean {
  if (token.type === TokenType.Number) return true;
  if (token.type === TokenType.String && /^[+-]?\d+$/.test(token.value)) return true;
  return false;
}

function matchFloat(token: Token): boolean {
  if (token.type === TokenType.Float || token.type === TokenType.Number) return true;
  if (token.type === TokenType.String && /^[+-]?\d+(\.\d+)?$/.test(token.value)) return true;
  return false;
}

function matchVal(token: Token): boolean {
  if (token.type === TokenType.RelativeValue || token.type === TokenType.LocalValue) return true;
  if (matchFloat(token)) return true;
  return false;
}

function matchWildcardInt(token: Token): boolean {
  if (token.type === TokenType.WildcardInt) return true;
  if (matchInt(token)) return true;
  if (token.value === '*') return true;
  return false;
}

function matchOperator(token: Token): boolean {
  const validOps = ['+=', '-=', '*=', '/=', '%=', '><', '>', '<', '='];
  return (token.type === TokenType.Operator || token.type === TokenType.String) && validOps.includes(token.value);
}

function matchCompareOperator(token: Token): boolean {
  const validOps = ['<', '>', '<=', '>=', '='];
  return (token.type === TokenType.Operator || token.type === TokenType.String) && validOps.includes(token.value);
}

function matchTarget(token: Token): boolean {
  if (token.type === TokenType.Selector) return true;
  // Allow * (WildcardInt) as target — used in scoreboard players commands
  if (token.type === TokenType.WildcardInt && token.value === '*') return true;
  if (token.type === TokenType.String || token.type === TokenType.QuotedString) {
    return token.value.length > 0;
  }
  return false;
}

function matchFilePath(token: Token): boolean {
  return token.type === TokenType.String || token.type === TokenType.QuotedString;
}

function matchIntRange(token: Token): boolean {
  if (token.type === TokenType.IntRange) return true;
  if (token.type === TokenType.String && /^-?\d*\.\.-?\d*$/.test(token.value) && token.value !== '..') return true;
  if (matchInt(token)) return true;
  return false;
}

function matchBlockPosition(tokens: Token[], startIdx: number): number {
  if (startIdx + 2 >= tokens.length) return 0;
  for (let i = 0; i < 3; i++) {
    const tk = tokens[startIdx + i];
    if (tk.type === TokenType.RelativeValue || tk.type === TokenType.LocalValue) continue;
    if (matchInt(tk)) continue;
    return 0;
  }
  return 3;
}

function matchPosition(tokens: Token[], startIdx: number): number {
  if (startIdx + 2 >= tokens.length) return 0;
  for (let i = 0; i < 3; i++) {
    const tk = tokens[startIdx + i];
    if (!matchVal(tk)) return 0;
  }
  return 3;
}

function matchJSON(token: Token): boolean {
  const raw = token.value.trim();
  if (!raw) return false;

  try {
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
}

function matchBlockStates(token: Token): boolean {
  if (token.type === TokenType.BlockState) return true;
  if (token.value.startsWith('[') && token.value.endsWith(']')) return true;
  return false;
}

// ---- Enum matching ----

function matchEnumParam(param: ParameterDef, token: Token): number {
  if (!param.enumValues || param.enumValues.length === 0) return 1;
  const tokenVal = token.value.toLowerCase();
  const enumValues = param.enumValues.map(v => v.toLowerCase());

  if (enumValues.includes(tokenVal)) return 1;

  // When custom items mode is on, accept any namespaced identifier (contains ':')
  // for large enums (items, blocks, entities, etc.) — not subcommand keywords
  if (getAllowCustomItems() && param.enumValues.length > 2 && token.value.includes(':')) {
    return 1;
  }

  // For single-value enum (subcommand keywords), strict match required
  if (param.enumValues.length <= 2) return 0;

  // For larger enums, also no match
  return 0;
}

function matchDynamicEnumParam(_param: ParameterDef, _token: Token): number {
  // Accept any string for dynamic enums (server-side data can change)
  return 1;
}

function matchPostfixParam(token: Token): number {
  if (/^\d+[tsdl]?$/i.test(token.value)) return 1;
  if (matchInt(token)) return 1;
  return 0;
}

// ===============================
// Error Messages
// ===============================

function getTypeDisplayName(param: ParameterDef): string {
  const { category, index } = param.type;
  if (category === ParamCategory.Builtin) {
    const descriptions: Record<number, string> = {
      [BuiltinType.Int]: 'int',
      [BuiltinType.Float]: 'float',
      [BuiltinType.Val]: 'value (~, ^)',
      [BuiltinType.WildcardInt]: 'int|*',
      [BuiltinType.Operator]: 'operator',
      [BuiltinType.CompareOperator]: 'compare op',
      [BuiltinType.Target]: 'target',
      [BuiltinType.FilePath]: 'filepath',
      [BuiltinType.IntRange]: 'int range',
      [BuiltinType.String]: 'string',
      [BuiltinType.BlockPosition]: 'x y z (int)',
      [BuiltinType.Position]: 'x y z',
      [BuiltinType.Message]: 'message',
      [BuiltinType.JSON]: 'json',
      [BuiltinType.BlockStates]: 'block states',
      [BuiltinType.Command]: 'command',
    };
    return descriptions[index] || param.typeName;
  }
  return param.typeName;
}

function getParamError(param: ParameterDef, token: Token): Diagnostic {
  const { category } = param.type;

  let expectedDesc = '';
  let suggestions: string[] | undefined;

  switch (category) {
    case ParamCategory.Builtin:
      expectedDesc = getBuiltinExpectedDescription(param.type.index);
      break;
    case ParamCategory.Enum:
      if (param.enumValues && param.enumValues.length <= 20) {
        expectedDesc = t('enum.valuesWithList', param.typeName, param.enumValues.join(', '));
        suggestions = findClosestValues(token.value, param.enumValues, 5);
      } else if (param.enumValues) {
        expectedDesc = t('enum.values', param.typeName);
        suggestions = findClosestValues(token.value, param.enumValues, 5);
      } else {
        expectedDesc = `"${param.typeName}"`;
      }
      break;
    case ParamCategory.DynamicEnum:
      expectedDesc = t('enum.values', param.typeName);
      break;
    default:
      expectedDesc = param.typeName;
  }

  return {
    severity: DiagnosticSeverity.Error,
    message: t('val.paramError', param.name, expectedDesc, token.value),
    start: token.start,
    end: token.end,
    suggestions,
  };
}

function getBuiltinExpectedDescription(id: number): string {
  const keyMap: Record<number, string> = {
    [BuiltinType.Int]: 'type.int',
    [BuiltinType.Float]: 'type.float',
    [BuiltinType.Val]: 'type.val',
    [BuiltinType.WildcardInt]: 'type.wildcardInt',
    [BuiltinType.Operator]: 'type.operator',
    [BuiltinType.CompareOperator]: 'type.compareOperator',
    [BuiltinType.Target]: 'type.target',
    [BuiltinType.FilePath]: 'type.filepath',
    [BuiltinType.IntRange]: 'type.intRange',
    [BuiltinType.String]: 'type.string',
    [BuiltinType.BlockPosition]: 'type.blockPosition',
    [BuiltinType.Position]: 'type.position',
    [BuiltinType.Message]: 'type.message',
    [BuiltinType.JSON]: 'type.json',
    [BuiltinType.BlockStates]: 'type.blockStates',
    [BuiltinType.Command]: 'type.command',
  };
  const key = keyMap[id];
  return key ? t(key) : t('type.unknown');
}

// ===============================
// Helpers
// ===============================

function findSimilarCommands(input: string): string[] {
  const allCommands = getAllCommands();
  const names: string[] = [];
  for (const cmd of allCommands) {
    names.push(cmd.name);
    for (const alias of cmd.aliases) {
      names.push(alias);
    }
  }
  return findClosestValues(input, names, 5);
}

function findClosestValues(input: string, values: string[], maxResults: number): string[] {
  const inputLower = input.toLowerCase();
  
  // First try prefix match
  const prefixMatches = values.filter(v => v.toLowerCase().startsWith(inputLower));
  if (prefixMatches.length > 0 && prefixMatches.length <= maxResults * 2) {
    return prefixMatches.slice(0, maxResults);
  }

  // Fall back to Levenshtein distance
  const scored = values.map((v) => ({
    value: v,
    distance: levenshteinDistance(inputLower, v.toLowerCase()),
  }));
  scored.sort((a, b) => a.distance - b.distance);
  return scored
    .filter((s) => s.distance <= Math.max(3, input.length * 0.6))
    .slice(0, maxResults)
    .map((s) => s.value);
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Format overloads for display in error messages
 */
function formatOverloads(command: CommandDef): string {
  return command.overloads
    .slice(0, 8)
    .map((ov, i) => {
      const params = ov.parameters.map((p) => {
        if (p.optional) return `[${p.name}: ${p.typeName}]`;
        return `<${p.name}: ${p.typeName}>`;
      });
      return `  ${i + 1}. /${command.name} ${params.join(' ')}`;
    })
    .join('\n') + (command.overloads.length > 8 ? `\n  ${t('val.moreOverloads', command.overloads.length - 8)}` : '');
}

/**
 * Generate formatted syntax strings for a command (public API).
 */
export function getCommandSyntax(command: CommandDef): string[] {
  return command.overloads.map((ov) => {
    const params = ov.parameters.map((p) => {
      if (p.optional) return `[${p.name}: ${p.typeName}]`;
      return `<${p.name}: ${p.typeName}>`;
    });
    return `/${command.name} ${params.join(' ')}`;
  });
}

import rawData from './data/available_commands.json';
import rawDataEducation from './data/education_available_commands.json';
import {
  RawCommandData,
  CommandDef,
  EnumDef,
  OverloadDef,
  ParameterDef,
  ParsedParamType,
  ParamCategory,
  BuiltinType,
  RawDynamicEnum,
} from './types';

let _allowCustomItems = false;
export type Edition = 'normal' | 'education';
let _currentEdition: Edition = 'normal';

export function getAllowCustomItems(): boolean {
  return _allowCustomItems;
}

export function setAllowCustomItems(allow: boolean): void {
  _allowCustomItems = allow;
}

export function getCurrentEdition(): Edition {
  return _currentEdition;
}

export function setEdition(edition: Edition): void {
  if (_currentEdition === edition) return;
  _currentEdition = edition;
  clearCache();
}

function getData(): RawCommandData {
  if (_currentEdition === 'education') {
    return rawDataEducation as RawCommandData;
  }
  return rawData as RawCommandData;
}

const _cache: {
  commands: CommandDef[] | null;
  commandMap: Map<string, CommandDef> | null;
  enumMap: Map<string, EnumDef> | null;
} = {
  commands: null,
  commandMap: null,
  enumMap: null,
};

function clearCache(): void {
  _cache.commands = null;
  _cache.commandMap = null;
  _cache.enumMap = null;
}

// ===== Parse parameter type encoding =====
function parseParamType(raw: number): ParsedParamType {
  const hi = (raw >> 16) & 0xffff;
  const lo = raw & 0xffff;
  return { category: hi as ParamCategory, index: lo, raw };
}

function getBuiltinTypeName(id: number): string {
  const names: Record<number, string> = {
    [BuiltinType.Int]: 'int',
    [BuiltinType.Float]: 'float',
    [BuiltinType.Val]: 'value',
    [BuiltinType.WildcardInt]: 'wildcard int',
    [BuiltinType.Operator]: 'operator',
    [BuiltinType.CompareOperator]: 'compare operator',
    [BuiltinType.Target]: 'target',
    [BuiltinType.FilePath]: 'filepath',
    [BuiltinType.IntRange]: 'int range',
    [BuiltinType.String]: 'string',
    [BuiltinType.BlockPosition]: 'block position',
    [BuiltinType.Position]: 'position',
    [BuiltinType.Message]: 'message',
    [BuiltinType.RawText]: 'raw text',
    [BuiltinType.JSON]: 'json',
    [BuiltinType.BlockStates]: 'block states',
    [BuiltinType.Command]: 'command',
  };
  return names[id] || `unknown(0x${id.toString(16)})`;
}

// ===== Resolve Enums =====
function resolveEnum(enumIndex: number): EnumDef {
  const data = getData();
  const e = data.Enums[enumIndex];
  if (!e) return { type: `unknown_enum_${enumIndex}`, values: [] };
  return {
    type: e.Type,
    values: e.ValueIndices.map((i) => data.EnumValues[i] || ''),
  };
}

function resolveDynamicEnum(enumIndex: number): RawDynamicEnum {
  const data = getData();
  return data.DynamicEnums[enumIndex] || { Type: `unknown_dynamic_${enumIndex}`, Values: [] };
}

// ===== Build ParameterDef =====
function buildParameter(raw: { Name: string; Type: number; Optional: boolean; Options: number }): ParameterDef {
  const parsed = parseParamType(raw.Type);
  let typeName = '';
  let enumValues: string[] | undefined;
  let isDynamic = false;

  switch (parsed.category) {
    case ParamCategory.Builtin:
      typeName = getBuiltinTypeName(parsed.index);
      break;
    case ParamCategory.Enum: {
      const enumDef = resolveEnum(parsed.index);
      typeName = enumDef.type;
      enumValues = enumDef.values;
      break;
    }
    case ParamCategory.DynamicEnum: {
      const dynEnum = resolveDynamicEnum(parsed.index);
      typeName = dynEnum.Type;
      enumValues = dynEnum.Values;
      isDynamic = true;
      break;
    }
    case ParamCategory.Postfix:
      typeName = 'postfix';
      break;
    case ParamCategory.ChainedCommand:
      typeName = 'chained command';
      break;
    default:
      typeName = `type(0x${raw.Type.toString(16)})`;
  }

  return {
    name: raw.Name,
    type: parsed,
    optional: raw.Optional,
    options: raw.Options,
    typeName,
    enumValues,
    isDynamic,
  };
}

// ===== Build all commands =====

export function getAllCommands(): CommandDef[] {
  if (_cache.commands) return _cache.commands;

  const data = getData();
  _cache.commands = data.Commands.map((cmd) => {
    // Resolve aliases
    let aliases: string[] = [];
    if (cmd.AliasesOffset !== 4294967295 && cmd.AliasesOffset < data.Enums.length) {
      const aliasEnum = resolveEnum(cmd.AliasesOffset);
      aliases = aliasEnum.values;
    }

    const overloads: OverloadDef[] = cmd.Overloads.map((ov) => ({
      chaining: ov.Chaining,
      parameters: ov.Parameters.map(buildParameter),
    }));

    return {
      name: cmd.Name,
      description: cmd.Description,
      flags: cmd.Flags,
      permissionLevel: cmd.PermissionLevel,
      aliases,
      overloads,
      chainedSubcommandOffsets: cmd.ChainedSubcommandOffsets,
    };
  });

  return _cache.commands;
}

export function getCommandMap(): Map<string, CommandDef> {
  if (_cache.commandMap) return _cache.commandMap;

  _cache.commandMap = new Map();
  for (const cmd of getAllCommands()) {
    _cache.commandMap.set(cmd.name.toLowerCase(), cmd);
    for (const alias of cmd.aliases) {
      _cache.commandMap.set(alias.toLowerCase(), cmd);
    }
  }
  return _cache.commandMap;
}

export function getEnumMap(): Map<string, EnumDef> {
  if (_cache.enumMap) return _cache.enumMap;
  const data = getData();
  _cache.enumMap = new Map();
  for (const e of data.Enums) {
    const resolved = {
      type: e.Type,
      values: e.ValueIndices.map((i) => data.EnumValues[i] || ''),
    };
    _cache.enumMap.set(e.Type, resolved);
  }
  for (const de of data.DynamicEnums) {
    _cache.enumMap.set(de.Type, { type: de.Type, values: de.Values });
  }
  return _cache.enumMap;
}

export function getEnumValues(): string[] {
  return getData().EnumValues;
}

export function getSuffixes(): string[] {
  return getData().Suffixes;
}

export function getChainedSubcommandValues(): string[] {
  return getData().ChainedSubcommandValues;
}

export function getChainedSubcommands() {
  return getData().ChainedSubcommands;
}

export function getRawData(): RawCommandData {
  return getData();
}

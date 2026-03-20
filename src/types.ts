// ===== Raw JSON Types (available_commands.json) =====

export interface RawCommandData {
  EnumValues: string[];
  ChainedSubcommandValues: string[];
  Suffixes: string[];
  Enums: RawEnum[];
  ChainedSubcommands: RawChainedSubcommand[];
  Commands: RawCommand[];
  DynamicEnums: RawDynamicEnum[];
  Constraints: RawConstraint[];
}

export interface RawEnum {
  Type: string;
  ValueIndices: number[];
}

export interface RawDynamicEnum {
  Type: string;
  Values: string[];
}

export interface RawChainedSubcommand {
  Name: string;
  Values: { Index: number; Value: number }[];
}

export interface RawCommand {
  Name: string;
  Description: string;
  Flags: number;
  PermissionLevel: number;
  AliasesOffset: number;
  ChainedSubcommandOffsets: number[];
  Overloads: RawOverload[];
}

export interface RawOverload {
  Chaining: boolean;
  Parameters: RawParameter[];
}

export interface RawParameter {
  Name: string;
  Type: number;
  Optional: boolean;
  Options: number;
}

export interface RawConstraint {
  EnumValueIndex: number;
  EnumIndex: number;
  Constraints: string; // Base64
}

// ===== Processed Types =====

export enum ParamCategory {
  Builtin = 0x0010,
  Enum = 0x0030,
  Postfix = 0x0100,
  DynamicEnum = 0x0410,
  ChainedCommand = 0x0810,
}

export enum BuiltinType {
  Int = 0x01,
  Float = 0x03,
  Val = 0x04,         // relative value (~, ^)
  WildcardInt = 0x05,
  Operator = 0x06,
  CompareOperator = 0x07,
  Target = 0x08,
  FilePath = 0x11,
  IntRange = 0x17,
  String = 0x38,
  BlockPosition = 0x40,
  Position = 0x41,
  Message = 0x44,
  RawText = 0x46,
  JSON = 0x4A,
  BlockStates = 0x54,
  Command = 0x57,
}

export interface ParsedParamType {
  category: ParamCategory;
  index: number;
  raw: number;
}

export interface CommandDef {
  name: string;
  description: string;
  flags: number;
  permissionLevel: number;
  aliases: string[];
  overloads: OverloadDef[];
  chainedSubcommandOffsets: number[];
}

export interface OverloadDef {
  chaining: boolean;
  parameters: ParameterDef[];
}

export interface ParameterDef {
  name: string;
  type: ParsedParamType;
  optional: boolean;
  options: number;
  // Resolved info for display
  typeName: string;
  enumValues?: string[];
  isDynamic?: boolean;
}

export interface EnumDef {
  type: string;
  values: string[];
}

// ===== Validation Types =====

export enum TokenType {
  Command = 'command',
  Selector = 'selector',
  Number = 'number',
  Float = 'float',
  RelativeValue = 'relative',
  LocalValue = 'local',
  String = 'string',
  QuotedString = 'quoted_string',
  Boolean = 'boolean',
  Keyword = 'keyword',
  BlockState = 'block_state',
  JSON = 'json',
  Operator = 'operator',
  IntRange = 'int_range',
  WildcardInt = 'wildcard_int',
  Unknown = 'unknown',
}

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
}

export enum DiagnosticSeverity {
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
}

export interface Diagnostic {
  severity: DiagnosticSeverity;
  message: string;
  start: number;
  end: number;
  suggestions?: string[];
}

export interface ValidationResult {
  tokens: Token[];
  diagnostics: Diagnostic[];
  matchedCommand?: CommandDef;
  matchedOverload?: OverloadDef;
  isValid: boolean;
}

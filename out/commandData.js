"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllowCustomItems = getAllowCustomItems;
exports.setAllowCustomItems = setAllowCustomItems;
exports.getCurrentEdition = getCurrentEdition;
exports.setEdition = setEdition;
exports.getAllCommands = getAllCommands;
exports.getCommandMap = getCommandMap;
exports.getEnumMap = getEnumMap;
exports.getEnumValues = getEnumValues;
exports.getSuffixes = getSuffixes;
exports.getChainedSubcommandValues = getChainedSubcommandValues;
exports.getChainedSubcommands = getChainedSubcommands;
exports.getRawData = getRawData;
const available_commands_json_1 = __importDefault(require("./data/available_commands.json"));
const education_available_commands_json_1 = __importDefault(require("./data/education_available_commands.json"));
const types_1 = require("./types");
let _allowCustomItems = false;
let _currentEdition = 'normal';
function getAllowCustomItems() {
    return _allowCustomItems;
}
function setAllowCustomItems(allow) {
    _allowCustomItems = allow;
}
function getCurrentEdition() {
    return _currentEdition;
}
function setEdition(edition) {
    if (_currentEdition === edition)
        return;
    _currentEdition = edition;
    clearCache();
}
function getData() {
    if (_currentEdition === 'education') {
        return education_available_commands_json_1.default;
    }
    return available_commands_json_1.default;
}
const _cache = {
    commands: null,
    commandMap: null,
    enumMap: null,
};
function clearCache() {
    _cache.commands = null;
    _cache.commandMap = null;
    _cache.enumMap = null;
}
// ===== Parse parameter type encoding =====
function parseParamType(raw) {
    const hi = (raw >> 16) & 0xffff;
    const lo = raw & 0xffff;
    return { category: hi, index: lo, raw };
}
function getBuiltinTypeName(id) {
    const names = {
        [types_1.BuiltinType.Int]: 'int',
        [types_1.BuiltinType.Float]: 'float',
        [types_1.BuiltinType.Val]: 'value',
        [types_1.BuiltinType.WildcardInt]: 'wildcard int',
        [types_1.BuiltinType.Operator]: 'operator',
        [types_1.BuiltinType.CompareOperator]: 'compare operator',
        [types_1.BuiltinType.Target]: 'target',
        [types_1.BuiltinType.FilePath]: 'filepath',
        [types_1.BuiltinType.IntRange]: 'int range',
        [types_1.BuiltinType.String]: 'string',
        [types_1.BuiltinType.BlockPosition]: 'block position',
        [types_1.BuiltinType.Position]: 'position',
        [types_1.BuiltinType.Message]: 'message',
        [types_1.BuiltinType.RawText]: 'raw text',
        [types_1.BuiltinType.JSON]: 'json',
        [types_1.BuiltinType.BlockStates]: 'block states',
        [types_1.BuiltinType.Command]: 'command',
    };
    return names[id] || `unknown(0x${id.toString(16)})`;
}
// ===== Resolve Enums =====
function resolveEnum(enumIndex) {
    const data = getData();
    const e = data.Enums[enumIndex];
    if (!e)
        return { type: `unknown_enum_${enumIndex}`, values: [] };
    return {
        type: e.Type,
        values: e.ValueIndices.map((i) => data.EnumValues[i] || ''),
    };
}
function resolveDynamicEnum(enumIndex) {
    const data = getData();
    return data.DynamicEnums[enumIndex] || { Type: `unknown_dynamic_${enumIndex}`, Values: [] };
}
// ===== Build ParameterDef =====
function buildParameter(raw) {
    const parsed = parseParamType(raw.Type);
    let typeName = '';
    let enumValues;
    let isDynamic = false;
    switch (parsed.category) {
        case types_1.ParamCategory.Builtin:
            typeName = getBuiltinTypeName(parsed.index);
            break;
        case types_1.ParamCategory.Enum: {
            const enumDef = resolveEnum(parsed.index);
            typeName = enumDef.type;
            enumValues = enumDef.values;
            break;
        }
        case types_1.ParamCategory.DynamicEnum: {
            const dynEnum = resolveDynamicEnum(parsed.index);
            typeName = dynEnum.Type;
            enumValues = dynEnum.Values;
            isDynamic = true;
            break;
        }
        case types_1.ParamCategory.Postfix:
            typeName = 'postfix';
            break;
        case types_1.ParamCategory.ChainedCommand:
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
function getAllCommands() {
    if (_cache.commands)
        return _cache.commands;
    const data = getData();
    _cache.commands = data.Commands.map((cmd) => {
        // Resolve aliases
        let aliases = [];
        if (cmd.AliasesOffset !== 4294967295 && cmd.AliasesOffset < data.Enums.length) {
            const aliasEnum = resolveEnum(cmd.AliasesOffset);
            aliases = aliasEnum.values;
        }
        const overloads = cmd.Overloads.map((ov) => ({
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
function getCommandMap() {
    if (_cache.commandMap)
        return _cache.commandMap;
    _cache.commandMap = new Map();
    for (const cmd of getAllCommands()) {
        _cache.commandMap.set(cmd.name.toLowerCase(), cmd);
        for (const alias of cmd.aliases) {
            _cache.commandMap.set(alias.toLowerCase(), cmd);
        }
    }
    return _cache.commandMap;
}
function getEnumMap() {
    if (_cache.enumMap)
        return _cache.enumMap;
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
function getEnumValues() {
    return getData().EnumValues;
}
function getSuffixes() {
    return getData().Suffixes;
}
function getChainedSubcommandValues() {
    return getData().ChainedSubcommandValues;
}
function getChainedSubcommands() {
    return getData().ChainedSubcommands;
}
function getRawData() {
    return getData();
}
//# sourceMappingURL=commandData.js.map
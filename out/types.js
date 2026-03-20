"use strict";
// ===== Raw JSON Types (available_commands.json) =====
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosticSeverity = exports.TokenType = exports.BuiltinType = exports.ParamCategory = void 0;
// ===== Processed Types =====
var ParamCategory;
(function (ParamCategory) {
    ParamCategory[ParamCategory["Builtin"] = 16] = "Builtin";
    ParamCategory[ParamCategory["Enum"] = 48] = "Enum";
    ParamCategory[ParamCategory["Postfix"] = 256] = "Postfix";
    ParamCategory[ParamCategory["DynamicEnum"] = 1040] = "DynamicEnum";
    ParamCategory[ParamCategory["ChainedCommand"] = 2064] = "ChainedCommand";
})(ParamCategory || (exports.ParamCategory = ParamCategory = {}));
var BuiltinType;
(function (BuiltinType) {
    BuiltinType[BuiltinType["Int"] = 1] = "Int";
    BuiltinType[BuiltinType["Float"] = 3] = "Float";
    BuiltinType[BuiltinType["Val"] = 4] = "Val";
    BuiltinType[BuiltinType["WildcardInt"] = 5] = "WildcardInt";
    BuiltinType[BuiltinType["Operator"] = 6] = "Operator";
    BuiltinType[BuiltinType["CompareOperator"] = 7] = "CompareOperator";
    BuiltinType[BuiltinType["Target"] = 8] = "Target";
    BuiltinType[BuiltinType["FilePath"] = 17] = "FilePath";
    BuiltinType[BuiltinType["IntRange"] = 23] = "IntRange";
    BuiltinType[BuiltinType["String"] = 56] = "String";
    BuiltinType[BuiltinType["BlockPosition"] = 64] = "BlockPosition";
    BuiltinType[BuiltinType["Position"] = 65] = "Position";
    BuiltinType[BuiltinType["Message"] = 68] = "Message";
    BuiltinType[BuiltinType["RawText"] = 70] = "RawText";
    BuiltinType[BuiltinType["JSON"] = 74] = "JSON";
    BuiltinType[BuiltinType["BlockStates"] = 84] = "BlockStates";
    BuiltinType[BuiltinType["Command"] = 87] = "Command";
})(BuiltinType || (exports.BuiltinType = BuiltinType = {}));
// ===== Validation Types =====
var TokenType;
(function (TokenType) {
    TokenType["Command"] = "command";
    TokenType["Selector"] = "selector";
    TokenType["Number"] = "number";
    TokenType["Float"] = "float";
    TokenType["RelativeValue"] = "relative";
    TokenType["LocalValue"] = "local";
    TokenType["String"] = "string";
    TokenType["QuotedString"] = "quoted_string";
    TokenType["Boolean"] = "boolean";
    TokenType["Keyword"] = "keyword";
    TokenType["BlockState"] = "block_state";
    TokenType["JSON"] = "json";
    TokenType["Operator"] = "operator";
    TokenType["IntRange"] = "int_range";
    TokenType["WildcardInt"] = "wildcard_int";
    TokenType["Unknown"] = "unknown";
})(TokenType || (exports.TokenType = TokenType = {}));
var DiagnosticSeverity;
(function (DiagnosticSeverity) {
    DiagnosticSeverity["Error"] = "error";
    DiagnosticSeverity["Warning"] = "warning";
    DiagnosticSeverity["Info"] = "info";
})(DiagnosticSeverity || (exports.DiagnosticSeverity = DiagnosticSeverity = {}));
//# sourceMappingURL=types.js.map
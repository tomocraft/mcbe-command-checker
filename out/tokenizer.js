"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenize = tokenize;
const types_1 = require("./types");
/**
 * Tokenizer for Minecraft Bedrock Edition commands.
 * Handles:
 *  - Target selectors (@a, @e[type=zombie], etc.)
 *  - Quoted strings ("hello world")
 *  - Block states ([key=value,key2=value2])
 *  - JSON objects/arrays ({}, [])
 *  - Relative coordinates (~, ~10, ~-5)
 *  - Local coordinates (^, ^1, ^-2)
 *  - Int ranges (1..5, ..5, 1..)
 *  - Operators (+=, -=, =, <, >, ><)
 *  - Numbers (int, float)
 *  - Regular words/identifiers
 */
function tokenize(input) {
    const tokens = [];
    let pos = 0;
    // Skip the leading / if present
    if (input.startsWith('/')) {
        pos = 1;
    }
    while (pos < input.length) {
        // Skip whitespace
        if (input[pos] === ' ' || input[pos] === '\t') {
            pos++;
            continue;
        }
        // Skip newlines
        if (input[pos] === '\n' || input[pos] === '\r') {
            pos++;
            continue;
        }
        const token = readToken(input, pos);
        if (token) {
            tokens.push(token);
            pos = token.end;
        }
        else {
            // Unrecognized character, skip it
            pos++;
        }
    }
    return tokens;
}
function readToken(input, pos) {
    const ch = input[pos];
    // Target selector: @a, @e, @p, @r, @s, @initiator with optional [...]
    if (ch === '@') {
        return readSelector(input, pos);
    }
    // Quoted string
    if (ch === '"') {
        return readQuotedString(input, pos);
    }
    // JSON object
    if (ch === '{') {
        return readJSON(input, pos);
    }
    // Block states or JSON array: [...] — differentiate based on context
    // If preceded by a block/item identifier, treat as block states
    // Otherwise treat as potential JSON array
    if (ch === '[') {
        return readBracketedContent(input, pos);
    }
    // Relative/local coordinates
    if (ch === '~' || ch === '^') {
        return readRelativeLocal(input, pos);
    }
    // Operators: +=, -=, *=, /=, %=, ><, >, <, =
    if (isOperatorStart(ch, input, pos)) {
        return readOperator(input, pos);
    }
    // Numbers, ranges, or words starting with digit/minus
    if (ch === '-' || ch === '+' || isDigit(ch) || ch === '.') {
        // Check for int range patterns (1..5, ..5, 1..)
        const rangeToken = tryReadIntRange(input, pos);
        if (rangeToken)
            return rangeToken;
        const numToken = tryReadNumber(input, pos);
        if (numToken)
            return numToken;
    }
    // Identifiers/keywords/strings (space-delimited)
    return readWord(input, pos);
}
function readSelector(input, pos) {
    const start = pos;
    pos++; // skip @
    // Read selector type character
    if (pos < input.length && /[aeprsi]/.test(input[pos])) {
        pos++;
        // Check for @initiator
        if (input.substring(start + 1, start + 10) === 'initiator') {
            pos = start + 10;
        }
    }
    // Read optional arguments [...]
    if (pos < input.length && input[pos] === '[') {
        pos = skipBrackets(input, pos, '[', ']');
    }
    return { type: types_1.TokenType.Selector, value: input.substring(start, pos), start, end: pos };
}
function readQuotedString(input, pos) {
    const start = pos;
    pos++; // skip opening quote
    while (pos < input.length) {
        if (input[pos] === '\\' && pos + 1 < input.length) {
            pos += 2; // skip escaped char
            continue;
        }
        if (input[pos] === '"') {
            pos++; // skip closing quote
            break;
        }
        pos++;
    }
    return { type: types_1.TokenType.QuotedString, value: input.substring(start, pos), start, end: pos };
}
function readJSON(input, pos) {
    const start = pos;
    pos = skipBrackets(input, pos, '{', '}');
    return { type: types_1.TokenType.JSON, value: input.substring(start, pos), start, end: pos };
}
function readBracketedContent(input, pos) {
    const start = pos;
    pos = skipBrackets(input, pos, '[', ']');
    const value = input.substring(start, pos);
    // Check if it looks like block states (contains = and no { })
    if (value.includes('=') && !value.includes('{')) {
        return { type: types_1.TokenType.BlockState, value, start, end: pos };
    }
    // Could be JSON array
    return { type: types_1.TokenType.JSON, value, start, end: pos };
}
function readRelativeLocal(input, pos) {
    const start = pos;
    const prefix = input[pos];
    pos++;
    // Read optional number after ~ or ^
    if (pos < input.length && (isDigit(input[pos]) || input[pos] === '-' || input[pos] === '+' || input[pos] === '.')) {
        while (pos < input.length && (isDigit(input[pos]) || input[pos] === '.' || input[pos] === '-' || input[pos] === '+')) {
            pos++;
        }
    }
    const tokenType = prefix === '~' ? types_1.TokenType.RelativeValue : types_1.TokenType.LocalValue;
    return { type: tokenType, value: input.substring(start, pos), start, end: pos };
}
function readOperator(input, pos) {
    const start = pos;
    const ch = input[pos];
    // Two-char operators
    if (pos + 1 < input.length) {
        const twoChar = input.substring(pos, pos + 2);
        if (['+=', '-=', '*=', '/=', '%=', '><'].includes(twoChar)) {
            return { type: types_1.TokenType.Operator, value: twoChar, start, end: pos + 2 };
        }
    }
    // Single char operators
    if (['>', '<', '='].includes(ch)) {
        return { type: types_1.TokenType.Operator, value: ch, start, end: pos + 1 };
    }
    return { type: types_1.TokenType.Unknown, value: ch, start, end: pos + 1 };
}
function isOperatorStart(ch, input, pos) {
    if (['>', '<', '='].includes(ch))
        return true;
    if ((ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%') && pos + 1 < input.length && input[pos + 1] === '=') {
        return true;
    }
    return false;
}
function tryReadIntRange(input, pos) {
    // Match patterns: N..N, N.., ..N, N..
    const match = input.substring(pos).match(/^(-?\d+)\.\.(-?\d+)?(?=\s|$)/);
    if (match) {
        const end = pos + match[0].length;
        return { type: types_1.TokenType.IntRange, value: match[0], start: pos, end };
    }
    const match2 = input.substring(pos).match(/^\.\.(-?\d+)(?=\s|$)/);
    if (match2) {
        const end = pos + match2[0].length;
        return { type: types_1.TokenType.IntRange, value: match2[0], start: pos, end };
    }
    return null;
}
function tryReadNumber(input, pos) {
    const match = input.substring(pos).match(/^([+-]?\d+(?:\.\d+)?)(?=\s|$|]|,|})/);
    if (!match)
        return null;
    const value = match[1];
    const end = pos + value.length;
    if (value.includes('.')) {
        return { type: types_1.TokenType.Float, value, start: pos, end };
    }
    return { type: types_1.TokenType.Number, value, start: pos, end };
}
function readWord(input, pos) {
    const start = pos;
    while (pos < input.length && input[pos] !== ' ' && input[pos] !== '\t' && input[pos] !== '\n' && input[pos] !== '\r') {
        // Handle special bracket cases within words (e.g., block[states])
        if (input[pos] === '[') {
            pos = skipBrackets(input, pos, '[', ']');
            continue;
        }
        if (input[pos] === '{') {
            pos = skipBrackets(input, pos, '{', '}');
            continue;
        }
        pos++;
    }
    const value = input.substring(start, pos);
    // Classify the word
    if (value === 'true' || value === 'false') {
        return { type: types_1.TokenType.Boolean, value, start, end: pos };
    }
    // Check if it's a number (more lenient than tryReadNumber)
    if (/^[+-]?\d+$/.test(value)) {
        return { type: types_1.TokenType.Number, value, start, end: pos };
    }
    if (/^[+-]?\d+\.\d+$/.test(value)) {
        return { type: types_1.TokenType.Float, value, start, end: pos };
    }
    // Int range
    if (/^-?\d*\.\.-?\d*$/.test(value) && value !== '..') {
        return { type: types_1.TokenType.IntRange, value, start, end: pos };
    }
    // Wildcard int (used in scoreboard test: *, -2147483648)
    if (value === '*') {
        return { type: types_1.TokenType.WildcardInt, value, start, end: pos };
    }
    return { type: types_1.TokenType.String, value, start, end: pos };
}
function skipBrackets(input, pos, open, close) {
    let depth = 0;
    let inString = false;
    while (pos < input.length) {
        const ch = input[pos];
        if (inString) {
            if (ch === '\\') {
                pos++; // skip next char
            }
            else if (ch === '"') {
                inString = false;
            }
        }
        else {
            if (ch === '"') {
                inString = true;
            }
            else if (ch === open) {
                depth++;
            }
            else if (ch === close) {
                depth--;
                if (depth === 0) {
                    return pos + 1;
                }
            }
        }
        pos++;
    }
    return pos; // Unmatched bracket
}
function isDigit(ch) {
    return ch >= '0' && ch <= '9';
}
//# sourceMappingURL=tokenizer.js.map
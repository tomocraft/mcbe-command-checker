// ===== i18n core — usable in both server and client =====

export type Locale = 'en' | 'ja' | 'de' | 'es' | 'fr' | 'it' | 'ko' | 'pt-br' | 'ru' | 'zh-cn' | 'zh-tw';

const SUPPORTED_LOCALES: Locale[] = ['en', 'ja', 'de', 'es', 'fr', 'it', 'ko', 'pt-br', 'ru', 'zh-cn', 'zh-tw'];

const LOCALE_ALIASES: Record<string, Locale> = {
  en: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  ja: 'ja',
  'ja-jp': 'ja',
  de: 'de',
  'de-de': 'de',
  es: 'es',
  'es-es': 'es',
  'es-mx': 'es',
  fr: 'fr',
  'fr-fr': 'fr',
  it: 'it',
  'it-it': 'it',
  ko: 'ko',
  'ko-kr': 'ko',
  pt: 'pt-br',
  'pt-br': 'pt-br',
  ru: 'ru',
  'ru-ru': 'ru',
  zh: 'zh-cn',
  'zh-cn': 'zh-cn',
  'zh-hans': 'zh-cn',
  'zh-sg': 'zh-cn',
  'zh-tw': 'zh-tw',
  'zh-hant': 'zh-tw',
  'zh-hk': 'zh-tw',
};

// Module-level locale (used by non-React code like validator and API routes)
let _currentLocale: Locale = 'en';

export function getCurrentLocale(): Locale {
  return _currentLocale;
}

export function setCurrentLocale(locale: Locale | string) {
  _currentLocale = resolveLocale(locale);
}

/** Translation function for non-React code (reads module-level locale) */
export function t(key: string, ...args: (string | number)[]): string {
  const translations = getDictionary(_currentLocale);
  let text = translations[key] ?? en[key] ?? ja[key] ?? key;
  args.forEach((arg, i) => {
    text = text.replace(`{${i}}`, String(arg));
  });
  return text;
}

/** Translate with an explicit locale (stateless — for API routes) */
export function tLocale(locale: Locale | string, key: string, ...args: (string | number)[]): string {
  const translations = getDictionary(resolveLocale(locale));
  let text = translations[key] ?? en[key] ?? ja[key] ?? key;
  args.forEach((arg, i) => {
    text = text.replace(`{${i}}`, String(arg));
  });
  return text;
}

function resolveLocale(locale: string): Locale {
  const normalized = locale.toLowerCase();
  if (LOCALE_ALIASES[normalized]) {
    return LOCALE_ALIASES[normalized];
  }

  const base = normalized.split('-')[0];
  if (LOCALE_ALIASES[base]) {
    return LOCALE_ALIASES[base];
  }

  return 'en';
}

function getDictionary(locale: Locale): Record<string, string> {
  if (locale === 'ja') return ja;
  if (SUPPORTED_LOCALES.includes(locale)) return en;
  return en;
}

// ===== Translations =====

export const ja: Record<string, string> = {
  // Header
  'app.title': 'MCBE Command Checker',
  'app.subtitle': 'マイクラ統合版コマンド構文チェッカー',
  'header.valid': '有効',
  'header.reference': 'リファレンス',

  // Quick actions
  'action.loadExample': 'サンプルを読み込む',
  'action.clear': 'クリア',
  'action.hint': 'リアルタイムで構文を検証します',

  // Editor
  'editor.title': 'コマンドエディタ',
  'editor.lines': '行',
  'editor.chars': '文字',
  'editor.placeholder': 'ここにコマンドを入力... (例: /give @s diamond 64)',

  // Diagnostics
  'diag.title': '診断結果',
  'diag.errors': 'エラー',
  'diag.warnings': '警告',
  'diag.validLines': '{0}/{1} 行が有効',
  'diag.empty': 'コマンドを入力して構文チェックを開始',
  'diag.allValid': 'すべてのコマンドが有効です！',
  'diag.errorsFound': '{0} 件のエラーが見つかりました。修正してください。',
  'diag.noErrors': '構文チェック完了 — エラーはありません',
  'diag.line': '行 {0}',
  'diag.suggestions': '候補:',

  // Reference
  'ref.title': 'コマンドリファレンス',
  'ref.commands': '{0} コマンド',
  'ref.search': 'コマンドを検索...',
  'ref.noResults': '該当するコマンドが見つかりません',
  'ref.syntaxCount': '{0} 構文',
  'ref.paramDetails': 'パラメータ詳細:',
  'ref.optional': '(省略可)',
  'ref.insertToEditor': 'エディタに挿入',

  // Permission levels
  'perm.0': 'すべて',
  'perm.1': 'OP',
  'perm.2': '管理者',
  'perm.3': 'ホスト',
  'perm.4': 'コンソール',

  // Features
  'feature.realtime.title': 'デバッグ時間をほぼゼロに',
  'feature.realtime.desc': '入力と同時にコマンドの構文をチェック。エラーは即座にハイライト表示されます。',
  'feature.commands.title': '26.0コマンド対応',
  'feature.commands.desc': '26.0最新コマンドに対応。アプデによるコマンド更新を行ってくれる方を募集しています。興味があれば、下のDiscordで！',
  'feature.diagnostics.title': '配布前に信頼できる最終チェック',
  'feature.diagnostics.desc': 'あらゆるパラメータをほぼ正確に精査。不具合等ありましたら、下のDiscord鯖で報告お願いします。',

  // Footer
  'footer.copyright': 'Copyright © 2026 Tomocraft (BreadAwful). All rights reserved.',

  // Validator messages
  'val.unknownCommand': '不明なコマンド: "{0}"',
  'val.noParams': '"{0}" コマンドはパラメータを受け取りません',
  'val.missingParam': '必須パラメータ "{0}" ({1}) が不足しています',
  'val.extraParams': '余分なパラメータ: "{0}"',
  'val.syntaxError': '"{0}" コマンドの構文が正しくありません。\n使用可能な構文:\n{1}',
  'val.moreOverloads': '... 他{0}構文',
  'val.paramError': 'パラメータ "{0}" には{1}が必要ですが、"{2}" が指定されました',
  'val.paramErrorMulti': '次のいずれかが必要です: {0} — しかし "{1}" が指定されました',
  'val.executeIncomplete': 'executeコマンドが不完全です。"run <コマンド>" でチェーンを終了してください',
  'val.innerUnknownCommand': 'run の後に不明なコマンド: "{0}"',

  // Selector messages
  'sel.required': 'セレクタは @a, @e, @p, @r, @s, @initiator のいずれかが必要です',
  'sel.unknownType': '不明なセレクタタイプ: @{0}。有効なタイプ: @a, @e, @p, @r, @s, @initiator',
  'sel.unclosed': 'セレクタの引数ブラケット ] が閉じられていません',
  'sel.unknownArg': '不明なセレクタ引数: "{0}"',

  // Coordinate messages
  'coord.mixing': '相対座標 (~) とローカル座標 (^) を混在させることはできません',

  // Builtin type descriptions
  'type.int': '整数値',
  'type.float': '数値（小数も可）',
  'type.val': '座標値（整数、小数、~相対座標、^ローカル座標）',
  'type.wildcardInt': '整数値またはワイルドカード（*）',
  'type.operator': '演算子（+=, -=, *=, /=, %=, >, <, =, ><）',
  'type.compareOperator': '比較演算子（<, >, <=, >=, =）',
  'type.target': 'ターゲットセレクタ（@a, @e, @p, @r, @s）またはプレイヤー名',
  'type.filepath': 'ファイルパス',
  'type.intRange': '整数範囲（例: 1..5, ..5, 1..）',
  'type.string': '文字列',
  'type.blockPosition': 'ブロック座標（x y z の整数3つ）',
  'type.position': '座標（x y z の3つ）',
  'type.message': 'メッセージ文字列',
  'type.json': 'JSON テキスト',
  'type.blockStates': 'ブロックステート（["key"="value"]形式）',
  'type.command': 'コマンド',
  'type.unknown': '不明な型',

  // Enum descriptions
  'enum.values': '"{0}" の値',
  'enum.valuesWithList': '"{0}" の値 ({1})',

  // Language
  'lang.toggle': 'English',

  // Edition
  'edition.normal': '通常版',
  'edition.education': '教育版',
  'edition.label': 'エディション',

  // Custom items
  'customItems.on': 'カスタムアイテム ON',
  'customItems.off': 'カスタムアイテム OFF',
  'customItems.label': 'カスタムアイテム',

  // Settings
  'settings.title': '設定',
  'settings.edition': 'エディション',
  'settings.customItemsDesc': 'カスタムIDを許可',

  // Share
  'share.button': '共有',
  'share.copied': 'URLをコピーしました',
  'share.error': '共有に失敗',
  'share.tooLarge': '10KBを超えています',
};

export const en: Record<string, string> = {
  // Header
  'app.title': 'MCBE Command Checker',
  'app.subtitle': 'Minecraft Bedrock Command Syntax Checker',
  'header.valid': 'valid',
  'header.reference': 'Reference',

  // Quick actions
  'action.loadExample': 'Load Examples',
  'action.clear': 'Clear',
  'action.hint': 'Validates syntax in real-time',

  // Editor
  'editor.title': 'Command Editor',
  'editor.lines': 'lines',
  'editor.chars': 'chars',
  'editor.placeholder': 'Enter commands here... (e.g., /give @s diamond 64)',

  // Diagnostics
  'diag.title': 'Diagnostics',
  'diag.errors': 'errors',
  'diag.warnings': 'warnings',
  'diag.validLines': '{0}/{1} lines valid',
  'diag.empty': 'Enter commands to start syntax checking',
  'diag.allValid': 'All commands are valid!',
  'diag.errorsFound': '{0} error(s) found. Please fix them.',
  'diag.noErrors': 'Syntax check complete — no errors',
  'diag.line': 'Line {0}',
  'diag.suggestions': 'Suggestions:',

  // Reference
  'ref.title': 'Command Reference',
  'ref.commands': '{0} commands',
  'ref.search': 'Search commands...',
  'ref.noResults': 'No matching commands found',
  'ref.syntaxCount': '{0} syntaxes',
  'ref.paramDetails': 'Parameter details:',
  'ref.optional': '(optional)',
  'ref.insertToEditor': 'Insert to editor',

  // Permission levels
  'perm.0': 'All',
  'perm.1': 'OP',
  'perm.2': 'Admin',
  'perm.3': 'Host',
  'perm.4': 'Console',

  // Features
  'feature.realtime.title': 'Nearly Zero Debug Time',
  'feature.realtime.desc': 'Check command syntax as you type. Errors are instantly highlighted.',
  'feature.commands.title': '26.0 Commands Supported',
  'feature.commands.desc': 'Supports the latest 26.0 commands. Looking for contributors to keep commands up to date — join our Discord!',
  'feature.diagnostics.title': 'Reliable Final Check Before Release',
  'feature.diagnostics.desc': 'Thoroughly validates nearly all parameter types. Found a bug? Please report it on our Discord server.',

  // Footer
  'footer.copyright': 'Copyright © 2026 Tomocraft (BreadAwful). All rights reserved.',

  // Validator messages
  'val.unknownCommand': 'Unknown command: "{0}"',
  'val.noParams': '"{0}" does not accept parameters',
  'val.missingParam': 'Required parameter "{0}" ({1}) is missing',
  'val.extraParams': 'Extra parameters: "{0}"',
  'val.syntaxError': '"{0}" syntax is incorrect.\nAvailable syntax:\n{1}',
  'val.moreOverloads': '... and {0} more',
  'val.paramError': 'Parameter "{0}" expects {1}, but got "{2}"',
  'val.paramErrorMulti': 'Expected one of: {0} — but got "{1}"',
  'val.executeIncomplete': 'Incomplete execute command. End the chain with "run <command>"',
  'val.innerUnknownCommand': 'Unknown command after run: "{0}"',

  // Selector messages
  'sel.required': 'Selector must be one of: @a, @e, @p, @r, @s, @initiator',
  'sel.unknownType': 'Unknown selector type: @{0}. Valid: @a, @e, @p, @r, @s, @initiator',
  'sel.unclosed': 'Unclosed selector bracket ]',
  'sel.unknownArg': 'Unknown selector argument: "{0}"',

  // Coordinate messages
  'coord.mixing': 'Cannot mix relative (~) and local (^) coordinates',

  // Builtin type descriptions
  'type.int': 'integer',
  'type.float': 'number (decimal allowed)',
  'type.val': 'coordinate (int, float, ~relative, ^local)',
  'type.wildcardInt': 'integer or wildcard (*)',
  'type.operator': 'operator (+=, -=, *=, /=, %=, >, <, =, ><)',
  'type.compareOperator': 'compare operator (<, >, <=, >=, =)',
  'type.target': 'target selector (@a, @e, @p, @r, @s) or player name',
  'type.filepath': 'file path',
  'type.intRange': 'int range (e.g., 1..5, ..5, 1..)',
  'type.string': 'string',
  'type.blockPosition': 'block position (x y z integers)',
  'type.position': 'position (x y z)',
  'type.message': 'message string',
  'type.json': 'JSON text',
  'type.blockStates': 'block states (["key"="value"] format)',
  'type.command': 'command',
  'type.unknown': 'unknown type',

  // Enum descriptions
  'enum.values': '"{0}" value',
  'enum.valuesWithList': '"{0}" value ({1})',

  // Language
  'lang.toggle': '日本語',

  // Edition
  'edition.normal': 'Normal',
  'edition.education': 'Education',
  'edition.label': 'Edition',

  // Custom items
  'customItems.on': 'Custom Items ON',
  'customItems.off': 'Custom Items OFF',
  'customItems.label': 'Custom Items',

  // Settings
  'settings.title': 'Settings',
  'settings.edition': 'Edition',
  'settings.customItemsDesc': 'Allow custom IDs',

  // Share
  'share.button': 'Share',
  'share.copied': 'URL copied!',
  'share.error': 'Share failed',
  'share.tooLarge': 'Exceeds 10KB limit',
};

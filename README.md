# Minecraft Bedrock Command Checker

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/Tomocraft.mcbe-command-checker?style=for-the-badge&label=VS%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=Tomocraft.mcbe-command-checker)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/Tomocraft.mcbe-command-checker?style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=Tomocraft.mcbe-command-checker)
[![Join my Discord](https://img.shields.io/badge/Discord-Join%20Chat-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/3Fdp6vBxtb)
[![License](https://img.shields.io/github/license/tomocraft/mcbe-command-checker?style=for-the-badge)](https://github.com/tomocraft/mcbe-command-checker/blob/main/LICENSE)

MCBE Command Checker is a VS Code extension for validating Minecraft Bedrock Edition commands.
It checks command syntax while you type, reports diagnostics in the Problems panel, and provides command-aware completion.
It now supports Minecraft Bedrock Edition 1.26.0.

## Preview

### Real-time Validation

![Real-time validation in the editor and Problems panel](https://github.com/tomocraft/mcbe-command-checker/blob/main/images/demo.png)

## Installation

### Option 1: Visual Studio Marketplace

Install from Marketplace once published:

- Open Extensions in VS Code and search for `MCBE Command Checker`
- Or open the Marketplace page: https://marketplace.visualstudio.com/items?itemName=Tomocraft.mcbe-command-checker

### Option 2: GitHub Release (.vsix)

1. Open the latest GitHub Release.
2. Download the .vsix asset.
3. In VS Code, run Extensions: Install from VSIX....
4. Select the downloaded .vsix file.

## Features

- Real-time Bedrock command validation on edit and save
- Diagnostics in editor and Problems panel
- Command and parameter completion
- Selector completion (for example: @a, @e, @p)
- Selector argument completion (for example: type=, tag=, gamemode=)
- Compact syntax hints with focused overload filtering
- Edition switch for command datasets: normal / education
- Manual validation from context menu (selection or full file)
- JSON parameter validation with actual JSON parsing

## Why this extension

- Built for Minecraft Bedrock Edition command workflows
- Useful for add-on development, map scripting, and behavior pack command files
- Designed to reduce typo-related command debugging time

## Quick Start

1. Install the extension.
2. Open a .mcfunction file, or any file matched by includeFilePatterns.
3. Type commands and review diagnostics in real time.
4. Open the Problems panel for full details.
5. Optionally run manual validation from the context menu.

## Settings

- `mcbeCommandChecker.showSyntaxHints`
  Toggle syntax hint display.

- `mcbeCommandChecker.showContextMenu`
  Toggle context menu entries.

- `mcbeCommandChecker.includeFilePatterns`
  Glob patterns for validation, completion, and syntax hints.
  Examples: `**/*.mcfunction`, `**/*.txt`

- `mcbeCommandChecker.edition`
  Command dataset edition.
  Values: `normal`, `education`

## Commands

- Command ID: `mcbeCommandChecker.validateSelectionOrFile`
- Display name: `Validate Selected Bedrock Commands`
- Purpose: Validate selected text or the entire active file
You can use this command from context menu.

## Scope and Notes

- This extension targets Minecraft Bedrock Edition commands.
- Very new command changes may require dataset updates.
- JSON parameters are validated as real JSON.

## Language Support

Default language is English.

Package localization files are provided for:

- English
- Japanese
- German
- Spanish
- French
- Italian
- Korean
- Portuguese (Brazil)
- Russian
- Chinese (Simplified)
- Chinese (Traditional)

## Feedback

Bug reports and feature requests are welcome via your issue tracker or contact channel.

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// This file is ported from: https://github.com/microsoft/vscode-python/blob/3698950c97/src/client/providers/itemInfoSource.ts
'use strict';

import { EOL } from 'os';
import * as sparkFuncs from './generated/spark.json';
import * as rdbFuncs from './generated/rdb.json';

const Char = {
    Space: 0x20,
    _0: 0x30,
    _9: 0x39,
    Underscore: 0x5f
};

export function isWhiteSpace(ch: number): boolean {
    return ch <= Char.Space || ch === 0x200b; // Unicode whitespace
}

export function isDecimal(ch: number): boolean {
    return (ch >= Char._0 && ch <= Char._9) || ch === Char.Underscore;
}

enum State {
    Default,
    Preformatted,
    Code
}

export class RestTextConverter {
    private state: State = State.Default;
    private md: string[] = [];

    // tslint:disable-next-line:cyclomatic-complexity
    public toMarkdown(docstring: string): string {
        // Translates reStructruredText (Python doc syntax) to markdown.
        // It only translates as much as needed to display tooltips
        // and documentation in the completion list.
        // See https://en.wikipedia.org/wiki/ReStructuredText

        const result = this.transformLines(docstring);
        this.state = State.Default;
        this.md = [];

        return result;
    }

    public escapeMarkdown(text: string): string {
        // Not complete escape list so it does not interfere
        // with subsequent code highlighting (see above).
        return text.replace(/#/g, '\\#').replace(/\*/g, '\\*').replace(/ _/g, ' \\_').replace(/^_/, '\\_');
    }

    private transformLines(docstring: string): string {
        const lines = docstring.split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i];
            // Avoid leading empty lines
            if (this.md.length === 0 && line.length === 0) {
                continue;
            }

            switch (this.state) {
                case State.Default:
                    i += this.inDefaultState(lines, i);
                    break;
                case State.Preformatted:
                    i += this.inPreformattedState(lines, i);
                    break;
                case State.Code:
                    this.inCodeState(line);
                    break;
                default:
                    break;
            }
        }

        this.endCodeBlock();
        this.endPreformattedBlock();

        return this.md.join(EOL).trim();
    }

    private inDefaultState(lines: string[], i: number): number {
        let line = lines[i];
        if (line.startsWith('```')) {
            this.startCodeBlock();
            return 0;
        }

        if (line.startsWith('===') || line.startsWith('---')) {
            return 0; // Eat standalone === or --- lines.
        }
        if (this.handleDoubleColon(line)) {
            return 0;
        }
        if (this.isIgnorable(line)) {
            return 0;
        }

        if (this.handleSectionHeader(lines, i)) {
            return 1; // Eat line with === or ---
        }

        const result = this.checkPreContent(lines, i);
        if (this.state !== State.Default) {
            return result; // Handle line in the new state
        }

        line = this.cleanup(line);
        line = line.replace(/``/g, '`'); // Convert double backticks to single.
        line = this.escapeMarkdown(line);
        this.md.push(line);

        return 0;
    }

    private inPreformattedState(lines: string[], i: number): number {
        let line = lines[i];
        if (this.isIgnorable(line)) {
            return 0;
        }
        // Preformatted block terminates by a line without leading whitespace.
        if (line.length > 0 && !isWhiteSpace(line.charCodeAt(0)) && !this.isListItem(line)) {
            this.endPreformattedBlock();
            return -1;
        }

        const prevLine = this.md.length > 0 ? this.md[this.md.length - 1] : undefined;
        if (line.length === 0 && prevLine && (prevLine.length === 0 || prevLine.startsWith('```'))) {
            return 0; // Avoid more than one empty line in a row.
        }

        // Since we use HTML blocks as preformatted text
        // make sure we drop angle brackets since otherwise
        // they will render as tags and attributes
        line = line.replace(/</g, ' ').replace(/>/g, ' ');
        line = line.replace(/``/g, '`'); // Convert double backticks to single.
        // Keep hard line breaks for the preformatted content
        this.md.push(`${line}  `);
        return 0;
    }

    private inCodeState(line: string): void {
        const prevLine = this.md.length > 0 ? this.md[this.md.length - 1] : undefined;
        if (line.length === 0 && prevLine && (prevLine.length === 0 || prevLine.startsWith('```'))) {
            return; // Avoid more than one empty line in a row.
        }

        if (line.startsWith('```')) {
            this.endCodeBlock();
        } else {
            this.md.push(line);
        }
    }

    private isIgnorable(line: string): boolean {
        if (line.indexOf('generated/') >= 0) {
            return true; // Drop generated content.
        }
        const trimmed = line.trim();
        if (trimmed.startsWith('..') && trimmed.indexOf('::') > 0) {
            // Ignore lines likes .. sectionauthor:: John Doe.
            return true;
        }
        return false;
    }

    private checkPreContent(lines: string[], i: number): number {
        const line = lines[i];
        if (i === 0 || line.trim().length === 0) {
            return 0;
        }

        if (!isWhiteSpace(line.charCodeAt(0)) && !this.isListItem(line)) {
            return 0; // regular line, nothing to do here.
        }
        // Indented content is considered to be preformatted.
        this.startPreformattedBlock();
        return -1;
    }

    private handleSectionHeader(lines: string[], i: number): boolean {
        const line = lines[i];
        if (i < lines.length - 1 && lines[i + 1].startsWith('===')) {
            // Section title -> heading level 3.
            this.md.push(`### ${this.cleanup(line)}`);
            return true;
        }
        if (i < lines.length - 1 && lines[i + 1].startsWith('---')) {
            // Subsection title -> heading level 4.
            this.md.push(`#### ${this.cleanup(line)}`);
            return true;
        }
        return false;
    }

    private handleDoubleColon(line: string): boolean {
        if (!line.endsWith('::')) {
            return false;
        }
        // Literal blocks begin with `::`. Such as sequence like
        // '... as shown below::' that is followed by a preformatted text.
        if (line.length > 2 && !line.startsWith('..')) {
            // Ignore lines likes .. autosummary:: John Doe.
            // Trim trailing : so :: turns into :.
            this.md.push(line.substring(0, line.length - 1));
        }

        this.startPreformattedBlock();
        return true;
    }

    private startPreformattedBlock(): void {
        // Remove previous empty line so we avoid double empties.
        this.tryRemovePrecedingEmptyLines();
        // Lie about the language since we don't want preformatted text
        // to be colorized as Python. HTML is more 'appropriate' as it does
        // not colorize -- or + or keywords like 'from'.
        this.md.push('```html');
        this.state = State.Preformatted;
    }

    private endPreformattedBlock(): void {
        if (this.state === State.Preformatted) {
            this.tryRemovePrecedingEmptyLines();
            this.md.push('```');
            this.state = State.Default;
        }
    }

    private startCodeBlock(): void {
        // Remove previous empty line so we avoid double empties.
        this.tryRemovePrecedingEmptyLines();
        this.md.push('```python');
        this.state = State.Code;
    }

    private endCodeBlock(): void {
        if (this.state === State.Code) {
            this.tryRemovePrecedingEmptyLines();
            this.md.push('```');
            this.state = State.Default;
        }
    }

    private tryRemovePrecedingEmptyLines(): void {
        while (this.md.length > 0 && this.md[this.md.length - 1].trim().length === 0) {
            this.md.pop();
        }
    }

    private isListItem(line: string): boolean {
        const trimmed = line.trim();
        const ch = trimmed.length > 0 ? trimmed.charCodeAt(0) : 0;
        return ch === Char.Asterisk || ch === Char.Hyphen || isDecimal(ch);
    }

    private cleanup(line: string): string {
        return line.replace(/:mod:/g, 'module:');
    }
}

type MarkdownString = string;

export class LanguageItemInfo {
    constructor(public tooltip: MarkdownString, public detail: string, public signature: MarkdownString) {}
}

export interface IHoverItem {
    text: string;
    description: string;
    docstring: string;
    signature: string;
}

export class FuncInfoSource {
    private textConverter = new RestTextConverter();

    public getFuncInfo(backend: 'spark' | 'rdb', funcName: string): LanguageItemInfo | undefined {
        const funcInfo = (backend === 'spark' ? sparkFuncs : rdbFuncs).funcs.find((func) => func.tooltip.text === funcName);
        return funcInfo && funcInfo.tooltip ? this.getItemInfoFromHoverResult(funcInfo.tooltip, '') : undefined;
    }

    private getItemInfoFromHoverResult(item: IHoverItem, currentWord: string): LanguageItemInfo {
        const signature = `def ${item.signature}`;
        let tooltip = '';
        if (item.docstring) {
            let lines = item.docstring.split(/\r?\n/);

            // If the docstring starts with the signature, then remove those lines from the docstring.
            if (lines.length > 0 && item.signature.indexOf(lines[0]) === 0) {
                lines.shift();
                const endIndex = lines.findIndex((line) => item.signature.endsWith(line));
                if (endIndex >= 0) {
                    lines = lines.filter((_line, index) => index > endIndex);
                }
            }
            if (
                lines.length > 0 &&
                currentWord.length > 0 &&
                item.signature.startsWith(currentWord) &&
                lines[0].startsWith(currentWord) &&
                lines[0].endsWith(')')
            ) {
                lines.shift();
            }

            if (signature.length > 0) {
                tooltip = tooltip + ['```python', signature, '```', ''].join(EOL);
            }

            const description = this.textConverter.toMarkdown(lines.join(EOL));
            tooltip += description;

            return new LanguageItemInfo(tooltip, item.description, signature);
        }

        if (signature.length > 0) {
            tooltip += ['```python', signature, '```', ''].join(EOL);
        }

        if (item.description) {
            const description = this.textConverter.toMarkdown(item.description);
            tooltip += description;
            return new LanguageItemInfo(tooltip, item.description, signature);
        }

        return new LanguageItemInfo(tooltip, '', '');
    }
}

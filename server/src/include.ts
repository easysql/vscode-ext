import { Range } from 'vscode-languageserver';

export class DocumentIncludes {
    static findAllIncludes(docLines: string[]): { includeFilePath: string; lineNum: number }[] {
        const includes: { includeFilePath: string; lineNum: number }[] = [];
        docLines.forEach((line, i) => {
            if (DocumentIncludes.isInclude(line)) {
                includes.push({ includeFilePath: DocumentIncludes.includeFilePath(line), lineNum: i });
            }
        });
        return includes;
    }

    static isInclude(line: string): boolean {
        return line.startsWith('-- include=');
    }
    static inIncludeKeyword(line: string, pos: number): boolean {
        return pos >= '-- '.length && pos < '-- include'.length;
    }

    static inIncludeContent(line: string, pos: number): boolean {
        return pos >= '-- include='.length && /[^\s]/.test(line.substring(pos, pos + 1));
    }

    static includeFilePath(line: string): string {
        return line.substring('-- include='.length).trim();
    }

    static toRange(line: string, lineNum: number, pos: number): Range {
        if (pos >= '-- '.length && pos < '-- include'.length) {
            return {
                start: { line: lineNum, character: 2 },
                end: { line: lineNum, character: '-- include'.length }
            };
        } else {
            let range: Range;
            if (DocumentIncludes.includeFilePath(line).length === 1) {
                range = {
                    start: { line: lineNum, character: pos },
                    end: { line: lineNum, character: pos + 1 }
                };
            } else {
                const m = line.match(/^(-- include=)(\s*)([^\s])(.*)([^\s])\s*$/);
                if (!m) {
                    throw new Error('should exist a match');
                }
                range = {
                    start: { line: lineNum, character: m[1].length + m[2].length },
                    end: { line: lineNum, character: m[1].length + m[2].length + m[3].length + m[4].length + m[5].length }
                };
            }
            return range;
        }
    }
}

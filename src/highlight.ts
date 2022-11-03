import {
    EasySqlNode,
    Lit,
    Parser,
    Str,
    Tok,
    TplFuncArg,
    TplFuncCall,
    TplReference,
    TplVarReference,
    VarFuncCall,
    VarReference
} from './shared/easysql';
import { logger } from './shared/logger';

type TokenType = number;

export const TokenTypes = {
    string: 0,
    literal: 1,
    operator: 2,
    function: 3,
    variable: 4,
    parameter: 5,
    operatorBegin: 6,
    operatorEnd: 7,
    parameterName: 8,
    invalid: 9
};

export interface IParsedToken {
    line: number;
    startCharacter: number;
    length: number;
    tokenType: TokenType;
}

export class HighlightTokenParser {
    parse(content: string): IParsedToken[] {
        const result: (IParsedToken | null)[] = [];

        let ast: EasySqlNode[] = [];
        try {
            ast = new Parser().parse(content);
        } catch (err) {
            logger.error('Parse content to AST failed', err);
        }
        logger.debug('Parseed AST: ', ast);

        const nodeTypesNeedToHandle = [VarReference, VarFuncCall, TplReference, TplFuncCall, TplVarReference, Str];
        const needToHandle = (node: EasySqlNode) => nodeTypesNeedToHandle.findIndex((type) => node instanceof type) !== -1;
        const nodesNeedToHandle: EasySqlNode[] = ast.filter((node) => needToHandle(node));

        const lineNumberFinder = new LineNumberFinder(content);
        nodesNeedToHandle.forEach((node) => {
            if (node instanceof Str) {
                result.push(this.asHighlightToken(node.text, TokenTypes.string, lineNumberFinder));
            }
            if (node instanceof VarReference || node instanceof TplReference || node instanceof TplVarReference) {
                result.push(...this.addHighlightTokensForReference(node, lineNumberFinder));
            }
            if (node instanceof VarFuncCall) {
                result.push(...this.asHighlightTokensForVarFuncCall(node, lineNumberFinder));
            }
            if (node instanceof TplFuncCall) {
                result.push(...this.asHighlightTokensForTplFuncCall(node, lineNumberFinder));
            }
        });

        return result.filter((tok) => tok !== null) as IParsedToken[];
    }

    private asHighlightTokensForTplFuncCall(node: TplFuncCall, lineNumberFinder: LineNumberFinder) {
        const result: (IParsedToken | null)[] = [];
        result.push(this.asHighlightToken(node.bracketStartTok, TokenTypes.operatorBegin, lineNumberFinder));
        result.push(this.asHighlightToken(node.funcName.tok, TokenTypes.function, lineNumberFinder));
        result.push(this.asHighlightToken(node.argStartTok, TokenTypes.operatorBegin, lineNumberFinder));
        node.args.forEach((node) => {
            if (node instanceof TplFuncArg) {
                result.push(this.asHighlightToken(node.name.tok, TokenTypes.parameterName, lineNumberFinder));
                result.push(this.asHighlightToken(node.assignmentTok, TokenTypes.operator, lineNumberFinder));
                if (node.value instanceof Lit) {
                    result.push(this.asHighlightToken(node.value.tok, TokenTypes.literal, lineNumberFinder));
                }
                if (node.value instanceof VarReference) {
                    result.push(...this.addHighlightTokensForReference(node.value, lineNumberFinder));
                }
            }
        });
        result.push(this.asHighlightToken(node.argEndTok, TokenTypes.operatorEnd, lineNumberFinder));
        result.push(this.asHighlightToken(node.bracketEndTok, TokenTypes.operatorEnd, lineNumberFinder));
        return result;
    }

    private asHighlightTokensForVarFuncCall(node: VarFuncCall, lineNumberFinder: LineNumberFinder) {
        const result: (IParsedToken | null)[] = [];
        result.push(this.asHighlightToken(node.bracketStartTok, TokenTypes.operatorBegin, lineNumberFinder));
        result.push(this.asHighlightToken(node.funcName.tok, TokenTypes.function, lineNumberFinder));
        result.push(this.asHighlightToken(node.argStartTok, TokenTypes.operatorBegin, lineNumberFinder));
        node.args.forEach((node) => {
            if (node instanceof Lit) {
                result.push(this.asHighlightToken(node.tok, TokenTypes.literal, lineNumberFinder));
            }
            if (node instanceof VarReference) {
                result.push(...this.addHighlightTokensForReference(node, lineNumberFinder));
            }
        });
        result.push(this.asHighlightToken(node.argEndTok, TokenTypes.operatorEnd, lineNumberFinder));
        result.push(this.asHighlightToken(node.bracketEndTok, TokenTypes.operatorEnd, lineNumberFinder));
        return result;
    }

    private addHighlightTokensForReference(node: VarReference | TplReference | TplVarReference, lineNumberFinder: LineNumberFinder) {
        const result: (IParsedToken | null)[] = [];
        const [startTok, endTok] = [node.bracketStartTok, node.bracketEndTok];
        result.push(this.asHighlightToken(startTok, TokenTypes.operatorBegin, lineNumberFinder));
        result.push(this.asHighlightToken(node.varTok, node.varTok.isValid ? TokenTypes.variable : TokenTypes.invalid, lineNumberFinder));
        result.push(this.asHighlightToken(endTok, TokenTypes.operatorEnd, lineNumberFinder));
        return result;
    }

    private asHighlightToken(tok: Tok, tokenType: TokenType, lineNumberFinder: LineNumberFinder): IParsedToken | null {
        const [lineNum, startCharacter] = lineNumberFinder.findLineNumber(tok.start);
        if (tok.length === 0) {
            return null;
        }
        return { line: lineNum, startCharacter, length: tok.length, tokenType: tok.isValid ? tokenType : TokenTypes.invalid };
    }
}

export class LineNumberFinder {
    constructor(private content: string) {}
    private lineBreakIndices = Array.from(this.content.matchAll(/\n/g)).map((match) => match.index!);

    findLineNumber(pos: number) {
        if (!this.lineBreakIndices.length) {
            return [0, pos];
        }
        const lineNum = this.lineBreakIndices.findIndex((idx) => pos <= idx);
        return [lineNum, lineNum === 0 ? pos : pos - this.lineBreakIndices[lineNum - 1] - 1];
    }
}

export interface StringPos {
    quoteChar: string;
    start: number;
    end: number;
}

export class StringFound {
    constructor(
        public text: string,
        public strings: StringPos[],
        public hasOpenQuote: boolean,
        public openQuote?: string,
        public openQuoteStart?: number
    ) {}

    findInStrs(pos: number): StringPos | undefined {
        return this.strings.find((strPos) => pos >= strPos.start && pos <= strPos.end);
    }

    getStrWithDoubleDashInside(): StringPos | undefined {
        const start = this.strings.length ? this.strings[0].start : 0;
        const pos = this.text.indexOf('--', start);
        return pos !== -1 ? this.findInStrs(pos) : undefined;
    }
}

export class SqlExprStringFinder {
    findString(contentLine: string): StringFound {
        const quoteChars = '\'"`';
        let openQuote = '';
        let openQuoteStart = -1;

        const stringPositions: StringPos[] = [];

        for (let i = 0; i < contentLine.length; i++) {
            const ch = contentLine.charAt(i);
            if (quoteChars.includes(ch)) {
                if (openQuote === ch) {
                    stringPositions.push({ quoteChar: openQuote, start: openQuoteStart, end: i });
                    openQuote = '';
                } else if (!openQuote) {
                    openQuote = ch;
                    openQuoteStart = i;
                }
            } else if (ch === '-' && contentLine.charAt(i + 1) === '-' && !openQuote) {
                // comment found, no need to parse any more
                return new StringFound(contentLine, stringPositions, false);
            }
        }
        if (openQuote) {
            return new StringFound(contentLine, stringPositions, true, openQuote, openQuoteStart);
        } else {
            return new StringFound(contentLine, stringPositions, false);
        }
    }
}

import { LineNumberFinder } from './document';
import { EasySqlNode, Lit, Parser, Str, Tok, TplFuncArg, TplFuncCall, TplReference, TplVarReference, VarFuncCall, VarReference } from './easysql';
import { logger } from './logger';

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
        let ast: EasySqlNode[] = [];
        try {
            ast = new Parser().parseBody(content);
        } catch (err) {
            logger.error('Parse content to AST failed', err);
        }
        logger.debug('Parseed AST: ', ast);
        return this.parseAst(ast, content);
    }

    parseAst(ast: EasySqlNode[], content: string): IParsedToken[] {
        const result: (IParsedToken | null)[] = [];

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

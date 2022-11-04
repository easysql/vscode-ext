import { Range } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentAsts } from './ast';
import { Parser } from './shared/easysql';
import { HighlightTokenParser } from './shared/highlight';
import { logger } from './shared/logger';

export class HighlightTokens {
    constructor(public parser: Parser, public documentAsts: DocumentAsts, public highlightTokenParser: HighlightTokenParser) {}

    getEncodedTokens(doc: TextDocument): number[] {
        const ast = this.documentAsts.getOrParse(doc);
        const content = doc.getText();
        return this._getEncodedTokens(ast, content);
    }

    private _getEncodedTokens(
        ast: import('/Users/gmliao/dev/projects/ftms/dataplat-vscode/easy-sql/server/src/shared/easysql').EasySqlNode[],
        content: string
    ) {
        let lastLineNumber = 0;
        let lastCharacter = 0;
        return this.highlightTokenParser.parseAst(ast, content).flatMap((tok) => {
            const charDelta = tok.line === lastLineNumber ? tok.startCharacter - lastCharacter : tok.startCharacter;
            lastCharacter = tok.startCharacter;
            const lineOffset = tok.line - lastLineNumber;
            lastLineNumber = tok.line;
            return [lineOffset, charDelta, tok.length, tok.tokenType, 0];
        });
    }

    getEncodedTokensByRange(doc: TextDocument, range: Range): number[] {
        logger.info('get token from range: ', range);
        const content = doc.getText(range);
        const ast = this.parser.parse(content);
        return this._getEncodedTokens(ast, content);
    }
}

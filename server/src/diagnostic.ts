import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

import { logger } from './shared/logger';
import { Settings } from './types';
import { EasySqlNode, Parser } from './shared/easysql';

export class CodeDiagnosticProvider {
    constructor(private settings: Settings) {}
    private parser = new Parser();

    async validateTextDocument(textDocument: TextDocument): Promise<Diagnostic[]> {
        // In this simple example we get the settings for every validate run.
        const settings = await this.settings.getDocumentSettings(textDocument.uri);

        let ast: EasySqlNode[] = [];
        try {
            ast = this.parser.parse(textDocument.getText());
        } catch (err) {
            logger.error('Parse content to AST failed', err);
        }
        logger.debug('Parseed AST: ', ast);

        return ast
            .flatMap((node) => node.getToks().filter((tok) => !tok.isValid))
            .slice(0, settings.maxNumberOfProblems)
            .map((tok) => {
                const diagnostic: Diagnostic = {
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: textDocument.positionAt(tok.start),
                        end: textDocument.positionAt(tok.start + tok.length)
                    },
                    message: tok.invalidReason,
                    source: '(EasySQL)'
                };
                return diagnostic;
            });
    }
}

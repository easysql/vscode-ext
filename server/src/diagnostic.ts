import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

import { DocumentAsts } from './ast';
import { Settings } from './types';

export class CodeDiagnosticProvider {
    constructor(private settings: Settings, private documentAsts: DocumentAsts) {}

    async validateTextDocument(textDocument: TextDocument): Promise<Diagnostic[]> {
        // In this simple example we get the settings for every validate run.
        const settings = await this.settings.getDocumentSettings(textDocument.uri);

        const ast = this.documentAsts.getOrParse(textDocument);

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

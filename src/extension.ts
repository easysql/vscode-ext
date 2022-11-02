import * as vscode from 'vscode';
import { HighlightTokenParser, TokenTypes } from './highlight';

const legend = new vscode.SemanticTokensLegend(Object.keys(TokenTypes), []);

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider({ language: 'sql' }, new DocumentSemanticTokensProvider(), legend)
    );
}

class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
        // const allTokens = this._parseText(document.getText());
        // const builder = new vscode.SemanticTokensBuilder();
        // allTokens.forEach((token) => {
        //     builder.push(token.line, token.startCharacter, token.length, this._encodeTokenType(token.tokenType));
        // });
        // const builder = new vscode.SemanticTokensBuilder();
        // 'ab${a}cc'
        // builder.push(0, 0, 3, this._encodeTokenType('string'));
        // builder.push(0, 3, 2, this._encodeTokenType('varReferenceBegin'));
        // builder.push(0, 5, 1, this._encodeTokenType('parameterName'));
        // builder.push(0, 6, 1, this._encodeTokenType('varReferenceEnd'));
        // builder.push(0, 7, 2, this._encodeTokenType('string'));

        const builder = new vscode.SemanticTokensBuilder();
        new HighlightTokenParser().parse(document.getText()).forEach((token) => {
            builder.push(token.line, token.startCharacter, token.length, token.tokenType);
        });
        return builder.build();
    }
}

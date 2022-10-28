import * as vscode from 'vscode';

const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();

const legend = (function () {
    const tokenTypesLegend = [
        'string',
        'number',
        'operator',
        'function',
        'variable',
        'parameter',
        'varReferenceBegin',
        'varReferenceEnd',
        'parameterName'
    ];
    tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));

    const tokenModifiersLegend: string[] = [];
    tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));

    return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
})();

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider({ language: 'sql' }, new DocumentSemanticTokensProvider(), legend)
    );
}

interface IParsedToken {
    line: number;
    startCharacter: number;
    length: number;
    tokenType: string;
    tokenModifiers: string[];
}

class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
        // const allTokens = this._parseText(document.getText());
        // const builder = new vscode.SemanticTokensBuilder();
        // allTokens.forEach((token) => {
        //     builder.push(token.line, token.startCharacter, token.length, this._encodeTokenType(token.tokenType));
        // });
        const builder = new vscode.SemanticTokensBuilder();
        // 'ab${a}cc'
        builder.push(0, 0, 3, this._encodeTokenType('string'));
        builder.push(0, 3, 2, this._encodeTokenType('varReferenceBegin'));
        builder.push(0, 5, 1, this._encodeTokenType('parameterName'));
        builder.push(0, 6, 1, this._encodeTokenType('varReferenceEnd'));
        builder.push(0, 7, 2, this._encodeTokenType('string'));
        return builder.build();
    }

    private _encodeTokenType(tokenType: string): number {
        if (tokenTypes.has(tokenType)) {
            return tokenTypes.get(tokenType)!;
        } else if (tokenType === 'notInLegend') {
            return tokenTypes.size + 2;
        }
        return 0;
    }
}

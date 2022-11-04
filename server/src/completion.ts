import { Range, TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItem, CompletionItemKind, InsertTextFormat, TextDocumentPositionParams, TextDocuments } from 'vscode-languageserver/node';
import { Parser, TplFuncCall, VarFuncCall } from './shared/easysql';
import * as sparkFuncs from './generated/spark.json';
import * as rdbFuncs from './generated/rdb.json';

interface FuncDoc {
    label: string;
}

const asCompletionItem: (funcDoc: FuncDoc, i: number) => CompletionItem = (funcDoc: FuncDoc, i: number) => {
    const label = funcDoc.label.replace(/\${[\d]+:/g, '{');
    return {
        label: label,
        kind: CompletionItemKind.Function,
        insertText: funcDoc.label,
        insertTextFormat: InsertTextFormat.Snippet,
        data: i + 1
    };
};

export class CodeCompleter {
    constructor(private documents: TextDocuments<TextDocument>, private parser: Parser) {}
    public sparkFuncCompletionItems: CompletionItem[] = ((sparkFuncs as any).funcs as FuncDoc[]).map(asCompletionItem);
    public rdbFuncCompletionItems: CompletionItem[] = ((rdbFuncs as any).funcs as FuncDoc[]).map(asCompletionItem);

    resolveInformation(item: CompletionItem): CompletionItem {
        item.detail = item.label;
        return item;
    }

    complete(params: TextDocumentPositionParams): CompletionItem[] {
        const doc = this.documents.get(params.textDocument.uri);
        const range: Range = { start: { line: params.position.line, character: 0 }, end: { line: params.position.line, character: 1000 } };
        const line = doc?.getText(range);
        let text = line?.substring(0, params.position.character);
        console.log('on complete: ', text);

        if (text) {
            text = text.trimEnd();
            const insideFuncCall = this.parser
                .parse(line!)
                .reverse()
                .find((node) => {
                    if (node instanceof VarFuncCall || node instanceof TplFuncCall) {
                        const [startPos, endPos] = [node.startPos, node.endPos];
                        if (startPos < params.position.character && endPos > params.position.character) {
                            return node.startPos + node.join().indexOf('(') < params.position.character;
                        }
                    }
                    return false;
                });

            if (insideFuncCall) {
                console.log('inside funcCall, will not complete: ', text);
                return [];
            }

            if (text.endsWith('${') || text.match(/^-- target=check\.$/) || text.match(/^-- target=.*if=$/)) {
                const headerCode = doc!.getText().substring(0, 500);
                const backendMatch = headerCode.match(/(^|\n)-- backend:\s*([\w]+)(\s|\n)/);
                if (backendMatch) {
                    return backendMatch[1].toLowerCase() == 'spark' ? this.sparkFuncCompletionItems : this.rdbFuncCompletionItems;
                }
                return this.sparkFuncCompletionItems;
            }
        }
        return [];
    }
}

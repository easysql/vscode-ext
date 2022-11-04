import { Range, TextDocument } from 'vscode-languageserver-textdocument';
import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    Position,
    TextDocumentPositionParams,
    TextDocuments
} from 'vscode-languageserver/node';
import { Parser, TplFuncCall, VarFuncCall } from './shared/easysql';
import * as sparkFuncs from './generated/spark.json';
import * as rdbFuncs from './generated/rdb.json';

interface FuncDoc {
    label: string;
}

const simpleLabelAsCompletionItem: (label: string) => CompletionItem = (label: string) => {
    const rawLabel = label.replace(/\${[\d]+:/g, '{');
    return {
        label: rawLabel,
        kind: CompletionItemKind.Unit,
        insertText: label,
        insertTextFormat: InsertTextFormat.Snippet
    };
};

const funcDocAsCompletionItem: (funcDoc: FuncDoc, i: number) => CompletionItem = (funcDoc: FuncDoc, i: number) => {
    const label = funcDoc.label.replace(/\${[\d]+:/g, '{');
    return {
        label: label,
        kind: CompletionItemKind.Function,
        insertText: funcDoc.label,
        insertTextFormat: InsertTextFormat.Snippet,
        data: i + 1
    };
};

const simpleKeywords = ['backend:', 'target=variables', 'target=func', 'target=check', 'target=list_variables'];
const keywordsWithParams = [
    'inputs: ${1:*input_table_name}, ${2:...}',
    'outputs: ${1:*input_table_name}, ${2:...}',
    'prepare-sql: ${1:sql_expression}',
    'target=temp.${1:temp_table_name}',
    'target=cache.${1:cached_temp_table_name}',
    'target=broadcast.${1:broadcasted_temp_table_name}',
    'target=log.${1:log_name}',
    'target=check.${1:check_name}',
    'target=output.${1:db_name}.${2:table_name}',
    'target=output.${1:db_name}.${2:schema_name}.${3:table_name}',
    'target=template.${1:template_name}',
    'target=action.${1:action_name}',
    'include=${1:file_path}'
];
export class CodeCompleter {
    constructor(private documents: TextDocuments<TextDocument>, private parser: Parser) {}
    public sparkFuncCompletionItems: CompletionItem[] = ((sparkFuncs as any).funcs as FuncDoc[]).map(funcDocAsCompletionItem);
    public rdbFuncCompletionItems: CompletionItem[] = ((rdbFuncs as any).funcs as FuncDoc[]).map(funcDocAsCompletionItem);
    private keywordItems: CompletionItem[] = simpleKeywords
        .map(
            (keyword) =>
                ({
                    label: keyword,
                    insertText: keyword,
                    kind: CompletionItemKind.Unit
                } as CompletionItem)
        )
        .concat(keywordsWithParams.map(simpleLabelAsCompletionItem));
    private readonly backendCompletionItems = ['spark', 'postgres', 'clickhouse', 'bigquery', 'flink'].map((backend) => ({
        label: backend,
        insertText: backend,
        kind: CompletionItemKind.Unit
    }));

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
            if (text === '-') {
                return this.keywordItems.map((item) => ({
                    ...item,
                    insertText: '- ' + item.insertText
                }));
            }
            if (text === '--') {
                return this.keywordItems.map((item) => ({
                    ...item,
                    insertText: ' ' + item.insertText
                }));
            }
            if (text === '-- ') {
                return this.keywordItems;
            }
            if (text === '-- backend: ') {
                return this.backendCompletionItems;
            }
            text = text.trimEnd();
            return this.completeFunctions(line!, text, doc!, params.position);
        }
        return [];
    }

    completeFunctions(line: string, text: string, doc: TextDocument, position: Position) {
        const insideFuncCall = this.parser
            .parse(line!)
            .reverse()
            .find((node) => {
                if (node instanceof VarFuncCall || node instanceof TplFuncCall) {
                    const [startPos, endPos] = [node.startPos, node.endPos];
                    if (startPos < position.character && endPos > position.character) {
                        return node.startPos + node.join().indexOf('(') < position.character;
                    }
                }
                return false;
            });

        if (insideFuncCall) {
            console.log('inside funcCall, will not complete: ', text);
            return [];
        }

        if (text.endsWith('${') || text.match(/^-- target=(check|func)\.$/) || text.match(/^-- target=.*if=$/)) {
            const headerCode = doc!.getText().substring(0, 500);
            const backendMatch = headerCode.match(/(^|\n)-- backend:\s*([\w]+)(\s|\n)/);
            if (backendMatch) {
                return backendMatch[1].toLowerCase() == 'spark' ? this.sparkFuncCompletionItems : this.rdbFuncCompletionItems;
            }
            return this.sparkFuncCompletionItems;
        }
        return [];
    }
}

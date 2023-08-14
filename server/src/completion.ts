import { Range, TextDocument } from 'vscode-languageserver-textdocument';
import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    Position,
    TextDocumentPositionParams,
    TextDocuments
} from 'vscode-languageserver/node';
import { EasySQLContentFinder, EasySqlNode, Parser, Target, Template, TplFuncCall, TplVarReference, VarFuncCall } from './shared/easysql';
import * as sparkFuncs from './generated/spark.json';
import * as rdbFuncs from './generated/rdb.json';
import { logger } from './shared/logger';
import { DocumentAsts } from './ast';
import { LineNumberFinder } from './shared/document';
import { DocumentIncludes } from './include';
import { Files } from './files';

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
    constructor(private documentAsts: DocumentAsts, private documents: TextDocuments<TextDocument>, private parser: Parser, private files: Files) {}
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
        logger.debug('on complete: ', text);

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
            return this.completeFunctionsAndTemplates(line!, text, doc!, params.position);
        }
        return [];
    }

    completeFunctionsAndTemplates(line: string, text: string, doc: TextDocument, position: Position) {
        if (line.startsWith('-- target=') && text.endsWith('${')) {
            logger.debug('reference inside target definition, will not complete: ', text);
            return [];
        }
        const astReversed = this.parser.parseBody(line!, true).reverse();
        const outerFuncCallIndex = astReversed.findIndex((node) => {
            if (node instanceof VarFuncCall || node instanceof TplFuncCall) {
                const [startPos, endPos] = [node.startPos, node.endPos];
                if (startPos < position.character && endPos > position.character) {
                    return node.startPos + node.join().indexOf('(') < position.character;
                }
            }
            return false;
        });

        if (outerFuncCallIndex !== -1) {
            logger.debug('inside funcCall, will not complete: ', text);
            return [];
        }

        if (text.endsWith('${') || text.match(/^-- target=(check|func)\.$/) || text.match(/^-- target=.*if=$/)) {
            const headerCode = doc!.getText().substring(0, 500);
            const backendMatch = headerCode.match(/(^|\n)-- backend:\s*([\w]+)(\s|\n)/);
            let items = [];
            items = !backendMatch || backendMatch[1].toLowerCase() == 'spark' ? this.sparkFuncCompletionItems : this.rdbFuncCompletionItems;

            const openQuoteIdx = EasySQLContentFinder.findOpenQuoteInCurrentLine(text);
            if (openQuoteIdx !== -1) {
                items = items.map((item) => ({ ...item, insertText: item.insertText + '}' }));
            }
            return items;
        }

        if (text.endsWith('@{') && !line.startsWith('-- target=')) {
            const items = this.findDefinedTemplates(doc)
                .filter((tpl) => tpl.endLineNumber < position.line)
                .map((tpl) => tpl.toCompletionItem());
            return items;
        }
        return [];
    }

    private findDefinedTemplates(doc: TextDocument) {
        const ast = this.documentAsts.getOrParse(doc);
        const definedTemplates: DefinedTemplate[] = this.findDefinedTemplatesForAst(ast, doc.getText());

        const includes = DocumentIncludes.findAllIncludes(doc.getText().split('\n')).reverse();
        for (let i = 0; i < includes.length; i++) {
            const { includeFilePath } = includes[i];
            const fileUri = this.files.findFile(doc.uri, includeFilePath);
            if (fileUri) {
                const docText = this.documents.get(fileUri!)?.getText() || this.files.readFile(fileUri!);
                if (docText) {
                    const includeDocAst = this.documentAsts.getOrParseByTextAndUri(docText, fileUri!);
                    definedTemplates.push(...this.findDefinedTemplatesForAst(includeDocAst, docText));
                }
            }
        }

        return definedTemplates;
    }

    private findDefinedTemplatesForAst(ast: EasySqlNode[], docContent: string) {
        const definedTemplates: DefinedTemplate[] = [];
        const targetNodes: [Target, number][] = ast
            .map((node, i) => (node instanceof Target ? [node, i] : [null, i]))
            .filter(([node, i]) => node !== null) as [Target, number][];
        const lineNumberFinder = new LineNumberFinder(docContent);
        targetNodes.forEach(([node, nodeIdx], i) => {
            if (node instanceof Template) {
                const templateBody = ast.slice(nodeIdx + 1, i === targetNodes.length - 1 ? ast.length : targetNodes[i + 1][1]);
                const templateArgs = Array.from(
                    new Set(
                        templateBody.filter((node) => node instanceof TplVarReference).map((node) => (node as TplVarReference).var_.name)
                    ).values()
                ).sort();
                const nextTarget = i === targetNodes.length - 1 ? null : targetNodes[i + 1];
                const endLineNumber = nextTarget ? lineNumberFinder.findLineNumber(nextTarget[0].startPos)[0] - 1 : lineNumberFinder.lastLineNum;
                definedTemplates.push(new DefinedTemplate(node.name.name, templateArgs, endLineNumber));
            }
        });
        return definedTemplates;
    }
}

class DefinedTemplate {
    constructor(public name: string, public args: string[], public endLineNumber: number) {}

    get hasArgs() {
        return this.args.length > 0;
    }

    private argsInsertText() {
        return this.args.map((arg, i) => `${arg}=\${${i + 1}:${arg}}`).join(', ');
    }

    private argsLabel() {
        return this.args.map((arg, i) => `${arg}`).join(', ');
    }

    toCompletionItem(): CompletionItem {
        return {
            label: this.hasArgs ? `${this.name}(${this.argsLabel()})` : this.name,
            kind: CompletionItemKind.Function,
            insertText: this.hasArgs ? `${this.name}(${this.argsInsertText()})` : this.name,
            insertTextFormat: InsertTextFormat.Snippet
        };
    }
}

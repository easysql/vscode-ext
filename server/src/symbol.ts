import { DocumentSymbol, Position, Range, SymbolKind, TextDocuments } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentAsts } from './ast';
import { LineNumberFinder } from './shared/document';
import { Check, Func, FuncCall, Output, SimpleNamedTarget, Target, Tok } from './shared/easysql';

export class SymbolProvider {
    constructor(public documentAsts: DocumentAsts, private documents: TextDocuments<TextDocument>) {}

    getSymbols(docUri: string): DocumentSymbol[] | null {
        const doc = this.documents.get(docUri);
        if (doc) {
            const ast = this.documentAsts.getOrParse(doc);
            const targets = ast.filter((node) => node instanceof Target);
            const lineNumberFinder = new LineNumberFinder(doc.getText());
            const symbols = targets.map((target) => {
                const line = lineNumberFinder.findLineNumber(target.startPos)[0];
                const targetStr = target.join();
                const range = Range.create(Position.create(line, 0), Position.create(line, targetStr.length));

                const kind = SymbolKind.Constant;
                const detail = `${(target as Target).targetName()} target`;

                let name: string;
                let nameTok: Tok;
                if (target instanceof SimpleNamedTarget) {
                    nameTok = (target as SimpleNamedTarget).name.tok;
                    name = nameTok.text;
                } else if (target instanceof Func) {
                    nameTok = target.content.funcName.tok;
                    name = nameTok.text;
                } else if (target instanceof Check) {
                    const content = target.content;
                    nameTok = content instanceof FuncCall ? content.funcName.tok : content.tok;
                    name = nameTok.text;
                } else if (target instanceof Output) {
                    const tableName = target.table.join();
                    nameTok = new Tok(target.table.db.tok.start, tableName.length, target.table.db.tok.content, Tok.TYPES.any);
                    name = tableName;
                } else if (target instanceof Target) {
                    nameTok = target.start.toks[target.start.toks.length - 1];
                    name = nameTok.text;
                } else {
                    throw new Error('unknown target: ' + target);
                }

                const namePos = lineNumberFinder.findLineNumber(nameTok.start);
                const selectionRange = Range.create(Position.create(namePos[0], namePos[1]), Position.create(namePos[0], namePos[1] + name.length));
                name = name + ` [${detail}]`;
                return {
                    name,
                    detail,
                    kind,
                    range,
                    selectionRange
                };
            });
            return symbols.filter((s) => !/^\s*$/.test(s.name));
        }
        return null;
    }
}

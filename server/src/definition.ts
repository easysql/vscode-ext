import { Definition, Position, Range, Location, TextDocuments, DocumentLink } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentAsts } from './ast';
import { Files } from './files';
import { DocumentIncludes } from './include';
import { LineNumberFinder } from './shared/document';
import { Broadcast, Cache, Parser, SimpleNamedTarget, Temp, Template } from './shared/easysql';
import { SqlExprStringFinder } from './shared/sql_expr';

export class IncludeDefinition {
    constructor(private files: Files, private docUri: string, private position: Position, private line: string) {}

    accept() {
        return (
            DocumentIncludes.isInclude(this.line) &&
            (DocumentIncludes.inIncludeContent(this.line, this.position.character) ||
                DocumentIncludes.inIncludeKeyword(this.line, this.position.character))
        );
    }

    definition(): Definition | null {
        const filePath = DocumentIncludes.includeFilePath(this.line);
        if (this.position.character >= '-- '.length && this.position.character < '-- include'.length) {
            return null;
        } else {
            const fileUri = this.files.findFile(this.docUri, filePath);
            if (fileUri) {
                const range = {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 0 }
                };
                return Location.create(fileUri, range);
            }
            return null;
        }
    }
}

export class TempTableDefinition {
    public tempTableName: string | null = null;
    constructor(
        private doc: TextDocument,
        private docUri: string,
        private line: string,
        private position: Position,
        private documentAsts: DocumentAsts,
        private parser: Parser
    ) {
        if (this.line.endsWith('\n')) {
            this.line = this.line.substring(0, this.line.length - 1);
        }
    }

    accept(): boolean {
        const [leftText, rightText] = [this.line.substring(0, this.position.character), this.line.substring(this.position.character)];
        if (leftText.startsWith('-- target=')) {
            const target = this.parser.parseTarget(this.line);
            if (!target.condition) {
                return false;
            }

            const start = target.condition.funcCall.argStart.endPos;
            const end = target.condition.funcCall.end.startPos;
            if (start === -1 || end === -1 || this.position.character < start || this.position.character > end) {
                return false;
            }

            const [leftText, rightText] = [this.line.substring(start, this.position.character), this.line.substring(this.position.character, end)];
            const leftMatch = leftText.match(/[^.\w]*(\w*)$/);
            const rightMatch = rightText.match(/^(\w*)\..*$/);
            if (leftMatch && rightMatch) {
                const tableName = leftMatch[1] + rightMatch[1];
                if (tableName !== '') {
                    this.tempTableName = tableName;
                    return true;
                }
            }
            return false;
        } else {
            const strFound = new SqlExprStringFinder().findString(this.line);
            if (strFound.containsPositionInStr(this.position.character)) {
                return false;
            }
            if (strFound.hasOpenQuote && this.position.character >= strFound.openQuoteStart!) {
                return false;
            }

            if (!strFound.hasOpenQuote) {
                const possibleCommentStart = strFound.strings.length > 0 ? strFound.strings[strFound.strings.length - 1].end : 0;
                const commentMatch = this.line.substring(possibleCommentStart).match(/(.*--).*/);
                if (commentMatch) {
                    const commentContentStart = possibleCommentStart + commentMatch[1].length;
                    if (this.position.character >= commentContentStart) {
                        return false;
                    }
                }
            }

            const leftMatch = leftText.match(/(from|join)\s+(\w*)$/i);
            const rightMatch = rightText.match(/^(\w*)([^\w]|$)/);
            if (leftMatch && rightMatch) {
                const tableName = leftMatch[2] + rightMatch[1];
                if (tableName !== '') {
                    this.tempTableName = tableName;
                    return true;
                }
            }
            return false;
        }
    }

    definition(): Definition | null {
        const ast = this.documentAsts.getOrParse(this.doc);
        const lineNumberFinder = new LineNumberFinder(this.doc.getText());
        const tempTable = ast
            .filter(
                (node) =>
                    node instanceof SimpleNamedTarget &&
                    (node instanceof Temp || node instanceof Cache || node instanceof Broadcast) &&
                    node.name.name === this.tempTableName &&
                    lineNumberFinder.findLineNumber(node.name.tok.start)[0] < this.position.line
            )
            .reverse()[0] as SimpleNamedTarget;
        if (tempTable) {
            const startPos = lineNumberFinder.findLineNumber(tempTable.name.tok.start);
            const endPos = [startPos[0], startPos[1] + tempTable.name.tok.length];
            return Location.create(this.docUri, Range.create(Position.create(startPos[0], startPos[1]), Position.create(endPos[0], endPos[1])));
        }
        return null;
    }
}

export class TemplateDefinition {
    private leftMatch: RegExpMatchArray | null = null;
    private rightMatch: RegExpMatchArray | null = null;
    constructor(
        private doc: TextDocument,
        private docUri: string,
        private line: string,
        private position: Position,
        private documentAsts: DocumentAsts
    ) {}

    accept(): boolean {
        const [leftText, rightText] = [this.line.substring(0, this.position.character), this.line.substring(this.position.character)];
        this.leftMatch = leftText.match(/@{(\w*)$/);
        this.rightMatch = rightText.match(/^(\w+)([^\w]|$)/);
        return !!(this.leftMatch && this.rightMatch);
    }

    definition(): Definition | null {
        const templateName = this.leftMatch![1] + this.rightMatch![1];
        const ast = this.documentAsts.getOrParse(this.doc);
        const template = ast.filter((node) => node instanceof Template && node.name.name === templateName).reverse()[0] as Template;
        const lineNumberFinder = new LineNumberFinder(this.doc.getText());
        if (template) {
            const startPos = lineNumberFinder.findLineNumber(template.name.tok.start);
            const endPos = [startPos[0], startPos[1] + template.name.tok.length];
            return Location.create(this.docUri, Range.create(Position.create(startPos[0], startPos[1]), Position.create(endPos[0], endPos[1])));
        }
        return null;
    }
}

export class DefinitionProvider {
    constructor(private files: Files, private documentAsts: DocumentAsts, private documents: TextDocuments<TextDocument>, private parser: Parser) {}

    onDefinition(position: Position, docUri: string): Definition | null {
        const doc = this.documents.get(docUri);
        if (doc) {
            const range: Range = { start: { line: position.line, character: 0 }, end: { line: position.line, character: 1000 } };
            const line = doc.getText(range);

            const includeDefinition = new IncludeDefinition(this.files, docUri, position, line);
            if (includeDefinition.accept()) {
                return includeDefinition.definition();
            }

            const tempTableDefinition = new TempTableDefinition(doc, docUri, line, position, this.documentAsts, this.parser);
            if (tempTableDefinition.accept()) {
                return tempTableDefinition.definition();
            }

            const templateDefinition = new TemplateDefinition(doc, docUri, line, position, this.documentAsts);
            if (templateDefinition.accept()) {
                return templateDefinition.definition();
            }
        }
        return null;
    }

    onDocumentLinks(docUri: string): DocumentLink[] {
        const doc = this.documents.get(docUri);
        if (doc) {
            const lines = doc.getText().split('\n');
            const links: (DocumentLink | null)[] = lines.map((line, i) => {
                if (!line.startsWith('-- include=')) {
                    return null;
                }

                const filePath = DocumentIncludes.includeFilePath(line);
                const fileUri = this.files.findFile(docUri, filePath);
                if (filePath && fileUri) {
                    const m = line.match(/^(-- include=\s*)([^\s]).*/);
                    if (!m) {
                        throw new Error('should exist a match');
                    }
                    const pos = m[1].length;
                    return { range: DocumentIncludes.toRange(line, i, pos) };
                }
                return null;
            });
            return links.filter((link) => !!link) as DocumentLink[];
        }
        return [];
    }
}

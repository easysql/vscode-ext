import { Definition, DocumentLink, Location, Position, Range, TextDocuments } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentAsts } from './ast';
import { Files } from './files';
import { DocumentIncludes } from './include';
import { Parser } from './shared/easysql';
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

    definition(): Definition | undefined {
        const filePath = DocumentIncludes.includeFilePath(this.line);
        if (this.position.character >= '-- '.length && this.position.character < '-- include'.length) {
            return undefined;
        } else {
            const fileUri = this.files.findFile(this.docUri, filePath);
            if (fileUri) {
                const range = {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 0 }
                };
                return Location.create(fileUri, range);
            }
            return undefined;
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
        private parser: Parser,
        private files: Files,
        private documents: TextDocuments<TextDocument>
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

    definition(): Definition | undefined {
        if (!this.tempTableName) {
            return undefined;
        }
        return this.documentAsts.findTempTableDefinition(this.doc, this.position.line, this.tempTableName)?.toDefinition();
    }
}

export class TemplateDefinition {
    private leftMatch: RegExpMatchArray | null = null;
    private rightMatch: RegExpMatchArray | null = null;
    constructor(private doc: TextDocument, private line: string, private position: Position, private documentAsts: DocumentAsts) {}

    accept(): boolean {
        const [leftText, rightText] = [this.line.substring(0, this.position.character), this.line.substring(this.position.character)];
        this.leftMatch = leftText.match(/@{(\w*)$/);
        this.rightMatch = rightText.match(/^(\w+)([^\w]|$)/);
        return !!(this.leftMatch && this.rightMatch);
    }

    definition(): Definition | undefined {
        const templateName = this.leftMatch![1] + this.rightMatch![1];
        return this.documentAsts.findTemplateDefinition(this.doc, this.position.line, templateName)?.toDefinition();
    }
}

export class DefinitionProvider {
    constructor(private files: Files, private documentAsts: DocumentAsts, private documents: TextDocuments<TextDocument>, private parser: Parser) {}

    onDefinition(position: Position, docUri: string): Definition | undefined {
        const doc = this.documents.get(docUri);
        if (doc) {
            const range: Range = { start: { line: position.line, character: 0 }, end: { line: position.line, character: 1000 } };
            const line = doc.getText(range);

            const includeDefinition = new IncludeDefinition(this.files, docUri, position, line);
            if (includeDefinition.accept()) {
                return includeDefinition.definition();
            }

            const tempTableDefinition = new TempTableDefinition(
                doc,
                docUri,
                line,
                position,
                this.documentAsts,
                this.parser,
                this.files,
                this.documents
            );
            if (tempTableDefinition.accept()) {
                return tempTableDefinition.definition();
            }

            const templateDefinition = new TemplateDefinition(doc, line, position, this.documentAsts);
            if (templateDefinition.accept()) {
                return templateDefinition.definition();
            }
        }
        return undefined;
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

import { Connection } from 'vscode-languageserver';
import { TextDocuments } from 'vscode-languageserver/node';
import { CodeCompleter } from './completion';
import { SettingsImpl } from './settings';

import { TextDocument } from 'vscode-languageserver-textdocument';

import { CodeDiagnosticProvider } from './diagnostic';
import { DocumentAsts } from './ast';
import { Parser } from './shared/easysql';
import { HighlightTokens as HighlightTokens } from './highlightTokens';
import { HighlightTokenParser } from './shared/highlight';

// Create a simple text document manager.
export class Services {
    constructor(private connection: Connection) {}
    public readonly completer = new CodeCompleter();
    public readonly settings = new SettingsImpl(this.connection);
    public readonly documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
    public readonly parser = new Parser();
    public readonly documentAsts = new DocumentAsts(this.parser);
    public readonly highlightTokenParser = new HighlightTokenParser();
    public readonly diagnostic = new CodeDiagnosticProvider(this.settings, this.documentAsts);
    public readonly highlightTokens = new HighlightTokens(this.parser, this.documentAsts, this.highlightTokenParser);
}
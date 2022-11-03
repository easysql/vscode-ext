import { Connection } from 'vscode-languageserver';
import { TextDocuments } from 'vscode-languageserver/node';
import { CodeCompleter } from './completion';
import { SettingsImpl } from './settings';

import { TextDocument } from 'vscode-languageserver-textdocument';

import { CodeDiagnosticProvider } from './diagnostic';

// Create a simple text document manager.
export class Services {
    constructor(private connection: Connection) {}
    public readonly completer = new CodeCompleter();
    public readonly settings = new SettingsImpl(this.connection);
    public readonly documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
    public readonly diagnostic = new CodeDiagnosticProvider(this.settings);
}

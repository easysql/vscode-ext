/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
    CompletionItem,
    createConnection,
    DidChangeConfigurationNotification,
    InitializeParams,
    InitializeResult,
    ProposedFeatures,
    TextDocumentPositionParams,
    TextDocumentSyncKind
} from 'vscode-languageserver/node';

import { Services } from './services';
import { logger } from './shared/logger';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

const services = new Services(connection);

connection.onInitialize((params: InitializeParams) => {
    logger.info('initializing server... at ', new Date());
    services.settings.init(params.capabilities);

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true
            }
        }
    };
    if (services.settings.hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});

connection.onInitialized(() => {
    if (services.settings.hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    if (services.settings.hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders((_event) => {
            connection.console.log('Workspace folder change event received.');
        });
    }
});

connection.onDidChangeConfiguration((change) => {
    services.settings.onChangeConfiguration(change);

    services.documents.all().forEach(async (doc) => {
        connection.sendDiagnostics({ uri: doc.uri, diagnostics: await services.diagnostic.validateTextDocument(doc) });
    });
});

services.documents.onDidClose((e) => {
    services.settings.removeDocSettings(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
services.documents.onDidChangeContent(async (change) => {
    const doc = change.document;
    connection.sendDiagnostics({ uri: doc.uri, diagnostics: await services.diagnostic.validateTextDocument(doc) });
});

connection.onDidChangeWatchedFiles((_change) => {
    // Monitored files have change in VSCode
    connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion((_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    return services.completer.complete(_textDocumentPosition);
});

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    return services.completer.resolveInformation(item);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
services.documents.listen(connection);

// Listen on the connection
connection.listen();

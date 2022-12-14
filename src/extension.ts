import * as path from 'path';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    activateLanguageServer(context);
}

export function deactivate(): Thenable<void> | undefined {
    return deactivateLanguageServer();
}

import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { logger } from './logger';

let client: LanguageClient;

export function activateLanguageServer(context: vscode.ExtensionContext) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for plain text documents
        documentSelector: [{ scheme: 'file', language: 'sql' }],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contained in the workspace
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
        }
    };

    // Create the language client and start the client.
    client = new LanguageClient('languageServerEasySQL', 'Language Server Easy SQL', serverOptions, clientOptions);

    // Start the client. This will also launch the server
    client.start();

    logger.info('start server...');
}

export function deactivateLanguageServer(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}

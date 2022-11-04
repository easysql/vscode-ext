import { ClientCapabilities, Connection } from 'vscode-languageserver/node';
import { ExampleSettings, Settings } from './types';

export class SettingsImpl implements Settings {
    public hasConfigurationCapability = false;
    public hasWorkspaceFolderCapability = false;
    public hasDiagnosticRelatedInformationCapability = false;
    public hasSemanticTokenCapability = false;

    private globalSettings: ExampleSettings;
    // Cache the settings of all open documents
    private documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();
    private readonly defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };

    constructor(private connection: Connection) {
        // The global settings, used when the `workspace/configuration` request is not supported by the client.
        // Please note that this is not the case when using this server with the client provided in this example
        // but could happen with other clients.
        this.globalSettings = this.defaultSettings;
    }

    init(capabilities: ClientCapabilities) {
        // Does the client support the `workspace/configuration` request?
        // If not, we fall back using global settings.
        this.hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
        this.hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
        this.hasDiagnosticRelatedInformationCapability = !!(
            capabilities.textDocument &&
            capabilities.textDocument.publishDiagnostics &&
            capabilities.textDocument.publishDiagnostics.relatedInformation
        );
        this.hasSemanticTokenCapability = !!(capabilities.textDocument && capabilities.textDocument.semanticTokens);
    }

    getDocumentSettings(resource: string): Thenable<ExampleSettings> {
        if (!this.hasConfigurationCapability) {
            return Promise.resolve(this.globalSettings);
        }
        let result = this.documentSettings.get(resource);
        if (!result) {
            result = this.connection.workspace.getConfiguration({
                scopeUri: resource,
                section: 'languageServerEasySQL'
            });
            this.documentSettings.set(resource, result);
        }
        return result;
    }

    onChangeConfiguration(change: any) {
        if (this.hasConfigurationCapability) {
            // Reset all cached document settings
            this.documentSettings.clear();
        } else {
            this.globalSettings = <ExampleSettings>(change.settings.languageServerEasySQL || this.defaultSettings);
        }
    }

    removeDocSettings(uri: string) {
        this.documentSettings.delete(uri);
    }
}

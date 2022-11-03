// The example settings
export interface ExampleSettings {
    maxNumberOfProblems: number;
}

export interface Settings {
    getDocumentSettings: (resource: string) => Thenable<ExampleSettings>;
    hasDiagnosticRelatedInformationCapability: boolean;
}

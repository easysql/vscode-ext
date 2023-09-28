// The example settings
export interface EasySQLSettings {
    maxNumberOfProblems: number;
    filePatternToSearchForReferences: string;
}

export interface Settings {
    getDocumentSettings: (resource: string) => Thenable<EasySQLSettings>;
    hasDiagnosticRelatedInformationCapability: boolean;
}

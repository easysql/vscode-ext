import fs from 'fs';
import path from 'path';
import { logger } from './shared/logger';

export class Files {
    private folders: Set<string> = new Set();
    addWorkspaceFolders(folderUris: string[]) {
        folderUris.forEach((uri) => this.folders.add(uri));
    }

    removeWorkspaceFolder(folderUris: string[]) {
        folderUris.forEach((uri) => this.folders.delete(uri));
    }

    findFile(baseFileUri: string, filePath: string): string | null {
        if (!filePath) {
            return null;
        }
        const folders = Array.from(this.folders.values());
        const folder = folders.find((folder) => baseFileUri.startsWith(folder.endsWith('/') ? folder : folder + '/'));
        if (!folder) {
            logger.warn('file not in any workspace: ', baseFileUri, folders);
            return null;
        }
        const candidates = [path.join(folder, filePath), path.join(folder, 'workflow', filePath), path.join(path.dirname(baseFileUri), filePath)];
        let found = candidates.find((cand) => fs.existsSync(cand.replace(/^file:\/\/?\/?/, '/')));
        found = found ? found.replace('file:/', 'file:///') : undefined;
        return found ? found : null;
    }
}

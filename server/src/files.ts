import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';
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

    findFiles(baseFileUri: string, filePattern: string): string[] {
        if (!filePattern) {
            return [];
        }
        const folders = Array.from(this.folders.values());
        const folder = folders.find((folder) => baseFileUri.startsWith(folder.endsWith('/') ? folder : folder + '/'));
        if (!folder) {
            logger.warn('file not in any workspace: ', baseFileUri, folders);
            return [];
        }

        return globSync(filePattern, { cwd: folder.replace(/^file:\/\/?\/?/, '/') }).map((file) => path.join(folder, file));
    }

    readFile(fileUri: string): string | null {
        return fs.readFileSync(fileUri.replace(/^file:\/\/?\/?/, '/'), 'utf8');
    }
}

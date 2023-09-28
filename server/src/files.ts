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

    findWorkspaceFolder(fileUri: string): string | undefined {
        return Array.from(this.folders.values()).find((folder) => fileUri.startsWith(folder.endsWith('/') ? folder : folder + '/'));
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

        const _folder = folder.replace(/^file:\/\/?\/?/, '/');
        return globSync(filePattern, { cwd: folder.replace(/^file:\/\/?\/?/, '/') }).map((file) => path.join(_folder, file));
    }

    readFile(fileUri: string): string | null {
        return fs.readFileSync(fileUri.replace(/^file:\/\/?\/?/, '/'), 'utf8');
    }
}

function globSync(filePattern: string, opts: { cwd: string }): string[] {
    const cwd = opts.cwd;
    const re = globToRegex(filePattern, { extended: true, globstar: true });
    return walk(opts.cwd)
        .map((f) => f.substring(cwd.endsWith('/') ? cwd.length : cwd.length + 1))
        .filter((file) => re.test(file));
}

function walk(dir: string): string[] {
    return fs.readdirSync(dir).flatMap((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            return walk(filePath).concat([filePath]);
        } else {
            return [filePath];
        }
    });
}

function globToRegex(glob: string, opts?: { extended: boolean; globstar: boolean; flags?: string }) {
    // ported from: https://github.com/fitzgen/glob-to-regexp
    if (typeof glob !== 'string') {
        throw new TypeError('Expected a string');
    }

    const str = new String(glob);

    // The regexp we are building, as a string.
    let reStr = '';

    // Whether we are matching so called "extended" globs (like bash) and should
    // support single character matching, matching ranges of characters, group
    // matching, etc.
    const extended = opts ? !!opts.extended : false;

    // When globstar is _false_ (default), '/foo/*' is translated a regexp like
    // '^\/foo\/.*$' which will match any string beginning with '/foo/'
    // When globstar is _true_, '/foo/*' is translated to regexp like
    // '^\/foo\/[^/]*$' which will match any string beginning with '/foo/' BUT
    // which does not have a '/' to the right of it.
    // E.g. with '/foo/*' these will match: '/foo/bar', '/foo/bar.txt' but
    // these will not '/foo/bar/baz', '/foo/bar/baz.txt'
    // Lastely, when globstar is _true_, '/foo/**' is equivelant to '/foo/*' when
    // globstar is _false_
    const globstar = opts ? !!opts.globstar : false;

    // If we are doing extended matching, this boolean is true when we are inside
    // a group (eg {*.html,*.js}), and false otherwise.
    let inGroup = false;

    // RegExp flags (eg "i" ) to pass in to RegExp constructor.
    const flags = opts && typeof opts.flags === 'string' ? opts.flags : '';

    let c;
    for (let i = 0, len = str.length; i < len; i++) {
        c = str[i];

        switch (c) {
            case '/':
            case '$':
            case '^':
            case '+':
            case '.':
            case '(':
            case ')':
            case '=':
            case '!':
            case '|':
                reStr += '\\' + c;
                break;

            case '?':
                if (extended) {
                    reStr += '.';
                    break;
                }

            // eslint-disable-next-line no-fallthrough
            case '[':
            case ']':
                if (extended) {
                    reStr += c;
                    break;
                }

            // eslint-disable-next-line no-fallthrough
            case '{':
                if (extended) {
                    inGroup = true;
                    reStr += '(';
                    break;
                }

            // eslint-disable-next-line no-fallthrough
            case '}':
                if (extended) {
                    inGroup = false;
                    reStr += ')';
                    break;
                }

            // eslint-disable-next-line no-fallthrough
            case ',':
                if (inGroup) {
                    reStr += '|';
                    break;
                }
                reStr += '\\' + c;
                break;

            case '*':
                // Move over all consecutive "*"'s.
                // Also store the previous and next characters
                // eslint-disable-next-line no-case-declarations
                const prevChar = str[i - 1];
                // eslint-disable-next-line no-case-declarations
                let starCount = 1;
                while (str[i + 1] === '*') {
                    starCount++;
                    i++;
                }
                // eslint-disable-next-line no-case-declarations
                const nextChar = str[i + 1];

                if (!globstar) {
                    // globstar is disabled, so treat any number of "*" as one
                    reStr += '.*';
                } else {
                    // globstar is enabled, so determine if this is a globstar segment
                    const isGlobstar =
                        starCount > 1 && // multiple "*"'s
                        (prevChar === '/' || prevChar === undefined) && // from the start of the segment
                        (nextChar === '/' || nextChar === undefined); // to the end of the segment

                    if (isGlobstar) {
                        // it's a globstar, so match zero or more path segments
                        reStr += '((?:[^/]*(?:/|$))*)';
                        i++; // move over the "/"
                    } else {
                        // it's not a globstar, so only match one path segment
                        reStr += '([^/]*)';
                    }
                }
                break;

            default:
                reStr += c;
        }
    }

    // When regexp 'g' flag is specified don't
    // constrain the regular expression with ^ & $
    if (!flags || !~flags.indexOf('g')) {
        reStr = '^' + reStr + '$';
    }

    return new RegExp(reStr, flags);
}

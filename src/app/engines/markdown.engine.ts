import * as path from 'node:path';
import decache from 'decache';
import * as fs from 'fs-extra';
import { markedAcl } from '../../utils/marked.acl';
import FileEngine from './file.engine';
import { highlightCode } from './syntax-highlight.engine';

export interface markdownReadedDatas {
    markdown: string;
    rawData: string;
}

export class MarkdownEngine {
    /**
     * List of markdown files without .md extension
     */
    private readonly markdownFiles = ['README', 'CHANGELOG', 'LICENSE', 'CONTRIBUTING', 'TODO'];

    private markedInstance;

    private static instance: MarkdownEngine;
    private constructor() {
        decache('marked');
        this.markedInstance = markedAcl;

        const renderer = new this.markedInstance.Renderer();
        renderer.code = (code, language) => {
            if (!language) {
                language = 'none';
            }

            let highlighted: string;
            try {
                highlighted = highlightCode(code, { lang: language, mode: 'snippet' });
            } catch {
                highlighted = `<pre class="shiki"><code>${this.escape(code)}</code></pre>`;
            }
            return `<div class="cdx-code-snippet">${highlighted}</div>`;
        };

        renderer.table = (header, body) => {
            return (
                '<table class="cdx-table">\n' +
                '<thead>\n' +
                header +
                '</thead>\n' +
                '<tbody>\n' +
                body +
                '</tbody>\n' +
                '</table>\n'
            );
        };

        renderer.heading = (text: string, level: number) => {
            const slug = text
                .toLowerCase()
                .replace(/<[^>]+>/g, '')
                .replace(/[^\w\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .trim();
            return `<h${level} id="${slug}">${text}<a href="#${slug}" class="cdx-member-permalink" aria-hidden="true">#</a></h${level}>`;
        };

        renderer.image = (href: string, title: string, text: string) => {
            let out = `<img src="${href}" alt="${text}" class="img-responsive"`;
            if (title) {
                out += ` title="${title}"`;
            }
            out += '>';
            return out;
        };

        this.markedInstance.setOptions({
            renderer: renderer,
            gfm: true,
            breaks: false
        });
    }
    public static getInstance() {
        if (!MarkdownEngine.instance) {
            MarkdownEngine.instance = new MarkdownEngine();
        }
        return MarkdownEngine.instance;
    }

    /** True when `<name>.md` or `<name>` exists in the cwd. */
    public hasTraditionalMarkdown(name: string): boolean {
        const file = process.cwd() + path.sep + name;
        return FileEngine.existsSync(`${file}.md`) || FileEngine.existsSync(file);
    }

    public getTraditionalMarkdown(filepath: string): Promise<markdownReadedDatas> {
        return FileEngine.get(`${process.cwd() + path.sep + filepath}.md`)
            .catch(_err => FileEngine.get(process.cwd() + path.sep + filepath))
            .then(data => {
                const returnedData: markdownReadedDatas = {
                    markdown: this.markedInstance(data),
                    rawData: data
                };
                return returnedData;
            });
    }

    public getTraditionalMarkdownSync(filepath: string): string {
        return this.markedInstance(FileEngine.getSync(process.cwd() + path.sep + filepath));
    }

    public getTraditionalMarkdownSyncWithRaw(filepath: string): { html: string; raw: string } {
        const raw = FileEngine.getSync(process.cwd() + path.sep + filepath);
        return { html: this.markedInstance(raw), raw };
    }

    public readNeighbourReadmeFile(file: string): string {
        const dirname = path.dirname(file);
        const readmeFile = `${dirname + path.sep + path.basename(file, '.ts')}.md`;
        return fs.readFileSync(readmeFile, 'utf8');
    }

    public hasNeighbourReadmeFile(file: string): boolean {
        const dirname = path.dirname(file);
        const readmeFile = `${dirname + path.sep + path.basename(file, '.ts')}.md`;
        return FileEngine.existsSync(readmeFile);
    }

    /**
     * Checks if any of the markdown files is exists with or without endings
     */
    public hasRootMarkdowns(): boolean {
        return this.addEndings(this.markdownFiles).some(x =>
            FileEngine.existsSync(process.cwd() + path.sep + x)
        );
    }

    public listRootMarkdowns(): string[] {
        const foundFiles = this.markdownFiles.filter(
            x =>
                FileEngine.existsSync(`${process.cwd() + path.sep + x}.md`) ||
                FileEngine.existsSync(process.cwd() + path.sep + x)
        );

        return this.addEndings(foundFiles);
    }

    // Fenced-code fallback; unlike escapeHtmlText it also escapes `'` and `@`, kept so its bytes stay the same.
    private escape(html: string): string {
        return html
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/@/g, '&#64;');
    }

    /**
     * ['README'] => ['README', 'README.md']
     */
    private addEndings(files: Array<string>): Array<string> {
        return files.flatMap(x => [x, `${x}.md`]);
    }
}

export default MarkdownEngine.getInstance();

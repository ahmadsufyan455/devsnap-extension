export interface SnapshotConfig {
    theme: string;
    showLineNumbers: boolean;
    showWindowControls: boolean;
    fontSize: number;
}

// Map theme names to Shiki theme names
const THEME_MAP: Record<string, string> = {
    'dracula': 'dracula',
    'monokai': 'monokai',
    'one-dark': 'one-dark-pro',
    'nord': 'nord',
    'night-owl': 'night-owl',
    'solarized-dark': 'solarized-dark',
    'solarized-light': 'solarized-light',
    'github-dark': 'github-dark',
    'material': 'material-theme-darker',
    'cobalt': 'monokai',
    'darcula': 'andromeeda',
    'gruvbox-dark': 'github-dark',
    'tokyo-night': 'tokyo-night'
};

export class ImageGenerator {
    private highlighter: any = null;
    private shiki: any = null;

    async initialize() {
        if (!this.highlighter) {
            // Dynamic import for ESM modules
            this.shiki = await import('shiki');
            
            this.highlighter = await this.shiki.getHighlighter({
                themes: Object.values(THEME_MAP),
                langs: [
                    'python', 'javascript', 'typescript', 'java', 'cpp', 'c', 'csharp',
                    'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'html', 'css',
                    'json', 'yaml', 'sql', 'bash', 'shell', 'dart', 'markdown'
                ]
            });
        }
    }

    async generateHTML(
        code: string,
        language: string,
        fileName: string,
        config: SnapshotConfig
    ): Promise<string> {
        await this.initialize();

        if (!this.highlighter) {
            throw new Error('Generator not initialized');
        }

        // Get the Shiki theme name
        const themeName = THEME_MAP[config.theme] || 'dracula';

        // Generate HTML with syntax highlighting (includes inline styles)
        const highlightedHtml = this.highlighter.codeToHtml(code, {
            lang: this.mapLanguage(language),
            theme: themeName
        });

        // Create complete HTML document
        return this.createStyledHTML(highlightedHtml, fileName, config);
    }

    private mapLanguage(vscodeLanguage: string): string {
        const languageMap: Record<string, string> = {
            'javascript': 'javascript',
            'typescript': 'typescript',
            'python': 'python',
            'java': 'java',
            'cpp': 'cpp',
            'c': 'c',
            'csharp': 'csharp',
            'go': 'go',
            'rust': 'rust',
            'ruby': 'ruby',
            'php': 'php',
            'swift': 'swift',
            'kotlin': 'kotlin',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'yaml': 'yaml',
            'sql': 'sql',
            'bash': 'bash',
            'shell': 'bash',
            'sh': 'bash',
            'dart': 'dart',
            'markdown': 'markdown',
            'md': 'markdown'
        };

        return languageMap[vscodeLanguage] || 'text';
    }

    private createStyledHTML(highlightedCode: string, fileName: string, config: SnapshotConfig): string {
        const fontSize = config.fontSize;
        const lineHeight = fontSize * 1.6;

        // Extract background color from Shiki's pre tag
        const bgMatch = highlightedCode.match(/style="[^"]*background-color:\s*([^;"]+)/);
        const themeBg = bgMatch ? bgMatch[1] : '#282a36';

        // Extract code content with all HTML/styling preserved
        const codeMatch = highlightedCode.match(/<code[^>]*>([\s\S]*?)<\/code>/);
        const codeContent = codeMatch ? codeMatch[1] : '';
        
        // Split into lines preserving HTML tags
        const lines = codeContent.split('\n');
        const processedLines = lines.map((line, index) => {
            const lineNum = index + 1;
            if (config.showLineNumbers) {
                return `<div class="line"><span class="line-number">${lineNum}</span><span class="line-content">${line || '&nbsp;'}</span></div>`;
            } else {
                return `<div class="line"><span class="line-content">${line || '&nbsp;'}</span></div>`;
            }
        }).join('');

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Menlo', 'Monaco', 'Courier New', 'Consolas', monospace;
            display: inline-block;
            background: transparent;
        }
        
        .container {
            background: ${themeBg};
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 20px 68px rgba(0, 0, 0, 0.55);
        }
        
        .window-controls {
            height: 40px;
            background: ${themeBg};
            display: flex;
            align-items: center;
            padding: 0 20px;
        }
        
        .dots {
            display: flex;
            gap: 8px;
        }
        
        .dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }
        
        .dot.red { background: #ff5f56; }
        .dot.yellow { background: #ffbd2e; }
        .dot.green { background: #27c93f; }
        
        .filename {
            margin-left: 16px;
            color: rgba(255, 255, 255, 0.6);
            font-size: 13px;
        }
        
        .code-wrapper {
            padding: 24px;
            background: ${themeBg};
        }
        
        .code-content {
            font-family: 'Menlo', 'Monaco', 'Courier New', 'Consolas', monospace;
            font-size: ${fontSize}px;
            line-height: ${lineHeight}px;
            background: transparent;
        }
        
        .line {
            display: flex;
            min-height: ${lineHeight}px;
            white-space: pre;
            background: transparent;
        }
        
        .line-number {
            display: inline-block;
            min-width: 40px;
            text-align: right;
            margin-right: 24px;
            color: rgba(255, 255, 255, 0.3);
            user-select: none;
            flex-shrink: 0;
        }
        
        .line-content {
            flex: 1;
            white-space: pre;
            background: transparent;
        }
    </style>
</head>
<body>
    <div class="container">
        ${config.showWindowControls ? `
        <div class="window-controls">
            <div class="dots">
                <div class="dot red"></div>
                <div class="dot yellow"></div>
                <div class="dot green"></div>
            </div>
            <div class="filename">${this.escapeHtml(fileName)}</div>
        </div>
        ` : ''}
        <div class="code-wrapper">
            <div class="code-content">
                ${processedLines}
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

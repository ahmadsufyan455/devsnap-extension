import { exec } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { ImageGenerator, SnapshotConfig } from './imageGenerator.js';

const execAsync = promisify(exec);
const imageGenerator = new ImageGenerator();

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('devsnap.snap', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        const code = editor.document.getText(editor.selection);
        if (!code) {
            vscode.window.showInformationMessage('Select code first!');
            return;
        }

        const language = editor.document.languageId;
        const fileName = path.basename(editor.document.fileName);

        // Default configuration
        let config: SnapshotConfig = {
            theme: 'dracula',
            showLineNumbers: true,
            showWindowControls: true,
            fontSize: 14
        };

        // 1. Create and show a new Webview Panel
        const panel = vscode.window.createWebviewPanel(
            'devSnapPreview',
            'DevSnap Preview',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        // Show initial configuration UI
        panel.webview.html = getConfigurationWebview(code, language, fileName, config);

        panel.webview.onDidReceiveMessage(
            async message => {
                if (message.command === 'updatePreview') {
                    // Update configuration
                    config = message.config;

                    try {
                        // Generate HTML with syntax highlighting
                        const styledHtml = await imageGenerator.generateHTML(
                            code,
                            language,
                            fileName,
                            config
                        );

                        // Send HTML to webview to render and capture
                        panel.webview.postMessage({
                            command: 'renderAndCapture',
                            html: styledHtml
                        });

                    } catch (err) {
                        vscode.window.showErrorMessage('Failed to generate preview');
                        console.error('Generation error:', err);
                    }
                } else if (message.command === 'imageCaptured') {
                    // Received captured image from webview
                    panel.webview.postMessage({
                        command: 'updateImage',
                        image: message.data
                    });
                } else if (message.command === 'copyImage') {
                    try {
                        // Convert base64 to Buffer
                        const imageBuffer = Buffer.from(message.data, 'base64');

                        // Create a temporary file
                        const tempDir = os.tmpdir();
                        const tempFilePath = path.join(tempDir, `devsnap-${Date.now()}.png`);

                        // Write the image to the temp file
                        fs.writeFileSync(tempFilePath, imageBuffer);

                        // Copy to clipboard based on platform
                        const platform = process.platform;

                        if (platform === 'darwin') {
                            // macOS
                            await execAsync(`osascript -e 'set the clipboard to (read (POSIX file "${tempFilePath}") as «class PNGf»)'`);
                        } else if (platform === 'linux') {
                            // Linux (requires xclip)
                            await execAsync(`xclip -selection clipboard -t image/png -i "${tempFilePath}"`);
                        } else if (platform === 'win32') {
                            // Windows (using PowerShell)
                            const psScript = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetImage([System.Drawing.Image]::FromFile('${tempFilePath.replace(/\\/g, '\\\\')}'))`;
                            await execAsync(`powershell -command "${psScript}"`);
                        }

                        // Clean up temp file
                        fs.unlinkSync(tempFilePath);

                        vscode.window.showInformationMessage('Image copied to clipboard! 🎉');
                    } catch (error) {
                        vscode.window.showErrorMessage('Failed to copy image to clipboard');
                        console.error('Clipboard error:', error);
                    }
                }
            },
            undefined,
            context.subscriptions
        );

        // Generate initial preview
        try {
            // Generate HTML with syntax highlighting
            const styledHtml = await imageGenerator.generateHTML(
                code,
                language,
                fileName,
                config
            );

            // Send HTML to webview to render and capture
            panel.webview.postMessage({
                command: 'renderAndCapture',
                html: styledHtml
            });

        } catch (err) {
            vscode.window.showErrorMessage('Failed to generate snapshot.');
            console.error('Generation error:', err);
            panel.dispose();
        }
    });

    context.subscriptions.push(disposable);
}

// Helper function to generate the Configuration and Preview UI
function getConfigurationWebview(code: string, language: string, fileName: string, config: SnapshotConfig) {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { 
                    display: flex;
                    height: 100vh; 
                    background: #1e1e1e; 
                    color: #cccccc;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    font-size: 13px;
                }
                
                .sidebar {
                    width: 280px;
                    background: #252526;
                    border-right: 1px solid #3e3e42;
                    padding: 20px;
                    overflow-y: auto;
                }
                
                .main-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    overflow-y: auto;
                }
                
                h2 {
                    color: #ffffff;
                    font-size: 16px;
                    margin-bottom: 20px;
                    font-weight: 600;
                }
                
                .control-group {
                    margin-bottom: 20px;
                }
                
                label {
                    display: block;
                    margin-bottom: 6px;
                    color: #cccccc;
                    font-size: 12px;
                    font-weight: 500;
                }
                
                select, input[type="number"], input[type="color"] {
                    width: 100%;
                    padding: 6px 8px;
                    background: #3c3c3c;
                    border: 1px solid #3e3e42;
                    color: #cccccc;
                    border-radius: 4px;
                    font-size: 13px;
                }
                
                select:focus, input:focus {
                    outline: none;
                    border-color: #007acc;
                }
                
                input[type="color"] {
                    height: 36px;
                    cursor: pointer;
                }
                
                .checkbox-group {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                input[type="checkbox"] {
                    width: 16px;
                    height: 16px;
                    cursor: pointer;
                }
                
                .range-group {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                input[type="range"] {
                    flex: 1;
                }
                
                .range-value {
                    min-width: 40px;
                    text-align: right;
                    color: #007acc;
                    font-weight: 500;
                }
                
                img { 
                    max-width: 100%;
                    max-height: calc(100vh - 140px);
                    box-shadow: 0 10px 40px rgba(0,0,0,0.6); 
                    border-radius: 8px;
                    margin-bottom: 20px;
                    opacity: 1;
                    transition: opacity 0.2s ease-in-out;
                }
                
                img.updating {
                    opacity: 0.5;
                }
                
                .loading {
                    color: #cccccc;
                    font-size: 14px;
                }
                
                .preview-container {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                
                .loading-overlay {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(0, 0, 0, 0.7);
                    padding: 12px 24px;
                    border-radius: 4px;
                    color: #fff;
                    font-size: 13px;
                    display: none;
                    z-index: 10;
                }
                
                .loading-overlay.visible {
                    display: block;
                }
                
                button {
                    width: 100%;
                    padding: 10px 20px; 
                    background: #007acc; 
                    color: white;
                    border: none; 
                    border-radius: 4px; 
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    transition: background 0.2s;
                }
                
                button:hover { 
                    background: #005a9e; 
                }
                
                button:active {
                    background: #004578;
                }
                
                .info {
                    background: #2d2d30;
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 20px;
                    font-size: 11px;
                    line-height: 1.5;
                }
                
                .info strong {
                    color: #ffffff;
                }
            </style>
        </head>
        <body>
            <div class="sidebar">
                <h2>Snapshot Settings</h2>
                
                <div class="info">
                    <strong>Language:</strong> ${language}<br>
                    <strong>File:</strong> ${fileName}
                </div>
                
                <div class="control-group">
                    <label for="theme">Theme</label>
                    <select id="theme">
                        <option value="dracula">Dracula</option>
                        <option value="monokai">Monokai</option>
                        <option value="one-dark">One Dark</option>
                        <option value="nord">Nord</option>
                        <option value="night-owl">Night Owl</option>
                        <option value="solarized-dark">Solarized Dark</option>
                        <option value="solarized-light">Solarized Light</option>
                        <option value="github-dark">GitHub Dark</option>
                        <option value="material">Material</option>
                        <option value="cobalt">Cobalt</option>
                        <option value="darcula">Darcula</option>
                        <option value="gruvbox-dark">Gruvbox Dark</option>
                        <option value="tokyo-night">Tokyo Night</option>
                    </select>
                </div>
                
                <div class="control-group">
                    <label for="fontSize">Font Size</label>
                    <div class="range-group">
                        <input type="range" id="fontSize" min="10" max="24" value="${config.fontSize}">
                        <span class="range-value" id="fontSizeValue">${config.fontSize}px</span>
                    </div>
                </div>
                
                <div class="control-group">
                    <div class="checkbox-group">
                        <input type="checkbox" id="showLineNumbers" ${config.showLineNumbers ? 'checked' : ''}>
                        <label for="showLineNumbers" style="margin: 0;">Show Line Numbers</label>
                    </div>
                </div>
                
                <div class="control-group">
                    <div class="checkbox-group">
                        <input type="checkbox" id="showWindowControls" ${config.showWindowControls ? 'checked' : ''}>
                        <label for="showWindowControls" style="margin: 0;">Show Window Controls</label>
                    </div>
                </div>
            </div>
            
            <div class="main-content">
                <div class="preview-container">
                    <div id="preview">
                        <div class="loading">Generating preview...</div>
                    </div>
                    <div id="loadingOverlay" class="loading-overlay">Updating...</div>
                </div>
                <button id="copyBtn" style="display: none;">Copy to Clipboard</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let currentImage = null;
                
                // Get all control elements
                const theme = document.getElementById('theme');
                const fontSize = document.getElementById('fontSize');
                const fontSizeValue = document.getElementById('fontSizeValue');
                const showLineNumbers = document.getElementById('showLineNumbers');
                const showWindowControls = document.getElementById('showWindowControls');
                const copyBtn = document.getElementById('copyBtn');
                
                // Update range display values
                fontSize.addEventListener('input', (e) => {
                    fontSizeValue.textContent = e.target.value + 'px';
                });
                
                // Debounce function to avoid too many updates
                let debounceTimer;
                function debounceUpdate() {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(updatePreview, 500);
                }
                
                // Listen for changes on all controls
                [theme, fontSize, showLineNumbers, showWindowControls].forEach(el => {
                    el.addEventListener('change', debounceUpdate);
                    if (el.type === 'range') {
                        el.addEventListener('input', debounceUpdate);
                    }
                });
                
                function updatePreview() {
                    // Show loading overlay
                    const loadingOverlay = document.getElementById('loadingOverlay');
                    const preview = document.getElementById('preview');
                    const img = preview.querySelector('img');
                    
                    if (img) {
                        img.classList.add('updating');
                        loadingOverlay.classList.add('visible');
                    }
                    
                    const config = {
                        theme: theme.value,
                        showLineNumbers: showLineNumbers.checked,
                        showWindowControls: showWindowControls.checked,
                        fontSize: parseInt(fontSize.value)
                    };
                    
                    vscode.postMessage({ 
                        command: 'updatePreview', 
                        config: config 
                    });
                }
                
                function copyToClipboard() {
                    if (currentImage) {
                        vscode.postMessage({ 
                            command: 'copyImage', 
                            data: currentImage 
                        });
                    }
                }
                
                copyBtn.addEventListener('click', copyToClipboard);
                
                // Listen for messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'updateImage') {
                        currentImage = message.image;
                        const preview = document.getElementById('preview');
                        const loadingOverlay = document.getElementById('loadingOverlay');
                        
                        // Update image
                        preview.innerHTML = '<img src="data:image/png;base64,' + message.image + '" />';
                        
                        // Hide loading overlay
                        loadingOverlay.classList.remove('visible');
                        
                        copyBtn.style.display = 'block';
                    } else if (message.command === 'renderAndCapture') {
                        // Render HTML and capture as image
                        renderAndCapture(message.html);
                    }
                });
                
                // html2canvas CDN
                function loadHtml2Canvas() {
                    return new Promise((resolve, reject) => {
                        if (window.html2canvas) {
                            resolve(window.html2canvas);
                            return;
                        }
                        const script = document.createElement('script');
                        script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
                        script.onload = () => resolve(window.html2canvas);
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                }
                
                async function renderAndCapture(html) {
                    try {
                        // Load html2canvas if not already loaded
                        const html2canvas = await loadHtml2Canvas();
                        
                        // Create temporary container
                        const container = document.createElement('div');
                        container.style.position = 'absolute';
                        container.style.left = '-9999px';
                        container.innerHTML = html;
                        document.body.appendChild(container);
                        
                        // Wait for fonts and styles to load
                        await new Promise(resolve => setTimeout(resolve, 100));
                        
                        // Capture as canvas
                        const canvas = await html2canvas(container, {
                            backgroundColor: null,
                            scale: 2, // Higher quality
                            logging: false
                        });
                        
                        // Convert to base64
                        const base64 = canvas.toDataURL('image/png').split(',')[1];
                        
                        // Clean up
                        document.body.removeChild(container);
                        
                        // Send back to extension
                        vscode.postMessage({
                            command: 'imageCaptured',
                            data: base64
                        });
                    } catch (error) {
                        console.error('Capture error:', error);
                    }
                }
            </script>
        </body>
        </html>
    `;
}
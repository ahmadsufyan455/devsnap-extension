import axios from 'axios';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';

const execAsync = promisify(exec);

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('devsnap.snap', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) { return; }

		const code = editor.document.getText(editor.selection);
		if (!code) {
			vscode.window.showInformationMessage('Select code first!');
			return;
		}

		// 1. Create and show a new Webview Panel
		const panel = vscode.window.createWebviewPanel(
			'devSnapPreview',
			'DevSnap Preview',
			vscode.ViewColumn.Beside, // Opens it to the side of the editor
			{ enableScripts: true }
		);

		panel.webview.onDidReceiveMessage(
			async message => {
				if (message.command === 'copyImage') {
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

		try {
			// 2. Call your Python API
			const response = await axios.post('http://localhost:8000/generate', {
				code: code,
				language: editor.document.languageId
			});

			const b64Data = response.data.image_b64;

			// 3. Set the HTML content of the Webview
			panel.webview.html = getWebviewContent(b64Data);

		} catch (err) {
			vscode.window.showErrorMessage('Failed to connect to Python backend.');
			panel.dispose();
		}
	});

	context.subscriptions.push(disposable);
}

// 4. Helper function to generate the Preview UI
function getWebviewContent(b64Data: string) {
	return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <style>
                body { 
                    display: flex; flex-direction: column; 
                    align-items: center; justify-content: center; 
                    height: 100vh; background: #1e1e1e; color: white;
                    font-family: sans-serif;
                }
                img { 
                    max-width: 90%; box-shadow: 0 10px 30px rgba(0,0,0,0.5); 
                    border-radius: 8px; margin-bottom: 20px;
                }
                button {
                    padding: 10px 20px; background: #007acc; color: white;
                    border: none; border-radius: 4px; cursor: pointer;
                }
                button:hover { background: #005a9e; }
            </style>
        </head>
        <body>
            <h3>Preview</h3>
            <img src="data:image/png;base64,${b64Data}" />
            <button onclick="copyToClipboard()">Copy to Clipboard</button>

            <script>
				const vscode = acquireVsCodeApi();
				function copyToClipboard() {
					// Send the raw base64 string back to the extension
					vscode.postMessage({ 
						command: 'copyImage', 
						data: '${b64Data}' 
					});
				}
			</script>
        </body>
        </html>
    `;
}
/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as utils from "./utils";
import { CamelDefinitionYaml } from "karavan-core/lib/api/CamelDefinitionYaml";
import { Integration } from "karavan-core/lib/model/IntegrationDefinition";

const KARAVAN_LOADED = "karavan:loaded";
const KARAVAN_PANELS: Map<string, vscode.WebviewPanel> = new Map<string, vscode.WebviewPanel>();

export class DesignerView {

    constructor(private context: vscode.ExtensionContext, private webviewContent: string, private rootPath?: string) {

    }

    karavanOpen(fullPath: string) {
        const yaml = fs.readFileSync(path.resolve(fullPath)).toString('utf8');
        const filename = path.basename(fullPath);
        const relativePath = utils.getRalativePath(fullPath);
        const integration = utils.parceYaml(filename, yaml);

        if (integration[0]) {
            this.openKaravanWebView(filename, relativePath, integration[1]);
        } else {
            vscode.window.showErrorMessage("File is not Camel Integration!")
        }
    }

    jbangRun(fullPath: string) {
        if (fullPath.startsWith('webview-panel/webview')) {
            const filename = Array.from(KARAVAN_PANELS.entries()).filter(({ 1: v }) => v.active).map(([k]) => k)[0];
            if (filename) {
                utils.runCamelJbang(filename);
            }
        } else {
            const yaml = fs.readFileSync(path.resolve(fullPath)).toString('utf8');
            const relativePath = utils.getRalativePath(fullPath);
            const filename = path.basename(fullPath);
            const integration = utils.parceYaml(filename, yaml);
            if (integration[0]) {
                utils.runCamelJbang(relativePath);
            } else {
                vscode.window.showErrorMessage("File is not Camel-K Integration!")
            }
        }
    }

    createIntegration(crd: boolean, fullPath?: string) {
        console.log(fullPath);
        vscode.window
            .showInputBox({
                title: crd ? "Create Camel-K Integration CRD" : "Create Camel Integration YAML",
                ignoreFocusOut: true,
                prompt: "Integration name",
                validateInput: (text: string): string | undefined => {
                    if (!text || text.length === 0) {
                        return 'Name should not be empty';
                    } else {
                        return undefined;
                    }
                }
            }).then(value => {
                if (value) {
                    const name = utils.nameFromTitle(value);
                    const i = Integration.createNew(name);
                    i.crd = crd;
                    const yaml = CamelDefinitionYaml.integrationToYaml(i);
                    const filename = name.toLocaleLowerCase().endsWith('.yaml') ? name : name + '.yaml';
                    const relativePath = (this.rootPath ? fullPath?.replace(this.rootPath, "") : fullPath) + path.sep + filename;
                    console.log(relativePath);
                    utils.save(relativePath, yaml);
                    this.openKaravanWebView(filename, filename, yaml);
                    vscode.commands.executeCommand('integrations.refresh');
                }
            });
    }

    openKaravanWebView(filename: string, relativePath: string, yaml?: string) {
        // Karavan webview
        const panel = vscode.window.createWebviewPanel(
            "karavan",
            filename,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, "dist"),
                ],
            }
        );
        panel.webview.html = this.webviewContent;
        panel.iconPath = vscode.Uri.joinPath(
            this.context.extensionUri,
            "icons/karavan.svg"
        );

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'save':
                        utils.save(message.relativePath, message.yaml);
                        break;
                    case 'getData':
                        this.sendData(panel, filename, relativePath, yaml);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
        KARAVAN_PANELS.set(relativePath, panel);
        vscode.commands.executeCommand("setContext", KARAVAN_LOADED, true);
    }
    sendData(panel: vscode.WebviewPanel, filename: string, relativePath: string, yaml?: string) {

        // Read and send Kamelets
        console.log("Kamelets sent");
        panel.webview.postMessage({ command: 'kamelets', kamelets: utils.readKamelets(this.context) });

        // Read and send Components
        console.log("Components sent");
        panel.webview.postMessage({ command: 'components', components: utils.readComponents(this.context) });

        // Send integration
        panel.webview.postMessage({ command: 'open', filename: filename, relativePath: relativePath, yaml: yaml });
    }

}
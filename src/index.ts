/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { PACKAGE_NAME } from './consts';
import * as extensionApi from '@podman-desktop/api';

export class Macadam {
  #macadamPath: string;
  #utilitiesPath: string;
  
  constructor(private type: string) {

  }

  async init(): Promise<void> {
    this.#macadamPath = await this.getMacadamPath();
    this.#utilitiesPath = await this.getUtilitiesPath();
  }

  async getMacadamPath(): Promise<string> {
    let bin = '';
    if (extensionApi.env.isWindows) {
      bin = 'macadam-windows-amd64.exe';
    } else if (extensionApi.env.isMac) {
      if (os.arch() === 'arm64') {
        bin = 'macadam-darwin-arm64';
      } else if (os.arch() == 'x64') {
        bin = 'macadam-darwin-amd64';
      }
    }
    if (!bin) {
      throw new Error(`binary not found for platform ${os.platform()} and architecture ${os.arch()}`);
    }
    const packagePath = path.dirname(require.resolve(`${PACKAGE_NAME}/package.json`));
  
    const filepath = path.resolve(packagePath, 'binaries', bin);
    await fs.promises.chmod(filepath, '755');
    return filepath;
  }

  async getUtilitiesPath(): Promise<string> {
    const utilities = ['vfkit', 'gvproxy'];
    let path: string = '';
    for (const utility of utilities) {
      const utilityPath = await this.findExecutableInPath(utility);
      if (path && utilityPath !== path) {
        throw new Error(`utilities must be in the same directory: ${utilities.join(', ')}`);
      }
      path = utilityPath;
    }
    return path;
  }

  async findExecutableInPath(executable: string): Promise<string> {
    if (extensionApi.env.isMac) {
      // grab full path for Linux and mac
      const { stdout: fullPath } = await extensionApi.process.exec('which', [executable]);
      return fullPath;
    } else if (extensionApi.env.isWindows) {
      // grab full path for Windows
      const { stdout: fullPath } = await extensionApi.process.exec('where.exe', [executable]);
      // remove all line break/carriage return characters from full path
      return fullPath.replace(/(\r\n|\n|\r)/gm, '');
    }
    throw new Error('Platform not supported: Mac and Windows platforms are the only ones supported');
  }
}

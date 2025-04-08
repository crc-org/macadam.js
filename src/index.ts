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

export async function getMacadamPath(): Promise<string> {
  let bin = '';
  if (os.platform() === 'win32') {
    bin = 'macadam-windows-amd64.exe';
  } else if (os.platform() === 'darwin') {
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

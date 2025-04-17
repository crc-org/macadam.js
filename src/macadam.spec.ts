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
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Macadam } from '.';
import * as extensionApi from '@podman-desktop/api';
import * as fs from 'node:fs';

class TestMacadam extends Macadam {
  override _init(resolver?: (request: string, options?: NodeJS.RequireResolveOptions) => string): Promise<void> {
    return super._init(resolver);
  }

  override getMacadamPath(): string {
    return super.getMacadamPath();
  }

  override getUtilitiesPath(): string | undefined {
    return super.getUtilitiesPath();
  }
}

let macadam: TestMacadam;

vi.mock('@podman-desktop/api', async () => {
  return {
    process: {
      exec: vi.fn(),
    },
    env: {
      isLinux: false,
      isWindows: false,
      isMac: false,
      createTelemetryLogger: vi.fn(),
    },
  };
});

vi.mock('node:fs', async () => {
  return {
    promises: {
      chmod: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  macadam = new TestMacadam('mytype');
});

test('init on Mac', async () => {
  vi.mocked(extensionApi.env).isMac = true;
  vi.mocked(extensionApi.env).isWindows = false;
  const resolver = vi.fn<(request: string, options?: NodeJS.RequireResolveOptions) => string>();
  resolver.mockReturnValue('/path/to/extension/package.json');
  vi.mocked(extensionApi.process.exec).mockResolvedValue({ stdout: '/path/to/utilities/utility', stderr: '', command: ''});
  await macadam._init(resolver);

  expect(macadam.getMacadamPath()).toEqual('/path/to/extension/binaries/macadam-darwin-arm64');
  expect(fs.promises.chmod).toHaveBeenCalledWith('/path/to/extension/binaries/macadam-darwin-arm64', '755');

  expect(macadam.getUtilitiesPath()).toEqual('/path/to/utilities');
});


test('init on Windows', async () => {
  vi.mocked(extensionApi.env).isMac = false;
  vi.mocked(extensionApi.env).isWindows = true;
  const resolver = vi.fn<(request: string, options?: NodeJS.RequireResolveOptions) => string>();
  resolver.mockReturnValue('/path/to/extension/package.json');
  vi.mocked(extensionApi.process.exec).mockResolvedValue({ stdout: '/path/to/utilities/utility', stderr: '', command: ''});
  await macadam._init(resolver);

  expect(macadam.getMacadamPath()).toEqual('/path/to/extension/binaries/macadam-windows-amd64.exe');
  expect(fs.promises.chmod).toHaveBeenCalledWith('/path/to/extension/binaries/macadam-windows-amd64.exe', '755');

  expect(macadam.getUtilitiesPath()).toBeUndefined();
});

describe('init is done', async () => {

  beforeEach(async () => {
    vi.mocked(extensionApi.env).isMac = true;
    vi.mocked(extensionApi.env).isWindows = false;
    const resolver = vi.fn<(request: string, options?: NodeJS.RequireResolveOptions) => string>();
    resolver.mockReturnValue('/path/to/extension/package.json');
    vi.mocked(extensionApi.process.exec).mockResolvedValue({ stdout: '/path/to/utilities/utility', stderr: '', command: ''});
    await macadam._init(resolver);  
  });

  test('listVms', async () => {
    vi.mocked(extensionApi.process.exec).mockResolvedValue({ stdout: `[
  {
      "Image": "/Users/me/.local/share/containers/macadam/machine/applehv/macadam-applehv.raw",
      "Running": false,
      "Starting": false,
      "CPUs": 2,
      "Memory": "4294967296",
      "DiskSize": "21474836480",
      "Port": 49378,
      "RemoteUsername": "core",
      "IdentityPath": "/Users/phmartin/.local/share/containers/macadam/machine/machine",
      "VMType": "applehv"
  }
]`, stderr: '', command: ''});
    const result = await macadam.listVms({});
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      Image: "/Users/me/.local/share/containers/macadam/machine/applehv/macadam-applehv.raw",
      Running: false,
      Starting: false,
      CPUs: 2,
      Memory: "4294967296",
      DiskSize: "21474836480",
      Port: 49378,
      RemoteUsername: "core",
      IdentityPath: "/Users/phmartin/.local/share/containers/macadam/machine/machine",
      VMType: "applehv"
    });
  });  
});

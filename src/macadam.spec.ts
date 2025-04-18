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
import { chmod } from 'node:fs/promises';
import { platform } from 'node:os';
import { resolve } from 'node:path';

import * as extensionApi from '@podman-desktop/api';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Macadam } from '.';

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

  override getFinalOptions(runOptions?: extensionApi.RunOptions, containerProvider?: string): extensionApi.RunOptions {
    return super.getFinalOptions(runOptions, containerProvider);
  }
}

vi.mock(import('node:fs/promises'));

let macadam: TestMacadam;

beforeEach(() => {
  vi.resetAllMocks();
  macadam = new TestMacadam('mytype');
});

test(
  'init on Mac',
  {
    skip: platform() !== 'darwin',
  },
  async () => {
    vi.mocked(extensionApi.env).isMac = true;
    vi.mocked(extensionApi.env).isWindows = false;
    const resolver = vi.fn<(request: string, options?: NodeJS.RequireResolveOptions) => string>();
    resolver.mockReturnValue(resolve('/', 'path', 'to', 'extension', 'package.json'));
    vi.mocked(extensionApi.process.exec).mockResolvedValue({
      stdout: resolve('/', 'path', 'to', 'utilities', 'utility'),
      stderr: '',
      command: '',
    });
    await macadam._init(resolver);

    expect(macadam.getMacadamPath()).toEqual(
      resolve('/', 'path', 'to', 'extension', 'binaries', 'macadam-darwin-arm64'),
    );
    expect(chmod).toHaveBeenCalledWith(
      resolve('/', 'path', 'to', 'extension', 'binaries', 'macadam-darwin-arm64'),
      '755',
    );

    expect(macadam.getUtilitiesPath()).toEqual(resolve('/', 'path', 'to', 'utilities'));
  },
);

test(
  'init on Windows',
  {
    skip: platform() !== 'win32',
  },
  async () => {
    vi.mocked(extensionApi.env).isMac = false;
    vi.mocked(extensionApi.env).isWindows = true;
    const resolver = vi.fn<(request: string, options?: NodeJS.RequireResolveOptions) => string>();
    resolver.mockReturnValue(resolve('/', 'path', 'to', 'extension', 'package.json'));
    vi.mocked(extensionApi.process.exec).mockResolvedValue({
      stdout: resolve('/', 'path', 'to', 'utilities', 'utility'),
      stderr: '',
      command: '',
    });
    await macadam._init(resolver);

    expect(macadam.getMacadamPath()).toEqual(
      resolve('/', 'path', 'to', 'extension', 'binaries', 'macadam-windows-amd64.exe'),
    );
    expect(chmod).toHaveBeenCalledWith(
      resolve('/', 'path', 'to', 'extension', 'binaries', 'macadam-windows-amd64.exe'),
      '755',
    );

    expect(macadam.getUtilitiesPath()).toBeUndefined();
  },
);

describe('getFinalOptions', () => {
  test('with no option and no utilitiesPath', () => {
    const result = macadam.getFinalOptions();
    expect(result).toEqual({});
  });

  describe('with utilitiesPath', async () => {
    beforeEach(async () => {
      vi.mocked(extensionApi.env).isMac = true;
      vi.mocked(extensionApi.env).isWindows = false;
      const resolver = vi.fn<(request: string, options?: NodeJS.RequireResolveOptions) => string>();
      resolver.mockReturnValue(resolve('/', 'path', 'to', 'extension', 'package.json'));
      vi.mocked(extensionApi.process.exec).mockResolvedValue({
        stdout: resolve('/', 'path', 'to', 'utilities', 'utility'),
        stderr: '',
        command: '',
      });
      await macadam._init(resolver);
    });

    test('with no option', async () => {
      const result = macadam.getFinalOptions();
      expect(result).toEqual({
        env: {
          CONTAINERS_HELPER_BINARY_DIR: resolve('/', 'path', 'to', 'utilities'),
        },
      });
    });

    test('with provider', async () => {
      const result = macadam.getFinalOptions(undefined, 'vfkit');
      expect(result).toEqual({
        env: {
          CONTAINERS_HELPER_BINARY_DIR: resolve('/', 'path', 'to', 'utilities'),
          CONTAINERS_MACHINE_PROVIDER: 'vfkit',
        },
      });
    });

    test('with run options and provider', async () => {
      const result = macadam.getFinalOptions(
        {
          env: {
            key1: 'value1',
          },
          cwd: resolve('/', 'path', 'to', 'cwd'),
          isAdmin: true,
        },
        'vfkit',
      );
      expect(result).toEqual({
        env: {
          key1: 'value1',
          CONTAINERS_HELPER_BINARY_DIR: resolve('/', 'path', 'to', 'utilities'),
          CONTAINERS_MACHINE_PROVIDER: 'vfkit',
        },
        cwd: resolve('/', 'path', 'to', 'cwd'),
        isAdmin: true,
      });
    });
  });
});

describe('init is not done', async () => {
  test('createVm throws an error', async () => {
    await expect(
      macadam.createVm({
        imagePath: '/path/to/image.raw',
      }),
    ).rejects.toThrowError('component not initialized. You must call init() before');
  });

  test('listVms throws an error', async () => {
    await expect(macadam.listVms({})).rejects.toThrowError('component not initialized. You must call init() before');
  });

  test('removeVm throws an error', async () => {
    await expect(macadam.removeVm({})).rejects.toThrowError('component not initialized. You must call init() before');
  });

  test('startVm throws an error', async () => {
    await expect(macadam.startVm({})).rejects.toThrowError('component not initialized. You must call init() before');
  });

  test('stopVm throws an error', async () => {
    await expect(macadam.stopVm({})).rejects.toThrowError('component not initialized. You must call init() before');
  });
});

describe('init is done', () => {
  beforeEach(async () => {
    vi.mocked(extensionApi.env).isMac = true;
    vi.mocked(extensionApi.env).isWindows = false;
    const resolver = vi.fn<(request: string, options?: NodeJS.RequireResolveOptions) => string>();
    resolver.mockReturnValue(resolve('/', 'path', 'to', 'extension', 'package.json'));
    vi.mocked(extensionApi.process.exec).mockResolvedValue({
      stdout: resolve('/', 'path', 'to', 'utilities', 'utility'),
      stderr: '',
      command: '',
    });
    await macadam._init(resolver);
  });

  test('createVm with image only', async () => {
    await macadam.createVm({
      imagePath: '/path/to/image.raw',
    });
    expect(extensionApi.process.exec).toHaveBeenCalledWith(expect.anything(), ['init', '/path/to/image.raw'], {
      env: {
        CONTAINERS_HELPER_BINARY_DIR: resolve('/', 'path', 'to', 'utilities'),
      },
    });
  });

  test('createVm with all options', async () => {
    await macadam.createVm({
      imagePath: '/path/to/image.raw',
      sshIdentityPath: '/path/to/id',
      username: 'user1',
    });
    expect(extensionApi.process.exec).toHaveBeenCalledWith(
      expect.anything(),
      ['init', '/path/to/image.raw', '--ssh-identity-path', '/path/to/id', '--username', 'user1'],
      {
        env: {
          CONTAINERS_HELPER_BINARY_DIR: resolve('/', 'path', 'to', 'utilities'),
        },
      },
    );
  });

  test('listVms', async () => {
    vi.mocked(extensionApi.process.exec).mockResolvedValue({
      stdout: `[
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
]`,
      stderr: '',
      command: '',
    });
    const result = await macadam.listVms({});
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      Image: '/Users/me/.local/share/containers/macadam/machine/applehv/macadam-applehv.raw',
      Running: false,
      Starting: false,
      CPUs: 2,
      Memory: '4294967296',
      DiskSize: '21474836480',
      Port: 49378,
      RemoteUsername: 'core',
      IdentityPath: '/Users/phmartin/.local/share/containers/macadam/machine/machine',
      VMType: 'applehv',
    });
  });

  test('removeVm', async () => {
    await macadam.removeVm({});
    expect(extensionApi.process.exec).toHaveBeenCalledWith(expect.anything(), ['rm', '-f'], {
      env: {
        CONTAINERS_HELPER_BINARY_DIR: resolve('/', 'path', 'to', 'utilities'),
      },
    });
  });

  test('startVm', async () => {
    await macadam.startVm({});
    expect(extensionApi.process.exec).toHaveBeenCalledWith(expect.anything(), ['start'], {
      env: {
        CONTAINERS_HELPER_BINARY_DIR: resolve('/', 'path', 'to', 'utilities'),
      },
    });
  });

  test('stopVm', async () => {
    await macadam.stopVm({});
    expect(extensionApi.process.exec).toHaveBeenCalledWith(expect.anything(), ['stop'], {
      env: {
        CONTAINERS_HELPER_BINARY_DIR: resolve('/', 'path', 'to', 'utilities'),
      },
    });
  });
});

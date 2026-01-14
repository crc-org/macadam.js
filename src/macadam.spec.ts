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
import { existsSync } from 'node:fs';
import { platform } from 'node:os';
import { resolve } from 'node:path';

import * as extensionApi from '@podman-desktop/api';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Macadam } from '.';
import { MACADAM_MACOS_PATH, MACADAM_VERSION } from './consts';

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

vi.mock(import('node:fs'));

let macadam: TestMacadam;

beforeEach(() => {
  vi.resetAllMocks();
  macadam = new TestMacadam('mytype');
});

test('areBinariesAvailable on Mac when binaries not installed', async () => {
  vi.mocked(extensionApi.env).isMac = true;
  vi.mocked(extensionApi.env).isWindows = false;
  vi.mocked(existsSync).mockReturnValue(false);

  const result = macadam.areBinariesAvailable();

  expect(result).toBeFalsy();
});

test('areBinariesAvailable on Mac when binaries installed', async () => {
  vi.mocked(extensionApi.env).isMac = true;
  vi.mocked(extensionApi.env).isWindows = false;
  vi.mocked(existsSync).mockReturnValue(true);
  const result = macadam.areBinariesAvailable();

  expect(result).toBeTruthy();
});

test('ensureBinariesUpToDate on Mac when binaries installed with incorrect version', async () => {
  vi.mocked(extensionApi.env).isMac = true;
  vi.mocked(extensionApi.env).isWindows = false;
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(extensionApi.process.exec).mockResolvedValue({
    stdout: 'macadam version v0.2.0',
    stderr: '',
    command: '',
  });
  const resolver = vi.fn<(request: string, options?: NodeJS.RequireResolveOptions) => string>();
  resolver.mockReturnValue(resolve('/', 'path', 'to', 'extension', 'package.json'));
  await macadam._ensureBinariesUpToDate(resolver);

  expect(extensionApi.process.exec).toHaveBeenCalledWith(
    'installer',
    ['-pkg', '/path/to/extension/binaries/macadam-installer-macos-universal.pkg', '-target', '/'],
    { isAdmin: true },
  );
});

test('areBinariesAvailable on Mac when binaries installed with newest version', async () => {
  vi.mocked(extensionApi.env).isMac = true;
  vi.mocked(extensionApi.env).isWindows = false;
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(extensionApi.process.exec).mockResolvedValue({
    stdout: `macadam version v${MACADAM_VERSION}`,
    stderr: '',
    command: '',
  });
  const resolver = vi.fn<(request: string, options?: NodeJS.RequireResolveOptions) => string>();
  resolver.mockReturnValue(resolve('/', 'path', 'to', 'extension', 'package.json'));
  await macadam._ensureBinariesUpToDate(resolver);

  // check that only macadam binary is executed, not the installer
  expect(extensionApi.process.exec).toHaveBeenCalledOnce();
  expect(extensionApi.process.exec).toHaveBeenCalledWith('/opt/macadam/bin/macadam', expect.anything());
});

test('areBinariesAvailable on Mac when binaries installed with correct version', async () => {
  vi.mocked(extensionApi.env).isMac = true;
  vi.mocked(extensionApi.env).isWindows = false;
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(extensionApi.process.exec).mockResolvedValue({
    stdout: `macadam version v${MACADAM_VERSION}`,
    stderr: '',
    command: '',
  });
  const result = macadam.areBinariesAvailable();

  expect(result).toBeTruthy();
});

test('areBinariesAvailable on Windows', async () => {
  vi.mocked(extensionApi.env).isMac = false;
  vi.mocked(extensionApi.env).isWindows = true;
  const result = macadam.areBinariesAvailable();
  expect(result).toBeTruthy();
});

test('areBinariesAvailable on Linux', async () => {
  vi.mocked(extensionApi.env).isMac = false;
  vi.mocked(extensionApi.env).isWindows = false;
  vi.mocked(extensionApi.env).isLinux = true;
  const result = macadam.areBinariesAvailable();
  expect(result).toBeTruthy();
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
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(extensionApi.process.exec).mockResolvedValue({
      stdout: '',
      stderr: '',
      command: '',
    });
    await macadam._init(resolver);

    expect(macadam.getMacadamPath()).toEqual(resolve(MACADAM_MACOS_PATH, 'macadam'));

    expect(macadam.getUtilitiesPath()).toEqual(MACADAM_MACOS_PATH);

    expect(extensionApi.process.exec).toHaveBeenCalledWith(
      'installer',
      ['-pkg', '/path/to/extension/binaries/macadam-installer-macos-universal.pkg', '-target', '/'],
      { isAdmin: true },
    );
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

    expect(macadam.getUtilitiesPath()).toBeUndefined();
  },
);

test(
  'init on Linux',
  {
    skip: platform() !== 'linux',
  },
  async () => {
    vi.mocked(extensionApi.env).isMac = false;
    vi.mocked(extensionApi.env).isWindows = false;
    vi.mocked(extensionApi.env).isLinux = true;
    const resolver = vi.fn<(request: string, options?: NodeJS.RequireResolveOptions) => string>();
    resolver.mockReturnValue(resolve('/', 'path', 'to', 'extension', 'package.json'));
    await macadam._init(resolver);

    expect(macadam.getMacadamPath()).toEqual('/usr/local/bin/macadam');

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
          CONTAINERS_HELPER_BINARY_DIR: MACADAM_MACOS_PATH,
        },
      });
    });

    test('with provider', async () => {
      const result = macadam.getFinalOptions(undefined, 'vfkit');
      expect(result).toEqual({
        env: {
          CONTAINERS_HELPER_BINARY_DIR: MACADAM_MACOS_PATH,
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
          CONTAINERS_HELPER_BINARY_DIR: MACADAM_MACOS_PATH,
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
        name: 'vm1',
      }),
    ).rejects.toThrowError('component not initialized. You must call init() before');
  });

  test('listVms throws an error', async () => {
    await expect(macadam.listVms({})).rejects.toThrowError('component not initialized. You must call init() before');
  });

  test('removeVm throws an error', async () => {
    await expect(macadam.removeVm({ name: 'vm1' })).rejects.toThrowError(
      'component not initialized. You must call init() before',
    );
  });

  test('startVm throws an error', async () => {
    await expect(macadam.startVm({ name: 'vm1' })).rejects.toThrowError(
      'component not initialized. You must call init() before',
    );
  });

  test('stopVm throws an error', async () => {
    await expect(macadam.stopVm({ name: 'vm1' })).rejects.toThrowError(
      'component not initialized. You must call init() before',
    );
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

  test('createVm with name and image only', async () => {
    await macadam.createVm({
      name: 'vm1',
      imagePath: '/path/to/image.raw',
    });
    expect(extensionApi.process.exec).toHaveBeenCalledWith(
      expect.anything(),
      ['init', '/path/to/image.raw', '--name', 'mytype-vm1'],
      {
        env: {
          CONTAINERS_HELPER_BINARY_DIR: MACADAM_MACOS_PATH,
        },
      },
    );
  });

  test('createVm with all options', async () => {
    await macadam.createVm({
      name: 'vm1',
      imagePath: '/path/to/image.raw',
      sshIdentityPath: '/path/to/id',
      username: 'user1',
    });
    expect(extensionApi.process.exec).toHaveBeenCalledWith(
      expect.anything(),
      [
        'init',
        '/path/to/image.raw',
        '--name',
        'mytype-vm1',
        '--ssh-identity-path',
        '/path/to/id',
        '--username',
        'user1',
      ],
      {
        env: {
          CONTAINERS_HELPER_BINARY_DIR: MACADAM_MACOS_PATH,
        },
      },
    );
  });

  test('listVms', async () => {
    vi.mocked(extensionApi.process.exec).mockResolvedValue({
      stdout: `[
  {
      "Name": "mytype-my-vm",
      "Image": "/Users/me/.local/share/containers/macadam/machine/applehv/macadam-applehv.raw",
      "Running": false,
      "Starting": false,
      "CPUs": 2,
      "Memory": "4294967296",
      "DiskSize": "21474836480",
      "Port": 49378,
      "RemoteUsername": "core",
      "IdentityPath": "/Users/me/.local/share/containers/macadam/machine/machine",
      "VMType": "applehv"
  },
  {
      "Name": "yourtype-my-vm",
      "Image": "/Users/you/.local/share/containers/macadam/machine/applehv/macadam-applehv.raw",
      "Running": false,
      "Starting": false,
      "CPUs": 2,
      "Memory": "4294967296",
      "DiskSize": "21474836480",
      "Port": 49379,
      "RemoteUsername": "core",
      "IdentityPath": "/Users/you/.local/share/containers/macadam/machine/machine",
      "VMType": "applehv"
  }
]`,
      stderr: '',
      command: '',
    });
    const result = await macadam.listVms({});
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      Name: 'my-vm',
      Image: '/Users/me/.local/share/containers/macadam/machine/applehv/macadam-applehv.raw',
      Running: false,
      Starting: false,
      CPUs: 2,
      Memory: '4294967296',
      DiskSize: '21474836480',
      Port: 49378,
      RemoteUsername: 'core',
      IdentityPath: '/Users/me/.local/share/containers/macadam/machine/machine',
      VMType: 'applehv',
    });
  });

  test('removeVm', async () => {
    await macadam.removeVm({
      name: 'vm1',
    });
    expect(extensionApi.process.exec).toHaveBeenCalledWith(expect.anything(), ['rm', '-f', 'mytype-vm1'], {
      env: {
        CONTAINERS_HELPER_BINARY_DIR: MACADAM_MACOS_PATH,
      },
    });
  });

  test('startVm', async () => {
    await macadam.startVm({
      name: 'vm1',
    });
    expect(extensionApi.process.exec).toHaveBeenCalledWith(expect.anything(), ['start', 'mytype-vm1'], {
      env: {
        CONTAINERS_HELPER_BINARY_DIR: MACADAM_MACOS_PATH,
      },
    });
  });

  test('stopVm', async () => {
    await macadam.stopVm({
      name: 'vm1',
    });
    expect(extensionApi.process.exec).toHaveBeenCalledWith(expect.anything(), ['stop', 'mytype-vm1'], {
      env: {
        CONTAINERS_HELPER_BINARY_DIR: MACADAM_MACOS_PATH,
      },
    });
  });

  test('executeCommand', async () => {
    await macadam.executeCommand({
      name: 'vm1',
      command: 'ls',
      args: ['/'],
    });
    expect(extensionApi.process.exec).toHaveBeenCalledWith(expect.anything(), ['ssh', 'mytype-vm1', 'ls', '/'], {
      env: {
        CONTAINERS_HELPER_BINARY_DIR: MACADAM_MACOS_PATH,
      },
    });
  });
});

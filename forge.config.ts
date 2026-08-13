import { MakerZIP } from '@electron-forge/maker-zip';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const productionContentSecurityPolicy = [
  "default-src 'self'",
  "connect-src 'none'",
  "img-src 'self' data:",
  "font-src 'self'",
  "style-src 'self'",
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const electronZipDir = process.env.ELECTRON_ZIP_DIR;

const config = {
  packagerConfig: {
    asar: true,
    ...(electronZipDir === undefined ? {} : { electronZipDir }),
  },
  makers: [new MakerZIP({}, ['darwin', 'win32'])],
  plugins: [
    new WebpackPlugin({
      mainConfig: './webpack.main.config.ts',
      renderer: {
        config: './webpack.renderer.config.ts',
        nodeIntegration: false,
        entryPoints: [
          {
            name: 'main_window',
            html: './src/renderer/index.html',
            js: './src/renderer/index.ts',
            preload: {
              js: './src/preload/preload.ts',
            },
          },
        ],
      },
      // Webpack's development-only HMR client needs a local development connection and eval source maps.
      // Packaged builds use the strict CSP in index.html instead.
      devContentSecurityPolicy: `${productionContentSecurityPolicy}; connect-src 'self' ws:; script-src 'self' 'unsafe-eval'`,
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      resetAdHocDarwinSignature: process.platform === 'darwin' && process.arch === 'arm64',
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;

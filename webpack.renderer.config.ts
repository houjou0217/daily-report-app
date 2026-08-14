import CopyPlugin from 'copy-webpack-plugin';
import type { Configuration } from 'webpack';

import rules from './webpack.rules.ts';

const config: Configuration = {
  module: {
    rules,
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: './src/renderer/styles/app.css',
          to: 'styles/app.css',
        },
      ],
    }),
  ],
  resolve: {
    extensions: ['.js', '.ts'],
    extensionAlias: {
      '.js': ['.js', '.ts'],
    },
  },
};

export default config;

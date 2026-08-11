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
          from: './src/renderer/styles.css',
          to: 'styles.css',
        },
      ],
    }),
  ],
  resolve: {
    extensions: ['.js', '.ts'],
  },
};

export default config;

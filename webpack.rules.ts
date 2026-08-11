import type { RuleSetRule } from 'webpack';

const rules: RuleSetRule[] = [
  {
    test: /\.tsx?$/,
    exclude: /node_modules/,
    use: [
      {
        loader: 'ts-loader',
        options: {
          configFile: 'tsconfig.webpack.json',
          transpileOnly: true,
        },
      },
    ],
  },
];

export default rules;

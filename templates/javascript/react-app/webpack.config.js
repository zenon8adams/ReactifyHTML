const path              = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const zlib              = require('zlib');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack           = require('webpack');

const Modes = {
    DEVELOPMENT: 'development',
    PRODUCTION: 'production',
};

module.exports = () => {
    const isProduction   = Modes.PRODUCTION;
    const assetIsPresent = @{ASSET_PRESENT};
    if ('@{ENV_PRESENT}') {
        require('dotenv').config({path: './.env'});
    }
    return {
        mode: Modes.PRODUCTION,
        entry: path.join(__dirname, 'src', 'index.jsx'),
        cache: true,
        resolve: {
            extensions: ['.js', '.jsx'],
            alias: {
                assets: path.resolve(__dirname, 'public', '@{ASSETS_DIR}'),
            }
        },
        output: {
            filename: 'bundle.js',
            path: path.resolve(__dirname, '@{BUILD_DIR}'),
            publicPath: '/',
        },
        module: {
            rules: [
                {
                    test: /\.(js|jsx)$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                    },
                },
                {
                    test: /\.css$/i,
                    use: [
                        'style-loader', {
                            loader: 'css-loader',
                            options: {
                            url: {
                                    filter: url => url[0] !== '/'
                                }
                            }
                        },
                        'postcss-loader'
                    ],
                    sideEffects: true,
                },
                {
                    test: /\.(png|jp(e*)g|gif|webp|avif)$/,
                    use: [
                        {
                            loader: 'file-loader',
                            options: {
                                name: '[name].[ext]',
                                outputPath:
                                    path.join('@{ASSETS_DIR}', 'images'),
                            },
                        },
                    ],
                },
                {
                    test: /\.svg$/,
                    use: ['@svgr/webpack'],
                },
            ],
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: path.join(__dirname, 'public', 'index.html'),
                    favicon: path.join(__dirname, @{FAVICON_DIR}),
            }),
            assetIsPresent && new CopyWebpackPlugin({
                patterns: [
                    {
                        from: path.join('public', '@{ASSETS_DIR}'),
                        to: '@{ASSETS_DIR}'
                    },
                ],
            }),
            new CompressionPlugin({
                filename: '[path][base].gz',
                algorithm: 'gzip',
                test: /\.(min\.css|min\.js|js|ts|css|svg|jpe?g|png|html)$/,
                threshold: 10240,
                minRatio: 0.8,
            }),
            new CompressionPlugin({
                filename: '[path][base].br',
                algorithm: 'brotliCompress',
                test: /\.(min\.css|min\.js|ts|js|css|svg|jpe?g|png|html)$/,
                compressionOptions: {
                    params: {
                        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
                    },
                },
                threshold: 10240,
                minRatio: 0.8,
            }),
            require('postcss-preset-env'),
            new webpack.DefinePlugin({
                'process.env': JSON.stringify(process.env),
            }),
        ],

        performance: {
            maxEntrypointSize: Infinity,
            maxAssetSize: 1024 ** 4,
        },

        devtool: isProduction ? 'source-map' : 'inline-source-map',
        devServer: {
            host: 'localhost',
            port: 3000,
            historyApiFallback: true,
        },
    };
};

import typescript from "rollup-plugin-typescript2";
import babel from "rollup-plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";
import esbuild from "rollup-plugin-esbuild";
import MagicString from "magic-string";

// NOTE: 不知道为什么... nexe 打包的环境没法识别 node:xxx 的模块... 所以这里简单替换一下
function replaceNodePrefix() {
  return {
    name: "replace-node-prefix",
    renderChunk(code) {
      const magicString = new MagicString(code);
      let hasReplaced = false;

      const regex = /require\('node:(\w+)'\)/g;
      let match;

      while ((match = regex.exec(code)) !== null) {
        magicString.overwrite(
          match.index,
          match.index + match[0].length,
          `require('${match[1]}')`
        );
        hasReplaced = true;
      }

      if (!hasReplaced) {
        return null;
      }

      return {
        code: magicString.toString(),
        map: magicString.generateMap({ hires: true }),
      };
    },
  };
}

export default {
  input: "src/server.ts",
  output: {
    dir: "output",
    format: "cjs",
  },
  plugins: [
    json(),
    commonjs({
      include: /node_modules/,
    }),
    esbuild({
      include: /\.[jt]sx?$/,
      exclude: [],
      sourceMap: false,
      minify: process.env.NODE_ENV === "production",
      target: "node14",
      define: {
        "process.env.NODE_ENV": `"${process.env.NODE_ENV}"`,
      },
      tsconfig: "tsconfig.json",
      loaders: {
        ".json": "json",
        ".js": "jsx",
      },
    }),
    resolve(),
    replaceNodePrefix(),
  ],
};

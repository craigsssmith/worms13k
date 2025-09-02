import { js13kViteConfig } from "js13k-vite-plugins";
import { defineConfig } from "vite";

export default defineConfig(js13kViteConfig());

// import { defineConfig } from 'vite';
// import htmlMinifier from 'vite-plugin-html-minifier';
// import { viteSingleFile } from "vite-plugin-singlefile"

// export default defineConfig({
//   build: {
//     modulePreload: false,
//     minify: 'terser',
//     terserOptions: {
//       compress: {
//         arrows: true,
//         unsafe: true,
//         unsafe_arrows: true,
//         unsafe_comps: true,
//         passes: 2,
//         ecma: 2025,
//       },
//       mangle: {
//         properties: {
//           keep_quoted: 'strict',
//         }
//       }
//     }
//   },
//   plugins: [
//     htmlMinifier({
//       minify: true,
//     }),
//     viteSingleFile(),
//   ],
// });

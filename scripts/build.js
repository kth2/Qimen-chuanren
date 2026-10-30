/**
 * 产出 dist/：可直接部署的 PWA。
 *   · web/ 下的页面、控制器、manifest、图标、service worker
 *   · core/ 下的穿壬引擎
 *   · tyme4ts 打包成浏览器版 lib/tyme4ts.js
 *   · 从 vendor/qimen-pwa 只取页面用到的几个文件，路径不变
 * 用法：npm run build
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const COPY = [
  ['web/index.html', 'index.html'],
  ['web/app.js', 'app.js'],
  ['web/ai.js', 'ai.js'],
  ['web/cases.js', 'cases.js'],
  ['web/calendar-ui.js', 'calendar-ui.js'],
  ['core/calendar.js', 'core/calendar.js'],
  ['core/casebook.js', 'core/casebook.js'],
  ['core/review.js', 'core/review.js'],
  ['vendor/qimen-pwa/core/casestore.js', 'vendor/qimen-pwa/core/casestore.js'],
  ['web/manifest.json', 'manifest.json'],
  ['web/icon.svg', 'icon.svg'],
  ['web/icon-192.png', 'icon-192.png'],
  ['web/icon-512.png', 'icon-512.png'],
  ['web/icon-maskable-512.png', 'icon-maskable-512.png'],
  ['core/rules.js', 'core/rules.js'],
  ['core/liuren/tiandipan.js', 'core/liuren/tiandipan.js'],
  ['core/liuren/yuejiang.js', 'core/liuren/yuejiang.js'],
  ['core/liuren/sanchuan.js', 'core/liuren/sanchuan.js'],
  ['core/liuren/xiangyi.js', 'core/liuren/xiangyi.js'],
  ['core/liuren/casematch.js', 'core/liuren/casematch.js'],
  ['knowledge/liuren-cases.json', 'knowledge/liuren-cases.json'],
  ['vendor/qimen-pwa/style.css', 'vendor/qimen-pwa/style.css'],
  ['vendor/qimen-pwa/engine.bundle.js', 'vendor/qimen-pwa/engine.bundle.js'],
  ['vendor/qimen-pwa/core/wangshuai.js', 'vendor/qimen-pwa/core/wangshuai.js'],
  ['vendor/qimen-pwa/core/wuxing.js', 'vendor/qimen-pwa/core/wuxing.js'],
  ['vendor/qimen-pwa/core/yongshen.js', 'vendor/qimen-pwa/core/yongshen.js'],
  ['vendor/qimen-pwa/core/framing.js', 'vendor/qimen-pwa/core/framing.js'],
  ['vendor/qimen-pwa/core/yingqi.js', 'vendor/qimen-pwa/core/yingqi.js'],
  ['vendor/qimen-pwa/core/mdlite.js', 'vendor/qimen-pwa/core/mdlite.js'],
  ['vendor/qimen-pwa/llm.js', 'vendor/qimen-pwa/llm.js'],
  ['vendor/qimen-pwa/assets/zhuanpan-method.md', 'vendor/qimen-pwa/assets/zhuanpan-method.md'],
  ['vendor/qimen-pwa/assets/feipan-method.md', 'vendor/qimen-pwa/assets/feipan-method.md'],
  ['vendor/qimen-pwa/knowledge/domains.json', 'vendor/qimen-pwa/knowledge/domains.json'],
];

fs.rmSync(DIST, { recursive: true, force: true });
for (const [from, to] of COPY) {
  const src = path.join(ROOT, from);
  if (!fs.existsSync(src)) throw new Error('缺文件：' + from + '（submodule 拉了吗？git submodule update --init）');
  fs.mkdirSync(path.dirname(path.join(DIST, to)), { recursive: true });
  fs.copyFileSync(src, path.join(DIST, to));
}

esbuild.buildSync({
  entryPoints: [path.join(ROOT, 'node_modules/tyme4ts/dist/lib/index.mjs')],
  bundle: true, format: 'iife', globalName: 'tyme4ts', minify: true,
  outfile: path.join(DIST, 'lib/tyme4ts.js'), logLevel: 'warning',
});

// service worker：资产清单 + 内容哈希
const assets = ['./', ...COPY.map(([, to]) => './' + to), './lib/tyme4ts.js'];
const hash = crypto.createHash('sha256');
for (const a of assets.slice(1)) hash.update(fs.readFileSync(path.join(DIST, a)));
const build = hash.digest('hex').slice(0, 10);
const sw = fs.readFileSync(path.join(ROOT, 'web/sw.js'), 'utf8')
  .replace('__BUILD__', build)
  .replace('__ASSETS__', JSON.stringify(assets, null, 2));
fs.writeFileSync(path.join(DIST, 'sw.js'), sw);
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

console.log(`dist/ 已产出：${assets.length} 个资产，缓存版本 ${build}`);

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, copyFileSync, cpSync, writeFileSync, readFileSync, renameSync, realpathSync, rmSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';

const root = resolve('.');
const versionCode = '20261128', versionName = '0.1.0-hull-preview.8';
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? join(homedir(), 'AppData/Local/Android/Sdk');
const jdk = process.env.JAVA_HOME;
if (!jdk) throw new Error('JAVA_HOME must point to JDK 17 or newer.');
const toolVersion = readdirSync(join(sdk, 'build-tools')).filter(v => /^\d+\.\d+\.\d+$/.test(v)).sort((a,b)=>b.localeCompare(a, undefined, {numeric:true}))[0];
const platform = readdirSync(join(sdk, 'platforms')).filter(v => /^android-\d+$/.test(v)).sort((a,b)=>b.localeCompare(a, undefined, {numeric:true}))[0];
const tools = join(sdk, 'build-tools', toolVersion), androidJar = join(sdk, 'platforms', platform, 'android.jar');
const suffix = process.platform === 'win32' ? '.exe' : '';
const java = join(jdk, 'bin', 'java' + suffix), bin = name => join(jdk, 'bin', name + suffix);
const run = (command, args) => execFileSync(command, args, { cwd: root, stdio: 'inherit', windowsHide: true });
if (!existsSync('dist/index.html')) throw new Error('Run npm run build first.');
const out = resolve('output/android'), work = resolve('tmp/android-build');
for (const p of [out, work, join(work,'classes'), join(work,'dex'), join(work,'res/drawable')]) mkdirSync(p, { recursive: true });
copyFileSync('public/assets/brand/bullet-wake-logo-compact.png', join(work, 'res/drawable/icon.png'));
run(join(tools, 'aapt2' + suffix), ['compile', '--dir', join(work,'res'), '-o', join(work,'resources.zip')]);
const unsigned = join(work,'unsigned.apk'), aligned = join(work,'aligned.apk'), apk = join(out,'BULLET_WAKE-hull-preview.apk');
run(join(tools,'aapt2' + suffix), ['link', '-o', unsigned, '-I', androidJar, '--manifest', resolve('android/AndroidManifest.xml'), '--min-sdk-version', '28', '--target-sdk-version', '34', '--version-code', versionCode, '--version-name', versionName, join(work,'resources.zip')]);
// Windows AAPT2 -A stores nested asset names with backslashes, which Android's
// AssetManager cannot resolve. JAR writes portable ZIP paths with forward slashes.
const webAssets = join(work, 'web-assets');
if (existsSync(webAssets)) {
  const stagingTarget = realpathSync(webAssets), stagingRoot = realpathSync(work);
  if (!stagingTarget.startsWith(stagingRoot + sep)) throw new Error('Asset staging directory is outside the Android build workspace.');
  rmSync(stagingTarget, { recursive: true, force: true });
}
mkdirSync(webAssets, { recursive: true });
cpSync(resolve('dist'), join(webAssets, 'assets'), { recursive: true });
run(bin('jar'), ['--update', '--file', unsigned, '-C', webAssets, 'assets']);
const entries = new Set(execFileSync(bin('jar'), ['--list', '--file', unsigned], { encoding: 'utf8', windowsHide: true }).split(/\r?\n/));
const verifyAssets = (folder, prefix = 'assets') => {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const name = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) verifyAssets(join(folder, entry.name), name);
    else if (!entries.has(name)) throw new Error(`APK asset missing or invalid ZIP path: ${name}`);
  }
};
verifyAssets(resolve('dist'));
if ([...entries].some(name => name.includes('\\'))) throw new Error('APK contains non-portable backslash paths.');
run(bin('javac'), ['-encoding','UTF-8','-source','8','-target','8','-classpath',androidJar,'-d',join(work,'classes'),resolve('android/src/dev/emersonbarros/bulletwake/preview/MainActivity.java')]);
run(bin('jar'), ['--create','--file',join(work,'classes.jar'),'-C',join(work,'classes'),'.']);
run(java, ['-cp',join(tools,'lib/d8.jar'),'com.android.tools.r8.D8','--lib',androidJar,'--min-api','28','--output',join(work,'dex'),join(work,'classes.jar')]);
run(bin('jar'), ['--update','--file',unsigned,'-C',join(work,'dex'),'classes.dex']);
run(join(tools,'zipalign' + suffix), ['-f','4',unsigned,aligned]);
const keystore = resolve('android/.debug.keystore');
if (!existsSync(keystore)) run(bin('keytool'), ['-genkeypair','-keystore',keystore,'-storepass','android','-keypass','android','-alias','androiddebugkey','-dname','CN=BULLET WAKE Local Test,O=Android,C=BR','-keyalg','RSA','-keysize','2048','-validity','10000']);
const signed = join(work, 'signed.apk');
run(java, ['-jar',join(tools,'lib/apksigner.jar'),'sign','--ks',keystore,'--ks-pass','pass:android','--key-pass','pass:android','--ks-key-alias','androiddebugkey','--out',signed,aligned]);
run(java, ['-jar',join(tools,'lib/apksigner.jar'),'verify','--verbose',signed]);
copyFileSync(signed, apk + '.tmp');
renameSync(apk + '.tmp', apk);
const bytes = readFileSync(apk);
const report = { apk, versionName, versionCode: Number(versionCode), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), packageId:'dev.emersonbarros.bulletwake.preview', minSdk:28,targetSdk:34,buildTools:toolVersion,platform,productionBuild:true,offlineAssets:true,signing:'local debug key',builtAt:new Date().toISOString() };
writeFileSync(join(out,'build-report.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));

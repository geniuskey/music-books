// Run: node scripts/verify-factcheck.cjs
// Actual chapter code regressions for MUS-14/40/50/59/61/64.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'chapters', name + '.html'), 'utf8');
const common = fs.readFileSync(path.join(root, 'js/common.js'), 'utf8');
const context = vm.createContext({ window: { addEventListener() {} }, document: { readyState:'loading', addEventListener() {} } });
vm.runInContext(common, context); const MB = context.window.MB; context.MB = MB;
// Parse every inline script without invoking DOM or browser audio.
let inline = 0;
for (const file of fs.readdirSync(path.join(root, 'chapters'))) {
  if (!file.endsWith('.html')) continue;
  for (const script of fs.readFileSync(path.join(root, 'chapters', file), 'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/application\/ld\+json/.test(script[1])) { JSON.parse(script[2]); continue; }
    if (script[2].trim()) { new vm.Script(script[2], {filename:file}); inline++; }
  }
}
const studio = read('studio');
const engine = studio.slice(studio.indexOf('const STD = (function'), studio.indexOf('/* ================================================================ 그림 17-1:'));
vm.runInContext(engine + '\nglobalThis.STD=STD;', context);
const STD = context.STD;
let strongBeats = 0;
for (const preset of Object.keys(STD.PRESETS)) for (let seed = 1; seed <= 100; seed++) {
  STD.loadPreset(preset); STD.st.seed=seed; STD.genMelody();
  for (let bar=0; bar<STD.st.bars; bar++) for (const step of [0,8]) {
    if (bar===STD.st.bars-1 && step===8) continue; // explicit tonic ending exception
    const row = STD.st.mel[bar*16+step]; if (row<0) continue;
    assert.ok(STD.chordAt(bar).pcs.includes(MB.mod(STD.leadMidi(row),12)), `${preset}, seed ${seed}, bar ${bar}, step ${step}`);
    strongBeats++;
  }
  const first = JSON.stringify(STD.st.mel); STD.genMelody(); assert.equal(JSON.stringify(STD.st.mel), first);
}
// The actual schedule must preserve the eighth starts and keep all subdivisions ordered.
let swingCases = 0;
const swingSource = studio.slice(studio.indexOf('  function studioSwingOffset('), studio.indexOf('  const ALL ='));
vm.runInContext(swingSource, context);
for (const bpm of [40,100,240]) for (const swing of [0.5,0.6,2/3,0.75]) for (const resolution of [8,16]) {
  const base = 60/bpm/4;
  const times = Array.from({length:5},(_,step)=>step*base+context.studioSwingOffset(step,base,swing,resolution));
  for (let i=1;i<times.length;i++) assert.ok(times[i]>times[i-1]);
  if (resolution===8) assert.ok(Math.abs(times[2]-4*swing*base)<1e-12);
  assert.equal(times[4],4*base); swingCases++;
}
// Detune readout formula from the actual chapter: compare all adjacent oscillator differences.
const synthesis = read('synthesis');
const beatLine = synthesis.match(/const step = S\(\) \/ \(n - 1\), b1 = ([^;]+);/);
assert.ok(beatLine); let beatCases=0;
for (const frequency of [110,440,1760]) for (const spread of [0,24,50,100]) for (let voices=2;voices<=9;voices++) {
  const c=vm.createContext({S:()=>spread,n:voices,lastF:frequency});
  const reported=vm.runInContext(`const step=S()/(n-1); ${beatLine[1]}`,c);
  const freqs=Array.from({length:voices},(_,k)=>frequency*2**(spread*(k/(voices-1)-0.5)/1200));
  const minimum=Math.min(...freqs.slice(1).map((f,i)=>f-freqs[i]));
  assert.ok(Math.abs(reported-minimum)<1e-10); beatCases++;
}
// Minimal Web Audio double: verify command semantics, not browser acoustics.
const events=[];
function param() { return {value:1, cancelScheduledValues(t){events.push(['cancel',this,t]);},cancelAndHoldAtTime(t){events.push(['hold',this,t]);},setValueAtTime(v,t){events.push(['value',this,v,t]);},linearRampToValueAtTime(v,t){events.push(['ramp',this,v,t]);},setTargetAtTime(v,t,tau){events.push(['target',this,v,t,tau]);}}; }
function node(type) { return {type,gain:param(),frequency:param(),detune:param(),pan:param(),Q:param(),connections:[],connect(n){this.connections.push(n);},disconnect(){},start(t){events.push(['start',this,t]);},stop(t){events.push(['stop',this,t]);}}; }
const audio={currentTime:0,createGain:()=>node('gain'),createOscillator:()=>node('osc'),createStereoPanner:()=>node('pan'),createBiquadFilter:()=>node('filter')};
const drums=[]; const originalDrum=MB.drum; MB.ctx=()=>audio; MB.out=node('out'); MB.drum=(name,t,o)=>drums.push(o.dest);
context.MD_DRUM={36:'kick'};
const midi=read('midi');vm.runInContext(midi.slice(midi.indexOf('function MdSynth()'),midi.indexOf('function mdFillProg')),context);
const synth=context.MdSynth();
synth.handle(0x90,60,100); const channel=synth.channel(0), voice=channel.voices.get(60);
synth.handle(0xb0,64,127); synth.handle(0xb0,123,0);
assert.ok(channel.voices.has(60) && channel.held.has(60)); assert.ok(!events.some(e=>e[0]==='stop' && e[1]===voice.o));
synth.handle(0xb0,64,0); assert.ok(!channel.voices.has(60)); assert.ok(events.some(e=>e[0]==='target' && e[1]===voice.g.gain && e[2]===0));
const releaseBus=channel.soundOut; synth.handle(0xb0,120,0);
assert.ok(events.some(e=>e[0]==='value' && e[1]===releaseBus.gain && e[2]===0));
assert.notEqual(channel.soundOut,releaseBus);
synth.handle(0x90,62,100); const active=channel.voices.get(62), activeBus=channel.soundOut;
synth.handle(0xb0,64,127); synth.handle(0xb0,120,0);
assert.ok(events.some(e=>e[0]==='stop' && e[1]===active.o && e[2]===0));
assert.equal(channel.voices.size,0);assert.equal(channel.held.size,0);assert.equal(channel.sus,true);
assert.ok(events.some(e=>e[0]==='value' && e[1]===activeBus.gain && e[2]===0));
synth.handle(0x99,36,100);const drumBus=synth.channel(9).soundOut;assert.equal(drums.at(-1),drumBus);
synth.handle(0xb9,120,0);assert.ok(events.some(e=>e[0]==='value' && e[1]===drumBus.gain && e[2]===0));
synth.handle(0x99,36,100);assert.notEqual(drums.at(-1),drumBus);
MB.drum=originalDrum;
const rhythm=read('rhythm');const pattern=rhythm.match(/eotmori: \{[^\n]+groups: (\[[^\]]+\])[^\n]+s: (\[[^\]]+\])/);assert.ok(pattern);
const groups=JSON.parse(pattern[1]),strokes=JSON.parse(pattern[2]);assert.deepEqual(groups,[3,2,3,2]);assert.equal(strokes.length,10);assert.deepEqual(strokes.flatMap((s,i)=>s?[i]:[]),[0,3,5,8]);
const psycho=read('psychoacoustics');assert.ok(psycho.includes('MB.pcName(pc + 9)') && psycho.includes('MB.pcName(pc + 15)'));
const euclid=read('sequencer').match(/E\(5, 16\)<\/td><td class="num">([^<]+)/)[1];assert.equal(euclid.length,16);assert.equal([...euclid].filter(c=>c==='x').length,5);
console.log(JSON.stringify({inlineScripts:inline,strongBeats,swingCases,detuneCases:beatCases,midiCommandCases:7,eotmoriOnsets:[0,3,5,8],euclidLength:euclid.length}));

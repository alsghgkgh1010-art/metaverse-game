/* ============================================================================
   배포 전 자동 검사
   실행:  node tools/check.mjs
   GitHub Actions 가 푸시할 때마다 이걸 돌린다. 손으로 확인하던 것을 대신한다.
   ============================================================================ */
import fs from 'node:fs';
import vm from 'node:vm';

const 게임 = [
  { 파일: '조선시대-퀴즈맵.html', 지도검사: true,  three: false, 최대크기: 400_000 },
  { 파일: '우주탐사-RPG.html',    지도검사: false, three: true,  최대크기: 1_400_000 }
];

let 실패 = 0, 검사수 = 0;
const ok   = (m) => { 검사수++; console.log('  [32m✓[0m ' + m); };
const bad  = (m) => { 검사수++; 실패++; console.log('  [31m✗ ' + m + '[0m'); };
const 확인 = (조건, m) => 조건 ? ok(m) : bad(m);

/* 인라인 <script> 블록만 뽑아낸다 (src 로 불러오는 것은 제외) */
function 스크립트뽑기(html){
  const out = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while((m = re.exec(html))) out.push(m[1]);
  return out;
}

for(const 게 of 게임){
  console.log('\n[1m■ ' + 게.파일 + '[0m');
  if(!fs.existsSync(게.파일)){ bad('파일이 없다'); continue; }
  const html = fs.readFileSync(게.파일, 'utf8');
  const 코드 = 스크립트뽑기(html);

  /* ---- 1. 자바스크립트 문법 ---- */
  let 문법 = true;
  코드.forEach((src, i) => {
    try { new vm.Script(src, { filename: `${게.파일}#script${i}` }); }
    catch(e){ 문법 = false; bad(`문법 오류 (script ${i}): ${e.message}`); }
  });
  if(문법) ok(`자바스크립트 문법 (인라인 ${코드.length}개)`);

  /* ---- 2. file:// 에서 막히는 것들 ---- */
  const 금지 = [
    [/<script[^>]*\btype\s*=\s*["']module["']/i, 'type="module"'],
    [/^\s*import\s+[\w{*]/m,                    'import 문'],
    [/\bfetch\s*\(/,                            'fetch()'],
    [/\bXMLHttpRequest\b/,                      'XMLHttpRequest'],
    [/\bnew\s+Worker\s*\(/,                     'new Worker()']
  ];
  const 걸린것 = 금지.filter(([re]) => 코드.some(c => re.test(c)) || re.test(html)).map(([,n]) => n);
  확인(걸린것.length === 0,
    걸린것.length ? `file:// 에서 막히는 코드: ${걸린것.join(', ')}` : 'file:// 안전 (금지 API 없음)');

  /* ---- 3. 외부 네트워크 ---- */
  const 외부 = [...html.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map(m => m[0])
    .filter(u => !u.startsWith('http://www.w3.org/'));   // SVG 네임스페이스는 요청이 아니다
  확인(외부.length === 0, 외부.length ? `외부 주소 ${외부.length}건: ${외부.slice(0,3).join(', ')}` : '외부 네트워크 요청 0건');

  /* ---- 4. 인라인 스크립트 안의 </script> ---- */
  const 닫힘 = 코드.some(c => /<\/script/i.test(c));
  확인(!닫힘, 닫힘 ? '인라인 스크립트 안에 </script> 가 있다 (<\\/script> 로 escape 필요)' : '인라인 스크립트 파싱 안전');

  /* ---- 5. 한글이 깨지지 않는가 ---- */
  확인(/<meta\s+charset=["']?utf-8/i.test(html.slice(0, 400)), 'meta charset=utf-8 이 앞쪽에 있다');
  확인(!html.includes('�'), '깨진 문자 없음');

  /* ---- 6. 파일 크기 ---- */
  const 크기 = fs.statSync(게.파일).size;
  확인(크기 <= 게.최대크기, `파일 크기 ${(크기/1024).toFixed(0)}KB (상한 ${(게.최대크기/1024).toFixed(0)}KB)`);

  /* ---- 7. three.js r147 API 감사 ---- */
  if(게.three){
    const 낡음 = [
      ['outputColorSpace',        'outputEncoding = sRGBEncoding 를 써야 한다'],
      ['useLegacyLights',         'r147 에 없다'],
      ['AgXToneMapping',          'ACESFilmicToneMapping 을 써야 한다'],
      ['mergeGeometries',         'r147 이름은 mergeBufferGeometries 다'],
      ['material.skinning',       'r147 에 없다 (isSkinnedMesh 로 자동 판정)']
    ];
    const 걸림 = 낡음.filter(([k]) =>
      코드.some(c => new RegExp('(?<![\\w.])' + k + '(?![\\w])').test(
        c.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ''))));
    확인(걸림.length === 0,
      걸림.length ? `r147 에 없는 API: ${걸림.map(([k,r]) => k + ' → ' + r).join(' / ')}`
                  : 'three.js r147 API 감사 통과');
    확인(/outputEncoding\s*=\s*THREE\.sRGBEncoding/.test(html), 'outputEncoding = sRGBEncoding 설정됨');
    확인(/ColorManagement\.legacyMode\s*=\s*false/.test(html), 'ColorManagement.legacyMode = false 설정됨');
  }

  /* ---- 8. 지도 데이터 (2D 전용) ---- */
  if(게.지도검사){
    const 본문 = 코드.join('\n');
    const 끝 = 본문.indexOf('var T = 48');
    if(끝 < 0){ bad('지도 데이터 구간을 찾을 수 없다'); continue; }
    let 마당, 문제은행, 지도;
    try {
      ({ 마당, 문제은행, 지도 } =
        new Function(본문.slice(0, 끝) + '\nreturn {마당, 문제은행, 지도};')());
    } catch(e){ bad('지도 데이터를 읽을 수 없다: ' + e.message); continue; }

    확인(문제은행.length === 20, `문항 ${문제은행.length}개`);
    확인(마당.length === 지도.length, `마당 ${마당.length}개 = 지도 ${지도.length}개`);

    문제은행.forEach((q, i) => {
      const n = i + 1;
      if(!q.질문 || !q.정답 || !q.해설 || !q.힌트) bad(`${n}번: 질문·정답·해설·힌트 중 빠진 것이 있다`);
      if(q.유형 === '고르기'){
        if(!Array.isArray(q.보기) || q.보기.length !== 4) bad(`${n}번: 보기가 4개가 아니다`);
        else if(!q.보기.includes(q.정답))                 bad(`${n}번: 정답이 보기 안에 없다`);
        else if(new Set(q.보기).size !== 4)               bad(`${n}번: 보기가 중복된다`);
      }
      if(q.유형 === 'OX' && !['O','V','X'].includes(q.정답)) bad(`${n}번: OX 정답 형식이 아니다`);
      if(q.유형 === '쓰기'){
        const 목록 = (q.허용 || []).map(s => s.replace(/\s/g, ''));
        if(!목록.length)                                  bad(`${n}번: 허용 답안이 없다`);
        else if(!목록.includes(q.정답.replace(/\s/g, ''))) bad(`${n}번: 정답이 허용 목록에 없다`);
      }
    });
    ok('문항 데이터 무결성');

    const 막힌것 = 'TJWSBMFL#nw';  // w(물)은 못 지나간다. o(항아리)는 밀 수 있고 s(군사)는 지나칠 수 있다
    지도.forEach((rows, i) => {
      const 이름 = `제${i+1}마당`;
      const 세로 = rows.length, 가로 = rows[0].length;
      rows.forEach((r, j) => { if(r.length !== 가로) bad(`${이름} ${j}행 길이 ${r.length} ≠ ${가로}`); });
      const 전체 = rows.join(''), 세기 = ch => 전체.split(ch).length - 1;
      const 문항수 = 문제은행.filter(x => x.마당 === i+1).length;
      if(세기('Q') !== 문항수) bad(`${이름} 족자 ${세기('Q')}개 ≠ 문항 ${문항수}개`);
      if(세기('P') !== 1)      bad(`${이름} 문이 ${세기('P')}개`);
      if(세기('@') !== 1)      bad(`${이름} 시작 자리가 ${세기('@')}개`);

      // 시작 자리에서 걸어서 모든 곳에 갈 수 있는가 (막혀서 못 푸는 문제 방지)
      const g = rows.map(r => [...r]);
      let sx, sy;
      g.forEach((row, y) => row.forEach((ch, x) => { if(ch === '@'){ sx = x; sy = y; } }));
      const 본 = new Set([sy + ',' + sx]), 스택 = [[sx, sy]];
      while(스택.length){
        const [x, y] = 스택.pop();
        for(const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const nx = x+dx, ny = y+dy;
          if(nx < 0 || ny < 0 || ny >= 세로 || nx >= 가로) continue;
          if(막힌것.includes(g[ny][nx])) continue;
          const k = ny + ',' + nx;
          if(본.has(k)) continue;
          본.add(k); 스택.push([nx, ny]);
        }
      }
      g.forEach((row, y) => row.forEach((ch, x) => {
        if('QPcr'.includes(ch) && !본.has(y + ',' + x)) bad(`${이름} '${ch}'(${x},${y}) 에 걸어서 갈 수 없다`);
        if(ch === 'n' && ![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => 본.has((y+dy)+','+(x+dx))))
          bad(`${이름} 사람(${x},${y}) 에게 다가갈 수 없다`);
      }));
    });
    ok('지도 크기·개수·길찾기(도달 가능성)');
  }
}

console.log('\n' + '─'.repeat(52));
if(실패){ console.log(`[31m[1m❌ 검사 ${검사수}건 중 ${실패}건 실패[0m`); process.exit(1); }
console.log(`[32m[1m✅ 검사 ${검사수}건 모두 통과 — 수업에 써도 됩니다[0m`);

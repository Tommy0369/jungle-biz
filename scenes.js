/* =========================================================================
   JUNGLE BIZ — シーン層（設計書 v1.0 / 冒頭5分 + LIVE JUNGLE ホーム）
   TITLE → 上陸INTRO → BUSINESS SELECT → FIRST SALE → LIVE JUNGLE。
   経済エンジンには一切触らない。index.html 末尾の橋(B)経由で読むだけ。
   キャラ・背景は全てインラインSVG（外部アセットゼロ / file://でも動く）。
   ========================================================================= */
window.Scenes = (function(){
"use strict";

let B = null;            // index.html から渡される橋
let planOpen = false;    // true の間 renderPlay を素通しする（プラン画面表示中）
let planWeek = null;     // プランを開いた時点の週。進んだら「朝のジャングル」へ帰す
let lastSeenWeek = null; // 週送り検知（夜→朝 演出 §7）
let introTimers = [];    // INTROの演出タイマー（スキップで全消し）

const rnd = (a,b)=> a + Math.random()*(b-a);
const $s  = (sel)=> document.querySelector(sel);

/* =======================================================================
   Asset Registry（§39-40 / docs/ASSET_BRIEF.md）
   assets/ に画像があればそれを使い、無ければSVG描画に自動フォールバック。
   ユーザーが画像を置いてリロードするだけで絵が切り替わる。
   ======================================================================= */
const AssetReg = {
  manifest: ["bg/title_bg","bg/beach_dawn","bg/beach_day","bg/jungle_day","bg/jungle_dawn","bg/jungle_night",
             // 縦構図版（_v）。縦長画面ではこちらを優先する（bgKeyFor）
             "bg/jungle_day_v","bg/beach_day_v",
             "fg/palm","fg/fern",
             // キャラ（透過PNG。assets/raw/ に元画像→ tools/cutout.py で生成）
             "char/owl_neutral","char/owl_happy","char/owl_worried",
             "char/player_front","char/player_celebrate","char/player_back",
             "char/tourist_a","char/tourist_b",
             // 屋台（全5事業×4段階。旧2段階素材は既存セーブ互換用）
             "stall/juice_s0","stall/juice_s1","stall/juice_s2","stall/juice_s3",
             "stall/coco_s0","stall/coco_s1","stall/coco_s2","stall/coco_s3",
             "stall/photo_s0","stall/photo_s1","stall/photo_s2","stall/photo_s3",
             "stall/guide_s0","stall/guide_s1","stall/guide_s2","stall/guide_s3",
             "stall/brand_s0","stall/brand_s1","stall/brand_s2","stall/brand_s3",
             "stall/juice_stall","stall/juice_shop","stall/coco_stall","stall/coco_shop",
             "stall/photo_stall","stall/photo_shop","stall/guide_stall","stall/guide_shop",
             "stall/brand_stall","stall/brand_shop"],
  map: {},
  ext: {},                                            // どの拡張子で読めたかを覚える
  /* WebP を先に試し、無ければ PNG に落ちる。
     実測で WebP は同じ絵が約1/10（17.8MB→1.45MB）。
     容量が空いたぶんを、状況ごとの絵のバリエーションに使う。 */
  _try(k, ext){
    return new Promise(res=>{
      const img = new Image();
      img.onload  = ()=>{ this.map[k]=img; this.ext[k]=ext; res(true); };
      img.onerror = ()=> res(false);
      img.src = "assets/" + k + "." + ext;
    });
  },
  load(){
    return Promise.all(this.manifest.map(async k => {
      if(await this._try(k, "webp")) return;
      await this._try(k, "png");                      // 無い/読めない → SVGへフォールバック
    }));
  },
  has(k){ return !!this.map[k]; },
  url(k){ return "assets/" + k + "." + (this.ext[k] || "png"); },
};
/* 前景素材：マゼンタ背景の元画像を tools/cutout.py で透過化して使う。無ければSVG */
function fgPalm(flip){
  return AssetReg.has("fg/palm")
    ? `<img src="${AssetReg.url("fg/palm")}" alt="" style="width:100%;display:block;${flip?'transform:scaleX(-1);':''}">`
    : svgPalm(flip);
}
function fgFern(flip){
  return AssetReg.has("fg/fern")
    ? `<img src="${AssetReg.url("fg/fern")}" alt="" style="width:100%;display:block;${flip?'transform:scaleX(-1);':''}">`
    : svgFern(flip);
}

/* =======================================================================
   SVG部品（§93: 3〜4頭身 / 柔らかい影 / 極端な黒線なし / 暖色ライティング）
   ======================================================================= */

/* ---- OWL（§22: 金眼鏡・深緑ベスト・帳簿） ---- */
function svgOwl(mood){
  mood = mood || "normal";
  const moodKey = mood==="happy" ? "happy"
    : ((mood==="worried" || mood==="surprise") ? "worried" : "neutral");
  const ik = "char/owl_" + moodKey;
  if(AssetReg.has(ik)) return `<img src="${AssetReg.url(ik)}" alt="" style="width:100%;height:auto;display:block">`;
  const surprised = mood==="surprise";
  const happy = mood==="happy";
  const pupil = surprised ? 4.4 : 6;
  const eyes = happy
    ? `<path d="M56 96 q14 -13 28 0" fill="none" stroke="#241708" stroke-width="5" stroke-linecap="round"/>
       <path d="M116 96 q14 -13 28 0" fill="none" stroke="#241708" stroke-width="5" stroke-linecap="round"/>`
    : `<g>
        <circle cx="70" cy="96" r="21" fill="#fffaf0"/>
        <circle cx="130" cy="96" r="21" fill="#fffaf0"/>
        <circle cx="72" cy="98" r="11.5" fill="#e59a2b"/>
        <circle cx="128" cy="98" r="11.5" fill="#e59a2b"/>
        <circle cx="72" cy="98" r="${pupil}" fill="#241708"/>
        <circle cx="128" cy="98" r="${pupil}" fill="#241708"/>
        <circle cx="75" cy="94" r="3.2" fill="#fff"/>
        <circle cx="131" cy="94" r="3.2" fill="#fff"/>
        <g class="jz-lid"><rect x="49" y="75" width="42" height="42" rx="12" fill="#77573a"/></g>
        <g class="jz-lid d2"><rect x="109" y="75" width="42" height="42" rx="12" fill="#77573a"/></g>
      </g>`;
  return `
<svg viewBox="0 0 200 230" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
 <defs>
  <linearGradient id="owlBody" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stop-color="#6d5138"/><stop offset="1" stop-color="#46311f"/>
  </linearGradient>
  <linearGradient id="owlBelly" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stop-color="#f2e4c0"/><stop offset="1" stop-color="#d8bf8e"/>
  </linearGradient>
 </defs>
 <g class="jz-breath">
  <path d="M52 44 L66 18 L76 46 Z" fill="#57402a"/>
  <path d="M148 44 L134 18 L124 46 Z" fill="#57402a"/>
  <ellipse cx="100" cy="124" rx="76" ry="90" fill="url(#owlBody)"/>
  <path d="M30 120 q-12 34 8 62 q10 12 22 6 q-16 -34 -8 -66 Z" fill="#543d27"/>
  <path d="M170 120 q12 34 -8 62 q-10 12 -22 6 q16 -34 8 -66 Z" fill="#543d27"/>
  <ellipse cx="100" cy="158" rx="47" ry="54" fill="url(#owlBelly)"/>
  <path d="M72 146 q28 14 56 0" fill="none" stroke="#c9ab74" stroke-width="3" opacity=".5"/>
  <path d="M76 166 q24 12 48 0" fill="none" stroke="#c9ab74" stroke-width="3" opacity=".5"/>
  <circle cx="70" cy="96" r="33" fill="#7d5c3d"/>
  <circle cx="130" cy="96" r="33" fill="#7d5c3d"/>
  ${eyes}
  <circle cx="70" cy="96" r="24" fill="none" stroke="#f2c14e" stroke-width="4.5"/>
  <circle cx="130" cy="96" r="24" fill="none" stroke="#f2c14e" stroke-width="4.5"/>
  <path d="M93 92 q7 -7 14 0" fill="none" stroke="#f2c14e" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M100 116 l-8 12 q8 7 16 0 Z" fill="#eda224"/>
  <path d="M56 176 q44 26 88 0 l0 34 q-44 18 -88 0 Z" fill="#155e3c"/>
  <path d="M100 178 l0 34" stroke="#0d4a2e" stroke-width="3"/>
  <circle cx="100" cy="192" r="3.4" fill="#f2c14e"/>
  <circle cx="100" cy="204" r="3.4" fill="#f2c14e"/>
  <g transform="translate(140 168) rotate(12)">
   <rect x="0" y="0" width="34" height="26" rx="4" fill="#8a5a33"/>
   <rect x="3" y="3" width="28" height="20" rx="2" fill="#f2e4c0"/>
   <path d="M7 9 h20 M7 14 h20 M7 19 h13" stroke="#b49a68" stroke-width="2"/>
  </g>
  <ellipse cx="82" cy="218" rx="12" ry="7" fill="#d9820f"/>
  <ellipse cx="118" cy="218" rx="12" ry="7" fill="#d9820f"/>
 </g>
</svg>`;
}

/* ---- 観光客（歩く客。variantで配色と肌を変える） ---- */
function svgTourist(v, mood){
  const tik = (v%2===1) ? "char/tourist_b" : "char/tourist_a";
  if(AssetReg.has(tik)) return `<img src="${AssetReg.url(tik)}" alt="" style="width:100%;height:auto;display:block">`;
  const P = [
    { skin:"#f0c39b", shirt:"#ff8a5c", shorts:"#33566b", hat:"#ecd9ae", acc:"#fff6e0" },
    { skin:"#c99a72", shirt:"#4cc9f0", shorts:"#5a4632", hat:"#ff5a5f", acc:"#fff6e0" },
    { skin:"#8d6b52", shirt:"#2fbf71", shorts:"#2d3a45", hat:"#f2c14e", acc:"#fff6e0" },
  ][v % 3];
  const mouth = mood==="wow"
    ? `<ellipse cx="60" cy="52" rx="5" ry="6.5" fill="#7c3a2d"/>`
    : `<path d="M52 52 q8 7 16 0" fill="none" stroke="#7c3a2d" stroke-width="3.4" stroke-linecap="round"/>`;
  return `
<svg viewBox="0 0 120 180" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
 <g>
  <ellipse cx="60" cy="172" rx="30" ry="6" fill="rgba(0,0,0,.22)"/>
  <rect x="46" y="118" width="12" height="42" rx="6" fill="${P.skin}"/>
  <rect x="62" y="118" width="12" height="42" rx="6" fill="${P.skin}"/>
  <rect x="42" y="158" width="20" height="9" rx="4.5" fill="#8a5a33"/>
  <rect x="58" y="158" width="20" height="9" rx="4.5" fill="#8a5a33"/>
  <path d="M40 82 h40 v34 q-20 8 -40 0 Z" fill="${P.shorts}"/>
  <path d="M36 34 h48 v52 q-24 12 -48 0 Z" fill="${P.shirt}"/>
  <circle cx="46" cy="52" r="3.2" fill="${P.acc}"/>
  <circle cx="58" cy="66" r="3.2" fill="${P.acc}"/>
  <circle cx="72" cy="48" r="3.2" fill="${P.acc}"/>
  <rect x="26" y="40" width="11" height="34" rx="5.5" fill="${P.shirt}"/>
  <rect x="83" y="40" width="11" height="34" rx="5.5" fill="${P.shirt}"/>
  <circle cx="31" cy="80" r="6" fill="${P.skin}"/>
  <circle cx="89" cy="80" r="6" fill="${P.skin}"/>
  <circle cx="60" cy="36" r="24" fill="${P.skin}"/>
  ${mouth}
  <circle cx="51" cy="40" r="3" fill="#241708"/>
  <circle cx="69" cy="40" r="3" fill="#241708"/>
  <path d="M46 32 q5 -4 10 -1 M64 31 q5 -3 10 1" fill="none" stroke="#5a3f28" stroke-width="2.4" stroke-linecap="round"/>
  <ellipse cx="60" cy="16" rx="27" ry="9" fill="${P.hat}"/>
  <path d="M42 14 a18 12 0 0 1 36 0 l0 4 a18 8 0 0 1 -36 0 Z" fill="${P.hat}"/>
  <path d="M42 16 h36" stroke="rgba(0,0,0,.14)" stroke-width="3"/>
  <rect x="50" y="88" width="20" height="14" rx="4" fill="#2d3a45"/>
  <circle cx="60" cy="95" r="4.6" fill="#4cc9f0"/>
 </g>
</svg>`;
}

/* ---- 主人公（上陸シーン用・後ろ姿） ---- */
function svgPlayerBack(){
  if(AssetReg.has("char/player_back"))
    return `<img src="${AssetReg.url("char/player_back")}" alt="" style="width:100%;height:auto;display:block">`;
  return `
<svg viewBox="0 0 100 155" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
 <ellipse cx="50" cy="149" rx="26" ry="5" fill="rgba(0,0,0,.25)"/>
 <rect x="38" y="102" width="10" height="38" rx="5" fill="#e2b58d"/>
 <rect x="52" y="102" width="10" height="38" rx="5" fill="#e2b58d"/>
 <rect x="35" y="136" width="17" height="8" rx="4" fill="#8a5a33"/>
 <rect x="49" y="136" width="17" height="8" rx="4" fill="#8a5a33"/>
 <path d="M34 72 h32 v30 q-16 7 -32 0 Z" fill="#33566b"/>
 <path d="M30 30 h40 v46 q-20 10 -40 0 Z" fill="#fff6e0"/>
 <rect x="34" y="36" width="32" height="34" rx="9" fill="#8a5a33"/>
 <path d="M38 36 l0 30 M62 36 l0 30" stroke="#6b4226" stroke-width="4"/>
 <rect x="40" y="46" width="20" height="9" rx="3" fill="#a06a3c"/>
 <circle cx="50" cy="22" r="17" fill="#e2b58d"/>
 <path d="M33 20 a17 12 0 0 1 34 0 l0 3 -34 0 Z" fill="#3a2b1c"/>
 <ellipse cx="50" cy="9" rx="15" ry="6" fill="#ff8a3d"/>
 <path d="M35 9 a15 8 0 0 1 30 0 Z" fill="#ff8a3d"/>
 <path d="M64 13 q7 9 3 22 M67 42 q4 16 -1 30" stroke="#ffcf94" stroke-width="3"
       fill="none" stroke-linecap="round" opacity=".8"/>
</svg>`;
}

/* ---- 主人公・正面（§6 Young Jungle Entrepreneur:
        キャップ・Tシャツ・バックパック・腕時計・ノート・スニーカー） ---- */
function svgPlayerFront(mood){
  mood = mood || "normal";
  const pik = (mood==="celebrate" && AssetReg.has("char/player_celebrate")) ? "char/player_celebrate"
            : AssetReg.has("char/player_front") ? "char/player_front" : null;
  if(pik) return `<img src="${AssetReg.url(pik)}" alt="" style="width:100%;height:auto;display:block">`;
  const celebrate = mood === "celebrate";
  const happy = celebrate || mood === "happy";
  const eyes = happy
    ? `<path d="M40 34 q5 -5 10 0 M62 34 q5 -5 10 0" fill="none" stroke="#241708" stroke-width="3.2" stroke-linecap="round"/>`
    : `<circle cx="45" cy="35" r="3" fill="#241708"/><circle cx="67" cy="35" r="3" fill="#241708"/>`;
  const mouth = happy
    ? `<path d="M46 46 q10 9 20 0" fill="none" stroke="#8a4a34" stroke-width="3.2" stroke-linecap="round"/>`
    : `<path d="M49 47 q7 4 14 0" fill="none" stroke="#8a4a34" stroke-width="3" stroke-linecap="round"/>`;
  const arms = celebrate
    ? `<rect x="8"  y="42" width="11" height="36" rx="5.5" fill="#fff6e0" transform="rotate(38 13 78)"/>
       <rect x="93" y="42" width="11" height="36" rx="5.5" fill="#fff6e0" transform="rotate(-38 99 78)"/>
       <circle cx="4" cy="42" r="6.5" fill="#e2b58d"/><circle cx="108" cy="42" r="6.5" fill="#e2b58d"/>`
    : `<rect x="20" y="70" width="11" height="36" rx="5.5" fill="#fff6e0"/>
       <rect x="81" y="70" width="11" height="36" rx="5.5" fill="#fff6e0"/>
       <circle cx="25" cy="110" r="6.5" fill="#e2b58d"/><circle cx="87" cy="110" r="6.5" fill="#e2b58d"/>
       <rect x="22" y="98" width="7" height="4.6" rx="2.3" fill="#2d3a45"/>
       <rect x="79" y="102" width="16" height="12" rx="2.5" fill="#e9d8b4" transform="rotate(-8 87 108)"/>
       <path d="M82 106 h10 M82 110 h10" stroke="#b49a68" stroke-width="1.8" transform="rotate(-8 87 108)"/>`;
  return `
<svg viewBox="0 0 112 168" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
 <ellipse cx="56" cy="162" rx="28" ry="5.5" fill="rgba(0,0,0,.24)"/>
 <path d="M28 66 h56 l-4 44 q-24 10 -48 0 Z" fill="#fff6e0"/>
 <path d="M28 66 l-6 8 M84 66 l6 8" stroke="#8a5a33" stroke-width="7" stroke-linecap="round"/>
 <path d="M40 66 q16 8 32 0 l0 8 q-16 8 -32 0 Z" fill="#ffe0b0" opacity=".55"/>
 <path d="M36 68 l0 34 M76 68 l0 34" stroke="#8a5a33" stroke-width="6" stroke-linecap="round" opacity=".85"/>
 <circle cx="56" cy="88" r="6" fill="#ff8a3d"/>
 ${arms}
 <path d="M34 108 h44 v22 q-22 8 -44 0 Z" fill="#33566b"/>
 <rect x="38" y="126" width="12" height="26" rx="6" fill="#e2b58d"/>
 <rect x="62" y="126" width="12" height="26" rx="6" fill="#e2b58d"/>
 <path d="M32 150 h22 v8 q-4 5 -11 5 t-11 -5 Z" fill="#fff6e0"/>
 <path d="M58 150 h22 v8 q-4 5 -11 5 t-11 -5 Z" fill="#fff6e0"/>
 <path d="M32 156 h22 M58 156 h22" stroke="#ff8a3d" stroke-width="3.4"/>
 <circle cx="56" cy="34" r="22" fill="#e2b58d"/>
 ${eyes}
 ${mouth}
 <path d="M34 30 a22 15 0 0 1 44 0 l0 4 -44 0 Z" fill="#3a2b1c"/>
 <path d="M32 32 a24 12 0 0 1 48 0 l0 4 a24 8 0 0 1 -48 0 Z" fill="#ff8a3d"/>
 <ellipse cx="56" cy="16" rx="20" ry="7" fill="#ff8a3d"/>
 <circle cx="56" cy="14" r="4" fill="#e5732a"/>
</svg>`;
}

/* ---- 小さなボート（§34） ---- */
function svgBoat(){
  return `
<svg viewBox="0 0 160 70" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
 <path d="M6 26 q74 20 148 0 q-12 34 -46 38 l-56 0 q-34 -4 -46 -38 Z" fill="#8a5a33"/>
 <path d="M14 30 q66 16 132 0" fill="none" stroke="#6b4226" stroke-width="4"/>
 <path d="M22 40 q58 13 116 0" fill="none" stroke="#6b4226" stroke-width="3" opacity=".7"/>
 <rect x="66" y="34" width="28" height="7" rx="3.5" fill="#6b4226"/>
 <path d="M118 8 l6 26" stroke="#5a4632" stroke-width="4" stroke-linecap="round"/>
 <ellipse cx="126" cy="40" rx="8" ry="4" fill="#5a4632"/>
</svg>`;
}

/* ---- 遠景の島（§74: 遠くに「最終形の店」の灯りを見せる） ---- */
function svgIslandFar(){
  return `
<svg viewBox="0 0 800 190" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"
     style="width:100%;height:100%;display:block">
 <path d="M0 190 L0 130 Q120 70 260 108 Q380 40 520 96 Q660 60 800 118 L800 190 Z" fill="#1d453e"/>
 <path d="M0 190 L0 150 Q160 108 320 138 Q520 96 800 150 L800 190 Z" fill="#16352f"/>
 <g transform="translate(492 74)">
  <rect x="0" y="10" width="16" height="14" rx="2" fill="#d8c290"/>
  <rect x="18" y="4" width="20" height="20" rx="2" fill="#e8d5ae"/>
  <rect x="40" y="12" width="13" height="12" rx="2" fill="#d8c290"/>
  <path d="M18 4 l10 -8 10 8 Z" fill="#b0703c"/>
  <circle cx="9" cy="17" r="1.8" fill="#ffd76e"/>
  <circle cx="28" cy="12" r="2" fill="#ffd76e"/>
  <circle cx="46" cy="18" r="1.8" fill="#ffd76e"/>
  <path d="M60 22 q2 -18 12 -24 M60 22 q10 -12 18 -10 M60 22 q-8 -14 -16 -12" stroke="#123128" stroke-width="3" fill="none" stroke-linecap="round"/>
 </g>
</svg>`;
}

/* ---- 前景のヤシ ---- */
function svgPalm(flip){
  return `
<svg viewBox="0 0 220 320" xmlns="http://www.w3.org/2000/svg"
     style="width:100%;height:auto;display:block;${flip?'transform:scaleX(-1);':''}">
 <path d="M96 320 q-6 -120 22 -212" fill="none" stroke="#7a5230" stroke-width="22" stroke-linecap="round"/>
 <path d="M96 300 q-2 -30 4 -58 M100 236 q-2 -26 6 -50" stroke="#684427" stroke-width="6" fill="none" opacity=".6"/>
 <g fill="#1c8a52">
  <path d="M118 106 q-70 -34 -112 6 q56 26 112 6 Z"/>
  <path d="M118 106 q-52 -64 -108 -52 q30 52 108 64 Z" fill="#177a47"/>
  <path d="M118 106 q6 -76 66 -92 q6 58 -54 100 Z" fill="#22a05f"/>
  <path d="M118 106 q66 -42 102 -10 q-46 42 -102 22 Z"/>
  <path d="M118 106 q76 6 96 52 q-60 12 -98 -38 Z" fill="#177a47"/>
 </g>
 <circle cx="112" cy="116" r="9" fill="#6b4226"/>
 <circle cx="128" cy="112" r="9" fill="#7a5230"/>
</svg>`;
}

/* ---- 前景のシダ（North Star: 植生の密度） ---- */
function svgFern(flip){
  const leaf=(rot,len,col)=>`
   <g transform="rotate(${rot} 80 118)">
    <path d="M80 118 q6 -${len*0.55} 2 -${len}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round"/>
    ${[0.25,0.4,0.55,0.7,0.85].map(t=>{
      const y=118-len*t, s=(1-t)*26+6;
      return `<path d="M${81-2*t} ${y} q-${s} -4 -${s+7} 4 M${81-2*t} ${y} q${s} -4 ${s+7} 4"
        fill="none" stroke="${col}" stroke-width="3.2" stroke-linecap="round"/>`;
    }).join("")}
   </g>`;
  return `
<svg viewBox="0 0 160 130" xmlns="http://www.w3.org/2000/svg"
     style="width:100%;height:auto;display:block;${flip?'transform:scaleX(-1);':''}">
 ${leaf(-26, 74, "#177a47")}
 ${leaf(4, 96, "#1fa05c")}
 ${leaf(30, 70, "#136038")}
</svg>`;
}

/* ---- 上部の林冠（LIVE JUNGLE） ---- */
function svgCanopy(){
  let blobs="";
  for(let i=0;i<11;i++){
    const x=i*80+rnd(-16,16), r=rnd(46,72), y=rnd(-8,24);
    blobs+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${i%2?'#0f4a2e':'#136038'}"/>`;
  }
  return `
<svg viewBox="0 0 800 150" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"
     style="width:100%;height:100%;display:block">
 ${blobs}
 <path d="M120 40 q4 46 -6 66 M640 36 q6 40 -4 62" stroke="#0f4a2e" stroke-width="7" fill="none" stroke-linecap="round"/>
</svg>`;
}

function svgBird(){
  return `<svg width="44" height="20" viewBox="0 0 44 20"><path d="M2 13 Q11 2 22 13 Q33 2 42 13" fill="none" stroke="#14362a" stroke-width="3.6" stroke-linecap="round"/></svg>`;
}

/* ---- 店（§6: レベルで見た目が育つ。10段階を6つの視覚層に圧縮） ---- */
const STALL_THEME = {
  juice:{ a:"#ff8a3d", b:"#fff3dd", sign:"JUICE" },
  coco: { a:"#2bb3a3", b:"#fff3dd", sign:"COCO"  },
  photo:{ a:"#4cc9f0", b:"#fff3dd", sign:"PHOTO" },
  guide:{ a:"#2fbf71", b:"#fff3dd", sign:"TOUR"  },
  brand:{ a:"#ff5a5f", b:"#fff3dd", sign:"BRAND" },
};
function stallProducts(biz){
  switch(biz){
    case "juice": return `
      <g transform="translate(150 156)">
       <path d="M0 0 h20 l-3 30 h-14 Z" fill="#ff8a3d"/><path d="M28 0 h20 l-3 30 h-14 Z" fill="#ff5a5f"/>
       <path d="M56 0 h20 l-3 30 h-14 Z" fill="#2fbf71"/>
       <path d="M10 2 l6 -14 M38 2 l6 -14 M66 2 l6 -14" stroke="#fff6e0" stroke-width="3.4" stroke-linecap="round"/>
       <circle cx="94" cy="20" r="11" fill="#ffb03d"/><circle cx="108" cy="26" r="9" fill="#ff6b57"/>
       <circle cx="100" cy="8" r="8" fill="#8fd14f"/>
      </g>`;
    case "coco": return `
      <g transform="translate(158 152)">
       <circle cx="16" cy="22" r="17" fill="#7a5230"/><circle cx="52" cy="24" r="15" fill="#8a5f3a"/>
       <circle cx="86" cy="22" r="17" fill="#6b4628"/>
       <circle cx="11" cy="16" r="4" fill="#a37b50" opacity=".8"/><circle cx="81" cy="15" r="4" fill="#93683f" opacity=".8"/>
       <path d="M16 6 l5 -14 M86 6 l-4 -13" stroke="#fff6e0" stroke-width="3.4" stroke-linecap="round"/>
      </g>`;
    case "photo": return `
      <g transform="translate(150 142)">
       <rect x="8" y="10" width="52" height="34" rx="7" fill="#2d3a45"/>
       <circle cx="34" cy="27" r="12" fill="#4cc9f0"/><circle cx="34" cy="27" r="6" fill="#1c6f8c"/>
       <rect x="46" y="2" width="12" height="8" rx="2" fill="#2d3a45"/>
       <path d="M14 44 l-8 26 M34 44 l0 26 M54 44 l8 26" stroke="#2d3a45" stroke-width="4.6" stroke-linecap="round"/>
       <rect x="72" y="14" width="24" height="18" rx="2" fill="#fff6e0" transform="rotate(8 84 23)"/>
       <rect x="92" y="20" width="24" height="18" rx="2" fill="#fff6e0" transform="rotate(-7 104 29)"/>
      </g>`;
    case "guide": return `
      <g transform="translate(148 136)">
       <rect x="0" y="6" width="76" height="52" rx="6" fill="#e9d8b4"/>
       <path d="M8 44 q16 -22 28 -10 q12 10 30 -18" fill="none" stroke="#1fae6a" stroke-width="4.6" stroke-linecap="round"/>
       <circle cx="62" cy="18" r="4.6" fill="#ff5a5f"/>
       <path d="M92 2 l0 56" stroke="#8a5a33" stroke-width="5" stroke-linecap="round"/>
       <path d="M92 4 l26 8 -26 8 Z" fill="#ff5a5f"/>
      </g>`;
    case "brand": return `
      <g transform="translate(146 138)">
       <path d="M2 4 h96" stroke="#6b4226" stroke-width="5" stroke-linecap="round"/>
       <path d="M18 8 l0 6 q-10 4 -8 16 l8 24 q10 5 20 0 l8 -24 q2 -12 -8 -16 l0 -6 q-10 6 -20 0 Z" fill="#fff6e0"/>
       <circle cx="28" cy="34" r="5.4" fill="#ff5a5f"/>
       <ellipse cx="72" cy="30" rx="15" ry="6" fill="#ff5a5f"/>
       <path d="M60 28 a13 10 0 0 1 25 0 Z" fill="#ff5a5f"/>
      </g>`;
  }
  return "";
}
/* 店の成長段階（docs/ART_ORDER.md §5, §8）
   W3→W11→W20 で確実に昇格し、アートの変化を見逃さない設計にする。

   0 露店     まだ何もない。売上も人もいない
   1 屋台     商売が回り始めた
   2 小店舗   人を雇い、設備が入った
   3 本格店   仕組みで回る店になった
*/
const SHOP_STAGES = [
  { n:0, key:"stall", name:"露店",   need:"" },
  { n:1, key:"stall", name:"屋台",   need:"商売が回り始めた" },
  { n:2, key:"shop",  name:"小店舗", name2:"人と設備が入った" },
  { n:3, key:"shop",  name:"本格店", name2:"仕組みで回る店になった" },
];
function shopStage(s){
  if(!s) return 0;
  const week = Math.max(1, Number(s.week) || 1);
  if(week >= 20) return 3;
  if(week >= 11) return 2;
  if(week >= 3)  return 1;
  return 0;
}
/* 旧の売上ベース判定。バランス比較用に残すが、表示判定には使わない。 */
function shopStageByPerformanceLegacy(s){
  if(!s) return 0;
  const h = s.history || [];
  // 直近4週の平均売上。単発の当たりでは昇格しない
  const recent = h.slice(-4);
  const avgSales = recent.length ? recent.reduce((a,x)=>a+(x.sales||0),0)/recent.length : 0;
  const base = (B.BUSINESSES && B.BUSINESSES[s.bizId]) ? B.BUSINESSES[s.bizId] : null;
  const scale = base ? base.price * base.capPerBlock * 2 : 50000;   // 事業ごとの「1段階ぶん」
  const staff = (s.staff||[]).length, autos = (s.autos||[]).length;
  const sys   = s.systemLevel || 0;

  /* 閾値は実測から引いた。24週の売上は scale 比で
     W12≒1.2〜1.5倍 / W20≒2.2倍 まで伸びる（NORMAL・主要ペルソナ実測）。
     採用はW17、自動化はW21解放なので、そこを必須にすると誰も昇格できない。
     「売上が主、人と設備は後押し」の形にする。 */
  let n = 0;
  if(avgSales >= scale*0.45 || h.length >= 3) n = 1;                     // 商売が回り出した
  if(avgSales >= scale*1.05 || (avgSales >= scale*0.80 && (staff>=1||autos>=1))) n = 2;
  if(avgSales >= scale*2.00 || (avgSales >= scale*1.50 && (staff>=1||autos>=1||sys>=35))) n = 3;
  return n;
}
function shopStageInfo(s){ return SHOP_STAGES[shopStage(s)] || SHOP_STAGES[0]; }

function svgStall(biz, lvl, opts){
  opts = opts || {};
  const stg = (opts.stage!=null) ? Math.max(0, Math.min(3, opts.stage))
    : (lvl>=8 ? 3 : lvl>=5 ? 2 : lvl>=2 ? 1 : 0);
  // 4段階版を最優先。未制作の事業は従来の stall/shop へフォールバック。
  const stageK = "stall/"+biz+"_s"+stg;
  const shopK = "stall/"+biz+"_shop", stallK = "stall/"+biz+"_stall";
  const sk = AssetReg.has(stageK) ? stageK
    : ((stg>=2 && AssetReg.has(shopK)) ? shopK : (AssetReg.has(stallK) ? stallK : null));
  if(sk){
    // 4段階は建物の成長を画面サイズでも補強。透明余白があるため見切れない。
    const scale = sk===stageK
      ? ([0.88, 0.96, 1.02, 1.10][stg] || 1)
      : ([0.78, 0.92, 1.0, 1.08][stg] || 1);
    const glow  = stg>=3 ? "filter:drop-shadow(0 6px 18px rgba(255,200,80,.35));" : "";
    const stageClass = sk===stageK ? "jz-stall-stage" : "";
    return `<img class="${stageClass}" src="${AssetReg.url(sk)}" alt="" style="width:${(scale*100).toFixed(0)}%;height:auto;display:block;margin:0 auto;${glow}transition:width .6s cubic-bezier(.2,.9,.3,1.2)">`;
  }
  const T = STALL_THEME[biz] || STALL_THEME.juice;
  const showStaff = lvl>=4 || (opts.staff||0)>0;
  let stripes="";
  for(let i=0;i<8;i++){
    stripes += `<rect x="${86+i*32}" y="86" width="32" height="46" fill="${i%2? T.a : T.b}"/>`;
  }
  return `
<svg viewBox="0 0 420 320" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
 <defs>
  <linearGradient id="stWood" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stop-color="#b57e46"/><stop offset="1" stop-color="#82542a"/>
  </linearGradient>
  <clipPath id="stAwn"><path d="M84 132 q126 -58 252 0 l0 -18 q-126 -60 -252 0 Z"/></clipPath>
 </defs>
 <ellipse cx="210" cy="300" rx="170" ry="16" fill="rgba(0,0,0,.22)"/>

 ${lvl>=5? `
  <g>
   <rect x="112" y="88" width="196" height="132" rx="8" fill="#efe0bd"/>
   <path d="M104 92 h212 l-14 -34 q-92 -26 -184 0 Z" fill="#b0703c"/>
   <path d="M112 92 h196" stroke="#8a5a33" stroke-width="5"/>
   <rect x="132" y="112" width="52" height="42" rx="6" fill="#bfe8e2"/>
   <path d="M132 133 h52 M158 112 v42" stroke="#8a5a33" stroke-width="4"/>
   <rect x="240" y="112" width="52" height="42" rx="6" fill="#bfe8e2"/>
   <path d="M240 133 h52 M266 112 v42" stroke="#8a5a33" stroke-width="4"/>
  </g>`:""}

 ${lvl>=8? `
  <g transform="translate(6 168)">
   <rect x="0" y="26" width="86" height="70" rx="6" fill="#caa06a"/>
   <path d="M-6 30 h98 l-10 -24 q-39 -12 -78 0 Z" fill="#8a5a33"/>
   <rect x="14" y="56" width="26" height="20" rx="2" fill="#e9d8b4"/>
   <rect x="46" y="48" width="24" height="18" rx="2" fill="#e9d8b4"/>
   <rect x="46" y="68" width="24" height="18" rx="2" fill="#dcbf85"/>
   <path d="M14 66 h26 M26 56 v20 M46 57 h24 M46 77 h24" stroke="#a3865c" stroke-width="2.4"/>
  </g>`:""}

 <rect x="128" y="132" width="8" height="70" fill="#6b4226"/>
 <rect x="284" y="132" width="8" height="70" fill="#6b4226"/>

 ${lvl>=2? `
  <g>
   <g clip-path="url(#stAwn)">${stripes}</g>
   <path d="M84 132 q126 -58 252 0" fill="none" stroke="#6b4226" stroke-width="7" stroke-linecap="round"/>
   <path d="M84 132 q10 14 21 0 q10 14 21 0 q10 14 21 0 q10 14 21 0 q10 14 21 0 q10 14 21 0 q10 14 21 0 q10 14 21 0 q10 14 21 0 q10 14 21 0 q10 14 21 0 q10 14 21 0"
         fill="none" stroke="${T.a}" stroke-width="5" opacity=".85"/>
  </g>`:""}

 <g>
  <rect x="118" y="192" width="184" height="72" rx="10" fill="url(#stWood)"/>
  <path d="M118 216 h184 M118 240 h184" stroke="#6b4226" stroke-width="3.4" opacity=".55"/>
  <rect x="126" y="264" width="12" height="30" fill="#6b4226"/>
  <rect x="282" y="264" width="12" height="30" fill="#6b4226"/>
  <path d="M118 200 q92 12 184 0" fill="none" stroke="#d9b27c" stroke-width="4" opacity=".5"/>
 </g>

 ${stallProducts(biz)}

 ${showStaff? `
  <g transform="translate(310 168)">
   <circle cx="22" cy="16" r="15" fill="#e8b98a"/>
   <path d="M8 14 a15 10 0 0 1 28 0 l0 2 -28 0 Z" fill="#4a3624"/>
   <path d="M14 20 q4 4 8 0 M28 20 q4 4 8 0" stroke="#3a281a" stroke-width="0" fill="none"/>
   <circle cx="17" cy="17" r="2.2" fill="#241708"/><circle cx="27" cy="17" r="2.2" fill="#241708"/>
   <path d="M17 24 q5 4 10 0" fill="none" stroke="#8a4a34" stroke-width="2.4" stroke-linecap="round"/>
   <path d="M6 34 h32 v36 q-16 7 -32 0 Z" fill="#29465a"/>
   <rect x="12" y="40" width="20" height="26" rx="4" fill="#3d5f77"/>
  </g>`:""}

 ${lvl>=3? `
  <g transform="translate(330 226)">
   <ellipse cx="34" cy="24" rx="32" ry="10" fill="#a06a3c"/>
   <rect x="30" y="24" width="8" height="38" fill="#6b4226"/>
   <ellipse cx="34" cy="64" rx="14" ry="5" fill="rgba(0,0,0,.18)"/>
   <ellipse cx="-6" cy="52" rx="12" ry="5" fill="#8a5a33"/><rect x="-10" y="52" width="8" height="16" fill="#6b4226"/>
  </g>`:""}

 <g transform="translate(210 ${lvl>=2?52:96})">
  <rect x="-74" y="0" width="148" height="40" rx="9" fill="#8a5a33"
        stroke="${lvl>=6? '#f2c14e':'#6b4226'}" stroke-width="${lvl>=6? 5:3}"/>
  <text x="0" y="27" text-anchor="middle"
        font-family="Avenir Next, Verdana, sans-serif" font-size="21" font-weight="900"
        letter-spacing="4" fill="${lvl>=6? '#ffe9a3':'#fff3dd'}">${T.sign}</text>
  ${lvl>=6? `<circle cx="-86" cy="20" r="6" fill="#ffd76e"/><circle cx="86" cy="20" r="6" fill="#ffd76e"/>`:""}
  <path d="M-40 -14 L-40 0 M40 -14 L40 0" stroke="#6b4226" stroke-width="5"/>
 </g>
</svg>`;
}

/* =======================================================================
   舞台の組み立て
   ======================================================================= */
function stage(timeClass, inner){
  const app = document.getElementById("app");
  app.innerHTML = `<div class="jz-stage ${timeClass}" id="jzStage">${inner}</div>`;
  const st = document.getElementById("jzStage");
  enableParallax(st);
  return st;
}
/* パララックス層ラッパー。d=深度（手前ほど大きく動く）。UIは絶対に包まない */
function par(d, html){
  return `<div class="jz-par" data-d="${d}">${html}</div>`;
}

/* 地面に立つものの前後関係（§2.5D）。
   奥行きは「画面の下にあるものほど手前」で決まる。これを守らないと、
   手前を歩いている客が、奥にある屋台の後ろへ回り込んで消える。
   ——実際そうなっていた（客 bottom14〜19% / z13 に対し、屋台 bottom26% / z15）。
   z を各所に直書きすると必ずまた壊れるので、bottom% から機械的に出す。

     bottom 26%（屋台の位置）＝ 最も奥  → z 15
     bottom 13%（画面のかなり下）＝ 最も手前 → z 21
   ビネット(22)・グレイン(23)より上には行かせない。 */
const GZ = { farPct:26, nearPct:13, zFar:15, zNear:21 };
function groundZ(bottomPct){
  const t = (GZ.farPct - bottomPct) / (GZ.farPct - GZ.nearPct);
  return Math.round(GZ.zFar + Math.max(0, Math.min(1, t)) * (GZ.zNear - GZ.zFar));
}

/* 吹き出しは客の立ち位置から出す。ただし客が画面端にいると枠外へ飛び出し、
   幅が潰れて文字が縦1列になる（375px幅で実測22pxはみ出していた）。
   左右とも画面内に収める。上限は CSS の max-width と揃える。 */
function bubbleX(x){
  const vw = window.innerWidth || 375;
  const w = Math.min(vw * 0.66, 240);
  return Math.round(Math.min(Math.max(10, x), Math.max(10, vw - w - 12)));
}
/* §4 Premium 2.5D Parallax。強すぎない・低負荷（rAF＋lerp）。reduced-motionでは無効 */
function enableParallax(st){
  if(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const layers = [...st.querySelectorAll(".jz-par")];
  if(!layers.length) return;
  let tx=0, ty=0, cx=0, cy=0, raf=null;
  function step(){
    raf = null;
    cx += (tx-cx)*0.1; cy += (ty-cy)*0.1;
    for(const L of layers){
      const d = +L.dataset.d || 0;
      L.style.transform = `translate(${(-cx*d*80).toFixed(1)}px, ${(-cy*d*36).toFixed(1)}px) scale(1.05)`;
    }
    if(Math.abs(tx-cx)>0.002 || Math.abs(ty-cy)>0.002) raf = requestAnimationFrame(step);
  }
  const move=(x,y)=>{ tx=x/innerWidth-0.5; ty=y/innerHeight-0.5; if(!raf) raf=requestAnimationFrame(step); };
  st.addEventListener("pointermove", e=> move(e.clientX, e.clientY));
  st.addEventListener("touchmove",  e=>{ const t=e.touches[0]; if(t) move(t.clientX, t.clientY); }, {passive:true});
}

function starsHtml(){
  let h = "";
  for(let i=0;i<16;i++){
    h += `<div class="jz-star" style="left:${rnd(2,98)}%;top:${rnd(2,88)}%;animation-delay:${rnd(0,2.6).toFixed(2)}s;opacity:${rnd(.3,.9).toFixed(2)}"></div>`;
  }
  return `<div class="jz-stars">${h}</div>`;
}
function fliesHtml(n){
  let h="";
  for(let i=0;i<n;i++){
    h+=`<div class="jz-fly" style="left:${rnd(6,92)}%;top:${rnd(24,70)}%;animation-delay:${rnd(0,5).toFixed(2)}s"></div>`;
  }
  return h;
}
/* 背景レイヤー一式（§3 レイヤー分離 / §4 各層を異なる深度で視差）。
   opts: {island, boat, shore, ground, canopy, palms, flies, bgKey, bgRaw}
   bgKey の画像が assets/ にあれば画像背景に切り替え、SVG地形は省略。
   その場合も「動く光・前景・生き物」は画像の上に重ねる（一枚絵ゲーム禁止 §3）。 */
/* 縦長の画面では縦構図の背景（_v）に差し替える。
   横長画像を cover で縦画面に入れると、画像中央の狭い縦帯しか映らず、
   左右に描かれた見どころが丸ごと切り落とされる（実測: 1672x941 を 375x812 に入れると
   横1443px相当のうち中央375pxだけが見える）。縦構図の素材があるならそれを使う。 */
function bgKeyFor(key){
  if(!key) return key;
  const portrait = (window.innerHeight || 0) > (window.innerWidth || 1);
  const vk = key + "_v";
  return (portrait && AssetReg.has(vk)) ? vk : key;
}

function skyBits(opts){
  opts = opts || {};
  const wantKey = bgKeyFor(opts.bgKey);
  const bgKey = (wantKey && AssetReg.has(wantKey)) ? wantKey : null;
  let h = `<div class="jz-sky"></div>`;

  if(bgKey){
    const bgTag = `<div class="jz-bgimg${opts.bgRaw?' raw':''}${opts.sway?' sway':''}" style="background-image:url('${AssetReg.url(bgKey)}')"></div>`;
    /* 葉を揺らす時は par() で包まない。SVGフィルタの変位と親の scale(1.05) が
       噛み合うと要素の位置がずれ、縦長のスマホで画面下端に地の色の帯が出る
       （実測: 背景の下端が 723px、画面は 812px）。揺らさない時は従来どおり視差をかける。 */
    h += opts.sway ? bgTag : par(0.03, bgTag);
    /* 画像の中の海は描かれてはいるが、完全に止まっている。止まった水は「絵」に見える。
       水面の反射だけを重ねて、光が揺れている状態を作る。
       海の高さは背景ごとに違うので、位置は呼び出し側から [top, height] で渡す。 */
    if(opts.glint){
      let g = "";
      for(let i=0;i<8;i++){
        g += `<div class="jz-glint" style="left:${rnd(6,90).toFixed(1)}%;top:${rnd(4,92).toFixed(1)}%;`
           + `width:${rnd(12,28)|0}px;animation-delay:${rnd(0,3.2).toFixed(2)}s"></div>`;
      }
      h += par(0.05, `<div class="jz-glintband" style="top:${opts.glint[0]};height:${opts.glint[1]}">${g}</div>`);
    }
    h += par(0.02, `<div class="jz-godray"></div>`);
  } else {
    h += par(0.012, starsHtml()) + par(0.022, `<div class="jz-sun"></div>`);
    if(opts.island) h += par(0.03, `<div class="jz-far" style="bottom:33%;height:150px">${svgIslandFar()}</div>`);
    if(opts.sea !== false){
      let glints = "";
      for(let i=0;i<9;i++){
        glints += `<div class="jz-glint" style="left:${rnd(6,92).toFixed(1)}%;top:${rnd(8,86).toFixed(1)}%;
          width:${rnd(14,34)|0}px;animation-delay:${rnd(0,2.6).toFixed(2)}s"></div>`;
      }
      h += par(0.05, `<div class="jz-sea">
              <div class="jz-sunpath"></div>
              <div class="jz-wave" style="top:8%"></div>
              <div class="jz-wave" style="top:34%;animation-delay:1.6s"></div>
              <div class="jz-wave" style="top:62%;animation-delay:3.1s"></div>
              ${glints}
            </div>`);
    }
    if(opts.shore)  h += par(0.07, `<div class="jz-foam" style="bottom:25.5%"></div><div class="jz-shore"></div>`);
    if(opts.ground) h += par(0.07, `<div class="jz-ground"></div><div class="jz-path"></div>`);
    h += par(0.02, `<div class="jz-godray"></div>`);
  }

  if(opts.boat){
    const bt = opts.boat;
    // ボートはJSでleftを動かすため par で包まない
    h += `<div class="jz-boat" id="${bt.id||''}" style="left:${bt.left};bottom:${bt.bottom};width:150px;transform:scale(${bt.scale||1})">${svgBoat()}</div>`;
  }
  if(opts.canopy && !bgKey) h += par(0.12, `<div class="jz-canopy">${svgCanopy()}</div>`);
  // 画像背景には前景植物が焼き込まれがち。二重描画を避けるため、
  // 画像使用時はスタイルの合う fg 素材がある時だけ前景を重ねる
  /* 前景植物は「額縁」であって主役ではない。役割は奥行きを作ることだけ。
     ——固定pxだと375px幅のスマホで画面の6割を覆い、店とUIを飲み込む。
     vw基準にして画面端へ逃がし、下端は大きく画面外へ出す（画面内で終わると置物に見える）。
     左右でサイズ・高さ・種類の重なりを変える＝自然界に左右対称はない。 */
  if(opts.palms !== false && (!bgKey || AssetReg.has("fg/palm"))){
    h += par(0.16, `<div class="jz-palmwrap" style="left:-15vw;bottom:-9%;width:43vw;max-width:240px">${fgPalm(false)}</div>
          <div class="jz-palmwrap" style="right:-19vw;bottom:-6%;width:49vw;max-width:272px;animation-delay:1.4s">${fgPalm(true)}</div>`);
  }
  /* シダはヤシと重ねない。重なると「団子」になり、前景が1つの塊に見える。 */
  if(opts.palms !== false && (!bgKey || AssetReg.has("fg/fern"))){
    h += par(0.18, `<div class="jz-fernwrap" style="left:-7vw;bottom:-4%;width:26vw;max-width:146px;animation-delay:.7s">${fgFern(false)}</div>
          <div class="jz-fernwrap" style="right:-6vw;bottom:-5%;width:24vw;max-width:134px;animation-delay:2s">${fgFern(true)}</div>`);
  }
  if(opts.flies) h += par(0.09, fliesHtml(opts.flies));
  h += `<div class="jz-grain"></div><div class="jz-vig"></div>`;
  return h;
}

function hudHtml(s){
  // §1 STARTUP ERA のあいだだけ「/24」を出す。それ以降は週に上限がない
  const startup = !s.era || s.era === "STARTUP";
  const total = (B.CONFIG && B.CONFIG.totalWeeks) || 24;
  const sub = runwayChip(s) + macroChip(s);
  return `
  <div class="jz-hud">
    <div class="jz-hud-row">
      <div class="jz-chip">🌴 WEEK ${s.week}${startup?`<span style="opacity:.5;font-size:11px">/${total}</span>`:``}</div>
      <div class="jz-chip jz-cashchip" id="jzCash"><div class="lbl">CASH</div><div class="val">${B.fmt(s.cash)}</div></div>
    </div>
    ${sub?`<div class="jz-hud-sub">${sub}</div>`:``}
  </div>`;
}

/* 危機HUD — 潰れる前に「あと何週もつか」を毎週見せる。
   資金が尽きて終わるゲームで、残り時間だけ見えないのは不親切（§54 失敗を教えに変える）。 */
function runwayChip(s){
  const R = B.Runway; if(!R || !s.history || s.history.length < 2) return "";
  const w = R.weeks(s);
  if(!isFinite(w)) return `<div class="jz-chip jz-rw ok"><div class="lbl">RUNWAY</div><div class="val">安定</div></div>`;
  const n = Math.floor(w);
  const cls = n < 4 ? "bad" : n < 8 ? "warn" : "ok";
  return `<div class="jz-chip jz-rw ${cls}"><div class="lbl">RUNWAY</div><div class="val">${n>=99?"99+":n} 週</div></div>`;
}
/* 進行中のマクロ事象（PANDEMIC等）を、需要が何%になっているかと一緒に出す */
function macroChip(s){
  const M = B.Macro; if(!M || !s.macro) return "";
  let d, ph, dm;
  try{ d = M.def(s); ph = M.phase(s); dm = Math.round(M.demandMult(s)*100); }catch(e){ return ""; }
  if(!d) return "";
  const cls = dm < 70 ? "bad" : dm < 95 ? "warn" : "ok";
  return `<div class="jz-chip jz-macro ${cls}"><div class="lbl">${d.emoji||"🌊"} ${ph&&ph.name?ph.name:d.name}</div><div class="val">需要 ${dm}%</div></div>`;
}
function bumpCash(){
  const c = $s("#jzCash"); if(!c) return;
  const s = B.Engine.state;
  c.querySelector(".val").textContent = B.fmt(s.cash);
  c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump");
}

/* ---- 会話（ADV形式：左右に立ち絵／下部にウィンドウ／話者だけを明るく） ----
   立ち絵を小さく1体だけ出すと「アイコン付きのテキスト」にしか見えない。
   会話に出る全員を最初から左右に置き、話している側だけを前に出す。
   ——誰が喋っているかを、色ではなく「明るさと大きさ」で示すのが基本（視線誘導）。 */

/* 会話用の立ち絵。svgOwl() 等は幅100%固定で返ってくるため、
   高さを揃えたいADVでは使わず、画像を直接組む（無い時だけSVGに落とす）。 */
function actorArt(who, mood, v){
  const key = who === "owl"
        ? "char/owl_" + (mood==="happy" ? "happy" : (mood==="worried"||mood==="surprise") ? "worried" : "neutral")
    : who === "tourist" ? "char/tourist_" + (((v||0)%2===1) ? "b" : "a")
    : who === "player"  ? "char/player_" + (mood==="celebrate" ? "celebrate" : "front")
    : null;
  if(key && AssetReg.has(key)) return `<img src="${AssetReg.url(key)}" alt="">`;
  return who === "owl" ? svgOwl(mood) : who === "tourist" ? svgTourist(v||0, mood) : "";
}

function actorName(who, name){
  return name || (who === "owl" ? "OWL" : who === "tourist" ? "観光客" : who === "player" ? "あなた" : "");
}

function dialogue(lines, done){
  const st = $s("#jzStage"); if(!st){ done && done(); return; }

  // 出演者を「出てきた順」に最大2人まで拾い、先に出たほうを左に置く。
  const cast = [];
  lines.forEach(L=>{ if(L.who && cast.indexOf(L.who) < 0 && cast.length < 2) cast.push(L.who); });

  const wrap = document.createElement("div");
  wrap.className = "jz-dlg";
  wrap.innerHTML = `
    <div class="cast">
      ${cast.map((w,idx)=>`<div class="jz-actor ${idx===0?"a-left":"a-right"}" data-who="${w}"></div>`).join("")}
    </div>
    <div class="box"><div class="name"></div><div class="txt"></div><div class="tap">▼ タップ</div></div>`;
  st.appendChild(wrap);

  const nameEl = wrap.querySelector(".name"), txtEl = wrap.querySelector(".txt");
  const actors = [...wrap.querySelectorAll(".jz-actor")];
  let i = 0, timer = null, typing = false;

  function show(){
    const L = lines[i];
    actors.forEach(a=>{
      const isSpeaker = a.dataset.who === L.who;
      // 話者だけ表情を更新する。黙っている側の顔を変えると、誰の発言か読めなくなる。
      if(isSpeaker || !a.innerHTML) a.innerHTML = actorArt(a.dataset.who, isSpeaker ? L.mood : "normal", L.v);
      a.classList.toggle("on", isSpeaker);
      a.classList.toggle("off", !isSpeaker);
    });
    nameEl.textContent = actorName(L.who, L.name);
    txtEl.textContent = ""; typing = true; let c = 0;
    timer = setInterval(()=>{
      c++; txtEl.textContent = L.text.slice(0, c);
      if(c >= L.text.length){ clearInterval(timer); typing = false; }
    }, 17);
  }
  /* 送りは画面のどこを触ってもよい。会話中は背景を操作させないので、
     小さなウィンドウを狙わせる理由がない（狭い的を押させるのは事故のもと）。 */
  wrap.onclick = ()=>{
    B.Sound.click();
    if(typing){ clearInterval(timer); txtEl.textContent = lines[i].text; typing = false; return; }
    i++;
    if(i < lines.length){ show(); } else { wrap.remove(); done && done(); }
  };
  show();
}

/* ---- コインが財布へ飛ぶ（§37,§68） ---- */
function coinFly(fromX, fromY, amount, done){
  const target = $s("#jzCash");
  const tr = target ? target.getBoundingClientRect() : { left: innerWidth-70, top: 24, width: 60, height: 40 };
  const tx = tr.left + tr.width*0.5, ty = tr.top + tr.height*0.6;
  const N = 3;
  let landed = 0;
  for(let k=0; k<N; k++){
    setTimeout(()=>{
      const c = document.createElement("div");
      c.className = "jz-coin";
      document.body.appendChild(c);
      const sx = fromX + rnd(-14,14), sy = fromY + rnd(-8,8);
      const mx = (sx+tx)/2 + rnd(-50,50), my = Math.min(sy,ty) - rnd(90,150); // 放物線の頂点
      const t0 = performance.now(), dur = 620;
      (function step(now){
        const t = Math.min(1,(now-t0)/dur), u = 1-t;
        const x = u*u*sx + 2*u*t*mx + t*t*tx;
        const y = u*u*sy + 2*u*t*my + t*t*ty;
        c.style.transform = `translate(${x-12}px, ${y-12}px) rotate(${t*540}deg)`;
        if(t<1){ requestAnimationFrame(step); }
        else{
          c.remove(); landed++;
          if(landed===1) B.Sound.coin();
          if(landed===N){
            bumpCash();
            const pop = document.createElement("div");
            pop.className = "jz-pop";
            pop.textContent = "+" + B.fmt(amount);
            pop.style.left = (tx-60)+"px"; pop.style.top = (ty+14)+"px";
            document.body.appendChild(pop);
            setTimeout(()=>pop.remove(), 1200);
            done && done();
          }
        }
      })(t0);
    }, k*110);
  }
}

/* =======================================================================
   SCENE 1: TITLE（§73-74）
   ======================================================================= */
function sceneTitle(){
  planOpen = false; removeBackChip();
  const has = B.Engine.hasSave();
  stage("t-day", `
    ${skyBits({ bgKey:"bg/title_bg", palms:false, flies:3, sway:true })}
    <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      <filter id="leafSway" x="-6%" y="-6%" width="112%" height="112%">
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves="2" seed="4" result="n">
          <animate attributeName="baseFrequency" dur="16s"
            values="0.006 0.011;0.009 0.014;0.007 0.010;0.006 0.011" repeatCount="indefinite"/>
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </defs></svg>
    <div class="jz-title-center">
      <div class="jz-logo">JUNGLE<br><span class="g">BIZ</span></div>
      <div class="jz-tagline">Tropical Business Adventure</div>
      <div class="jz-copy">10万円と、週40時間。<br>ジャングルの端の小さな屋台から、すべてが始まる。</div>
      <div class="jz-title-btns">
        ${has? `<button class="jz-btn" id="jzCont">▶ つづきから</button>` : ``}
        <button class="jz-btn ${has? "ghost":""}" id="jzNew">${has? "新しい島で始める":"▶ 冒険を始める"}</button>
      </div>
    </div>
    <div class="jz-foot">自動セーブ / スマホ・タブレット・PC対応<br>
      <span style="letter-spacing:.26em">PLAY FIRST. LEARN WITHOUT NOTICING.</span></div>
  `);
  $s("#jzNew").onclick = ()=>{
    B.Sound.click();
    if(has && !confirm("新しく始めると今のセーブは消えます。よろしいですか？")) return;
    if(has) B.Engine.clear();
    sceneIntro();
  };
  if(has){
    $s("#jzCont").onclick = ()=>{
      B.Sound.click();
      if(B.Engine.load()){
        const st = B.Engine.state;
        lastSeenWeek = st.week;
        if(st._tut === "firstSale"){ sceneFirstSale(); }     // §42 初売り前に閉じた→初売りから再開
        else sceneLive();
      }
      else sceneIntro();
    };
  }
}

/* =======================================================================
   SCENE 2: INTRO — 上陸（§33-35）
   ======================================================================= */
function sceneIntro(){
  introTimers.forEach(clearTimeout); introTimers = [];
  const st = stage("t-predawn", `
    ${skyBits({ boat:{ id:"jzBoat", left:"-18%", bottom:"25%", scale:1 }, shore:true, flies:5, bgKey:"bg/beach_dawn", glint:["46%","17%"] })}
    <button class="jz-skip" id="jzSkip">スキップ ▶▶</button>
    <div id="jzActors"></div>
  `);
  const T = (ms,fn)=> introTimers.push(setTimeout(fn, ms));

  T(600, ()=>{ st.classList.remove("t-predawn"); st.classList.add("t-dawn"); });          // 夜明け（§33）
  T(900, ()=>{ const b=$s("#jzBoat"); if(b){ b.style.left="40%"; b.style.transform="scale(.78)"; } }); // ボート接近
  T(3400, ()=>{                                                                            // 上陸（§34）
    const a = $s("#jzActors"); if(!a) return;
    a.innerHTML = `
      <div class="jz-popin" style="position:absolute;left:57%;bottom:17.5%;width:72px;z-index:16">${svgPlayerBack()}</div>
      <!-- 中央揃えに transform を使わない。jz-popin のアニメは transform:none で終わるため、
           translateX(-50%) は再生後に消えて左へずれる。left/right + flex なら影響を受けない。 -->
      <div class="jz-popin" style="position:absolute;left:0;right:0;top:20%;z-index:24;display:flex;justify-content:center">
        <div class="jz-chip" style="text-align:center">
          <div style="font-size:11px;letter-spacing:.2em;opacity:.65">所持金</div>
          <div id="jzIntroCash" style="font-size:26px;font-weight:900;color:var(--jzGold);font-variant-numeric:tabular-nums">¥0</div>
          <div style="font-size:11px;opacity:.75;margin-top:3px">🎒 荷物：小さなバッグひとつ</div>
        </div>
      </div>`;
    const el = $s("#jzIntroCash");
    const t0 = performance.now(), goal = (B.CONFIG && B.CONFIG.startCash) || 100000;
    (function cnt(now){
      const t = Math.min(1,(now-t0)/900);
      el.textContent = "¥" + Math.round(goal*t).toLocaleString("ja-JP");
      if(t<1 && document.body.contains(el)) requestAnimationFrame(cnt);
    })(t0);
  });
  T(4700, ()=>{                                                                            // OWL登場（§35）
    dialogue([
      { who:"owl", text:"ようこそ、ジャングルへ。" },
      { who:"owl", text:"先に言っておこう。ここでは、誰も君に給料をくれない。" },
      { who:"owl", text:"だから——自分で価値を作って、誰かに買ってもらう。" },
      { who:"owl", mood:"happy", text:"それが「商売」だ。さあ、君の店を建てよう。" },
    ], sceneSelect);
  });
  $s("#jzSkip").onclick = ()=>{ B.Sound.click(); introTimers.forEach(clearTimeout); introTimers=[]; sceneSelect(); };
}

/* =======================================================================
   SCENE 3: BUSINESS SELECT（§36,§84 — カードでなく「世界を選ぶ」）
   ======================================================================= */
function sceneSelect(){
  introTimers.forEach(clearTimeout); introTimers = [];
  let selected = null, diff = "NORMAL";
  const bizs = Object.values(B.BUSINESSES);
  const totems = bizs.map(b=>`
    <button class="jz-totem" data-id="${b.id}">
      <div class="em">${b.emoji}</div>
      <div class="nm">${b.name}</div>
      <div class="st">単価 ${B.fmt(b.price)}<br>原価 ${B.fmt(b.cost)} / ${b.difficulty}</div>
    </button>`).join("");
  // §4 難易度は「どの島で戦うか」。同じ商売でも島が違えば正解が変わる。
  const DF = B.DIFFICULTY || {}, ORD = B.DIFF_ORDER || [];
  const isles = ORD.map(id=>{
    const D = DF[id];
    return `<button class="jz-isle${id===diff?" on":""}" data-diff="${id}">
      <span class="ie">${D.emoji}</span>
      <span class="il">${id}</span>
      <span class="ic">${D.concept}</span>
    </button>`;
  }).join("");
  stage("t-day", `
    ${skyBits({ shore:true, bgKey:"bg/beach_day", glint:["45%","19%"] })}
    <div class="jz-hint"><div class="jz-chip">🌴 どの島で、どの商売で生きる？</div></div>
    <div class="jz-plot" id="jzPlot"><div class="empty">▼ ここに、君の店が建つ</div></div>
    <div class="jz-islebar">
      <div class="jz-isles" id="jzIsles">${isles}</div>
      <div class="jz-isledesc" id="jzIsleDesc"></div>
    </div>
    <div class="jz-totems" id="jzTotems">${totems}</div>
    <div class="jz-confirm">
      <input class="jz-nameinput" id="jzName" maxlength="8" placeholder="店主の名前（例：トミー）" autocomplete="off">
      <button class="jz-btn" id="jzGo" disabled style="width:100%">下から事業を選ぼう</button>
    </div>
  `);
  const syncGo = ()=>{
    const go = $s("#jzGo"); if(!go) return;
    if(!selected){ go.disabled = true; go.textContent = "下から事業を選ぼう"; return; }
    const b = B.BUSINESSES[selected];
    go.disabled = false;
    go.textContent = `${DF[diff].emoji} ${diff} の島で ${b.emoji} ${b.name}を開業する！`;
  };
  const showIsle = ()=>{
    const el = $s("#jzIsleDesc"); if(!el) return;
    const D = DF[diff];
    el.innerHTML = `<b>${D.emoji} ${D.name}</b>（${D.jp}）<br>${D.desc}`;
  };
  showIsle();
  document.querySelectorAll(".jz-isle").forEach(t=>{
    t.onclick = ()=>{
      B.Sound.click();
      document.querySelectorAll(".jz-isle").forEach(x=>x.classList.remove("on"));
      t.classList.add("on"); diff = t.dataset.diff;
      showIsle(); syncGo();
    };
  });
  document.querySelectorAll(".jz-totem").forEach(t=>{
    t.onclick = ()=>{
      B.Sound.click();
      document.querySelectorAll(".jz-totem").forEach(x=>x.classList.remove("on"));
      t.classList.add("on");
      selected = t.dataset.id;
      const b = B.BUSINESSES[selected];
      $s("#jzPlot").innerHTML = `<div class="jz-popin">${svgStall(selected, 1)}</div>
        <div class="empty" style="margin-top:6px">${b.tagline}</div>`;
      syncGo();
    };
  });
  $s("#jzGo").onclick = ()=>{
    if(!selected) return;
    B.Sound.level();
    const b = B.BUSINESSES[selected];
    const owner = ($s("#jzName").value || "").trim() || "あなた";
    B.Engine.newGame(selected, diff);
    const s = B.Engine.state;
    s.shopName = owner;                                      // §83 店名に反映
    s._tut = "firstSale";                                    // §42 途中リロードでも初売りから再開
    if(B.PlayLog) B.PlayLog.start(s);                        // 教育・分析用の記録をここから始める
    B.Engine.save();
    // 開業資金をどう作るか（自己資金だけ／少し借りる／しっかり借りる）
    if(B.openFinanceChoice) B.openFinanceChoice(()=>{ B.Engine.save(); });
    const plot = $s("#jzPlot");                              // 建設バースト（§55）
    plot.innerHTML = `<div class="jz-popin">${svgStall(selected, 1)}</div>`;
    for(let i=0;i<6;i++){
      const p = document.createElement("div");
      p.className = "jz-pop"; p.textContent = "✦";
      const r = plot.getBoundingClientRect();
      p.style.left = (r.left + rnd(20, r.width-20)) + "px";
      p.style.top  = (r.top + rnd(10, r.height-30)) + "px";
      p.style.fontSize = rnd(14,30)+"px";
      document.body.appendChild(p);
      setTimeout(()=>p.remove(), 1200);
    }
    setTimeout(()=>{                                         // §16 店名スプラッシュ
      const st = $s("#jzStage"); if(!st){ sceneFirstSale(); return; }
      const sp = document.createElement("div");
      sp.className = "jz-shopsplash";
      sp.innerHTML = `<div class="own">${owner}の</div><div class="shp">${b.emoji} ${b.name}</div><div class="opn">— OPEN —</div>`;
      st.appendChild(sp);
      setTimeout(()=>sceneFirstSale(), 1500);
    }, 700);
  };
}

/* =======================================================================
   SCENE 4: FIRST SALE — 最初のお客さん（§37-38）
   ======================================================================= */
function sceneFirstSale(){
  const s = B.Engine.state; if(!s){ sceneTitle(); return; }
  const b = B.BUSINESSES[s.bizId];
  const st = stage("t-day", `
    ${skyBits({ shore:true, bgKey:"bg/beach_day", glint:["45%","19%"] })}
    ${hudHtml(s)}
    <div class="jz-stall" style="left:38%;width:min(74vw, 56vh, 640px)">${svgStall(s.bizId, 1)}</div>
    <div id="jzHero" class="jz-breath" style="position:absolute;left:17%;bottom:18.5%;width:calc(76px * var(--actor));z-index:17">${svgPlayerFront("normal")}</div>
    <!-- この客は画面の右端(108%)から左(66%)へ歩いてくる。素材は右向きなので反転させる。
         反転は「歩行アニメを持たない親」にかける（子の .b は transform を animate しており、
         そこに inline で書くと毎フレーム打ち消される）。親は transition:left だけなので競合しない。 -->
    <div id="jzGuest" style="position:absolute;left:108%;bottom:19%;width:calc(86px * var(--actor));z-index:18;transform:scaleX(-1);transition:left 2.3s cubic-bezier(.4,.1,.3,1)">
      <div class="b" style="animation:jzWalkBob .58s ease-in-out infinite;transform-origin:bottom center">${svgTourist(0)}</div>
    </div>
    <div id="jzAsk"></div>
  `);
  requestAnimationFrame(()=>{ const g=$s("#jzGuest"); if(g) g.style.left="66%"; }); // 客が歩いてくる

  const round50 = (v)=> Math.max(50, Math.round(v/50)*50);
  const prices = [
    { v: round50(b.price*0.7), tag:"ちょっと安め" },
    { v: b.price,              tag:"ふつう" },
    { v: round50(b.price*1.5), tag:"強気" },
  ];
  setTimeout(()=>{
    const g = $s("#jzGuest"); if(!g) return;
    g.querySelector(".b").style.animation = "none";                         // 立ち止まる
    const gr = g.getBoundingClientRect();
    $s("#jzAsk").innerHTML = `
      <div class="jz-bubble" style="left:${bubbleX(gr.left-70)}px;top:${gr.top-64}px">これ、いくら？</div>
      <div class="jz-prices">
        ${prices.map((p,i)=>`
          <button class="jz-price" data-v="${p.v}" data-i="${i}" style="animation-delay:${i*0.09}s">
            <div class="yen">${B.fmt(p.v)}</div><div class="tag">${p.tag}</div>
          </button>`).join("")}
      </div>`;
    document.querySelectorAll(".jz-price").forEach(btn=>{
      btn.onclick = ()=>{
        const v = +btn.dataset.v, idx = +btn.dataset.i;
        B.Sound.click();
        const react = [
          "安っ！ 即決だ、もらうよ！",
          "うん、ちょうどいいね。ひとつちょうだい。",
          "強気だねぇ……まあ旅先だ、いいか！",
        ][idx];
        const gr2 = g.getBoundingClientRect();
        $s("#jzAsk").innerHTML = `<div class="jz-bubble" style="left:${bubbleX(gr2.left-90)}px;top:${gr2.top-64}px">${react}</div>`;
        g.querySelector(".b").innerHTML = svgTourist(0, "wow");
        setTimeout(()=>{
          // 初売上：現金は本当に増やす。原価の話はまだしない（§38 伏線）
          s.cash += v; s.price = v; B.Engine.save();
          const hero = $s("#jzHero");                        // §18 主人公が喜ぶ
          if(hero){ hero.innerHTML = svgPlayerFront("celebrate"); hero.classList.add("jz-jump"); }
          coinFly(gr2.left + gr2.width/2, gr2.top + 40, v, ()=>{
            const st2 = $s("#jzStage");
            if(st2){                                          // §18 FIRST SALE! Achievement
              const bn = document.createElement("div");
              bn.className = "jz-firstsale";
              bn.textContent = "★ FIRST SALE!";
              st2.appendChild(bn);
              setTimeout(()=>bn.remove(), 1700);
            }
            setTimeout(()=>{
              $s("#jzAsk").innerHTML = "";
              dialogue([
                { who:"owl", mood:"happy", text:"おめでとう。記念すべき、最初の売上だ。" },
                { who:"owl", text:`……ところで。いまの${B.fmt(v)}、ぜんぶ「君のもうけ」だと思うか？` },
                { who:"owl", text:"ふふ。答えは、商売を続けるとわかる。さあ、店に戻ろう。" },
              ], ()=>{
                delete s._tut; B.Engine.save();              // §42 チュートリアル完了を記録
                lastSeenWeek = s.week; sceneLive();
              });
            }, 900);
          });
        }, 550);
      };
    });
  }, 2500);
}

/* =======================================================================
   SCENE 5: LIVE JUNGLE — ホーム（§5-7,§43-45）
   ======================================================================= */
function walkersHtml(s){
  const base = Math.round((s.activeCustomers||0)/8);
  const n = Math.max(s.week<=1 ? 1 : 0, Math.min(4, base));
  const happy = (s.satisfaction||0) >= 70;              // §29 満足度をKPIでなく風景で見せる
  let h="";
  for(let i=0;i<n;i++){
    const rev = Math.random()<0.5;
    const bt = rnd(14,19);          // 立ち位置。奥行きも前後関係も、この1つの値から決める
    /* 幅は固定pxにしない。PCの大画面では人が豆粒になり、広大な空き地に見える（§Adaptive）。
       812px高（iPhone）でちょうど従来の実寸になる vh 係数で、画面の高さに追従させる。 */
    const w = rnd(56,72)|0;
    const dur = rnd(16,30);
    /* delayは乱数だけだと客が同じ場所に固まる（団子）。i/n で経路上へ等間隔に散らす。 */
    const dly = (-(i + rnd(0,0.6)) * dur / Math.max(1,n)).toFixed(1);
    h += `
    <div class="jz-walker ${rev?'rev':''}"
         style="bottom:${bt.toFixed(1)}%;width:calc(${w}px * var(--actor));
                animation-duration:${dur.toFixed(1)}s;animation-delay:${dly}s;z-index:${groundZ(bt)}">
      ${happy && i%2===0 ? `<div class="jz-heart">♥</div>` : ``}
      <div class="b">${svgTourist(i%3)}</div>
    </div>`;
  }
  return h;
}
/* 雇った仲間を店先に立たせる。人が増えたことが絵で分かる（§没入感） */
function staffOnSite(s){
  const n = Math.min(3, (s.staff||[]).length);
  if(!n) return "";
  let h = "";
  for(let i=0;i<n;i++){
    const left = 118 + 46 + i*34;          // プレイヤーの隣から並ぶ
    const d = (i*0.7).toFixed(1);
    h += `<div class="jz-breath" style="position:absolute;left:calc(50% + ${left}px);bottom:20.5%;
            width:calc(${46-i*3}px * var(--actor));
            z-index:${15-i};animation-delay:${d}s;opacity:.95">
            ${svgTourist(i%2===0?"a":"b")}</div>`;
  }
  return h;
}

function sceneLive(){
  removeBackChip();
  const s = B.Engine.state; if(!s){ sceneTitle(); return; }
  const advanced = (lastSeenWeek !== null && s.week > lastSeenWeek);   // 週が進んで帰ってきた
  lastSeenWeek = s.week;
  const lvl = s.level || 1;
  /* 店が一段大きくなった瞬間を捕まえる。§80 良い変化は大きく・遅く見せる。
     見た目が変わったことに気づかなければ、育てた実感は生まれない。 */
  const stg = shopStage(s);
  const grew = (s._seenStage != null) && stg > s._seenStage;
  const grewTo = grew ? SHOP_STAGES[stg] : null;
  s._seenStage = stg;
  const nightKey = AssetReg.has("bg/jungle_night") ? "bg/jungle_night" : "bg/jungle_day";
  const st = stage(advanced ? "t-night" : "t-day", `
    ${skyBits({ sea:false, ground:true, canopy:true, flies: advanced? 8 : 0,
                bgKey: advanced ? nightKey : "bg/jungle_day",
                bgRaw: advanced && AssetReg.has("bg/jungle_night") })}
    <div class="jz-stall" id="jzStall">${svgStall(s.bizId, lvl, { staff:(s.staff||[]).length, stage:shopStage(s) })}</div>
    ${staffOnSite(s)}
    <div class="jz-breath" style="position:absolute;left:calc(50% + 118px);bottom:20.5%;width:calc(62px * var(--actor));z-index:16">${svgPlayerFront("normal")}</div>
    <div class="jz-lantern" style="left:calc(50% + 78px);bottom:44%"></div>
    ${walkersHtml(s)}
    <div class="jz-bird" style="top:${rnd(12,20)|0}%;animation-duration:${rnd(17,26)|0}s">${svgBird()}</div>
    ${hudHtml(s)}
    ${ grewTo ? `
      <div class="jz-grow" id="jzGrow">
        <div class="jz-grow-in">
          <div class="lbl">店が大きくなった</div>
          <div class="nm">${grewTo.name}</div>
          <div class="sub">${grewTo.name2 || grewTo.need || ""}</div>
        </div>
      </div>`:``}
    ${ s.week===1 && !(s.history||[]).length ? `
      <div class="jz-hint" style="top:auto;bottom:calc(96px + env(safe-area-inset-bottom))">
        <div class="jz-chip">🦉 まずは <b style="color:var(--jzGold)">⚡今週の行動</b> から。仕込んで、売ってみよう</div>
      </div>`:``}
    <div class="jz-nav">
      <button class="tab on"><span class="ic">🌴</span>ホーム</button>
      <button class="jz-btn cta" id="jzPlanBtn">⚡ 今週の行動</button>
      <button class="tab" id="jzMapBtn"><span class="ic">🗺</span>MAP</button>
    </div>
  `);
  if(advanced){                                                        // 夜→朝（§7: 週の感情的区切り）
    setTimeout(()=>{ st.classList.remove("t-night"); st.classList.add("t-dawn"); }, 1100);
    setTimeout(()=>{ st.classList.remove("t-dawn");  st.classList.add("t-day");  }, 2800);
    // 夜画像→昼画像のクロスフェード（両方ある時だけ）
    if(AssetReg.has("bg/jungle_night") && AssetReg.has("bg/jungle_day")){
      setTimeout(()=>{
        const old = st.querySelector(".jz-bgimg");
        if(old){
          const nd = document.createElement("div");
          nd.className = "jz-bgimg";
          nd.style.backgroundImage = `url('${AssetReg.url("bg/jungle_day")}')`;
          nd.style.opacity = "0";
          old.parentNode.appendChild(nd);
          requestAnimationFrame(()=> nd.style.opacity = "1");
        }
      }, 1300);
    }
  }
  $s("#jzPlanBtn").onclick = ()=>{ B.Sound.click(); openPlan(); };
  $s("#jzMapBtn").onclick  = ()=>{ B.Sound.click(); B.toast("🗺 奥地はまだ霧の中だ……レベルが上がると道が開ける"); };
}

/* ---- プラン画面（既存UI）との行き来 ---- */
function openPlan(){
  planOpen = true; planWeek = B.Engine.state.week;
  B.renderPlay();
  ensureBackChip();
}
function ensureBackChip(){
  if(document.getElementById("jzBack")) return;
  const btn = document.createElement("button");
  btn.id = "jzBack"; btn.className = "jz-backchip"; btn.textContent = "🌴 ジャングルへ";
  btn.onclick = ()=>{ B.Sound.click(); planOpen = false; removeBackChip(); sceneLive(); };
  document.body.appendChild(btn);
}
function removeBackChip(){
  const el = document.getElementById("jzBack"); if(el) el.remove();
}

/* =======================================================================
   WEEK RESULT — 段階演出の決算モーダル（§21-23,§60-61）
   数字を一気に出さない：客数 → 売上 → 経費 → 「残ったお金＝利益」→ 現金。
   行が1つずつ現れ、売上はカウントアップ、利益で音が変わる。タップで全表示。
   X = { owlCheck, isRevealed }（index.html から注入。開示段階は既存仕様に従う）
   ======================================================================= */
function buildResultModal(res, ctx, X){
  const s = B.Engine.state;
  const prev = s.history[s.history.length-2];
  const dp = (cur,pv)=>{ if(pv===undefined) return "";
    const d=cur-pv; if(Math.abs(d)<1) return "";
    return `<span class="deltapill ${d>0?'up':'down'}">${d>0?'+':''}${B.fmtNum(d)}</span>`; };
  const S = B.Sound;
  const soft = ()=> S.beep && S.beep(300, .05, "sine");

  // 表示ステップを組み立てる（開示レベルは既存の isRevealed に従う）
  const steps = [];
  steps.push({ snd:()=>S.click(), h:`<div class="r"><span>お客さん</span><b class="tabnum">${B.fmtNum(res.actual)}人</b></div>` });
  if(res.lost>0) steps.push({ snd:soft, h:`<div class="r sub"><span>　⚠ 対応しきれず逃した客</span><span class="tabnum" style="color:var(--danger)">${B.fmtNum(res.lost)}人</span></div>` });
  steps.push({ snd:()=>S.coin(), cnt:res.sales,
    h:`<div class="r"><span>売上 SALES</span><b class="tabnum"><span data-cnt>¥0</span> ${prev?dp(res.sales,prev.sales):''}</b></div>` });
  steps.push({ snd:null, h:`<div class="r sub"><span>　客数 × 客単価</span><span class="tabnum">${B.fmtNum(res.actual)}人 × ${B.fmt(res.price)}</span></div>` });
  if(X.isRevealed("COST")){
    steps.push({ snd:soft, h:`<div class="r"><span>原価 COST</span><span class="tabnum">−${B.fmt(res.cogs)}</span></div>` });
    steps.push({ snd:null, h:`<div class="r"><span>粗利益 GROSS</span><b class="tabnum">${B.fmt(res.gross)}</b></div>` });
  }
  if(res.adCost>0)   steps.push({ snd:soft, h:`<div class="r"><span>広告費</span><span class="tabnum">−${B.fmt(res.adCost)}</span></div>` });
  if(res.salaries>0) steps.push({ snd:soft, h:`<div class="r"><span>人件費</span><span class="tabnum">−${B.fmt(res.salaries)}</span></div>` });
  if(X.isRevealed("FIXED")){
    const fb=B.Economy.fixedBreakdown(res,B.Engine.state);
    // push() は step.h の先頭要素しか描画しないため、1 step 1 div に分ける
    steps.push({ snd:soft, h:`<div class="r"><span>固定費</span><span class="tabnum">−${B.fmt(res.fixed)}</span></div>` });
    steps.push({ snd:null, h:`<div class="r sub"><span>　家賃 ${B.fmt(fb.rent)}・光熱 ${B.fmt(fb.utility)}・通信 ${B.fmt(fb.comm)}・雑費 ${B.fmt(fb.misc)}</span></div>` });
    if(fb.equip>0) steps.push({ snd:null, h:`<div class="r sub"><span>　設備維持 ${B.fmt(fb.equip)}（自動化）</span></div>` });
  }
  if(res.otherOut>0) steps.push({ snd:soft, h:`<div class="r"><span>その他の支出</span><span class="tabnum">−${B.fmt(res.otherOut)}</span></div>` });
  if(res.otherIn>0)  steps.push({ snd:()=>S.coin(), h:`<div class="r"><span>その他の収入</span><span class="tabnum">+${B.fmt(res.otherIn)}</span></div>` });
  if(X.isRevealed("PROFIT")){
    const good = res.opProfit >= 0;
    steps.push({ snd: good? ()=>S.level() : ()=>S.warn(),
      h:`<div class="r total jz-profitrow ${good?'good':'bad'}"><span>残ったお金<small>（利益）</small></span><b class="tabnum">${B.fmt(res.opProfit)} ${prev?dp(res.opProfit,prev.profit):''}</b></div>` });
  }
  steps.push({ snd:null, h:`<div class="r ${X.isRevealed("PROFIT")?'':'total'}"><span>💵 現金 CASH</span><b class="tabnum" style="color:${s.cash<30000?'var(--danger)':'inherit'}">${B.fmt(s.cash)}</b></div>` });

  const owlTxt = X.owlCheck(res, s);
  /* CHARACTER_PACK の演技表：OWL の顔は結果に連動させる。
     苦しい週に明るい顔をすると「見捨てられた」と感じさせる。良い週は一緒に喜ぶ。
     ——プレイヤーの結果に気づいてくれる、という事実が愛着の正体。 */
  const owlMood = (s.cash < 0 || res.opProfit < 0) ? "worried"
                : (res.opProfit > (prev ? (prev.profit || 0) : 0)) ? "happy" : "normal";
  const owlAva = `<span class="avaimg">${svgOwl(owlMood)}</span>`;
  const eventLine = (ctx && ctx.note)
    ? `<div class="speech" style="box-shadow:none;background:#fff7e6;margin-bottom:10px"><div class="ava">${owlAva}</div><div class="bub">${ctx.note}</div></div>` : "";

  return { html:`
    <div class="mhead"><div class="mbig">🌙</div><div class="mtit">WEEK ${res.week} 決算</div></div>
    <div class="mbody">
      ${eventLine}
      <div class="pl card" id="jzPL" style="box-shadow:none;background:#fffdf5;border:2px solid #f0e9d6;min-height:110px"></div>
      <div id="jzOwlWrap" style="display:none"><div class="speech" style="margin-top:12px"><div class="ava">${owlAva}</div><div class="bub"><b>OWL CHECK：</b>${owlTxt}</div></div></div>
      <button class="btn banana big" data-next style="margin-top:14px;display:none;width:100%">次へ ▶</button>
    </div>`,
    wire:(root, done)=>{
      const pl = root.querySelector("#jzPL");
      let i = 0, timer = null, finished = false;
      function countUp(el, val){
        const t0 = performance.now(), dur = 650;
        (function tick(now){
          const t = Math.min(1, (now-t0)/dur);
          el.textContent = B.fmt(Math.round(val * (1-Math.pow(1-t,3))));   // easeOutCubic
          if(t<1 && root.isConnected) requestAnimationFrame(tick);
        })(t0);
      }
      function push(step, animate){
        const tmp = document.createElement("div"); tmp.innerHTML = step.h;
        const el = tmp.firstElementChild;
        if(animate) el.classList.add("jz-rowin");
        pl.appendChild(el);
        const c = el.querySelector("[data-cnt]");
        if(c){ if(animate) countUp(c, step.cnt); else c.textContent = B.fmt(step.cnt); }
        if(animate && step.snd) step.snd();
      }
      function finish(){
        if(finished) return; finished = true; clearTimeout(timer);
        while(i < steps.length){ push(steps[i], false); i++; }
        root.querySelector("#jzOwlWrap").style.display = "";
        const b = root.querySelector("[data-next]");
        b.style.display = ""; b.classList.add("jz-rowin");
      }
      function next(){
        if(i >= steps.length){ finish(); return; }
        push(steps[i], true); i++;
        timer = setTimeout(next, 620);
      }
      root.querySelector(".mbody").addEventListener("click", (e)=>{
        if(!finished && !e.target.closest("[data-next]")){ B.Sound.click(); finish(); }  // タップで全表示
      });
      root.querySelector("[data-next]").onclick = ()=>{ B.Sound.click(); done(); };
      setTimeout(next, 420);
    } };
}

/* =======================================================================
   起動と横取り
   ======================================================================= */
function boot(bridge){
  B = bridge;
  B.Screen.title  = sceneTitle;
  B.Screen.select = sceneSelect;
  B.Screen.play   = sceneLive;
  // 画像アセットを先読みしてから開幕（最大500ms。無い環境では即SVGで開幕）
  let started = false;
  const go = ()=>{ if(!started){ started = true; sceneTitle(); } };
  setTimeout(go, 500);
  AssetReg.load().then(go).catch(go);
}
/* renderPlay の先頭から呼ばれる。
   true を返す＝こちらで描いた（既存プラン画面は描かせない）。 */
function interceptPlay(){
  if(!B || !B.Engine.state) return false;
  if(!planOpen && B.Engine.state._tut === "firstSale"){ sceneFirstSale(); return true; } // §42 保険
  if(planOpen){
    if(B.Engine.state.week !== planWeek){        // 決算で週が進んだ → 夜のジャングルへ帰す
      planOpen = false; removeBackChip(); sceneLive(); return true;
    }
    setTimeout(ensureBackChip, 0);               // プラン画面内の再描画はそのまま通す
    return false;
  }
  sceneLive(); return true;
}

return { boot, interceptPlay, openPlan, buildResultModal };
})();


/* TWO-STEP-SELECT: 店プレビューをタップすると事業を選び直せる */
document.addEventListener("click", function(e){
  var p = e.target && e.target.closest && e.target.closest("#jzPlot");
  if(p && document.querySelector(".jz-totem.on")){
    document.querySelectorAll(".jz-totem.on").forEach(function(t){ t.classList.remove("on"); });
    var g = document.querySelector("#jzGo"); if(g){ g.disabled = true; g.textContent = "まず事業を選ぼう"; }
  }
});

"use client";
import React, { useEffect, useRef, useState } from 'react';
import './narrative.css';

export default function Narrative() {
  const rootRef = useRef(null);
  const [lang, setLang] = useState('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('avadhi_lang');
      if (saved === 'kn' || saved === 'en') {
        setLang(saved);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const btn = root.querySelector('#lang-toggle-btn');
    if (btn) {
      const handleToggle = () => {
        setLang(prev => {
          const newLang = prev === 'en' ? 'kn' : 'en';
          try { localStorage.setItem('avadhi_lang', newLang); } catch (e) {}
          return newLang;
        });
      };
      btn.addEventListener('click', handleToggle);
      return () => btn.removeEventListener('click', handleToggle);
    }
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const enterBtn = root.querySelector('#enter-app-btn');
    if (enterBtn) {
      const handleEnter = () => {
        window.location.href = '/app';
      };
      enterBtn.addEventListener('click', handleEnter);
      return () => enterBtn.removeEventListener('click', handleEnter);
    }
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    
    root.querySelectorAll('[data-lang]').forEach(el => { el.style.display = el.dataset.lang === lang ? '' : 'none'; });
    root.querySelectorAll('[data-langbtn]').forEach(el => { el.style.display = el.dataset.langbtn === (lang === 'en' ? 'kn' : 'en') ? '' : 'none'; });
  }, [lang]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const fx = {};
    root.querySelectorAll('[data-fx]').forEach(el => { (fx[el.dataset.fx] ||= []).push(el); });
    const scenes = {};
    root.querySelectorAll('[data-scene]').forEach(el => { scenes[el.dataset.scene] = el; });

    const parse = s => { const m = String(s || '').match(/(\d+):(\d+):(\d+)/); return m ? (+m[1] * 3600 + +m[2] * 60 + +m[3]) : 0; };
    const clocks = {
      story: parse('71:59:59'),
      case: 47 * 3600 + 26 * 60 + 8,
      txn: 9 * 3600 + 13 * 60 + 42,
    };
    const t0 = Date.now();
    const full = [...root.querySelectorAll('[data-timer]')];
    const short = [...root.querySelectorAll('[data-timershort]')];
    const p = n => String(n).padStart(2, '0');
    
    let timerIv = setInterval(() => {
      const el = Math.floor((Date.now() - t0) / 1000);
      const rem = {};
      for (const k in clocks) rem[k] = Math.max(0, clocks[k] - el);
      full.forEach(n => {
        const r = rem[n.dataset.timer] ?? 0;
        const txt = p(Math.floor(r / 3600)) + ':' + p(Math.floor(r / 60) % 60) + ':' + p(r % 60);
        if (n.textContent !== txt) n.textContent = txt;
      });
      short.forEach(n => {
        const r = rem[n.dataset.timershort] ?? 0;
        const txt = p(Math.floor(r / 3600)) + ':' + p(Math.floor(r / 60) % 60);
        if (n.textContent !== txt) n.textContent = txt;
      });
      const rec = (fx.recSec || [])[0];
      if (rec) { const s = 7 + (el % 23); rec.textContent = '00:' + p(s); }
    }, 250);

    let running = true;
    const setFx = (name, styles) => { (fx[name] || []).forEach(el => Object.assign(el.style, styles)); };
    const prog = (id) => {
      const el = scenes[id]; if (!el) return -1;
      const r = el.getBoundingClientRect(); const vh = window.innerHeight;
      return Math.max(0, Math.min(1, -r.top / (r.height - vh)));
    };

    const frame = () => {
      const C = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a)));
      const eo = t => 1 - Math.pow(1 - t, 3);
      const vh = window.innerHeight, doc = document.documentElement;
      setFx('device', { transform: `scale(${Math.min(1, vh * .88 / 630)})` });
      const total = doc.scrollHeight - vh, y = window.scrollY;
      const overall = total > 0 ? y / total : 0;
      const s1 = scenes['1'], s1b = s1 ? s1.offsetTop + s1.offsetHeight : vh * 2;
      const chromeOn = C(y, s1b - vh * 1.4, s1b - vh * .9);
      const p10 = prog('10');
      const chromeOff = 1 - C(p10, .5, .66);
      setFx('rail', { opacity: chromeOn * chromeOff * .9 });
      const rail = (fx.rail || [])[0];
      if (rail) setFx('railDot', { top: (overall * (rail.offsetHeight - 7)) + 'px' });
      setFx('corner', { opacity: chromeOn * chromeOff });

      let p_val = prog('1');
      if (p_val >= 0) {
        const out = 1 - C(p_val, .62, .8);
        setFx('s1big', { transform: `scale(${1 - .82 * eo(C(p_val, .62, .92))}) translateY(${-30 * eo(C(p_val, .62, .92))}px)`, opacity: String(Math.max(.001, 1 - C(p_val, .8, .95))) });
        setFx('s1sub', { opacity: C(p_val, .06, .16) * out, transform: `translateY(${12 * (1 - eo(C(p_val, .06, .16)))}px)` });
        setFx('s1line', { opacity: C(p_val, .28, .42) * out, transform: `translateY(${14 * (1 - eo(C(p_val, .28, .42)))}px)` });
        setFx('s1hint', { opacity: String(.001 + (1 - C(p_val, .05, .15))) });
      }
      p_val = prog('2');
      if (p_val >= 0) {
        setFx('s2field', { opacity: C(p_val, .04, .26) });
        setFx('s2l1', { opacity: C(p_val, .28, .4), transform: `translateY(${16 * (1 - eo(C(p_val, .28, .4)))}px)` });
        setFx('s2l2', { opacity: C(p_val, .46, .58), transform: `translateY(${16 * (1 - eo(C(p_val, .46, .58)))}px)` });
        setFx('s2l3', { opacity: C(p_val, .62, .72) });
        setFx('s2dim', { opacity: .85 * C(p_val, .8, 1) });
      }
      p_val = prog('3');
      if (p_val >= 0) {
        const fold = C(p_val, .66, .82);
        const po = C(p_val, .05, .18) - fold;
        setFx('s3paper', { opacity: po, transform: `translateY(${14 * (1 - eo(C(p_val, .05, .18))) + 26 * eo(fold)}px) rotateX(${20 * eo(fold)}deg)` });
        const st = C(p_val, .3, .36);
        setFx('s3stamp', { opacity: st > 0 ? Math.min(1, po + fold) * (1 - fold) : 0, transform: `scale(${1.4 - .4 * eo(st)})` });
        setFx('s3cap', { opacity: C(p_val, .42, .54) });
      }
      p_val = prog('4');
      if (p_val >= 0) {
        const e = eo(C(p_val, .08, .34));
        setFx('s4phone', { opacity: C(p_val, .08, .3) * (1 - C(p_val, .88, .99)), transform: `translateY(${34 * (1 - e)}px)` });
        setFx('s4wm', { opacity: C(p_val, .44, .56), transform: `translateY(${14 * (1 - eo(C(p_val, .44, .56)))}px)` });
        setFx('s4line', { opacity: C(p_val, .56, .68) });
        setFx('s4line2', { opacity: C(p_val, .68, .8) });
      }
      p_val = prog('5');
      if (p_val >= 0) {
        const f = Math.min(4.999, p_val * 5.15);
        const base = Math.min(4, Math.floor(f));
        const t = f - base;
        const smooth = x => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
        const u = base >= 4 ? 0 : smooth((t - .75) / .25);
        const i = u > .5 ? Math.min(4, base + 1) : base;
        for (let k = 0; k < 5; k++) {
          const o = k === base ? 1 - u : (k === base + 1 ? u : 0);
          setFx('scr' + k, { opacity: o, zIndex: k === i ? 3 : 1 });
          setFx('cap' + k, { opacity: o, transform: `translateY(${(k === base ? -u : 1 - u) * -18}px)` });
          setFx('dot' + k, { background: k === i ? '#d9a44e' : 'rgba(242,241,236,.18)' });
        }
      }
      p_val = prog('6');
      if (p_val >= 0) {
        setFx('s6phone', { transform: `scale(${1 - .22 * eo(C(p_val, 0, .18))})` });
        setFx('s6h', { opacity: C(p_val, .03, .13) });
        for (let k = 0; k < 5; k++) {
          const a = .16 + k * .12;
          setFx('net' + k, { strokeDashoffset: String(1 - eo(C(p_val, a, a + .13))) });
          setFx('node' + k, { opacity: C(p_val, a + .09, a + .17) });
        }
        setFx('s6src', { opacity: C(p_val, .58, .7) });
      }
      p_val = prog('7');
      if (p_val >= 0) {
        setFx('s7big', { opacity: C(p_val, .06, .26), transform: `scale(${.93 + .07 * eo(C(p_val, .06, .35))})` });
        setFx('s7task', { opacity: C(p_val, .44, .58), transform: `translateY(${14 * (1 - eo(C(p_val, .44, .58)))}px)` });
        setFx('s7note', { opacity: C(p_val, .68, .8) });
      }
      p_val = prog('8');
      if (p_val >= 0) {
        setFx('s8h', { opacity: C(p_val, .05, .15) });
        for (let k = 0; k < 5; k++) {
          const a = .18 + k * .11;
          setFx('row' + k, { opacity: C(p_val, a, a + .08), transform: `translateX(${-16 * (1 - eo(C(p_val, a, a + .08)))}px)` });
        }
        setFx('s8note', { opacity: C(p_val, .82, .92) });
      }
      p_val = prog('9');
      if (p_val >= 0) {
        setFx('s9cap', { opacity: C(p_val, .08, .18) });
        const paper = (fx.s9paper || [])[0];
        if (paper) {
          const h = paper.offsetHeight || 1;
          const fit = Math.min(1, vh * .92 / h) * (.97 + .03 * eo(C(p_val, .03, .15)));
          const ty = (vh - h * fit) / 2 - paper.offsetTop;
          paper.style.transformOrigin = '50% 0';
          paper.style.transform = `translateY(${ty}px) scale(${fit})`;
          paper.style.opacity = C(p_val, .03, .12);
        }
        const th = [.12, .21, .3, .4, .5, .62, .74];
        ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6'].forEach((n, k) => setFx(n, { opacity: C(p_val, th[k], th[k] + .07), transform: `translateY(${8 * (1 - eo(C(p_val, th[k], th[k] + .07)))}px)` }));
      }
      if (p10 >= 0) {
        const hold = 1 - C(p10, .4, .5);
        setFx('s10l1', { opacity: C(p10, .04, .14) * hold });
        setFx('s10l2', { opacity: C(p10, .14, .24) * hold });
        setFx('s10l3', { opacity: C(p10, .26, .36) * hold });
        const e = eo(C(p10, .5, .95));
        setFx('app', { opacity: C(p10, .5, .6), transform: `scale(${.3 + .7 * e})`, borderRadius: (48 * (1 - e)) + 'px', boxShadow: `0 0 0 ${3 * (1 - e)}px #2b2a26, 0 60px 140px rgba(0,0,0,${.7 * (1 - e)})`, pointerEvents: e > .9 ? 'auto' : 'none' });
      }
    };

    const loop = () => { if (!running) return; frame(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);

    return () => {
      running = false;
      clearInterval(timerIv);
    };
  }, []);

  return (
    <div ref={rootRef} style={{background:'#0f0f0e',color:'#f2f1ec',overflow:'clip'}} dangerouslySetInnerHTML={{ __html: `

<!-- fixed chrome -->
<div data-fx="corner" style="position:fixed;top:22px;left:26px;z-index:60;opacity:0;pointer-events:none">
  <div data-timer="story" style="font-variant-numeric:tabular-nums;font-weight:700;font-size:20px;letter-spacing:-.01em">71:59:59</div>
  <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(242,241,236,.45);margin-top:2px">PMFBY §21(2)</div>
</div>
<button id="lang-toggle-btn" style="position:fixed;top:20px;right:22px;z-index:60;background:#ffffff;color:#1c1c1a;border:1px solid #d9d6cf;border-radius:999px;padding:7px 15px;font-size:13px;font-weight:700;font-family:inherit;min-height:34px;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.03)" style-hover="background:#f8f7f3">
  <span data-langbtn="kn">ಕನ್ನಡ</span><span data-langbtn="en" style="display:none">English</span>
</button>
<div data-fx="rail" style="position:fixed;left:27px;top:22vh;bottom:14vh;z-index:55;opacity:0;pointer-events:none">
  <div style="position:absolute;inset:0;width:1px;background:rgba(242,241,236,.14)"></div>
  <div data-fx="railDot" style="position:absolute;left:-3px;top:0;width:7px;height:7px;border-radius:50%;background:#d9a44e"></div>
  <div style="position:absolute;top:-16px;left:8px;font-size:10px;color:rgba(242,241,236,.4);font-variant-numeric:tabular-nums">72h</div>
  <div style="position:absolute;bottom:-16px;left:8px;font-size:10px;color:rgba(242,241,236,.4);font-variant-numeric:tabular-nums">0h</div>
</div>

<!-- SCENE 1 -->
<div data-scene="1" style="height:240vh;position:relative">
  <div data-screen-label="S1 · Time is evidence" style="position:sticky;top:0;height:100vh;overflow:hidden;background:#0f0f0e;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px">
    <div data-fx="s1big" style="animation:avIn 1.6s ease .3s both">
      <div data-timer="story" style="font-size:clamp(72px,13vw,180px);font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.03em;line-height:1">71:59:59</div>
    </div>
    <div data-fx="s1sub" style="opacity:0;font-size:14px;letter-spacing:.02em;color:rgba(242,241,236,.55)"><span data-lang="en">PMFBY §21(2) — a localised crop loss must be intimated within 72 hours</span><span data-lang="kn" style="display:none">PMFBY §21(2) — ಸ್ಥಳೀಯ ಬೆಳೆ ಹಾನಿಯನ್ನು 72 ಗಂಟೆಗಳ ಒಳಗೆ ತಿಳಿಸಬೇಕು</span></div>
    <div data-fx="s1line" style="opacity:0;font-size:clamp(22px,3vw,34px);font-weight:700;color:#d9a44e;margin-top:22px"><span data-lang="en">Time never waits.</span><span data-lang="kn" style="display:none">ಸಮಯ ಎಂದಿಗೂ ಕಾಯುವುದಿಲ್ಲ.</span></div>
    <div data-fx="s1hint" style="position:absolute;bottom:34px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:rgba(242,241,236,.35);animation:avHint 2.6s ease infinite"><span data-lang="en">Scroll</span><span data-lang="kn" style="display:none">ಸ್ಕ್ರಾಲ್ ಮಾಡಿ</span></div>
  </div>
</div>

<!-- SCENE 2 -->
<div data-scene="2" style="height:260vh;position:relative">
  <div data-screen-label="S2 · A crop fails" style="position:sticky;top:0;height:100vh;overflow:hidden;background:#0f0f0e">
    <div data-fx="s2field" style="position:absolute;inset:0;opacity:0">
      <div style="position:absolute;inset:0;background:linear-gradient(#151412 0%,#191713 52%,#0d0c0b 53%,#0f0e0c 100%)"></div>
      <div style="position:absolute;left:10%;right:10%;top:44%;height:16%;background:radial-gradient(50% 100% at 50% 60%,rgba(217,164,78,.14),transparent 70%);filter:blur(18px)"></div>
      <div style="position:absolute;top:14%;left:12%;width:34vw;height:9vw;background:radial-gradient(50% 50% at 50% 50%,rgba(242,241,236,.05),transparent 70%);filter:blur(24px);animation:avDrift 34s ease-in-out infinite alternate"></div>
      <div style="position:absolute;top:26%;right:8%;width:28vw;height:7vw;background:radial-gradient(50% 50% at 50% 50%,rgba(242,241,236,.04),transparent 70%);filter:blur(22px);animation:avDrift 46s ease-in-out infinite alternate-reverse"></div>
      <div style="position:absolute;left:0;right:0;top:53%;bottom:0;background:repeating-linear-gradient(86deg,transparent 0 9px,rgba(0,0,0,.5) 9px 11px),linear-gradient(rgba(217,164,78,.05),transparent 40%);transform-origin:50% 100%;animation:avSway 7s ease-in-out infinite alternate"></div>
      <div style="position:absolute;left:0;right:0;top:60%;bottom:0;background:repeating-linear-gradient(94deg,transparent 0 14px,rgba(0,0,0,.65) 14px 17px);transform-origin:50% 100%;animation:avSway 9s ease-in-out infinite alternate-reverse"></div>
    </div>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:0 6vw;text-align:center">
      <div data-fx="s2l1" style="opacity:0;font-size:clamp(28px,4vw,46px);font-weight:700"><span data-lang="en">A crop fails.</span><span data-lang="kn" style="display:none">ಬೆಳೆ ನಾಶವಾಗುತ್ತದೆ.</span></div>
      <div data-fx="s2l2" style="opacity:0;font-size:clamp(28px,4vw,46px);font-weight:700;color:#d9a44e"><span data-lang="en">The clock starts.</span><span data-lang="kn" style="display:none">ಗಡಿಯಾರ ಶುರುವಾಗುತ್ತದೆ.</span></div>
      <div data-fx="s2l3" style="opacity:0;font-size:14px;color:rgba(242,241,236,.5);margin-top:10px"><span data-lang="en">Nobody tells the farmer it has.</span><span data-lang="kn" style="display:none">ಅದು ಶುರುವಾಗಿದೆ ಎಂದು ರೈತನಿಗೆ ಯಾರೂ ಹೇಳುವುದಿಲ್ಲ.</span></div>
    </div>
    <div data-fx="s2dim" style="position:absolute;inset:0;background:#0f0f0e;opacity:0;pointer-events:none"></div>
  </div>
</div>

<!-- SCENE 3 — the expired case -->
<div data-scene="3" style="height:240vh;position:relative">
  <div data-screen-label="S3 · Expired" style="position:sticky;top:0;height:100vh;overflow:hidden;background:#0f0f0e;display:flex;align-items:center;justify-content:center">
    <div style="position:relative;width:min(400px,82vw)">
      <div data-fx="s3paper" style="opacity:0;background:#ffffff;color:#1c1c1a;border:1px solid #e5e3de;border-radius:12px;padding:26px 24px 34px;box-shadow:0 30px 80px rgba(0,0,0,.5)">
        <div style="text-align:center">
          <div style="font-size:18px;font-weight:700"><span data-lang="en">Loss intimation report</span><span data-lang="kn" style="display:none">ನಷ್ಟ ಸೂಚನಾ ವರದಿ</span></div>
          <div style="font-size:10px;letter-spacing:.14em;color:#6f6b63;margin-top:4px">AVD-0134/2026 · PMFBY §21(2)</div>
        </div>
        <div style="border-top:1px solid #e5e3de;margin:16px 0 0"></div>
        <div style="display:flex;gap:14px;padding:9px 0;border-bottom:1px solid #eeece7"><span style="flex:none;width:80px;font-size:12px;color:#6f6b63"><span data-lang="en">Event</span><span data-lang="kn" style="display:none">ಘಟನೆ</span></span><span style="flex:1;font-size:13.5px;font-weight:600"><span data-lang="en">Crop insurance — excess rainfall</span><span data-lang="kn" style="display:none">ಬೆಳೆ ವಿಮೆ — ಅತಿವೃಷ್ಟಿ ಹಾನಿ</span></span></div>
        <div style="display:flex;gap:14px;padding:9px 0;border-bottom:1px solid #eeece7"><span style="flex:none;width:80px;font-size:12px;color:#6f6b63"><span data-lang="en">Date</span><span data-lang="kn" style="display:none">ದಿನಾಂಕ</span></span><span style="flex:1;font-size:13.5px;font-weight:600">18 JUL 2026</span></div>
        <div style="display:flex;gap:14px;padding:9px 0;border-bottom:1px solid #eeece7"><span style="flex:none;width:80px;font-size:12px;color:#6f6b63"><span data-lang="en">Details</span><span data-lang="kn" style="display:none">ವಿವರ</span></span><span style="flex:1;font-size:13.5px;font-weight:600"><span data-lang="en">Maize · ~1 acre</span><span data-lang="kn" style="display:none">ಮೆಕ್ಕೆಜೋಳ · ~1 ಎಕರೆ</span></span></div>
        <div style="display:flex;gap:14px;padding:9px 0;border-bottom:1px solid #eeece7"><span style="flex:none;width:80px;font-size:12px;color:#6f6b63"><span data-lang="en">Filed</span><span data-lang="kn" style="display:none">ಸಲ್ಲಿಕೆ</span></span><span style="flex:1;font-size:13.5px;font-weight:600;color:#b3341e"><span data-lang="en">24 JUL 2026 — day 6</span><span data-lang="kn" style="display:none">24 JUL 2026 — 6ನೇ ದಿನ</span></span></div>
        <div style="display:flex;gap:14px;padding:9px 0"><span style="flex:none;width:80px;font-size:12px;color:#6f6b63"><span data-lang="en">Window</span><span data-lang="kn" style="display:none">ಅವಧಿ</span></span><span style="flex:1;font-size:13.5px;font-weight:600"><span data-lang="en">72 hours</span><span data-lang="kn" style="display:none">72 ಗಂಟೆ</span></span></div>
      </div>
      <div data-fx="s3stamp" style="opacity:0;position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
        <div style="border:4px solid #b3341e;color:#b3341e;border-radius:6px;padding:9px 24px;transform:rotate(-7deg);background:rgba(255,255,255,.82);text-align:center">
          <div style="font-size:clamp(24px,3.4vw,36px);font-weight:800;letter-spacing:.04em">ಅವಧಿ ಮೀರಿದೆ</div>
          <div style="font-size:14px;letter-spacing:.26em;font-weight:700;margin-top:2px">EXPIRED</div>
        </div>
      </div>
    </div>
    <div data-fx="s3cap" style="opacity:0;position:absolute;bottom:11vh;left:0;right:0;text-align:center;padding:0 8vw;font-size:16px;line-height:1.6;color:rgba(242,241,236,.62)"><span data-lang="en">If you do not report within 72 hours, the claim can be rejected even though the crop was genuinely damaged.</span><span data-lang="kn" style="display:none">72 ಗಂಟೆಯೊಳಗೆ ತಿಳಿಸದಿದ್ದರೆ, ನಿಜವಾಗಿ ಬೆಳೆ ಹಾನಿಯಾಗಿದ್ದರೂ ಕ್ಲೇಮ್ ತಿರಸ್ಕೃತವಾಗಬಹುದು.</span></div>
  </div>
</div>

<!-- SCENE 4 — Avadhi is placed on the table -->
<div data-scene="4" style="height:240vh;position:relative">
  <div data-screen-label="S4 · Avadhi appears" style="position:sticky;top:0;height:100vh;overflow:hidden;background:#0f0f0e;display:flex;align-items:center;justify-content:center;gap:7vw;flex-wrap:wrap">
    <div data-fx="s4phone" style="opacity:0">
      <div data-fx="device" style="width:288px;height:598px;transform-origin:center;background:#141412;border:3px solid #2b2a26;border-radius:44px;padding:12px;box-shadow:0 40px 100px rgba(0,0,0,.6)">
        <div style="position:relative;width:100%;height:100%;background:#f8f7f3;border-radius:32px;overflow:hidden">
          <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:84px;height:22px;background:#141412;border-radius:0 0 12px 12px;z-index:9"></div>
          <div style="background:#e2e8e2;border-bottom:1px solid #d0d7cf;padding:30px 16px 14px">
            <div style="font-family:Georgia,serif;font-size:27px;font-weight:800;letter-spacing:-.02em;color:#1c1c1a;line-height:1.15">ಅವಧಿ</div>
            <div style="font-size:12px;color:#6f6b63;margin-top:3px;font-weight:500"><span data-lang="en">Avadhi · Time is evidence</span><span data-lang="kn" style="display:none">Avadhi · ಸಮಯವೇ ಸಾಕ್ಷಿ</span></div>
            <div style="display:inline-flex;align-items:center;gap:7px;background:#f1f0ec;border-radius:999px;padding:5px 12px;font-size:11px;font-weight:500;color:#4a4740;margin-top:12px"><span style="width:8px;height:8px;border-radius:50%;background:#1b8a5a"></span><span data-lang="en">Offline ready</span><span data-lang="kn" style="display:none">ಆಫ್‌ಲೈನ್ ಸಿದ್ಧ</span></div>
          </div>
          <div style="padding:22px 18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;height:calc(100% - 132px);text-align:center">
            <div style="font-size:12px;color:#6f6b63"><span data-lang="en">Time remaining</span><span data-lang="kn" style="display:none">ಉಳಿದ ಸಮಯ</span></div>
            <div data-timer="case" style="font-variant-numeric:tabular-nums;font-size:42px;font-weight:700;letter-spacing:-.03em;color:#1b5e3f;line-height:1">47:26:08</div>
            <div style="font-size:11px;color:#9a968d"><span data-lang="en">hrs : min : sec</span><span data-lang="kn" style="display:none">ಗಂಟೆ : ನಿಮಿಷ : ಸೆಕೆಂಡ್</span></div>
          </div>
        </div>
      </div>
    </div>
    <div style="max-width:360px;padding:0 6vw">
      <div data-fx="s4wm" style="opacity:0">
        <div style="font-family:Georgia,serif;font-size:clamp(44px,6vw,72px);font-weight:800;letter-spacing:-.02em;line-height:1.1">ಅವಧಿ</div>
        <div style="font-family:Georgia,serif;font-size:clamp(22px,2.6vw,30px);font-weight:700;color:#d9a44e;margin-top:4px">Avadhi</div>
      </div>
      <div data-fx="s4line" style="opacity:0;margin-top:18px;font-size:17px;color:rgba(242,241,236,.68);line-height:1.6"><span data-lang="en">A deadline engine for financial rights. Say what happened; it tells you which clocks are running.</span><span data-lang="kn" style="display:none">ಆರ್ಥಿಕ ಹಕ್ಕುಗಳಿಗಾಗಿ ಗಡುವಿನ ಎಂಜಿನ್. ಏನಾಯಿತು ಹೇಳಿ — ಯಾವ ಗಡಿಯಾರ ಓಡುತ್ತಿದೆ ಎಂದು ಅದು ತಿಳಿಸುತ್ತದೆ.</span></div>
      <div data-fx="s4line2" style="opacity:0;margin-top:14px;font-size:13px;color:rgba(242,241,236,.42)"><span data-lang="en">Not a chatbot. It has state — open it cold and the countdowns are already running.</span><span data-lang="kn" style="display:none">ಇದು ಚಾಟ್‌ಬಾಟ್ ಅಲ್ಲ. ಅಪ್ಲಿಕೇಶನ್ ತೆರೆದ ಕ್ಷಣವೇ ಗಡಿಯಾರಗಳು ಓಡುತ್ತಿರುತ್ತವೆ.</span></div>
    </div>
  </div>
</div>

<!-- SCENE 5 — the phone is the anchor; the real screens progress -->
<div data-scene="5" style="height:620vh;position:relative">
  <div data-screen-label="S5 · The real screens" style="position:sticky;top:0;height:100vh;overflow:hidden;background:#0f0f0e;display:flex;align-items:center;justify-content:center;gap:8vw">
    <div data-fx="device" style="width:288px;height:598px;transform-origin:center;background:#141412;border:3px solid #2b2a26;border-radius:44px;padding:12px;box-shadow:0 40px 100px rgba(0,0,0,.6);flex:none">
      <div style="position:relative;width:100%;height:100%;background:#f8f7f3;border-radius:32px;overflow:hidden;color:#1c1c1a">
        <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:84px;height:22px;background:#141412;border-radius:0 0 12px 12px;z-index:20"></div>

        <!-- persistent top bar -->
        <div style="position:absolute;top:0;left:0;right:0;z-index:10;background:#e2e8e2;border-bottom:1px solid #d0d7cf;padding:26px 14px 10px;display:flex;justify-content:space-between;align-items:flex-end;gap:8px">
          <div>
            <div style="font-family:Georgia,serif;font-size:22px;font-weight:800;letter-spacing:-.02em;line-height:1.15">ಅವಧಿ</div>
            <div style="font-size:10.5px;color:#6f6b63;margin-top:2px;font-weight:500"><span data-lang="en">Time is evidence</span><span data-lang="kn" style="display:none">ಸಮಯವೇ ಸಾಕ್ಷಿ</span></div>
          </div>
          <div style="display:inline-flex;align-items:center;gap:6px;background:#f1f0ec;border-radius:999px;padding:4px 10px;font-size:10px;font-weight:500;color:#4a4740;white-space:nowrap"><span style="width:7px;height:7px;border-radius:50%;background:#1b8a5a"></span><span data-lang="en">Offline</span><span data-lang="kn" style="display:none">ಆಫ್‌ಲೈನ್</span></div>
        </div>

        <!-- S1 HOME -->
        <div data-fx="scr0" style="position:absolute;inset:78px 0 0;padding:12px 14px 0;overflow:hidden">
          <div style="background:#fdf3e4;border:1px solid #ecd9b8;border-radius:12px;padding:11px 12px;display:flex;gap:10px;align-items:center">
            <span style="width:9px;height:9px;border-radius:50%;background:#a05a00;flex:none;animation:pulse 1.2s infinite"></span>
            <div><div style="font-size:12.5px;font-weight:700;line-height:1.35;color:#5c3400"><span data-lang="en">Warning — one deadline closes within 12 hours</span><span data-lang="kn" style="display:none">ಎಚ್ಚರಿಕೆ — ಒಂದು ಗಡುವು 12 ಗಂಟೆಯೊಳಗೆ ಮುಗಿಯುತ್ತದೆ</span></div><div style="font-size:10.5px;color:#8a5a10;margin-top:1px"><span data-lang="en">Act now</span><span data-lang="kn" style="display:none">ಈಗಲೇ ಕ್ರಮ ತೆಗೆದುಕೊಳ್ಳಿ</span></div></div>
          </div>
          <div style="font-size:13px;font-weight:600;color:#4a4740;margin:14px 0 10px">3 <span data-lang="en">cases on record</span><span data-lang="kn" style="display:none">ಪ್ರಕರಣ ದಾಖಲೆಯಲ್ಲಿ</span></div>
          <div style="background:#fff;border:1px solid #e9e7e2;border-radius:14px;padding:13px 14px;margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="font-size:11px;color:#6f6b63">AVD-0152 · RBI 2017</span><span style="display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;color:#a05a00;background:#fdf3e4;border-radius:999px;padding:3px 9px;white-space:nowrap"><span style="width:6px;height:6px;border-radius:50%;background:currentColor"></span><span data-lang="en">Closing soon</span><span data-lang="kn" style="display:none">ಶೀಘ್ರ ಮುಕ್ತಾಯ</span></span></div>
            <div style="display:flex;align-items:baseline;gap:7px;margin-top:10px"><span data-timershort="txn" style="font-size:30px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:#a05a00;line-height:1">09:13</span><span style="font-size:11px;color:#6f6b63"><span data-lang="en">hrs:min left</span><span data-lang="kn" style="display:none">ಗಂ:ನಿ ಉಳಿದಿದೆ</span></span></div>
            <div style="font-size:15px;font-weight:700;margin-top:8px;line-height:1.35"><span data-lang="en">Unauthorised bank transaction</span><span data-lang="kn" style="display:none">ಅನಧಿಕೃತ ಬ್ಯಾಂಕ್ ವಹಿವಾಟು</span></div>
            <div style="font-size:11px;color:#6f6b63;margin-top:2px">₹18,400 · <span data-lang="en">A/C ····4127</span><span data-lang="kn" style="display:none">ಖಾತೆ ····4127</span></div>
            <div style="position:relative;height:6px;border-radius:999px;background:#eeece7;margin-top:12px;overflow:hidden"><div style="position:absolute;inset:0 auto 0 0;width:87%;border-radius:999px;background:#a05a00"></div></div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#6f6b63;margin-top:6px"><span><span data-lang="en">Due </span><span data-lang="kn" style="display:none">ಗಡುವು </span>31 JUL 07:18</span><span>0/4 <span data-lang="en">steps</span><span data-lang="kn" style="display:none">ಹಂತ</span></span></div>
          </div>
          <div style="background:#fff;border:1px solid #e9e7e2;border-radius:14px;padding:13px 14px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="font-size:11px;color:#6f6b63">AVD-0149 · PMFBY §21(2)</span><span style="display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;color:#1b5e3f;background:#e8f2ec;border-radius:999px;padding:3px 9px;white-space:nowrap"><span style="width:6px;height:6px;border-radius:50%;background:currentColor"></span><span data-lang="en">Open</span><span data-lang="kn" style="display:none">ಚಾಲ್ತಿ</span></span></div>
            <div style="display:flex;align-items:baseline;gap:7px;margin-top:10px"><span data-timershort="case" style="font-size:30px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:#1b5e3f;line-height:1">47:26</span><span style="font-size:11px;color:#6f6b63"><span data-lang="en">hrs:min left</span><span data-lang="kn" style="display:none">ಗಂ:ನಿ ಉಳಿದಿದೆ</span></span></div>
            <div style="font-size:15px;font-weight:700;margin-top:8px;line-height:1.35"><span data-lang="en">Crop insurance — hailstorm damage</span><span data-lang="kn" style="display:none">ಬೆಳೆ ವಿಮೆ — ಆಲಿಕಲ್ಲು ಹಾನಿ</span></div>
            <div style="font-size:11px;color:#6f6b63;margin-top:2px"><span data-lang="en">Cotton · ~2 acres</span><span data-lang="kn" style="display:none">ಹತ್ತಿ · ~2 ಎಕರೆ</span></div>
            <div style="position:relative;height:6px;border-radius:999px;background:#eeece7;margin-top:12px;overflow:hidden"><div style="position:absolute;inset:0 auto 0 0;width:34%;border-radius:999px;background:#1b5e3f"></div></div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#6f6b63;margin-top:6px"><span><span data-lang="en">Due </span><span data-lang="kn" style="display:none">ಗಡುವು </span>01 AUG 21:26</span><span>1/5 <span data-lang="en">steps</span><span data-lang="kn" style="display:none">ಹಂತ</span></span></div>
          </div>
          <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,#f8f7f3 70%,rgba(248,247,243,0));padding:16px 14px">
            <div style="background:#1c1c1a;color:#fff;border-radius:999px;min-height:58px;display:flex;align-items:center;justify-content:center;gap:10px;padding:12px 16px">
              <svg viewBox="0 0 24 24" width="20" height="20"><rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor"></rect><path d="M5 11a7 7 0 0 0 14 0" fill="none" stroke="currentColor" stroke-width="2"></path><line x1="12" y1="18" x2="12" y2="23" stroke="currentColor" stroke-width="2"></line></svg>
              <span><span style="display:block;font-size:15px;font-weight:700;line-height:1.25"><span data-lang="en">Report a loss</span><span data-lang="kn" style="display:none">ನಷ್ಟ ವರದಿ ಮಾಡಿ</span></span><span style="display:block;font-size:10px;opacity:.7"><span data-lang="en">Tap and speak — no reading needed</span><span data-lang="kn" style="display:none">ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ</span></span></span>
            </div>
          </div>
        </div>

        <!-- S2 VOICE INTAKE -->
        <div data-fx="scr1" style="position:absolute;inset:78px 0 0;opacity:0;padding:14px 16px;display:flex;flex-direction:column">
          <div style="display:flex;justify-content:space-between;align-items:center"><span style="background:#fff;border:1px solid #d9d6cf;border-radius:999px;padding:5px 13px;font-size:12px;font-weight:700">← <span data-lang="en">Back</span><span data-lang="kn" style="display:none">ಹಿಂದೆ</span></span><span style="font-size:11px;color:#6f6b63"><span data-lang="en">New report</span><span data-lang="kn" style="display:none">ಹೊಸ ವರದಿ</span></span></div>
          <div style="padding-top:18px">
            <div style="font-size:12.5px;font-weight:600;color:#b3341e;display:flex;align-items:center;gap:8px"><span style="width:11px;height:11px;border-radius:50%;background:#b3341e;animation:pulse 1.2s infinite"></span><span data-lang="en">Listening…</span><span data-lang="kn" style="display:none">ಕೇಳುತ್ತಿದೆ…</span></div>
            <div data-fx="recSec" style="font-size:52px;font-weight:700;font-variant-numeric:tabular-nums;margin-top:14px;letter-spacing:-.02em">00:07</div>
            <p style="font-size:14px;line-height:1.6;color:#4a4740;margin:16px 0 0"><span data-lang="en">Speak slowly and clearly. Tap the button below when you are done.</span><span data-lang="kn" style="display:none">ನಿಧಾನವಾಗಿ, ಸ್ಪಷ್ಟವಾಗಿ ಹೇಳಿ. ಮುಗಿದ ಮೇಲೆ ಕೆಳಗಿನ ಗುಂಡಿ ಒತ್ತಿ.</span></p>
            <div style="background:#fafaf8;border:1px solid #e9e7e2;border-radius:12px;padding:12px;margin-top:16px;font-size:13.5px;line-height:1.55;color:#2e2d2a">ನಿನ್ನೆ ರಾತ್ರಿ ಆಲಿಕಲ್ಲು ಮಳೆಯಿಂದ ನನ್ನ ಹತ್ತಿ ಬೆಳೆ ಹಾಳಾಗಿದೆ. ಸುಮಾರು ಎರಡು ಎಕರೆ.</div>
          </div>
          <div style="margin-top:auto;display:flex;flex-direction:column;gap:10px;padding-bottom:14px">
            <div style="background:#b3341e;color:#fff;border-radius:999px;min-height:60px;display:flex;align-items:center;justify-content:center;gap:10px"><span style="width:15px;height:15px;border-radius:3px;background:#fff"></span><span><span style="display:block;font-size:16px;font-weight:700"><span data-lang="en">Stop</span><span data-lang="kn" style="display:none">ನಿಲ್ಲಿಸಿ</span></span><span style="display:block;font-size:10px;opacity:.75">Stop recording</span></span></div>
            <div style="font-size:12px;color:#1b5e3f;font-weight:700;text-align:center;display:flex;align-items:center;justify-content:center;gap:6px">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              <span data-lang="en">Your voice never leaves this device</span><span data-lang="kn" style="display:none">ನಿಮ್ಮ ಧ್ವನಿ ಈ ಸಾಧನ ಬಿಟ್ಟು ಹೋಗುವುದಿಲ್ಲ</span>
            </div>
          </div>
        </div>

        <!-- S3 CASE DETAIL -->
        <div data-fx="scr2" style="position:absolute;inset:78px 0 0;opacity:0;padding:14px 16px 0;overflow:hidden">
          <div style="display:flex;justify-content:space-between;align-items:center"><span style="background:#fff;border:1px solid #d9d6cf;border-radius:999px;padding:5px 13px;font-size:12px;font-weight:700">← <span data-lang="en">Back</span><span data-lang="kn" style="display:none">ಹಿಂದೆ</span></span><span style="font-size:11px;color:#6f6b63">AVD-0149 · PMFBY §21(2)</span></div>
          <div style="background:#fafaf8;border:1px solid #e9e7e2;border-radius:16px;padding:14px 15px;margin-top:12px">
            <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:11px;color:#6f6b63"><span data-lang="en">Time remaining</span><span data-lang="kn" style="display:none">ಉಳಿದ ಸಮಯ</span></span><span style="display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;color:#1b5e3f;background:#e8f2ec;border-radius:999px;padding:3px 9px"><span style="width:6px;height:6px;border-radius:50%;background:currentColor"></span><span data-lang="en">Open</span><span data-lang="kn" style="display:none">ಚಾಲ್ತಿ</span></span></div>
            <div data-timer="case" style="font-size:46px;font-weight:700;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:#1b5e3f;margin-top:10px">47:26:08</div>
            <div style="font-size:11px;color:#9a968d;margin-top:5px"><span data-lang="en">hrs : min : sec</span><span data-lang="kn" style="display:none">ಗಂಟೆ : ನಿಮಿಷ : ಸೆಕೆಂಡ್</span></div>
            <div style="position:relative;height:8px;border-radius:999px;background:#eeece7;margin-top:14px;overflow:hidden"><div style="position:absolute;inset:0 auto 0 0;width:34%;border-radius:999px;background:#1b5e3f"></div></div>
            <div style="display:flex;justify-content:space-between;border-top:1px solid #eeece7;margin-top:14px;padding-top:10px;font-size:12px"><span style="color:#6f6b63"><span data-lang="en">Deadline</span><span data-lang="kn" style="display:none">ಗಡುವು</span></span><span style="font-weight:700">01 AUG 21:26 IST</span></div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:5px"><span style="color:#6f6b63"><span data-lang="en">Rule window</span><span data-lang="kn" style="display:none">ನಿಯಮದ ಅವಧಿ</span></span><span style="font-weight:700"><span data-lang="en">72 hours</span><span data-lang="kn" style="display:none">72 ಗಂಟೆ</span></span></div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin:18px 0 10px"><span style="font-size:14px;font-weight:700"><span data-lang="en">Evidence checklist</span><span data-lang="kn" style="display:none">ಸಾಕ್ಷ್ಯ ಪಟ್ಟಿ</span></span><span style="font-size:12px;color:#6f6b63">1 / 5</span></div>
          <div style="display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e9e7e2;border-radius:12px;padding:11px 13px;margin-bottom:8px">
            <div style="width:27px;height:27px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:13px;font-weight:700;background:#1b8a5a;color:#fff;border:1px solid #1b8a5a">1</div>
            <div style="flex:1"><div style="font-size:13.5px;font-weight:600;line-height:1.35"><span data-lang="en">Wide shot of the field</span><span data-lang="kn" style="display:none">ಹೊಲದ ಪೂರ್ಣ ನೋಟ — ದೂರದಿಂದ ಫೋಟೋ</span></div><div style="font-size:10.5px;color:#1b5e3f;margin-top:3px;font-variant-numeric:tabular-nums"><span data-lang="en">Photo</span><span data-lang="kn" style="display:none">ಫೋಟೋ</span> ✓ 07:42 · 15.1502N 76.9328E</div></div>
            <svg viewBox="0 0 24 24" width="18" height="18" style="flex:none"><path d="M4 13l5 5L20 7" fill="none" stroke="#1b8a5a" stroke-width="2.5"></path></svg>
          </div>
          <div style="display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e9e7e2;border-radius:12px;padding:11px 13px;margin-bottom:8px">
            <div style="width:27px;height:27px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:13px;font-weight:700;background:#fff;color:#4a4740;border:1px solid #d9d6cf">2</div>
            <div style="flex:1;font-size:13.5px;font-weight:600;line-height:1.35"><span data-lang="en">Close-up of damaged crop</span><span data-lang="kn" style="display:none">ಹಾನಿಯಾದ ಬೆಳೆಯ ಹತ್ತಿರದ ಫೋಟೋ</span></div>
            <svg viewBox="0 0 24 24" width="18" height="18" style="flex:none;color:#6f6b63"><path d="M3 7h4l2-3h6l2 3h4v13H3z" fill="none" stroke="currentColor" stroke-width="1.8"></path><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"></circle></svg>
          </div>
          <div style="display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e9e7e2;border-radius:12px;padding:11px 13px;margin-bottom:8px">
            <div style="width:27px;height:27px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:13px;font-weight:700;background:#fff;color:#4a4740;border:1px solid #d9d6cf">4</div>
            <div style="flex:1;font-size:13.5px;font-weight:600;line-height:1.35"><span data-lang="en">Call Krishi Rakshak 14447</span><span data-lang="kn" style="display:none">ಹೆಲ್ಪ್‌ಲೈನ್ 14447 ಗೆ ಕರೆ ಮಾಡಿ</span></div>
            <span style="width:17px;height:17px;border-radius:6px;border:1.5px solid #c6c2b9;flex:none"></span>
          </div>
          <div style="position:absolute;bottom:0;left:0;right:0;height:60px;background:linear-gradient(to top,#f8f7f3 55%,rgba(248,247,243,0))"></div>
        </div>

        <!-- S4 CAPTURE -->
        <div data-fx="scr3" style="position:absolute;inset:78px 0 0;opacity:0;padding:14px 16px">
          <div style="display:flex;justify-content:space-between;align-items:center"><span style="background:#fff;border:1px solid #d9d6cf;border-radius:999px;padding:5px 13px;font-size:12px;font-weight:700">← <span data-lang="en">Back</span><span data-lang="kn" style="display:none">ಹಿಂದೆ</span></span><span style="font-size:11px;color:#6f6b63"><span data-lang="en">Evidence Step 2</span><span data-lang="kn" style="display:none">ಸಾಕ್ಷ್ಯ ಹಂತ 2</span></span></div>
          <div style="font-size:15px;font-weight:700;line-height:1.4;margin-top:14px"><span data-lang="en">Close-up of damaged crop</span><span data-lang="kn" style="display:none">ಹಾನಿಯಾದ ಬೆಳೆಯ ಹತ್ತಿರದ ಫೋಟೋ</span></div>
          <div style="position:relative;margin-top:12px;height:262px;background:#1c1c1a;border-radius:16px;overflow:hidden">
            <div style="position:absolute;inset:0;background:linear-gradient(168deg,#3a3428,#242018 55%,#1a1713)"></div>
            <div style="position:absolute;left:0;right:0;bottom:0;height:52%;background:repeating-linear-gradient(88deg,transparent 0 7px,rgba(0,0,0,.42) 7px 9px)"></div>
            <div style="position:absolute;top:12px;left:0;right:0;text-align:center;font-size:11px;letter-spacing:.06em;color:rgba(255,255,255,.9);text-shadow:0 1px 3px rgba(0,0,0,.8)"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#e05a44;margin-right:6px;vertical-align:middle;animation:pulse 1.2s infinite"></span><span data-lang="en">Camera · LIVE</span><span data-lang="kn" style="display:none">ಕ್ಯಾಮೆರಾ · LIVE</span></div>
            <div style="position:absolute;left:12px;bottom:12px;font-size:11px;line-height:1.7;color:#fff;background:rgba(28,28,26,.6);border-radius:9px;padding:7px 10px;font-variant-numeric:tabular-nums">15.1502 N · 76.9328 E<br>07:42:19 IST · 30 JUL 2026</div>
          </div>
          <div style="display:flex;justify-content:center;margin-top:16px"><div style="width:70px;height:70px;border-radius:50%;background:#fff;border:3px solid #1c1c1a;position:relative"><span style="position:absolute;inset:6px;border-radius:50%;background:#1c1c1a"></span></div></div>
          <div style="font-size:11px;color:#9a968d;text-align:center;margin-top:14px;line-height:1.6"><span data-lang="en">Location and time are stamped onto the photo</span><span data-lang="kn" style="display:none">ಸ್ಥಳ ಮತ್ತು ಸಮಯ ಚಿತ್ರದ ಮೇಲೆ ಮುದ್ರೆಯಾಗುತ್ತದೆ</span></div>
        </div>

        <!-- S5 DOCUMENT -->
        <div data-fx="scr4" style="position:absolute;inset:78px 0 0;opacity:0;padding:14px 16px 0;background:#eaf0eb;overflow:hidden">
          <div style="display:flex;justify-content:space-between;align-items:center"><span style="background:#fff;border:1px solid #d9d6cf;border-radius:999px;padding:5px 13px;font-size:12px;font-weight:700">← <span data-lang="en">Back</span><span data-lang="kn" style="display:none">ಹಿಂದೆ</span></span><span style="font-size:11px;color:#6f6b63"><span data-lang="en">Document</span><span data-lang="kn" style="display:none">ದಾಖಲೆ</span></span></div>
          <div style="background:#fff;border:1px solid #e5e3de;border-radius:10px;box-shadow:0 1px 3px rgba(28,28,26,.06);padding:16px 15px;margin-top:12px">
            <div style="text-align:center"><div style="font-size:15px;font-weight:700"><span data-lang="en">Loss intimation report</span><span data-lang="kn" style="display:none">ನಷ್ಟ ಸೂಚನಾ ವರದಿ</span></div><div style="font-size:10px;color:#6f6b63;margin-top:5px">AVD-0149/2026 · <span data-lang="en">Generated</span><span data-lang="kn" style="display:none">ರಚನೆ</span> 30 JUL 07:44 IST</div></div>
            <div style="border-top:1px solid #e5e3de;margin:12px 0"></div>
            <div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid #eeece7"><span style="flex:none;width:66px;font-size:10.5px;color:#6f6b63;padding-top:2px"><span data-lang="en">Name</span><span data-lang="kn" style="display:none">ಹೆಸರು</span></span><span style="flex:1;border-bottom:1px solid #c6c2b9;min-height:18px"></span></div>
            <div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid #eeece7"><span style="flex:none;width:66px;font-size:10.5px;color:#6f6b63;padding-top:2px"><span data-lang="en">Village</span><span data-lang="kn" style="display:none">ಗ್ರಾಮ</span></span><span style="flex:1;border-bottom:1px solid #c6c2b9;min-height:18px"></span></div>
            <div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid #eeece7"><span style="flex:none;width:66px;font-size:10.5px;color:#6f6b63"><span data-lang="en">Event</span><span data-lang="kn" style="display:none">ಘಟನೆ</span></span><span style="flex:1;font-size:12px;font-weight:600;line-height:1.4"><span data-lang="en">Crop insurance — hailstorm damage</span><span data-lang="kn" style="display:none">ಬೆಳೆ ವಿಮೆ — ಆಲಿಕಲ್ಲು ಹಾನಿ</span></span></div>
            <div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid #eeece7"><span style="flex:none;width:66px;font-size:10.5px;color:#6f6b63"><span data-lang="en">Deadline</span><span data-lang="kn" style="display:none">ಗಡುವು</span></span><span style="flex:1;font-size:12px;font-weight:600">01 AUG 21:26 IST · 72h</span></div>
            <div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid #eeece7"><span style="flex:none;width:66px;font-size:10.5px;color:#6f6b63"><span data-lang="en">Rule</span><span data-lang="kn" style="display:none">ನಿಯಮ</span></span><span style="flex:1;font-size:12px;font-weight:600">PMFBY §21(2)</span></div>
            <div style="font-size:10.5px;color:#6f6b63;margin:12px 0 4px"><span data-lang="en">Evidence attached</span><span data-lang="kn" style="display:none">ಲಗತ್ತಿಸಿದ ಸಾಕ್ಷ್ಯ</span></div>
            <div style="display:flex;gap:8px;align-items:baseline;font-size:10.5px;padding:4px 0;border-bottom:1px solid #f2f1ec"><span style="font-weight:700">EV-01</span><span style="flex:1;color:#4a4740">Wide shot of the field</span><span style="color:#1b5e3f;font-variant-numeric:tabular-nums">07:42 ✓</span></div>
            <div style="display:flex;gap:16px;margin-top:22px"><div style="flex:1;border-top:1px solid #1c1c1a;padding-top:5px;font-size:9.5px;color:#6f6b63"><span data-lang="en">Signature</span><span data-lang="kn" style="display:none">ಸಹಿ</span></div><div style="flex:1;border-top:1px solid #1c1c1a;padding-top:5px;font-size:9.5px;color:#6f6b63"><span data-lang="en">Date</span><span data-lang="kn" style="display:none">ದಿನಾಂಕ</span></div></div>
          </div>
          <div style="position:absolute;bottom:0;left:0;right:0;height:64px;background:linear-gradient(to top,#eaf0eb 55%,rgba(234,240,235,0))"></div>
        </div>
      </div>
    </div>

    <div style="width:min(340px,36vw);position:relative;height:210px;flex:none">
      <div data-fx="cap0" style="position:absolute;inset:0;opacity:0">
        <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#d9a44e;margin-bottom:10px">S1 · <span data-lang="en">Home</span><span data-lang="kn" style="display:none">ಮುಖಪುಟ</span></div>
        <div style="font-size:clamp(19px,2.1vw,27px);font-weight:700;line-height:1.35"><span data-lang="en">Open it cold. The clocks are already running.</span><span data-lang="kn" style="display:none">ಅಪ್ಲಿಕೇಶನ್ ತೆರೆದ ಕ್ಷಣವೇ ಗಡಿಯಾರಗಳು ಓಡುತ್ತಿವೆ.</span></div>
        <div style="font-size:13px;color:rgba(242,241,236,.45);margin-top:10px;line-height:1.55"><span data-lang="en">Most urgent first. Expired cases are never hidden.</span><span data-lang="kn" style="display:none">ಅತಿ ತುರ್ತಾದದ್ದು ಮೊದಲು. ಮುಗಿದ ಪ್ರಕರಣಗಳನ್ನೂ ಮುಚ್ಚಿಡುವುದಿಲ್ಲ.</span></div>
      </div>
      <div data-fx="cap1" style="position:absolute;inset:0;opacity:0">
        <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#d9a44e;margin-bottom:10px">S2 · <span data-lang="en">Voice intake</span><span data-lang="kn" style="display:none">ಧ್ವನಿ</span></div>
        <div style="font-size:clamp(19px,2.1vw,27px);font-weight:700;line-height:1.35"><span data-lang="en">Speak in Kannada. There is no text input anywhere.</span><span data-lang="kn" style="display:none">ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ. ಎಲ್ಲಿಯೂ ಟೈಪ್ ಮಾಡುವ ಅಗತ್ಯವಿಲ್ಲ.</span></div>
        <div style="font-size:13px;color:rgba(242,241,236,.45);margin-top:10px;line-height:1.55"><span data-lang="en">On-device inference. The audio never leaves the phone.</span><span data-lang="kn" style="display:none">ಸಾಧನದಲ್ಲೇ ವಿಶ್ಲೇಷಣೆ. ಧ್ವನಿ ಫೋನ್ ಬಿಟ್ಟು ಹೋಗುವುದಿಲ್ಲ.</span></div>
      </div>
      <div data-fx="cap2" style="position:absolute;inset:0;opacity:0">
        <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#d9a44e;margin-bottom:10px">S3 · <span data-lang="en">Case detail</span><span data-lang="kn" style="display:none">ಪ್ರಕರಣ</span></div>
        <div style="font-size:clamp(19px,2.1vw,27px);font-weight:700;line-height:1.35"><span data-lang="en">A deterministic engine sets the deadline — never the model.</span><span data-lang="kn" style="display:none">ಗಡುವನ್ನು ನಿಯಮ ಎಂಜಿನ್ ನಿರ್ಧರಿಸುತ್ತದೆ — ಮಾದರಿ ಅಲ್ಲ.</span></div>
        <div style="font-size:13px;color:rgba(242,241,236,.45);margin-top:10px;line-height:1.55"><span data-lang="en">The checklist is ordered: the wide shot before you walk into the field.</span><span data-lang="kn" style="display:none">ಪಟ್ಟಿಯ ಕ್ರಮ ಮುಖ್ಯ — ಹೊಲಕ್ಕೆ ಕಾಲಿಡುವ ಮೊದಲು ದೂರದ ಫೋಟೋ.</span></div>
      </div>
      <div data-fx="cap3" style="position:absolute;inset:0;opacity:0">
        <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#d9a44e;margin-bottom:10px">S4 · <span data-lang="en">Capture</span><span data-lang="kn" style="display:none">ಸಾಕ್ಷ್ಯ</span></div>
        <div style="font-size:clamp(19px,2.1vw,27px);font-weight:700;line-height:1.35"><span data-lang="en">Location and time are stamped onto the photo.</span><span data-lang="kn" style="display:none">ಸ್ಥಳ ಮತ್ತು ಸಮಯ ಚಿತ್ರದ ಮೇಲೆ ಮುದ್ರೆಯಾಗುತ್ತದೆ.</span></div>
        <div style="font-size:13px;color:rgba(242,241,236,.45);margin-top:10px;line-height:1.55"><span data-lang="en">Silently. If location is denied, the photo still saves.</span><span data-lang="kn" style="display:none">ಸ್ಥಳ ಅನುಮತಿ ಇಲ್ಲದಿದ್ದರೂ ಫೋಟೋ ಉಳಿಯುತ್ತದೆ.</span></div>
      </div>
      <div data-fx="cap4" style="position:absolute;inset:0;opacity:0">
        <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#d9a44e;margin-bottom:10px">S5 · <span data-lang="en">Document</span><span data-lang="kn" style="display:none">ದಾಖಲೆ</span></div>
        <div style="font-size:clamp(19px,2.1vw,27px);font-weight:700;line-height:1.35"><span data-lang="en">The report he carries to the bank.</span><span data-lang="kn" style="display:none">ಬ್ಯಾಂಕಿಗೆ ಒಯ್ಯುವ ವರದಿ.</span></div>
        <div style="font-size:13px;color:rgba(242,241,236,.45);margin-top:10px;line-height:1.55"><span data-lang="en">Blank lines for what must be handwritten. Nothing is guessed.</span><span data-lang="kn" style="display:none">ಕೈಬರಹಕ್ಕೆ ಖಾಲಿ ಜಾಗ. ಯಾವುದನ್ನೂ ಊಹಿಸುವುದಿಲ್ಲ.</span></div>
      </div>
      <div style="position:absolute;bottom:-38px;left:0;display:flex;gap:8px">
        <div data-fx="dot0" style="width:22px;height:3px;border-radius:2px;background:#d9a44e"></div>
        <div data-fx="dot1" style="width:22px;height:3px;border-radius:2px;background:rgba(242,241,236,.18)"></div>
        <div data-fx="dot2" style="width:22px;height:3px;border-radius:2px;background:rgba(242,241,236,.18)"></div>
        <div data-fx="dot3" style="width:22px;height:3px;border-radius:2px;background:rgba(242,241,236,.18)"></div>
        <div data-fx="dot4" style="width:22px;height:3px;border-radius:2px;background:rgba(242,241,236,.18)"></div>
      </div>
    </div>
  </div>
</div>

<!-- SCENE 6 — the rule library -->
<div data-scene="6" style="height:300vh;position:relative">
  <div data-screen-label="S6 · The rule library" style="position:sticky;top:0;height:100vh;overflow:hidden;background:#0f0f0e;display:flex;align-items:center;justify-content:center">
    <svg style="position:absolute;inset:0;width:100%;height:100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <line data-fx="net0" x1="50" y1="50" x2="17" y2="26" pathLength="1" stroke="#d9a44e" stroke-opacity=".45" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="1" stroke-dashoffset="1"></line>
      <line data-fx="net1" x1="50" y1="50" x2="83" y2="24" pathLength="1" stroke="#d9a44e" stroke-opacity=".45" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="1" stroke-dashoffset="1"></line>
      <line data-fx="net2" x1="50" y1="50" x2="15" y2="72" pathLength="1" stroke="#d9a44e" stroke-opacity=".45" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="1" stroke-dashoffset="1"></line>
      <line data-fx="net3" x1="50" y1="50" x2="85" y2="74" pathLength="1" stroke="#d9a44e" stroke-opacity=".45" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="1" stroke-dashoffset="1"></line>
      <line data-fx="net4" x1="50" y1="50" x2="50" y2="16" pathLength="1" stroke="#d9a44e" stroke-opacity=".45" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="1" stroke-dashoffset="1"></line>
    </svg>
    <div data-fx="s6phone" style="width:176px;height:364px;background:#141412;border:2px solid #2b2a26;border-radius:30px;padding:8px;box-shadow:0 30px 80px rgba(0,0,0,.6);z-index:2;flex:none">
      <div style="width:100%;height:100%;background:#f8f7f3;border-radius:22px;overflow:hidden;display:flex;flex-direction:column">
        <div style="background:#e2e8e2;border-bottom:1px solid #d0d7cf;padding:12px 12px 10px"><div style="font-family:Georgia,serif;font-size:19px;font-weight:800;color:#1c1c1a;letter-spacing:-.02em">ಅವಧಿ</div></div>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#1c1c1a">
          <div style="font-size:10px;color:#6f6b63"><span data-lang="en">Time remaining</span><span data-lang="kn" style="display:none">ಉಳಿದ ಸಮಯ</span></div>
          <div data-timer="case" style="font-variant-numeric:tabular-nums;font-size:23px;font-weight:700;color:#1b5e3f;letter-spacing:-.02em">47:26:08</div>
        </div>
      </div>
    </div>
    <div data-fx="s6h" style="opacity:0;position:absolute;top:6vh;left:0;right:0;text-align:center;padding:0 6vw">
      <div style="font-size:clamp(20px,2.6vw,30px);font-weight:700"><span data-lang="en">One incident. Every rule that applies.</span><span data-lang="kn" style="display:none">ಒಂದು ಘಟನೆ. ಅನ್ವಯವಾಗುವ ಪ್ರತಿ ನಿಯಮ.</span></div>
      <div style="font-size:13px;color:rgba(242,241,236,.45);margin-top:8px"><span data-lang="en">A deterministic engine. No claim window is ever produced by a model.</span><span data-lang="kn" style="display:none">ನಿಶ್ಚಿತ ನಿಯಮ ಎಂಜಿನ್. ಯಾವ ಗಡುವನ್ನೂ ಮಾದರಿ ನಿರ್ಧರಿಸುವುದಿಲ್ಲ.</span></div>
    </div>
    <div data-fx="node0" style="opacity:0;position:absolute;left:17%;top:26%;transform:translate(-50%,-100%);background:#fff;color:#1c1c1a;border:1px solid #e9e7e2;border-radius:12px;padding:11px 13px;font-size:12px;max-width:212px;text-align:left">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>PMFBY §21(2)</b><span style="font-size:10px;font-weight:600;color:#1b5e3f;background:#e8f2ec;border-radius:999px;padding:2px 8px">72h</span></div>
      <div style="color:#6f6b63;margin-top:4px;line-height:1.45"><span data-lang="en">Localised calamity or post-harvest loss</span><span data-lang="kn" style="display:none">ಸ್ಥಳೀಯ ವಿಪತ್ತು / ಕೊಯ್ಲಿನ ನಂತರದ ನಷ್ಟ</span></div>
      <div style="font-size:10px;color:#9a968d;margin-top:6px">pmfby.gov.in · <span data-lang="en">verified</span><span data-lang="kn" style="display:none">ಪರಿಶೀಲನೆ</span> 2026-07-27</div>
    </div>
    <div data-fx="node1" style="opacity:0;position:absolute;left:83%;top:24%;transform:translate(-50%,-100%);background:#fff;color:#1c1c1a;border:1px solid #e9e7e2;border-radius:12px;padding:11px 13px;font-size:12px;max-width:230px;text-align:left">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>RBI 2017</b><span style="font-size:10px;font-weight:600;color:#a05a00;background:#fdf3e4;border-radius:999px;padding:2px 8px"><span data-lang="en">3 working days</span><span data-lang="kn" style="display:none">3 ಕೆಲಸದ ದಿನ</span></span></div>
      <div style="color:#6f6b63;margin-top:4px;line-height:1.45"><span data-lang="en">Unauthorised electronic transaction — zero liability</span><span data-lang="kn" style="display:none">ಅನಧಿಕೃತ ವಹಿವಾಟು — ಶೂನ್ಯ ಹೊಣೆ</span></div>
      <div style="font-size:10px;color:#9a968d;margin-top:6px">DBR.No.Leg.BC.78/09.07.005/2017-18</div>
    </div>
    <div data-fx="node2" style="opacity:0;position:absolute;left:15%;top:72%;transform:translate(-50%,0);background:#fff;color:#1c1c1a;border:1px solid #e9e7e2;border-radius:12px;padding:11px 13px;font-size:12px;max-width:212px;text-align:left">
      <div style="font-weight:700"><span data-lang="en">Reporting channels</span><span data-lang="kn" style="display:none">ವರದಿ ಮಾಡುವ ಮಾರ್ಗ</span></div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;color:#6f6b63"><span><span data-lang="en">Krishi Rakshak</span><span data-lang="kn" style="display:none">ಕೃಷಿ ರಕ್ಷಕ</span></span><b style="color:#1c1c1a;font-variant-numeric:tabular-nums">14447</b></div>
      <div style="display:flex;justify-content:space-between;margin-top:3px;color:#6f6b63"><span><span data-lang="en">Cyber fraud</span><span data-lang="kn" style="display:none">ಸೈಬರ್ ಸಹಾಯವಾಣಿ</span></span><b style="color:#1c1c1a;font-variant-numeric:tabular-nums">1930</b></div>
      <div style="display:flex;justify-content:space-between;margin-top:3px;color:#6f6b63"><span>RBI CMS</span><b style="color:#1c1c1a;font-size:11px">cms.rbi.org.in</b></div>
    </div>
    <div data-fx="node3" style="opacity:0;position:absolute;left:85%;top:74%;transform:translate(-50%,0);background:#fff;color:#1c1c1a;border:1px solid #e9e7e2;border-radius:12px;padding:11px 13px;font-size:12px;max-width:212px;text-align:left">
      <div style="font-weight:700"><span data-lang="en">In the rule library</span><span data-lang="kn" style="display:none">ನಿಯಮ ಸಂಗ್ರಹದಲ್ಲಿ</span></div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;color:#6f6b63"><span>PMSBY</span><b style="color:#1c1c1a">30 <span data-lang="en">days</span><span data-lang="kn" style="display:none">ದಿನ</span></b></div>
      <div style="display:flex;justify-content:space-between;margin-top:3px;color:#6f6b63"><span>PMJJBY</span><b style="color:#1c1c1a">30 <span data-lang="en">days</span><span data-lang="kn" style="display:none">ದಿನ</span></b></div>
      <div style="font-size:10px;color:#9a968d;margin-top:6px"><span data-lang="en">Adding a scheme is a data change, not a code change.</span><span data-lang="kn" style="display:none">ಹೊಸ ಯೋಜನೆ ಸೇರಿಸುವುದು ದತ್ತಾಂಶ ಬದಲಾವಣೆ ಮಾತ್ರ.</span></div>
    </div>
    <div data-fx="node4" style="opacity:0;position:absolute;left:50%;top:16%;transform:translate(-50%,-100%);background:#fff;color:#1c1c1a;border:1px solid #e9e7e2;border-radius:12px;padding:11px 13px;font-size:12px;max-width:250px;text-align:left">
      <div style="font-weight:700"><span data-lang="en">Working-day arithmetic</span><span data-lang="kn" style="display:none">ಕೆಲಸದ ದಿನಗಳ ಗಣನೆ</span></div>
      <div style="color:#6f6b63;margin-top:4px;line-height:1.45"><span data-lang="en">Sundays, second and fourth Saturdays, and the holiday list — all data.</span><span data-lang="kn" style="display:none">ಭಾನುವಾರ, 2ನೇ ಮತ್ತು 4ನೇ ಶನಿವಾರ, ರಜಾ ಪಟ್ಟಿ — ಎಲ್ಲವೂ ದತ್ತಾಂಶ.</span></div>
    </div>
    <div data-fx="s6src" style="opacity:0;position:absolute;bottom:4.5vh;left:0;right:0;text-align:center;padding:0 6vw;font-size:11.5px;line-height:1.7;color:rgba(242,241,236,.42)">
      <span data-lang="en">Every rule carries a source and a verification date — the loader refuses to start without them.</span><span data-lang="kn" style="display:none">ಪ್ರತಿ ನಿಯಮಕ್ಕೂ ಮೂಲ ಮತ್ತು ಪರಿಶೀಲನೆ ದಿನಾಂಕ ಇರಬೇಕು — ಇಲ್ಲದಿದ್ದರೆ ಲೋಡರ್ ಶುರುವಾಗುವುದಿಲ್ಲ.</span><br>
      <a href="https://pmfby.gov.in" target="_blank">pmfby.gov.in</a> · <a href="https://rbi.org.in" target="_blank">rbi.org.in</a>
    </div>
  </div>
</div>

<!-- SCENE 7 -->
<div data-scene="7" style="height:220vh;position:relative">
  <div data-screen-label="S7 · The next action" style="position:sticky;top:0;height:100vh;overflow:hidden;background:#0f0f0e;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:0 6vw;text-align:center">
    <div data-fx="s7big" style="opacity:0">
      <div data-timer="case" style="font-size:clamp(74px,14vw,196px);font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.04em;line-height:1;color:#d9a44e">47:26:08</div>
    </div>
    <div data-fx="s7task" style="opacity:0">
      <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(242,241,236,.4);margin-bottom:12px"><span data-lang="en">Step 2 of 5</span><span data-lang="kn" style="display:none">5ರಲ್ಲಿ 2ನೇ ಹಂತ</span></div>
      <div style="font-size:clamp(20px,2.6vw,30px);font-weight:700"><span data-lang="en">Close-up of the damaged crop.</span><span data-lang="kn" style="display:none">ಹಾನಿಯಾದ ಬೆಳೆಯ ಹತ್ತಿರದ ಫೋಟೋ.</span></div>
    </div>
    <div data-fx="s7note" style="opacity:0;font-size:13px;color:rgba(242,241,236,.42);max-width:440px;line-height:1.6"><span data-lang="en">Not a dashboard. One number, one instruction — the next thing that changes the outcome.</span><span data-lang="kn" style="display:none">ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಅಲ್ಲ. ಒಂದು ಸಂಖ್ಯೆ, ಒಂದು ಸೂಚನೆ — ಫಲಿತಾಂಶ ಬದಲಿಸುವ ಮುಂದಿನ ಕೆಲಸ.</span></div>
  </div>
</div>

<!-- SCENE 8 -->
<div data-scene="8" style="height:260vh;position:relative">
  <div data-screen-label="S8 · Evidence metadata" style="position:sticky;top:0;height:100vh;overflow:hidden;background:#0f0f0e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 6vw">
    <div data-fx="s8h" style="opacity:0;font-size:clamp(24px,3vw,38px);font-weight:700;margin-bottom:40px;text-align:center"><span data-lang="en">Evidence that stands up.</span><span data-lang="kn" style="display:none">ನಿಲ್ಲುವ ಸಾಕ್ಷ್ಯ.</span></div>
    <div style="display:grid;gap:16px;font-size:clamp(13px,1.5vw,17px);width:min(600px,86vw);font-variant-numeric:tabular-nums">
      <div data-fx="row0" style="opacity:0;display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid rgba(242,241,236,.1);padding-bottom:13px"><span style="color:#39a877">✓ EV-01 <span data-lang="en">captured</span><span data-lang="kn" style="display:none">ದಾಖಲಾಗಿದೆ</span></span><span style="color:rgba(242,241,236,.55);text-align:right"><span data-lang="en">Wide shot of the field</span><span data-lang="kn" style="display:none">ಹೊಲದ ಪೂರ್ಣ ನೋಟ</span></span></div>
      <div data-fx="row1" style="opacity:0;display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid rgba(242,241,236,.1);padding-bottom:13px"><span style="color:#39a877">✓ <span data-lang="en">Location</span><span data-lang="kn" style="display:none">ಸ್ಥಳ</span></span><span style="color:rgba(242,241,236,.55)">15.1502 N · 76.9328 E</span></div>
      <div data-fx="row2" style="opacity:0;display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid rgba(242,241,236,.1);padding-bottom:13px"><span style="color:#39a877">✓ <span data-lang="en">Accuracy</span><span data-lang="kn" style="display:none">ನಿಖರತೆ</span></span><span style="color:rgba(242,241,236,.55)">± 8 m</span></div>
      <div data-fx="row3" style="opacity:0;display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid rgba(242,241,236,.1);padding-bottom:13px"><span style="color:#39a877">✓ <span data-lang="en">Captured at</span><span data-lang="kn" style="display:none">ಸಮಯ</span></span><span style="color:rgba(242,241,236,.55)">07:42:19 IST · 30 JUL 2026</span></div>
      <div data-fx="row4" style="opacity:0;display:flex;justify-content:space-between;gap:24px"><span style="color:#d9a44e">⌁ <span data-lang="en">Stored</span><span data-lang="kn" style="display:none">ಸಂಗ್ರಹ</span></span><span style="color:rgba(242,241,236,.55)"><span data-lang="en">this device only · offline</span><span data-lang="kn" style="display:none">ಈ ಸಾಧನದಲ್ಲಿ ಮಾತ್ರ · ಆಫ್‌ಲೈನ್</span></span></div>
    </div>
    <div data-fx="s8note" style="opacity:0;margin-top:34px;font-size:13px;color:rgba(242,241,236,.4);text-align:center;max-width:480px;line-height:1.6"><span data-lang="en">Stamped silently at capture. If location permission is denied, the photo is still saved and marked unverified — never blocked.</span><span data-lang="kn" style="display:none">ಫೋಟೋ ತೆಗೆದ ಕ್ಷಣವೇ ಮುದ್ರೆ. ಸ್ಥಳ ಅನುಮತಿ ಇಲ್ಲದಿದ್ದರೂ ಫೋಟೋ ಉಳಿಯುತ್ತದೆ — ತಡೆಯುವುದಿಲ್ಲ.</span></div>
  </div>
</div>

<!-- SCENE 9 — the document builds itself -->
<div data-scene="9" style="height:340vh;position:relative">
  <div data-screen-label="S9 · The document builds" style="position:sticky;top:0;height:100vh;overflow:hidden;background:#0f0f0e;display:flex;align-items:center;justify-content:center;gap:6vw;flex-wrap:wrap">
    <div data-fx="s9cap" style="opacity:0;max-width:300px;padding:0 4vw">
      <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#d9a44e;margin-bottom:10px">S5 · <span data-lang="en">Document</span><span data-lang="kn" style="display:none">ದಾಖಲೆ</span></div>
      <div style="font-size:clamp(21px,2.5vw,31px);font-weight:700;line-height:1.35"><span data-lang="en">The paperwork writes itself.</span><span data-lang="kn" style="display:none">ದಾಖಲೆ ತಾನೇ ಬರೆಯುತ್ತದೆ.</span></div>
      <div style="font-size:13px;color:rgba(242,241,236,.45);margin-top:12px;line-height:1.6"><span data-lang="en">Generated on the device, in airplane mode, with the rule citation on the page.</span><span data-lang="kn" style="display:none">ಸಾಧನದಲ್ಲೇ, ನೆಟ್‌ವರ್ಕ್ ಇಲ್ಲದೆ ರಚನೆ. ನಿಯಮದ ಮೂಲ ಪುಟದಲ್ಲೇ ಇದೆ.</span></div>
    </div>
    <div data-fx="s9paper" style="opacity:0;width:min(432px,86vw);background:#fff;color:#1c1c1a;border:1px solid #e5e3de;border-radius:12px;padding:28px 26px;box-shadow:0 40px 100px rgba(0,0,0,.55)">
      <div data-fx="d0" style="opacity:0;text-align:center">
        <div style="font-size:19px;font-weight:700"><span data-lang="en">Loss intimation report</span><span data-lang="kn" style="display:none">ನಷ್ಟ ಸೂಚನಾ ವರದಿ</span></div>
        <div style="font-size:11px;letter-spacing:.14em;color:#6f6b63;margin-top:3px">LOSS INTIMATION REPORT</div>
        <div style="font-size:12px;color:#6f6b63;margin-top:8px">AVD-0149/2026 · <span data-lang="en">Generated</span><span data-lang="kn" style="display:none">ರಚನೆ</span> 30 JUL 07:44 IST</div>
      </div>
      <div data-fx="d1" style="opacity:0">
        <div style="border-top:1px solid #e5e3de;margin:16px 0"></div>
        <div style="display:flex;gap:14px;padding:8px 0;border-bottom:1px solid #eeece7"><span style="flex:none;width:84px;font-size:12px;color:#6f6b63;padding-top:3px"><span data-lang="en">Name</span><span data-lang="kn" style="display:none">ಹೆಸರು</span></span><span style="flex:1;border-bottom:1px solid #c6c2b9;min-height:22px"></span></div>
        <div style="display:flex;gap:14px;padding:8px 0;border-bottom:1px solid #eeece7"><span style="flex:none;width:84px;font-size:12px;color:#6f6b63;padding-top:3px"><span data-lang="en">Village</span><span data-lang="kn" style="display:none">ಗ್ರಾಮ</span></span><span style="flex:1;border-bottom:1px solid #c6c2b9;min-height:22px"></span></div>
      </div>
      <div data-fx="d2" style="opacity:0">
        <div style="display:flex;gap:14px;padding:9px 0;border-bottom:1px solid #eeece7"><span style="flex:none;width:84px;font-size:12px;color:#6f6b63;padding-top:2px"><span data-lang="en">Event</span><span data-lang="kn" style="display:none">ಘಟನೆ</span></span><span style="flex:1;font-size:14px;font-weight:600;line-height:1.45"><span data-lang="en">Crop insurance — hailstorm damage</span><span data-lang="kn" style="display:none">ಬೆಳೆ ವಿಮೆ — ಆಲಿಕಲ್ಲು ಹಾನಿ</span></span></div>
        <div style="display:flex;gap:14px;padding:9px 0;border-bottom:1px solid #eeece7"><span style="flex:none;width:84px;font-size:12px;color:#6f6b63;padding-top:2px"><span data-lang="en">Date</span><span data-lang="kn" style="display:none">ದಿನಾಂಕ</span></span><span style="flex:1;font-size:14px;font-weight:600"><span data-lang="en">28 JUL 2026 · ~night</span><span data-lang="kn" style="display:none">28 JUL 2026 · ~ರಾತ್ರಿ</span></span></div>
        <div style="display:flex;gap:14px;padding:9px 0;border-bottom:1px solid #eeece7"><span style="flex:none;width:84px;font-size:12px;color:#6f6b63;padding-top:2px"><span data-lang="en">Details</span><span data-lang="kn" style="display:none">ವಿವರ</span></span><span style="flex:1;font-size:14px;font-weight:600"><span data-lang="en">Cotton · ~2 acres</span><span data-lang="kn" style="display:none">ಹತ್ತಿ · ~2 ಎಕರೆ</span></span></div>
      </div>
      <div data-fx="d3" style="opacity:0">
        <div style="display:flex;gap:14px;padding:9px 0;border-bottom:1px solid #eeece7"><span style="flex:none;width:84px;font-size:12px;color:#6f6b63;padding-top:2px"><span data-lang="en">Deadline</span><span data-lang="kn" style="display:none">ಗಡುವು</span></span><span style="flex:1;font-size:14px;font-weight:600">01 AUG 21:26 IST · <span data-lang="en">72 hours</span><span data-lang="kn" style="display:none">72 ಗಂಟೆ</span></span></div>
        <div style="display:flex;gap:14px;padding:9px 0;border-bottom:1px solid #eeece7"><span style="flex:none;width:84px;font-size:12px;color:#6f6b63;padding-top:2px"><span data-lang="en">Rule</span><span data-lang="kn" style="display:none">ನಿಯಮ</span></span><span style="flex:1;font-size:14px;font-weight:600">PMFBY §21(2)</span></div>
      </div>
      <div data-fx="d4" style="opacity:0">
        <div style="font-size:12px;color:#6f6b63;margin:18px 0 6px"><span data-lang="en">Evidence attached</span><span data-lang="kn" style="display:none">ಲಗತ್ತಿಸಿದ ಸಾಕ್ಷ್ಯ</span></div>
        <div style="display:flex;gap:10px;align-items:baseline;font-size:12.5px;padding:5px 0;border-bottom:1px solid #f2f1ec"><span style="font-weight:700">EV-01</span><span style="flex:1;color:#4a4740">Wide shot of the field</span><span style="color:#1b5e3f;font-variant-numeric:tabular-nums">15.1502N 76.9328E · 07:42 ✓</span></div>
        <div style="display:flex;gap:10px;align-items:baseline;font-size:12.5px;padding:5px 0;border-bottom:1px solid #f2f1ec"><span style="font-weight:700">EV-02</span><span style="flex:1;color:#4a4740">Close-up of damaged crop</span><span style="color:#1b5e3f;font-variant-numeric:tabular-nums">15.1502N 76.9331E · 07:51 ✓</span></div>
      </div>
      <div data-fx="d5" style="opacity:0">
        <p style="font-size:13px;line-height:1.65;color:#6f6b63;margin:18px 0 0"><span data-lang="en">I declare that the details above are true. This report is an intimation intended to meet the deadline under PMFBY §21(2).</span><span data-lang="kn" style="display:none">ಮೇಲಿನ ವಿವರ ಸತ್ಯವೆಂದು ಘೋಷಿಸುತ್ತೇನೆ. ಈ ವರದಿ PMFBY §21(2) ನಿಯಮದಡಿ ಗಡುವಿನೊಳಗೆ ತಿಳಿಸುವ ಉದ್ದೇಶದ ಸೂಚನೆ.</span></p>
        <div style="display:flex;gap:20px;margin-top:32px"><div style="flex:1;border-top:1px solid #1c1c1a;padding-top:6px;font-size:11px;color:#6f6b63"><span data-lang="en">Signature</span><span data-lang="kn" style="display:none">ಸಹಿ</span></div><div style="flex:1;border-top:1px solid #1c1c1a;padding-top:6px;font-size:11px;color:#6f6b63"><span data-lang="en">Date</span><span data-lang="kn" style="display:none">ದಿನಾಂಕ</span></div></div>
      </div>
      <div data-fx="d6" style="opacity:0;border-top:1px solid #e5e3de;margin-top:20px;padding-top:10px;font-size:10.5px;color:#9a968d;line-height:1.7">
        <span data-lang="en">Source</span><span data-lang="kn" style="display:none">ಮೂಲ</span> — pmfby.gov.in · PMFBY §21(2) · <span data-lang="en">verified</span><span data-lang="kn" style="display:none">ಪರಿಶೀಲನೆ</span> 2026-07-27<br>
        <span data-lang="en">Avadhi prepares this report. The farmer or the officer files it through the official channel.</span><span data-lang="kn" style="display:none">ಅವಧಿ ಈ ವರದಿ ಸಿದ್ಧಪಡಿಸುತ್ತದೆ. ಸಲ್ಲಿಕೆ ರೈತ ಅಥವಾ ಅಧಿಕಾರಿಯ ಮೂಲಕ ಅಧಿಕೃತ ಮಾರ್ಗದಲ್ಲಿ.</span>
      </div>
    </div>
  </div>
</div>

<!-- SCENE 10 — dissolve into the app -->
<div data-scene="10" style="height:420vh;position:relative">
  <div data-screen-label="S10 · Becomes the app" style="position:sticky;top:0;height:100vh;overflow:hidden;background:#0f0f0e;display:flex;align-items:center;justify-content:center">
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:0 6vw">
      <div data-fx="s10l1" style="opacity:0;font-size:clamp(28px,4.4vw,52px);font-weight:700"><span data-lang="en">Rights have deadlines.</span><span data-lang="kn" style="display:none">ಹಕ್ಕುಗಳಿಗೆ ಗಡುವಿದೆ.</span></div>
      <div data-fx="s10l2" style="opacity:0;font-size:clamp(28px,4.4vw,52px);font-weight:700;color:#d9a44e"><span data-lang="en">People deserve to know them.</span><span data-lang="kn" style="display:none">ಜನರಿಗೆ ಅವು ತಿಳಿದಿರಬೇಕು.</span></div>
      <div data-fx="s10l3" style="opacity:0;margin-top:26px;font-family:Georgia,serif;font-size:clamp(16px,1.8vw,22px);font-weight:700;color:rgba(242,241,236,.6);letter-spacing:.02em"><span data-lang="en">ಅವಧಿ · Time is evidence</span><span data-lang="kn" style="display:none">ಅವಧಿ · ಸಮಯವೇ ಸಾಕ್ಷಿ</span></div>
    </div>

    <!-- the real S1 Home takes over -->
    <div data-fx="app" style="opacity:0;position:absolute;inset:0;transform:scale(.3);border-radius:48px;overflow:hidden;background:#f8f7f3;color:#1c1c1a;box-shadow:0 0 0 3px #2b2a26,0 60px 140px rgba(0,0,0,.7)">
      <div style="height:100%;max-width:560px;margin:0 auto;display:flex;flex-direction:column">
        <div style="background:#e2e8e2;border-bottom:1px solid #d0d7cf;padding:24px 20px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex:none">
          <div>
            <div style="font-family:Georgia,serif;font-size:29px;font-weight:800;letter-spacing:-.02em;line-height:1.15">ಅವಧಿ</div>
            <div style="font-size:13px;color:#6f6b63;margin-top:3px;font-weight:500"><span data-lang="en">Avadhi · Time is evidence</span><span data-lang="kn" style="display:none">Avadhi · ಸಮಯವೇ ಸಾಕ್ಷಿ</span></div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="display:flex;align-items:center;gap:8px;background:#f1f0ec;border-radius:999px;padding:6px 14px;font-size:13px;font-weight:500;color:#4a4740;white-space:nowrap"><span style="width:8px;height:8px;border-radius:50%;background:#1b8a5a"></span><span data-lang="en">Offline ready</span><span data-lang="kn" style="display:none">ಆಫ್‌ಲೈನ್ ಸಿದ್ಧ</span></div>
          </div>
        </div>
        <div style="flex:1;overflow:hidden;padding:16px 20px 0;position:relative">
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px">
            <div style="font-size:13px;font-weight:600;color:#92400e"><span data-lang="en">Add your policy certificate — reporting will take 30 seconds next time</span><span data-lang="kn" style="display:none">ನಿಮ್ಮ ಪಾಲಿಸಿ ಪ್ರಮಾಣಪತ್ರ ಸೇರಿಸಿ — ಮುಂದಿನ ಬಾರಿ ವರದಿ 30 ಸೆಕೆಂಡ್</span></div>
            <span style="color:#b45309;font-size:16px;font-weight:700">✕</span>
          </div>
          <div style="font-size:16px;font-weight:600;color:#4a4740;margin:20px 0 12px">3 <span data-lang="en">cases on record</span><span data-lang="kn" style="display:none">ಪ್ರಕರಣ ದಾಖಲೆಯಲ್ಲಿ</span></div>
          <div style="background:#fdf3e4;border:1px solid #ecd9b8;border-radius:14px;padding:14px 16px;display:flex;gap:12px;align-items:center;margin-bottom:14px">
            <span style="width:10px;height:10px;border-radius:50%;background:#a05a00;flex:none;animation:pulse 1.2s infinite"></span>
            <div><div style="font-size:15px;font-weight:700;line-height:1.4;color:#5c3400"><span data-lang="en">Warning — one deadline closes within 12 hours</span><span data-lang="kn" style="display:none">ಎಚ್ಚರಿಕೆ — ಒಂದು ಗಡುವು 12 ಗಂಟೆಯೊಳಗೆ ಮುಗಿಯುತ್ತದೆ</span></div><div style="font-size:12px;color:#8a5a10;margin-top:2px"><span data-lang="en">Act now</span><span data-lang="kn" style="display:none">ಈಗಲೇ ಕ್ರಮ ತೆಗೆದುಕೊಳ್ಳಿ</span></div></div>
          </div>
          <div style="background:#fff;border:1px solid #e9e7e2;border-radius:16px;padding:16px 18px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="font-size:12px;color:#6f6b63">AVD-0152 · RBI 2017</span><span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#a05a00;background:#fdf3e4;border-radius:999px;padding:4px 11px;white-space:nowrap"><span style="width:7px;height:7px;border-radius:50%;background:currentColor"></span><span data-lang="en">Closing soon</span><span data-lang="kn" style="display:none">ಶೀಘ್ರ ಮುಕ್ತಾಯ</span></span></div>
            <div style="display:flex;align-items:baseline;gap:8px;margin-top:12px"><span data-timershort="txn" style="font-size:34px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:#a05a00;line-height:1">09:13</span><span style="font-size:12px;color:#6f6b63"><span data-lang="en">hrs:min left</span><span data-lang="kn" style="display:none">ಗಂ:ನಿ ಉಳಿದಿದೆ</span></span></div>
            <div style="font-size:17px;font-weight:700;margin-top:10px;line-height:1.35"><span data-lang="en">Unauthorised bank transaction</span><span data-lang="kn" style="display:none">ಅನಧಿಕೃತ ಬ್ಯಾಂಕ್ ವಹಿವಾಟು</span></div>
            <div style="font-size:12px;color:#6f6b63;margin-top:2px">₹18,400 · <span data-lang="en">A/C ····4127</span><span data-lang="kn" style="display:none">ಖಾತೆ ····4127</span></div>
            <div style="position:relative;height:6px;border-radius:999px;background:#eeece7;margin-top:14px;overflow:hidden"><div style="position:absolute;inset:0 auto 0 0;width:87%;border-radius:999px;background:#a05a00"></div></div>
            <div style="display:flex;justify-content:space-between;font-size:12px;color:#6f6b63;margin-top:7px"><span><span data-lang="en">Due </span><span data-lang="kn" style="display:none">ಗಡುವು </span>31 JUL 07:18</span><span>0/4 <span data-lang="en">steps</span><span data-lang="kn" style="display:none">ಹಂತ</span></span></div>
          </div>
          <div style="background:#fff;border:1px solid #e9e7e2;border-radius:16px;padding:16px 18px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="font-size:12px;color:#6f6b63">AVD-0149 · PMFBY §21(2)</span><span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#1b5e3f;background:#e8f2ec;border-radius:999px;padding:4px 11px;white-space:nowrap"><span style="width:7px;height:7px;border-radius:50%;background:currentColor"></span><span data-lang="en">Open</span><span data-lang="kn" style="display:none">ಚಾಲ್ತಿ</span></span></div>
            <div style="display:flex;align-items:baseline;gap:8px;margin-top:12px"><span data-timershort="case" style="font-size:34px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:#1b5e3f;line-height:1">47:26</span><span style="font-size:12px;color:#6f6b63"><span data-lang="en">hrs:min left</span><span data-lang="kn" style="display:none">ಗಂ:ನಿ ಉಳಿದಿದೆ</span></span></div>
            <div style="font-size:17px;font-weight:700;margin-top:10px;line-height:1.35"><span data-lang="en">Crop insurance — hailstorm damage</span><span data-lang="kn" style="display:none">ಬೆಳೆ ವಿಮೆ — ಆಲಿಕಲ್ಲು ಹಾನಿ</span></div>
            <div style="font-size:12px;color:#6f6b63;margin-top:2px"><span data-lang="en">Cotton · ~2 acres</span><span data-lang="kn" style="display:none">ಹತ್ತಿ · ~2 ಎಕರೆ</span></div>
            <div style="position:relative;height:6px;border-radius:999px;background:#eeece7;margin-top:14px;overflow:hidden"><div style="position:absolute;inset:0 auto 0 0;width:34%;border-radius:999px;background:#1b5e3f"></div></div>
            <div style="display:flex;justify-content:space-between;font-size:12px;color:#6f6b63;margin-top:7px"><span><span data-lang="en">Due </span><span data-lang="kn" style="display:none">ಗಡುವು </span>01 AUG 21:26</span><span>1/5 <span data-lang="en">steps</span><span data-lang="kn" style="display:none">ಹಂತ</span></span></div>
          </div>
          <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,#f8f7f3 70%,rgba(248,247,243,0));padding:20px">
            <button style="width:100%;min-height:64px;background:#1c1c1a;color:#fff;border:none;border-radius:999px;display:flex;align-items:center;justify-content:center;gap:12px;padding:14px 20px;font-family:inherit;cursor:pointer" style-hover="background:#2e2d2a" id="enter-app-btn">
              <svg viewBox="0 0 24 24" width="22" height="22"><rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor"></rect><path d="M5 11a7 7 0 0 0 14 0" fill="none" stroke="currentColor" stroke-width="2"></path><line x1="12" y1="18" x2="12" y2="23" stroke="currentColor" stroke-width="2"></line></svg>
              <span style="text-align:left"><span style="display:block;font-size:17px;font-weight:700;line-height:1.25"><span data-lang="en">Report a loss</span><span data-lang="kn" style="display:none">ನಷ್ಟ ವರದಿ ಮಾಡಿ</span></span><span style="display:block;font-size:11px;opacity:.7;margin-top:1px"><span data-lang="en">Tap and speak — no reading needed</span><span data-lang="kn" style="display:none">ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ · Report a loss</span></span></span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
` }} />
  );
}

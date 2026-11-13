"use strict";
// The PIN gate screen, styled like the presentation (ivory page, thin type, glass keypad, accent dots).
//   inline gate  : injected into index.html of the ZIP / single-HTML exports. The viewer boots only after it opens. It is a gate, not security.
//   host gate    : a standalone page shown by the .exe launcher; the PIN goes to the launcher, which derives the decryption key.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

const CSS = (look) => `
#pin-gate{--pg-bg:${look.bg || "#F9F9F7"};--pg-acc:${look.accent || "#2FED97"};--pg-ink:#083438;position:fixed;inset:0;z-index:2147483000;background:var(--pg-bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;font-family:"Urbanist","Segoe UI",system-ui,sans-serif;color:var(--pg-ink);user-select:none;-webkit-user-select:none;transition:opacity .6s ease}
#pin-gate.out{opacity:0;pointer-events:none}
#pin-gate .pg-brand{display:flex;flex-direction:column;align-items:center;gap:14px}
#pin-gate .pg-brand img{height:56px;width:auto;display:block}
#pin-gate .pg-name{font-size:44px;font-weight:300;letter-spacing:-.03em;line-height:1}
#pin-gate .pg-sub{font-size:12px;letter-spacing:.26em;text-transform:uppercase;opacity:.62;font-weight:500}
#pin-gate .pg-dots{display:flex;gap:18px;height:18px}
#pin-gate .pg-dots i{width:14px;height:14px;border-radius:50%;border:1.5px solid var(--pg-ink);opacity:.5;transition:background .25s,opacity .25s,transform .25s,border-color .25s}
#pin-gate .pg-dots i.on{background:var(--pg-acc);border-color:var(--pg-acc);opacity:1;transform:scale(1.15);box-shadow:0 0 14px var(--pg-acc)}
#pin-gate.bad .pg-dots{animation:pgshake .45s}
#pin-gate.bad .pg-dots i{border-color:#c0392b;background:#c0392b;opacity:1}
@keyframes pgshake{20%{transform:translateX(-10px)}40%{transform:translateX(9px)}60%{transform:translateX(-6px)}80%{transform:translateX(4px)}}
#pin-gate .pg-pad{display:grid;grid-template-columns:repeat(3,76px);gap:14px}
#pin-gate .pg-pad button{width:76px;height:76px;border-radius:50%;border:1px solid rgba(255,255,255,.75);background:rgba(255,255,255,.55);-webkit-backdrop-filter:blur(14px) saturate(1.3);backdrop-filter:blur(14px) saturate(1.3);box-shadow:0 14px 34px -16px rgba(8,52,56,.35);color:var(--pg-ink);font:300 30px "Urbanist","Segoe UI",system-ui,sans-serif;cursor:pointer;transition:background .2s,transform .2s,box-shadow .2s}
#pin-gate .pg-pad button:hover{background:var(--pg-acc);transform:scale(1.06)}
#pin-gate .pg-pad button:active{transform:scale(.96)}
#pin-gate .pg-pad button.pg-x{background:none;border-color:transparent;box-shadow:none;font-size:22px;opacity:.6}
#pin-gate .pg-msg{height:16px;font-size:12px;letter-spacing:.12em;opacity:.7}
@media (pointer:coarse){#pin-gate .pg-pad{grid-template-columns:repeat(3,92px);gap:18px}#pin-gate .pg-pad button{width:92px;height:92px;font-size:36px}}
`;

const SHA = `function sha256(s){var b=[],i,j;s=unescape(encodeURIComponent(s));for(i=0;i<s.length;i++)b.push(s.charCodeAt(i));var K=[],H=[],p=2,n=0;while(n<64){var pr=true;for(i=2;i*i<=p;i++)if(p%i===0){pr=false;break}if(pr){if(n<8)H[n]=(Math.pow(p,.5)%1)*4294967296|0;K[n++]=(Math.pow(p,1/3)%1)*4294967296|0}p++}var l=b.length*8;b.push(128);while(b.length%64!==56)b.push(0);for(i=7;i>=0;i--)b.push(i>3?0:(l>>>(i*8))&255);var w=[];for(var o=0;o<b.length;o+=64){for(i=0;i<16;i++)w[i]=(b[o+i*4]<<24)|(b[o+i*4+1]<<16)|(b[o+i*4+2]<<8)|b[o+i*4+3];for(i=16;i<64;i++){var a0=w[i-15],a1=w[i-2],s0=((a0>>>7)|(a0<<25))^((a0>>>18)|(a0<<14))^(a0>>>3),s1=((a1>>>17)|(a1<<15))^((a1>>>19)|(a1<<13))^(a1>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)|0}var h=H.slice(),a=h[0],bb=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];for(i=0;i<64;i++){var S1=((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7)),ch=(e&f)^(~e&g),t1=(hh+S1+ch+K[i]+w[i])|0,S0=((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10)),mj=(a&bb)^(a&c)^(bb&c),t2=(S0+mj)|0;hh=g;g=f;f=e;e=(d+t1)|0;d=c;c=bb;bb=a;a=(t1+t2)|0}H[0]=(H[0]+a)|0;H[1]=(H[1]+bb)|0;H[2]=(H[2]+c)|0;H[3]=(H[3]+d)|0;H[4]=(H[4]+e)|0;H[5]=(H[5]+f)|0;H[6]=(H[6]+g)|0;H[7]=(H[7]+hh)|0}var r="";for(i=0;i<8;i++)r+=("00000000"+(H[i]>>>0).toString(16)).slice(-8);return r}`;

const gateJs = (cfg) => `(function(){
${cfg.host ? "" : SHA}
var HOST=${cfg.host ? "true" : "false"},SALT=${JSON.stringify(cfg.salt || "")},HASH=${JSON.stringify(cfg.hash || "")};
var g=document.getElementById("pin-gate"),dots=g.querySelectorAll(".pg-dots i"),msg=g.querySelector(".pg-msg"),pin="",busy=false,done;
${cfg.host ? "" : "window.__GATE=new Promise(function(r){done=r});"}
function paint(){for(var i=0;i<4;i++)dots[i].classList.toggle("on",i<pin.length)}
function bad(){g.classList.add("bad");msg.textContent="Incorrect PIN";setTimeout(function(){g.classList.remove("bad");pin="";busy=false;paint();msg.textContent=""},620)}
function open(){g.classList.add("out");setTimeout(function(){if(g.parentNode)g.parentNode.removeChild(g)},700);if(done)done()}
function submit(){busy=true;if(HOST){window.chrome.webview.postMessage("pin:"+pin)}else{if(sha256(SALT+":"+pin)===HASH)open();else bad()}}
function press(k){if(busy)return;if(k==="x"){pin=pin.slice(0,-1);paint();return}if(pin.length>=4)return;pin+=k;paint();if(pin.length===4)setTimeout(submit,140)}
g.querySelectorAll("button[data-k]").forEach(function(b){b.addEventListener("click",function(){press(b.getAttribute("data-k"))})});
document.addEventListener("keydown",function(e){if(!document.getElementById("pin-gate"))return;if(/^[0-9]$/.test(e.key))press(e.key);else if(e.key==="Backspace")press("x")},true);
if(HOST)window.chrome.webview.addEventListener("message",function(e){if(e.data==="bad")bad();else if(e.data==="ok")open()});
})();`;

function markup(name, logoDataUri) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(k => `<button type="button" data-k="${k}">${k}</button>`).join("");
  return `<div id="pin-gate" role="dialog" aria-label="PIN"><div class="pg-brand">${logoDataUri ? `<img src="${logoDataUri}" alt="${esc(name)}">` : `<div class="pg-name">${esc(name)}</div>`}<div class="pg-sub">Enter PIN</div></div>` +
    `<div class="pg-dots"><i></i><i></i><i></i><i></i></div><div class="pg-pad">${keys}<span></span><button type="button" data-k="0">0</button><button type="button" class="pg-x" data-k="x" aria-label="Delete">&#9003;</button></div><div class="pg-msg"></div></div>`;
}

/** Fresh salt + SHA-256(salt:pin) for the inline gate. */
function pinHash(pin) {
  const salt = crypto.randomBytes(8).toString("hex");
  return { salt, hash: crypto.createHash("sha256").update(salt + ":" + pin).digest("hex") };
}

/** Insert the inline gate into a compiled index.html string. */
function injectGate(indexHtml, o) {
  const h = pinHash(o.pin);
  const block = `<style>${CSS(o.look || {})}</style>\n${markup(o.name, o.logoDataUri)}\n<script>${gateJs({ salt: h.salt, hash: h.hash })}</script>`;
  const out = indexHtml.replace(/(<body[^>]*>)/, "$1\n" + block);
  if (out === indexHtml) throw new Error("index.html has no <body>");
  return out;
}

/** Standalone page for the exe launcher (fonts embedded as data URIs; the logo too). */
function hostPage(o) {
  const fontDir = path.join(__dirname, "..", "runtime", "vendor", "fonts");
  const face = (w) => {
    const f = path.join(fontDir, "urbanist-latin-" + w + "-normal.woff2");
    return fs.existsSync(f) ? `@font-face{font-family:"Urbanist";font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(f).toString("base64")}) format("woff2")}` : "";
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.name)}</title><style>html,body{margin:0;height:100%;background:${(o.look && o.look.bg) || "#F9F9F7"}}${face(300)}${face(500)}${CSS(o.look || {})}</style></head><body>${markup(o.name, o.logoDataUri)}<script>${gateJs({ host: true })}</script></body></html>`;
}

module.exports = { injectGate, hostPage, pinHash, SHA };

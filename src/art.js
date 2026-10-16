import { random } from './math.js';

/** Original vector foreground. These out-of-focus leaves frame, but never cover, the 3D scene. */
export function foregroundArt(id) {
  return `<svg viewBox="0 0 360 360" xmlns="http://www.w3.org/2000/svg"><defs>
    <linearGradient id="leaf-${id}" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#123d2c"/><stop offset=".55" stop-color="#376f30"/><stop offset="1" stop-color="#aac965"/></linearGradient>
    <linearGradient id="young-${id}"><stop stop-color="#286537"/><stop offset="1" stop-color="#b5d976"/></linearGradient>
  </defs><g fill="none" stroke="#3a643d" stroke-width="3"><path d="M43 382Q82 218 141 56"/><path d="M61 301Q174 267 290 175"/></g>
  <g fill="url(#leaf-${id})"><path d="M75 282C-18 273 3 201 8 179C39 175 91 213 75 282Z"/><path d="M77 280C91 202 167 204 190 209C181 244 139 288 77 280Z"/><path d="M105 190C34 167 45 96 51 75C84 88 120 126 105 190Z"/><path d="M117 150C131 94 176 75 207 80C202 119 166 155 117 150Z"/><path d="M151 267C152 217 190 176 213 166C232 207 205 256 151 267Z"/><path d="M161 261C213 267 257 290 258 329C209 333 170 303 161 261Z"/><path d="M44 346C-4 320 -16 281 -6 263C39 276 58 304 44 346Z"/></g>
  <g fill="url(#young-${id})"><path d="M139 77C123 37 139 5 160 -15C179 20 164 55 139 77Z"/><path d="M244 218C246 174 278 136 310 130C319 170 286 202 244 218Z"/><path d="M238 219C273 214 315 228 329 256C292 270 255 250 238 219Z"/></g>
  <g fill="none" stroke="#94b067" stroke-width="1" opacity=".4"><path d="M75 282L21 201M77 280L175 218M105 190L56 90M117 150L192 89M151 267L208 181M161 261L245 316M139 77L157 3M244 218L302 145"/></g></svg>`;
}

/** Static fallback uses our own SVG, never the supplied promotional image or a remote photo. */
export function posterArt() {
  const r = random(719);
  let forest = '';
  for (let i = 0; i < 95; i++) {
    const right = i < 56;
    const x = right ? 870 + r() * 700 : r() * 680 - 40;
    const y = right ? 603 - (x - 870) * .085 + r() * 12 : 605 + r() * 14;
    const h = right ? 60 + (x - 870) * .12 + r() * 35 : 22 + r() * 45;
    const rad = right ? 25 + r() * 27 : 15 + r() * 19;
    forest += `<g><path d="M${x} ${y + 29}Q${x - 4} ${y - h * .2} ${x + 4} ${y - h * .5}M${x + 1} ${y - 5}Q${x + 12} ${y + 5} ${x + 20} ${y + 28}M${x} ${y - 9}Q${x - 12} ${y + 5} ${x - 18} ${y + 26}" fill="none" stroke="#62705c" stroke-width="3"/>`;
    for (let j = 0; j < 9; j++) {
      const xx = x + (r() - .5) * rad * 2;
      const yy = y - h * .63 + (r() - .5) * rad;
      forest += `<ellipse cx="${xx}" cy="${yy}" rx="${rad * (.45 + r() * .5)}" ry="${rad * (.35 + r() * .5)}" fill="hsl(${90 + r() * 45} 29% ${28 + r() * 22}%)"/>`;
    }
    forest += '</g>';
  }
  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="psky" x2="0" y2="1"><stop stop-color="#9fd4ea"/><stop offset="1" stop-color="#edfafa"/></linearGradient><linearGradient id="pwater" x2="0" y2="1"><stop stop-color="#cce7e7"/><stop offset="1" stop-color="#599a9f"/></linearGradient><filter id="pblur"><feGaussianBlur stdDeviation="22"/></filter><filter id="preflect"><feGaussianBlur stdDeviation="1.7 3"/></filter><g id="pforest">${forest}</g></defs><path fill="url(#psky)" d="M0 0h1600v900H0z"/><g filter="url(#pblur)" fill="#fff" opacity=".65"><ellipse cx="420" cy="170" rx="350" ry="95"/><ellipse cx="1150" cy="70" rx="270" ry="95"/></g><path fill="url(#pwater)" d="M0 622h1600v278H0z"/><use href="#pforest" transform="translate(0 1250) scale(1 -1)" opacity=".36" filter="url(#preflect)"/><use href="#pforest"/><g stroke="#e9ffff" opacity=".35">${Array.from({length: 38}, (_, i) => `<path d="M${r()*900} ${646+i*7}h${80+r()*650}"/>`).join('')}</g></svg>`;
}

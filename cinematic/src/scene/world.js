import { add, sub, scale, cross, normalize, mix, seededRandom, quatFromEuler } from '../lib/math.js';

export const QUALITY = Object.freeze({
  low: { density: 0.30, pixelRatio: 1, reflection: 384, shadow: 1024 },
  high: { density: 0.8, pixelRatio: 1.4, reflection: 768, shadow: 2048 },
});

/** Original procedural geometry: no downloaded models, images, or runtime CDNs. */
export function createWorld(quality = 'high') {
  const density = (QUALITY[quality] || QUALITY.high).density;
  const random = seededRandom(73129);
  const wood = [], leaves = [];
  const rand = (a, b) => mix(a, b, random());
  let treeCount = 0;
  const vertex = (p, n, c) => wood.push(...p, ...n, ...c);

  function tube(points, r0, r1, color, sides = 7) {
    const rings = [];
    points.forEach((p, i) => {
      const tangent = normalize(sub(points[Math.min(i + 1, points.length - 1)], points[Math.max(0, i - 1)]));
      const u = normalize(cross(tangent, Math.abs(tangent[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0]));
      const v = cross(tangent, u);
      const radius = mix(r0, r1, i / (points.length - 1));
      const ring = [];
      for (let j = 0; j < sides; j++) {
        const a = j / sides * Math.PI * 2;
        const n = add(scale(u, Math.cos(a)), scale(v, Math.sin(a)));
        const ridge = 1 + 0.10 * Math.sin(j * 5.3 + i * 0.5);
        ring.push({ p: add(p, scale(n, radius * ridge)), n });
      }
      rings.push(ring);
    });
    for (let i = 1; i < rings.length; i++) {
      for (let j = 0; j < sides; j++) {
        const k = (j + 1) % sides;
        const col = color.map(v => v * (0.87 + 0.15 * Math.sin(j * 4.1)));
        for (const q of [rings[i-1][j], rings[i][j], rings[i][k], rings[i-1][j], rings[i][k], rings[i-1][k]]) vertex(q.p, q.n, col);
      }
    }
  }

  function curvedTube(a, b, c, r0, r1, color) {
    const points = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      points.push(a.map((v, k) => (1-t)*(1-t)*v + 2*(1-t)*t*b[k] + t*t*c[k]));
    }
    tube(points, r0, r1, color);
  }

  function leaf(p, size, color, shade, angles) {
    // Instance: position.xyz, size, quaternion.xyzw, color.rgb, canopy AO.
    leaves.push(...p, size, ...quatFromEuler(...angles), ...color, shade);
  }

  function tree(x, z, height, spread, richness = 1) {
    treeCount++;
    const bark = [rand(.32,.43), rand(.31,.39), rand(.24,.29)];
    const lean = [rand(-.55,.55), 0, rand(-.5,.5)];
    const base = [x, .18, z];
    const fork = [x + lean[0], height * .32, z + lean[2]];
    curvedTube([x,.2,z], [x-.15,height*.27,z+.22], fork, height*.031, height*.017, bark);

    // Buttressed, arching stilt roots are the defining mangrove silhouette.
    const roots = Math.floor(rand(7, 11));
    for (let i = 0; i < roots; i++) {
      const angle = i / roots * Math.PI*2 + rand(-.24,.24);
      const reach = spread * rand(.65,1.16);
      const foot = [x + Math.cos(angle)*reach, -.26, z + Math.sin(angle)*reach];
      const start = [x + lean[0]*.25, rand(1.3,2.4) * height/8, z + lean[2]*.3];
      const bend = [x + Math.cos(angle)*reach*.61, start[1]*.79, z + Math.sin(angle)*reach*.61];
      curvedTube(start, bend, foot, height*.014, height*.0045, bark);
      if (i % 2 === 0) {
        const split = add(scale(start,.23), scale(bend,.77));
        const side = [foot[0] + rand(-.65,.65), -.2, foot[2] + rand(-.65,.65)];
        curvedTube(split, [side[0], .7, side[2]], side, height*.011, .027, bark);
      }
    }

    const lobes = Math.floor(rand(8,11));
    for (let branch = 0; branch < lobes; branch++) {
      const angle = branch / lobes * Math.PI*2 + rand(-.35,.35);
      const reach = spread * rand(.38,.8);
      const center = [x + Math.cos(angle)*reach, height * rand(.65,1.02), z + Math.sin(angle)*reach];
      const bend = [mix(fork[0],center[0],.45), height*.59, mix(fork[2],center[2],.45)];
      curvedTube(fork, bend, center, height*.016, .025, bark);
      const radius = spread * rand(.50,.76);
      const count = Math.round((150 + radius*64) * density * richness);
      for (let j = 0; j < count; j++) {
        const theta = rand(0,Math.PI*2);
        const vertical = rand(-1,1);
        const rr = Math.sqrt(1-vertical*vertical);
        const shell = Math.cbrt(random()) * radius;
        const p = [center[0] + Math.cos(theta)*rr*shell, center[1] + vertical*shell*.96, center[2] + Math.sin(theta)*rr*shell];
        const light = rand(.0,1);
        const color = [mix(.16,.48,light), mix(.30,.57,light), mix(.095,.17,light)];
        const shade = .50 + .42*(vertical+1)/2 + rand(-.10,.07);
        const size = rand(.25,.44) * (quality === 'low' ? 1.45 : 1);
        leaf(p, size, color, shade, [rand(-1.5,1.5), theta, rand(-1.5,1.5)]);
      }
    }
    return base;
  }

  const bankX = z => 12.5 + (12-z)*.145 + Math.sin(z*.065)*2.1;
  // Keep the centre and sky clear.
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 19; i++) {
      const z = 5 - i*7.6 + rand(-2,2) - row*3;
      const x = bankX(z) + row*5.4 + rand(-1,1);
      tree(x, z, rand(6.4,8.5) + row*.5, rand(2.5,3.5), i > 12 ? .68 : 1);
    }
  }
  for (let i = 0; i < 24; i++) {
    const z = -27 - i*6.1;
    const x = -48 - i*.17 + rand(-2,1);
    tree(x,z,rand(5.3,7.3),rand(2.5,3.4),.70);
  }
  for (let i = 0; i < 31; i++) {
    const x = -96 + i*6.3;
    tree(x,-185 + Math.sin(i*.8)*12,rand(5,8),rand(3.2,4.2),.50);
  }

  function terrain(side) {
    for (let z = 14; z > -175; z -= 4) {
      const edge = zz => side > 0 ? bankX(zz)-2.1 : -48 - (-27-zz)*.035;
      if (side < 0 && z > -37) continue;
      const p = [[edge(z),-.1,z],[edge(z)+side*23,.21,z],[edge(z-4),-.1,z-4],[edge(z-4)+side*23,.21,z-4]];
      const color = [.39,.40,.33];
      for (const index of [0,1,2,1,3,2]) vertex(p[index],[0,1,0],color);
    }
  }
  terrain(1); terrain(-1);

  curvedTube([-6.2,-1,22],[-5.8,1.1,22],[-4.2,1.2,21],.055,.018,[.25,.31,.18]);
  for (let i = 0; i < 18; i++) {
    const t = i / 18;
    leaf([-5.7+t*1.5 + rand(-.6,.3), .5 + Math.sin(t*3)*.75 + rand(-.2,.25), 21+rand(-.7,.7)],rand(.46,.8),[.24,.43,.11],.72,[rand(-.8,.5),rand(0,6.28),rand(-.9,.9)]);
  }
  return { wood: new Float32Array(wood), leaves: new Float32Array(leaves), treeCount, leafCount: leaves.length / 12 };
}

/** Curved, almond-shaped leaf, including a raised central rib. */
export function createLeafGeometry() {
  const vertices = [];
  const rows = 4;
  const p = (i,j) => {
    const t = i/rows;
    const width = Math.pow(Math.sin(Math.PI*t),.85)*.29;
    return [width*j, Math.sin(t*Math.PI)*.11 - Math.abs(j)*.065, t-.42];
  };
  for (let i=0;i<rows;i++) {
    for (let j=-1;j<1;j++) {
      const a=p(i,j), b=p(i+1,j), c=p(i,j+1), d=p(i+1,j+1);
      for (const tri of [[a,b,c],[b,d,c]]) {
        for (const v of tri) {
          const smooth = normalize([Math.sign(v[0])*.22, 1, -Math.cos((v[2]+.42)*Math.PI)*.34]);
          vertices.push(...v,...smooth);
        }
      }
    }
  }
  return new Float32Array(vertices);
}

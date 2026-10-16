import { random, normalize, cross, sub, quaternion } from './math.js';

/** Original procedural mangroves: curved prop roots, branching trunks and individual curved leaves. */
export function makeForest(density = 1) {
  const rng = random(42071);
  const rand = (a, b) => a + (b - a) * rng();
  const bark = [];
  const leaves = [];
  const trees = [];

  function tube(points, radius, endRadius, color, segments = 9, sides = 6) {
    const rings = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments, s = 1 - t;
      const p = [0, 1, 2].map(k => s ** 3 * points[0][k] + 3 * s * s * t * points[1][k] + 3 * s * t * t * points[2][k] + t ** 3 * points[3][k]);
      const tangent = normalize([0, 1, 2].map(k => 3 * s * s * (points[1][k] - points[0][k]) + 6 * s * t * (points[2][k] - points[1][k]) + 3 * t * t * (points[3][k] - points[2][k])));
      const axis = normalize(cross(tangent, Math.abs(tangent[1]) > .95 ? [1, 0, 0] : [0, 1, 0]));
      const axis2 = cross(tangent, axis);
      const r = radius * (1 - t) + endRadius * t;
      const ring = [];
      for (let j = 0; j < sides; j++) {
        const a = j / sides * Math.PI * 2;
        const n = axis.map((v, k) => v * Math.cos(a) + axis2[k] * Math.sin(a));
        ring.push([...p.map((v, k) => v + n[k] * r), ...n, ...color]);
      }
      rings.push(ring);
    }
    for (let i = 0; i < segments; i++) for (let j = 0; j < sides; j++) {
      const a = rings[i][j], b = rings[i + 1][j], c = rings[i][(j + 1) % sides], d = rings[i + 1][(j + 1) % sides];
      bark.push(...a, ...b, ...c, ...b, ...d, ...c);
    }
  }

  function tree(x, z, height, width, detailed = true) {
    const lean = [rand(-.45, .45), rand(-.4, .4)];
    const trunkTop = [x + lean[0], height * .68, z + lean[1]];
    const trunkRadius = height * rand(.021, .031);
    const gray = rand(.85, 1.15);
    const wood = [.37 * gray, .36 * gray, .285 * gray];
    tube([[x, -.36, z], [x - .12, height * .18, z + .15], [x + lean[0] * .5, height * .43, z + lean[1]], trunkTop], trunkRadius * 1.16, trunkRadius * .47, wood, 9, detailed ? 8 : 5);
    const rootCount = detailed ? 9 : 5;
    for (let r = 0; r < rootCount; r++) {
      const a = r / rootCount * Math.PI * 2 + rand(-.25, .25);
      const spread = width * rand(.5, .9);
      const rx = Math.cos(a), rz = Math.sin(a);
      const attachment = height * rand(.19, .39);
      tube([[x + lean[0] * .2, attachment, z], [x + rx * spread * .55, attachment * .92, z + rz * spread * .55], [x + rx * spread * .85, .65, z + rz * spread * .85], [x + rx * spread, -.4, z + rz * spread]], trunkRadius * rand(.28, .47), .027 * height / 7, wood, detailed ? 9 : 5, detailed ? 6 : 4);
    }
    // A crown consists of separate asymmetrical branch-tip clusters, not a sphere.
    const clusterCount = detailed ? 23 : 14;
    for (let j = 0; j < clusterCount; j++) {
      const a = j * 2.399963 + rand(-.45, .45);
      const level = Math.sqrt(rand(.05, 1));
      const spread = width * level * .83;
      const center = [x + Math.cos(a) * spread + lean[0], height * (.65 + .25 * (1 - level)) + rand(-.4, .4), z + Math.sin(a) * spread + lean[1]];
      if (j < (detailed ? 13 : 6)) {
        const start = [x + lean[0] * .5, height * rand(.39, .58), z + lean[1] * .5];
        tube([start, [x + (center[0] - x) * .45, height * .59, z + (center[2] - z) * .45], [center[0] * .65 + x * .35, center[1] - .28, center[2] * .65 + z * .35], center], trunkRadius * .37, .028, wood, 6, 5);
      }
      const clumpRadius = width * rand(.3, .47);
      const count = Math.round((detailed ? 100 : 48) * density);
      for (let l = 0; l < count; l++) {
        const az = rand(0, Math.PI * 2), yy = rand(-1, 1), rr = Math.cbrt(rng());
        const ring = Math.sqrt(1 - yy * yy);
        const p = [center[0] + Math.cos(az) * ring * clumpRadius * rr, center[1] + yy * clumpRadius * .91 * rr, center[2] + Math.sin(az) * ring * clumpRadius * rr];
        const scale = rand(.33, .61) * (detailed ? 1 : 1.1) / Math.pow(density, .21);
        const q = quaternion(rand(-.85, .85), rand(0, Math.PI * 2), rand(-.55, .55));
        const outer = .72 + .28 * rr;
        const light = rand(.68, 1.22) * outer * (1 + yy * .11);
        const young = rng() > .82;
        const color = young ? [.39 * light, .49 * light, .115 * light] : [.14 * light, .335 * light, .082 * light];
        leaves.push(...p, scale, ...q, ...color, rand(0, Math.PI * 2));
      }
    }
    trees.push({ x, z, height });
  }

  // Right bank approaches the viewer; the left bank stays distant, leaving a broad luminous channel.
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 19; i++) {
      const z = 1 - i * 7.2 + rand(-2, 2) - row * 1.3;
      const x = 13.7 + Math.max(0, -z) * .105 + row * 5.9 + rand(-1, 1.8);
      tree(x, z, rand(i < 3 ? 8.2 : 6.4, i < 3 ? 11.0 : 9.7) * (row ? 1.03 : 1), rand(2.1, 3.4), i < 9);
    }
  }
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 22; i++) {
      const z = -43 - i * 6.6 + rand(-2, 2);
      const x = -25 - row * 5 - Math.max(0, -z - 60) * .09 + rand(-2, 2);
      tree(x, z, rand(5.2, 8.5), rand(2.0, 3.3), false);
    }
  }
  // Carry the distant left shore beyond the frame rather than ending it as a neat island.
  for (let i = 0; i < 14; i++) {
    tree(-36 - i * 5.1, -45 + rand(-8, 5), rand(6.2, 9.0), rand(2.7, 4.1), false);
  }
  for (let i = 0; i < 27; i++) {
    tree(-78 + i * 6.8, -218 + rand(-7, 7), rand(7, 12), rand(3.3, 4.8), false);
  }

  // Curved, pointed leaf with a raised midrib. Geometry is shared by all instances.
  const leafVertices = [], leafIndices = [];
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const w = Math.max(.008, Math.pow(Math.sin(t * Math.PI), .8) * .28);
    for (let side = -1; side <= 1; side++) {
      const x = side * w;
      const y = Math.sin(t * Math.PI) * .085 - Math.abs(side) * w * .28;
      const n = normalize([side * .28, 1, -Math.cos(t * Math.PI) * .18]);
      leafVertices.push(x, y, t - .3, ...n, (side + 1) / 2, t);
    }
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < 2; j++) {
    const a = i * 3 + j, b = a + 3;
    leafIndices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  return {
    bark: new Float32Array(bark),
    leaves: new Float32Array(leaves),
    leafVertices: new Float32Array(leafVertices),
    leafIndices: new Uint16Array(leafIndices),
    treeCount: trees.length,
    leafCount: leaves.length / 12,
  };
}

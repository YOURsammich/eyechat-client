import { useRef, useEffect } from 'react';

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;
uniform float u_time;
uniform vec2 u_res;
uniform vec2 u_mouse;
uniform float u_palette;

float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i),                  hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = rot * p * 2.1 + vec2(100.0);
    a *= 0.5;
  }
  return v;
}

vec3 hardPalette(float t) {
  t = fract(t);
  float idx = t * 5.0;
  float f = fract(idx);
  f = f * f * (3.0 - 2.0 * f);
  if (u_palette < 0.5) {
    if (idx < 1.0) return mix(vec3(0.58, 0.0,  0.82), vec3(0.92, 0.1,  0.15), f);
    if (idx < 2.0) return mix(vec3(0.92, 0.1,  0.15), vec3(0.95, 0.72, 0.05), f);
    if (idx < 3.0) return mix(vec3(0.95, 0.72, 0.05), vec3(0.05, 0.68, 0.22), f);
    if (idx < 4.0) return mix(vec3(0.05, 0.68, 0.22), vec3(0.08, 0.22, 0.92), f);
    return             mix(vec3(0.08, 0.22, 0.92), vec3(0.58, 0.0,  0.82), f);
  }
  if (u_palette < 1.5) {
    if (idx < 1.0) return mix(vec3(0.1,  0.0,  0.0),  vec3(0.8,  0.1,  0.0),  f);
    if (idx < 2.0) return mix(vec3(0.8,  0.1,  0.0),  vec3(1.0,  0.5,  0.0),  f);
    if (idx < 3.0) return mix(vec3(1.0,  0.5,  0.0),  vec3(1.0,  0.9,  0.2),  f);
    if (idx < 4.0) return mix(vec3(1.0,  0.9,  0.2),  vec3(1.0,  1.0,  0.8),  f);
    return             mix(vec3(1.0,  1.0,  0.8),  vec3(0.1,  0.0,  0.0),  f);
  }
  if (u_palette < 2.5) {
    if (idx < 1.0) return mix(vec3(0.0,  0.05, 0.2),  vec3(0.0,  0.3,  0.6),  f);
    if (idx < 2.0) return mix(vec3(0.0,  0.3,  0.6),  vec3(0.0,  0.7,  0.8),  f);
    if (idx < 3.0) return mix(vec3(0.0,  0.7,  0.8),  vec3(0.2,  0.9,  0.9),  f);
    if (idx < 4.0) return mix(vec3(0.2,  0.9,  0.9),  vec3(0.0,  0.5,  0.7),  f);
    return             mix(vec3(0.0,  0.5,  0.7),  vec3(0.0,  0.05, 0.2),  f);
  }
  if (idx < 1.0) return mix(vec3(0.0,  1.0,  0.2),  vec3(0.8,  1.0,  0.0),  f);
  if (idx < 2.0) return mix(vec3(0.8,  1.0,  0.0),  vec3(0.6,  0.0,  0.9),  f);
  if (idx < 3.0) return mix(vec3(0.6,  0.0,  0.9),  vec3(0.0,  0.9,  0.9),  f);
  if (idx < 4.0) return mix(vec3(0.0,  0.9,  0.9),  vec3(0.5,  1.0,  0.0),  f);
  return             mix(vec3(0.5,  1.0,  0.0),  vec3(0.0,  1.0,  0.2),  f);
}

vec3 cosineColor(float t) {
  vec3 a = vec3(0.5);
  vec3 b = vec3(0.5);
  vec3 c = vec3(1.0, 1.0, 0.5);
  vec3 d = vec3(0.0, 0.33, 0.67);
  return a + b * cos(6.28318 * (c * t + d + u_time * 0.008));
}

vec3 hsvColor(float t) {
  float h = fract(t + u_time * 0.04);
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(vec3(h) + K.xyz) * 6.0 - K.www);
  return 0.85 * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), 0.9);
}

float plasmaVal(vec2 uv) {
  float tt = u_time * 0.6;
  float v  = sin(uv.x * 8.0 + tt * 1.7);
  v += sin(uv.y * 6.0 + tt * 1.3);
  v += sin((uv.x + uv.y) * 5.0 + tt);
  v += sin(length(uv - 0.5) * 9.0 + tt * 1.5);
  return v * 0.25 + 0.5;
}

float voronoiVal(vec2 uv) {
  vec2 p = uv * 6.0;
  vec2 i = floor(p);
  vec2 f = fract(p);
  float minDist = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 nb = vec2(float(x), float(y));
      vec2 pt = hash2(i + nb);
      pt = 0.5 + 0.5 * sin(u_time * 0.25 + 6.28318 * pt);
      float dist = length(nb + pt - f);
      minDist = min(minDist, dist);
    }
  }
  return minDist;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;

  vec2 dm = uv - u_mouse;
  float md = dot(dm, dm);
  uv += dm * 0.06 / (md + 0.03);

  float t = u_time * 0.055;
  vec3 col;

  if (u_palette > 6.5) {
    col = cosineColor(voronoiVal(uv) + u_time * 0.03);

  } else if (u_palette > 5.5) {
    col = cosineColor(plasmaVal(uv));

  } else {
    vec2 q = vec2(
      fbm(uv * 3.0 + t),
      fbm(uv * 3.0 + vec2(5.2, 1.3) + t)
    );
    vec2 r = vec2(
      fbm(uv * 3.0 + 7.0 * q + vec2(1.7, 9.2) + 0.15 * t),
      fbm(uv * 3.0 + 7.0 * q + vec2(8.3, 2.8) + 0.126 * t)
    );
    vec2 s = vec2(
      fbm(uv * 3.0 + 7.0 * r + vec2(3.1, 4.7) + 0.2 * t),
      fbm(uv * 3.0 + 7.0 * r + vec2(7.2, 6.1) + 0.18 * t)
    );
    float f = fbm(uv * 3.0 + 7.0 * s);
    float ct = f + 0.12 * t;

    if (u_palette < 3.5) {
      col = hardPalette(ct);
    } else if (u_palette < 4.5) {
      col = cosineColor(ct);
    } else {
      col = hsvColor(f);
    }
  }

  col *= 0.75;
  gl_FragColor = vec4(col, 1.0);
}
`;

function compileShader(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  return shader;
}

function FluidBackground({ palette = 0 }) {
  const canvasRef = useRef(null);
  const paletteRef = useRef(palette);

  useEffect(() => {
    paletteRef.current = palette;
  }, [palette]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1,
    ]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const timeLoc    = gl.getUniformLocation(prog, 'u_time');
    const resLoc     = gl.getUniformLocation(prog, 'u_res');
    const mouseLoc   = gl.getUniformLocation(prog, 'u_mouse');
    const paletteLoc = gl.getUniformLocation(prog, 'u_palette');

    let mouseX = 0.5, mouseY = 0.5;
    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = (e.clientX - rect.left) / rect.width;
      mouseY = 1.0 - (e.clientY - rect.top) / rect.height;
    };
    canvas.addEventListener('mousemove', onMouseMove);

    const start = performance.now();
    let animId;

    function resize() {
      canvas.width  = Math.max(1, Math.floor(canvas.offsetWidth  / 2));
      canvas.height = Math.max(1, Math.floor(canvas.offsetHeight / 2));
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function draw() {
      gl.uniform1f(timeLoc, (performance.now() - start) / 1000);
      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.uniform2f(mouseLoc, mouseX, mouseY);
      gl.uniform1f(paletteLoc, paletteRef.current);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animId = requestAnimationFrame(draw);
    }

    resize();
    animId = requestAnimationFrame(draw);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      canvas.removeEventListener('mousemove', onMouseMove);
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'auto' }}
    />
  );
}

export default FluidBackground;

import React, { useEffect, useMemo, useRef } from "react";

// WebGL plasma background (converted from the supplied TSX component; the shader is unchanged).
// Additions: `maxPixelRatio` (render resolution cap), a single still frame when the OS asks for
// reduced motion, and listener cleanup on every early exit.

const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_isDark;
uniform float u_speed;
uniform float u_turbulence;
uniform float u_mouseInfluence;
uniform float u_grain;
uniform float u_sparkle;
uniform float u_vignette;
uniform float u_opacity;

uniform vec3 u_darkA;
uniform vec3 u_darkB;
uniform vec3 u_darkC;
uniform vec3 u_lightA;
uniform vec3 u_lightB;
uniform vec3 u_lightC;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p, float turbulence) {
  float total = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  mat2 rot = mat2(cos(0.45), sin(0.45), -sin(0.45), cos(0.45));
  for (int i = 0; i < 5; i++) {
    total += snoise(p * freq) * amp;
    p = rot * p;
    freq *= mix(1.85, 2.35, clamp(turbulence, 0.0, 2.0) * 0.5);
    amp *= 0.5;
  }
  return total;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float t = u_time * (0.15 * u_speed);

  vec2 mouse = (u_mouse - 0.5) * vec2(aspect, 1.0);
  float dMouse = length(p - mouse);
  p += (mouse - p) * 0.02 * u_mouseInfluence * smoothstep(0.45, 0.0, dMouse);

  vec2 flow = vec2(
    fbm(p + vec2(t * 0.2, t * 0.1), u_turbulence),
    fbm(p + vec2(-t * 0.1, t * 0.3), u_turbulence)
  );

  float n = fbm(p * 2.0 + flow * 1.45, u_turbulence);
  float ridges = 1.0 - abs(snoise(p * 4.0 + n) * 2.0);
  ridges = pow(ridges, 3.0);

  vec3 colorA = mix(u_lightA, u_darkA, u_isDark);
  vec3 colorB = mix(u_lightB, u_darkB, u_isDark);
  vec3 colorC = mix(u_lightC, u_darkC, u_isDark);

  vec3 col = mix(colorA, colorB, smoothstep(-0.5, 0.5, n));
  col = mix(col, colorC, smoothstep(0.25, 1.0, n * 0.52 + ridges * 0.48));

  float sparkle = pow(max(0.0, snoise(gl_FragCoord.xy * 0.2 + t * 2.0)), 18.0) * 0.5 * u_sparkle;
  vec3 sparkleColor = mix(vec3(0.56, 0.58, 0.72), vec3(0.8, 0.9, 1.0), u_isDark);
  col += sparkleColor * sparkle;

  float vigDark = 1.0 - smoothstep(0.5, mix(1.8, 1.55, u_isDark), length(p));
  col = mix(col, col * vigDark, u_isDark * u_vignette);
  float vigLight = 1.0 - smoothstep(0.4, 1.45, length(p));
  col = mix(mix(vec3(1.0), col, vigLight), col, u_isDark);

  float grain = (fract(sin(dot(gl_FragCoord.xy + t * 50.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * (0.06 * u_grain);
  col += grain;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), u_opacity);
}
`;

const HEX_COLOR_REGEX = /^#?[0-9a-fA-F]{6}$/;

function sanitizeHexColor(value, fallback) {
  const trimmed = String(value).trim();
  if (!HEX_COLOR_REGEX.test(trimmed)) return fallback;
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function hexToRgb01(hex, fallback) {
  const normalized = sanitizeHexColor(hex, fallback).replace("#", "");
  return [
    parseInt(normalized.slice(0, 2), 16) / 255,
    parseInt(normalized.slice(2, 4), 16) / 255,
    parseInt(normalized.slice(4, 6), 16) / 255,
  ];
}

const DARK_A = "#0d0d14";
const DARK_B = "#1f2540";
const DARK_C = "#4a6191";
const LIGHT_A = "#f0f2f7";
const LIGHT_B = "#d7dceb";
const LIGHT_C = "#bcc5e0";

export function ClosingPlasma({
  speed = 1,
  turbulence = 1,
  mouseInfluence = 1,
  grain = 1,
  sparkle = 1,
  vignette = 1,
  opacity = 1,
  interactive = true,
  maxPixelRatio = 1.75,
  darkColorA = DARK_A,
  darkColorB = DARK_B,
  darkColorC = DARK_C,
  lightColorA = LIGHT_A,
  lightColorB = LIGHT_B,
  lightColorC = LIGHT_C,
  className,
  children,
  style,
  ...props
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const targetMouseRef = useRef({ x: 0.5, y: 0.5 });
  const isDarkRef = useRef(1);

  const settings = useMemo(
    () => ({
      speed, turbulence, mouseInfluence, grain, sparkle, vignette, opacity, interactive, maxPixelRatio,
      darkColorA, darkColorB, darkColorC, lightColorA, lightColorB, lightColorC,
    }),
    [speed, turbulence, mouseInfluence, grain, sparkle, vignette, opacity, interactive, maxPixelRatio,
      darkColorA, darkColorB, darkColorC, lightColorA, lightColorB, lightColorC]
  );

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;

    const handlePointerMove = (event) => {
      if (!settings.interactive) return;
      const rect = container.getBoundingClientRect();
      targetMouseRef.current = {
        x: (event.clientX - rect.left) / rect.width,
        y: 1 - (event.clientY - rect.top) / rect.height,
      };
    };
    const handlePointerLeave = () => {
      targetMouseRef.current = { x: 0.5, y: 0.5 };
    };
    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerleave", handlePointerLeave);
    const removeListeners = () => {
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerleave", handlePointerLeave);
    };

    const gl = canvas.getContext("webgl", { antialias: false, alpha: true });
    if (!gl) {
      console.warn("ClosingPlasma: WebGL is not available");
      return removeListeners;
    }

    const compileShader = (type, source) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn("ClosingPlasma: shader failed to compile", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return removeListeners;

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return removeListeners;
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return removeListeners;
    }
    gl.useProgram(program);

    const position = gl.getAttribLocation(program, "position");
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const loc = (name) => gl.getUniformLocation(program, name);
    const uRes = loc("u_res"), uTime = loc("u_time"), uMouse = loc("u_mouse"), uIsDark = loc("u_isDark");
    const uSpeed = loc("u_speed"), uTurbulence = loc("u_turbulence"), uMouseInfluence = loc("u_mouseInfluence");
    const uGrain = loc("u_grain"), uSparkle = loc("u_sparkle"), uVignette = loc("u_vignette"), uOpacity = loc("u_opacity");
    const uDarkA = loc("u_darkA"), uDarkB = loc("u_darkB"), uDarkC = loc("u_darkC");
    const uLightA = loc("u_lightA"), uLightB = loc("u_lightB"), uLightC = loc("u_lightC");

    const all = [uRes, uTime, uMouse, uIsDark, uSpeed, uTurbulence, uMouseInfluence, uGrain, uSparkle, uVignette, uOpacity,
      uDarkA, uDarkB, uDarkC, uLightA, uLightB, uLightC];
    if (all.some((u) => !u)) {
      console.warn("ClosingPlasma: a shader uniform was not found");
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return removeListeners;
    }

    const reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const start = performance.now();
    let rafId = 0;

    const draw = (now) => {
      const elapsed = (now - start) / 1000;
      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * 0.05;

      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uMouse, mouseRef.current.x, mouseRef.current.y);
      gl.uniform1f(uIsDark, isDarkRef.current);
      gl.uniform1f(uSpeed, settings.speed);
      gl.uniform1f(uTurbulence, settings.turbulence);
      gl.uniform1f(uMouseInfluence, settings.mouseInfluence);
      gl.uniform1f(uGrain, settings.grain);
      gl.uniform1f(uSparkle, settings.sparkle);
      gl.uniform1f(uVignette, settings.vignette);
      gl.uniform1f(uOpacity, settings.opacity);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const stillFrame = () => draw(start + 6000); // a nice-looking fixed moment for reduced motion

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, settings.maxPixelRatio);
      const { width, height } = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      if (reduceMotion) stillFrame(); // resizing clears the canvas, so repaint
    };

    const colors = [
      [uDarkA, settings.darkColorA, DARK_A], [uDarkB, settings.darkColorB, DARK_B], [uDarkC, settings.darkColorC, DARK_C],
      [uLightA, settings.lightColorA, LIGHT_A], [uLightB, settings.lightColorB, LIGHT_B], [uLightC, settings.lightColorC, LIGHT_C],
    ];
    colors.forEach(([u, hex, fallback]) => {
      const c = hexToRgb01(hex, fallback);
      gl.uniform3f(u, c[0], c[1], c[2]);
    });

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    if (reduceMotion) {
      stillFrame();
    } else {
      const loop = (now) => {
        draw(now);
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    }

    return () => {
      removeListeners();
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [settings]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...style }}
      {...props}
    >
      <canvas ref={canvasRef} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
      {children && <div style={{ position: "relative", zIndex: 10, width: "100%", height: "100%" }}>{children}</div>}
    </div>
  );
}

export default ClosingPlasma;

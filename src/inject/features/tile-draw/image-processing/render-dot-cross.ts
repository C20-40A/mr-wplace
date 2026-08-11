export type SimpleOverlayMode = "dot" | "cross";

export const hasOnlyBinaryAlpha = (data: Uint8ClampedArray): boolean => {
  for (let i = 3; i < data.length; i += 4) {
    const alpha = data[i];
    if (alpha !== 0 && alpha !== 255) return false;
  }
  return true;
};

interface SimpleRenderOptions {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  bgData: Uint8ClampedArray;
  bgWidth: number;
  offsetX: number;
  offsetY: number;
  skipBackgroundComparison: boolean;
}

/** Background comparison for the common dot/cross path, kept at x1. */
export const renderSimpleOverlayAt1x = ({
  data, width, height, bgData, bgWidth, offsetX, offsetY,
  skipBackgroundComparison,
}: SimpleRenderOptions): Uint8ClampedArray => {
  if (skipBackgroundComparison) return data;
  const output = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    let srcI = y * width * 4;
    let bgI = ((offsetY + y) * bgWidth + offsetX) * 4;
    for (let x = 0; x < width; x++, srcI += 4, bgI += 4) {
      const a = data[srcI + 3];
      if (a === 0 || bgI + 3 >= bgData.length) continue;
      const matches =
        bgData[bgI + 3] > 0 &&
        data[srcI] === bgData[bgI] &&
        data[srcI + 1] === bgData[bgI + 1] &&
        data[srcI + 2] === bgData[bgI + 2];
      if (matches) continue;
      output[srcI] = data[srcI];
      output[srcI + 1] = data[srcI + 1];
      output[srcI + 2] = data[srcI + 2];
      output[srcI + 3] = a;
    }
  }
  return output;
};

interface PatternRendererCache {
  canvas: OffscreenCanvas;
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  quad: WebGLBuffer;
  texture: WebGLTexture;
  positionLocation: number;
  sourceLocation: WebGLUniformLocation;
  sizeLocation: WebGLUniformLocation;
  crossLocation: WebGLUniformLocation;
  sourceWidth: number;
  sourceHeight: number;
}

let patternRendererCache: PatternRendererCache | null = null;

const compileShader = (
  gl: WebGL2RenderingContext, type: number, source: string,
): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("failed to create dot/cross shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`dot/cross shader compile failed: ${info}`);
  }
  return shader;
};

const createPatternRenderer = (
  width: number, height: number,
): PatternRendererCache => {
  const canvas = new OffscreenCanvas(width * 3, height * 3);
  const gl = canvas.getContext("webgl2", {
    alpha: true, premultipliedAlpha: true, antialias: false,
    depth: false, stencil: false,
  }) as WebGL2RenderingContext | null;
  if (!gl) throw new Error("WebGL2 is unavailable for dot/cross rendering");
  const vertex = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
    in vec2 aPosition;
    void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }`);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float;
    precision highp int;
    uniform sampler2D uSource;
    uniform ivec2 uSourceSize;
    uniform bool uCross;
    out vec4 outColor;
    void main() {
      ivec2 destination = ivec2(gl_FragCoord.xy);
      ivec2 phase = ivec2(destination.x % 3, destination.y % 3);
      bool visible = phase.x == 1 && phase.y == 1;
      if (uCross) visible = visible || phase.x == 1 || phase.y == 1;
      if (!visible) { outColor = vec4(0.0); return; }
      ivec2 source = ivec2(
        destination.x / 3,
        uSourceSize.y - 1 - destination.y / 3
      );
      vec4 color = texelFetch(uSource, source, 0);
      outColor = vec4(color.rgb * color.a, color.a);
    }`);
  const program = gl.createProgram();
  if (!program) throw new Error("failed to create dot/cross program");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`dot/cross program link failed: ${info}`);
  }
  const quad = gl.createBuffer();
  const texture = gl.createTexture();
  if (!quad || !texture) throw new Error("failed to allocate dot/cross resources");
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const positionLocation = gl.getAttribLocation(program, "aPosition");
  const sourceLocation = gl.getUniformLocation(program, "uSource");
  const sizeLocation = gl.getUniformLocation(program, "uSourceSize");
  const crossLocation = gl.getUniformLocation(program, "uCross");
  if (positionLocation < 0 || !sourceLocation || !sizeLocation || !crossLocation) {
    throw new Error("dot/cross shader locations are unavailable");
  }
  return {
    canvas, gl, program, quad, texture, positionLocation, sourceLocation,
    sizeLocation, crossLocation, sourceWidth: width, sourceHeight: height,
  };
};

/** Expand x1 RGBA to an x3 dot/cross pattern without a large JS RGBA buffer. */
export const renderDotCrossBitmap = (
  data: Uint8ClampedArray, width: number, height: number,
  mode: SimpleOverlayMode,
): ImageBitmap => {
  if (!hasOnlyBinaryAlpha(data)) {
    throw new Error("dot/cross GPU rendering requires binary alpha");
  }
  if (!patternRendererCache || patternRendererCache.gl.isContextLost()) {
    patternRendererCache = createPatternRenderer(width, height);
  }
  const cache = patternRendererCache;
  const { gl } = cache;
  if (cache.sourceWidth !== width || cache.sourceHeight !== height) {
    cache.canvas.width = width * 3;
    cache.canvas.height = height * 3;
    cache.sourceWidth = width;
    cache.sourceHeight = height;
  }
  gl.useProgram(cache.program);
  gl.bindBuffer(gl.ARRAY_BUFFER, cache.quad);
  gl.enableVertexAttribArray(cache.positionLocation);
  gl.vertexAttribPointer(cache.positionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, cache.texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0,
    gl.RGBA, gl.UNSIGNED_BYTE, data,
  );
  gl.uniform1i(cache.sourceLocation, 0);
  gl.uniform2i(cache.sizeLocation, width, height);
  gl.uniform1i(cache.crossLocation, mode === "cross" ? 1 : 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, width * 3, height * 3);
  gl.disable(gl.BLEND);
  gl.disable(gl.DITHER);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  return cache.canvas.transferToImageBitmap();
};

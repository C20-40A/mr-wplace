/**
 * GPU Phase1: カラーフィルター適用（x1サイズ）
 * colorFilter未指定時は全ピクセル通過
 * WebGL2非対応時はthrow（上層でcatch）
 *
 * シングルトンパターンで GL コンテキスト・シェーダー・バッファを再利用
 */

// キャッシュされた GL リソース
interface GLCache {
  canvas: OffscreenCanvas;
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  quadBuffer: WebGLBuffer;
  aPosLoc: number;
  overlayTex: WebGLTexture;
  outTex: WebGLTexture;
  fbo: WebGLFramebuffer;
  uniforms: {
    uOverlay: WebGLUniformLocation;
    uFilterCount: WebGLUniformLocation;
    uFilters: WebGLUniformLocation | null;
  };
  safeMaxFilters: number;
  currentWidth: number;
  currentHeight: number;
}

let glCache: GLCache | null = null;

/**
 * GL コンテキストが有効かチェックし、無効なら再初期化
 */
const ensureValidContext = (): boolean => {
  if (!glCache) return false;
  if (glCache.gl.isContextLost()) {
    console.log("🧑‍🎨 : WebGL context lost, will reinitialize");
    glCache = null;
    return false;
  }
  return true;
};

/**
 * GL リソースを初期化または再初期化
 */
const initGLCache = (
  width: number,
  height: number,
  maxFilters: number
): GLCache => {
  const canvas = new OffscreenCanvas(width, height);
  const gl = canvas.getContext("webgl2", {
    premultipliedAlpha: false,
  }) as WebGL2RenderingContext | null;
  if (!gl) throw new Error("WebGL2 not available");

  // maxFilters 制限チェック
  const maxUniformVecs = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
  const maxAllowable = Math.floor(maxUniformVecs / 3);
  const safeMaxFilters = Math.min(maxFilters, maxAllowable);

  // precision fallback 確認
  const highp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  const precisionQualifier =
    highp && highp.precision > 0 ? "highp" : "mediump";

  // シェーダーコンパイル
  const compileShader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error("Shader compile error: " + info);
    }
    return s;
  };

  const vsSource = `#version 300 es
  in vec2 aPos;
  out vec2 vTexCoord;
  void main(){
    vTexCoord = (aPos + 1.0) * 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }`;

  const fsSource = `#version 300 es
  precision ${precisionQualifier} float;
  in vec2 vTexCoord;
  uniform sampler2D uOverlay;
  uniform int uFilterCount;
  uniform vec3 uFilters[${safeMaxFilters}];
  out vec4 outColor;

  const float EPS = 1.0/255.0 + 1e-6;

  void main(){
    vec4 ov = texture(uOverlay, vTexCoord);
    if (ov.a <= 0.0039) {
      outColor = vec4(0.0);
      return;
    }

    if (uFilterCount > 0) {
      bool match = false;
      for (int i = 0; i < ${safeMaxFilters}; ++i) {
        if (i >= uFilterCount) break;
        vec3 f = uFilters[i] / 255.0;
        if (abs(ov.r - f.r) <= EPS && abs(ov.g - f.g) <= EPS && abs(ov.b - f.b) <= EPS) {
          match = true;
          break;
        }
      }
      if (!match) {
        outColor = vec4(0.0);
        return;
      }
    }

    outColor = vec4(ov.rgb, ov.a);
  }`;

  const vs = compileShader(gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error("Program link error: " + info);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  gl.useProgram(program);

  // 頂点バッファ
  const quadBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
    gl.STATIC_DRAW
  );

  // 入力テクスチャ
  const overlayTex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, overlayTex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // 初期サイズでテクスチャ領域を確保
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );

  // 出力テクスチャ + フレームバッファ
  const outTex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, outTex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    outTex,
    0
  );

  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error("Framebuffer incomplete");
  }

  // uniform locations
  const uOverlay = gl.getUniformLocation(program, "uOverlay");
  if (!uOverlay) throw new Error("Uniform uOverlay not found");
  const uFilterCount = gl.getUniformLocation(program, "uFilterCount");
  if (!uFilterCount) throw new Error("Uniform uFilterCount not found");
  const uFilters = gl.getUniformLocation(program, "uFilters[0]");

  gl.uniform1i(uOverlay, 0);

  console.log("🧑‍🎨 : GPU filter context initialized");

  const aPosLoc = gl.getAttribLocation(program, "aPos");
  if (aPosLoc < 0) throw new Error("Attribute aPos not found");

  return {
    canvas,
    gl,
    program,
    quadBuffer,
    aPosLoc,
    overlayTex,
    outTex,
    fbo,
    uniforms: { uOverlay, uFilterCount, uFilters },
    safeMaxFilters,
    currentWidth: width,
    currentHeight: height,
  };
};

/**
 * テクスチャサイズを更新（サイズ変更時のみ）
 */
const resizeTextures = (cache: GLCache, width: number, height: number): void => {
  const { gl, overlayTex, outTex, fbo } = cache;

  // Canvas サイズ更新
  cache.canvas.width = width;
  cache.canvas.height = height;

  // 入力テクスチャ
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, overlayTex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );

  // 出力テクスチャ
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, outTex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );

  // フレームバッファ再アタッチ
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    outTex,
    0
  );

  cache.currentWidth = width;
  cache.currentHeight = height;
};

export const processGpuColorFilter = async (
  overlayBitmap: ImageBitmap,
  colorFilter?: Array<[number, number, number]>,
  maxFilters = 64
): Promise<Uint8ClampedArray> => {
  const width = overlayBitmap.width;
  const height = overlayBitmap.height;

  // キャッシュの有効性チェック & 初期化
  if (!ensureValidContext()) {
    glCache = initGLCache(width, height, maxFilters);
  }

  const cache = glCache!;
  const {
    gl,
    program,
    quadBuffer,
    aPosLoc,
    overlayTex,
    uniforms,
    safeMaxFilters,
  } = cache;

  // サイズ変更があればテクスチャをリサイズ
  if (cache.currentWidth !== width || cache.currentHeight !== height) {
    resizeTextures(cache, width, height);
  }

  // 毎回必要な GL 状態の設定
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.enableVertexAttribArray(aPosLoc);
  gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

  // 入力テクスチャにデータをアップロード
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, overlayTex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    overlayBitmap
  );

  // カラーフィルター uniform 設定
  const filters = colorFilter ?? [];
  const sendCount = Math.min(filters.length, safeMaxFilters);
  gl.uniform1i(uniforms.uFilterCount, sendCount);

  if (sendCount > 0 && uniforms.uFilters) {
    const filterFlat = new Float32Array(safeMaxFilters * 3);
    for (let i = 0; i < sendCount; i++) {
      const [r, g, b] = filters[i];
      filterFlat[i * 3 + 0] = r;
      filterFlat[i * 3 + 1] = g;
      filterFlat[i * 3 + 2] = b;
    }
    gl.uniform3fv(uniforms.uFilters, filterFlat);
  }

  // 描画
  gl.bindFramebuffer(gl.FRAMEBUFFER, cache.fbo);
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // readPixels自体が描画完了を待つため、直前のgl.finishは不要。
  const outBuf = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, outBuf);

  // NOTE: overlayBitmap.close() は呼ばない
  // この ImageBitmap は instance.tiles に保存されていて、複数回再利用される可能性があるため

  // 同じArrayBufferをviewし、4MBのTypedArrayコピーを避ける。
  return new Uint8ClampedArray(
    outBuf.buffer,
    outBuf.byteOffset,
    outBuf.byteLength,
  );
};

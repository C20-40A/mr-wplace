/**
 * GPU Phase1: カラーフィルター適用（x1サイズ）
 * colorFilter未指定時は全ピクセル通過
 * WebGL2非対応時はthrow（上層でcatch）
 */
export const processGpuColorFilter = async (
  overlayBitmap: ImageBitmap,
  colorFilter?: Array<[number, number, number]>,
  maxFilters = 64
): Promise<Uint8ClampedArray> => {
  const width = overlayBitmap.width;
  const height = overlayBitmap.height;

  // WebGL2コンテキスト作成
  const glCanvas = new OffscreenCanvas(width, height);
  const gl = glCanvas.getContext("webgl2", {
    premultipliedAlpha: false,
  }) as WebGL2RenderingContext | null;
  if (!gl) throw new Error("WebGL2 not available");

  // --- maxFilters制限チェック ---
  const maxUniformVecs = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
  const maxAllowable = Math.floor(maxUniformVecs / 3);
  const safeMaxFilters = Math.min(maxFilters, maxAllowable);

  // --- precision fallback 確認 ---
  const highp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  const precisionQualifier = highp && highp.precision > 0 ? "highp" : "mediump";

  // シェーダーコンパイル・リンク
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

  const linkProgram = (vsSrc: string, fsSrc: string) => {
    const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error("Program link error: " + info);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return p;
  };

  // --- 頂点シェーダー ---
  const vsSource = `#version 300 es
  in vec2 aPos;
  out vec2 vTexCoord;
  void main(){
    vTexCoord = (aPos + 1.0) * 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }`;

  // --- フラグメントシェーダー ---
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

  const program = linkProgram(vsSource, fsSource);
  gl.useProgram(program);

  // 頂点バッファ
  const quadBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
    gl.STATIC_DRAW
  );
  const aPosLoc = gl.getAttribLocation(program, "aPos");
  if (aPosLoc < 0) throw new Error("Attribute aPos not found");
  gl.enableVertexAttribArray(aPosLoc);
  gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

  // overlayテクスチャ作成
  const overlayTex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, overlayTex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    overlayBitmap
  );

  // texImage2D完了を確実にする
  gl.finish();

  // sampler uniform設定
  const uOverlayLoc = gl.getUniformLocation(program, "uOverlay");
  if (!uOverlayLoc) throw new Error("Uniform uOverlay not found");
  gl.uniform1i(uOverlayLoc, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, overlayTex);

  // カラーフィルターuniform設定
  const filters = colorFilter ?? [];
  const sendCount = Math.min(filters.length, safeMaxFilters);
  const uFilterCountLoc = gl.getUniformLocation(program, "uFilterCount");
  if (!uFilterCountLoc) throw new Error("Uniform uFilterCount not found");
  gl.uniform1i(uFilterCountLoc, sendCount);

  if (sendCount > 0) {
    const uFiltersLoc = gl.getUniformLocation(program, "uFilters[0]");
    if (uFiltersLoc) {
      const filterFlat = new Float32Array(safeMaxFilters * 3);
      for (let i = 0; i < sendCount; i++) {
        const [r, g, b] = filters[i];
        filterFlat[i * 3 + 0] = r;
        filterFlat[i * 3 + 1] = g;
        filterFlat[i * 3 + 2] = b;
      }
      gl.uniform3fv(uFiltersLoc, filterFlat);
    }
  }

  // Framebuffer作成
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
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
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    outTex,
    0
  );
  gl.activeTexture(gl.TEXTURE0);

  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error("Framebuffer incomplete");
  }

  // 描画
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.finish(); // 同期確実化

  // readPixels
  const outBuf = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, outBuf);

  // リソース解放
  gl.deleteTexture(overlayTex);
  gl.deleteTexture(outTex);
  gl.deleteFramebuffer(fbo);
  gl.deleteBuffer(quadBuffer);
  gl.deleteProgram(program);

  // ImageBitmap解放（すべての処理完了後）
  overlayBitmap.close();

  return new Uint8ClampedArray(outBuf);
};

import { ImageAdjustments } from "./canvas-processor";

/**
 * GPU画像処理: brightness/contrast/saturation + パレット量子化 + ディザリング
 * WebGL2非対応時はthrow（上層でcatch→CPUフォールバック）
 */
export const gpuProcessImage = async (
  sourceBitmap: ImageBitmap,
  adjustments: ImageAdjustments,
  paletteRGB: Array<[number, number, number]>,
  ditheringEnabled = false,
  ditheringThreshold = 500
): Promise<Uint8ClampedArray> => {
  const width = sourceBitmap.width;
  const height = sourceBitmap.height;

  // WebGL2コンテキスト作成
  const glCanvas = new OffscreenCanvas(width, height);
  const gl = glCanvas.getContext("webgl2", {
    premultipliedAlpha: false,
  }) as WebGL2RenderingContext | null;
  if (!gl) throw new Error("WebGL2 not available");

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

  // 頂点シェーダー: フルスクリーン四角
  const vsSource = `#version 300 es
  in vec2 aPos;
  out vec2 vTexCoord;
  void main(){
    vTexCoord = (aPos + 1.0) * 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }`;

  // Phase1: brightness/contrast/saturation適用
  const fsAdjustSource = `#version 300 es
  precision highp float;
  in vec2 vTexCoord;
  uniform sampler2D uSource;
  uniform float uBrightness;
  uniform float uContrastFactor;
  uniform float uSatFactor;
  out vec4 outColor;

  void main(){
    vec4 color = texture(uSource, vTexCoord);
    vec3 rgb = color.rgb * 255.0;
    
    // brightness + contrast
    rgb = uContrastFactor * (rgb + uBrightness - 128.0) + 128.0;
    
    // saturation
    if (uSatFactor != 1.0) {
      float gray = dot(rgb, vec3(0.299, 0.587, 0.114));
      rgb = gray + (rgb - gray) * uSatFactor;
    }
    
    outColor = vec4(rgb / 255.0, color.a);
  }`;

  // Phase2: パレット量子化 + ディザリング
  const maxPalette = 64;
  const fsPaletteSource = `#version 300 es
  precision highp float;
  in vec2 vTexCoord;
  uniform sampler2D uAdjusted;
  uniform int uPaletteCount;
  uniform vec3 uPalette[${maxPalette}];
  uniform bool uDitheringEnabled;
  uniform float uSnapThreshold;
  uniform float uBayerMatrix[16];
  out vec4 outColor;

  void main(){
    vec4 color = texture(uAdjusted, vTexCoord);
    vec3 rgb = color.rgb * 255.0;

    // ===== パレット近傍判定 =====
    float minDist = 1e10;
    vec3 nearest = uPalette[0];
    for (int i = 0; i < ${maxPalette}; ++i) {
      if (i >= uPaletteCount) break;
      vec3 diff = rgb - uPalette[i];
      float dist2 = dot(diff, diff);
      if (dist2 < minDist) {
        minDist = dist2;
        nearest = uPalette[i];
      }
    }

    // ===== 近い色ならスナップ（ディザスキップ） =====
    bool isNearPalette = (minDist < uSnapThreshold);

    // ===== ディザリング処理 =====
    if (uDitheringEnabled && !isNearPalette) {
      vec2 pixelCoord = gl_FragCoord.xy;
      int x = int(mod(pixelCoord.x, 4.0));
      int y = int(mod(pixelCoord.y, 4.0));
      int idx = y * 4 + x;
      float bayerValue = uBayerMatrix[idx];
      float ditherAmount = bayerValue * 64.0;
      rgb = clamp(rgb + ditherAmount, 0.0, 255.0);

      // 再度パレット最近傍検索（ディザ後）
      float minDist2 = 1e10;
      vec3 nearest2 = uPalette[0];
      for (int i = 0; i < ${maxPalette}; ++i) {
        if (i >= uPaletteCount) break;
        vec3 diff2 = rgb - uPalette[i];
        float dist22 = dot(diff2, diff2);
        if (dist22 < minDist2) {
          minDist2 = dist22;
          nearest2 = uPalette[i];
        }
      }
      nearest = nearest2;
    }

    outColor = vec4(nearest / 255.0, color.a);
  }`;

  const programAdjust = linkProgram(vsSource, fsAdjustSource);
  const programPalette = linkProgram(vsSource, fsPaletteSource);

  // 頂点バッファ
  const quadBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
    gl.STATIC_DRAW
  );

  // ソーステクスチャ
  const sourceTex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, sourceTex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
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
    sourceBitmap
  );

  // GPU転送完了したのでImageBitmap解放
  sourceBitmap.close();

  // Phase1: adjustments適用 → 中間テクスチャ
  const intermediateTex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, intermediateTex);
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

  const fbo1 = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo1);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    intermediateTex,
    0
  );
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error("Framebuffer1 incomplete");
  }

  gl.useProgram(programAdjust);
  const aPosLoc1 = gl.getAttribLocation(programAdjust, "aPos");
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.enableVertexAttribArray(aPosLoc1);
  gl.vertexAttribPointer(aPosLoc1, 2, gl.FLOAT, false, 0, 0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sourceTex);
  gl.uniform1i(gl.getUniformLocation(programAdjust, "uSource"), 0);

  const brightnessValue = adjustments.brightness * 2.55;
  const contrastFactor =
    (259 * (adjustments.contrast + 255)) / (255 * (259 - adjustments.contrast));
  const satFactor = 1 + adjustments.saturation / 100;

  gl.uniform1f(
    gl.getUniformLocation(programAdjust, "uBrightness"),
    brightnessValue
  );
  gl.uniform1f(
    gl.getUniformLocation(programAdjust, "uContrastFactor"),
    contrastFactor
  );
  gl.uniform1f(gl.getUniformLocation(programAdjust, "uSatFactor"), satFactor);

  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // Phase2: パレット量子化 → 最終テクスチャ
  const finalTex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, finalTex);
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

  const fbo2 = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo2);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    finalTex,
    0
  );
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error("Framebuffer2 incomplete");
  }

  gl.useProgram(programPalette);
  const aPosLoc2 = gl.getAttribLocation(programPalette, "aPos");
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.enableVertexAttribArray(aPosLoc2);
  gl.vertexAttribPointer(aPosLoc2, 2, gl.FLOAT, false, 0, 0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, intermediateTex);
  gl.uniform1i(gl.getUniformLocation(programPalette, "uAdjusted"), 0);

  const sendCount = Math.min(paletteRGB.length, maxPalette);
  gl.uniform1i(
    gl.getUniformLocation(programPalette, "uPaletteCount"),
    sendCount
  );

  const paletteFlat = new Float32Array(maxPalette * 3);
  for (let i = 0; i < sendCount; i++) {
    const [r, g, b] = paletteRGB[i];
    paletteFlat[i * 3 + 0] = r;
    paletteFlat[i * 3 + 1] = g;
    paletteFlat[i * 3 + 2] = b;
  }
  gl.uniform3fv(gl.getUniformLocation(programPalette, "uPalette"), paletteFlat);

  // ディザリング設定
  gl.uniform1i(
    gl.getUniformLocation(programPalette, "uDitheringEnabled"),
    ditheringEnabled ? 1 : 0
  );
  gl.uniform1f(
    gl.getUniformLocation(programPalette, "uSnapThreshold"),
    ditheringThreshold
  );

  // ベイヤー行列（4x4、正規化済み -0.5 ~ 0.5）
  const bayerMatrix = new Float32Array(
    [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
      (v) => v / 16 - 0.5
    )
  );
  gl.uniform1fv(
    gl.getUniformLocation(programPalette, "uBayerMatrix"),
    bayerMatrix
  );

  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // readPixels（GPU→CPUコピー）
  const outBuf = new Uint8ClampedArray(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, outBuf);

  // クリーンアップ
  gl.deleteTexture(sourceTex);
  gl.deleteTexture(intermediateTex);
  gl.deleteTexture(finalTex);
  gl.deleteFramebuffer(fbo1);
  gl.deleteFramebuffer(fbo2);
  gl.deleteBuffer(quadBuffer);
  gl.deleteProgram(programAdjust);
  gl.deleteProgram(programPalette);

  // WebGLコンテキスト明示的破棄
  const loseContextExt = gl.getExtension("WEBGL_lose_context");
  if (loseContextExt) {
    loseContextExt.loseContext();
  }

  return outBuf;
};

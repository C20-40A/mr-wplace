import {
  isPerceptualQuantizationMethod,
  rgbToPerceptualColor,
} from "./canvas-processor/color-utils";
import type {
  ImageAdjustments,
  PerceptualQuantizationMethod,
  QuantizationMethod,
} from "./canvas-processor/types";

/**
 * GPU画像処理: brightness/contrast/saturation + パレット量子化 + ディザリング
 * WebGL2非対応時はthrow（上層でcatch→CPUフォールバック）
 */
export const gpuProcessImage = async (
  sourceBitmap: ImageBitmap,
  adjustments: ImageAdjustments,
  paletteRGB: Array<[number, number, number]>,
  ditheringEnabled = false,
  ditheringThreshold = 500,
  quantizationMethod: QuantizationMethod = "rgb-euclidean"
): Promise<Uint8ClampedArray> => {
  const width = sourceBitmap.width;
  const height = sourceBitmap.height;

  const getQuantizationMethodInt = (method: QuantizationMethod): number => {
    if (method === "weighted-rgb") return 1;
    if (method === "lab") return 2;
    if (method === "oklab") return 3;
    if (method === "delta-e-2000") return 4;
    return 0;
  };

  const getPerceptualMode = (
    method: QuantizationMethod
  ): PerceptualQuantizationMethod | null =>
    isPerceptualQuantizationMethod(method) ? method : null;

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

    // アルファ二値化：128未満は完全透明として処理スキップ（パフォーマンス最適化）
    if (color.a < 0.5) {
      outColor = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }

    // 調整なしの場合は早期リターン（パフォーマンス最適化）
    if (uBrightness == 0.0 && uContrastFactor == 1.0 && uSatFactor == 1.0) {
      outColor = vec4(color.rgb, 1.0);
      return;
    }

    vec3 rgb = color.rgb * 255.0;

    // brightness + contrast
    if (uBrightness != 0.0 || uContrastFactor != 1.0) {
      rgb = uContrastFactor * (rgb + uBrightness - 128.0) + 128.0;
    }

    // saturation
    if (uSatFactor != 1.0) {
      float gray = dot(rgb, vec3(0.299, 0.587, 0.114));
      rgb = gray + (rgb - gray) * uSatFactor;
    }

    outColor = vec4(rgb / 255.0, 1.0);
  }`;

  // Phase2: パレット量子化 + ディザリング
  const maxPalette = 64;
  const fsPaletteSource = `#version 300 es
  precision highp float;
  in vec2 vTexCoord;
  uniform sampler2D uAdjusted;
  uniform int uPaletteCount;
  uniform vec3 uPalette[${maxPalette}];
  uniform vec3 uPalettePerceptual[${maxPalette}];
  uniform bool uDitheringEnabled;
  uniform float uSnapThreshold;
  uniform float uBayerMatrix[16];
  uniform int uQuantizationMethod; // 0: RGB Euclidean, 1: Weighted RGB, 2: Lab, 3: OKLab, 4: DeltaE2000
  out vec4 outColor;

  // RGB (0-255) → Lab 色空間変換
  vec3 rgbToLab(vec3 rgb) {
    // 1. RGB → sRGB (0-1 正規化)
    vec3 srgb = rgb / 255.0;

    // 2. sRGB → 線形RGB (ガンマ補正解除)
    vec3 linear;
    for (int i = 0; i < 3; i++) {
      float c = srgb[i];
      linear[i] = (c <= 0.04045) ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
    }

    // 3. 線形RGB → XYZ (D65白色点)
    float x = linear.r * 0.4124564 + linear.g * 0.3575761 + linear.b * 0.1804375;
    float y = linear.r * 0.2126729 + linear.g * 0.7151522 + linear.b * 0.072175;
    float z = linear.r * 0.0193339 + linear.g * 0.119192 + linear.b * 0.9503041;

    // 4. XYZ → Lab (D65白色点で正規化)
    float xn = 0.95047;
    float yn = 1.0;
    float zn = 1.08883;

    float fx = x / xn;
    float fy = y / yn;
    float fz = z / zn;

    float delta = 6.0 / 29.0;
    float t0 = delta * delta * delta;
    float m = (1.0 / 3.0) * delta * delta;

    // f関数
    float fxResult = (fx > t0) ? pow(fx, 1.0 / 3.0) : fx / (3.0 * m) + 4.0 / 29.0;
    float fyResult = (fy > t0) ? pow(fy, 1.0 / 3.0) : fy / (3.0 * m) + 4.0 / 29.0;
    float fzResult = (fz > t0) ? pow(fz, 1.0 / 3.0) : fz / (3.0 * m) + 4.0 / 29.0;

    float L = 116.0 * fyResult - 16.0;
    float a = 500.0 * (fxResult - fyResult);
    float b = 200.0 * (fyResult - fzResult);

    return vec3(L, a, b);
  }

  vec3 rgbToOklab(vec3 rgb) {
    vec3 srgb = rgb / 255.0;
    vec3 linear;
    for (int i = 0; i < 3; i++) {
      float c = srgb[i];
      linear[i] = (c <= 0.04045) ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
    }

    float l = 0.4122214708 * linear.r + 0.5363325363 * linear.g + 0.0514459929 * linear.b;
    float m = 0.2119034982 * linear.r + 0.6806995451 * linear.g + 0.1073969566 * linear.b;
    float s = 0.0883024619 * linear.r + 0.2817188376 * linear.g + 0.6299787005 * linear.b;

    float lRoot = pow(l, 1.0 / 3.0);
    float mRoot = pow(m, 1.0 / 3.0);
    float sRoot = pow(s, 1.0 / 3.0);

    return vec3(
      0.2104542553 * lRoot + 0.7936177850 * mRoot - 0.0040720468 * sRoot,
      1.9779984951 * lRoot - 2.4285922050 * mRoot + 0.4505937099 * sRoot,
      0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.8086757660 * sRoot
    );
  }

  float deltaE2000(vec3 lab1, vec3 lab2) {
    float c1 = length(lab1.yz);
    float c2 = length(lab2.yz);
    float cAvg = (c1 + c2) * 0.5;
    float cAvg7 = pow(cAvg, 7.0);
    float g = 0.5 * (1.0 - sqrt(cAvg7 / (cAvg7 + pow(25.0, 7.0))));

    float a1Prime = (1.0 + g) * lab1.y;
    float a2Prime = (1.0 + g) * lab2.y;
    float c1Prime = sqrt(a1Prime * a1Prime + lab1.z * lab1.z);
    float c2Prime = sqrt(a2Prime * a2Prime + lab2.z * lab2.z);

    float h1Prime = degrees(atan(lab1.z, a1Prime));
    float h2Prime = degrees(atan(lab2.z, a2Prime));
    if (h1Prime < 0.0) h1Prime += 360.0;
    if (h2Prime < 0.0) h2Prime += 360.0;

    float deltaLPrime = lab2.x - lab1.x;
    float deltaCPrime = c2Prime - c1Prime;

    float deltaHPrime = 0.0;
    if (c1Prime > 0.0 && c2Prime > 0.0) {
      float hDiff = h2Prime - h1Prime;
      if (abs(hDiff) <= 180.0) deltaHPrime = hDiff;
      else if (h2Prime <= h1Prime) deltaHPrime = hDiff + 360.0;
      else deltaHPrime = hDiff - 360.0;
    }

    float deltaBigHPrime =
      2.0 * sqrt(c1Prime * c2Prime) * sin(radians(deltaHPrime * 0.5));

    float lBarPrime = (lab1.x + lab2.x) * 0.5;
    float cBarPrime = (c1Prime + c2Prime) * 0.5;

    float hBarPrime = h1Prime + h2Prime;
    if (c1Prime > 0.0 && c2Prime > 0.0) {
      if (abs(h1Prime - h2Prime) > 180.0) {
        hBarPrime += (h1Prime + h2Prime < 360.0) ? 360.0 : -360.0;
      }
      hBarPrime *= 0.5;
    } else {
      hBarPrime *= 0.5;
    }

    float t =
      1.0 -
      0.17 * cos(radians(hBarPrime - 30.0)) +
      0.24 * cos(radians(2.0 * hBarPrime)) +
      0.32 * cos(radians(3.0 * hBarPrime + 6.0)) -
      0.20 * cos(radians(4.0 * hBarPrime - 63.0));

    float lBarPrimeMinus50Sq = (lBarPrime - 50.0) * (lBarPrime - 50.0);
    float sL = 1.0 + (0.015 * lBarPrimeMinus50Sq) / sqrt(20.0 + lBarPrimeMinus50Sq);
    float sC = 1.0 + 0.045 * cBarPrime;
    float sH = 1.0 + 0.015 * cBarPrime * t;
    float deltaTheta = 30.0 * exp(-pow((hBarPrime - 275.0) / 25.0, 2.0));
    float rC = 2.0 * sqrt(pow(cBarPrime, 7.0) / (pow(cBarPrime, 7.0) + pow(25.0, 7.0)));
    float rT = -rC * sin(radians(2.0 * deltaTheta));

    float lTerm = deltaLPrime / sL;
    float cTerm = deltaCPrime / sC;
    float hTerm = deltaBigHPrime / sH;

    return sqrt(
      lTerm * lTerm + cTerm * cTerm + hTerm * hTerm + rT * cTerm * hTerm
    );
  }

  vec3 rgbToPerceptual(vec3 rgb) {
    if (uQuantizationMethod == 3) return rgbToOklab(rgb);
    return rgbToLab(rgb);
  }

  // 色距離計算（量子化方法に応じて）
  // palettePerceptual: Lab/OKLab の事前計算済みパレット値
  float colorDistance(vec3 rgb1, vec3 rgb2, vec3 palettePerceptual) {
    if (uQuantizationMethod == 0) {
      // RGB Euclidean 距離の2乗
      vec3 diff = rgb1 - rgb2;
      return dot(diff, diff);
    } else if (uQuantizationMethod == 1) {
      // 重み付き RGB 距離の2乗
      vec3 diff = rgb1 - rgb2;
      vec3 weights = vec3(0.3, 0.59, 0.11); // R, G, B
      vec3 weightedDiff = diff * diff * weights;
      return weightedDiff.r + weightedDiff.g + weightedDiff.b;
    } else {
      vec3 perceptual1 = rgbToPerceptual(rgb1);
      if (uQuantizationMethod == 4) {
        return deltaE2000(perceptual1, palettePerceptual);
      }
      vec3 diff = perceptual1 - palettePerceptual;
      return dot(diff, diff);
    }
  }

  void main(){
    vec4 color = texture(uAdjusted, vTexCoord);

    // アルファ二値化：透明ピクセルはそのまま出力
    if (color.a < 0.5) {
      outColor = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }

    vec3 rgb = color.rgb * 255.0;

    // ===== パレット近傍判定 =====
    float minDist = 1e10;
    vec3 nearest = uPalette[0];
    for (int i = 0; i < ${maxPalette}; ++i) {
      if (i >= uPaletteCount) break;
      float dist = colorDistance(rgb, uPalette[i], uPalettePerceptual[i]);
      if (dist < minDist) {
        minDist = dist;
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
        float dist2 = colorDistance(rgb, uPalette[i], uPalettePerceptual[i]);
        if (dist2 < minDist2) {
          minDist2 = dist2;
          nearest2 = uPalette[i];
        }
      }
      nearest = nearest2;
    }

    outColor = vec4(nearest / 255.0, 1.0);
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

  // texImage2D完了を確実にする
  gl.finish();

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
  const palettePerceptualFlat = new Float32Array(maxPalette * 3);
  const perceptualMode = getPerceptualMode(quantizationMethod);
  for (let i = 0; i < sendCount; i++) {
    const [r, g, b] = paletteRGB[i];
    paletteFlat[i * 3 + 0] = r;
    paletteFlat[i * 3 + 1] = g;
    paletteFlat[i * 3 + 2] = b;

    if (perceptualMode) {
      const [c0, c1, c2] = rgbToPerceptualColor(perceptualMode, r, g, b);
      palettePerceptualFlat[i * 3 + 0] = c0;
      palettePerceptualFlat[i * 3 + 1] = c1;
      palettePerceptualFlat[i * 3 + 2] = c2;
    }
  }
  gl.uniform3fv(gl.getUniformLocation(programPalette, "uPalette"), paletteFlat);
  gl.uniform3fv(
    gl.getUniformLocation(programPalette, "uPalettePerceptual"),
    palettePerceptualFlat
  );

  // ディザリング設定
  gl.uniform1i(
    gl.getUniformLocation(programPalette, "uDitheringEnabled"),
    ditheringEnabled ? 1 : 0
  );
  gl.uniform1f(
    gl.getUniformLocation(programPalette, "uSnapThreshold"),
    ditheringThreshold
  );

  // 量子化方法設定
  gl.uniform1i(
    gl.getUniformLocation(programPalette, "uQuantizationMethod"),
    getQuantizationMethodInt(quantizationMethod)
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

  // ImageBitmap解放（すべての処理完了後）
  sourceBitmap.close();

  // WebGLコンテキスト明示的破棄
  const loseContextExt = gl.getExtension("WEBGL_lose_context");
  if (loseContextExt) {
    loseContextExt.loseContext();
  }

  return outBuf;
};

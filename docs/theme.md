localStorage の theme が'custom-winter' | 'night' | 'halloween'で切り替わる

CtlL9J-n.js で切り替えは

```js
    set theme(e) {
        r(a(this, h), e, !0),
        localStorage.setItem(w, e),
        document.documentElement.setAttribute("data-theme", e)
    }
```

```css
:where(:root),:root:has(input.theme-controller[value=custom-winter]: checked),[data-theme=custom-winter] {
  color-scheme: light;
  --color-base-100: oklch(100% 0 0);
  --color-base-200: oklch(97.466% 0.011 259.822);
  --color-base-300: oklch(93.268% 0.016 262.751);
  --color-base-content: oklch(41.886% 0.053 255.824);
  --color-primary: oklch(56.86% 0.255 257.57);
  --color-primary-content: oklch(100% 0.051 257.57);
  --color-secondary: oklch(42.551% 0.161 282.339);
  --color-secondary-content: oklch(88.51% 0.032 282.339);
  --color-accent: oklch(59.939% 0.191 335.171);
  --color-accent-content: oklch(11.988% 0.038 335.171);
  --color-neutral: oklch(19.616% 0.063 257.651);
  --color-neutral-content: oklch(83.923% 0.012 257.651);
  --color-info: oklch(88.127% 0.085 214.515);
  --color-info-content: oklch(17.625% 0.017 214.515);
  --color-success: oklch(80.494% 0.077 197.823);
  --color-success-content: oklch(16.098% 0.015 197.823);
  --color-warning: oklch(89.172% 0.045 71.47);
  --color-warning-content: oklch(17.834% 0.009 71.47);
  --color-error: oklch(73.092% 0.11 20.076);
  --color-error-content: oklch(14.618% 0.022 20.076);
  --radius-selector: 2rem;
  --radius-field: 2rem;
  --radius-box: 2rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 2px;
  --depth: 1;
  --noise: 1;
}

:root:has(input.theme-controller[value=dark]: checked),[data-theme=dark] {
  color-scheme: dark;
  --color-base-100: oklch(30.857% 0.023 264.149);
  --color-base-200: oklch(28.036% 0.019 264.182);
  --color-base-300: oklch(26.346% 0.018 262.177);
  --color-base-content: oklch(97.807% 0.029 256.847);
  --color-primary: oklch(58% 0.233 277.117);
  --color-primary-content: oklch(96% 0.018 272.314);
  --color-secondary: oklch(65% 0.241 354.308);
  --color-secondary-content: oklch(94% 0.028 342.258);
  --color-accent: oklch(77% 0.152 181.912);
  --color-accent-content: oklch(38% 0.063 188.416);
  --color-neutral: oklch(14% 0.005 285.823);
  --color-neutral-content: oklch(92% 0.004 286.32);
  --color-info: oklch(74% 0.16 232.661);
  --color-info-content: oklch(29% 0.066 243.157);
  --color-success: oklch(76% 0.177 163.223);
  --color-success-content: oklch(37% 0.077 168.94);
  --color-warning: oklch(82% 0.189 84.429);
  --color-warning-content: oklch(41% 0.112 45.904);
  --color-error: oklch(71% 0.194 13.428);
  --color-error-content: oklch(27% 0.105 12.094);
  --radius-selector: 2rem;
  --radius-field: 2rem;
  --radius-box: 2rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 2px;
  --depth: 1;
  --noise: 1;
}

:root:has(input.theme-controller[value=halloween]: checked),[data-theme=halloween] {
  color-scheme: dark;
  --color-base-100: oklch(21% 0.006 56.043);
  --color-base-200: oklch(14% 0.004 49.25);
  --color-base-300: oklch(0% 0 0);
  --color-base-content: oklch(84.955% 0 0);
  --color-primary: oklch(77.48% 0.204 60.62);
  --color-primary-content: oklch(19.693% 0.004 196.779);
  --color-secondary: oklch(45.98% 0.248 305.03);
  --color-secondary-content: oklch(89.196% 0.049 305.03);
  --color-accent: oklch(64.8% 0.223 136.073);
  --color-accent-content: oklch(0% 0 0);
  --color-neutral: oklch(24.371% 0.046 65.681);
  --color-neutral-content: oklch(84.874% 0.009 65.681);
  --color-info: oklch(54.615% 0.215 262.88);
  --color-info-content: oklch(90.923% 0.043 262.88);
  --color-success: oklch(62.705% 0.169 149.213);
  --color-success-content: oklch(12.541% 0.033 149.213);
  --color-warning: oklch(66.584% 0.157 58.318);
  --color-warning-content: oklch(13.316% 0.031 58.318);
  --color-error: oklch(65.72% 0.199 27.33);
  --color-error-content: oklch(13.144% 0.039 27.33);
  --radius-selector: 2rem;
  --radius-field: 2rem;
  --radius-box: 2rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 2px;
  --depth: 1;
  --noise: 1;
}
```

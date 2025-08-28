export enum OverlayMode {
  OFF = 'OFF',
  ON = 'ON', 
  TRANSPARENT = 'TRANSPARENT'
}

export class TileOverlayUI {
  private button: HTMLButtonElement | null = null;
  private mode = OverlayMode.ON;
  private onToggle: (mode: OverlayMode) => void;

  constructor(onToggle: (mode: OverlayMode) => void) {
    this.onToggle = onToggle;
    this.createButton();
  }

  private createButton(): void {
    this.button = document.createElement('button');
    this.button.className = 'btn btn-square shadow-md';
    this.button.style.position = 'fixed';
    this.button.style.top = '20px';
    this.button.style.left = '50%';
    this.button.style.transform = 'translateX(-50%)';
    this.button.style.zIndex = '9999';
    
    this.button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
        <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
        <path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clip-rule="evenodd"/>
      </svg>
    `;

    this.button.addEventListener('click', () => {
      this.cycleMode();
    });

    this.updateButtonState();
    document.body.appendChild(this.button);
  }

  private cycleMode(): void {
    switch (this.mode) {
      case OverlayMode.ON:
        this.mode = OverlayMode.TRANSPARENT;
        break;
      case OverlayMode.TRANSPARENT:
        this.mode = OverlayMode.OFF;
        break;
      case OverlayMode.OFF:
        this.mode = OverlayMode.ON;
        break;
    }
    this.updateButtonState();
    this.onToggle(this.mode);
  }

  private updateButtonState(): void {
    if (!this.button) return;

    switch (this.mode) {
      case OverlayMode.ON:
        this.button.classList.remove('opacity-50');
        this.button.title = 'Toggle Overlay (ON)';
        break;
      case OverlayMode.TRANSPARENT:
        this.button.classList.remove('opacity-50');
        this.button.style.opacity = '0.7';
        this.button.title = 'Toggle Overlay (TRANSPARENT)';
        break;
      case OverlayMode.OFF:
        this.button.classList.add('opacity-50');
        this.button.style.opacity = '';
        this.button.title = 'Toggle Overlay (OFF)';
        break;
    }
  }
}
interface ButtonConfig {
  icon: string;
  title: string;
  onClick: () => void;
}

export class Toolbar {
  private container: HTMLDivElement;
  private buttonCount = 0;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.position = 'fixed';
    this.container.style.top = '20px';
    this.container.style.left = '50%';
    this.container.style.transform = 'translateX(-50%)';
    this.container.style.zIndex = '9999';
    this.container.style.display = 'flex';
    this.container.style.gap = '8px';
    
    document.body.appendChild(this.container);
  }

  addButton(config: ButtonConfig): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'btn btn-square shadow-md';
    button.title = config.title;
    button.innerHTML = config.icon;
    
    button.addEventListener('click', config.onClick);
    
    this.container.appendChild(button);
    this.buttonCount++;
    
    return button;
  }
}

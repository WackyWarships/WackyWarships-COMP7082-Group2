import { ColorType, TUBE_CONFIG } from '../config/Constants';

export class Tube {
  private contents: ColorType[];

  constructor(initialContents: ColorType[] = []) {
    this.contents = [...initialContents];
  }

  getContents(): ColorType[] {
    return [...this.contents];
  }

  getTopColor(): ColorType | null {
    return this.contents.length > 0 ? this.contents[this.contents.length - 1] : null;
  }

  isEmpty(): boolean {
    return this.contents.length === 0;
  }

  isFull(): boolean {
    return this.contents.length >= TUBE_CONFIG.CAPACITY;
  }

  canPourInto(target: Tube): boolean {
    if (this.isEmpty()) {
      return false;
    }

    const topColor = this.getTopColor();
    const targetTop = target.getTopColor();

    if (target.isEmpty()) {
      return true;
    }

    if (target.isFull()) {
      return false;
    }

    return topColor === targetTop;
  }

  calculatePourAmount(target: Tube): number {
    if (!this.canPourInto(target)) {
      return 0;
    }

    const topColor = this.getTopColor();
    if (!topColor) {
      return 0;
    }

    let count = 0;
    for (let i = this.contents.length - 1; i >= 0; i--) {
      if (this.contents[i] === topColor) {
        count++;
      } else {
        break;
      }
    }

    const availableSpace = TUBE_CONFIG.CAPACITY - target.contents.length;
    return Math.min(count, availableSpace);
  }

  pourInto(target: Tube): number {
    const amount = this.calculatePourAmount(target);
    if (amount <= 0) {
      return 0;
    }

    for (let i = 0; i < amount; i++) {
      const color = this.contents.pop();
      if (color) {
        target.contents.push(color);
      }
    }

    return amount;
  }

  push(color: ColorType): void {
    if (this.isFull()) {
      throw new Error('Tube is full');
    }
    this.contents.push(color);
  }

  pop(): ColorType | undefined {
    return this.contents.pop();
  }

  clone(): Tube {
    return new Tube(this.contents);
  }
}

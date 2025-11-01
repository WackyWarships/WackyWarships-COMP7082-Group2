import { Tube } from './Tube';
import { ColorType, LevelDefinition, LEVEL_DATA, TUBE_CONFIG } from '../config/Constants';

interface MoveRecord {
  sourceIndex: number;
  targetIndex: number;
  movedUnits: number;
  color: ColorType;
}

export class GameState {
  private tubes: Tube[];
  private moves: MoveRecord[] = [];
  private startTime: number;
  private elapsedSeconds: number = 0;
  private undoCount: number = 0;

  constructor(levelDefinition: LevelDefinition['tubes']) {
    this.tubes = levelDefinition.map(contents => new Tube(contents));
    this.startTime = Date.now();
  }

  getTubes(): Tube[] {
    return this.tubes;
  }

  resetTimer(): void {
    this.startTime = Date.now();
    this.elapsedSeconds = 0;
  }

  getTube(index: number): Tube | undefined {
    return this.tubes[index];
  }

  getStats() {
    return {
      moves: this.moves.length,
      time: this.getElapsedTime(),
      undos: this.undoCount
    };
  }

  getElapsedTime(): number {
    const now = Date.now();
    this.elapsedSeconds = Math.floor((now - this.startTime) / 1000);
    return this.elapsedSeconds;
  }

  getUndoCount(): number {
    return this.undoCount;
  }

  isValidMove(sourceIndex: number, destIndex: number): boolean {
    if (sourceIndex === destIndex) {
      return false;
    }

    const sourceTube = this.tubes[sourceIndex];
    const destTube = this.tubes[destIndex];

    if (!sourceTube || !destTube) {
      return false;
    }

    if (sourceTube.isEmpty()) {
      return false;
    }

    if (destTube.isFull()) {
      return false;
    }

    const sourceTop = sourceTube.getTopColor();
    const destTop = destTube.getTopColor();

    if (!destTop) {
      return true;
    }

    return sourceTop === destTop;
  }

  executeMove(sourceIndex: number, destIndex: number): boolean {
    if (!this.isValidMove(sourceIndex, destIndex)) {
      return false;
    }

    const sourceTube = this.tubes[sourceIndex]!;
    const destTube = this.tubes[destIndex]!;
    const pourAmount = sourceTube.pourInto(destTube);

    if (pourAmount <= 0) {
      return false;
    }


    const color = destTube.getTopColor();
    if (!color) {
      return false;
    }

    this.moves.push({
      sourceIndex,
      targetIndex: destIndex,
      movedUnits: pourAmount,
      color
    });

    return true;
  }

  undoLastMove(): boolean {
    if (this.moves.length === 0) {
      return false;
    }

    const lastMove = this.moves.pop()!;
    const { sourceIndex, targetIndex, movedUnits, color } = lastMove;

    const sourceTube = this.tubes[sourceIndex]!;
    const destTube = this.tubes[targetIndex]!;

    for (let i = 0; i < movedUnits; i++) {
      const poppedColor = destTube.pop();
      if (poppedColor !== color) {
        // Put the colors back if undo is invalid
        if (poppedColor) {
          destTube.push(poppedColor);
        }
        for (let j = 0; j < i; j++) {
          const restoreColor = sourceTube.pop();
          if (restoreColor) {
            destTube.push(restoreColor);
          }
        }
        return false;
      }
      sourceTube.push(color);
    }

    this.undoCount++;
    return true;
  }

  isGameWon(): boolean {
    return this.tubes.every(tube => {
      if (tube.isEmpty()) {
        return true;
      }

      const contents = tube.getContents();
      if (contents.length !== TUBE_CONFIG.CAPACITY) {
        return false;
      }

      return contents.every(color => color === contents[0]);
    });
  }

  static createLevel(index: number = LEVEL_DATA.defaultLevelIndex): GameState {
    const level = LEVEL_DATA.levels[index] ?? LEVEL_DATA.levels[LEVEL_DATA.defaultLevelIndex];
    return new GameState(level.tubes);
  }
}

declare module 'sakana' {
  export type SakanaCharacter = 'chisato' | 'takina';

  export interface SakanaOptions {
    el: string | HTMLElement;
    character: SakanaCharacter;
    r: number;
    y: number;
    scale: number;
    canSwitchCharacter: boolean;
  }

  export interface SakanaInstance {
    pause(): void;
    play(): void;
    destroy(): void;
  }

  export interface SakanaApi {
    init(options: SakanaOptions): SakanaInstance;
    setMute(muted: boolean): void;
  }

  const Sakana: SakanaApi;
  export default Sakana;
}

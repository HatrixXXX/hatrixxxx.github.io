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

  export interface SakanaValue {
    r: number;
    y: number;
    t: number;
    w: number;
  }

  export interface SakanaInstance {
    pause(): void;
    getValue(): SakanaValue;
  }

  export interface SakanaApi {
    init(options: SakanaOptions): SakanaInstance;
    setMute(muted: boolean): void;
  }

  const Sakana: SakanaApi;
  export default Sakana;
}

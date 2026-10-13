import type { Track } from '../types/content';

const audioSrc = (filename: string) => `/assets/audio/${encodeURI(filename)}`;

export const playlist: readonly Track[] = [
  {
    id: 'jay-chou-ban-dao-tie-he',
    title: '半岛铁盒',
    artist: '周杰伦',
    src: audioSrc('半岛铁盒-八度空间.mp3')
  },
  {
    id: 'wang-zijian-shi-yu-zheng',
    title: '失语症',
    artist: '王子健',
    src: audioSrc('失语症-王子健.mp3')
  },
  {
    id: 'jing-zhong-hua',
    title: '镜中花',
    artist: '任子墨 & HIGH5-马思涵SAI',
    src: audioSrc('镜中花-任子墨&HIGH5-马思涵SAI.mp3')
  },
  {
    id: 'xuan-bi-hong-zhuang',
    title: '悬笔·红妆',
    artist: '大头针 Official',
    src: audioSrc('大头针 Official - 悬笔_红妆.mp3')
  },
  {
    id: 'canzoni-preferite',
    title: 'canzoni preferite',
    artist: '长谷川大祐',
    src: audioSrc('长谷川大祐+-+canzoni+preferite.mp3')
  },
  {
    id: 'a-rusty-dream',
    title: 'A Rusty Dream',
    artist: 'DOUDOU',
    src: audioSrc('DOUDOU+-+A+Rusty+Dream.mp3')
  },
  {
    id: 'rise',
    title: 'Rise',
    artist: 'Biscuits',
    src: audioSrc('Biscuits - Rise.mp3')
  },
  {
    id: 'bottom-of-the-deep-blue-sea',
    title: 'Bottom Of The Deep Blue Sea',
    artist: 'MISSIO',
    src: audioSrc('Bottom Of The Deep Blue Sea-Missio.mp3')
  },
  {
    id: 'la-girls',
    title: 'LA Girls',
    artist: 'Charlie Puth',
    src: audioSrc('Charlie Puth - LA Girls.mp3')
  },
  {
    id: 'done-for-me',
    title: 'Done for Me (feat. Kehlani)',
    artist: 'Charlie Puth & Kehlani',
    src: audioSrc('Done for Me (feat. Kehlani)-Charlie Puth&Kehlani.mp3')
  },
  {
    id: 'novocaine',
    title: 'novocaine',
    artist: 'GenrIX & CORBAL & Shiloh Dynasty',
    src: audioSrc('GenrIX&CORBAL&Shiloh+Dynasty+-+novocaine.mp3')
  },
  {
    id: 'the-other-side-of-paradise',
    title: 'The Other Side of Paradise',
    artist: 'Glass Animals',
    src: audioSrc('Glass+Animals+-+The+Other+Side+of+Paradise.mp3')
  },
  {
    id: 'bed-alone',
    title: 'Bed Alone',
    artist: 'Joel Adams',
    src: audioSrc('Joel Adams - Bed Alone.mp3')
  },
  {
    id: 'night-dancer',
    title: 'NIGHT DANCER',
    artist: 'imase',
    src: audioSrc('NIGHT+DANCER-imase(2).mp3')
  },
  {
    id: 'be-real',
    title: 'Be Real',
    artist: 'Rasmus Faber & Metaxas',
    src: audioSrc('Rasmus Faber,Metaxas - Be Real.mp3')
  },
  {
    id: 'loving-you-is-who-i-am',
    title: 'Loving You Is Who I Am',
    artist: 'Soleilx',
    src: audioSrc('Soleilx - Loving You Is Who I Am.ogg')
  },
  {
    id: 'sugar',
    title: 'Sugar',
    artist: 'Maroon 5',
    src: audioSrc('Sugar-Maroon+5(1)(1).mp3')
  },
  {
    id: 'for-him',
    title: 'for him.',
    artist: 'Troye Sivan & Allday',
    src: audioSrc('Troye+Sivan&Allday+-+for+him._79586193.mp3')
  },
  {
    id: 'youre-beautiful',
    title: "You're Beautiful",
    artist: 'James Blunt',
    src: audioSrc('You’re+Beautiful-James+Blunt.mp3')
  },
  {
    id: 'slow-motion',
    title: 'Slow Motion',
    artist: 'Marshmello & Jonas Brothers',
    src: audioSrc('[jcpoo.cn]Slow+Motion-Marshmello&Jonas+Brothers.mp3')
  }
];

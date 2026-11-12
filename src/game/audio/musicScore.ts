export type MusicTheme='menu'|'stage1'|'boss'|'victory';
export interface MusicScore {title:string;bpm:number;root:number;chords:readonly number[];lead:readonly (readonly number[])[];}
/** Original composition motifs, also authored in compose-score.py for sampled-instrument rendering. No existing songs or game recordings. */
export const MUSIC_SCORES:Record<MusicTheme,MusicScore>={
 victory:{title:'Horizonte Reconquistado',bpm:126,root:47,chords:[0,5,7,0],lead:[[59,62,66,71],[64,67,71,76],[66,69,73,78],[71,66,62,59]]},
 menu:{title:'Vanguarda do Horizonte',bpm:118,root:50,chords:[0,7,9,5,0,7,5,7],lead:[
 [74,-1,78,81,-1,78,76,74],[76,-1,81,83,81,-1,78,76],[78,81,85,-1,83,81,78,-1],[79,-1,78,74,76,-1,73,-1],
 [74,78,81,86,-1,85,81,78],[76,78,81,-1,83,81,78,76],[79,78,76,74,-1,76,78,-1],[76,-1,73,76,81,-1,-1,-1]]},
 stage1:{title:'Maré de Combate',bpm:142,root:50,chords:[0,10,5,7,0,3,10,7],lead:[
 [74,77,81,-1,84,81,77,74],[72,-1,77,79,81,79,77,-1],[79,82,86,84,82,-1,79,77],[81,-1,80,77,76,73,76,-1],
 [86,84,81,77,74,-1,77,81],[77,81,84,89,-1,86,84,81],[84,82,79,77,-1,79,82,84],[85,81,80,76,73,-1,76,81]]},
 boss:{title:'Casca de Aço',bpm:156,root:40,chords:[0,0,8,10,0,3,8,11],lead:[
 [76,79,82,83,82,79,76,-1],[76,88,-1,86,83,82,79,76],[84,83,79,76,75,76,79,-1],[86,-1,84,82,79,78,75,-1],
 [88,86,83,82,79,-1,76,79],[79,82,86,89,86,82,79,-1],[84,83,79,78,76,75,72,-1],[87,83,78,75,71,-1,75,78]]}
};
export const midiFrequency=(midi:number):number=>440*2**((midi-69)/12);

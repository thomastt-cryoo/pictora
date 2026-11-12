import { describe, expect, it } from 'vitest';
import { kmeansColors } from './kmeans';
import { extractPaletteFromPaintPhoto, generatePaletteFromImage } from './palette';
import { buildRegionModel } from './buildModel';
import { defaultSegmentation } from '../state/store';

function image(colors: number[][]) { return { width: colors.length, height: 1, data: new Uint8ClampedArray(colors.flatMap(color => color.length === 3 ? [...color,255] : color)) }; }
describe('approved k-means degeneracy correction', () => {
  for (const count of [2,12,36,48,64]) it(`solid color returns exactly the observed color for request ${count}`, () => {
    const input = image(Array.from({length:32},()=>[180,80,45]));
    expect(kmeansColors(input.data,count)).toEqual({centers:[{r:180,g:80,b:45}],counts:[32]});
    expect(generatePaletteFromImage(input,count)).toEqual([{number:1,r:180,g:80,b:45,name:undefined}]);
  });
  it('two distinct colors requested as 48 remain two deterministic real colors', () => {
    const input=image([[255,0,0],[0,0,255],[255,0,0],[0,0,255]]);
    const palette=generatePaletteFromImage(input,48);
    expect(palette).toHaveLength(2); expect(palette).toEqual(generatePaletteFromImage(input,48));
    expect(palette.map(c=>[c.r,c.g,c.b])).toEqual(expect.arrayContaining([[255,0,0],[0,0,255]]));
  });
  it('tiny one-pixel images support large counts without fabricated colors',()=>expect(kmeansColors(image([[31,72,129]]).data,48)).toEqual({centers:[{r:31,g:72,b:129}],counts:[1]}));
  it('empty and fully transparent samples return no observed colors',()=>{
    expect(kmeansColors(new Uint8ClampedArray(),48)).toEqual({centers:[],counts:[]});
    expect(kmeansColors(image([[255,0,0,0],[0,255,0,127]]).data,48)).toEqual({centers:[],counts:[]});
  });
  it('alpha 128 remains usable and alpha 127 remains ignored',()=>expect(kmeansColors(image([[255,0,0,127],[0,255,0,128]]).data,48)).toEqual({centers:[{r:0,g:255,b:0}],counts:[1]}));
  it('duplicate observed colors and low-contrast samples do not crash',()=>{
    const input=image([[100,100,100],[100,100,100],[101,100,100],[102,100,100]]);
    const result=kmeansColors(input.data,48); expect(result.centers).toHaveLength(3);expect(result.counts.reduce((a,b)=>a+b,0)).toBe(4);
    expect(result).toEqual(kmeansColors(input.data,48));
  });
  it('paint-photo over-clustering handles a uniform photograph',()=>{
    const input=image(Array.from({length:20},()=>[40,160,60]));
    expect(extractPaletteFromPaintPhoto(input,36)).toEqual([{number:1,r:40,g:160,b:60,name:undefined}]);
  });
  it('duplicate manual palette entries retain the original first-match semantics',()=>{
    const input=image([[255,0,0],[255,0,0]]),palette=[{number:1,r:255,g:0,b:0},{number:2,r:255,g:0,b:0}];
    const model=buildRegionModel(input,palette,{...defaultSegmentation,smoothing:0,minShapeSize:0});
    expect(model.shapes).toHaveLength(1); expect(model.shapes[0].colorNumber).toBe(1);
  });
});

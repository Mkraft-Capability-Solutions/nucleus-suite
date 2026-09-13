import {describe,it,expect} from 'vitest';
import {translate,defaultMessages} from './i18n';
describe('interface translations',()=>{
 it('resolves a supplied locale with English fallback',()=>{
  expect(translate({public:{menu:'Menü'}},'public','menu')).toBe('Menü');
  expect(translate({public:{menu:'Menü'}},'public','navigation')).toBe(defaultMessages.public.navigation);
 });
 it('interpolates known values without evaluating or interpreting markup',()=>{
  expect(translate({example:{message:'Hello {name}: {count}'}},'example','message',{name:'<script>',count:0})).toBe('Hello <script>: 0');
  expect(translate({},'missing','key')).toBe('missing.key');
 });
});
it('indexes public copy while preserving routing and icon identifiers',()=>{
 expect(defaultMessages.publicContent['pages.home.title']).toContain('HR that flows.');
 expect(defaultMessages.publicContent['nav.0.href']).toBeUndefined();
 expect(defaultMessages.publicContent['pages.home.cards.0.icon']).toBeUndefined();
});

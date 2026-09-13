import { describe,it,expect } from 'vitest';
import {inclusiveDays,initialFormValues,updateDerivedFields,validateForm,type FormField} from './form-validation';
import registry from '../data/ui/lib.operational-module-registry.json';
const fields=registry.modules.find(module=>module.screenId==='SCR-030')!.fields.map(field => ({...field, ...(field.key === 'employee' ? {options:['a']} : field.key === 'leaveType' ? {options:['sick']} : {})})) as FormField[];
describe('derived dates and strict form validation',()=>{
 it('calculates inclusive calendar days across leap days, DST and year boundaries',()=>{
  expect(inclusiveDays('2026-09-13','2026-09-13')).toBe(1);
  expect(inclusiveDays('2024-02-28','2024-03-01')).toBe(3);
  expect(inclusiveDays('2026-03-07','2026-03-09')).toBe(3);
  expect(inclusiveDays('2026-12-31','2027-01-01')).toBe(2);
  expect(inclusiveDays('2026-02-30','2026-03-01')).toBeNull();
  expect(inclusiveDays('2026-09-14','2026-09-13')).toBeNull();
 });
 it('initializes SCR-030 and resets overrides only when dependent dates change',()=>{
  let values=initialFormValues(fields);expect(values.numberOfDays).toBe(1);
  values=updateDerivedFields(fields,values,'toDate','2026-09-14');expect(values.numberOfDays).toBe(2);
  values=updateDerivedFields(fields,values,'numberOfDays','2.5');
  values=updateDerivedFields(fields,values,'reason','Optional note');expect(values.numberOfDays).toBe('2.5');
  values=updateDerivedFields(fields,values,'toDate','2026-09-15');expect(values.numberOfDays).toBe(3);
  values=updateDerivedFields(fields,values,'fromDate','');expect(values.numberOfDays).toBe('');
 });
 it.each(['','0','-0.5','2.25','NaN','Infinity','0x10'])('rejects invalid day quantity %s',numberOfDays=>{
  expect(validateForm(fields,{...initialFormValues(fields),employee:'a',leaveType:'sick',numberOfDays}).numberOfDays).toBeTruthy();
 });
 it.each(['0.5','1.5','2.5'])('permits half-day override %s independently of date span',numberOfDays=>{
  expect(validateForm(fields,{...initialFormValues(fields),employee:'a',leaveType:'sick',numberOfDays})).toEqual({});
 });
 it('rejects whitespace and stale selections but accepts optional blanks and numeric zero',()=>{
  const fields:FormField[]=[{key:'name',label:'Name',type:'text',required:true},{key:'count',label:'Count',type:'number',required:true,min:0,max:10,step:1},{key:'person',label:'Person',type:'select',options:['valid'],required:true}];
  expect(validateForm(fields,{name:'   ',count:0,person:'stale'})).toEqual({name:'Name is required.',person:'Person must be selected from the available options.'});
 });
 it('rejects unavailable select options and invalid clock values',()=>{
  expect(validateForm([{key:'employee',label:'Employee',type:'select',required:true,options:[]}],{employee:'stale'}).employee).toBeTruthy();
  expect(validateForm([{key:'time',label:'Time',type:'time'}],{time:'29:90'}).time).toBeTruthy();
 });
 it('requires complete numeric constraints on every operational numeric field',()=>{
  for(const entry of registry.modules)for(const field of entry.fields as FormField[])if(field.type==='number'){
   expect(Number.isFinite(field.min),entry.id+'.'+field.key).toBe(true);expect(Number.isFinite(field.max)).toBe(true);expect(field.step).toBeGreaterThan(0);
  }
 });
});

describe('form constraint regressions',()=>{
 it.each([0,-1,NaN,Infinity])('rejects invalid configured step %s',step=>expect(validateForm([{key:'n',label:'Count',type:'number',step}],{n:2}).n).toBeTruthy());
 it('validates arbitrary derived date dependencies',()=>expect(validateForm([{key:'quantity',label:'Quantity',type:'number',derive:{kind:'inclusiveDays',from:'begins',to:'ends'}}],{begins:'2026-09-15',ends:'2026-09-14',quantity:1}).ends).toBeTruthy());
 it('validates required checkbox and text length',()=>{expect(validateForm([{key:'accept',label:'Accept',type:'checkbox',required:true},{key:'name',label:'Name',type:'text',maxLength:3}],{accept:false,name:'long'})).toHaveProperty('accept');expect(validateForm([{key:'name',label:'Name',type:'text',maxLength:3}],{name:'long'})).toHaveProperty('name');});
});

import { t } from './i18n';
export type FormField = { key: string; label: string; type: string; required?: boolean; minLength?: number; maxLength?: number; min?: number; max?: number; step?: number; options?: Array<string | {value:string}>; defaultValue?: string; derive?: {kind: 'inclusiveDays'; from: string; to: string} };
export type FormValues = Record<string, unknown>;
export function dateDay(value: unknown): number | null {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const stamp=Date.parse(value+'T00:00:00Z');
 return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value?stamp/86400000:null;
}
export function inclusiveDays(from: unknown,to: unknown): number | null {
 const start=dateDay(from),end=dateDay(to);
 return start===null||end===null||end<start?null:end-start+1;
}
export function updateDerivedFields(fields: FormField[],values: FormValues,key:string,value:unknown):FormValues {
 const next={...values,[key]:value};
 for(const field of fields){const rule=field.derive;if(rule&&(key===rule.from||key===rule.to))next[field.key]=inclusiveDays(next[rule.from],next[rule.to])??'';}
 return next;
}
export function initialFormValues(fields:FormField[]):FormValues {
 let values:FormValues=Object.fromEntries(fields.map(field=>[field.key,field.defaultValue??'']));
 for(const field of fields)if(field.derive)values=updateDerivedFields(fields,values,field.derive.from,values[field.derive.from]);
 return values;
}
export function validateForm(fields:FormField[],values:FormValues):Record<string,string>{
 const errors:Record<string,string>={};
 for(const field of fields){
  const raw=values[field.key]; const empty=raw===undefined||raw===null||String(raw).trim()===''||(field.type==='checkbox'&&raw!==true);
  if(empty){if(field.required)errors[field.key]=t('validation','required',{label:field.label});continue;}
  if (typeof raw==='string' && ((field.minLength!==undefined && raw.trim().length<field.minLength)||(field.maxLength!==undefined && raw.length>field.maxLength))) errors[field.key]=t('validation','length',{label:field.label});
  if(field.type==='number'){
   const number=Number(raw),step=field.step??1,min=field.min??0,max=field.max??Number.MAX_SAFE_INTEGER;
   if(!Number.isFinite(step)||step<=0||!Number.isFinite(min)||!Number.isFinite(max)||min>max){errors[field.key]=t('validation','configuration',{label:field.label});continue;}
   if(!/^-?(?:\d+\.?\d*|\.\d+)$/.test(String(raw))||!Number.isFinite(number)||number<min||number>max)errors[field.key]=t('validation','range',{label:field.label,min,max});
   else if(Math.abs((number-min)/step-Math.round((number-min)/step))>1e-7)errors[field.key]=t('validation','step',{label:field.label,step});
  }
  if(field.type==='time'&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(raw)))errors[field.key]=t('validation','time',{label:field.label});
  if(field.type==='date'&&dateDay(raw)===null)errors[field.key]=t('validation','date',{label:field.label});
  if(field.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(raw)))errors[field.key]=t('validation','email',{label:field.label});
  if((field.type==='select'||field.options?.length)&&!(field.options??[]).some(option=>(typeof option==='string'?option:option.value)===raw))errors[field.key]=t('validation','option',{label:field.label});
 }
 for(const [from,to]of [['fromDate','toDate'],['startDate','endDate'],['issuedOn','expiresOn'],...fields.filter(field=>field.derive).map(field=>[field.derive!.from,field.derive!.to])]){
  const start=dateDay(values[from]), end=dateDay(values[to]);
  if(start!==null&&end!==null&&end<start)errors[to]=t('validation','dateOrder');
 }
 if(values.fromTime&&values.toTime&&String(values.toTime)<=String(values.fromTime))errors.toTime=t('validation','timeOrder');
 if(values.startTime&&values.endTime&&String(values.endTime)<=String(values.startTime))errors.endTime=t('validation','timeOrder');
 return errors;
}

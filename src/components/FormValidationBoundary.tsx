'use client';
import { useEffect, type ReactNode } from 'react';
/** Defense in depth for native and programmatically dispatched submit events. */
export default function FormValidationBoundary({children}:{children:ReactNode}) {
 useEffect(()=>{
  const owned=new WeakSet<HTMLInputElement|HTMLTextAreaElement>();
  const clear=(event:Event)=>{const control=event.target;if((control instanceof HTMLInputElement||control instanceof HTMLTextAreaElement)&&owned.has(control)){control.setCustomValidity('');owned.delete(control);}};
  const validate=(event:Event)=>{
   const form=event.target;if(!(form instanceof HTMLFormElement))return;
   for(const control of Array.from(form.elements)){
    if((control instanceof HTMLInputElement||control instanceof HTMLTextAreaElement)&&control.required&&!control.disabled&&!['checkbox','radio','file'].includes(control.type)&&!control.value.trim()){
     control.setCustomValidity('Please complete this required field.');owned.add(control);
    }
   }
   if(!form.checkValidity()){event.preventDefault();event.stopImmediatePropagation();form.reportValidity();}
  };
  document.addEventListener('submit',validate,true);document.addEventListener('input',clear,true);
  return()=>{document.removeEventListener('submit',validate,true);document.removeEventListener('input',clear,true);};
 },[]);
 return children;
}

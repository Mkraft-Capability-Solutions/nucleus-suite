'use client';
import {createContext,useContext,useCallback,useMemo,type ReactNode} from 'react';
import {defaultMessages,translate,type Messages,type TranslationParams} from '@/lib/i18n';
const I18nContext=createContext({locale:'en',messages:defaultMessages});
export function I18nProvider({children,locale='en',messages=defaultMessages}:{children:ReactNode;locale?:string;messages?:Messages}) {
    const value=useMemo(()=>({locale,messages}),[locale,messages]);
    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useTranslation() {
    const {locale,messages}=useContext(I18nContext);
    const t=useCallback((namespace:string,key:string,params?:TranslationParams)=>translate(messages,namespace,key,params),[messages]);
    return {locale,t};
}

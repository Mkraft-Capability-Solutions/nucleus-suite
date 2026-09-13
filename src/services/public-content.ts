import 'server-only';
import content from '@/data/public-site.json';
import {loadInterfaceMessages} from './localization';
import {translate} from '@/lib/i18n';

export type PublicPageKey = keyof typeof content.pages;
/** Async repository boundary; intentionally separate from the demo-gated HR dataset. */
export async function getPublicContent(locale = 'en') {
    const {messages}=await loadInterfaceMessages(locale);
    const localize=(value:unknown,path=''):unknown=>{
        if(typeof value==='string') return Object.hasOwn(messages.publicContent || {},path)?translate(messages,'publicContent',path):value;
        if(Array.isArray(value)) return value.map((child,index)=>localize(child,`${path}.${index}`));
        if(value&&typeof value==='object') return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,localize(child,path?`${path}.${key}`:key)]));
        return value;
    };
    return localize(content) as typeof content;
}

import 'server-only';
import {defaultMessages} from '@/lib/i18n';
/** Replace this adapter with the published localization repository at database cutover. */
export async function loadInterfaceMessages(requestedLocale = 'en') {
    // English is the only published catalog. Never pretend another language is available.
    return {locale:'en',requestedLocale,messages:structuredClone(defaultMessages)};
}

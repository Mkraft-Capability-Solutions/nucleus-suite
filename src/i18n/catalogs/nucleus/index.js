/**
 * =============================================================================
 * Company     : MKraft Capability Solutions LLP
 * Copyright   : Copyright (c) 2026 MKraft Capability Solutions LLP
 * Author      : Dhanraj Dadhich
 * Reviewed By : Dhanraj Dadhich
 * Description : "nucleus" i18n catalog: the /nucleus page (Nucleus HRMS landing). English is inline; every other language
 *               is its own lazily loaded chunk.
 * =============================================================================
 */
import { defineCatalog } from '@/features/landing/i18n/catalog.js';
import en from './en.js';

/** The "nucleus" catalog (use with useT / staticT). */
export default defineCatalog('nucleus', en, { './ar.js': () => import('./ar.js'), './bn.js': () => import('./bn.js'), './de.js': () => import('./de.js'), './es.js': () => import('./es.js'), './fr.js': () => import('./fr.js'), './ja.js': () => import('./ja.js'), './pt.js': () => import('./pt.js'), './ru.js': () => import('./ru.js'), './zh.js': () => import('./zh.js') });

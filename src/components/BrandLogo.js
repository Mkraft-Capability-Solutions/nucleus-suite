import {t as translateText} from '@/lib/i18n';
import Image from 'next/image';

export default function BrandLogo({ size = 48, className }) {
    return <Image src="/images/logo.png" alt={translateText("components.BrandLogo","text_c31602f84f")} width={size} height={size} className={className} style={{ objectFit: 'contain', background: 'var(--brand-logo-surface)', borderRadius: 'var(--radius-control)' }} priority />;
}

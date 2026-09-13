import Image from 'next/image';

export default function BrandLogo({ size = 48, className }) {
    return <Image src="/images/logo.png" alt="Nucleus — People at the core" width={size} height={size} className={className} style={{ objectFit: 'contain', background: '#fff', borderRadius: 8 }} priority />;
}

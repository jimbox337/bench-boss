import Image from 'next/image';

export default function BenchBossLogo({ size = 400 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt="Bench Boss Logo"
      width={size}
      height={size * 0.6}
      priority
      style={{ width: size, height: 'auto' }}
    />
  );
}

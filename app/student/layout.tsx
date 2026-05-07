import Image from 'next/image'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="w-full px-6 py-3 flex items-center border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <Image
          src="/logo.png"
          alt="InnoQuest Labs"
          width={140}
          height={40}
          className="object-contain"
          priority
        />
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}

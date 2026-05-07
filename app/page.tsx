'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-linear-to-br from-[#F5F5F5] to-[#E8D5D0] animate-[fadeIn_0.6s_ease-in]">
      <div className="bg-white rounded-3xl shadow-2xl shadow-[#E63946]/20 max-w-[480px] w-full p-12 animate-[slideUp_0.6s_ease-out]">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center justify-center w-32 h-32 bg-linear-to-br from-white to-[#f8f9fa] rounded-full shadow-lg" style={{
              boxShadow: '0 10px 30px rgba(230, 57, 70, 0.2), 0 0 0 2px rgba(230, 57, 70, 0.1)'
            }}>
              <Image
                src="/logo.png"
                alt="InnoQuest"
                width={120}
                height={120}
                className="rounded-full transition-transform duration-300 hover:scale-105"
                style={{
                  width: '120px',
                  height: '120px',
                  boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0, 0, 0, 0.1)',
                  objectFit: 'cover'
                }}
                priority
              />
            </div>
          </div>

        </div>

        <div className="text-center mb-8">
          <h1 className="font-['Poppins'] font-bold text-[28px] text-black mb-2">
            Welcome to<br />InnoQuest Labs Interactive
          </h1>
          <p className="text-base text-gray-600 font-medium">
            Launch your startup journey
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href="/student/login"
            className="w-full block py-4 px-6 bg-linear-to-br from-[#E63946] to-[#C1121F] text-white rounded-xl font-['Poppins'] font-semibold text-base text-center transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#E63946]/40 shadow-lg shadow-[#E63946]/30"
          >
            🚀 Start Student Gameplay
          </Link>
          <Link
            href="/admin/login"
            className="w-full block py-4 px-6 bg-white text-[#E63946] border-2 border-[#E63946] rounded-xl font-['Poppins'] font-semibold text-base text-center transition-all hover:bg-[#FFF5F5] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#E63946]/20"
          >
            🎮 Admin Login
          </Link>
        </div>

        <div className="text-center mt-8 text-[13px] text-gray-400">
          <p className="mb-2">Optimized for iPad and desktop devices ONLY</p>
        </div>
      </div>
    </div>
  )
}

//       /| _ ╱|、  
//      (•̀ㅅ •́)
//    ＿ノ ヽ ノ＼＿
//   /　`/ ⌒Ｙ⌒ Ｙ　\
//   ( (三ヽ人　 /　 |
//   |　ﾉ⌒＼ ￣￣ヽ　ノ
//    ヽ＿＿＿＞､＿＿／
//      ｜( 王 ﾉ〈
//      / ﾐ`ー―彡 \
//     |╰        ╯|
//     |    /\    |
//     |   /  \   |
//     |  /    \  |
//      U        U             signed by galilynnn :3  


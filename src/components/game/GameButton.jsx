export default function GameButton({ children, tone='signal', className='', ...props }) {
  const tones = {
    signal: 'bg-cyan-300 text-slate-950 border-cyan-100 hover:bg-cyan-200 shadow-[0_5px_0_#0891b2]',
    warm: 'bg-amber-300 text-slate-950 border-amber-100 hover:bg-amber-200 shadow-[0_5px_0_#d97706]',
    dark: 'bg-slate-800 text-white border-slate-600 hover:bg-slate-700 shadow-[0_5px_0_#0f172a]'
  };
  return <button className={`min-h-12 cursor-pointer rounded-xl border-2 px-6 py-3 font-black uppercase tracking-wider transition-colors duration-200 focus-visible:outline focus-visible:outline-4 focus-visible:outline-white/60 disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${className}`} {...props}>{children}</button>;
}
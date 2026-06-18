interface ToastProps {
  message: string | null;
}

export function Toast({ message }: ToastProps) {
  if (!message) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[2000] max-w-[88%]">
      <div className="bg-[var(--card-solid)] text-[#dbe9ff] px-5 py-3 rounded-[14px] border border-[#2ea8ff] text-[13px] text-center"
           style={{ boxShadow: '0 0 24px var(--glow)' }}>
        {message}
      </div>
    </div>
  );
}

interface ToastProps {
  message: string | null;
  variant?: 'info' | 'error';
}

export function Toast({ message, variant = 'info' }: ToastProps) {
  if (!message) return null;

  const isError = variant === 'error';

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[2000] max-w-[88%]">
      <div
        className={`bg-[var(--card-solid)] px-5 py-3 rounded-[14px] border text-[13px] font-medium text-center ${
          isError ? 'rift-torn-b border-[var(--danger)]' : 'border-[var(--accent-light)]'
        }`}
        style={{
          boxShadow: isError ? '0 0 24px rgba(255,59,92,0.35)' : '0 0 24px var(--glow)',
          color: isError ? 'var(--danger)' : 'var(--text)',
          textShadow: isError ? '1.5px 0 0 rgba(22,229,229,0.5), -1.5px 0 0 rgba(255,47,208,0.5)' : undefined,
        }}
      >
        {message}
      </div>
    </div>
  );
}

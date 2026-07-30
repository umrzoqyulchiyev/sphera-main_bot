import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Edit2, Loader, Radio, Users, Clock, AlertCircle } from 'lucide-react';
import { getDrafts, editDraft, approveDraft, rejectDraft } from '../../lib/api';

interface Draft {
  id: number;
  city: string;
  main_topic: string;
  source_count: number;
  script: string;
  script_lt?: string;
  script_en?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export function ModerScreen() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editedScript, setEditedScript] = useState('');
  const [processing, setProcessing] = useState<number | null>(null);

  useEffect(() => {
    loadDrafts();
  }, [statusFilter]);

  const loadDrafts = async () => {
    setLoading(true);
    try {
      const data = await getDrafts(statusFilter);
      setDrafts(data);
    } catch (error) {
      console.error('Failed to load drafts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (draft: Draft) => {
    setEditingId(draft.id);
    setEditedScript(draft.script);
  };

  const handleSaveEdit = async (id: number) => {
    if (!editedScript.trim()) return;
    
    setProcessing(id);
    try {
      await editDraft(id, editedScript);
      setDrafts(drafts.map((d) => 
        d.id === id ? { ...d, script: editedScript } : d
      ));
      setEditingId(null);
    } catch (error) {
      console.error('Failed to edit draft:', error);
      alert('Ошибка при редактировании');
    } finally {
      setProcessing(null);
    }
  };

  const handleApprove = async (id: number) => {
    if (!confirm('Одобрить черновик? Начнется генерация TTS и отправка в эфир.')) {
      return;
    }

    setProcessing(id);
    try {
      await approveDraft(id);
      setDrafts(drafts.filter((d) => d.id !== id));
      alert('✅ Черновик одобрен! TTS генерируется в фоне.');
    } catch (error: any) {
      console.error('Failed to approve draft:', error);
      alert(`Ошибка: ${error.message || 'Не удалось одобрить'}`);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm('Отклонить черновик?')) return;

    setProcessing(id);
    try {
      await rejectDraft(id);
      setDrafts(drafts.filter((d) => d.id !== id));
    } catch (error) {
      console.error('Failed to reject draft:', error);
      alert('Ошибка при отклонении');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="rift-zone-u1 flex flex-col gap-4">
      {/* Status Filter */}
      <div className="flex gap-2">
        <button
          onClick={() => setStatusFilter('pending')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all ${
            statusFilter === 'pending'
              ? 'bg-gradient-to-r from-[#1C3FD6] to-[#e0263a] text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]'
              : 'bg-[rgba(255,251,240,0.4)] text-[#6b5f4f] hover:text-[#1A1310]'
          }`}
        >
          ⏳ Ожидают
        </button>
        <button
          onClick={() => setStatusFilter('approved')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all ${
            statusFilter === 'approved'
              ? 'bg-gradient-to-r from-[#1c3fd6] to-[#16a34a] text-white shadow-[0_0_15px_rgba(28,63,214,0.4)]'
              : 'bg-[rgba(255,251,240,0.4)] text-[#6b5f4f] hover:text-[#1A1310]'
          }`}
        >
          ✅ Одобрены
        </button>
        <button
          onClick={() => setStatusFilter('rejected')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all ${
            statusFilter === 'rejected'
              ? 'bg-gradient-to-r from-[#E0263A] to-[#dc2626] text-white shadow-[0_0_15px_rgba(224,38,58,0.4)]'
              : 'bg-[rgba(255,251,240,0.4)] text-[#6b5f4f] hover:text-[#1A1310]'
          }`}
        >
          ❌ Отклонены
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="glass p-8 rounded-[24px] text-center">
          <Loader className="w-8 h-8 text-[#1C3FD6] animate-spin mx-auto mb-3" />
          <div className="text-sm text-[#6b5f4f]">Загрузка черновиков...</div>
        </div>
      )}

      {/* Empty State */}
      {!loading && drafts.length === 0 && (
        <div className="glass p-8 rounded-[24px] text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[rgba(94,106,210,0.2)] to-[rgba(94,106,210,0.05)] flex items-center justify-center">
            <Radio className="w-8 h-8 text-[#1C3FD6] opacity-40" />
          </div>
          <div className="text-sm text-[#6b5f4f]">
            {statusFilter === 'pending' && 'Нет черновиков на модерации'}
            {statusFilter === 'approved' && 'Нет одобренных черновиков'}
            {statusFilter === 'rejected' && 'Нет отклоненных черновиков'}
          </div>
        </div>
      )}

      {/* Drafts List */}
      <div className="space-y-3">
        {drafts.map((draft) => (
          <div 
            key={draft.id}
            className="glass rounded-[24px] p-5 space-y-4 hover:border-[rgba(94,106,210,0.3)] transition-all"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#1C3FD6]">
                    #{draft.id}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-[rgba(94,106,210,0.15)] text-[#1C3FD6] font-medium">
                    {draft.city}
                  </span>
                </div>
                <div className="text-sm font-bold text-[#1A1310]">
                  {draft.main_topic || 'Без темы'}
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-[#6b5f4f]">
                <Users className="w-3 h-3" />
                <span>{draft.source_count} источников</span>
              </div>
            </div>

            {/* Script */}
            {editingId === draft.id ? (
              <div className="space-y-2">
                <textarea
                  value={editedScript}
                  onChange={(e) => setEditedScript(e.target.value)}
                  className="w-full h-32 bg-[rgba(255,251,240,0.6)] border border-[rgba(94,106,210,0.3)] rounded-xl p-3 text-sm text-[#1A1310] resize-none outline-none focus:border-[rgba(94,106,210,0.5)]"
                  placeholder="Редактировать скрипт..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(draft.id)}
                    disabled={processing === draft.id}
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-[#1c3fd6] to-[#16a34a] text-white text-xs font-semibold hover:shadow-[0_0_20px_rgba(28,63,214,0.4)] transition-all disabled:opacity-50"
                  >
                    {processing === draft.id ? 'Сохранение...' : 'Сохранить'}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-4 py-2 rounded-xl bg-[rgba(255,251,240,0.6)] text-[#6b5f4f] text-xs font-semibold hover:text-[#1A1310] transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[rgba(255,251,240,0.4)] rounded-xl p-4">
                <p className="text-xs text-[#6b5f4f] leading-relaxed whitespace-pre-wrap">
                  {draft.script}
                </p>
              </div>
            )}

            {/* Translations (if approved) */}
            {draft.status === 'approved' && (draft.script_lt || draft.script_en) && (
              <div className="grid grid-cols-2 gap-2">
                {draft.script_lt && (
                  <div className="bg-[rgba(255,251,240,0.4)] rounded-xl p-3">
                    <div className="text-[9px] text-[#6b5f4f] uppercase mb-2">🇱🇹 Lithuanian</div>
                    <p className="text-[10px] text-[#6b5f4f] leading-relaxed line-clamp-3">
                      {draft.script_lt}
                    </p>
                  </div>
                )}
                {draft.script_en && (
                  <div className="bg-[rgba(255,251,240,0.4)] rounded-xl p-3">
                    <div className="text-[9px] text-[#6b5f4f] uppercase mb-2">🇬🇧 English</div>
                    <p className="text-[10px] text-[#6b5f4f] leading-relaxed line-clamp-3">
                      {draft.script_en}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-[rgba(138,143,152,0.1)]">
              <div className="flex items-center gap-1.5 text-[10px] text-[#6b5f4f]">
                <Clock className="w-3 h-3" />
                <span>{formatDate(draft.created_at)}</span>
              </div>

              {/* Actions (only for pending) */}
              {draft.status === 'pending' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(draft)}
                    disabled={processing === draft.id}
                    className="p-2 rounded-lg hover:bg-[rgba(94,106,210,0.1)] text-[#1C3FD6] transition-colors disabled:opacity-50"
                    title="Редактировать"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleApprove(draft.id)}
                    disabled={processing === draft.id}
                    className="p-2 rounded-lg hover:bg-[rgba(28,63,214,0.1)] text-[#1c3fd6] transition-colors disabled:opacity-50"
                    title="Одобрить"
                  >
                    {processing === draft.id ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleReject(draft.id)}
                    disabled={processing === draft.id}
                    className="p-2 rounded-lg hover:bg-[rgba(224,38,58,0.1)] text-[#E0263A] transition-colors disabled:opacity-50"
                    title="Отклонить"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Warning for TTS generation */}
            {draft.status === 'pending' && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.2)]">
                <AlertCircle className="w-4 h-4 text-[#1C3FD6] shrink-0 mt-0.5" />
                <p className="text-[10px] text-[#1C3FD6] leading-relaxed">
                  При одобрении начнется генерация TTS для 3 языков и отправка в эфир. 
                  Проверьте текст перед одобрением.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

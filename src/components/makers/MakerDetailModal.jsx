import { PenTool, X } from 'lucide-react';

export default function MakerDetailModal({ maker, onClose, onEdit }) {
  if (!maker) return null;

  const getVal = (key) => {
    if (maker.response && maker.response[key] !== undefined && maker.response[key] !== '') return maker.response[key];
    if (maker[key] !== undefined && maker[key] !== '') return maker[key];
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <div>
            <h3 className="text-2xl font-bold text-slate-800">{maker.companyName}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-mono">{maker.code}</span>
              <span className="text-slate-500 text-sm">回答日時: {new Date(maker.respondedAt).toLocaleString()}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={24} /></button>
        </div>

        <div className="space-y-6">
          <div className="px-2">
            <div className="flex items-center justify-end mb-4">
              <button onClick={() => onEdit(maker)} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-blue-700 transition-colors">
                <PenTool size={14} /> 編集
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                <h4 className="font-bold text-slate-500 border-b border-slate-300 pb-2 mb-4">基本情報</h4>
                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-1">会社名</p>
                    <p className="text-base text-slate-800 font-medium">{maker.companyName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-1">フリガナ</p>
                    <p className="text-base text-slate-800 font-medium">{getVal('companyNameKana') || getVal('kana') || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-1">担当者名</p>
                    <p className="text-base text-slate-800 font-medium">{getVal('repName') || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-1">電話番号</p>
                    <p className="text-base text-slate-800 font-medium font-mono">{getVal('phone') || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-1">メールアドレス</p>
                    <p className="text-base text-slate-800 font-medium font-mono">{getVal('email') || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-1">支払い方法</p>
                    <p className="text-base text-slate-800 font-medium">{getVal('payment') || getVal('paymentMethod') || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-1">請求書発行</p>
                    <p className="text-base text-slate-800 font-medium">{getVal('billIssue') || getVal('invoice') || '-'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-500 border-b border-slate-300 pb-2 mb-4">出展詳細</h4>
                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-1">搬入日時</p>
                    <p className="text-base text-slate-800 font-medium">{getVal('moveInDate') || '-'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-bold text-slate-500 mb-1">希望コマ数</p>
                      <p className="text-base text-slate-800 font-medium">{getVal('boothCount') || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 mb-1">参加人数</p>
                      <p className="text-base text-slate-800 font-medium">{getVal('staffCount') || getVal('attendees') || '0'}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-1">昼食(必要数)</p>
                    <p className="text-base text-slate-800 font-medium">{getVal('lunchCount') || getVal('lunch') || '0'}</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-5">
                    <h5 className="font-bold text-slate-700 mb-4">備品・設備</h5>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-bold text-slate-500 mb-1">長机</p>
                        <p className="text-base text-slate-800 font-medium">{getVal('itemsDesk') || getVal('desk') || '0'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 mb-1">椅子</p>
                        <p className="text-base text-slate-800 font-medium">{getVal('itemsChair') || getVal('chair') || '0'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 mb-1">電源</p>
                        <p className="text-base text-slate-800 font-medium">
                          {(getVal('itemsPower') === '必要' || getVal('power') > 0 || String(getVal('power')) === 'あり' || JSON.stringify(maker).includes('電源利用：あり')) ? '必要' : '不要'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 mb-1">電源詳細</p>
                        <p className="text-base text-slate-800 font-medium">{getVal('powerDetail') || getVal('powerDetails') || getVal('powerVol') || '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <h4 className="font-bold text-slate-500 border-b border-slate-300 pb-2 mb-4">搬出・展示品・その他</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">運送便利用</p>
                  <p className="text-base text-slate-800 font-medium">{getVal('transport') || getVal('shipping') || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">出荷個口数</p>
                  <p className="text-base text-slate-800 font-medium">{getVal('packages') || getVal('packageCount') || getVal('shippingCount') || '0'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs font-bold text-slate-500 mb-1">展示予定品</p>
                  <p className="text-base text-slate-800 font-medium whitespace-pre-wrap">{getVal('products') || getVal('exhibitItems') || '-'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs font-bold text-slate-500 mb-1">特記事項</p>
                  <p className="text-base text-slate-800 font-medium whitespace-pre-wrap">{getVal('note') || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end pt-4 border-t">
          <button onClick={onClose} className="bg-slate-800 text-white px-8 py-3 rounded-lg font-bold hover:bg-slate-700 shadow-lg">閉じる</button>
        </div>
      </div>
    </div>
  );
}

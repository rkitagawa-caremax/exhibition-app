import React, { useState } from 'react';
import {
    Trash2, List, LayoutDashboard, Search, CheckCircle, Mail, X, Clock, Plus, Upload, Download, Edit3, Star, Copy, ExternalLink
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { doc, writeBatch } from "firebase/firestore";

const MAKER_CATEGORIES = {
    '食品': { color: 'bg-orange-100 text-orange-800', label: '食品' },
    '靴': { color: 'bg-pink-100 text-pink-800', label: '靴' },
    'IoT': { color: 'bg-blue-100 text-blue-800', label: 'IoT' },
    '日常生活': { color: 'bg-purple-100 text-purple-800', label: '日常生活' },
    '住宅改修': { color: 'bg-indigo-100 text-indigo-800', label: '住宅改修' },
    'ベッド': { color: 'bg-green-100 text-green-800', label: 'ベッド' },
    '歩行': { color: 'bg-red-100 text-red-800', label: '歩行' },
    '排泄': { color: 'bg-cyan-100 text-cyan-800', label: '排泄' },
    '医療': { color: 'bg-rose-100 text-rose-800', label: '医療' },
    'その他': { color: 'bg-amber-100 text-amber-800', label: 'その他' },
};

function CsvImportModal({ onClose, onImport }) {
    const [password, setPassword] = useState('');
    const [file, setFile] = useState(null);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (password !== 'kitagawa1') {
            setError('パスワードが違います');
            return;
        }
        if (!file) {
            setError('ファイルを選択してください');
            return;
        }

        try {
            const buffer = await file.arrayBuffer();
            let text;
            try {
                const decoder = new TextDecoder('utf-8', { fatal: true });
                text = decoder.decode(buffer);
            } catch (e) {
                const decoder = new TextDecoder('shift-jis');
                text = decoder.decode(buffer);
            }

            if (text.includes('\uFFFD')) {
            }

            const lines = text.split(/\r?\n/);
            const newMakers = [];

            lines.forEach((line, index) => {
                if (index === 0 && (line.includes('社名') || line.includes('Name'))) return;

                if (!line.trim()) return;
                const parts = line.split(',');
                if (parts.length >= 2) {
                    const name = parts[0].trim();
                    const code = parts[1].trim();
                    const category = parts[2] ? parts[2].trim() : 'その他';
                    if (name && code) {
                        newMakers.push({ name, code, category });
                    }
                }
            });
            onImport(newMakers);
            onClose();
        } catch (e) {
            setError('読み込みエラー: ' + e.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Upload size={20} /> CSV一括登録</h3>
                <div className="space-y-4">
                    <div><label className="block text-sm font-bold text-slate-700 mb-1">管理者パスワード</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 border border-slate-300 rounded" placeholder="パスワードを入力" /></div>
                    <div><label className="block text-sm font-bold text-slate-700 mb-1">CSVファイル</label><input type="file" accept=".csv" onChange={e => setFile(e.target.files[0])} className="w-full p-2 border border-slate-300 rounded bg-slate-50" />
                        <p className="text-xs text-slate-500 mt-1">※ A列: 企業名, B列: 仕入先コード, C列: カテゴリ</p>
                    </div>
                    {error && <p className="text-red-600 text-sm font-bold">{error}</p>}
                    <div className="flex justify-end gap-2 mt-6"><button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">キャンセル</button><button onClick={handleSubmit} className="px-4 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 shadow">インポート実行</button></div>
                </div>
            </div>
        </div>
    );
}

function EditMakerModal({ maker, onClose, onSave, isNew = false, isFixedList = true }) {
    const [password, setPassword] = useState('');
    const [data, setData] = useState({ ...maker });
    const [error, setError] = useState('');

    const handleSave = () => {
        if (isFixedList && password !== 'kitagawa1') {
            setError('パスワードが違います');
            return;
        }
        if (!data.name || !data.code) {
            setError('社名と仕入先コードは必須です');
            return;
        }
        onSave(data);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Edit3 size={18} /> {isNew ? '新規企業追加' : '企業情報編集'}</h3>
                <div className="space-y-3">
                    {isFixedList && (
                        <div><label className="block text-xs font-bold text-slate-500">管理者パスワード <span className="text-red-500">*</span></label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 border border-slate-200 rounded" placeholder="固定リスト編集にはパスワードが必要です" /></div>
                    )}
                    <div><label className="block text-xs font-bold text-slate-500">社名 <span className="text-red-500">*</span></label><input type="text" value={data.name} onChange={e => setData({ ...data, name: e.target.value })} className="w-full p-2 border border-slate-200 rounded" /></div>
                    <div><label className="block text-xs font-bold text-slate-500">仕入先コード <span className="text-red-500">*</span></label><input type="text" value={data.code} onChange={e => setData({ ...data, code: e.target.value })} className="w-full p-2 border border-slate-200 rounded" /></div>
                    <div><label className="block text-xs font-bold text-slate-500">カテゴリ</label>
                        <select value={data.category} onChange={e => setData({ ...data, category: e.target.value })} className="w-full p-2 border border-slate-200 rounded">
                            {Object.keys(MAKER_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
                    <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-3 py-2 text-slate-500 hover:bg-slate-100 rounded">キャンセル</button><button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700">{isNew ? '追加' : '保存'}</button></div>
                </div>
            </div>
        </div>
    );
}

export default function EnterpriseConsole({ masterMakers, setMasterMakers, db, appId }) {
    const [activeTab, setActiveTab] = useState('fixed');
    const [viewMode, setViewMode] = useState('grid');
    const [showCsvImport, setShowCsvImport] = useState(false);
    const [editingMaker, setEditingMaker] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('category');
    const [filterCategory, setFilterCategory] = useState('all');

    const handleImport = async (importedList) => {
        if (!db || !appId) return;
        try {
            const batch = writeBatch(db);
            let count = 0;

            importedList.forEach(item => {
                if (!masterMakers.some(m => m.code === item.code)) {
                    const newId = crypto.randomUUID();
                    const newRef = doc(db, 'artifacts', appId, 'public', 'data', 'masterMakers', newId);
                    batch.set(newRef, {
                        id: newId,
                        ...item,
                        portalUrl: `https://kaientai-x/portal/${item.code}`,
                        isFixed: activeTab === 'fixed'
                    });
                    count++;
                }
            });

            if (count > 0) {
                await batch.commit();
                alert(`${count}件を追加しました。${importedList.length - count}件は重複のためスキップされました。`);
            } else {
                alert('追加可能な新規データはありませんでした（全て重複）。');
            }
        } catch (e) {
            console.error(e);
            alert('インポートエラー: ' + e.message);
        }
    };

    const handleSaveMaker = async (updatedMaker, isNew = false) => {
        if (!db || !appId) return false;
        const existingCode = masterMakers.find(m => m.code === updatedMaker.code && m.id !== updatedMaker.id);
        if (existingCode) {
            alert(`エラー: 仕入先コード "${updatedMaker.code}" は既に登録されています。`);
            return false;
        }

        try {
            const makerId = updatedMaker.id || crypto.randomUUID();
            const makerRef = doc(db, 'artifacts', appId, 'public', 'data', 'masterMakers', makerId);

            let dataToSave = { ...updatedMaker };
            if (isNew) {
                dataToSave = {
                    ...dataToSave,
                    id: makerId,
                    portalUrl: `https://kaientai-x/portal/${updatedMaker.code}`,
                    isFixed: activeTab === 'fixed' // Add to current list
                };
            }

            await writeBatch(db).set(makerRef, dataToSave, { merge: true }).commit(); // Use batch for simplicity or setDoc

            // Optimistic update done via onSnapshot in App.js? 
            // Assuming App.js handles the snapshot update, we don't need to manually update state if it relies on real-time.
            // But props setMasterMakers is passed... wait, App.js uses onSnapshot.
            // If we rely on snapshot, we don't need setMasterMakers here except for immediate feedback maybe.

            setShowAddModal(false);
            setEditingMaker(null);
        } catch (e) {
            console.error(e);
            alert('保存エラー: ' + e.message);
        }
    };

    const handleDeleteMaker = async (maker) => {
        const password = prompt(`${maker.name} を削除するには管理者パスワードを入力してください:`);
        if (password !== 'kitagawa1') {
            if (password !== null) alert('パスワードが違います');
            return;
        }
        if (!confirm(`${maker.name} を完全に削除しますか？\n※この操作は取り消せません。`)) return;
        if (!db || !appId) return;

        try {
            await writeBatch(db).delete(doc(db, 'artifacts', appId, 'public', 'data', 'masterMakers', maker.id)).commit();
        } catch (e) {
            console.error(e);
            alert('削除エラー: ' + e.message);
        }
    };

    const handleMoveToFixed = async (maker) => {
        if (!db || !appId) return;
        try {
            await writeBatch(db).update(doc(db, 'artifacts', appId, 'public', 'data', 'masterMakers', maker.id), { isFixed: true }).commit();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteAllFixed = async () => {
        if (!confirm('固定リスト（IsFixed=true）の登録企業を全て削除しますか？\nこの操作は取り消せません。')) return;
        if (!db || !appId) return;

        try {
            const batch = writeBatch(db);
            const fixedMakers = masterMakers.filter(m => m.isFixed);
            fixedMakers.forEach(m => {
                batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'masterMakers', m.id));
            });
            await batch.commit();
            alert('削除完了しました');
        } catch (e) {
            console.error(e);
            alert('一括削除エラー:' + e.message);
        }
    };

    const filteredMakers = masterMakers.filter(m =>
        (activeTab === 'fixed' ? m.isFixed : true) &&
        (m.name.includes(searchTerm) || m.code.includes(searchTerm) || m.category.includes(searchTerm)) &&
        (filterCategory === 'all' || m.category === filterCategory)
    ).sort((a, b) => {
        if (sortBy === 'category') {
            return (a.category || '').localeCompare(b.category || '');
        }
        return (a.code || '').localeCompare(b.code || '');
    });

    const handleExportExcel = async () => {
        try {
            if (filteredMakers.length === 0) {
                alert('出力対象のデータがありません');
                return;
            }
            // Dynamic import for ExcelJS
            const ExcelJS = (await import('exceljs')).default;
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('EnterpriseList');
            ws.addRow(['仕入先コード', '企業名', 'ポータルURL', 'ジャンル']);

            const baseUrl = window.location.origin + window.location.pathname;

            filteredMakers.forEach(m => {
                const demoUrl = `${baseUrl}?mode=demo_portal&code=${m.code}`;
                ws.addRow([
                    m.code || '',
                    m.name || '',
                    demoUrl,
                    m.category || ''
                ]);
            });

            const buffer = await wb.xlsx.writeBuffer();
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            saveAs(new Blob([buffer]), `enterprise_list_${dateStr}.xlsx`);
        } catch (e) {
            console.error(e);
            alert('Excel出力エラー: ' + e.message);
        }
    };

    const MakerCard = ({ maker }) => {
        const catStyle = MAKER_CATEGORIES[maker.category] || MAKER_CATEGORIES['その他'];
        // Assuming we are in a sub-path, window.location might work
        const baseUrl = window.location.origin + window.location.pathname;
        const demoUrl = `${baseUrl}?mode=demo_portal&code=${maker.code}`;

        return (
            <div className={`bg-white rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow ${viewMode === 'micro' ? 'p-2' : 'p-4'}`}>
                {viewMode === 'micro' ? (
                    <div className="flex items-center gap-2 cursor-pointer hover:bg-slate-50" onClick={() => setEditingMaker(maker)}>
                        <div className={`w-3 h-3 rounded-full ${catStyle.color.split(' ')[0]}`}></div>
                        <span className="text-xs font-medium text-slate-700 truncate">{maker.name}</span>
                        {activeTab === 'selection' && maker.isFixed && <Star size={10} className="text-amber-500 fill-amber-500" />}
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${catStyle.color}`}>
                                    {maker.category ? maker.category.substring(0, 2) : '他'}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 flex items-center gap-1">
                                        {maker.name}
                                        {activeTab === 'selection' && maker.isFixed && <Star size={14} className="text-amber-500 fill-amber-500" title="固定リスト登録済" />}
                                    </h4>
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <span className="font-mono bg-slate-100 px-1 rounded">{maker.code}</span>
                                        <span>{maker.category}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                {activeTab === 'selection' && !maker.isFixed && (
                                    <button onClick={() => handleMoveToFixed(maker)} className="text-amber-500 hover:bg-amber-50 p-2 rounded-full" title="固定リストに移動"><Star size={16} /></button>
                                )}
                                <button onClick={() => setEditingMaker(maker)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-full" title="編集"><Edit3 size={16} /></button>
                                <button onClick={() => handleDeleteMaker(maker)} className="text-red-500 hover:bg-red-50 p-2 rounded-full" title="削除"><Trash2 size={16} /></button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                            <span className="text-xs font-bold text-slate-500">ポータルURL</span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => { navigator.clipboard.writeText(demoUrl); alert('URLをコピーしました'); }}
                                    className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-3 py-1 rounded text-xs flex items-center gap-1"
                                    title="コピー"
                                >
                                    <Copy size={12} /> コピー
                                </button>
                                <button
                                    onClick={() => window.open(demoUrl, '_blank')}
                                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs flex items-center gap-1 hover:bg-blue-700"
                                    title="ポータルを開く"
                                >
                                    <ExternalLink size={12} /> 開く
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800">Enterprise Console</h2>
                    <p className="text-slate-500 mt-1">参加企業マスター管理・ポータル発行</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-sm transition-all hover:-translate-y-0.5">
                        <Plus size={18} /> 新規追加
                    </button>
                    <button onClick={handleExportExcel} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-700 shadow-sm transition-all hover:-translate-y-0.5">
                        <Download size={18} /> Excel出力
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex border-b border-slate-200 bg-slate-50">
                    <button onClick={() => setActiveTab('fixed')} className={`flex-1 py-4 text-center font-bold text-sm ${activeTab === 'fixed' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-500 hover:text-slate-700'}`}>固定リスト ({masterMakers.filter(m => m.isFixed).length}社)</button>
                    <button onClick={() => setActiveTab('selection')} className={`flex-1 py-4 text-center font-bold text-sm ${activeTab === 'selection' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-500 hover:text-slate-700'}`}>全リスト ({masterMakers.length}社)</button>
                </div>

                <div className="p-6 bg-slate-50/50 min-h-[400px]">
                    {activeTab === 'fixed' ? (
                        <>
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex gap-2">
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        className="p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none"
                                    >
                                        <option value="category">カテゴリ順</option>
                                        <option value="code">コード順</option>
                                    </select>
                                    <select
                                        value={filterCategory}
                                        onChange={(e) => setFilterCategory(e.target.value)}
                                        className="p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none"
                                    >
                                        <option value="all">全カテゴリ</option>
                                        {Object.keys(MAKER_CATEGORIES).map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="企業名・コード検索..."
                                            className="pl-9 p-2 border border-slate-200 rounded-lg text-sm w-64 outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <div className="flex bg-white rounded-lg border border-slate-200 p-1">
                                    <button onClick={() => setViewMode('list')} className={`p-2 rounded ${viewMode === 'list' ? 'bg-slate-100 text-blue-600' : 'text-slate-400'}`} title="リスト"><List size={16} /></button>
                                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-slate-100 text-blue-600' : 'text-slate-400'}`} title="グリッド"><LayoutDashboard size={16} /></button>
                                    <button onClick={() => setViewMode('micro')} className={`p-2 rounded ${viewMode === 'micro' ? 'bg-slate-100 text-blue-600' : 'text-slate-400'}`} title="極小">•••</button>
                                </div>
                            </div>

                            <div className={`grid gap-4 ${viewMode === 'micro' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8' : viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                                {filteredMakers.map(maker => <MakerCard key={maker.id} maker={maker} />)}
                                {filteredMakers.length === 0 && <div className="col-span-full text-center py-20 text-slate-400">条件に一致する企業がありません。</div>}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex gap-2">
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        className="p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none"
                                    >
                                        <option value="category">カテゴリ順</option>
                                        <option value="code">コード順</option>
                                    </select>
                                    <select
                                        value={filterCategory}
                                        onChange={(e) => setFilterCategory(e.target.value)}
                                        className="p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none"
                                    >
                                        <option value="all">全カテゴリ</option>
                                        {Object.keys(MAKER_CATEGORIES).map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="企業名・コード検索..."
                                            className="pl-9 p-2 border border-slate-200 rounded-lg text-sm w-64 outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <div className="flex bg-white rounded-lg border border-slate-200 p-1">
                                    <button onClick={() => setViewMode('list')} className={`p-2 rounded ${viewMode === 'list' ? 'bg-slate-100 text-blue-600' : 'text-slate-400'}`} title="リスト"><List size={16} /></button>
                                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-slate-100 text-blue-600' : 'text-slate-400'}`} title="グリッド"><LayoutDashboard size={16} /></button>
                                    <button onClick={() => setViewMode('micro')} className={`p-2 rounded ${viewMode === 'micro' ? 'bg-slate-100 text-blue-600' : 'text-slate-400'}`} title="極小">•••</button>
                                </div>
                            </div>

                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm text-blue-700"><strong>全リスト</strong>: 自由に企業を追加・編集できます（パスワード不要）。</p>
                            </div>

                            <div className={`grid gap-4 ${viewMode === 'micro' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8' : viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                                {filteredMakers.map(maker => <MakerCard key={maker.id} maker={maker} />)}
                                {filteredMakers.length === 0 && <div className="col-span-full text-center py-20 text-slate-400">条件に一致する企業がありません。</div>}
                            </div>
                        </>
                    )}
                </div>
            </div>
            {showCsvImport && <CsvImportModal onClose={() => setShowCsvImport(false)} onImport={handleImport} />}
            {editingMaker && <EditMakerModal maker={editingMaker} onClose={() => setEditingMaker(null)} onSave={(m) => handleSaveMaker(m, false)} existingCodes={masterMakers.map(x => x.code)} isFixedList={activeTab === 'fixed'} />}
            {showAddModal && <EditMakerModal maker={{ name: '', code: '', category: '食品' }} onClose={() => setShowAddModal(false)} onSave={(m) => handleSaveMaker(m, true)} existingCodes={masterMakers.map(x => x.code)} isNew={true} isFixedList={activeTab === 'fixed'} />}
        </div>
    );
}

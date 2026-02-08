import React, { useEffect, useState } from 'react';
import {
    BookOpen, AlertTriangle, ArrowLeft, ChevronRight
} from 'lucide-react';

function activeCategoryStepOffset(tab, idx) {
    return idx + 1;
}

export default function OperationalManualView({ initialTab = 'preparation' }) {
    const [activeTab, setActiveTab] = useState(initialTab); // preparation, dayOf, postEvent
    const [activeStep, setActiveStep] = useState(0);

    useEffect(() => {
        setActiveTab(initialTab);
        setActiveStep(0);
    }, [initialTab]);

    const MANUAL_DATA = {
        preparation: {
            label: '①準備編',
            steps: [
                {
                    title: "Step 1: 新規展示会の作成",
                    desc: "展示会場を押さえた時点で、新規展示会を作成しましょう！ダッシュボードの「新規展示会を作成」ボタンから、展示会の基本情報を登録します。",
                    actions: [
                        "「新規展示会を作成」ボタンをクリック → 右上の青いボタンから新規作成画面へ",
                        "基本情報を入力 → タイトル、開催日、会場名、都道府県などを設定",
                        "目標値を設定 → 集客目標・招致目標・利益目標を入力",
                        "「作成」ボタンで確定 → プロジェクト一覧に追加されます"
                    ],
                    points: [
                        "開催日は複数設定可能です",
                        "会場URLを登録するとGoogleマップ連携できます",
                        "担当スタッフも事前に登録しておくと便利です"
                    ],
                    icons: ["Event"]
                },
                {
                    title: "Step 2: タスクの整理",
                    desc: "タスク管理タブで、タスク一覧を確認！営業タスクと企画タスク、どちらも確認してそれぞれのタスクに期限を設定してください。",
                    actions: [
                        "タスクを押すとタスクの内容が編集できます",
                        "営業タスクで、いらないタスク・または追加したいタスクがあれば適宜追加してください",
                        "タスク順も見やすいようにドラッグで並び替えることもできます"
                    ],
                    points: [
                        "期限を設定することで進捗管理がしやすくなります",
                        "不要なタスクは削除してスッキリ整理しましょう"
                    ]
                },
                {
                    title: "Step 3: メーカーを招待",
                    desc: "メーカーを招待！ 招待メーカータブ",
                    actions: [
                        "まずは固定リスト反映で、企業管理コンソールの固定リストを招待リストに反映！",
                        "それ以外で招待したいメーカーがいれば＋個別追加から追加。AI提案機能も活用してください（※企業管理コンソールに登録が無いと登録不可のため、企業管理コンソールの全リストで企業登録が必要です）",
                        "オリジナル招待フォームの「⚙フォーム編集」から招待アンケート内容を編集（質問の追加・回答方法や必須設定も自由に設定可能）",
                        "質問を保存後、回答画面（デモ）でアンケート内容が問題ないか確認！",
                        "問題なければ企画部に招待Goの指示をお願いします！（※メーカーに展示会招待メールを一斉送信します）",
                        "メーカー招待を打ち切る場合、赤い受付締め切りボタンを押してフォーム回答をシャットダウンします。"
                    ],
                    points: [
                        "招待URLは各メーカー共通です",
                        "受付締め切りは慎重に！一度締め切ると新規回答が受け付けられません"
                    ]
                },
                {
                    title: "Step 3.5: 講演会の招致",
                    desc: "講演会を実施する場合、講演会タブで項目が全て埋められる内容まで作成してください。",
                    actions: [
                        "講演会タブを開き、必要項目を全て入力（不完全だと案内チラシが作成できません）"
                    ],
                    points: [
                        "講演者情報、時間、テーマなど漏れなく入力しましょう",
                        "項目が未入力だとチラシ作成に支障が出ます"
                    ]
                },
                {
                    title: "Step 4: 事前登録フォーム確認",
                    desc: "受付用タブの登録フォーム編集より、事前登録フォームの内容を確認してください。",
                    actions: [
                        "来場者管理タブ → 登録フォーム編集 → 内容を確認（基本はデフォルトで問題ないはず）",
                        "カスタマイズして保存！登録画面（デモ）から内容が問題ないか確認！",
                        "問題なければ表示されているURLをコピー",
                        "緑色のボタンから他サイトへ遷移し、URLを貼り付けてQRコード画像を作成",
                        "生成したQR画像を企画部へ送付 → チラシの作成に移ります",
                        "会場・備品タブのレイアウト作成ツールよりレイアウトを作成。完成したレイアウトを企画に送ってください。"
                    ],
                    points: [
                        "QRコード作成サイトへ遷移してQR画像を保存しましょう",
                        "図面があればより正確なレイアウトが作成可能です"
                    ]
                },
                {
                    title: "Step 5: 会場・備品タブ",
                    desc: "会場・備品タブで費用と備品を管理。各種使用料金の追加と、当日用意する備品の確認を行います。",
                    actions: [
                        "会場・備品タブより、各種使用料金を追加していってください",
                        "ケアマックス側で当日用意する備品を確認（いらなければ削除、必要であれば追加）",
                        "費用が発生する備品は適宜、収支・予算タブに追加してください",
                        "（仮）収支報告書を作成・報告！Excel出力ボタンを押すと書式に収支表の内容が転記されたデータを取得できます"
                    ],
                    points: [
                        "費用は収支・予算タブと連動させましょう",
                        "備品の抜け漏れがないよう事前にしっかりチェック"
                    ]
                },
                {
                    title: "Step 6: 会場・備品タブ",
                    desc: "完成したレイアウト図・チラシを資料管理に反映し、メーカーへ確定連絡を行います。",
                    actions: [
                        "完成したレイアウト図をメーカー招待タブの資料管理に埋め込み。メーカーがポータルサイトからダウンロードできます。（企画部）",
                        "完成したチラシをメーカー招待タブの資料管理に埋め込み。メーカーがポータルサイトからダウンロードできます。（企画部）",
                        "企画部よりメーカーへ確定メールを送付",
                        "タスク管理の登録タスクを処理しながら、集客に移行してください"
                    ],
                    points: [
                        "完成したチラシは必ず資料タブにアップロード",
                        "ここから集客フェーズに突入します！"
                    ]
                },
                {
                    title: "Step 7: 当日スケジュール設定",
                    desc: "スケジュールタブより、当日のデモンストレーションをしながらスケジュールを細かく設定してください。",
                    actions: [
                        "スケジュールタブを開き、当日の流れをシミュレーションしながらスケジュールを設定",
                        "この設定がより効果的にできればできるほど当日の運営成功につながります！！"
                    ],
                    points: [
                        "細かいスケジュール設定が成功のカギ！",
                        "当日の動きをイメージしながら設定しましょう"
                    ]
                }
            ]
        },
        dayOf: {
            label: '②当日運営編',
            steps: [
                {
                    title: "Step 1: 前日搬入",
                    desc: "前日搬入はスピード勝負！",
                    actions: [
                        "前日搬入当日の動き方をスケジュールを見ながら徹底シミュレーション",
                        "前日搬入参加者に役割の割り振り説明、あれば運営マニュアル書を渡す",
                        "レイアウトどおりにブース設置",
                        "ラミネート板を各ブースに配置。搬入・搬出口の案内ラミネートも",
                        "受付の設置（来場特典の準備も）",
                        "事前登録を自分で仮で行い、QRリーダーの読み込みがうまくいくか確認",
                        "（あれば）講演会開場のセッティング",
                        "再度準備漏れが無いか最終チェック（準備物の漏れに対処できる最後のチャンス）",
                        "当日の参加メンバーに、当日の役割を再度説明"
                    ],
                    points: [
                        "時間との勝負です！テキパキ動きましょう",
                        "最終チェックは念入りに"
                    ]
                },
                {
                    title: "Step 2: 開場前",
                    desc: "開場前は一番バタバタします！",
                    actions: [
                        "運営メンバーに再度役割を徹底周知",
                        "未搬入メーカーのチェック",
                        "展示会のBGMのセットアップ、講演会場の確認、その他会場導線の徹底確認",
                        "（時間があれば）メーカーに挨拶（ブースに行って）",
                        "朝礼（カンペを用意しておくと良いです。メーカーにQR読み込みで来場者の管理ができる機能をこの時に説明してください）"
                    ],
                    points: [
                        "音響や導線の確認は開場前に！",
                        "メーカーへの挨拶も忘れずに"
                    ]
                },
                {
                    title: "Step 3: 開場後",
                    desc: "開場後は展示会の満足度向上に心血を注ぐ！めんどくさいと思っても工程をサボらない。",
                    actions: [
                        "QRコードリーダーを起動して来場した人のQRを読み込み来場登録！",
                        "全メーカーのブースに誰か一人でも挨拶に伺うことを徹底",
                        "昼食の案内は早めに",
                        "自分のお客様が来場したらニーズを聞いて最低1ブースは誘導してあげる",
                        "講演会の運営メンバーは時間管理を徹底意識してください",
                        "展示会開場中は、できる限り普段の営業対応は後に回してください。（特に電話）",
                        "各自休憩を効果的に回してください（休憩の際に営業対応をする）",
                        "閉場10分前に閉場のアナウンス",
                        "終礼で来場者数と搬出の手順をマイクで説明して、閉場。"
                    ],
                    points: [
                        "笑顔で元気よく対応しましょう",
                        "QRスキャンは確実に"
                    ]
                },
                {
                    title: "Step 4: 閉場後",
                    desc: "閉場後　忘れ物が無いように！！",
                    actions: [
                        "備品の撤収（会場・受付・講演会場）。メーカーのテーブルや椅子を優先して手伝ってあげてください。",
                        "忘れ物チェック",
                        "展示会場に終了報告",
                        "お疲れ様でした！！"
                    ],
                    points: [
                        "撤収作業は安全第一で",
                        "忘れ物がないか最後にもう一度確認"
                    ]
                }
            ]
        },
        postEvent: {
            label: '③展示会終了後',
            steps: [
                {
                    title: "Step 1: 整理・費用報告",
                    desc: "整理・費用報告",
                    actions: [
                        "備品の整理（使用した備品を整理してまとめましょう）",
                        "領収書や請求書を確認して収支・予算に登録されている金額が間違い無いか確認",
                        "Excel出力を押し、収支報告書（確定版）を作成し報告を上げる"
                    ],
                    points: [
                        "お金周りの確認は正確に",
                        "報告書は早めに作成しましょう"
                    ]
                },
                {
                    title: "Step 2: 締め",
                    desc: "展示会活動の締めくくりです。",
                    actions: [
                        "請求書自動生成機能から、請求書を生成し各メーカーに送付（企画）",
                        "メーカー入金がされているか、経理と連携して確認",
                        "これにて展示会は完全終了です！本当にお疲れ様でした！！"
                    ],
                    points: [
                        "感謝の気持ちを伝えましょう",
                        "全工程終了です！お疲れ様でした！"
                    ]
                }
            ]
        }
    };

    const currentCategory = MANUAL_DATA[activeTab];
    const currentStep = currentCategory.steps[activeStep];

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header & Alert */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-3xl font-bold text-slate-800">運用方法マニュアル</h2>
                    </div>

                    <p className="text-slate-500">展示会運営の流れをステップバイステップで解説</p>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-xl shadow-sm flex gap-3 text-red-700 text-sm font-bold items-start">
                    <AlertTriangle size={24} className="flex-shrink-0 text-red-500" />
                    <p className="leading-relaxed">面倒な作業も多い展示会ですが、全員で良い展示会を作り上げるため工程の省略やQR読み込みの対応をしないなど絶対NG</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-8 bg-slate-100 p-1.5 rounded-xl w-fit">
                {Object.keys(MANUAL_DATA).map((key) => (
                    <button
                        key={key}
                        onClick={() => { setActiveTab(key); setActiveStep(0); }}
                        className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === key ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:text-white hover:bg-slate-200'}`}
                    >
                        {MANUAL_DATA[key].label}
                    </button>
                ))}
                <button className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-400 bg-slate-200 cursor-not-allowed">④Kaientai-X便利機能</button>
            </div>

            {/* Stepper Navigation */}
            <div className="bg-slate-900 text-white rounded-t-2xl p-0 overflow-x-auto scrollbar-hide flex border-b border-slate-700">
                {currentCategory.steps.map((step, idx) => (
                    <button
                        key={idx}
                        onClick={() => setActiveStep(idx)}
                        className={`flex-shrink-0 px-6 py-4 text-xs font-bold border-b-4 transition-colors flex flex-col items-center gap-1 ${activeStep === idx ? 'border-blue-500 text-white bg-slate-800' : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                    >
                        <span className="opacity-50">Step {activeCategoryStepOffset(activeTab, idx)}</span>
                        <span>{step.title.split(':')[1]?.trim() || step.title}</span>
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="bg-slate-900 text-white rounded-b-2xl shadow-2xl p-8 md:p-12 min-h-[500px] relative overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 p-20 opacity-5 pointer-events-none">
                    <BookOpen size={400} />
                </div>

                <div className="relative z-10 max-w-4xl mx-auto space-y-10">
                    {/* Title Section */}
                    <div className="space-y-4">
                        <h3 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-300 leading-tight">
                            {currentStep.desc}
                        </h3>
                    </div>

                    {/* Action List */}
                    <div className="space-y-4">
                        {currentStep.actions.map((action, idx) => (
                            <div key={idx} className="flex gap-4 items-start bg-slate-800/50 p-4 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-colors">
                                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg flex-shrink-0">
                                    {idx + 1}
                                </div>
                                <p className="pt-1 text-slate-200 font-medium leading-relaxed">{action}</p>
                            </div>
                        ))}
                    </div>

                    {/* Points Section */}
                    {currentStep.points && (
                        <div className="mt-8 bg-slate-800/80 rounded-xl border border-slate-700 p-6">
                            <h4 className="flex items-center gap-2 text-amber-400 font-bold mb-4 text-lg">
                                <span className="animate-pulse">💡</span> ポイント
                            </h4>
                            <ul className="space-y-2">
                                {currentStep.points.map((point, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-slate-300 text-sm">
                                        <span className="text-amber-400 mt-1">●</span> {point}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Navigation Buttons */}
                <div className="mt-12 flex justify-between pt-8 border-t border-slate-800">
                    <button
                        disabled={activeStep === 0}
                        onClick={() => setActiveStep(p => p - 1)}
                        className="px-6 py-3 rounded-lg font-bold text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors flex items-center gap-2"
                    >
                        <ArrowLeft size={20} /> 前のステップ
                    </button>
                    <button
                        disabled={activeStep === currentCategory.steps.length - 1}
                        onClick={() => setActiveStep(p => p + 1)}
                        className="px-6 py-3 rounded-lg font-bold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-30 disabled:hover:bg-blue-600 transition-all shadow-lg hover:shadow-blue-500/25 flex items-center gap-2"
                    >
                        次のステップ <ChevronRight size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}

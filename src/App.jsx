import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import {
  Calendar, MapPin, Users, Target, LayoutDashboard,
  FileText, Plus, CheckSquare, Upload, Building2,
  AlertCircle, Save, ArrowLeft, Briefcase, PenTool,
  Search, Mail, X, QrCode, Wallet, MessageCircle,
  Send, ScanLine, TrendingUp, Trash2, Link as LinkIcon,
  DollarSign, RefreshCw, Clock, Map, Database, CheckCircle,
  GripVertical, UserX, UserCheck, List, Edit3, Flag,
  AlertTriangle, ExternalLink, Copy, Check, FileSpreadsheet,
  UserPlus, Settings, Download, Eye, Folder, PackageCheck,
  Camera, Loader, Ghost, BedDouble, CalendarDays, Menu,
  ChevronDown, ChevronUp, ChevronRight, RefreshCcw, Trash, GitBranch, Mic, Truck, Layout, User, Info, LogOut, Maximize,
  Box, BookOpen, Star, LayoutGrid, Grid, Image, Radio, ArrowRight, XCircle, History as HistoryIcon, Minus, Inbox, Square, Trophy, BarChart3, Wand2
} from 'lucide-react';
// import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, updateDoc, doc, deleteDoc, onSnapshot, setDoc, query, limit, orderBy, writeBatch, getDocs } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
// QRコード用ライブラリ
import { QRCodeCanvas } from 'qrcode.react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import EnterpriseConsole from './components/EnterpriseConsole';
import OperationalManualView from './components/OperationalManualView';
import LayoutBuilderModal from './components/LayoutBuilderModal';
import { downloadInvoicePdfFromWorksheetCanvas } from './invoicePdfRenderer';

// ============================================================================
// 1. 定数・ヘルパー関数・初期データ
// ============================================================================

const PREFECTURES = [
  { region: "北海道・東北", prefs: ["北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島"] },
  { region: "関東", prefs: ["東京", "神奈川", "埼玉", "千葉", "茨城", "栃木", "群馬"] },
  { region: "中部", prefs: ["愛知", "静岡", "岐阜", "三重", "山梨", "長野", "新潟", "富山", "石川", "福井"] },
  { region: "近畿", prefs: ["大阪", "兵庫", "京都", "滋賀", "奈良", "和歌山"] },
  { region: "中国・四国", prefs: ["広島", "岡山", "鳥取", "島根", "山口", "香川", "徳島", "愛媛", "高知"] },
  { region: "九州・沖縄", prefs: ["福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"] },
];

const EQUIPMENT_OPTIONS = ["長机", "椅子", "プロジェクター", "マイク", "マイクスタンド", "スクリーン", "演台", "パーテーション"];
const MASTER_SHEET_URL = "https://docs.google.com/spreadsheets/d/1hnZdkquaybY-bBSAevnW2BOLn83OdITzNvt-hmZkmVI/edit?gid=0#gid=0";
const INITIAL_INTERNAL_SUPPLIES = [
  "メジャー", "テープ", "消毒液", "音楽用CD", "ダンボール", "ヤマト佐川送り状",
  "ラミネート看板", "介援隊袋", "横断幕", "延長ケーブル",
  "自社用レイアウト用紙", "お客様用レイアウト用紙", "介援隊カタログ", "展示会案内チラシ　50枚ほど"
].map((name, i) => ({ id: `is-${i}`, name, count: 1, checked: false }));

// ▼ メーカーリスト初期値（CSV取込前提のため空配列）
const FIXED_MAKERS_LIST = [];

// ▼ 完全版タスクリスト（Phase 9: 営業/企画の2カテゴリ）
const INITIAL_TASKS = [
  // 【営業側タスク】
  { id: 's1', category: 'sales', title: '展示会日時・エリアの決定', status: 'pending', assignees: [], desc: '' },
  { id: 's2', category: 'sales', title: '展示会場選び', status: 'pending', assignees: [], desc: '' },
  { id: 's3', category: 'sales', title: '展示会場申請', status: 'pending', assignees: [], desc: '' },
  { id: 's4', category: 'sales', title: 'メーカー選定（予備リストを編集）', status: 'pending', assignees: [], desc: '' },
  { id: 's5', category: 'sales', title: '講演会企画の計画', status: 'pending', assignees: [], desc: '' },
  { id: 's6', category: 'sales', title: '電気設備会社手配', status: 'pending', assignees: [], desc: '' },
  { id: 's7', category: 'sales', title: '展示会必要品の手配（リストを参照）', status: 'pending', assignees: [], desc: '' },
  { id: 's8', category: 'sales', title: '集荷手配（ヤマト・佐川）', status: 'pending', assignees: [], desc: '' },
  { id: 's9', category: 'sales', title: 'バイトの手配と打ち合わせ', status: 'pending', assignees: [], desc: '' },
  { id: 's10', category: 'sales', title: '展示会場最終打ち合わせ', status: 'pending', assignees: [], desc: '' },
  { id: 's11', category: 'sales', title: '当日のデモンストレーション', status: 'pending', assignees: [], desc: '' },
  { id: 's12', category: 'sales', title: '得意先集客', status: 'pending', assignees: [], desc: '' },
  { id: 's13', category: 'sales', title: 'エンド（施設など）集客', status: 'pending', assignees: [], desc: '' },
  { id: 's14', category: 'sales', title: '当日の展示会運営', status: 'pending', assignees: [], desc: '' },
  { id: 's15', category: 'sales', title: '当日の講演会運営', status: 'pending', assignees: [], desc: '' },
  { id: 's16', category: 'sales', title: 'ホテル予約', status: 'pending', assignees: [], desc: '' },
  { id: 's17', category: 'sales', title: '弁当手配', status: 'pending', assignees: [], desc: '' },
  { id: 's18', category: 'sales', title: '打ち上げ会場予約', status: 'pending', assignees: [], desc: '' },
  { id: 's19', category: 'sales', title: '備品整理', status: 'pending', assignees: [], desc: '終了後タスク' },
  { id: 's20', category: 'sales', title: '領収書等を企画へ送付', status: 'pending', assignees: [], desc: '終了後タスク' },
  // 【企画側タスク】
  { id: 'p1', category: 'planning', title: '展示会企画概要作成（参加メンバー、場所・時間、収支・集客目標など）', status: 'pending', assignees: [], desc: '' },
  { id: 'p2', category: 'planning', title: 'メーカー選定（希望リスト・予備リストを編集）', status: 'pending', assignees: [], desc: '' },
  { id: 'p3', category: 'planning', title: 'メーカー招待', status: 'pending', assignees: [], desc: '' },
  { id: 'p4', category: 'planning', title: 'メーカー問い合わせ対応', status: 'pending', assignees: [], desc: '' },
  { id: 'p5', category: 'planning', title: '案内チラシ作成', status: 'pending', assignees: [], desc: '' },
  { id: 'p6', category: 'planning', title: '講演会企画の手配実行', status: 'pending', assignees: [], desc: '' },
  { id: 'p7', category: 'planning', title: '展示会場レイアウト作成（メーカー用・来場者用・自社用）', status: 'pending', assignees: [], desc: '' },
  { id: 'p8', category: 'planning', title: 'メーカー招待（催促）', status: 'pending', assignees: [], desc: '' },
  { id: 'p9', category: 'planning', title: 'メーカー招待（第2弾）', status: 'pending', assignees: [], desc: '' },
  { id: 'p10', category: 'planning', title: '（仮）収支報告書作成', status: 'pending', assignees: [], desc: '' },
  { id: 'p11', category: 'planning', title: 'メーカーへチラシ配布を依頼', status: 'pending', assignees: [], desc: '' },
  { id: 'p12', category: 'planning', title: '備品確保・貸借申請', status: 'pending', assignees: [], desc: '' },
  { id: 'p13', category: 'planning', title: 'メーカーパネルラミネート作成', status: 'pending', assignees: [], desc: '' },
  { id: 'p14', category: 'planning', title: '出展確定メーカーに確定メールを送信', status: 'pending', assignees: [], desc: 'レイアウト添付・チラシ添付・搬入時間変更・フォーム記載の案内文' },
  { id: 'p15', category: 'planning', title: '当日の工程表作成', status: 'pending', assignees: [], desc: '' },
  { id: 'p16', category: 'planning', title: 'メーカー請求書作成（澤田さんに送付依頼）', status: 'pending', assignees: [], desc: '' },
  { id: 'p17', category: 'planning', title: '入金確認（振り込み・現金集金）', status: 'pending', assignees: [], desc: '終了後タスク' },
  { id: 'p18', category: 'planning', title: '展示会使用経費のデータをもらう', status: 'pending', assignees: [], desc: '終了後タスク' },
  { id: 'p19', category: 'planning', title: '収支報告書（決定版）', status: 'pending', assignees: [], desc: '終了後タスク' },
];

const DEFAULT_FORM_CONFIG = {
  section1: {

    title: '（今回の展示会のタイトル） 出展申込みフォーム',
    description: `拝啓　貴社ますますご清栄のこととお喜び申し上げます。
日頃は格別のお引き立てを賜り厚く御礼申しあげます。
早速ではございますが、下記の要領で福祉用具展示会を開催する運びとなりました。
つきましては御社ご出展をお願い致したく、ご案内申し上げます。
ご検討の程、宜しくお願い申し上げます。敬具

出展を希望されない場合も、お手数ですが、その旨お答えいただきますようお願い申し上げます。

【展示会概要】
開催日時：（開催日時、曜日なども添えて）
会場：（今回の展示会の会場名称）
住所：（今回の展示会の住所）
電話：（今回の展示会場の電話番号）
アクセス： 今回の展示会場のGoogleマップのURL

搬入方法：（フリー入力スペース　日時と時間を指定可能）
※事前に荷物の発送を希望される方：（フリー入力スペース）の時間帯でよろしくお願い致します。

【宛先】（今回の展示会場の住所）
（今回の展示会の会場名称）
介援隊ブース〇〇ブース　(御社名を記載お願い致します)
※当日送付は（フリー入力スペース）時以降になります。

出展費用：1コマ（2.5ｍ×2.5ｍ）　30,000円(税込)　昼食付(1社2名様分まで)
出展費用につきましては下記アンケートより希望方法をご指定ください。
※2コマ以上をご希望の場合はスペースに限りがございますので、
ご希望に添えない場合がございます。予めご了承下さい。

【申込期日】（日時入力）　厳守

出展メーカー数：100社ほどを予定しております。
来場者：福祉用具販売・貸与事業所様、
一部施設スタッフ・ケアマネ様、介護施設。病院関係者様など

当日は午前9：15分頃より簡単な朝礼を行いますので、時間までに準備集合をお願いいたします。

展示会終了後の集荷については、ヤマト、佐川急便を手配予定です。

お問い合わせは、当社営業企画部(06-6150-7333)までお願い致します。`,
    items: [
      { id: 'companyName', label: '貴社名', type: 'text', help: '法人格は略さずに記入ください。前後にスペースは不要です。例：株式会社ケアマックスコーポレーション', required: true },
      { id: 'companyNameKana', label: '貴社名フリガナ', type: 'text', help: 'フリガナに法人格は不要です。全角カタカナでお願いします。例：ケアマックスコーポレーション', required: true },
      { id: 'repName', label: 'お名前', type: 'text', help: '出展(回答)される方、代表者1名を明記ください　例：介援　太郎', required: true },
      { id: 'phone', label: '携帯番号', type: 'text', help: '半角　ハイフン含めて明記ください　例：080-0000-0000', required: true },
      { id: 'email', label: 'メールアドレス', type: 'email', help: '', required: true },
      { id: 'status', label: '出展の可否について', type: 'radio', options: ['出展を申し込む', '出展を申し込まない'], required: true }
    ]
  },
  section2: {
    title: '出展詳細入力',
    description: '出展に必要な詳細情報をご記入ください。',
    items: [
      { id: 'moveInDate', label: '搬入日時', type: 'radio', options: ['前日搬入', '当日搬入'], required: true },
      { id: 'boothCount', label: '希望コマ数', type: 'radio', options: ['1コマ', '2コマ', 'その他要相談'], required: true },
      { id: 'staffCount', label: '参加人数', type: 'select', options: ['1', '2', '3', '4', '5'], required: true },
      { id: 'lunchCount', label: '昼食について', type: 'radio', options: ['1', '2'], required: true },
      { id: 'itemsDesk', label: '長机', type: 'select', options: ['0', '1', '2', '3'], required: true },
      { id: 'itemsChair', label: '椅子', type: 'select', options: ['0', '1', '2', '3', '4', '5', '6'], required: true },
      { id: 'itemsPower', label: '電源', type: 'radio', options: ['不要', '必要'], required: true },
      { id: 'powerDetail', label: '★電源を使用する機器について', type: 'text', help: '上記質問で電源必要と答えられた方は、配線に必要ですので、何に電源を使用するのか具体的に記入ください。', condition: { targetId: 'itemsPower', operator: 'eq', value: '必要' }, required: true },
      { id: 'transport', label: '搬出時に会場から運送便を使う場合', type: 'radio', options: ['ヤマト', '佐川', '使用しない'], required: true },
      { id: 'packages', label: '出荷個口数', type: 'select', options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] },
      { id: 'payment', label: '出展費用支払方法', type: 'radio', options: ['仕入れより相殺', '振り込み'], required: true },
      { id: 'note', label: '特記事項入力欄', type: 'textarea', help: '' },
      { id: 'billIssue', label: '請求書の発行', type: 'radio', options: ['必要', '不要'], required: true },
      { id: 'products', label: '展示予定品', type: 'textarea', help: '商品名を記入', required: true }
    ]
  },
  section3: {
    title: '受付いたしました（不参加）',
    description: `ご検討いただきありがとうございました。
もしよろしければ、今回不参加の理由をお知らせください。

今後の参考とさせていただきます。
何卒宜しくお願い致します。
ケアマックスコーポレーション　展示会事務局`,
    items: [
      { id: 'declineReason', label: '不参加理由', type: 'textarea', help: '回答無しでもOK' }
    ]
  },
  mail: {
    subject: '（展示会タイトル）　【出展のご案内】',
    body: `ご担当者　様

いつも大変お世話になっております。
ケアマックスコーポレーションでございます。
この度、（開催日時）に、介援隊の展示会を開催する運びとなりましたのでご案内申し上げます。
つきましては、下記URLよりご参加の可否に関わらずご回答いただけますと幸甚に存じます。
ご多用のところ誠に恐れ入りますが、何卒よろしくお願い申し上げます。

{url}

よろしくお願いいたします。`
  },
  settings: {
    deadline: '',
    description: '',
    venuePhone: '090-0000-0000',
    moveInInfo: '前日13:00〜17:00 / 当日 8:30〜9:15',
    shippingInfo: '前日着指定（時間指定不可）',
    shippingAddress: '〒000-0000 〇〇県〇〇市...',
    morningAssembly: '9:15',
    collectionMethod: 'ヤマト・佐川（着払い伝票をご用意ください）',
    feePerBooth: 30000
  }
};

const DEFAULT_VISITOR_FORM_CONFIG = {
  title: '来場者事前登録',
  description: '当日のスムーズな入場のため、事前登録にご協力をお願いいたします。登録完了後、入場用QRコードが発行されます。',
  items: [
    { id: 'type', label: '★受付区分', type: 'select', options: ['販売店', '介護・看護従事者様(看護師・介護士・ケアマネ等)', 'メーカー・製造業', '一般・個人'], required: true },
    { id: 'companyName', label: '★会社名・法人名', type: 'text', help: '個人の場合は「個人」とご明記ください (例：株式会社ケアマックスコーポレーション)', required: true },
    { id: 'repName', label: '★代表者名', type: 'text', help: '', required: true },
    { id: 'phone', label: '★電話番号', type: 'text', help: 'ハイフンなしでも可', required: true },
    { id: 'email', label: '★メールアドレス', type: 'email', help: 'QRコード送付用', required: true },
    { id: 'invitedBy', label: '★招待企業様名', type: 'text', help: '招待状をお持ちの場合、企業名をご記入ください（任意）', required: false }
  ]
};

const downloadCSV = (data, filename) => {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const val = row[header] ? String(row[header]).replace(/"/g, '""') : '';
      return `"${val}"`;
    }).join(','))
  ].join('\n');

  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const parseCSV = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r\n|\n/).filter(line => line.trim());
      const data = lines.map((line, index) => {
        const [code, companyName] = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        if (!code || !companyName) return null;
        return {
          id: Date.now() + index,
          code,
          companyName,
          status: 'listed',
          note: 'CSV取込',
          accessToken: crypto.randomUUID() // 自動生成
        };
      }).filter(item => item !== null);
      resolve(data);
    };
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

const extractNum = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const halfVal = val.toString().replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  const match = halfVal.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};
// ============================================================================
// 2. 共通小コンポーネント & フォーム編集モーダル
// ============================================================================

function DetailItem({ label, value }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-400 mb-1">{label}</label>
      <div className="font-medium text-slate-800 break-words">{value || '-'}</div>
    </div>
  );
}

// 機能強化版フォームエディタ (ラベル、補足、選択肢の編集に対応)
// 機能強化版フォームエディタ (ラベル、補足、選択肢の編集に対応)
// 機能強化版フォームエディタ (ラベル、補足、選択肢の編集に対応)
function FormEditorModal({ config, exhibition, onSave, onClose }) {
  const [localConfig, setLocalConfig] = useState(config);
  const [activeTab, setActiveTab] = useState('settings');
  const [expandedItems, setExpandedItems] = useState({});

  const toggleItem = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updateSection = (k, v) => setLocalConfig({ ...localConfig, [activeTab]: { ...localConfig[activeTab], [k]: v } });

  const updateSetting = (k, v) => {
    setLocalConfig(prev => ({
      ...prev,
      settings: { ...(prev.settings || {}), [k]: v }
    }));
  };

  const updateItem = (id, field, value) => {
    const updatedItems = localConfig[activeTab].items.map(i => {
      if (i.id === id) {
        if (field === 'options') return { ...i, options: value.split(',').map(s => s.trim()) };
        return { ...i, [field]: value };
      }
      return i;
    });
    updateSection('items', updatedItems);
  };

  const addOption = (itemId) => {
    const updatedItems = localConfig[activeTab].items.map(i => {
      if (i.id === itemId) return { ...i, options: [...(i.options || []), '新しい選択肢'] };
      return i;
    });
    updateSection('items', updatedItems);
  };

  const removeOption = (itemId, index) => {
    const updatedItems = localConfig[activeTab].items.map(i => {
      if (i.id === itemId) {
        const newOpts = [...(i.options || [])];
        newOpts.splice(index, 1);
        return { ...i, options: newOpts };
      }
      return i;
    });
    updateSection('items', updatedItems);
  };

  const updateOptionText = (itemId, index, val) => {
    const updatedItems = localConfig[activeTab].items.map(i => {
      if (i.id === itemId) {
        const newOpts = [...(i.options || [])];
        newOpts[index] = val;
        return { ...i, options: newOpts };
      }
      return i;
    });
    updateSection('items', updatedItems);
  };

  const addItem = () => {
    const newItem = {
      id: `custom_${Date.now()}`,
      label: '新しい質問',
      type: 'text',
      help: '',
      required: false,
      options: ['選択肢1', '選択肢2']
    };
    const updatedItems = [...(localConfig[activeTab].items || []), newItem];
    updateSection('items', updatedItems);
    setExpandedItems(prev => ({ ...prev, [newItem.id]: true }));
  };

  const deleteItem = (id) => {
    if (window.confirm('この質問を削除してもよろしいですか？')) {
      const updatedItems = localConfig[activeTab].items.filter(i => i.id !== id);
      updateSection('items', updatedItems);
    }
  };

  const updateCondition = (itemId, field, value) => {
    const updatedItems = localConfig[activeTab].items.map(i => {
      if (i.id === itemId) {
        // If toggling condition off (value === null/false), remove it
        if (field === 'enabled' && !value) {
          const { condition, ...rest } = i;
          return rest;
        }
        // If toggling on, add default
        if (field === 'enabled' && value) {
          return { ...i, condition: { targetId: '', operator: 'eq', value: '' } };
        }
        // Updating fields inside condition object
        return { ...i, condition: { ...(i.condition || { targetId: '', operator: 'eq', value: '' }), [field]: value } };
      }
      return i;
    });
    updateSection('items', updatedItems);
  };

  // Helper to get options from other items for condition setting
  const getOtherItems = (currentItemId) => {
    return localConfig[activeTab].items.filter(i => i.id !== currentItemId && (i.type === 'radio' || i.type === 'select'));
  };

  const getOptionsForTarget = (targetId) => {
    const target = localConfig[activeTab].items.find(i => i.id === targetId);
    return target ? target.options || [] : [];
  };

  // テンプレート生成関数
  const generateTemplateDescription = () => {
    if (!window.confirm('基本設定や展示会情報を元に説明文を自動生成して上書きしますか？\n（現在の入力内容は失われます）')) return;

    const settings = localConfig.settings || {};
    const title = exhibition?.title || '展示会';
    const dates = exhibition?.dates?.length > 0 ? exhibition.dates.join('、') : '未定';
    const place = exhibition?.place || '未定';
    const address = exhibition?.venueAddress || '未定';
    const mapUrl = exhibition?.googleMapsUrl || settings.mapUrl || '';
    const phone = settings.venuePhone || '00-0000-0000';
    const fee = settings.feePerBooth ? `${Number(settings.feePerBooth).toLocaleString()}円` : '未設定';
    const moveInInfo = settings.moveInInfo || '未設定';
    const shippingInfo = settings.shippingInfo || '未設定';
    const shippingAddress = settings.shippingAddress || address;
    const shippingTime = settings.shippingTime || '未設定';
    const deadline = settings.deadline || '未定';

    const desc = `拝啓　貴社ますますご清栄のこととお喜び申し上げます。
日頃は格別のお引き立てを賜り厚く御礼申しあげます。
早速ではございますが、下記の要領で福祉用具展示会を開催する運びとなりました。
つきましては御社ご出展をお願い致したく、ご案内申し上げます。
ご検討の程、宜しくお願い申し上げます。敬具

出展を希望されない場合も、お手数ですが、その旨お答えいただきますようお願い申し上げます。

【展示会概要】
開催日時：${dates}
会場：${place}
住所：${address}
電話：${phone}
アクセス： ${mapUrl}

搬入方法：${moveInInfo}
※事前に荷物の発送を希望される方：${shippingInfo}の時間帯でよろしくお願い致します。

【宛先】${shippingAddress}
${place}
介援隊ブース〇〇ブース　(御社名を記載お願い致します)
※当日送付は${shippingTime}時以降になります。

出展費用：1コマ（2.5ｍ×2.5ｍ）　${fee}(税込)　昼食付(1社2名様分まで)
出展費用につきましては下記アンケートより希望方法をご指定ください。
※2コマ以上をご希望の場合はスペースに限りがございますので、
ご希望に添えない場合がございます。予めご了承下さい。

【申込期日】${deadline}　厳守

出展メーカー数：100社ほどを予定しております。
来場者：福祉用具販売・貸与事業所様、
一部施設スタッフ・ケアマネ様、介護施設。病院関係者様など

当日は午前9：15分頃より簡単な朝礼を行いますので、時間までに準備集合をお願いいたします。

展示会終了後の集荷については、ヤマト、佐川急便を手配予定です。

お問い合わせは、当社営業企画部(06-6150-7333)までお願い致します。`;

    const newTitle = `${title} 出展申込みフォーム`;

    setLocalConfig(prev => ({
      ...prev,
      section1: {
        ...prev.section1,
        title: newTitle,
        description: desc
      }
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl">
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg">招待フォーム設定</h3>
            {/* ★追加: 未保存警告用ステート管理が必要だが、簡易的に閉じるボタンで確認 */}
          </div>
          <button onClick={() => {
            if (JSON.stringify(localConfig) !== JSON.stringify(config)) {
              if (!window.confirm('変更内容が保存されていません。\n破棄して閉じてもよろしいですか？')) return;
            }
            onClose();
          }}><X /></button>
        </div>
        <div className="flex border-b bg-slate-50">
          <button onClick={() => setActiveTab('settings')} className={`px-6 py-3 font-bold text-sm ${activeTab === 'settings' ? 'bg-white border-t-2 border-t-blue-500 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}><Settings size={14} className="inline mr-1" /> 基本設定</button>
          <button onClick={() => setActiveTab('section1')} className={`px-6 py-3 font-bold text-sm ${activeTab === 'section1' ? 'bg-white border-t-2 border-t-blue-500 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>セクション1 (基本)</button>
          <button onClick={() => setActiveTab('section2')} className={`px-6 py-3 font-bold text-sm ${activeTab === 'section2' ? 'bg-white border-t-2 border-t-blue-500 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>セクション2 (詳細)</button>
          <button onClick={() => setActiveTab('section3')} className={`px-6 py-3 font-bold text-sm ${activeTab === 'section3' ? 'bg-white border-t-2 border-t-blue-500 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>完了画面</button>
        </div>
        <div className="p-8 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">

          {activeTab === 'settings' ? (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 animate-fade-in">
              <div className="border-b pb-4 mb-4">
                <h4 className="font-bold text-slate-700 flex items-center gap-2 mb-2"><Info size={18} /> フォーム共通設定</h4>
                <p className="text-xs text-slate-500">招待状に記載される基本情報や、運用に関する設定です。</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div>
                  <label className="block text-xs font-bold text-red-600 mb-1">【必須】回答期限</label>
                  <input type="date" className="w-full border-2 border-red-100 bg-red-50 p-2 rounded focus:ring-2 focus:ring-red-500 outline-none" value={localConfig.settings?.deadline || ''} onChange={e => updateSetting('deadline', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">会場電話番号</label>
                  <input className="w-full border p-2 rounded" value={localConfig.settings?.venuePhone || ''} onChange={e => updateSetting('venuePhone', e.target.value)} placeholder="例: 090-0000-0000" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">出展費用 (1コマあたり)</label>
                  <input type="number" className="w-full border p-2 rounded" value={localConfig.settings?.feePerBooth || ''} onChange={e => updateSetting('feePerBooth', e.target.value)} placeholder="例: 30000" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1">搬入案内 (日時等)</label>
                  <input className="w-full border p-2 rounded" value={localConfig.settings?.moveInInfo || ''} onChange={e => updateSetting('moveInInfo', e.target.value)} placeholder="例: 前日13:00〜17:00" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1">送付先情報 (荷札用)</label>
                  <input className="w-full border p-2 rounded" value={localConfig.settings?.shippingInfo || ''} onChange={e => updateSetting('shippingInfo', e.target.value)} placeholder="例: 前日着指定（時間指定不可）" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1">送付先住所</label>
                  <input className="w-full border p-2 rounded" value={localConfig.settings?.shippingAddress || ''} onChange={e => updateSetting('shippingAddress', e.target.value)} placeholder="例: 〒000-0000 大阪府..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">当日朝礼時間</label>
                  <input className="w-full border p-2 rounded" value={localConfig.settings?.morningAssembly || ''} onChange={e => updateSetting('morningAssembly', e.target.value)} placeholder="例: 9:15" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">集荷方法</label>
                  <input className="w-full border p-2 rounded" value={localConfig.settings?.collectionMethod || ''} onChange={e => updateSetting('collectionMethod', e.target.value)} placeholder="例: ヤマト・佐川" />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                {/* Header for Section Edit */}
                <div className="flex justify-between items-center border-b pb-4">
                  <div>
                    <h4 className="font-bold text-slate-700">{activeTab === 'section1' ? '基本フォーム設定' : activeTab === 'section2' ? '詳細質問設定' : '完了画面設定'}</h4>
                  </div>
                  {activeTab === 'section1' && (
                    <button onClick={generateTemplateDescription} className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-200 hover:bg-amber-100 flex items-center gap-1">
                      <RefreshCw size={12} /> 基本設定から文面生成
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">セクションタイトル</label>
                  <input className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold" value={localConfig[activeTab]?.title} onChange={e => updateSection('title', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">説明文・案内文</label>
                  <textarea className="w-full border p-2 rounded h-32 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={localConfig[activeTab]?.description} onChange={e => updateSection('description', e.target.value)} />
                </div>
              </div>

              {localConfig[activeTab]?.items && (
                <div>
                  <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><List size={18} /> 質問項目設定</h4>
                  <div className="space-y-3">
                    {localConfig[activeTab].items.map(item => (
                      <div key={item.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <div
                          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => toggleItem(item.id)}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-bold px-2 py-1 rounded border ${item.type === 'radio' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{item.type === 'text' ? 'テキスト' : item.type === 'radio' ? 'ラジオボタン' : item.type === 'select' ? 'プルダウン' : item.type === 'checkbox' ? 'チェックボックス' : item.type === 'textarea' ? '長文' : item.type}</span>
                            <span className="font-bold text-slate-700">{item.label}</span>
                            {item.required && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">必須</span>}
                            {item.condition && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-1"><GitBranch size={10} /> 分岐あり</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} className="p-2 text-slate-300 hover:text-red-500 rounded hover:bg-red-50 transition-colors"><Trash2 size={16} /></button>
                            {expandedItems[item.id] ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                          </div>
                        </div>

                        {expandedItems[item.id] && (
                          <div className="p-4 bg-slate-50 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                            <div className="md:col-span-2">
                              <label className="block text-xs font-bold text-slate-400 mb-1">質問ラベル</label>
                              <input className="w-full border p-2 rounded text-sm" value={item.label} onChange={e => updateItem(item.id, 'label', e.target.value)} />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-400 mb-1">回答タイプ</label>
                              <select className="w-full border p-2 rounded text-sm bg-white" value={item.type} onChange={e => updateItem(item.id, 'type', e.target.value)}>
                                <option value="text">テキスト入力 (1行)</option>
                                <option value="textarea">テキスト入力 (複数行)</option>
                                <option value="radio">ラジオボタン (1つ選択)</option>
                                <option value="checkbox">チェックボックス (複数選択)</option>
                                <option value="select">プルダウン (1つ選択)</option>
                                <option value="email">メールアドレス</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-400 mb-1">必須設定</label>
                              <div className="flex items-center gap-2 mt-2">
                                <input type="checkbox" checked={item.required || false} onChange={e => updateItem(item.id, 'required', e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                                <span className="text-sm font-bold text-slate-700">必須にする</span>
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-bold text-slate-400 mb-1">補足説明 (Help Text)</label>
                              <input className="w-full border p-2 rounded text-sm" value={item.help || ''} onChange={e => updateItem(item.id, 'help', e.target.value)} />
                            </div>
                            {(item.type === 'select' || item.type === 'radio' || item.type === 'checkbox') && (
                              <div className="md:col-span-2 bg-white p-4 rounded border border-slate-200">
                                <label className="block text-xs font-bold text-slate-400 mb-2">選択肢設定</label>
                                <div className="space-y-2">
                                  {(item.options || []).map((opt, idx) => (
                                    <div key={idx} className="flex gap-2">
                                      <input
                                        className="flex-1 border p-2 rounded text-sm"
                                        value={opt}
                                        onChange={e => updateOptionText(item.id, idx, e.target.value)}
                                      />
                                      <button
                                        onClick={() => removeOption(item.id, idx)}
                                        className="bg-red-50 text-red-500 p-2 rounded hover:bg-red-100"
                                        title="削除"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => addOption(item.id)}
                                    className="w-full py-2 border-2 border-dashed border-slate-300 rounded text-slate-400 text-sm font-bold hover:bg-slate-50 hover:border-slate-400 flex items-center justify-center gap-2 transition-colors"
                                  >
                                    <Plus size={16} /> 選択肢を追加
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Conditional Logic UI */}
                            <div className="md:col-span-2 bg-amber-50 p-4 rounded border border-amber-200 mt-2">
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold text-amber-800 flex items-center gap-2"><GitBranch size={14} /> 表示条件設定 (条件付きで表示)</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={!!item.condition}
                                    onChange={e => updateCondition(item.id, 'enabled', e.target.checked)}
                                    className="w-4 h-4 text-amber-600 rounded"
                                  />
                                  <span className="text-xs font-bold text-amber-700">条件を有効にする</span>
                                </div>
                              </div>

                              {item.condition && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 animate-fade-in">
                                  <div>
                                    <label className="block text-[10px] font-bold text-amber-600 mb-1">この質問の回答が...</label>
                                    <select
                                      className="w-full border p-2 rounded text-xs bg-white"
                                      value={item.condition.targetId}
                                      onChange={e => updateCondition(item.id, 'targetId', e.target.value)}
                                    >
                                      <option value="">(質問を選択)</option>
                                      {getOtherItems(item.id).map(opt => (
                                        <option key={opt.id} value={opt.id}>{opt.label.length > 15 ? opt.label.substring(0, 15) + '...' : opt.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-amber-600 mb-1">条件 (一致/不一致)</label>
                                    <select
                                      className="w-full border p-2 rounded text-xs bg-white"
                                      value={item.condition.operator}
                                      onChange={e => updateCondition(item.id, 'operator', e.target.value)}
                                    >
                                      <option value="eq">と等しい時 (Equals)</option>
                                      <option value="neq">と異なる時 (Not Equals)</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-amber-600 mb-1">対象の値</label>
                                    {item.condition.targetId && (getOptionsForTarget(item.condition.targetId).length > 0) ? (
                                      <select
                                        className="w-full border p-2 rounded text-xs bg-white"
                                        value={item.condition.value}
                                        onChange={e => updateCondition(item.id, 'value', e.target.value)}
                                      >
                                        <option value="">(値を選択)</option>
                                        {getOptionsForTarget(item.condition.targetId).map(val => (
                                          <option key={val} value={val}>{val}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        className="w-full border p-2 rounded text-xs"
                                        placeholder="値を入力"
                                        value={item.condition.value}
                                        onChange={e => updateCondition(item.id, 'value', e.target.value)}
                                      />
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={addItem}
                      className="w-full py-3 bg-blue-50 border-2 border-blue-200 border-dashed rounded-xl text-blue-600 font-bold hover:bg-blue-100 hover:border-blue-300 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus size={20} /> 新しい質問を追加
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
        <div className="p-4 border-t flex justify-end gap-2 bg-white">
          <button onClick={onClose} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-slate-200">キャンセル</button>
          <button onClick={() => onSave(localConfig)} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg">設定を保存</button>
        </div>
      </div>
    </div >
  );
}


function VisitorFormEditor({ config, onSave }) {
  const [localConfig, setLocalConfig] = useState(JSON.parse(JSON.stringify(config)));
  const [newItemName, setNewItemName] = useState('');
  const updateField = (key, val) => setLocalConfig({ ...localConfig, [key]: val });
  const updateItem = (id, key, val) => {
    const newItems = localConfig.items.map(item => item.id === id ? { ...item, [key]: val } : item);
    setLocalConfig({ ...localConfig, items: newItems });
  };
  const deleteItem = (id) => { if (window.confirm('削除しますか？')) setLocalConfig({ ...localConfig, items: localConfig.items.filter(i => i.id !== id) }); };
  const addItem = () => { if (!newItemName) return; setLocalConfig({ ...localConfig, items: [...localConfig.items, { id: `custom-${Date.now()}`, label: newItemName, type: 'text', help: '', required: false }] }); setNewItemName(''); };

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-slate-800">登録フォーム編集</h2><button onClick={() => onSave(localConfig)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2"><Save size={18} /> 保存する</button></div>
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm"><div className="space-y-4"><div><label className="block text-sm font-bold text-slate-500 mb-1">フォームタイトル</label><input className="w-full border p-2 rounded" value={localConfig.title} onChange={e => updateField('title', e.target.value)} /></div><div><label className="block text-sm font-bold text-slate-500 mb-1">説明文</label><textarea className="w-full border p-2 rounded h-24" value={localConfig.description} onChange={e => updateField('description', e.target.value)} /></div></div></div>
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6"><h3 className="font-bold text-slate-700 border-b pb-2 mb-4">質問項目</h3><div className="space-y-3">{localConfig.items.map((item, idx) => (<div key={item.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm group"><div className="flex justify-between items-start mb-2"><span className="text-xs font-bold text-slate-400">項目 {idx + 1} ({item.type})</span><button onClick={() => deleteItem(item.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-xs font-bold mb-1">質問ラベル</label><input className="w-full border p-2 rounded text-sm" value={item.label} onChange={e => updateItem(item.id, 'label', e.target.value)} /></div><div><label className="block text-xs font-bold mb-1">補足説明</label><input className="w-full border p-2 rounded text-sm" value={item.help || ''} onChange={e => updateItem(item.id, 'help', e.target.value)} /></div></div><div className="mt-2 flex items-center gap-2"><label className="flex items-center gap-1 text-sm cursor-pointer"><input type="checkbox" checked={item.required} onChange={e => updateItem(item.id, 'required', e.target.checked)} /> 必須項目</label>{item.type === 'select' && (<div className="flex-1 ml-4"><label className="block text-xs font-bold mb-1">選択肢 (カンマ区切り)</label><input className="w-full border p-1 rounded text-xs" value={item.options ? item.options.join(',') : ''} onChange={e => updateItem(item.id, 'options', e.target.value.split(','))} /></div>)}</div></div>))}</div><div className="mt-6 flex gap-2"><input className="flex-1 border p-2 rounded" placeholder="新しい質問タイトル..." value={newItemName} onChange={e => setNewItemName(e.target.value)} /><button onClick={addItem} className="bg-slate-700 text-white px-4 py-2 rounded font-bold text-sm">新規追加</button></div></div>
    </div>
  );
}

function SimulatedPublicVisitorForm({ config, onClose, onSubmit }) {
  const [formData, setFormData] = useState({});
  const [submittedData, setSubmittedData] = useState(null);

  const handleChange = (id, val) => { setFormData({ ...formData, [id]: val }); };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulate ID generation
    const newId = crypto.randomUUID();
    const finalData = { ...formData, id: newId, status: 'registered' };

    onSubmit(finalData);
    setSubmittedData(finalData);
  };

  if (submittedData) {
    return (
      <div className="fixed inset-0 bg-slate-900/90 z-[90] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up relative p-8 text-center">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X /></button>
          <div className="mb-4 text-green-500 flex justify-center"><CheckCircle size={64} /></div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">登録完了</h2>
          <p className="text-slate-500 mb-6">ご来場ありがとうございます。<br />以下のQRコードを受付にご提示ください。</p>
          <div className="bg-white p-4 rounded-xl border-2 border-slate-100 inline-block mb-6 shadow-sm">
            {/* QR Code Canvas */}
            <QRCodeCanvas
              value={JSON.stringify({ id: submittedData.id, type: 'visitor', name: submittedData.repName })}
              size={200}
              level={"H"}
              includeMargin={true}
            />
          </div>
          <p className="text-xs text-slate-400 mb-4 font-mono">ID: {submittedData.id.slice(0, 8)}...</p>
          <button onClick={() => {
            // 画像として保存するロジックなどもここに追加可能
            const canvas = document.querySelector('canvas');
            if (canvas) {
              const url = canvas.toDataURL("image/png");
              const link = document.createElement('a');
              link.download = `visitor_qr_${submittedData.id}.png`;
              link.href = url;
              link.click();
            }
          }} className="mb-2 w-full border border-blue-200 text-blue-600 font-bold py-2 rounded-lg hover:bg-blue-50 text-sm flex items-center justify-center gap-2"><Download size={16} /> QR画像を保存</button>
          <button onClick={onClose} className="w-full bg-slate-800 text-white font-bold py-3 rounded-lg hover:bg-slate-700 transition-colors">閉じる</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/90 z-[90] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg my-8 overflow-hidden animate-slide-up relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-blue-200 bg-black/20 rounded-full p-1"><X size={20} /></button>
        <div className="bg-blue-600 p-8 text-white"><h2 className="text-2xl font-bold mb-2">{config.title}</h2><p className="text-blue-100 text-sm">{config.description}</p></div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
          {config.items && config.items.map(item => (<div key={item.id}><label className="block text-sm font-bold text-slate-700 mb-1">{item.label} {item.required && <span className="text-red-500">*</span>}</label>{item.type === 'select' ? (<select required={item.required} className="w-full border border-slate-300 p-3 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-400" onChange={e => handleChange(item.id, e.target.value)}><option value="">選択してください</option>{item.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>) : (<input type={item.type} required={item.required} className="w-full border border-slate-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-400" placeholder={item.help} onChange={e => handleChange(item.id, e.target.value)} />)}{item.help && item.type !== 'text' && <p className="text-xs text-slate-400 mt-1">{item.help}</p>}</div>))}
          <div className="pt-4"><button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"><QrCode size={20} /> 登録して入場QRを発行</button></div>
        </form>
      </div>
    </div>
  );
}



// メーカー回答データ編集用モーダル
function MakerDataEditModal({ maker, onSave, onClose }) {
  // 初期値の構築: responseまたはルートから取得
  const getInitVal = (key) => {
    if (maker.response && maker.response[key] !== undefined) return maker.response[key];
    return maker[key] || '';
  };

  const [formData, setFormData] = useState({
    supplierCode: getInitVal('supplierCode') || getInitVal('code'), // 仕入先コード
    category: getInitVal('category'), // カテゴリ
    boothCount: getInitVal('boothCount'),
    staffCount: getInitVal('staffCount'),
    lunchCount: getInitVal('lunchCount'),
    itemsDesk: getInitVal('itemsDesk') || getInitVal('desk'),
    itemsChair: getInitVal('itemsChair') || getInitVal('chair'),
    itemsPower: getInitVal('itemsPower') || getInitVal('power'),
    powerDetail: getInitVal('powerDetail') || getInitVal('powerDetails'),
    note: getInitVal('note'),
    products: getInitVal('products') // 展示品
  });

  const handleChange = (k, v) => setFormData(prev => ({ ...prev, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2"><Edit3 size={18} /> 回答データの編集</h3>
          <button onClick={onClose}><X size={20} className="hover:text-slate-300" /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 基本情報編集エリア */}
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 grid grid-cols-2 gap-4 mb-2">
            <div>
              <label className="block text-xs font-bold text-blue-800 mb-1">仕入先コード</label>
              <input className="w-full border p-2 rounded bg-white text-sm" value={formData.supplierCode || ''} onChange={e => handleChange('supplierCode', e.target.value)} placeholder="000000" />
            </div>
            <div>
              <label className="block text-xs font-bold text-blue-800 mb-1">カテゴリ</label>
              <input className="w-full border p-2 rounded bg-white text-sm" value={formData.category || ''} onChange={e => handleChange('category', e.target.value)} placeholder="例: ベッド" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">希望コマ数</label>
              <input className="w-full border p-2 rounded" value={formData.boothCount} onChange={e => handleChange('boothCount', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">参加人数</label>
              <input className="w-full border p-2 rounded" value={formData.staffCount} onChange={e => handleChange('staffCount', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">昼食数</label>
              <input className="w-full border p-2 rounded" value={formData.lunchCount} onChange={e => handleChange('lunchCount', e.target.value)} />
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-bold text-sm text-slate-700 mb-3">備品・設備</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">長机</label>
                <select className="w-full border p-2 rounded bg-white" value={formData.itemsDesk} onChange={e => handleChange('itemsDesk', e.target.value)}>
                  {[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">椅子</label>
                <select className="w-full border p-2 rounded bg-white" value={formData.itemsChair} onChange={e => handleChange('itemsChair', e.target.value)}>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">電源</label>
                <select className="w-full border p-2 rounded bg-white" value={formData.itemsPower} onChange={e => handleChange('itemsPower', e.target.value)}>
                  <option value="不要">不要</option>
                  <option value="必要">必要</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">電源詳細</label>
                <input className="w-full border p-2 rounded" value={formData.powerDetail} onChange={e => handleChange('powerDetail', e.target.value)} placeholder="例: 500W x 2" />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">展示予定品</label>
              <textarea className="w-full border p-2 rounded h-20 text-sm" value={formData.products} onChange={e => handleChange('products', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">特記事項 (Note)</label>
              <textarea className="w-full border p-2 rounded h-20 text-sm" value={formData.note} onChange={e => handleChange('note', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:bg-slate-200 rounded font-bold">キャンセル</button>
          <button onClick={() => onSave(formData)} className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 shadow">保存する</button>
        </div>
      </div>
    </div>
  );
}

// Icon helper
const TryIcon = ({ size }) => <div className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center font-bold text-[10px]">?</div>;

const EditableBudgetRow = ({ item, isEditing, editData, setEditData, onSave, onCancel, onDelete, onStartEdit }) => {
  if (isEditing) {
    return (
      <div className="flex flex-col md:flex-row gap-2 p-2 bg-yellow-50 rounded border border-yellow-200 animate-fade-in">
        <input className="flex-1 border p-1 rounded text-xs w-full" value={editData.item} onChange={e => setEditData({ ...editData, item: e.target.value })} autoFocus placeholder="項目名" />
        <input type="number" className="w-full md:w-24 border p-1 rounded text-xs" value={editData.amount} onChange={e => setEditData({ ...editData, amount: parseInt(e.target.value) || 0 })} placeholder="金額" />
        <input className="flex-1 border p-1 rounded text-xs w-full" value={editData.note} onChange={e => setEditData({ ...editData, note: e.target.value })} placeholder="備考" />
        <div className="flex gap-2 justify-end">
          <button onClick={onSave} className="text-green-600 hover:text-green-800 p-1"><Check size={20} /></button>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-between p-3 bg-white rounded border border-slate-100 hover:shadow-sm transition-all group">
      <span className="flex items-center gap-2">{item.item} <span className="text-xs text-slate-400">({item.note})</span></span>
      <div className="flex items-center gap-3">
        <span className="font-bold">¥{item.amount.toLocaleString()}</span>
        <button onClick={() => onStartEdit(item)} className="text-slate-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"><Edit3 size={14} /></button>
        <button onClick={() => onDelete(item.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
      </div>
    </div>
  );
};

function TabBudget({ exhibition, updateMainData }) {
  const { venueDetails, otherBudgets, makers, targetProfit, lectures, formConfig } = exhibition;
  const equipmentTotal = (venueDetails?.equipment || []).reduce((sum, item) => sum + (item.count * item.price), 0);
  const feePerBooth = formConfig?.settings?.feePerBooth ? Number(formConfig.settings.feePerBooth) : 30000;
  const boothIncome = (makers || []).filter(m => m.status === 'confirmed').reduce((sum, m) => sum + (extractNum(m.boothCount) * feePerBooth), 0);

  // 講演会費用
  const lectureList = lectures || [];
  const lectureFees = lectureList.reduce((sum, l) => sum + Number(l.fee || 0) + Number(l.transportFee || 0), 0);
  const lectureTotalFees = lectureFees;

  const [newItem, setNewItem] = useState({ type: 'expense', item: '', amount: 0, note: '' });
  const [editingId, setEditingId] = useState(null);
  const [editingItemData, setEditingItemData] = useState(null);

  const handleAddItem = () => {
    if (!newItem.item) {
      alert("項目名を入力してください");
      return;
    }
    const updatedBudgets = [...(otherBudgets || []), { ...newItem, id: Date.now() }];
    updateMainData('otherBudgets', updatedBudgets);
    setNewItem({ type: 'expense', item: '', amount: 0, note: '' });
  };

  const removeItem = (id) => {
    if (window.confirm('削除しますか？')) {
      const updatedBudgets = otherBudgets.filter(b => b.id !== id);
      updateMainData('otherBudgets', updatedBudgets);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditingItemData({ ...item });
  };

  const saveEdit = () => {
    const updatedBudgets = otherBudgets.map(b => b.id === editingId ? editingItemData : b);
    updateMainData('otherBudgets', updatedBudgets);
    setEditingId(null);
  };

  const incomes = (otherBudgets || []).filter(b => b.type === 'income');
  const expenses = (otherBudgets || []).filter(b => b.type === 'expense');
  const totalIncome = boothIncome + incomes.reduce((sum, i) => sum + i.amount, 0);
  const totalExpense = (venueDetails.cost || 0) + equipmentTotal + lectureTotalFees + expenses.reduce((sum, i) => sum + i.amount, 0);

  // Excel Download using Template from public folder
  const handleExcelDownload = async () => {
    try {
      // Dynamic import for ExcelJS to reduce initial bundle size and build memory usage
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();

      // テンプレートファイルを取得（日本語ファイル名対応）
      const templateFileName = '展示会収支報告書 (収支報告書元データ）.xlsx';
      const response = await fetch(encodeURI('/' + templateFileName));
      if (!response.ok) {
        throw new Error('テンプレートファイルの取得に失敗しました');
      }
      const arrayBuffer = await response.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);

      const worksheet = workbook.worksheets[0];
      console.log('[Excel] Template loaded - Sheet name:', worksheet.name);
      console.log('[Excel] D1 value:', worksheet.getCell('D1').value);

      // A5-G5: 展示会の名称（マージセルに対応）
      const exhibitionTitle = `${exhibition.place || ''}　${exhibition.title || '展示会'}`;
      worksheet.getCell('A5').value = exhibitionTitle;

      // I5: 開催日
      const dateStr = (exhibition.dates && exhibition.dates.length > 0) ? exhibition.dates[0] : '';
      worksheet.getCell('I5').value = `開催日: ${dateStr}`;

      // 収支データを行7から入力していく
      // テンプレートの構造: A=収支, B=日付, C-F=項目, G-H=金額, I=備考
      let currentRow = 7;

      // 収入項目
      // 出展費収入
      worksheet.getCell(`A${currentRow}`).value = '収入';
      worksheet.getCell(`C${currentRow}`).value = '出展費収入';
      worksheet.getCell(`G${currentRow}`).value = boothIncome;
      worksheet.getCell(`I${currentRow}`).value = `確定${(makers || []).filter(m => m.status === 'confirmed').length}社`;
      currentRow++;

      // その他収入
      incomes.forEach(i => {
        worksheet.getCell(`A${currentRow}`).value = '収入';
        worksheet.getCell(`C${currentRow}`).value = i.item;
        worksheet.getCell(`G${currentRow}`).value = i.amount;
        worksheet.getCell(`I${currentRow}`).value = i.note || '';
        currentRow++;
      });

      // 支出項目 (正の値で入力)
      // 会場費
      worksheet.getCell(`A${currentRow}`).value = '支出';
      worksheet.getCell(`C${currentRow}`).value = '会場利用料';
      worksheet.getCell(`G${currentRow}`).value = venueDetails?.cost || 0;
      currentRow++;

      // 備品費
      if (equipmentTotal > 0) {
        worksheet.getCell(`A${currentRow}`).value = '支出';
        worksheet.getCell(`C${currentRow}`).value = '備品・レンタル費';
        worksheet.getCell(`G${currentRow}`).value = equipmentTotal;
        currentRow++;
      }

      // 講演会費用
      if (lectureTotalFees > 0) {
        worksheet.getCell(`A${currentRow}`).value = '支出';
        worksheet.getCell(`C${currentRow}`).value = '講演会費用';
        worksheet.getCell(`G${currentRow}`).value = lectureTotalFees;
        currentRow++;
      }

      // その他支出
      expenses.forEach(i => {
        worksheet.getCell(`A${currentRow}`).value = '支出';
        worksheet.getCell(`C${currentRow}`).value = i.item;
        worksheet.getCell(`G${currentRow}`).value = i.amount;
        worksheet.getCell(`I${currentRow}`).value = i.note || '';
        currentRow++;
      });

      // 計算結果（テンプレートのRow21にある数式セルを更新、または新規行に記載）
      // データ行が21行目を超える場合はそのまま次の行に、そうでない場合は21行目を使用
      const sumRow = currentRow > 21 ? currentRow : 21;
      const lastDataRow = currentRow - 1;

      // SUMIF関数を設定: 収入計 - 支出計
      // A列が"収入"のG列合計 - A列が"支出"のG列合計
      worksheet.getCell(`G${sumRow}`).value = { formula: `SUMIF(A7:A${lastDataRow},"収入",G7:G${lastDataRow})-SUMIF(A7:A${lastDataRow},"支出",G7:G${lastDataRow})` };


      // もしデータ行が21行目より下に行ってしまった場合、テンプレートの21行目の古い数式を消す必要があるかもしれませんが、
      // 上書きで対応できているはずです。逆にデータが少なくて20行目で終わった場合、G21に数式が入ります。


      // ファイルをダウンロード
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const filename = `収支報告書_${exhibition.title || 'project'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      saveAs(blob, filename);

    } catch (e) {
      console.error('Excel出力エラー:', e);
      alert('Excel出力エラー: ' + e.message);
    }
  };


  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <div className="bg-slate-800 text-white p-6 rounded-xl mb-8 flex justify-between items-center shadow-lg">
        <div>
          <p className="text-sm text-slate-400 mb-1">最終収支</p>
          <p className={`text-4xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>¥{(totalIncome - totalExpense).toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400 mb-1">目標利益</p>
          <p className="text-xl font-bold">¥{(targetProfit || 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-6 gap-4">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Wallet className="text-blue-500" /> 収支管理</h3>
        <div className="flex gap-2">
          <button onClick={handleExcelDownload} className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 flex items-center gap-2 text-sm transition-colors shadow-md">
            <FileSpreadsheet size={16} /> Excel出力
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Income Section */}
        <div className="bg-blue-50/50 border border-blue-100 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-blue-100 p-4 flex justify-between items-center">
            <h4 className="font-bold text-blue-900 flex items-center gap-2"><TrendingUp size={18} /> 収入の部</h4>
            <span className="text-xl font-bold text-blue-700">¥{totalIncome.toLocaleString()}</span>
          </div>
          <div className="p-4 space-y-2">
            <div className="flex justify-between p-3 bg-white rounded border border-blue-100">
              <span className="font-bold text-slate-700">出展費用 (確定メーカー分)</span>
              <span className="font-bold">¥{boothIncome.toLocaleString()}</span>
            </div>
            {incomes.map(i => (
              <EditableBudgetRow key={i.id} item={i} isEditing={editingId === i.id} editData={editingItemData} setEditData={setEditingItemData} onSave={saveEdit} onCancel={() => setEditingId(null)} onDelete={removeItem} onStartEdit={startEdit} />
            ))}
          </div>
        </div>

        {/* Expense Section */}
        <div className="bg-red-50/50 border border-red-100 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-red-100 p-4 flex justify-between items-center">
            <h4 className="font-bold text-red-900 flex items-center gap-2"><TrendingUp size={18} className="rotate-180" /> 支出の部</h4>
            <span className="text-xl font-bold text-red-700">¥{totalExpense.toLocaleString()}</span>
          </div>
          <div className="p-4 space-y-2">
            <div className="flex justify-between p-3 bg-white rounded border border-red-100">
              <span className="font-bold text-slate-700">会場利用料</span>
              <span className="font-bold">¥{(venueDetails.cost || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-3 bg-white rounded border border-red-100">
              <span className="font-bold text-slate-700">備品・レイアウト費</span>
              <span className="font-bold">¥{equipmentTotal.toLocaleString()}</span>
            </div>
            {lectureTotalFees > 0 && (
              <div className="flex justify-between p-3 bg-purple-50 rounded border border-purple-200">
                <span className="flex items-center gap-2 text-purple-800 font-bold"><Mic size={14} className="text-purple-500" /> 講演会費用</span>
                <span className="font-bold text-purple-700">¥{lectureTotalFees.toLocaleString()}</span>
              </div>
            )}
            {expenses.map(i => (
              <EditableBudgetRow key={i.id} item={i} isEditing={editingId === i.id} editData={editingItemData} setEditData={setEditingItemData} onSave={saveEdit} onCancel={() => setEditingId(null)} onDelete={removeItem} onStartEdit={startEdit} />
            ))}
          </div>
        </div>
      </div>

      {/* Add Item Form */}
      <div className="bg-slate-100 p-5 rounded-xl flex flex-wrap gap-4 items-end border border-slate-200 shadow-inner">
        <div>
          <label className="text-xs font-bold text-slate-500 mb-1 block">区分</label>
          <select value={newItem.type} onChange={e => setNewItem({ ...newItem, type: e.target.value })} className="p-2 border border-slate-300 rounded text-sm w-32 focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="income">収入 (+)</option>
            <option value="expense">支出 (-)</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs font-bold text-slate-500 mb-1 block">項目名</label>
          <input type="text" value={newItem.item} onChange={e => setNewItem({ ...newItem, item: e.target.value })} className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="例: 協賛金 / 打ち上げ代" />
        </div>
        <div className="w-32">
          <label className="text-xs font-bold text-slate-500 mb-1 block">金額</label>
          <input type="number" value={newItem.amount === 0 ? '' : newItem.amount} onChange={e => setNewItem({ ...newItem, amount: parseInt(e.target.value) || 0 })} className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0" />
        </div>
        <div className="flex-1">
          <label className="text-xs font-bold text-slate-500 mb-1 block">備考</label>
          <input type="text" value={newItem.note} onChange={e => setNewItem({ ...newItem, note: e.target.value })} className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="詳細メモ" />
        </div>
        <button onClick={handleAddItem} className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-700 text-sm h-[38px] shadow-lg transform transition-transform active:scale-95">追加</button>
      </div>
    </div>
  );
}

// LectureFormModal: 講演フォームモーダル（外部コンポーネントでスクロール問題を防止）
function LectureFormModal({ data, updateField, onSave, onCancel, title, staffList = [] }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="bg-purple-50 p-6 border-b flex justify-between items-center sticky top-0 z-10">
          <h3 className="text-xl font-bold text-purple-800 flex items-center gap-2"><Mic size={20} /> {title}</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>
        <div className="p-6 space-y-6">
          {/* 講師情報 */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Users size={16} /> 講師情報</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">講師名 *</label>
                <input className="w-full border p-2 rounded" value={data.speakerName || ''} onChange={e => updateField('speakerName', e.target.value)} placeholder="山田 太郎" />
              </div>
              <div>
                <div><label className="block text-sm font-bold mb-1">写真 (選択)</label><input type="file" accept="image/*" onChange={(e) => { const file = e.target.files[0]; if (file) { if (file.size > 800 * 1024) { alert("ファイルサイズが大きすぎます (800KB以下にしてください)"); return; } const reader = new FileReader(); reader.onloadend = () => { updateField('speakerPhoto', reader.result); }; reader.readAsDataURL(file); } }} className="w-full text-sm border p-2 rounded" />{data.speakerPhoto && <div className="mt-2"><img src={data.speakerPhoto} alt="Preview" className="w-20 h-20 object-cover rounded-full border border-slate-200" /><button onClick={() => updateField('speakerPhoto', '')} className="text-xs text-red-500 mt-1 hover:underline">削除</button></div>}</div>
                <div><label className="block text-sm font-bold mb-1">または画像URL</label><input className="w-full border p-2 rounded" value={data.speakerPhoto || ''} onChange={e => updateField('speakerPhoto', e.target.value)} placeholder="https://..." /></div>
              </div>
            </div>
          </div>

          {/* 講演内容 */}
          <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
            <h4 className="font-bold text-purple-700 mb-4 flex items-center gap-2"><FileText size={16} /> 講演内容</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">テーマ *</label>
                <input className="w-full border p-2 rounded" value={data.theme || ''} onChange={e => updateField('theme', e.target.value)} placeholder="○○について" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">講演内容概略</label>
                <textarea className="w-full border p-2 rounded h-24" value={data.summary || ''} onChange={e => updateField('summary', e.target.value)} placeholder="講演の概要を入力..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">チラシ用文言</label>
                <textarea className="w-full border p-2 rounded h-16" value={data.flyerText || ''} onChange={e => updateField('flyerText', e.target.value)} placeholder="チラシに掲載する文言" />
              </div>
            </div>
          </div>

          {/* 開催情報 */}
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <h4 className="font-bold text-blue-700 mb-4 flex items-center gap-2"><Clock size={16} /> 開催情報</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">開始時間</label>
                <input type="time" className="w-full border p-2 rounded" value={data.time || ''} onChange={e => updateField('time', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">講演時間(分)</label>
                <input type="number" className="w-full border p-2 rounded" value={data.duration || ''} onChange={e => updateField('duration', e.target.value)} placeholder="60" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">会場 / 場所</label>
                <input className="w-full border p-2 rounded" value={data.location || ''} onChange={e => updateField('location', e.target.value)} placeholder="セミナールームA" />
              </div>
            </div>
          </div>

          {/* 費用 */}
          <div className="bg-green-50 p-4 rounded-xl border border-green-200">
            <h4 className="font-bold text-green-700 mb-4 flex items-center gap-2"><Wallet size={16} /> 費用</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">講演費 (円)</label>
                <input type="number" className="w-full border p-2 rounded" value={data.speakerFee || 0} onChange={e => updateField('speakerFee', parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">交通費 (円)</label>
                <input type="number" className="w-full border p-2 rounded" value={data.transportFee || 0} onChange={e => updateField('transportFee', parseInt(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          {/* 準備・担当 */}
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
            <h4 className="font-bold text-amber-700 mb-4 flex items-center gap-2"><Briefcase size={16} /> 準備・担当</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">担当者</label>
                {staffList.length > 0 ? (
                  <select className="w-full border p-2 rounded" value={data.person || ''} onChange={e => updateField('person', e.target.value)}>
                    <option value="">選択してください</option>
                    {staffList.map((s, i) => <option key={i} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input className="w-full border p-2 rounded" value={data.person || ''} onChange={e => updateField('person', e.target.value)} placeholder="担当者名" />
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">資料格納場所URL</label>
                <input className="w-full border p-2 rounded" value={data.materialsUrl || ''} onChange={e => updateField('materialsUrl', e.target.value)} placeholder="https://drive.google.com/..." />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-500 mb-1">準備するもの</label>
              <textarea className="w-full border p-2 rounded h-16" value={data.preparation || ''} onChange={e => updateField('preparation', e.target.value)} placeholder="マイク、プロジェクター、..." />
            </div>
          </div>
        </div>
        <div className="p-6 border-t flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onCancel} className="px-6 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">キャンセル</button>
          <button onClick={onSave} className="px-6 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 shadow-lg">保存</button>
        </div>
      </div>
    </div>
  );
}


// TabSchedule: スケジュール管理
function TabSchedule({ scheduleData, updateMainData, staff, dates, preDates }) {
  const [activeSchedule, setActiveSchedule] = useState(scheduleData || { dayBefore: [], eventDay: [] });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [mobileActiveTab, setMobileActiveTab] = useState('eventDay'); // New state for mobile switch // 1=Normal(60px/h), 2=Large(120px/h), 0.5=Small(30px/h)
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [originalItem, setOriginalItem] = useState(null); // For unsaved changes detection
  const [targetType, setTargetType] = useState('eventDay');

  // Constants
  const START_HOUR = 6;
  const END_HOUR = 22;
  const HOURS_COUNT = END_HOUR - START_HOUR;
  const BASE_HOUR_HEIGHT = 80;

  const hourHeight = BASE_HOUR_HEIGHT * zoomLevel;
  const totalHeight = hourHeight * HOURS_COUNT;

  useEffect(() => {
    if (scheduleData) setActiveSchedule(scheduleData);
  }, [scheduleData]);

  // Helpers
  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const minutesToTime = (totalMinutes) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const getTopPosition = (timeStr) => {
    const minutes = timeToMinutes(timeStr);
    const startMinutes = START_HOUR * 60;
    const offsetMinutes = Math.max(0, minutes - startMinutes);
    return (offsetMinutes / 60) * hourHeight;
  };

  const getTimeFromY = (y) => {
    const hoursFromStart = y / hourHeight;
    const totalMinutes = (START_HOUR * 60) + (hoursFromStart * 60);
    // Snap to 15 min
    const snappedMinutes = Math.round(totalMinutes / 15) * 15;
    return minutesToTime(snappedMinutes);
  };

  // CRUD
  const saveItem = () => {
    if (!editingItem.title) return;
    let [h] = editingItem.time.split(':').map(Number);
    if (h < START_HOUR) editingItem.time = `${String(START_HOUR).padStart(2, '0')}:00`;

    const list = activeSchedule[targetType] || [];
    const exists = list.find(i => i.id === editingItem.id);
    let updatedList = exists
      ? list.map(i => i.id === editingItem.id ? editingItem : i)
      : [...list, editingItem];

    updatedList.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    const newSchedule = { ...activeSchedule, [targetType]: updatedList };

    setActiveSchedule(newSchedule);
    updateMainData('schedule', newSchedule);
    setIsEditOpen(false);
  };

  const deleteItem = () => {
    if (!editingItem) return;
    if (!confirm('削除しますか？')) return;
    const list = activeSchedule[targetType].filter(i => i.id !== editingItem.id);
    const newSchedule = { ...activeSchedule, [targetType]: list };
    setActiveSchedule(newSchedule);
    updateMainData('schedule', newSchedule);
    setIsEditOpen(false);
  };

  // Helper to open edit modal and track original state
  const openEditModal = (item, type) => {
    // Calculate default endTime as startTime + 1 hour if not set
    let defaultEndTime = item.endTime || '';
    if (!defaultEndTime && item.time) {
      const startMinutes = timeToMinutes(item.time);
      const endMinutes = Math.min(startMinutes + 60, END_HOUR * 60); // Cap at END_HOUR
      defaultEndTime = minutesToTime(endMinutes);
    }
    const itemWithDefaults = { ...item, endTime: defaultEndTime };
    setTargetType(type);
    setEditingItem(itemWithDefaults);
    setOriginalItem(JSON.parse(JSON.stringify(itemWithDefaults))); // Deep copy
    setIsEditOpen(true);
  };

  // Check if item has unsaved changes
  const hasUnsavedChanges = () => {
    if (!editingItem || !originalItem) return false;
    return JSON.stringify(editingItem) !== JSON.stringify(originalItem);
  };

  // Close modal with unsaved changes confirmation
  const handleCloseModal = () => {
    if (hasUnsavedChanges()) {
      if (!confirm('未保存の変更があります。破棄してもよろしいですか？')) {
        return;
      }
    }
    setIsEditOpen(false);
    setEditingItem(null);
    setOriginalItem(null);
  };


  const TimelineColumn = ({ title, type, items, dateLabel, colorClass }) => {
    return (
      <div className={`flex-1 w-full md:min-w-[350px] bg-white rounded-xl border border-slate-200 flex flex-col h-full overflow-hidden shadow-sm`}>
        {/* Header */}
        <div className={`p-3 border-b-2 flex justify-between items-center ${colorClass}`}>
          <div>
            <h4 className="font-bold text-slate-700">{title}</h4>
            <p className="text-xs text-slate-500 font-bold">{dateLabel}</p>
          </div>
          <button onClick={() => openEditModal({ id: crypto.randomUUID(), time: '09:00', title: '', assignee: '', desc: '' }, type)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-lg">
            <Plus size={16} />
          </button>
        </div>

        {/* Timeline Body */}
        <div
          className="flex-1 overflow-y-auto relative bg-slate-50 scrollbar-thin select-none"
        >
          <div
            style={{ height: totalHeight, position: 'relative' }}
            onClick={(e) => {
              // Only trigger if clicking on the background (not on an item)
              if (e.target === e.currentTarget || e.target.closest('.schedule-item') === null) {
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top + e.currentTarget.parentElement.scrollTop;
                const clickedTime = getTimeFromY(y);
                openEditModal({ id: crypto.randomUUID(), time: clickedTime, title: '', assignee: '', desc: '' }, type);
              }
            }}
            className="cursor-crosshair"
          >
            {/* Grid Lines */}
            {Array.from({ length: HOURS_COUNT }).map((_, i) => {
              const hour = START_HOUR + i;
              return (
                <div key={hour} style={{ height: hourHeight, top: i * hourHeight }} className="absolute w-full border-b border-slate-200 box-border pointer-events-none">
                  <span className="absolute -top-3 left-1 text-xs font-bold text-slate-400 select-none">{hour}:00</span>
                  <div className="absolute w-full border-b border-slate-100/50" style={{ top: '25%' }}></div>
                  <div className="absolute w-full border-b border-slate-100" style={{ top: '50%' }}></div>
                  <div className="absolute w-full border-b border-slate-100/50" style={{ top: '75%' }}></div>
                </div>
              );
            })}

            {/* Items */}
            {items?.map(item => {
              const top = getTopPosition(item.time);
              // Calculate height from endTime if set, otherwise default to 45 min
              const startMinutes = timeToMinutes(item.time);
              const endMinutes = item.endTime ? timeToMinutes(item.endTime) : startMinutes + 45;
              const durationMinutes = Math.max(endMinutes - startMinutes, 15); // Minimum 15 min
              const height = (durationMinutes / 60) * hourHeight;

              return (
                <div
                  key={item.id}
                  onClick={(e) => { e.stopPropagation(); openEditModal(item, type); }}
                  style={{ top, height: Math.max(height, 30) }}
                  className="schedule-item absolute left-10 right-2 rounded-lg bg-blue-100 border border-blue-300 shadow-sm p-1 px-2 cursor-pointer hover:bg-blue-200 hover:shadow-md transition-all z-10 overflow-hidden"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-xs text-blue-800">{item.time}{item.endTime && ` - ${item.endTime}`}</span>
                  </div>
                  <div className="font-bold text-sm text-slate-800 leading-tight truncate">{item.title}</div>
                  {item.assignee && <div className="text-[10px] text-slate-500 truncate flex items-center gap-1"><Users size={10} /> {item.assignee}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 h-[calc(100vh-200px)] flex flex-col animate-fade-in">
      <div className="flex justify-between items-center mb-4 shrink-0">
        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800"><Calendar className="text-blue-600" /> スケジュール (6:00 - 22:00)</h2>
        <div className="flex items-center gap-4">

          <div className="flex bg-slate-100 rounded-lg p-1 border">
            <button onClick={() => setZoomLevel(0.6)} className={`px-3 py-1 text-xs font-bold rounded ${zoomLevel === 0.6 ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>縮小</button>
            <button onClick={() => setZoomLevel(1)} className={`px-3 py-1 text-xs font-bold rounded ${zoomLevel === 1 ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>標準</button>
            <button onClick={() => setZoomLevel(1.5)} className={`px-3 py-1 text-xs font-bold rounded ${zoomLevel === 1.5 ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>拡大</button>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span className="bg-slate-100 text-blue-600 px-2 py-1 rounded font-bold border">{zoomLevel >= 1.5 ? '30分単位' : zoomLevel >= 1 ? '1時間単位' : '2時間単位'}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-x-hidden md:overflow-hidden overflow-y-auto md:overflow-y-hidden pb-20 md:pb-0">

        {/* Mobile Toggle Switch */}
        <div className="md:hidden flex bg-slate-100 p-1 rounded-lg mb-2 shrink-0">
          <button
            onClick={() => setMobileActiveTab('dayBefore')}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${mobileActiveTab === 'dayBefore' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            前日搬入/準備
          </button>
          <button
            onClick={() => setMobileActiveTab('eventDay')}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${mobileActiveTab === 'eventDay' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            開催当日
          </button>
        </div>

        <div className={`flex-1 min-h-[500px] md:h-full md:min-h-0 ${mobileActiveTab === 'dayBefore' ? 'block' : 'hidden md:block'}`}>
          <TimelineColumn
            title="前日搬入 / 準備"
            type="dayBefore"
            items={activeSchedule.dayBefore}
            dateLabel={preDates?.join(', ')}
            colorClass="border-amber-400 text-amber-700 bg-amber-50"
          />
        </div>
        <div className={`flex-1 min-h-[500px] md:h-full md:min-h-0 ${mobileActiveTab === 'eventDay' ? 'block' : 'hidden md:block'}`}>
          <TimelineColumn
            title="開催当日"
            type="eventDay"
            items={activeSchedule.eventDay}
            dateLabel={dates?.join(', ')}
            colorClass="border-blue-500 text-blue-700 bg-blue-50"
          />
        </div>
      </div>

      {isEditOpen && editingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-slide-up relative">
            <button onClick={handleCloseModal} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-full transition-colors">
              <X size={20} />
            </button>
            <h3 className="font-bold text-lg mb-4 text-slate-800 border-b pb-2">スケジュール詳細</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">開始時間</label>
                  <input type="time" value={editingItem.time} onChange={e => setEditingItem({ ...editingItem, time: e.target.value })} className="w-full border p-2 rounded bg-slate-50 font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">終了時間</label>
                  <input type="time" value={editingItem.endTime || ''} onChange={e => setEditingItem({ ...editingItem, endTime: e.target.value })} className="w-full border p-2 rounded bg-slate-50 font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">担当者 (複数選択可)</label>
                <div className="flex flex-wrap gap-2 p-2 border rounded bg-slate-50 max-h-24 overflow-y-auto">
                  {staff?.split(',').map(s => s.trim()).filter(Boolean).map(member => {
                    const currentAssignees = editingItem.assignee?.split(',').map(a => a.trim()).filter(Boolean) || [];
                    const isSelected = currentAssignees.includes(member);
                    return (
                      <label key={member} className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-sm font-medium transition-colors ${isSelected ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            let newAssignees;
                            if (e.target.checked) {
                              newAssignees = [...currentAssignees, member];
                            } else {
                              newAssignees = currentAssignees.filter(a => a !== member);
                            }
                            setEditingItem({ ...editingItem, assignee: newAssignees.join(', ') });
                          }}
                          className="sr-only"
                        />
                        {member}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">内容</label>
                <input type="text" value={editingItem.title} onChange={e => setEditingItem({ ...editingItem, title: e.target.value })} className="w-full border p-2 rounded font-bold" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">詳細メモ</label>
                <textarea rows="3" value={editingItem.desc || ''} onChange={e => setEditingItem({ ...editingItem, desc: e.target.value })} className="w-full border p-2 rounded" />
              </div>
              <div className="flex justify-between pt-4 mt-2 border-t">
                <button onClick={deleteItem} className="text-red-500 hover:bg-red-50 px-3 py-2 rounded text-sm flex items-center gap-1"><Trash2 size={16} /> 削除</button>
                <button onClick={saveItem} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabEquipment({ exhibition, details, setDetails, masterMakers }) {
  // Fixed rental item names
  const FIXED_RENTAL_ITEMS = ['長机', '椅子', 'プロジェクター', 'マイク', 'マイクスタンド', 'スクリーン', '演台', 'パーテーション'];

  // Initialize rentals from details or empty array
  const initRentals = () => {
    if (details.rentals && details.rentals.length > 0) return details.rentals;
    return []; // Start empty, don't auto-populate fixed items
  };

  // Initialize supplies from INITIAL_INTERNAL_SUPPLIES or details
  const initSupplies = () => {
    if (details.supplies && details.supplies.length > 0) return details.supplies;
    return INITIAL_INTERNAL_SUPPLIES;
  };

  const [venueFee, setVenueFee] = useState(details.cost || 0);
  const [notes, setNotes] = useState(details.notes || '');
  const [layoutImage, setLayoutImage] = useState(details.layoutImage || null);
  const [rentals, setRentals] = useState(initRentals);
  const [supplies, setSupplies] = useState(initSupplies);

  // Layout Builder State
  const [showLayoutModal, setShowLayoutModal] = useState(false);
  const [layoutData, setLayoutData] = useState(details.layoutData || []);

  // New rental form state
  const [newRentalName, setNewRentalName] = useState('長机');
  const [newRentalCount, setNewRentalCount] = useState(1);
  const [newRentalPrice, setNewRentalPrice] = useState(0);
  const [customRentalName, setCustomRentalName] = useState('');

  // New supply form state
  const [newSupplyName, setNewSupplyName] = useState('');
  const [newSupplyCount, setNewSupplyCount] = useState(1);

  // Sync to parent
  useEffect(() => {
    const rentalTotal = rentals.reduce((sum, r) => sum + (r.count * r.price), 0);
    setDetails({
      ...details,
      cost: venueFee,
      notes,
      layoutImage,
      layoutData, // Save layout vector data
      rentals,
      supplies,
      equipment: rentals.filter(r => r.count > 0) // For budget tab compatibility
    });
  }, [venueFee, notes, layoutImage, rentals, supplies, layoutData]);

  // Rental functions
  const addRental = () => {
    const itemName = newRentalName === 'その他' ? customRentalName : newRentalName;
    if (!itemName.trim() || newRentalCount <= 0) return;
    const newItem = { id: crypto.randomUUID(), name: itemName, count: newRentalCount, price: newRentalPrice, isFixed: false };
    setRentals([...rentals, newItem]);
    setNewRentalCount(1);
    setNewRentalPrice(0);
    setCustomRentalName('');
  };

  const updateRental = (id, field, value) => {
    setRentals(rentals.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeRental = (id) => {
    if (!window.confirm('この備品を削除してもよろしいですか？')) return;
    setRentals(rentals.filter(r => r.id !== id));
  };

  const rentalTotal = rentals.reduce((sum, r) => sum + (r.count * r.price), 0);

  // Supply functions
  const addSupply = () => {
    if (!newSupplyName.trim()) return;
    const newItem = { id: crypto.randomUUID(), name: newSupplyName, count: newSupplyCount, checked: false };
    setSupplies([...supplies, newItem]);
    setNewSupplyName('');
    setNewSupplyCount(1);
  };

  const updateSupply = (id, field, value) => {
    setSupplies(supplies.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeSupply = (id) => {
    if (!window.confirm('この備品を削除してもよろしいですか？')) return;
    setSupplies(supplies.filter(s => s.id !== id));
  };

  const toggleSupplyCheck = (id) => {
    setSupplies(supplies.map(s => s.id === id ? { ...s, checked: !s.checked } : s));
  };

  const checkedCount = supplies.filter(s => s.checked).length;

  // Image upload handler
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setLayoutImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Layout Save Handler
  const handleLayoutSave = (items) => {
    setLayoutData(items);
    setShowLayoutModal(false);
    // In a real app we would capture the canvas as image here
    // For now, we rely on the vector data
    alert('レイアウトを保存しました。');
  };

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
          <Building2 className="text-blue-600" /> 会場・備品管理
        </h2>
        <div className="text-right">
          <span className="text-xs text-slate-500">備品合計 (レンタル)</span>
          <p className="text-2xl font-bold text-slate-800">¥{rentalTotal.toLocaleString()}</p>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column: Venue Fee, Layout Image, Notes */}
        <div className="space-y-6">
          {/* Venue Fee */}
          <div className="bg-white rounded-xl border p-4">
            <label className="block text-sm font-bold text-slate-600 mb-2">会場利用料（確定）</label>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">¥</span>
              <input
                type="number"
                value={venueFee === 0 ? '' : venueFee}
                onChange={(e) => setVenueFee(e.target.value === '' ? 0 : Number(e.target.value))}
                className="flex-1 border rounded-lg p-3 text-lg font-bold"
                placeholder="0"
              />
            </div>
          </div>

          {/* Layout Image Upload */}
          {/* Layout Image Upload - Removed as per user request */}
          <div className="bg-white rounded-xl border p-4">
            <label className="block text-sm font-bold text-slate-600 mb-2">会場レイアウト</label>

            {/* Open Builder Button */}
            <button
              onClick={() => setShowLayoutModal(true)}
              className="w-full mb-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-bold border border-blue-200 hover:bg-blue-100 flex items-center justify-center gap-2"
            >
              <LayoutDashboard size={18} /> レイアウト作成ツールを開く
            </button>

            {layoutImage && (
              <div className="relative mt-4">
                {layoutImage.startsWith('data:application/pdf') ? (
                  <div className="py-4 text-red-600 flex flex-col items-center border rounded-lg bg-slate-50">
                    <FileText size={48} />
                    <span className="font-bold text-sm mt-2">PDFファイルが保存されています</span>
                  </div>
                ) : (
                  <img src={layoutImage} alt="Layout" className="max-h-40 mx-auto rounded-lg shadow-sm border" />
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setLayoutImage(null); }}
                  className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border p-4">
            <label className="block text-sm font-bold text-slate-600 mb-2">注意事項</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              className="w-full border rounded-lg p-3 resize-none bg-yellow-50 focus:bg-white transition-colors"
              placeholder="会場に関する注意事項を記入..."
            />
          </div>
        </div>

        {/* Center Column: Rental Equipment List */}
        <div className="bg-white rounded-xl border p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-700">レンタル備品リスト</h3>
            <span className="text-blue-600 font-bold">¥{rentalTotal.toLocaleString()}</span>
          </div>

          {/* Add Form */}
          <div className="p-3 bg-slate-50 rounded-lg mb-4 space-y-3 border border-slate-100">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">品目</label>
                <select
                  className="w-full border rounded p-2 text-sm"
                  value={newRentalName}
                  onChange={(e) => setNewRentalName(e.target.value)}
                >
                  {FIXED_RENTAL_ITEMS.map(item => <option key={item} value={item}>{item}</option>)}
                  <option value="その他">その他 (自由入力)</option>
                </select>
              </div>
              {newRentalName === 'その他' && (
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">名称</label>
                  <input
                    type="text"
                    className="w-full border rounded p-2 text-sm"
                    value={customRentalName}
                    onChange={(e) => setCustomRentalName(e.target.value)}
                    placeholder="品名を入力"
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">単価</label>
                <input
                  type="number"
                  className="w-full border rounded p-2 text-sm"
                  value={newRentalPrice === 0 ? '' : newRentalPrice}
                  onChange={(e) => setNewRentalPrice(e.target.value === '' ? 0 : Number(e.target.value))}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">数量</label>
                <input
                  type="number"
                  className="w-full border rounded p-2 text-sm"
                  value={newRentalCount === 0 ? '' : newRentalCount}
                  onChange={(e) => setNewRentalCount(e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </div>
              <div className="flex items-end">
                <button onClick={addRental} className="w-full bg-blue-600 text-white p-2 rounded text-sm font-bold shadow hover:bg-blue-700">追加</button>
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {rentals.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:shadow-sm transition-shadow">
                <div className="flex-1">
                  <span className="font-bold text-slate-800 block">{item.name}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500">
                      @<input
                        type="number"
                        className="w-16 border rounded px-1 text-right bg-slate-50 focus:bg-white"
                        value={item.price === 0 ? '' : item.price}
                        onChange={(e) => updateRental(item.id, 'price', e.target.value === '' ? 0 : Number(e.target.value))}
                      />
                    </span>
                    <span className="text-xs text-slate-400">x</span>
                    <span className="text-xs text-slate-500">
                      <input
                        type="number"
                        className="w-12 border rounded px-1 text-center bg-slate-50 focus:bg-white"
                        value={item.count === 0 ? '' : item.count}
                        onChange={(e) => updateRental(item.id, 'count', e.target.value === '' ? 0 : Number(e.target.value))}
                      />
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className="font-medium">¥{(item.count * item.price).toLocaleString()}</span>
                    <button onClick={() => removeRental(item.id)} className="text-slate-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {rentals.length === 0 && <p className="text-center text-slate-400 text-sm py-4">登録なし</p>}
          </div>
        </div>

        {/* Right Column: CareMax Supplies Checklist */}
        <div className="bg-white rounded-xl border p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-1"><PackageCheck size={18} /> ケアマックス用意備品</h3>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${checkedCount === supplies.length ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
              完了: {checkedCount}/{supplies.length}
            </span>
          </div>

          {/* Add Supply Form */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              className="flex-1 border rounded p-2 text-sm"
              placeholder="新しい備品を追加..."
              value={newSupplyName}
              onChange={(e) => setNewSupplyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSupply()}
            />
            <input
              type="number"
              className="w-16 border rounded p-2 text-sm text-center"
              value={newSupplyCount === 0 ? '' : newSupplyCount}
              onChange={(e) => setNewSupplyCount(e.target.value === '' ? 0 : Number(e.target.value))}
              placeholder="数"
            />
            <button onClick={addSupply} className="bg-slate-800 text-white px-3 rounded hover:bg-slate-700"><Plus size={16} /></button>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {supplies.map(item => (
              <div key={item.id} className={`flex items-center gap-3 p-3 border rounded-lg transition-all ${item.checked ? 'bg-slate-50 opacity-60' : 'bg-white hover:bg-slate-50 border-l-4 border-l-red-500'}`}>
                <div onClick={() => toggleSupplyCheck(item.id)} className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer ${item.checked ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-300'}`}>
                  {item.checked && <Check size={12} />}
                </div>
                <div className="flex-1">
                  <span className={`text-sm font-bold block ${item.checked ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">数量</span>
                  <input
                    type="number"
                    className="w-12 border rounded px-1 py-0.5 text-center text-xs bg-slate-50"
                    value={item.count === 0 ? '' : item.count}
                    onChange={(e) => updateSupply(item.id, 'count', e.target.value === '' ? 0 : Number(e.target.value))}
                  />
                  <button onClick={() => removeSupply(item.id)} className="text-slate-300 hover:text-red-500"><X size={14} /></button>
                </div>
              </div>
            ))}
            {supplies.length === 0 && <p className="text-center text-slate-400 text-sm py-8">備品リストは空です</p>}
          </div>
        </div>

      </div>

      {/* Model: Layout Builder */}
      {showLayoutModal && (
        <LayoutBuilderModal
          onClose={() => setShowLayoutModal(false)}
          currentLayout={layoutData}
          onSave={handleLayoutSave}
          exhibition={exhibition}
          enterprises={masterMakers}
        />
      )}
    </div>
  );
}






function TabFiles({ materials, updateMainData }) {
  // カテゴリ定義
  const CATEGORIES = [
    {
      id: 'flyer',
      title: 'チラシデータ',
      description: '最新のチラシ・ポスターデータのPDF/AIファイルを管理します',
      icon: Image,
      color: 'bg-pink-50 border-pink-200 text-pink-700',
      iconBg: 'bg-pink-100'
    },
    {
      id: 'venue',
      title: '展示会場資料',
      description: '会場図面・搬入出マニュアル・小間割り当て図など',
      icon: Map,
      color: 'bg-blue-50 border-blue-200 text-blue-700',
      iconBg: 'bg-blue-100'
    },
    {
      id: 'other',
      title: 'その他参考資料',
      description: '過去の報告書・写真素材・社内共有ドキュメントなど',
      icon: Folder,
      color: 'bg-amber-50 border-amber-200 text-amber-700',
      iconBg: 'bg-amber-100'
    }
  ];

  const [localMaterials, setLocalMaterials] = useState(materials || {});
  const [editingId, setEditingId] = useState(null);
  const [editUrl, setEditUrl] = useState('');

  useEffect(() => {
    setLocalMaterials(materials || {});
  }, [materials]);

  const handleSave = (categoryId) => {
    const updated = { ...localMaterials, [categoryId]: editUrl };
    setLocalMaterials(updated);
    updateMainData('materials', updated);
    setEditingId(null);
    setEditUrl('');
  };

  const handleEdit = (categoryId) => {
    setEditingId(categoryId);
    setEditUrl(localMaterials[categoryId] || '');
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditUrl('');
  };

  return (
    <div className="p-6 md:p-8 animate-fade-in">
      <div className="mb-8">
        <h3 className="text-xl font-bold flex items-center gap-2"><Folder className="text-blue-600" /> 資料管理</h3>
        <p className="text-sm text-slate-500 mt-1">GoogleドライブのURLを登録して、各種資料へのリンクを管理します</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const url = localMaterials[cat.id];
          const isEditing = editingId === cat.id;

          return (
            <div key={cat.id} className={`${cat.color} border rounded-xl p-6 transition-all hover:shadow-md`}>
              <div className="flex items-start gap-4 mb-4">
                <div className={`${cat.iconBg} p-3 rounded-xl`}>
                  <Icon size={32} />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-lg">{cat.title}</h4>
                  <p className="text-sm opacity-80 mt-1">{cat.description}</p>
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  <input
                    type="url"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full p-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancel}
                      className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-300"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={() => handleSave(cat.id)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : url ? (
                <div className="space-y-3">
                  <div className="bg-white/80 rounded-lg p-3 text-sm break-all">
                    <span className="text-blue-600 font-mono">{url.length > 50 ? url.slice(0, 50) + '...' : url}</span>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-4 py-2 bg-white text-blue-600 border border-blue-300 rounded-lg font-bold text-sm hover:bg-blue-50 flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={14} /> 開く
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(url);
                        alert('URLをコピーしました');
                      }}
                      className="px-4 py-2 bg-white text-slate-600 border border-slate-300 rounded-lg font-bold text-sm hover:bg-slate-50 flex items-center gap-1"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => handleEdit(cat.id)}
                      className="px-4 py-2 bg-white text-slate-600 border border-slate-300 rounded-lg font-bold text-sm hover:bg-slate-50 flex items-center gap-1"
                    >
                      <Edit3 size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => handleEdit(cat.id)}
                  className="w-full py-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 font-bold text-sm hover:border-blue-400 hover:text-blue-600 hover:bg-white/50 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> URLを登録
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <p className="text-xs text-slate-500 flex items-center gap-2">
          <Info size={14} />
          GoogleドライブやDropboxなどのクラウドストレージのURLを登録できます。共有設定を確認してください。
        </p>
      </div>
    </div>
  );
}
// ============================================================================
function TabMakers({ exhibition, setMakers, updateMainData, masterMakers, onNavigate, storage }) {
  const [activeTab, setActiveTab] = useState('invited'); // invited, confirmed, declined, unanswered
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // const [csvImporting, setCsvImporting] = useState(false); // Removed CSV import state
  const [showFormSettings, setShowFormSettings] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(null); // For Maker Detail Modal
  const [confirmedFilter, setConfirmedFilter] = useState('all'); // 'all', 'power', 'lunch'
  const [editingMaker, setEditingMaker] = useState(null); // 編集中のメーカー

  const makers = exhibition.makers || [];
  const formConfig = exhibition.formConfig || DEFAULT_FORM_CONFIG;
  const [isSendingDocs, setIsSendingDocs] = useState(false);
  const [isBulkInvoiceDownloading, setIsBulkInvoiceDownloading] = useState(false);
  const [bulkInvoiceProgress, setBulkInvoiceProgress] = useState({ done: 0, total: 0, phase: '' });
  const invoiceTemplateBufferRef = useRef(null);

  // Send Documents Notification Handler
  const handleSendDocuments = async () => {
    const confirmed = makers.filter(m => m.status === 'confirmed');
    if (confirmed.length === 0) { alert('参加確定企業がいません'); return; }

    // Check if documents exist
    const docs = exhibition.documents || {};
    const hasLayout = docs.layoutPdf?.data || docs.layoutPdf?.url;
    const hasFlyer = docs.flyerPdf?.data || docs.flyerPdf?.url;

    if (!hasLayout && !hasFlyer) {
      alert('送付する資料がありません。レイアウト表またはチラシをアップロードしてください。');
      return;
    }

    if (!window.confirm(`参加確定企業 ${confirmed.length}社に資料公開通知を送信しますか？`)) return;

    setIsSendingDocs(true);
    try {
      const messages = exhibition.messages || [];
      const newMessage = {
        id: crypto.randomUUID(),
        type: 'document',
        title: '資料が公開されました',
        content: `レイアウト表${hasLayout ? '✓' : '✗'} / チラシ${hasFlyer ? '✓' : '✗'}`,
        sentAt: new Date().toISOString(),
        readBy: [],
        exhibition: {
          id: exhibition.id,
          title: exhibition.title,
        }
      };

      const newMessages = [...messages, newMessage];
      await updateMainData('messages', newMessages);
      alert(`${confirmed.length}社に資料公開通知を送信しました。\n企業ポータルの「メッセージ」から資料を確認できます。`);
    } catch (e) {
      console.error(e);
      alert('送信に失敗しました');
    } finally {
      setIsSendingDocs(false);
    }
  };

  // Filter Makers by Tab & Search
  const filteredMakers = makers.filter(m => {
    const matchesSearch = (m.companyName?.includes(searchTerm) || m.code?.includes(searchTerm));
    if (!matchesSearch) return false;

    if (activeTab === 'invited') return m.status === 'listed' || m.status === 'invited' || m.status === 'confirmed' || m.status === 'declined'; // 招待中リストにも確定済み・辞退を表示
    if (activeTab === 'confirmed') {
      if (m.status !== 'confirmed') return false;
      // Additional Filters
      const getVal = (key) => {
        if (m.response && m.response[key] !== undefined && m.response[key] !== '') return m.response[key];
        if (m[key] !== undefined && m[key] !== '') return m[key];
        return null;
      };

      if (confirmedFilter === 'power') {
        const powerVal = getVal('power');
        const rawRes = m.response || {};
        return (powerVal && parseInt(powerVal) > 0) ||
          JSON.stringify(rawRes).includes('電源') ||
          JSON.stringify(m).includes('電源');
      }
      if (confirmedFilter === 'lunch') {
        const lunch1 = getVal('lunch');
        const lunch2 = getVal('lunchCount');
        const rawRes = m.response || {};
        return (parseInt(lunch1 || 0) > 0) || (parseInt(lunch2 || 0) > 0) ||
          JSON.stringify(rawRes).includes('弁当') ||
          JSON.stringify(m).includes('弁当');
      }
      return true;
    }
    if (activeTab === 'declined') return m.status === 'declined';
    if (activeTab === 'unanswered') return m.status === 'invited' && !m.respondedAt;

    return false;
  });

  // Calculate Stats
  const stats = {
    total: makers.length,
    invited: makers.length,

    confirmed: makers.filter(m => m.status === 'confirmed').length,
    declined: makers.filter(m => m.status === 'declined').length,
    unanswered: makers.filter(m => m.status === 'invited' && !m.respondedAt).length
  };

  // Calculate Aggregates for Confirmed Tab
  const aggregates = useMemo(() => {
    const confirmed = makers.filter(m => m.status === 'confirmed');
    let totalBooths = 0;
    let totalPeople = 0;
    let totalLunch = 0;
    let totalDesks = 0;
    let totalChairs = 0;
    let totalPower = 0;

    confirmed.forEach(m => {
      // ★修正: データが m.response (ネスト) にある場合と、m (直下) にある場合の両方を考慮
      // m.response が空オブジェクト {} の場合、以前の m.response || m ロジックでは {} が優先され
      // 直下のデータが読まれないバグがあったため、明示的に両方チェックするヘルパーを使用
      const getVal = (key) => {
        // 1. Try m.response[key]
        if (m.response && m.response[key] !== undefined && m.response[key] !== '') return m.response[key];
        // 2. Try m[key]
        if (m[key] !== undefined && m[key] !== '') return m[key];
        return null;
      };

      // Booths
      const boothVal = getVal('boothCount');
      if (boothVal) {
        const match = String(boothVal).match(/(\d+)/);
        if (match) totalBooths += parseInt(match[1], 10);
      }

      // People
      const attendees = getVal('attendees') || getVal('staffCount');
      if (attendees) totalPeople += parseInt(attendees, 10) || 0;

      // Lunch (Handle 'lunch' or 'lunchCount')
      const lunch1 = getVal('lunch');
      const lunch2 = getVal('lunchCount');
      if (lunch1) totalLunch += parseInt(lunch1, 10) || 0;
      else if (lunch2) totalLunch += parseInt(lunch2, 10) || 0;

      // Equipment
      const desk = getVal('desk') || getVal('itemsDesk');
      if (desk) totalDesks += parseInt(desk, 10) || 0;
      const chair = getVal('chair') || getVal('itemsChair');
      if (chair) totalChairs += parseInt(chair, 10) || 0;

      // Power
      const powerVal = getVal('power') || getVal('itemsPower');
      const rawRes = m.response || {};
      const isPower = (powerVal && (parseInt(powerVal) > 0 || powerVal === '必要')) ||
        JSON.stringify(rawRes).includes('電源利用：あり') ||
        JSON.stringify(m).includes('電源利用：あり');

      if (isPower) totalPower += 1;
    });

    return { totalBooths, totalPeople, totalLunch, totalDesks, totalChairs, totalPower };
  }, [makers]);


  const handleSendInvitations = async () => {
    const targets = makers.filter(m => (m.status === 'listed' || m.status === 'invited') && !m.invitationSentAt);
    if (targets.length === 0) { alert('送付対象の企業がありません'); return; }
    if (!window.confirm(`${targets.length}件の企業に招待状を一斉送付しますか？`)) return;

    // Must check required settings
    const settings = formConfig.settings || {};
    // ★修正: 必須項目のチェックを強化 (出展費用、会場電話、搬入情報)
    const missingSettings = [];
    if (!settings.venuePhone) missingSettings.push('会場電話番号');
    if (!settings.moveInInfo) missingSettings.push('搬入案内');
    if (!settings.feePerBooth) missingSettings.push('出展費用');
    if (!settings.deadline) missingSettings.push('回答期限');

    if (missingSettings.length > 0) {
      alert(`【送信できません】\n招待を送る前に「フォーム編集」＞「基本設定」から以下の項目を設定してください。\n\n未設定: ${missingSettings.join(', ')}`);
      return;
    }

    const updatedMakers = makers.map(m => {
      if ((m.status === 'listed' || m.status === 'invited') && !m.invitationSentAt) {
        return { ...m, status: 'invited', invitationSentAt: Date.now() };
      }
      return m;
    });
    setMakers(updatedMakers);
    alert('招待状を送付しました');
  };

  const handleCloseReception = async () => {
    const targets = makers.filter(m => m.status === 'listed' || m.status === 'invited');
    if (targets.length === 0) return;
    if (!window.confirm(`現在「招待中（未回答）」の${targets.length}件を「辞退（締切）」に変更しますか？\n※参加確定の企業は変更されません。`)) return;

    const updatedMakers = makers.map(m => {
      if (m.status === 'listed' || m.status === 'invited') {
        return { ...m, status: 'declined', note: (m.note || '') + '\n[システム] 受付締切により自動辞退' };
      }
      return m;
    });
    setMakers(updatedMakers);
    alert('受付を締め切りました');
  };

  const handleAddMaker = (newMaker) => {
    // Verify if the code exists in masterMakers
    const masterExists = masterMakers.some(mm => mm.code === newMaker.code);
    if (!masterExists) {
      alert(`エラー: 仕入先コード「${newMaker.code}」は企業管理コンソールに登録されていません。\n先に企業管理コンソールで登録を行ってください。`);
      return;
    }

    // Check for duplicates in the current list
    if (makers.some(m => m.code === newMaker.code)) {
      alert(`エラー: 仕入先コード「${newMaker.code}」は既にこのリストに追加されています。`);
      return;
    }

    setMakers([...makers, { ...newMaker, id: crypto.randomUUID(), status: 'listed', invitationSentAt: null, code: newMaker.code }]);
    setShowAddModal(false);
  };

  const handleImportFixedMakers = () => {
    const fixedMakers = masterMakers.filter(m => m.isFixed);
    if (fixedMakers.length === 0) {
      alert('固定リストに企業が登録されていません。企業管理コンソールで固定リストを設定してください。');
      return;
    }

    const newMakers = [];
    fixedMakers.forEach(fm => {
      // Check for duplicates based on code
      if (!makers.some(m => m.code === fm.code)) {
        newMakers.push({
          id: crypto.randomUUID(),
          code: fm.code,
          companyName: fm.name,
          category: fm.category,
          status: 'listed',
          invitationSentAt: null,
          response: {},
          isFixed: true // Mark as coming from fixed list
        });
      }
    });

    if (newMakers.length > 0) {
      if (window.confirm(`固定リストから${newMakers.length}件の企業を追加しますか？`)) {
        setMakers([...makers, ...newMakers]);
        alert(`${newMakers.length}件追加しました。`);
      }
    } else {
      alert('追加対象の企業はありませんでした（全て登録済みです）。');
    }
  };

  const handleExportConfirmedExcel = async () => {
    try {
      const confirmed = makers.filter(m => m.status === 'confirmed');
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('ConfirmedMakers');
      ws.addRow(['会社名', '担当者名', '電話番号', '搬入日', 'コマ数', '人数', '特記事項']);

      confirmed.forEach(m => {
        const getVal = (key) => {
          if (m.response && m.response[key] !== undefined && m.response[key] !== '') return m.response[key];
          if (m[key] !== undefined && m[key] !== '') return m[key];
          return '';
        };

        ws.addRow([
          m.companyName,
          getVal('repName'),
          getVal('phone'),
          getVal('moveInDate'),
          getVal('boothCount'),
          getVal('attendees'),
          getVal('note')
        ]);
      });
      wb.xlsx.writeBuffer().then(buffer => saveAs(new Blob([buffer]), 'confirmed_makers.xlsx'));
    } catch (e) {
      console.error(e);
      alert('Excel出力エラー: ' + e.message);
    }
  };

  const handleExportInvitedExcel = async () => {
    // 招待タブに表示される対象（招待中、リスト、確定、辞退など全て含むが、ユーザー要望は「招待リスト」なので招待・リスト・確定などを出力対象とする）
    const targets = filteredMakers; // 現在のフィルタ結果（検索含む）を出力するのが親切だが、要件は「招待リストを」なので招待済み一覧を出すべきか。filteredMakersを使うとタブのフィルタが効いてしまう。
    // ユーザーは「招待メーカータブの招待リスト」と言っている。
    // 安全のため、全招待者（status: listed, invited, confirmed, declined）を出力するが、フィルタは無視する、あるいは招待タブで見ているなら招待タブのフィルタを使う。
    // ここでは「全招待者（listed, invited, confirmed, declined）」を出力する。
    const allInvited = makers.filter(m => ['listed', 'invited', 'confirmed', 'declined'].includes(m.status));

    if (allInvited.length === 0) {
      alert('出力対象のデータがありません');
      return;
    }

    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('InvitedMakers');
      ws.addRow(['仕入先コード', '企業名', 'ポータルサイトURL', 'ステータス']);

      allInvited.forEach(m => {
        const portalUrl = `${window.location.origin}/?mode=maker&id=${exhibition.id}&code=${m.code}`;
        ws.addRow([
          m.code || '',
          m.companyName || '',
          portalUrl,
          m.status === 'confirmed' ? '参加確定' :
            m.status === 'declined' ? '辞退' :
              m.status === 'invited' ? '招待中' : 'リスト'
        ]);
      });

      wb.xlsx.writeBuffer().then(buffer => saveAs(new Blob([buffer]), `invited_makers_${exhibition.title}.xlsx`));
    } catch (e) {
      console.error(e);
      alert('Excel出力エラー: ' + e.message);
    }
  };

  const getMakerValue = (maker, key) => {
    if (maker?.response && maker.response[key] !== undefined && maker.response[key] !== '') return maker.response[key];
    if (maker && maker[key] !== undefined && maker[key] !== '') return maker[key];
    return null;
  };

  const formatJapaneseDate = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const formatJapaneseMonthEnd = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}年${date.getMonth() + 1}月末日`;
  };

  const getFirstEventDate = (dates) => {
    if (!Array.isArray(dates) || dates.length === 0) return null;
    const sorted = [...dates].filter(Boolean).sort();
    if (sorted.length === 0) return null;
    const parsed = new Date(`${sorted[0]}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getMonthEndByOffset = (baseDate, monthOffset) => {
    if (!(baseDate instanceof Date) || Number.isNaN(baseDate.getTime())) return null;
    return new Date(baseDate.getFullYear(), baseDate.getMonth() + monthOffset + 1, 0);
  };

  const resolveInvoiceSheetName = (paymentMethod) => {
    const normalized = String(paymentMethod || '').replace(/\s+/g, '');
    return normalized.includes('相殺') ? '相殺' : '振込';
  };

  const sanitizeFileName = (value, fallback) => {
    const cleaned = String(value || '')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .trim();
    return cleaned || fallback;
  };

  const formatDateCompact = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  };

  const colLettersToNumber = (letters) => {
    let num = 0;
    for (let i = 0; i < letters.length; i++) {
      num = (num * 26) + (letters.charCodeAt(i) - 64);
    }
    return num;
  };

  const parseMergeRange = (range) => {
    const m = String(range || '').match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!m) return null;
    return {
      startCol: colLettersToNumber(m[1]),
      startRow: parseInt(m[2], 10),
      endCol: colLettersToNumber(m[3]),
      endRow: parseInt(m[4], 10)
    };
  };

  const excelColumnWidthToPx = (width) => {
    const w = Number(width);
    if (!Number.isFinite(w) || w <= 0) return 0;
    if (w < 1) return Math.floor(w * 12 + 0.5);
    return Math.floor(((256 * w + Math.floor(128 / 7)) / 256) * 7);
  };

  const pointsToPx = (pt) => {
    const p = Number(pt);
    if (!Number.isFinite(p) || p <= 0) return 0;
    return p * (96 / 72);
  };

  const parseWorkbookThemeColors = (workbook) => {
    const xml = workbook?._themes?.theme1;
    if (!xml || typeof xml !== 'string') return {};
    const getClr = (tag) => {
      const rgx = new RegExp(`<a:${tag}>[\\s\\S]*?(?:<a:srgbClr[^>]*val=\"([0-9A-Fa-f]{6})\"|<a:sysClr[^>]*lastClr=\"([0-9A-Fa-f]{6})\")`, 'i');
      const m = xml.match(rgx);
      return (m?.[1] || m?.[2] || '').toUpperCase();
    };
    return {
      0: getClr('lt1'),
      1: getClr('dk1'),
      2: getClr('lt2'),
      3: getClr('dk2'),
      4: getClr('accent1'),
      5: getClr('accent2'),
      6: getClr('accent3'),
      7: getClr('accent4'),
      8: getClr('accent5'),
      9: getClr('accent6'),
      10: getClr('hlink'),
      11: getClr('folHlink')
    };
  };

  const applyTintToHex = (hex, tint) => {
    if (!hex) return hex;
    if (tint === undefined || tint === null || Number.isNaN(Number(tint))) return hex;
    const t = Number(tint);
    const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (t < 0) {
      const f = 1 + t;
      return `${clamp(r * f).toString(16).padStart(2, '0')}${clamp(g * f).toString(16).padStart(2, '0')}${clamp(b * f).toString(16).padStart(2, '0')}`.toUpperCase();
    }
    return `${clamp(r + (255 - r) * t).toString(16).padStart(2, '0')}${clamp(g + (255 - g) * t).toString(16).padStart(2, '0')}${clamp(b + (255 - b) * t).toString(16).padStart(2, '0')}`.toUpperCase();
  };

  const colorToCss = (color, fallback = '#000000', themeColors = {}) => {
    if (!color) return fallback;
    if (color.argb) {
      const argb = String(color.argb);
      if (argb.length === 8) return `#${argb.slice(2)}`;
      if (argb.length === 6) return `#${argb}`;
    }
    if (color.indexed !== undefined) {
      const indexedMap = {
        9: '#FFFFFF',
        64: '#000000'
      };
      return indexedMap[color.indexed] || fallback;
    }
    if (color.theme !== undefined) {
      const themeHex = themeColors[color.theme];
      if (themeHex) {
        const tinted = applyTintToHex(themeHex, color.tint);
        return `#${tinted}`;
      }
    }
    return fallback;
  };

  const normalizeInvoiceCellText = (text) => {
    if (text === null || text === undefined) return '';
    const s = String(text);
    // Excel numFmt由来の "\" を日本円マークとして表示
    return s.replace(/^\\(?=\d)/, '¥');
  };

  const getCellDisplayText = (cell) => {
    if (!cell) return '';
    if (cell.text !== undefined && cell.text !== null && cell.text !== '') return normalizeInvoiceCellText(cell.text);
    const v = cell.value;
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') {
      if (v.richText) return normalizeInvoiceCellText(v.richText.map(t => t.text).join(''));
      if (v.formula) return normalizeInvoiceCellText(v.result ?? '');
      if (v.text) return normalizeInvoiceCellText(v.text);
      return normalizeInvoiceCellText(JSON.stringify(v));
    }
    return normalizeInvoiceCellText(v);
  };

  const getCellRichRuns = (cell) => {
    const v = cell?.value;
    if (!v || typeof v !== 'object' || !Array.isArray(v.richText)) return null;
    return v.richText.map((run) => ({
      text: normalizeInvoiceCellText(run?.text ?? ''),
      font: run?.font || {}
    }));
  };

  const excelBorderToCss = (edge, themeColors) => {
    if (!edge) return '';
    const style = edge.style || 'thin';
    const cssStyle = style === 'dashed' ? 'dashed' : style === 'dotted' ? 'dotted' : style === 'double' ? 'double' : 'solid';
    const cssWidth = style === 'thick' ? 2 : style === 'medium' ? 1.5 : style === 'double' ? 3 : style === 'hair' ? 0.5 : 1;
    const color = colorToCss(edge.color, '#000000', themeColors);
    return `${cssWidth}px ${cssStyle} ${color}`;
  };

  const mediaToDataUrl = (media) => {
    if (!media || !media.buffer) return null;
    let bytes;
    if (media.buffer instanceof ArrayBuffer) {
      bytes = new Uint8Array(media.buffer);
    } else if (ArrayBuffer.isView(media.buffer)) {
      bytes = new Uint8Array(media.buffer.buffer, media.buffer.byteOffset, media.buffer.byteLength);
    } else if (media.buffer?.data) {
      bytes = Uint8Array.from(media.buffer.data);
    } else {
      return null;
    }

    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const ext = String(media.extension || 'png').toLowerCase();
    return `data:image/${ext};base64,${btoa(binary)}`;
  };

  const createInvoicePreviewElement = (workbook, worksheet) => {
    const maxCol = Math.max(45, worksheet.columnCount || 45);
    const maxRow = Math.max(28, worksheet.rowCount || 28);
    const defaultColWidth = Number(worksheet.properties?.defaultColWidth || 8.43);
    const defaultRowHeight = Number(worksheet.properties?.defaultRowHeight || 13.5);
    const themeColors = parseWorkbookThemeColors(workbook);
    const resetCss = (el) => {
      el.style.all = 'initial';
      el.style.boxSizing = 'border-box';
      return el;
    };

    const colWidths = new Array(maxCol + 1).fill(excelColumnWidthToPx(defaultColWidth));
    for (let c = 1; c <= maxCol; c++) {
      const w = worksheet.getColumn(c)?.width;
      colWidths[c] = w ? excelColumnWidthToPx(w) : excelColumnWidthToPx(defaultColWidth);
    }
    const rowHeights = new Array(maxRow + 1).fill(pointsToPx(defaultRowHeight));
    for (let r = 1; r <= maxRow; r++) {
      const h = worksheet.getRow(r)?.height;
      rowHeights[r] = h ? pointsToPx(h) : pointsToPx(defaultRowHeight);
    }

    const colLeft = new Array(maxCol + 2).fill(0);
    const rowTop = new Array(maxRow + 2).fill(0);
    let accW = 0;
    for (let c = 1; c <= maxCol; c++) {
      colLeft[c] = accW;
      accW += colWidths[c];
    }
    let accH = 0;
    for (let r = 1; r <= maxRow; r++) {
      rowTop[r] = accH;
      accH += rowHeights[r];
    }

    const mergeTopLeft = new globalThis.Map();
    const mergeCovered = new Set();
    const merges = worksheet.model?.merges || [];
    merges.forEach((m) => {
      const parsed = parseMergeRange(m);
      if (!parsed) return;
      mergeTopLeft.set(`${parsed.startRow}:${parsed.startCol}`, {
        rowSpan: parsed.endRow - parsed.startRow + 1,
        colSpan: parsed.endCol - parsed.startCol + 1
      });
      for (let r = parsed.startRow; r <= parsed.endRow; r++) {
        for (let c = parsed.startCol; c <= parsed.endCol; c++) {
          if (r === parsed.startRow && c === parsed.startCol) continue;
          mergeCovered.add(`${r}:${c}`);
        }
      }
    });
    const pickEdgeBorder = (cells, edgeName) => {
      for (const candidate of cells) {
        const border = candidate?.border?.[edgeName];
        if (border) return border;
      }
      return null;
    };

    const root = resetCss(document.createElement('div'));
    root.style.display = 'block';
    root.style.position = 'fixed';
    root.style.left = '-100000px';
    root.style.top = '0';
    root.style.background = '#fff';
    root.style.color = '#000';
    root.style.padding = '0';
    root.style.zIndex = '-1';
    root.style.width = `${accW}px`;

    const sheet = resetCss(document.createElement('div'));
    sheet.style.display = 'block';
    sheet.style.position = 'relative';
    sheet.style.width = `${accW}px`;
    sheet.style.height = `${accH}px`;
    sheet.style.background = '#fff';
    sheet.style.color = '#000';
    sheet.style.fontFamily = "'Meiryo UI', 'Meiryo', sans-serif";

    for (let r = 1; r <= maxRow; r++) {
      for (let c = 1; c <= maxCol; c++) {
        const key = `${r}:${c}`;
        if (mergeCovered.has(key)) continue;

        const row = worksheet.getRow(r);
        const cell = row.getCell(c);
        const merge = mergeTopLeft.get(key);
        const rowSpan = merge?.rowSpan || 1;
        const colSpan = merge?.colSpan || 1;

        let width = 0;
        for (let i = 0; i < colSpan; i++) width += colWidths[c + i] || 0;
        let height = 0;
        for (let i = 0; i < rowSpan; i++) height += rowHeights[r + i] || 0;

        const border = (() => {
          if (rowSpan <= 1 && colSpan <= 1) return cell.border || {};
          const topCells = [];
          const bottomCells = [];
          const leftCells = [];
          const rightCells = [];
          for (let cc = c; cc < c + colSpan; cc++) {
            topCells.push(worksheet.getRow(r).getCell(cc));
            bottomCells.push(worksheet.getRow(r + rowSpan - 1).getCell(cc));
          }
          for (let rr = r; rr < r + rowSpan; rr++) {
            leftCells.push(worksheet.getRow(rr).getCell(c));
            rightCells.push(worksheet.getRow(rr).getCell(c + colSpan - 1));
          }
          return {
            top: pickEdgeBorder(topCells, 'top') || cell.border?.top,
            right: pickEdgeBorder(rightCells, 'right') || cell.border?.right,
            bottom: pickEdgeBorder(bottomCells, 'bottom') || cell.border?.bottom,
            left: pickEdgeBorder(leftCells, 'left') || cell.border?.left
          };
        })();
        const hasBorder = !!(border.top || border.right || border.bottom || border.left);
        const fill = cell.fill;
        const hasSolidFill = fill?.type === 'pattern' && fill?.pattern === 'solid' && !!fill?.fgColor;
        const text = getCellDisplayText(cell);
        const richRuns = getCellRichRuns(cell);
        if (!hasBorder && !hasSolidFill && !text) continue;

        const cellDiv = resetCss(document.createElement('div'));
        cellDiv.style.position = 'absolute';
        cellDiv.style.left = `${colLeft[c]}px`;
        cellDiv.style.top = `${rowTop[r]}px`;
        cellDiv.style.width = `${width}px`;
        cellDiv.style.height = `${height}px`;
        cellDiv.style.boxSizing = 'border-box';
        if (hasSolidFill) {
          cellDiv.style.backgroundColor = colorToCss(fill.fgColor, '#ffffff', themeColors);
        }

        if (border.top) cellDiv.style.borderTop = excelBorderToCss(border.top, themeColors);
        if (border.right) cellDiv.style.borderRight = excelBorderToCss(border.right, themeColors);
        if (border.bottom) cellDiv.style.borderBottom = excelBorderToCss(border.bottom, themeColors);
        if (border.left) cellDiv.style.borderLeft = excelBorderToCss(border.left, themeColors);

        const font = cell.font || {};
        if (font.name) cellDiv.style.fontFamily = `'${font.name}', 'Meiryo UI', sans-serif`;
        if (font.size) {
          const isTitleRow = r === 2 && Number(font.size) >= 24;
          const fontPx = Math.max(7, pointsToPx(font.size) * (isTitleRow ? 0.94 : 1));
          cellDiv.style.fontSize = `${fontPx}px`;
        }
        if (font.bold) cellDiv.style.fontWeight = '700';
        if (font.italic) cellDiv.style.fontStyle = 'italic';
        if (font.underline) cellDiv.style.textDecoration = 'underline';
        if (font.color) cellDiv.style.color = colorToCss(font.color, '#000000', themeColors);

        const align = cell.alignment || {};
        const h = align.horizontal || 'left';
        const hasHorizontalBorders = !!(border.top || border.bottom);
        const isTitleRow = r === 2;
        const isCompanyRow = r === 4;
        const isTradeRow = r === 12 || r === 13;
        const isTotalRow = r === 17;
        const isBreakdownRow = r >= 25 && r <= 28;
        const isLargeHeading = Number(font.size || 0) >= 24;
        const v = align.vertical || (hasHorizontalBorders ? 'middle' : 'top');
        let padTopBottom = isLargeHeading ? 1 : (hasHorizontalBorders ? 1 : 0);
        if (isTitleRow || isTotalRow) padTopBottom = 0;
        if (isCompanyRow || isTradeRow) padTopBottom = 0;
        const padLeft = 2;
        let padRight = h === 'right' ? 6 : (h === 'left' && colSpan >= 10 ? 8 : 2);
        if (isBreakdownRow && h === 'left' && colSpan >= 10) padRight = Math.max(padRight, 22);
        cellDiv.style.padding = `${padTopBottom}px ${padRight}px ${padTopBottom}px ${padLeft}px`;
        const canOverflowHorizontally = rowSpan === 1
          && colSpan === 1
          && !align.wrapText
          && (h === 'left' || !h)
          && !border.right
          && !!text
          && !text.includes('\n');
        cellDiv.style.overflow = (canOverflowHorizontally || (isLargeHeading && !isTitleRow)) ? 'visible' : 'hidden';
        cellDiv.style.display = 'flex';
        cellDiv.style.justifyContent = h === 'center' ? 'center' : h === 'right' ? 'flex-end' : 'flex-start';
        cellDiv.style.alignItems = v === 'middle' ? 'center' : v === 'bottom' ? 'flex-end' : 'flex-start';
        cellDiv.style.textAlign = h === 'center' ? 'center' : h === 'right' ? 'right' : 'left';
        if (isTotalRow && text) {
          cellDiv.style.alignItems = 'center';
          cellDiv.style.justifyContent = 'center';
        }
        cellDiv.style.whiteSpace = align.wrapText ? 'pre-wrap' : 'pre';
        cellDiv.style.lineHeight = isTitleRow ? '1' : (isTotalRow ? '1' : (isLargeHeading ? '1.05' : (text.includes('\n') ? '1.12' : '1.03')));
        if (align.textRotation === 'vertical' || align.textRotation === 255) {
          cellDiv.style.writingMode = 'vertical-rl';
          cellDiv.style.textOrientation = 'upright';
          cellDiv.style.justifyContent = 'center';
          cellDiv.style.alignItems = 'center';
          cellDiv.style.whiteSpace = 'normal';
          cellDiv.style.lineHeight = '1';
        }

        if (text) {
          const span = document.createElement('span');
          span.style.display = 'inline-block';
          if (canOverflowHorizontally) {
            let overflowWidth = width;
            for (let cc = c + 1; cc <= maxCol; cc++) {
              const key2 = `${r}:${cc}`;
              const merge2 = mergeTopLeft.get(key2);
              const isMergeStart = !!merge2;
              const nextCell = worksheet.getRow(r).getCell(cc);
              const nextText = getCellDisplayText(nextCell);
              if (isMergeStart || nextText) break;
              overflowWidth += colWidths[cc] || 0;
            }
            span.style.maxWidth = `${Math.max(0, overflowWidth - 4)}px`;
          } else if (isBreakdownRow && h === 'left' && colSpan >= 10) {
            span.style.maxWidth = `${Math.max(0, width - padLeft - padRight - 8)}px`;
          }
          if (isCompanyRow || isTradeRow) span.style.transform = 'translateY(-1px)';
          if (isTitleRow) span.style.transform = 'translateY(-0.5px)';
          if (richRuns && richRuns.length > 0) {
            richRuns.forEach((run) => {
              const runSpan = document.createElement('span');
              runSpan.textContent = run.text;
              const rf = run.font || {};
              if (rf.name) runSpan.style.fontFamily = `'${rf.name}', 'Meiryo UI', sans-serif`;
              if (rf.size) runSpan.style.fontSize = `${Math.max(7, pointsToPx(rf.size))}px`;
              if (rf.bold) runSpan.style.fontWeight = '700';
              if (rf.italic) runSpan.style.fontStyle = 'italic';
              if (rf.underline) runSpan.style.textDecoration = 'underline';
              if (rf.color) runSpan.style.color = colorToCss(rf.color, '#000000', themeColors);
              span.appendChild(runSpan);
            });
          } else {
            span.textContent = text;
          }
          cellDiv.appendChild(span);
        }

        sheet.appendChild(cellDiv);
      }
    }

    // ExcelJS再保存で欠落するテキストボックス（代表取締役〜）を明示的に描画
    const officerBox = resetCss(document.createElement('div'));
    officerBox.style.display = 'block';
    const officerCol = Math.min(28, maxCol); // drawing anchor col=27 (0-based)
    const officerRow = Math.min(9, maxRow);  // drawing anchor row=8 (0-based)
    const officerEndCol = Math.min(40, maxCol + 1);
    const officerEndRow = Math.min(17, maxRow + 1);
    const officerLeft = colLeft[officerCol] || 0;
    const officerTop = rowTop[officerRow] || 0;
    const officerRight = colLeft[officerEndCol] || accW;
    const officerBottom = rowTop[officerEndRow] || accH;
    officerBox.style.position = 'absolute';
    officerBox.style.left = `${officerLeft + 2}px`;
    officerBox.style.top = `${officerTop + 2}px`;
    officerBox.style.width = `${Math.max(220, officerRight - officerLeft - 6)}px`;
    officerBox.style.height = `${Math.max(64, officerBottom - officerTop - 4)}px`;
    officerBox.style.zIndex = '1';
    officerBox.style.fontFamily = "'Meiryo UI', 'Meiryo', sans-serif";
    officerBox.style.lineHeight = '1.16';
    officerBox.style.color = '#000';
    officerBox.style.whiteSpace = 'normal';
    const officerLines = [
      { text: '代表取締役社長　宮武　佳弘', px: pointsToPx(10.5) },
      { text: '高知県高知市上町2-6-9', px: pointsToPx(8.8) },
      { text: 'TEL088-831-6087/FAX088-831-6070', px: pointsToPx(8.8) },
      { text: '登録番号：T4490001002141', px: pointsToPx(8.8) }
    ];
    officerLines.forEach(({ text: lineText, px }) => {
      const line = document.createElement('div');
      line.style.display = 'block';
      line.style.margin = '0';
      line.style.padding = '0';
      line.style.fontSize = `${Math.max(8, px)}px`;
      line.style.whiteSpace = 'nowrap';
      line.textContent = lineText;
      officerBox.appendChild(line);
    });
    sheet.appendChild(officerBox);

    const images = worksheet.getImages ? worksheet.getImages() : [];
    let stampLeftPx = null;
    images.forEach((img) => {
      const media = workbook.media?.[img.imageId];
      const dataUrl = mediaToDataUrl(media);
      if (!dataUrl) return;

      const tl = img.range?.tl;
      const br = img.range?.br;
      const tlCol = typeof tl?.nativeCol === 'number' ? tl.nativeCol : Math.floor(tl?.col ?? 0);
      const tlRow = typeof tl?.nativeRow === 'number' ? tl.nativeRow : Math.floor(tl?.row ?? 0);
      const tlColOffPx = (typeof tl?.nativeColOff === 'number' ? tl.nativeColOff : (tl?.colOff || 0)) / 9525;
      const tlRowOffPx = (typeof tl?.nativeRowOff === 'number' ? tl.nativeRowOff : (tl?.rowOff || 0)) / 9525;

      let x = (colLeft[tlCol + 1] || 0) + tlColOffPx;
      let y = (rowTop[tlRow + 1] || 0) + tlRowOffPx;
      let w = 0;
      let h = 0;

      if (br) {
        const brCol = typeof br?.nativeCol === 'number' ? br.nativeCol : Math.floor(br?.col ?? 0);
        const brRow = typeof br?.nativeRow === 'number' ? br.nativeRow : Math.floor(br?.row ?? 0);
        const brColOffPx = (typeof br?.nativeColOff === 'number' ? br.nativeColOff : (br?.colOff || 0)) / 9525;
        const brRowOffPx = (typeof br?.nativeRowOff === 'number' ? br.nativeRowOff : (br?.rowOff || 0)) / 9525;
        const x2 = (colLeft[brCol + 1] || accW) + brColOffPx;
        const y2 = (rowTop[brRow + 1] || accH) + brRowOffPx;
        w = Math.max(1, x2 - x);
        h = Math.max(1, y2 - y);
      } else if (img.range?.ext) {
        w = Math.max(1, (img.range.ext.width || img.range.ext.cx || 0) / 9525);
        h = Math.max(1, (img.range.ext.height || img.range.ext.cy || 0) / 9525);
      }

      if (w <= 0 || h <= 0) {
        w = 120;
        h = 40;
      }
      if (w <= 130 && h <= 130 && y < (rowTop[Math.min(16, maxRow)] || accH)) {
        stampLeftPx = stampLeftPx === null ? x : Math.min(stampLeftPx, x);
      }

      const imageEl = resetCss(document.createElement('img'));
      imageEl.style.display = 'block';
      imageEl.src = dataUrl;
      imageEl.style.position = 'absolute';
      imageEl.style.left = `${x}px`;
      imageEl.style.top = `${y}px`;
      imageEl.style.width = `${w}px`;
      imageEl.style.height = `${h}px`;
      imageEl.style.objectFit = 'contain';
      imageEl.style.pointerEvents = 'none';
      imageEl.style.zIndex = '2';
      sheet.appendChild(imageEl);
    });
    if (stampLeftPx !== null) {
      const maxTextWidth = Math.max(170, stampLeftPx - (officerLeft + 2) - 10);
      officerBox.style.width = `${maxTextWidth}px`;
    }

    root.appendChild(sheet);
    return root;
  };

  const downloadInvoicePdfFromWorksheet = async (workbook, worksheet, fileName) => {
    return downloadInvoicePdfFromWorksheetCanvas(workbook, worksheet, fileName);
  };

  const withTimeout = (promise, timeoutMs, message) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  };

  const loadInvoiceTemplateBuffer = async () => {
    if (invoiceTemplateBufferRef.current) return invoiceTemplateBufferRef.current.slice(0);
    const templateFileName = '請求書例.xlsx';
    const baseUrl = import.meta.env.BASE_URL || '/';
    const templateUrl = `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}${encodeURIComponent(templateFileName)}`;
    const response = await fetch(templateUrl);
    if (!response.ok) throw new Error(`テンプレート読込失敗 (${response.status})`);
    const arrayBuffer = await response.arrayBuffer();
    invoiceTemplateBufferRef.current = arrayBuffer;
    return arrayBuffer.slice(0);
  };

  const buildInvoicePayloadForMaker = async (maker) => {
    if (!maker || maker.status !== 'confirmed') {
      throw new Error('参加確定の企業のみ請求書を出力できます。');
    }

    const eventDate = getFirstEventDate(exhibition.dates);
    if (!eventDate) {
      throw new Error('展示会の開催日が未設定のため、請求書を作成できません。');
    }

    const companyName = getMakerValue(maker, 'companyName') || maker.companyName || '企業名未設定';
    const boothCountRaw = getMakerValue(maker, 'boothCount') || maker.boothCount || 0;
    const boothCount = extractNum(boothCountRaw);
    if (boothCount <= 0) {
      throw new Error(`希望コマ数が取得できないため、請求書を作成できません。\n企業: ${companyName}`);
    }

    const paymentMethod = getMakerValue(maker, 'payment') || getMakerValue(maker, 'paymentMethod') || '振り込み';
    const sheetName = resolveInvoiceSheetName(paymentMethod);
    const feePerBooth = Number(formConfig?.settings?.feePerBooth || 30000);
    const totalAmountTaxIncluded = Math.round(boothCount * feePerBooth);
    const unitPriceWithoutTax = Math.round(feePerBooth / 1.1);
    const amountWithoutTax = unitPriceWithoutTax * boothCount;
    const taxAmount = Math.max(0, totalAmountTaxIncluded - amountWithoutTax);
    const dueDate = getMonthEndByOffset(eventDate, 1);

    const templateBuffer = await loadInvoiceTemplateBuffer();
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuffer);

    const invoiceSheet = workbook.getWorksheet(sheetName);
    if (!invoiceSheet) throw new Error(`テンプレートに「${sheetName}」シートが見つかりません`);

    invoiceSheet.getCell('AG1').value = formatJapaneseDate(new Date());
    invoiceSheet.getCell('B4').value = companyName;
    invoiceSheet.getCell('G13').value = formatJapaneseMonthEnd(dueDate);
    invoiceSheet.getCell('M17').value = `\\${totalAmountTaxIncluded.toLocaleString('ja-JP')}（税込）`;
    invoiceSheet.getCell('D19').value = `${exhibition.title || '展示会'}　出展料\n（${formatJapaneseDate(eventDate)}）`;
    invoiceSheet.getCell('V19').value = boothCount;
    invoiceSheet.getCell('Y19').value = `\\${unitPriceWithoutTax}`;
    invoiceSheet.getCell('AF19').value = `\\${amountWithoutTax}`;
    invoiceSheet.getCell('AF23').value = null;
    invoiceSheet.getCell('AF24').value = `\\${taxAmount}`;
    if (sheetName === '相殺' && dueDate) {
      const dueMonth = dueDate.getMonth() + 1;
      invoiceSheet.getCell('D25').value = `　※${dueMonth}月分の仕入より相殺させていただきます。`;
      invoiceSheet.getCell('D26').value = null;
      invoiceSheet.getCell('D27').value = null;
      invoiceSheet.getCell('D28').value = null;
    }

    const supplierCode = getMakerValue(maker, 'supplierCode') || maker.code || 'コード未設定';
    const fileName = `【請求書】${sanitizeFileName(supplierCode, 'コード')}＿${sanitizeFileName(companyName, '企業')}_${sanitizeFileName(exhibition.title || '展示会', '展示会')}_${formatDateCompact(new Date())}.pdf`;
    return { workbook, invoiceSheet, fileName, companyName };
  };

  const handleDownloadInvoice = async (maker) => {
    try {
      const { workbook, invoiceSheet, fileName } = await buildInvoicePayloadForMaker(maker);
      await downloadInvoicePdfFromWorksheet(workbook, invoiceSheet, fileName);
    } catch (e) {
      console.error('請求書出力エラー:', e);
      alert(`請求書出力エラー: ${e.message}`);
    }
  };

  const handleDownloadInvoicesBulk = async () => {
    const confirmedMakers = makers.filter(m => m.status === 'confirmed');
    if (confirmedMakers.length === 0) {
      alert('参加確定の企業がないため、請求書を一括出力できません。');
      return;
    }
    if (!window.confirm(`参加確定 ${confirmedMakers.length} 社の請求書をZIPで一括ダウンロードしますか？`)) return;

    setIsBulkInvoiceDownloading(true);
    setBulkInvoiceProgress({ done: 0, total: confirmedMakers.length, phase: '作成中' });
    try {
      const JSZipModule = await import('jszip');
      const JSZip = JSZipModule.default || JSZipModule;
      const zip = new JSZip();
      const failed = [];

      for (let idx = 0; idx < confirmedMakers.length; idx++) {
        const maker = confirmedMakers[idx];
        try {
          const { workbook, invoiceSheet, fileName } = await buildInvoicePayloadForMaker(maker);
          const pdfBlob = await withTimeout(
            downloadInvoicePdfFromWorksheet(workbook, invoiceSheet, null),
            45000,
            'PDF生成がタイムアウトしました'
          );
          zip.file(fileName, pdfBlob);
        } catch (err) {
          const companyName = getMakerValue(maker, 'companyName') || maker.companyName || maker.code || '不明';
          failed.push(`${companyName}: ${err.message}`);
        }
        const done = idx + 1;
        setBulkInvoiceProgress({ done, total: confirmedMakers.length, phase: '作成中' });
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const successCount = confirmedMakers.length - failed.length;
      if (successCount <= 0) {
        throw new Error('すべての企業で請求書作成に失敗しました。');
      }

      setBulkInvoiceProgress({ done: confirmedMakers.length, total: confirmedMakers.length, phase: 'ZIP作成中' });
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'STORE'
      });
      const zipFileName = `【請求書一括】${sanitizeFileName(exhibition.title || '展示会', '展示会')}_${formatDateCompact(new Date())}.zip`;
      saveAs(zipBlob, zipFileName);

      if (failed.length > 0) {
        const preview = failed.slice(0, 5).join('\n');
        const omitted = failed.length > 5 ? `\n...他 ${failed.length - 5} 件` : '';
        alert(`請求書一括出力が完了しました。\n成功: ${successCount}件 / 失敗: ${failed.length}件\n\n${preview}${omitted}`);
      } else {
        alert(`請求書一括出力が完了しました。（${successCount}件）`);
      }
    } catch (e) {
      console.error('請求書一括出力エラー:', e);
      alert(`請求書一括出力エラー: ${e.message}`);
    } finally {
      setIsBulkInvoiceDownloading(false);
      setBulkInvoiceProgress({ done: 0, total: 0, phase: '' });
    }
  };

  const handleSaveMakerData = (newData) => {
    // ★修正: コードが変更された場合、既存の招待データとの重複チェックとマージを行う
    const updatedCode = newData.supplierCode || newData.code;

    if (updatedCode && updatedCode !== editingMaker.code) {
      // 自分以外で同じコードを持つメーカーを探す
      const duplicateTarget = makers.find(m => m.code === updatedCode && m.id !== editingMaker.id);

      if (duplicateTarget) {
        if (window.confirm(`仕入先コード「${updatedCode}」のデータが既にリストに存在します（${duplicateTarget.companyName} / ${duplicateTarget.status}）。\n\n現在の編集内容をそのデータに統合（上書き）して、整理しますか？\n\n※「はい」を押すと、現在のデータは既存の招待データに統合され、重複が解消されます。`)) {
          // マージ処理
          // 既存データ(duplicateTarget)を生かし、編集中のデータ(newData)で上書きする
          // IDは既存データのものを維持する（招待リンク等の整合性のため）
          const mergedMaker = {
            ...duplicateTarget,
            ...newData, // 新しいデータで上書き
            code: updatedCode,
            status: 'confirmed', // 申し込みデータからの統合なので確定にする
            response: {
              ...(duplicateTarget.response || {}),
              ...(editingMaker.response || {}),
              ...newData
            },
            respondedAt: editingMaker.respondedAt || new Date().toISOString(),
            invitationSentAt: duplicateTarget.invitationSentAt || editingMaker.invitationSentAt // 招待状送付日時は既存優先
          };

          // リスト更新: 既存データを更新し、編集中のデータ（古いID）を削除
          const updatedMakers = makers.map(m => {
            if (m.id === duplicateTarget.id) return mergedMaker;
            return m;
          }).filter(m => m.id !== editingMaker.id);

          setMakers(updatedMakers);
          setEditingMaker(null);
          setShowDetailModal(null);
          alert(`データを統合し、ステータスを「参加確定」に変更しました。\n統合先: ${duplicateTarget.companyName}`);
          return;
        }
      }
    }

    const updatedMakers = makers.map(m => {
      if (m.id === editingMaker.id) {
        const currentResponse = m.response || {};
        const newResponse = { ...currentResponse, ...newData };

        // Sync code with supplierCode if present (for display in list)
        if (newData.supplierCode) {
          newData.code = newData.supplierCode;
        }

        // Update both response object and root properties for compatibility
        return { ...m, response: newResponse, ...newData };
      }
      return m;
    });
    setMakers(updatedMakers);
    setEditingMaker(null);
    // Update detail modal view if open
    setShowDetailModal(prev => {
      if (!prev) return null;
      const newRes = { ...(prev.response || {}), ...newData };
      return { ...prev, response: newRes, ...newData };
    });
  };

  const handleDeleteInvitation = (maker) => {
    if (!window.confirm(`「${maker.companyName}」をリストから削除しますか？`)) return;
    if (!window.confirm('【警告】\n削除すると参加確定・招待中・辞退済みに関わらず、企業ポータルからこの展示会の情報は完全に削除されます。\n\n本当に削除してよろしいですか？')) return;

    const updatedMakers = makers.filter(x => x.id !== maker.id);
    setMakers(updatedMakers);
  };

  const [selectedMakerIds, setSelectedMakerIds] = useState(new Set());

  // Reset selection when tab changes
  useEffect(() => {
    setSelectedMakerIds(new Set());
  }, [activeTab]);

  const toggleSelect = (id) => {
    const newSet = new Set(selectedMakerIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedMakerIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedMakerIds.size === filteredMakers.length) {
      setSelectedMakerIds(new Set());
    } else {
      setSelectedMakerIds(new Set(filteredMakers.map(m => m.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedMakerIds.size === 0) return;
    if (!window.confirm(`選択した ${selectedMakerIds.size} 件の企業を削除しますか？`)) return;
    if (!window.confirm('【警告】\n削除するとこれらのデータは完全に失われます。\n本当によろしいですか？')) return;

    const updatedMakers = makers.filter(m => !selectedMakerIds.has(m.id));
    setMakers(updatedMakers);
    setSelectedMakerIds(new Set());
    alert(`削除しました`);
  };

  const handleNormalizeMakers = () => {
    // Group by code
    const groups = {};
    makers.forEach(m => {
      if (!m.code) return;
      if (!groups[m.code]) groups[m.code] = [];
      groups[m.code].push(m);
    });

    const toRemoveIds = new Set();
    let fixedCount = 0;

    const STATUS_PRIORITY = {
      'confirmed': 4,
      'declined': 3,
      'invited': 2,
      'listed': 1
    };

    Object.entries(groups).forEach(([code, groupMakers]) => {
      if (groupMakers.length < 2) return;

      // Sort by priority desc
      groupMakers.sort((a, b) => {
        const scoreA = STATUS_PRIORITY[a.status] || 0;
        const scoreB = STATUS_PRIORITY[b.status] || 0;

        // If status score is same, prefer one with response data
        if (scoreA === scoreB) {
          const hasResA = a.response && Object.keys(a.response).length > 0 ? 1 : 0;
          const hasResB = b.response && Object.keys(b.response).length > 0 ? 1 : 0;
          return hasResB - hasResA;
        }
        return scoreB - scoreA;
      });

      // Keep index 0, remove others
      for (let i = 1; i < groupMakers.length; i++) {
        toRemoveIds.add(groupMakers[i].id);
      }
      fixedCount++;
    });

    if (toRemoveIds.size === 0) {
      alert('重複データは見つかりませんでした。');
      return;
    }

    if (!window.confirm(`重複する仕入先コードを持つデータが ${fixedCount} グループ見つかりました。\n合計 ${toRemoveIds.size} 件の不要な重複データを削除し、最もステータスの高い（または情報の多い）データを残します。\n\n「参加確定」＞「辞退」＞「招待中」の優先順位で残します。\n実行してもよろしいですか？`)) return;

    const updatedMakers = makers.filter(m => !toRemoveIds.has(m.id));
    setMakers(updatedMakers);
    alert(`${toRemoveIds.size} 件の重複データを削除し、整理しました。`);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Top Actions */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Briefcase className="text-blue-600" /> メーカー招待管理</h2>
          <p className="text-slate-500 text-sm mt-1">招待リストの作成から一斉送信、回答管理までを一元化。</p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => onNavigate && onNavigate('enterprise')}
            className="flex-1 md:flex-none flex items-center gap-2 bg-slate-800 text-white px-4 py-3 rounded-lg font-bold hover:bg-slate-700 hover:-translate-y-0.5 transition-all text-sm"
          >
            <ExternalLink size={16} /> 企業管理コンソール
          </button>
          <button
            onClick={handleSendInvitations}
            className="flex-1 md:flex-none flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 hover:-translate-y-0.5 transition-all"
          >
            <Send size={18} /> 招待送付
          </button>
          <button
            onClick={handleExportInvitedExcel}
            className="flex-1 md:flex-none flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-500/30 hover:-translate-y-0.5 transition-all"
          >
            <Download size={18} /> リスト出力
          </button>
          <button
            onClick={handleCloseReception}
            className="flex-1 md:flex-none flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 px-6 py-3 rounded-lg font-bold hover:bg-red-100 hover:-translate-y-0.5 transition-all"
          >
            <XCircle size={18} /> 受付締切
          </button>
        </div>
      </div>

      {/* Form Settings & Demo (URL Removed) */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="font-bold text-blue-800 text-lg flex items-center gap-2"><PenTool size={20} /> 招待フォーム設定</h3>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm text-blue-600">招待状の文面やアンケート項目の設定、確認を行います。</p>
            {/* ★追加: 出展費用の表示 */}
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${formConfig.settings?.feePerBooth ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-red-100 text-red-600 border-red-200'}`}>
              出展費用: {formConfig.settings?.feePerBooth ? `${Number(formConfig.settings.feePerBooth).toLocaleString()}円` : '未設定'}
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowFormSettings(true)}
            className="flex items-center gap-2 bg-white text-blue-700 border border-blue-200 px-6 py-3 rounded-xl font-bold hover:bg-blue-50 shadow-sm"
          >
            <Settings size={18} /> フォーム編集
          </button>
          <button
            onClick={() => window.open(`${window.location.origin}${window.location.pathname}?mode=demo_maker_form&id=${exhibition.id}`, '_blank')}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-md"
          >
            <Eye size={18} /> 回答画面(デモ)
          </button>
        </div>
      </div>

      {/* Document Upload Section */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-xl border border-amber-100">
        <h3 className="font-bold text-amber-800 text-lg flex items-center gap-2 mb-4"><FileText size={20} /> 資料管理</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Layout PDF */}
          <div className="bg-white p-4 rounded-lg border border-amber-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <label className="font-bold text-slate-700 text-sm flex items-center gap-2">
                <LayoutDashboard size={16} className="text-amber-600" /> レイアウト表 (PDF URL)
              </label>
              {exhibition.documents?.layoutPdf?.url ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">設定済</span>
                  <button
                    onClick={async () => {
                      if (!confirm('レイアウト表のリンクを解除しますか？')) return;
                      try {
                        const docs = exhibition.documents || {};
                        const newDocs = { ...docs, layoutPdf: null };
                        await updateMainData('documents', JSON.parse(JSON.stringify(newDocs)));
                        alert('解除しました');
                      } catch (e) {
                        console.error(e);
                        alert('解除に失敗しました');
                      }
                    }}
                    className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors" title="削除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold">URL:</span>
                <input
                  type="url"
                  placeholder="https://example.com/layout.pdf"
                  value={exhibition.documents?.layoutPdf?.url || ''}
                  onChange={(e) => {
                    const docs = exhibition.documents || {};
                    const currentLayoutPdf = docs.layoutPdf || {};
                    const newDocs = {
                      ...docs,
                      layoutPdf: { ...currentLayoutPdf, url: e.target.value, uploadedAt: new Date().toISOString() }
                    };
                    updateMainData('documents', JSON.parse(JSON.stringify(newDocs)));
                  }}
                  className="flex-1 text-sm border border-slate-300 rounded px-2 py-2 outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50"
                />
              </div>
              <p className="text-[10px] text-slate-500">※Google Drive等の共有リンクを貼り付けてください</p>
            </div>
          </div>

          {/* Flyer PDF */}
          <div className="bg-white p-4 rounded-lg border border-amber-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <label className="font-bold text-slate-700 text-sm flex items-center gap-2">
                <FileText size={16} className="text-orange-600" /> 案内チラシ (PDF URL)
              </label>
              {exhibition.documents?.flyerPdf?.url ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">設定済</span>
                  <button
                    onClick={async () => {
                      if (!confirm('案内チラシのリンクを解除しますか？')) return;
                      try {
                        const docs = exhibition.documents || {};
                        const newDocs = { ...docs, flyerPdf: null };
                        await updateMainData('documents', JSON.parse(JSON.stringify(newDocs)));
                        alert('解除しました');
                      } catch (e) {
                        console.error(e);
                        alert('解除に失敗しました');
                      }
                    }}
                    className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors" title="削除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold">URL:</span>
                <input
                  type="url"
                  placeholder="https://example.com/flyer.pdf"
                  value={exhibition.documents?.flyerPdf?.url || ''}
                  onChange={(e) => {
                    const docs = exhibition.documents || {};
                    const currentFlyerPdf = docs.flyerPdf || {};
                    const newDocs = {
                      ...docs,
                      flyerPdf: { ...currentFlyerPdf, url: e.target.value, uploadedAt: new Date().toISOString() }
                    };
                    updateMainData('documents', JSON.parse(JSON.stringify(newDocs)));
                  }}
                  className="flex-1 text-sm border border-slate-300 rounded px-2 py-2 outline-none focus:ring-2 focus:ring-orange-400 bg-orange-50"
                />
              </div>
              <p className="text-[10px] text-slate-500">※Google Drive等の共有リンクを貼り付けてください</p>
            </div>
          </div>
        </div>

        {/* Send Documents Button */}
        <div className="mt-4 flex justify-end flex-col items-end">
          <button
            onClick={handleSendDocuments}
            disabled={isSendingDocs}
            className="flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-700 shadow-lg shadow-slate-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSendingDocs ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />} 資料公開通知を送る
          </button>
          <p className="text-xs text-slate-500 mt-2 text-right">
            ※ファイルをアップロードした時点で、企業のマイページには即座に反映されます。<br />
            このボタンは「資料を公開しました」という通知メッセージを送るためのものです。
          </p>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { key: 'invited', label: '招待リスト', count: stats.invited, color: 'blue' },
          { key: 'confirmed', label: '参加確定', count: stats.confirmed, color: 'emerald' },
          { key: 'declined', label: '辞退', count: stats.declined, color: 'slate' },
          { key: 'unanswered', label: '未回答', count: stats.unanswered, color: 'amber' }
        ].map(stat => (
          <div key={stat.key} onClick={() => setActiveTab(stat.key)} className={`p-5 rounded-xl border-2 cursor-pointer transition-all hover:bg-slate-50 relative overflow-hidden group bg-white ${activeTab === stat.key ? `border-${stat.color}-500 shadow-md` : 'border-transparent shadow-sm'}`}>
            <p className="text-xs font-bold text-slate-400 uppercase">{stat.label}</p>
            <p className={`text-3xl font-bold text-${stat.color}-600 mt-1`}>{stat.count}</p>
          </div>
        ))}
      </div>

      {/* List Management */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          {['invited', 'confirmed', 'declined', 'unanswered'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 font-bold text-sm capitalize transition-colors ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
            >
              {tab === 'invited' ? '招待リスト' : tab === 'confirmed' ? '参加確定' : tab === 'declined' ? '辞退' : '未回答'} ({stats[tab]})
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-auto">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-full md:w-64 outline-none focus:ring-2 focus:ring-blue-500" placeholder="会社名・コード検索..." />
          </div>

          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            {/* 一括削除ボタン */}
            {selectedMakerIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-100 shadow-sm whitespace-nowrap animate-fade-in"
              >
                <Trash2 size={16} /> 選択した {selectedMakerIds.size} 件を削除
              </button>
            )}

            {activeTab === 'invited' && (
              <>
                <button
                  onClick={handleNormalizeMakers}
                  className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 shadow-sm whitespace-nowrap"
                  title="重複データを整理します"
                >
                  <Wand2 size={16} /> データ整理
                </button>
                <button
                  onClick={handleImportFixedMakers}
                  className="flex items-center gap-2 bg-white border border-green-600 text-green-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-50 shadow-sm whitespace-nowrap"
                >
                  <RefreshCw size={16} /> 固定リスト反映
                </button>
                <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-blue-50 text-blue-600 border border-blue-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-100 shadow-sm whitespace-nowrap">
                  <Plus size={16} /> 個別追加
                </button>
              </>
            )}
            {activeTab === 'confirmed' && (
              <>
                <select value={confirmedFilter} onChange={e => setConfirmedFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none">
                  <option value="all">全表示</option>
                  <option value="power">電源利用者</option>
                  <option value="lunch">弁当手配あり</option>
                </select>
                <button onClick={handleExportConfirmedExcel} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 shadow-sm whitespace-nowrap">
                  <Download size={16} /> 回答Excel
                </button>
                <button
                  onClick={handleDownloadInvoicesBulk}
                  disabled={isBulkInvoiceDownloading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap ${isBulkInvoiceDownloading ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                  title="参加確定企業の請求書をZIPで一括DL"
                >
                  {isBulkInvoiceDownloading ? <Loader size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                  {isBulkInvoiceDownloading
                    ? `請求書一括 ${bulkInvoiceProgress.phase}${bulkInvoiceProgress.total > 0 ? ` (${bulkInvoiceProgress.done}/${bulkInvoiceProgress.total})` : ''}`
                    : '請求書一括ZIP'}
                </button>
              </>
            )}

          </div>
        </div>

        {/* Confirmed Aggregates Bar */}
        {activeTab === 'confirmed' && (
          <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex flex-wrap gap-6 text-sm text-emerald-800 animate-fade-in shadow-inner">
            <div className="font-bold flex items-center gap-2 bg-white/50 px-3 py-1 rounded-lg"><LayoutGrid size={16} /> コマ数合計: <span className="text-xl text-emerald-700">{aggregates.totalBooths}</span></div>
            <div className="font-bold flex items-center gap-2 bg-white/50 px-3 py-1 rounded-lg"><Users size={16} /> 参加人数: <span className="text-xl text-emerald-700">{aggregates.totalPeople}</span></div>
            <div className="flex items-center gap-2 bg-white/50 px-3 py-1 rounded-lg"><span className="text-emerald-600">🍱 弁当:</span> <strong>{aggregates.totalLunch}</strong></div>
            <div className="flex items-center gap-2 bg-white/50 px-3 py-1 rounded-lg"><span className="text-emerald-600">🪑 長机:</span> <strong>{aggregates.totalDesks}</strong></div>
            <div className="flex items-center gap-2 bg-white/50 px-3 py-1 rounded-lg"><span className="text-emerald-600">🪑 椅子:</span> <strong>{aggregates.totalChairs}</strong></div>
            <div className="flex items-center gap-2 bg-white/50 px-3 py-1 rounded-lg"><span className="text-emerald-600">⚡ 電源:</span> <strong>{aggregates.totalPower}</strong></div>
          </div>
        )}

        {/* List Content Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b">
              <tr>
                <th className="p-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={filteredMakers.length > 0 && selectedMakerIds.size === filteredMakers.length}
                    onChange={toggleSelectAll}
                    disabled={filteredMakers.length === 0}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="p-4 w-20">No</th>
                <th className="p-4 w-24">コード</th>
                <th className="p-4">会社名 / 担当者</th>
                <th className="p-4 w-32">ステータス</th>
                <th className="p-4">メーカーポータル</th>
                <th className="p-4">備考</th>
                <th className="p-4 w-32 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMakers.map((m, idx) => (
                <tr key={m.id} className={`hover:bg-slate-50 transition-colors group ${m.status === 'declined' ? 'opacity-60 bg-slate-100 grayscale' : ''} ${selectedMakerIds.has(m.id) ? 'bg-blue-50' : ''}`}>
                  <td className="p-4 text-center">
                    <input
                      type="checkbox"
                      checked={selectedMakerIds.has(m.id)}
                      onChange={() => toggleSelect(m.id)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="p-4 text-slate-400">{idx + 1}</td>
                  <td className="p-4 font-mono text-slate-600">{m.code}</td>
                  <td className="p-4 cursor-pointer" onClick={() => activeTab === 'confirmed' && setShowDetailModal(m)}>
                    <div className={`font-bold text-slate-800 ${activeTab === 'confirmed' ? 'text-blue-600 hover:underline' : ''}`}>{m.companyName}</div>
                    <div className="text-xs text-slate-500">{(m.response && m.response.repName) || m.repName || '-'}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold inline-block text-center min-w-[80px] ${m.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                      m.status === 'declined' ? 'bg-slate-100 text-slate-500' :
                        m.status === 'invited' ? 'bg-red-100 text-red-700 border border-red-200' :
                          'bg-amber-100 text-amber-700' // listed
                      }`}>
                      {m.status === 'confirmed' ? '参加確定' : m.status === 'declined' ? '辞退' : m.status === 'invited' ? '招待中' : '未送付'}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-slate-600">
                    {(() => {
                      const masterMaker = masterMakers.find(mm => mm.code === m.code);
                      if (m.code && masterMaker) {
                        return (
                          <div className="flex items-center gap-2">
                            <a href={`${window.location.origin}${window.location.pathname}?mode=maker&code=${m.code}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                              <LinkIcon size={12} /> ポータル
                            </a>
                            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?mode=maker&code=${m.code}`); alert('URLをコピーしました'); }} className="text-slate-400 hover:text-blue-500" title="URLをコピー">
                              <Copy size={12} />
                            </button>
                          </div>
                        );
                      }
                      return <span className="text-slate-400">未登録 (No Code)</span>;
                    })()}
                  </td>
                  <td className="p-4 text-slate-500 text-xs truncate max-w-[150px]">{m.note}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* 編集ボタン: 全ステータスで表示 */}
                      <button onClick={() => setEditingMaker(m)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="編集">
                        <PenTool size={16} />
                      </button>
                      {activeTab === 'confirmed' && (
                        <button onClick={() => handleDownloadInvoice(m)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded" title="請求書DL">
                          <FileSpreadsheet size={16} />
                        </button>
                      )}
                      {/* 詳細ボタン: 参加確定のみ (回答詳細があるため) */}
                      {activeTab === 'confirmed' && (
                        <button onClick={() => setShowDetailModal(m)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="詳細"><Eye size={16} /></button>
                      )}
                      <button onClick={() => handleDeleteInvitation(m)} className="p-2 text-slate-400 hover:text-red-500 rounded hover:bg-red-50" title="削除"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMakers.length === 0 && (
                <tr>
                  <td colSpan="8" className="p-12 text-center text-slate-400">データがありません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl animate-fade-in">
            <h3 className="font-bold text-lg mb-4">企業個別追加</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              handleAddMaker({ code: formData.get('code'), companyName: formData.get('name') });
            }} className="space-y-4">
              <div><label className="block text-sm font-bold text-slate-700 mb-1">会社名</label><input name="name" required className="w-full p-2 border rounded" autoFocus /></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-1">仕入先コード</label><input name="code" required className="w-full p-2 border rounded" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-slate-100 rounded hover:bg-slate-200">キャンセル</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">追加</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Maker Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <div>
                <h3 className="text-2xl font-bold text-slate-800">{showDetailModal.companyName}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-mono">{showDetailModal.code}</span>
                  <span className="text-slate-500 text-sm">回答日時: {new Date(showDetailModal.respondedAt).toLocaleString()}</span>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(null)} className="p-2 hover:bg-slate-100 rounded-full"><X size={24} /></button>
            </div>

            <div className="space-y-6">
              {(() => {
                const m = showDetailModal;
                const getVal = (key) => {
                  if (m.response && m.response[key] !== undefined && m.response[key] !== '') return m.response[key];
                  if (m[key] !== undefined && m[key] !== '') return m[key];
                  return null;
                };

                return (
                  <div className="px-2">
                    <div className="flex items-center justify-end mb-4">
                      <button onClick={() => setEditingMaker(m)} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-blue-700 transition-colors">
                        <PenTool size={14} /> 編集
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      {/* Left Column: Basic Info */}
                      <div>
                        <h4 className="font-bold text-slate-500 border-b border-slate-300 pb-2 mb-4">基本情報</h4>
                        <div className="space-y-6">
                          <div>
                            <p className="text-xs font-bold text-slate-500 mb-1">会社名</p>
                            <p className="text-base text-slate-800 font-medium">{m.companyName}</p>
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
                          {/* Payment Method - Assuming field or default */}
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

                      {/* Right Column: Exhibit Details */}
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

                          {/* Equipment Box */}
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
                                  {(getVal('itemsPower') === '必要' || getVal('power') > 0 || String(getVal('power')) === 'あり' || JSON.stringify(m).includes('電源利用：あり')) ? '必要' : '不要'}
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

                    {/* Bottom Section */}
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
                );
              })()}
            </div>

            <div className="mt-8 flex justify-end pt-4 border-t">
              <button onClick={() => setShowDetailModal(null)} className="bg-slate-800 text-white px-8 py-3 rounded-lg font-bold hover:bg-slate-700 shadow-lg">閉じる</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingMaker && (
        <MakerDataEditModal
          maker={editingMaker}
          onSave={handleSaveMakerData}
          onClose={() => setEditingMaker(null)}
        />
      )}

      {showFormSettings && <FormEditorModal config={formConfig} exhibition={exhibition} onSave={(newConfig) => { updateMainData('formConfig', newConfig); setShowFormSettings(false); }} onClose={() => setShowFormSettings(false)} />}
    </div >
  );
}

// TabEntrance: QRスキャン実装 (修正版: 連打防止・URL表示)
function TabEntrance({ exhibition, updateVisitorCount, visitors, setVisitors, updateMainData, initialMode }) {
  const { formUrlVisitor, visitorFormConfig } = exhibition;
  const [mode, setMode] = useState(initialMode || 'dashboard');
  const [showSimulatedPublicForm, setShowSimulatedPublicForm] = useState(false);
  const [lastScannedVisitor, setLastScannedVisitor] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [isShortening, setIsShortening] = useState(false);
  const [isCopied, setIsCopied] = useState(false); // isCopied state for TabEntrance
  const [isScanning, setIsScanning] = useState(true); // Scanner state for TabEntrance

  // 連続読み取り防止用のRef
  const lastScanTime = useRef(0);

  // Scanner handler for TabEntrance
  const handleScan = (result) => {
    if (!result || result.length === 0 || !isScanning) return;
    const rawValue = result[0]?.rawValue;
    if (rawValue) {
      handleRealScan(rawValue);
    }
  };

  // URL短縮機能 (is.gd - 直接リダイレクト、英語ページ表示なし)
  const shortenUrl = async () => {
    if (!formUrlVisitor) return;
    setIsShortening(true);
    try {
      // is.gd API (無料・認証不要・直接リダイレクト)
      const response = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(formUrlVisitor)}`);
      if (response.ok) {
        const shortened = await response.text();
        setShortUrl(shortened);
        navigator.clipboard.writeText(shortened);
        alert('短縮URLをクリップボードにコピーしました！\nQRコードに使用できます。');
      } else {
        alert('URL短縮に失敗しました');
      }
    } catch (e) {
      alert('URL短縮エラー: ' + e.message);
    }
    setIsShortening(false);
  };

  // URLリフレッシュ機能
  const refreshVisitorUrl = () => {
    if (!window.confirm('来場者登録フォームのURLを更新します。\n古いURLは無効になりますがよろしいですか？')) return;
    const baseUrl = window.location.origin + window.location.pathname;
    const newUrl = `${baseUrl}?mode=visitor_register&id=${exhibition.id}`;
    updateMainData('formUrlVisitor', newUrl);
    setShortUrl(''); // 短縮URLもクリア
    alert('URLを更新しました！');
  };

  // Copy function for TabEntrance
  const copyVisitorFormUrl = () => {
    const urlToCopy = shortUrl || formUrlVisitor;
    if (!urlToCopy) return;
    navigator.clipboard.writeText(urlToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  const handleConfigSave = (newConfig) => {
    updateMainData('visitorFormConfig', newConfig);
    setMode('dashboard');
  };

  // 実機スキャン用ハンドラ (react-qr-scanner用) - 修正版
  const handleRealScan = (dataString) => {
    if (!dataString) return;

    // クールダウン処理（2秒間は再スキャンしない）
    const now = Date.now();
    if (now - lastScanTime.current < 2000) return;
    lastScanTime.current = now;

    try {
      const data = JSON.parse(dataString);

      // データ形式チェック
      if (!data.id) return;

      const exists = visitors.find(v => v.id === data.id);

      if (exists) {
        if (exists.status !== 'checked-in') {
          const updated = visitors.map(v => v.id === data.id ? { ...v, status: 'checked-in' } : v);
          updateMainData('visitors', updated);
          updateVisitorCount(exhibition.id, exhibition.currentVisitors + 1);
          setLastScannedVisitor({ ...exists, status: 'checked-in', isNew: false });
        } else {
          setLastScannedVisitor({ ...exists, msg: '既に入場済みです' });
        }
      } else {
        alert("未登録のQRコードです");
      }
    } catch (e) {
      console.log('Invalid QR Data', e);
    }
  };

  const handlePublicRegister = (data) => {
    // data already contains ID and status from the form component
    updateMainData('visitors', [...visitors, data]);
    // Do NOT close the modal, let it show the QR code
  };

  const filteredVisitors = visitors.filter(v =>
    (v.companyName || '').includes(searchTerm) || (v.repName || '').includes(searchTerm)
  );

  return (
    <div className="flex flex-col md:flex-row md:h-[800px] h-auto min-h-[calc(100vh-200px)]">
      <div className="w-full md:w-64 bg-slate-50 border-r border-slate-200 p-4 flex flex-row md:flex-col gap-2 overflow-x-auto">
        <h3 className="font-bold text-slate-500 mb-2 px-2 hidden md:block">Entrance Menu</h3>
        <button onClick={() => setMode('dashboard')} className={`flex-1 md:flex-none text-left px-4 py-3 rounded-lg font-bold flex items-center justify-center md:justify-start gap-2 whitespace-nowrap ${mode === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-600'}`}><List size={18} /> <span className="hidden md:inline">来場者リスト</span><span className="md:hidden">リスト</span></button>
        <button onClick={() => setMode('scanner')} className={`flex-1 md:flex-none text-left px-4 py-3 rounded-lg font-bold flex items-center justify-center md:justify-start gap-2 whitespace-nowrap ${mode === 'scanner' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-100 text-slate-600'}`}><ScanLine size={18} /> <span className="hidden md:inline">QR受付スキャン</span><span className="md:hidden">スキャン</span></button>
        <div className="border-t my-2 hidden md:block"></div>
        <button onClick={() => setMode('editForm')} className={`flex-1 md:flex-none text-left px-4 py-3 rounded-lg font-bold flex items-center justify-center md:justify-start gap-2 whitespace-nowrap ${mode === 'editForm' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-600'}`}><Settings size={18} /> <span className="hidden md:inline">登録フォーム編集</span><span className="md:hidden">設定</span></button>
      </div>

      <div className="flex-1 overflow-y-auto bg-white p-4 md:p-8">

        {/* 事前登録URL表示エリア */}
        <div className="bg-slate-900 text-slate-300 rounded-xl p-5 mb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full">
              <h4 className="font-bold text-white mb-1 flex items-center gap-2"><QrCode size={18} /> 事前登録用フォーム</h4>
              <div className="bg-yellow-900/30 border border-yellow-700/50 p-2 rounded mb-2 text-[10px] text-yellow-200">
                <p>⚠️ スマホで読み取る場合、URLが <strong>localhost</strong> だとアクセスできません。</p>
                <p>PCのIPアドレス（例: 192.168.x.x）に変更してください。</p>
              </div>
              <div className="mt-2 flex gap-2">
                <div className="relative w-full">
                  <input
                    type="text"
                    value={formUrlVisitor}
                    onChange={(e) => updateMainData('formUrlVisitor', e.target.value)}
                    className="bg-slate-800 text-blue-300 text-xs px-3 py-2 rounded border border-slate-700 w-full focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="https://..."
                  />
                  {shortUrl && <span className="absolute right-2 top-2 text-[10px] bg-blue-900 px-1 rounded text-blue-200">短縮中</span>}
                </div>
                <button className={`px-3 py-2 rounded text-xs flex items-center gap-1 shrink-0 transition-colors ${isCopied ? 'bg-green-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`} onClick={copyVisitorFormUrl}>{isCopied ? <Check size={14} /> : <Copy size={14} />} {isCopied ? '完了' : 'コピー'}</button>
                <button onClick={refreshVisitorUrl} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded text-xs flex items-center gap-1 shrink-0" title="初期化"><RefreshCcw size={14} /></button>
              </div>

              {/* QR Link */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a
                  href="https://qr.paps.jp/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded text-xs font-bold flex items-center gap-2 transition-colors"
                >
                  <QrCode size={14} /> QR作成(外部)
                </a>
              </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto items-start">
              <button onClick={() => setShowSimulatedPublicForm(true)} className="flex-1 md:flex-none bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white px-4 py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg transform hover:scale-105 transition-all text-xs md:text-sm"><ExternalLink size={16} /> 登録画面(デモ)</button>
            </div>
          </div>
        </div>

        {mode === 'dashboard' && (
          <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
              <div><h2 className="text-2xl font-bold text-slate-800">来場者リスト</h2></div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative w-full md:w-auto">
                  <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input type="text" placeholder="名前・会社名で検索" className="pl-9 pr-4 py-2 border rounded-full text-sm w-full md:w-64 focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[600px]">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b"><tr><th className="p-4">ステータス</th><th className="p-4">受付区分</th><th className="p-4">氏名</th><th className="p-4">会社名</th><th className="p-4">メール</th><th className="p-4">電話番号</th><th className="p-4">人数</th><th className="p-4">操作</th></tr></thead>
                <tbody>
                  {filteredVisitors.map((v) => (
                    <tr key={v.id} className="border-b hover:bg-slate-50 transition-colors">
                      <td className="p-4">{v.status === 'checked-in' ? <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex items-center w-fit gap-1"><CheckCircle size={12} /> 来場済</span> : <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold">未入場</span>}</td>
                      <td className="p-4 text-slate-600">{v.type}</td><td className="p-4 font-bold text-slate-800">{v.repName}</td><td className="p-4 text-slate-600">{v.companyName}</td><td className="p-4 text-slate-600 text-xs">{v.email || '-'}</td><td className="p-4 text-slate-600 text-xs">{v.phone || '-'}</td><td className="p-4 text-slate-600">{v.count || 1}名</td>
                      <td className="p-4">
                        <button onClick={() => {
                          if (window.confirm(`${v.repName} 様の来場記録を削除しますか？`)) {
                            const updated = visitors.filter(item => item.id !== v.id);
                            updateMainData('visitors', updated);
                          }
                        }} className="text-slate-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  {filteredVisitors.length === 0 && <tr><td colSpan="8" className="p-8 text-center text-slate-400">該当なし</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {mode === 'scanner' && (
          <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center animate-fade-in">
            {/* ヘッダー部分 */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10">
              <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                <Camera className="text-blue-400" /> QR受付スキャン
              </h2>
              <button
                onClick={() => setMode('dashboard')}
                className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-full transition-colors"
                title="スキャナーを閉じる"
              >
                <X size={24} />
              </button>
            </div>

            {/* スキャナーエリア */}
            <div className="w-full max-w-lg px-4 flex flex-col items-center">
              <div className="rounded-2xl overflow-hidden bg-black relative border-4 border-blue-500/50 w-full aspect-square shadow-2xl mb-6">
                {isScanning ? (
                  <Scanner
                    onScan={handleScan}
                    styles={{ container: { width: '100%', height: '100%' } }}
                    allowMultiple={true}
                    scanDelay={500}
                    components={{
                      audio: false,
                      onOff: false,
                      torch: false,
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">
                    <p className="font-bold animate-pulse">Processing...</p>
                  </div>
                )}
                {/* スキャンフレーム */}
                <div className="absolute inset-4 border-2 border-blue-400 rounded-lg pointer-events-none" />
                <div className="absolute inset-4 border-t-4 border-l-4 border-blue-500 rounded-tl-lg w-8 h-8 pointer-events-none" />
                <div className="absolute inset-4 border-t-4 border-r-4 border-blue-500 rounded-tr-lg w-8 h-8 ml-auto pointer-events-none" />
                <div className="absolute bottom-4 left-4 border-b-4 border-l-4 border-blue-500 rounded-bl-lg w-8 h-8 pointer-events-none" />
                <div className="absolute bottom-4 right-4 border-b-4 border-r-4 border-blue-500 rounded-br-lg w-8 h-8 pointer-events-none" />
              </div>

              {/* スキャン結果表示 */}
              {lastScannedVisitor && (
                <div className="bg-green-600 rounded-xl p-4 text-white animate-slide-up shadow-lg text-left w-full mb-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-full"><UserCheck size={32} /></div>
                    <div>
                      <p className="text-xs opacity-80 uppercase tracking-wider font-bold">Check-in Complete</p>
                      <p className="text-xl font-bold">{lastScannedVisitor.repName} 様</p>
                      <p className="text-sm opacity-90">{lastScannedVisitor.companyName}</p>
                    </div>
                  </div>
                  {lastScannedVisitor.msg && <p className="mt-2 text-yellow-300 text-sm font-bold bg-black/20 p-1 rounded">{lastScannedVisitor.msg}</p>}
                </div>
              )}

              <p className="text-slate-400 text-sm text-center">来場者のQRコードをカメラにかざしてください</p>
              <p className="text-slate-500 text-xs mt-2 text-center">カメラへのアクセスを許可してください</p>
            </div>

            {/* 閉じるボタン（下部） */}
            <div className="absolute bottom-8 left-0 right-0 flex justify-center">
              <button
                onClick={() => setMode('dashboard')}
                className="bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-colors border border-white/30"
              >
                <ArrowLeft size={18} /> 来場者リストに戻る
              </button>
            </div>
          </div>
        )}

        {mode === 'editForm' && <VisitorFormEditor config={visitorFormConfig} onSave={handleConfigSave} />}
      </div>
      {showSimulatedPublicForm && <SimulatedPublicVisitorForm config={visitorFormConfig} onClose={() => setShowSimulatedPublicForm(false)} onSubmit={handlePublicRegister} />}
    </div>
  );
}
// ============================================================================
// 4. 展示会詳細タブ (Main, Tasks, Lectures)
// ============================================================================

function TabMainBoard({ exhibition, updateMainData, updateBatch, tasks, onNavigate }) {
  const [newMember, setNewMember] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showHotelModal, setShowHotelModal] = useState(false);
  const [hotelForm, setHotelForm] = useState({ name: '', url: '', dates: [], members: [] });
  const [tempHotelDate, setTempHotelDate] = useState('');

  // Edit form state (mirrors CreateExhibitionForm fields)
  const [editData, setEditData] = useState({});
  const [tempEditDate, setTempEditDate] = useState('');
  const [tempEditPreDate, setTempEditPreDate] = useState('');
  const [editErrors, setEditErrors] = useState([]);

  // Initialize edit data when settings modal opens
  useEffect(() => {
    if (showSettings) {
      setEditData({
        title: exhibition.title || '',
        dates: exhibition.dates || [],
        preDates: exhibition.preDates || [],
        place: exhibition.place || '',
        prefecture: exhibition.prefecture || '',
        venueAddress: exhibition.venueAddress || '',
        openTime: exhibition.openTime || '10:00',
        closeTime: exhibition.closeTime || '17:00',
        concept: exhibition.concept || '',
        targetVisitors: exhibition.targetVisitors || 0,
        targetMakers: exhibition.targetMakers || 0,
        targetProfit: exhibition.targetProfit || 0,
        venueUrl: exhibition.venueUrl || '',
        googleMapsUrl: exhibition.googleMapsUrl || '',
        staff: exhibition.staff || ''
      });
      setEditErrors([]);
    }
  }, [showSettings, exhibition]);

  // === Stats Calculations ===
  // 来場者数: QRスキャンでチェックインした人数
  const scannedVisitors = exhibition.visitors?.filter(v => v.status === 'checked-in').length || 0;
  // 事前登録者数: 登録者の総数
  const preRegistrations = exhibition.visitors?.length || 0;
  const confirmedMakers = exhibition.makers?.filter(m => m.status === 'confirmed') || [];
  const pendingMakers = exhibition.makers?.filter(m => !m.status || m.status === 'invited' || m.status === 'pending') || [];

  // Budget calculation (replicate TabBudget logic)
  const extractNum = (s) => parseInt(String(s).replace(/[^0-9]/g, '')) || 1;
  const { venueDetails, otherBudgets, makers, lectures } = exhibition;
  const equipmentTotal = (venueDetails?.equipment || []).reduce((sum, item) => sum + (item.count * item.price), 0);
  const boothIncome = (makers || []).filter(m => m.status === 'confirmed').reduce((sum, m) => sum + (extractNum(m.boothCount) * 30000), 0);
  const lectureFees = (lectures || []).reduce((sum, l) => sum + Number(l.fee || 0) + Number(l.transportFee || 0), 0);
  const incomes = (otherBudgets || []).filter(b => b.type === 'income');
  const expenses = (otherBudgets || []).filter(b => b.type === 'expense');
  const totalIncome = boothIncome + incomes.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const totalExpense = (venueDetails?.cost || 0) + equipmentTotal + lectureFees + expenses.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const finalBalance = totalIncome - totalExpense;

  // Urgent Tasks (Due within 7 days and not done)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const urgentTasks = (tasks || [])
    .filter(t => {
      if (t.status === 'done' || !t.dueDate) return false;
      const due = new Date(t.dueDate);
      due.setHours(0, 0, 0, 0);
      const diff = (due - today) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    })
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);

  // Staff array
  const staffList = exhibition.staff?.split(',').map(s => s.trim()).filter(Boolean) || [];

  // === Member Management ===
  const addMember = () => {
    if (!newMember.trim()) return;
    if (!staffList.includes(newMember.trim())) {
      updateMainData('staff', [...staffList, newMember.trim()].join(', '));
    }
    setNewMember('');
  };
  const removeMember = (name) => {
    updateMainData('staff', staffList.filter(s => s !== name).join(', '));
  };

  // === Hotel Management ===
  const hotels = exhibition.hotelReservations || [];
  const addHotelDate = () => {
    if (tempHotelDate && !hotelForm.dates.includes(tempHotelDate)) {
      setHotelForm({ ...hotelForm, dates: [...hotelForm.dates, tempHotelDate].sort() });
      setTempHotelDate('');
    }
  };
  const removeHotelDate = (d) => setHotelForm({ ...hotelForm, dates: hotelForm.dates.filter(x => x !== d) });
  const toggleHotelMember = (m) => {
    if (hotelForm.members.includes(m)) {
      setHotelForm({ ...hotelForm, members: hotelForm.members.filter(x => x !== m) });
    } else {
      setHotelForm({ ...hotelForm, members: [...hotelForm.members, m] });
    }
  };
  const saveHotel = () => {
    if (!hotelForm.name.trim()) return;
    const newHotel = { id: crypto.randomUUID(), ...hotelForm };
    updateMainData('hotelReservations', [...hotels, newHotel]);
    setHotelForm({ name: '', url: '', dates: [], members: [] });
    setShowHotelModal(false);
  };
  const removeHotel = (id) => {
    updateMainData('hotelReservations', hotels.filter(h => h.id !== id));
  };

  // === Edit Settings Logic ===
  const addEditDate = (type) => {
    const val = type === 'main' ? tempEditDate : tempEditPreDate;
    if (!val) return;
    const key = type === 'main' ? 'dates' : 'preDates';
    if (!editData[key].includes(val)) {
      setEditData({ ...editData, [key]: [...editData[key], val].sort() });
    }
    type === 'main' ? setTempEditDate('') : setTempEditPreDate('');
  };
  const removeEditDate = (type, idx) => {
    const key = type === 'main' ? 'dates' : 'preDates';
    setEditData({ ...editData, [key]: editData[key].filter((_, i) => i !== idx) });
  };
  const validateAndSave = () => {
    const errors = [];
    if (!editData.title.trim()) errors.push('展示会タイトルは必須です');
    if (!editData.dates || editData.dates.length === 0) errors.push('開催日を1日以上追加してください');
    if (!editData.targetVisitors || editData.targetVisitors <= 0) errors.push('集客目標を入力してください');
    if (!editData.targetMakers || editData.targetMakers <= 0) errors.push('招致メーカー目標を入力してください');
    if (!editData.targetProfit || editData.targetProfit <= 0) errors.push('目標利益額を入力してください');
    if (!editData.staff || editData.staff.split(',').filter(s => s.trim()).length === 0) errors.push('運営スタッフを1人以上追加してください');
    if (errors.length > 0) {
      setEditErrors(errors);
      return;
    }
    // Save all changes in batch
    updateBatch(editData);
    setShowSettings(false);
  };

  // Google Maps Embed URL (query-based, no API key needed)
  const mapQuery = exhibition.venueAddress || exhibition.place || '';
  const mapEmbedUrl = mapQuery ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed` : '';

  // Color palette for member avatars
  const avatarColors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500', 'bg-cyan-500'];
  const getAvatarColor = (idx) => avatarColors[idx % avatarColors.length];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Settings Button (Top Right) */}
      <div className="flex justify-end">
        <button onClick={() => setShowSettings(true)} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors shadow-lg">
          <Settings size={18} /> 設定変更
        </button>
      </div>

      {/* 4 Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 来場者数 Card (Blue gradient) */}
        <div onClick={() => onNavigate && onNavigate('entrance')} className="cursor-pointer bg-gradient-to-br from-blue-500 to-blue-600 text-white p-5 rounded-2xl shadow-lg relative overflow-hidden transition-transform hover:scale-[1.02]">
          <div className="absolute -top-4 -right-4 w-20 h-20 bg-blue-400/30 rounded-full blur-xl"></div>
          <div className="flex items-center gap-2 text-blue-100 text-sm font-medium mb-2"><Users size={16} /> 来場者数</div>
          <div className="text-4xl font-black">{scannedVisitors.toLocaleString()}</div>
          <div className="text-blue-200 text-sm mt-1">目標: {(exhibition.targetVisitors || 0).toLocaleString()} ({exhibition.targetVisitors > 0 ? ((scannedVisitors / exhibition.targetVisitors) * 100).toFixed(1) : 0}%)</div>
          <div className="mt-3 h-2 bg-blue-400/50 rounded-full overflow-hidden">
            <div className="h-full bg-white transition-all duration-700" style={{ width: `${Math.min((scannedVisitors / (exhibition.targetVisitors || 1)) * 100, 100)}%` }}></div>
          </div>
        </div>

        {/* 出展メーカー Card */}
        <div onClick={() => onNavigate && onNavigate('makers')} className="cursor-pointer bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all hover:border-blue-200">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-2"><Building2 size={16} /> 出展メーカー</div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-slate-800">{confirmedMakers.length}</span>
            <span className="text-slate-400 text-lg">社 (確定)</span>
          </div>
          {pendingMakers.length > 0 && (
            <div className="text-amber-500 text-sm font-bold mt-1">未回答: {pendingMakers.length}社</div>
          )}
        </div>

        {/* 事前登録者数 Card */}
        <div onClick={() => onNavigate && onNavigate('entrance')} className="cursor-pointer bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all hover:border-blue-200">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-2"><FileText size={16} /> 事前登録者数</div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-slate-800">{preRegistrations.toLocaleString()}</span>
            <span className="text-slate-400 text-lg">名</span>
          </div>
        </div>

        {/* 最終収支 Card */}
        <div onClick={() => onNavigate && onNavigate('budget')} className="cursor-pointer bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all hover:border-blue-200">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-2"><TrendingUp size={16} /> 最終収支</div>
          <div className={`text-3xl font-black ${finalBalance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            ¥{finalBalance.toLocaleString()}
          </div>
          <div className="text-slate-400 text-xs mt-1">出展費用+雑収入 - 総支出</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Urgent Tasks */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <h3 className="text-amber-700 font-bold flex items-center gap-2 mb-4"><AlertTriangle size={18} /> 期限が迫っているタスク</h3>
            {urgentTasks.length === 0 ? (
              <p className="text-amber-600 text-sm">現在、期限間近のタスクはありません。</p>
            ) : (
              <div className="space-y-2">
                {urgentTasks.map(t => {
                  const due = new Date(t.dueDate);
                  due.setHours(0, 0, 0, 0);
                  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
                  const isOverdue = diff < 0;
                  const isToday = diff === 0;
                  return (
                    <div key={t.id} className="bg-white p-3 rounded-xl border border-amber-100 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-800">{t.title}</p>
                        <span className="text-xs text-slate-500">{t.assignee}</span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${isOverdue ? 'bg-red-100 text-red-600' : isToday ? 'bg-orange-100 text-orange-600' : 'bg-amber-100 text-amber-700'}`}>
                        {isOverdue ? '期限切れ' : isToday ? '本日' : `残り${diff}日`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Venue Information */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-4"><MapPin size={18} className="text-blue-500" /> 会場インフォメーション</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-slate-400 block">会場名</span>
                  <span className="font-bold text-slate-800 text-lg">{exhibition.place || '未設定'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">住所</span>
                  <span className="text-slate-700">{exhibition.venueAddress || '未設定'}</span>
                </div>
                <div className="flex gap-8">
                  <div>
                    <span className="text-xs text-slate-400 block">開場</span>
                    <span className="font-bold text-slate-800">{exhibition.openTime || '10:00'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">閉場</span>
                    <span className="font-bold text-slate-800">{exhibition.closeTime || '17:00'}</span>
                  </div>
                </div>
                <div className="flex gap-4 pt-2">
                  {exhibition.venueUrl && (
                    <a href={exhibition.venueUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1"><ExternalLink size={14} /> 会場Webサイト</a>
                  )}
                  {exhibition.googleMapsUrl && (
                    <a href={exhibition.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1"><Map size={14} /> Googleマップで開く</a>
                  )}
                </div>
              </div>
              {/* Map Embed */}
              <div className="rounded-xl overflow-hidden border border-slate-200 h-48 bg-slate-100">
                {mapEmbedUrl ? (
                  <iframe src={mapEmbedUrl} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Venue Map"></iframe>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">地図を表示するには住所を設定してください</div>
                )}
              </div>
            </div>
          </div>

          {/* Hotel Management */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-700 flex items-center gap-2"><BedDouble size={18} className="text-purple-500" /> ホテル予約管理</h3>
              <button onClick={() => setShowHotelModal(true)} className="text-sm bg-purple-100 text-purple-600 px-3 py-1 rounded-lg font-bold hover:bg-purple-200 flex items-center gap-1"><Plus size={14} /> 追加</button>
            </div>
            {hotels.length === 0 ? (
              <p className="text-slate-400 text-sm">ホテル予約情報がありません。</p>
            ) : (
              <div className="space-y-3">
                {hotels.map(h => (
                  <div key={h.id} className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex justify-between items-start">
                    <div>
                      <div className="font-bold text-purple-900 flex items-center gap-2">
                        {h.name}
                        {h.url && <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700"><ExternalLink size={14} /></a>}
                      </div>
                      <div className="text-sm text-purple-700 mt-1">
                        <span className="font-medium">宿泊日: </span>{h.dates?.join(', ') || '未指定'}
                      </div>
                      <div className="text-sm text-purple-600 mt-1">
                        <span className="font-medium">宿泊者: </span>{h.members?.join(', ') || '未指定'}
                      </div>
                    </div>
                    <button onClick={() => removeHotel(h.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1/3) - Project Members */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-2xl p-5 text-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold flex items-center gap-2"><Users size={18} /> Project Members</h3>
              <button onClick={() => document.getElementById('member-input')?.focus()} className="text-slate-400 hover:text-white"><Plus size={18} /></button>
            </div>
            <div className="space-y-3">
              {staffList.map((s, i) => (
                <div key={i} className="flex items-center gap-3 group">
                  <div className={`w-8 h-8 ${getAvatarColor(i)} rounded-full flex items-center justify-center text-sm font-bold text-white shadow`}>{s[0]}</div>
                  <span className="flex-1">{s}</span>
                  <button onClick={() => removeMember(s)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={16} /></button>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
                <input id="member-input" type="text" value={newMember} onChange={e => setNewMember(e.target.value)} onKeyDown={e => e.key === 'Enter' && addMember()} className="flex-1 bg-slate-800 text-white px-3 py-2 rounded-lg text-sm border border-slate-700 focus:border-blue-500 outline-none" placeholder="メンバー追加..." />
                <button onClick={addMember} className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg"><Plus size={16} /></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center sticky top-0 z-10">
              <div>
                <h2 className="text-xl font-bold">プロジェクト設定変更</h2>
                <p className="text-slate-400 text-sm">展示会の基本情報を編集します</p>
              </div>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-800 rounded-full"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-6">
              {editErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                  <p className="text-red-700 font-bold text-sm mb-2">以下の項目を確認してください：</p>
                  <ul className="text-red-600 text-sm list-disc list-inside">
                    {editErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">展示会タイトル <span className="text-red-500">*</span></label>
                <input type="text" value={editData.title || ''} onChange={e => setEditData({ ...editData, title: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">開催日 <span className="text-red-500">*</span></label>
                  <div className="flex gap-2 mb-2">
                    <input type="date" value={tempEditDate} onChange={e => setTempEditDate(e.target.value)} className="flex-1 p-2 border border-slate-200 rounded-lg" />
                    <button onClick={() => addEditDate('main')} className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200"><Plus size={20} /></button>
                  </div>
                  <div className="flex flex-wrap gap-2">{editData.dates?.map((d, i) => (<span key={i} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-sm flex items-center gap-1">{d} <button onClick={() => removeEditDate('main', i)}><X size={12} /></button></span>))}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">事前準備日</label>
                  <div className="flex gap-2 mb-2">
                    <input type="date" value={tempEditPreDate} onChange={e => setTempEditPreDate(e.target.value)} className="flex-1 p-2 border border-slate-200 rounded-lg" />
                    <button onClick={() => addEditDate('pre')} className="bg-amber-100 text-amber-600 p-2 rounded-lg hover:bg-amber-200"><Plus size={20} /></button>
                  </div>
                  <div className="flex flex-wrap gap-2">{editData.preDates?.map((d, i) => (<span key={i} className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-sm flex items-center gap-1">{d} <button onClick={() => removeEditDate('pre', i)}><X size={12} /></button></span>))}</div>
                </div>
              </div>

              {/* Venue */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">会場名</label>
                  <input type="text" value={editData.place || ''} onChange={e => setEditData({ ...editData, place: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">会場住所</label>
                  <input type="text" value={editData.venueAddress || ''} onChange={e => setEditData({ ...editData, venueAddress: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg" />
                </div>
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">開場時間</label>
                  <input type="time" value={editData.openTime || ''} onChange={e => setEditData({ ...editData, openTime: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">閉場時間</label>
                  <input type="time" value={editData.closeTime || ''} onChange={e => setEditData({ ...editData, closeTime: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg" />
                </div>
              </div>

              {/* URLs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">会場URL</label>
                  <input type="text" value={editData.venueUrl || ''} onChange={e => setEditData({ ...editData, venueUrl: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">GoogleマップURL</label>
                  <input type="text" value={editData.googleMapsUrl || ''} onChange={e => setEditData({ ...editData, googleMapsUrl: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg" />
                </div>
              </div>

              {/* Targets */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">集客目標 <span className="text-red-500">*</span></label>
                  <input type="number" value={editData.targetVisitors || ''} onChange={e => setEditData({ ...editData, targetVisitors: parseInt(e.target.value) || 0 })} className="w-full p-3 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">招致メーカー目標 <span className="text-red-500">*</span></label>
                  <input type="number" value={editData.targetMakers || ''} onChange={e => setEditData({ ...editData, targetMakers: parseInt(e.target.value) || 0 })} className="w-full p-3 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">目標利益額 <span className="text-red-500">*</span></label>
                  <input type="number" value={editData.targetProfit || ''} onChange={e => setEditData({ ...editData, targetProfit: parseInt(e.target.value) || 0 })} className="w-full p-3 border border-blue-300 bg-blue-50 rounded-lg font-bold text-blue-800" />
                </div>
              </div>

              {/* Staff */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">運営スタッフ <span className="text-red-500">*</span></label>
                <input type="text" value={editData.staff || ''} onChange={e => setEditData({ ...editData, staff: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg" placeholder="カンマ区切りで入力" />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-4 pt-4 border-t">
                <button onClick={() => setShowSettings(false)} className="px-6 py-3 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">キャンセル</button>
                <button onClick={validateAndSave} className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hotel Modal */}
      {showHotelModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
            <div className="bg-purple-600 p-6 text-white flex justify-between items-center rounded-t-2xl">
              <h2 className="text-xl font-bold">ホテル予約追加</h2>
              <button onClick={() => setShowHotelModal(false)} className="p-2 hover:bg-purple-500 rounded-full"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">ホテル名</label>
                <input type="text" value={hotelForm.name} onChange={e => setHotelForm({ ...hotelForm, name: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">URL</label>
                <input type="text" value={hotelForm.url} onChange={e => setHotelForm({ ...hotelForm, url: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">宿泊日</label>
                <div className="flex gap-2 mb-2">
                  <input type="date" value={tempHotelDate} onChange={e => setTempHotelDate(e.target.value)} className="flex-1 p-2 border border-slate-200 rounded-lg" />
                  <button onClick={addHotelDate} className="bg-purple-100 text-purple-600 p-2 rounded-lg hover:bg-purple-200"><Plus size={20} /></button>
                </div>
                <div className="flex flex-wrap gap-2">{hotelForm.dates.map((d, i) => (<span key={i} className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-sm flex items-center gap-1">{d} <button onClick={() => removeHotelDate(d)}><X size={12} /></button></span>))}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">宿泊者 (メンバーから選択)</label>
                <div className="flex flex-wrap gap-2">
                  {staffList.map((s, i) => (
                    <button key={i} onClick={() => toggleHotelMember(s)} className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${hotelForm.members.includes(s) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-4 pt-4 border-t">
                <button onClick={() => setShowHotelModal(false)} className="px-6 py-3 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">キャンセル</button>
                <button onClick={saveHotel} className="px-8 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 shadow-lg">追加</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabTasks({ tasks, setTasks, staff }) {
  const [showAssigneeModal, setShowAssigneeModal] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  // newTaskData stores title, dueDate, assignees[]
  const [newTaskData, setNewTaskData] = useState({
    sales: { title: '', dueDate: '', assignees: [], showStaffDropdown: false },
    planning: { title: '', dueDate: '', assignees: [], showStaffDropdown: false }
  });
  const [draggedItem, setDraggedItem] = useState(null);

  const staffList = (staff || '').split(',').map(s => s.trim()).filter(s => s);

  // Auto-sort tasks by Date (Ascending), then by ID (creation order)
  // We use a derived variable for rendering, but we still need the original 'tasks' state for CRUD.
  // Actually, if we want "automatic sorting", the displayed order should be sorted.
  // We can sort them on the fly for display.
  const getSortedTasks = (categoryTasks) => {
    return [...categoryTasks].sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1; // No date goes to bottom
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  };

  const toggleStatus = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, status: t.status === 'done' ? 'pending' : 'done' } : t));
  };

  const deleteTask = (id) => {
    if (confirm('タスクを削除しますか？')) {
      setTasks(tasks.filter(t => t.id !== id));
    }
  };

  const addTask = (category) => {
    const data = newTaskData[category];
    if (!data.title.trim()) return;

    const newTask = {
      id: crypto.randomUUID(),
      category,
      title: data.title.trim(),
      status: 'pending',
      assignees: data.assignees || [], // use array
      dueDate: data.dueDate,
      desc: ''
    };

    setTasks([...tasks, newTask]);
    // Reset form
    setNewTaskData(prev => ({
      ...prev,
      [category]: { title: '', dueDate: '', assignees: [], showStaffDropdown: false }
    }));
  };

  const toggleNewTaskAssignee = (category, name) => {
    setNewTaskData(prev => {
      const current = prev[category].assignees || [];
      const updated = current.includes(name)
        ? current.filter(n => n !== name)
        : [...current, name];
      return { ...prev, [category]: { ...prev[category], assignees: updated } };
    });
  };

  const updateTask = (id, updates) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const toggleAssignee = (taskId, name) => {
    setTasks(tasks.map(t => {
      if (t.id !== taskId) return t;
      const assignees = t.assignees || [];
      if (assignees.includes(name)) {
        return { ...t, assignees: assignees.filter(a => a !== name) };
      } else {
        return { ...t, assignees: [...assignees, name] };
      }
    }));
  };

  // Drag and drop removed as per request

  const categories = [
    { id: 'sales', label: '【営業側タスク】', color: 'bg-blue-600', textColor: 'text-white' },
    { id: 'planning', label: '【企画側タスク】', color: 'bg-orange-500', textColor: 'text-white' }
  ];

  const TaskItem = ({ task }) => {
    const isDone = task.status === 'done';
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isDone;
    return (
      <div
        onClick={() => setEditingTask(task)}
        className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md group ${isDone ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200'}`}
      >
        {/* Checkbox */}
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => toggleStatus(task.id)} className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isDone ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 hover:border-blue-500'}`}>
            {isDone && <Check size={14} />}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</p>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {/* Due Date */}
            {task.dueDate && (
              <span className={`text-xs px-2 py-0.5 rounded ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                <Calendar size={10} className="inline mr-1" />{task.dueDate}
              </span>
            )}
            {/* Assignees */}
            {(task.assignees || []).map(a => (
              <span key={a} className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{a}</span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setShowAssigneeModal(task.id)} className="p-1 text-slate-400 hover:text-blue-600 rounded" title="担当者"><UserPlus size={14} /></button>
          <button onClick={() => deleteTask(task.id)} className="p-1 text-slate-400 hover:text-red-500 rounded" title="削除"><Trash2 size={14} /></button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 animate-fade-in">
      {/* Progress Summary */}
      <div className="mb-6 flex gap-4 items-center">
        <div className="text-sm text-slate-600">
          <span className="font-bold text-slate-800">{tasks.filter(t => t.status === 'done').length}</span>
          <span className="mx-1">/</span>
          <span>{tasks.length}</span>
          <span className="ml-1">タスク完了</span>
        </div>
        <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
          <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${tasks.length > 0 ? (tasks.filter(t => t.status === 'done').length / tasks.length) * 100 : 0}%` }}></div>
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {categories.map(cat => {
          const catTasks = tasks.filter(t => t.category === cat.id);
          const sortedTasks = getSortedTasks(catTasks);
          const doneCount = catTasks.filter(t => t.status === 'done').length;
          const currentNewTask = newTaskData[cat.id];

          return (
            <div
              key={cat.id}
              className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className={`${cat.color} ${cat.textColor} px-4 py-3 flex items-center justify-between`}>
                <h3 className="font-bold">{cat.label}</h3>
                <span className="text-sm opacity-80">{doneCount}/{catTasks.length}</span>
              </div>

              {/* Add Task - TOP with Date & Assignee */}
              <div className="p-3 border-b border-slate-200 bg-white space-y-2 relative z-10">
                <input
                  type="text"
                  value={currentNewTask.title}
                  onChange={(e) => setNewTaskData(prev => ({ ...prev, [cat.id]: { ...prev[cat.id], title: e.target.value } }))}
                  onKeyDown={(e) => e.key === 'Enter' && addTask(cat.id)}
                  placeholder="＋ 新しいタスクを追加..."
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2 relative items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1 ml-1 flex items-center gap-1"><Clock size={10} /> 期限</label>
                    <input
                      type="date"
                      value={currentNewTask.dueDate}
                      onChange={(e) => setNewTaskData(prev => ({ ...prev, [cat.id]: { ...prev[cat.id], dueDate: e.target.value } }))}
                      className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-slate-50 outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Multi-Select Assignee Dropdown */}
                  <div className="relative flex-1">
                    <button
                      onClick={() => setNewTaskData(prev => ({ ...prev, [cat.id]: { ...prev[cat.id], showStaffDropdown: !prev[cat.id].showStaffDropdown } }))}
                      className="w-full text-left text-xs px-2 py-1.5 border border-slate-200 rounded bg-slate-50 flex items-center justify-between hover:bg-slate-100"
                    >
                      <span className="truncate">
                        {currentNewTask.assignees?.length > 0 ? `${currentNewTask.assignees.length}名選択中` : '担当者を選択'}
                      </span>
                      <ChevronDown size={12} className="text-slate-400" />
                    </button>

                    {currentNewTask.showStaffDropdown && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setNewTaskData(prev => ({ ...prev, [cat.id]: { ...prev[cat.id], showStaffDropdown: false } }))}></div>
                        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded shadow-lg z-20 max-h-40 overflow-y-auto p-1">
                          {staffList.length === 0 ? (
                            <div className="text-xs text-slate-400 p-2 text-center">スタッフ未登録</div>
                          ) : (
                            staffList.map(name => (
                              <label key={name} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  checked={currentNewTask.assignees?.includes(name)}
                                  onChange={() => toggleNewTaskAssignee(cat.id, name)}
                                />
                                <span className="text-xs text-slate-700">{name}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => addTask(cat.id)}
                    className={`${cat.color} text-white px-3 py-1.5 rounded text-xs font-bold hover:opacity-90 transition-opacity mb-[1px]`}
                    disabled={!currentNewTask.title.trim()}
                  >
                    追加
                  </button>
                </div>
              </div>

              {/* Tasks List (Sorted) */}
              <div className="p-3 space-y-2 flex-1 max-h-[450px] overflow-y-auto z-0">
                {sortedTasks.length === 0 ? (
                  <div className="text-center py-8 text-slate-300 text-sm border-2 border-dashed border-slate-200 rounded-lg">タスクなし</div>
                ) : (
                  sortedTasks.map(task => <TaskItem key={task.id} task={task} />)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Assignee Modal */}
      {
        showAssigneeModal && (
          <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4" onClick={() => setShowAssigneeModal(null)}>
            <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">担当者を選択</h3>
                <button onClick={() => setShowAssigneeModal(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {staffList.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">スタッフが登録されていません。<br />プロジェクト設定で追加してください。</p>
                ) : (
                  staffList.map(name => {
                    const task = tasks.find(t => t.id === showAssigneeModal);
                    const isSelected = task && (task.assignees || []).includes(name);
                    return (
                      <button key={name} onClick={() => toggleAssignee(showAssigneeModal, name)} className={`w-full text-left px-4 py-2 rounded-lg border transition-all flex items-center justify-between ${isSelected ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 hover:bg-slate-50'}`}>
                        <span>{name}</span>
                        {isSelected && <Check size={16} className="text-blue-600" />}
                      </button>
                    );
                  })
                )}
              </div>
              <button onClick={() => setShowAssigneeModal(null)} className="w-full mt-4 bg-slate-100 text-slate-700 py-2 rounded-lg font-bold hover:bg-slate-200">閉じる</button>
            </div>
          </div>
        )
      }

      {/* Edit Task Modal */}
      {
        editingTask && (
          <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4" onClick={() => setEditingTask(null)}>
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">タスクを編集</h3>
                <button onClick={() => setEditingTask(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">タスク名</label>
                  <input
                    type="text"
                    value={editingTask.title}
                    onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">期限</label>
                  <input
                    type="date"
                    value={editingTask.dueDate || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">メモ</label>
                  <textarea
                    value={editingTask.desc || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, desc: e.target.value })}
                    rows={3}
                    className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="詳細メモ..."
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setEditingTask(null)} className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg font-bold hover:bg-slate-200">キャンセル</button>
                <button onClick={() => { updateTask(editingTask.id, { title: editingTask.title, dueDate: editingTask.dueDate, desc: editingTask.desc }); setEditingTask(null); }} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700">保存</button>
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
}

function TabLectures({ lectures, updateMainData, updateBatch, staff, scheduleData }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [newData, setNewData] = useState({
    // 基本情報
    name: '',           // 講師名（必須）
    photoUrl: '',       // 写真URL（任意）
    theme: '',          // テーマ（必須）
    summary: '',        // 講演内容概略（必須）
    flyerText: '',      // チラシ用文言（必須）
    profile: '',        // プロフィール
    // 開催情報
    startTime: '',      // 開始時間（必須）
    endTime: '',        // 終了時間（必須）
    venue: '',          // 会場/場所（必須）
    // 費用
    fee: 0,             // 講演費
    transportFee: 0,    // 交通費
    // 準備・担当
    assignees: [],      // 担当者（複数選択可能）
    materialUrl: '',    // 資料格納場所URL
    preparations: '',   // 準備するもの（自由記述）
    // ステータス
    status: 'planning'
  });

  const STATUS_LABELS = {
    'planning': { label: '調整中', color: 'bg-slate-100 text-slate-600' },
    'offered': { label: '依頼済', color: 'bg-amber-100 text-amber-700' },
    'confirmed': { label: '確定', color: 'bg-blue-100 text-blue-700' },
    'cancelled': { label: '中止', color: 'bg-red-100 text-red-700' }
  };

  const staffList = staff ? staff.split(',').map(s => s.trim()).filter(Boolean) : [];

  const toggleAssignee = (name) => {
    const current = newData.assignees || [];
    if (current.includes(name)) {
      setNewData({ ...newData, assignees: current.filter(n => n !== name) });
    } else {
      setNewData({ ...newData, assignees: [...current, name] });
    }
  };

  const handleEdit = (l) => {
    setNewData({
      name: l.name || '',
      photoUrl: l.photoUrl || '',
      theme: l.theme || '',
      summary: l.summary || '',
      flyerText: l.flyerText || '',
      profile: l.profile || '',
      startTime: l.startTime || '',
      endTime: l.endTime || '',
      venue: l.venue || '',
      fee: l.fee || 0,
      transportFee: l.transportFee || 0,
      assignees: l.assignees || (l.pic ? [l.pic] : []),
      materialUrl: l.materialUrl || '',
      preparations: l.preparations || '',
      status: l.status || 'planning'
    });
    setIsEditing(l.id);
    setIsAdding(true);
  };

  const handleDelete = (id) => {
    if (!window.confirm('削除しますか？')) return;
    const newLectures = lectures.filter(l => l.id !== id);
    updateMainData('lectures', newLectures);
  };

  const handleSave = () => {
    if (!newData.name || !newData.theme || !newData.summary || !newData.flyerText) {
      alert('講師名、テーマ、講演内容概略、チラシ用文言は必須です');
      return;
    }
    if (!newData.startTime || !newData.endTime || !newData.venue) {
      alert('開始時間、終了時間、会場は必須です');
      return;
    }

    let usersUpdatedLectures;
    let lectureId = isEditing || crypto.randomUUID();

    if (isEditing) {
      usersUpdatedLectures = lectures.map(l => l.id === isEditing ? { ...newData, id: isEditing } : l);
    } else {
      usersUpdatedLectures = [...(lectures || []), { ...newData, id: lectureId }];
    }

    // updateMainData calls delayed to end for batching

    // Link to Schedule (Event Day)
    const scheduleTitle = `講演会：${newData.theme} (${newData.name}先生)`;
    const newScheduleItem = {
      id: lectureId, // Same ID for linkage
      time: newData.startTime,
      endTime: newData.endTime,
      title: scheduleTitle,
      assignee: (newData.assignees || []).join(', '),
      desc: `会場: ${newData.venue}\n概要: ${newData.summary}`,
      type: 'lecture'
    };

    // Use passed scheduleData
    const currentSchedule = scheduleData || { dayBefore: [], eventDay: [] };
    const eventDayItems = currentSchedule.eventDay || [];

    // Check if item exists (update) or needs to be added
    let updatedEventDayItems;
    if (eventDayItems.some(item => item.id === lectureId)) {
      updatedEventDayItems = eventDayItems.map(item => item.id === lectureId ? { ...item, ...newScheduleItem } : item);
    } else {
      updatedEventDayItems = [...eventDayItems, newScheduleItem];
    }

    // Sort by start time
    updatedEventDayItems.sort((a, b) => a.time.localeCompare(b.time));

    const updatedSchedule = {
      ...currentSchedule,
      eventDay: updatedEventDayItems
    };

    // Use updateBatch to update both lectures and schedule atomically
    if (updateBatch) {
      updateBatch({
        lectures: usersUpdatedLectures,
        schedule: updatedSchedule
      });
    } else {
      updateMainData('lectures', usersUpdatedLectures);
      updateMainData('schedule', updatedSchedule);
    }

    setIsAdding(false);
    setIsEditing(null);
    setNewData({
      name: '', photoUrl: '', theme: '', summary: '', flyerText: '', profile: '',
      startTime: '', endTime: '', venue: '', fee: 0, transportFee: 0,
      assignees: [], materialUrl: '', preparations: '', status: 'planning'
    });
  };

  const resetForm = () => {
    setNewData({
      name: '', photoUrl: '', theme: '', summary: '', flyerText: '', profile: '',
      startTime: '', endTime: '', venue: '', fee: 0, transportFee: 0,
      assignees: [], materialUrl: '', preparations: '', status: 'planning'
    });
  };

  const totalBudget = (lectures || []).reduce((sum, l) => sum + Number(l.fee || 0) + Number(l.transportFee || 0), 0);

  return (
    <div className="p-6 animate-fade-in flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2"><Mic className="text-purple-600" /> 講演会・セミナー管理</h3>
          <p className="text-sm text-slate-500 mt-1">講師の依頼状況や謝礼金を管理します</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-slate-400 font-bold">講演費+交通費合計（予算連動）</span>
          <span className="text-2xl font-bold text-slate-800">¥{totalBudget.toLocaleString()}</span>
        </div>
      </div>

      {!isAdding && (
        <div className="mb-4">
          <button onClick={() => { setIsEditing(null); resetForm(); setIsAdding(true); }} className="bg-purple-600 text-white px-4 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-purple-700 shadow-lg transition-all"><Plus size={18} /> 新規講演を追加</button>
        </div>
      )}

      {isAdding && (
        <div className="bg-white p-6 rounded-xl border border-purple-100 shadow-xl mb-8 animate-slide-down shrink-0 max-h-[70vh] overflow-y-auto">
          <h4 className="font-bold text-purple-800 mb-4 border-b pb-2 flex items-center gap-2">
            {isEditing ? <Edit3 size={18} /> : <Plus size={18} />}
            {isEditing ? '講演情報の編集' : '新規講演登録'}
          </h4>

          {/* 基本情報セクション */}
          <div className="mb-6">
            <h5 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 bg-slate-50 p-2 rounded"><User size={14} /> 基本情報</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold text-slate-500 mb-1">講師名 <span className="text-red-500">*</span></label><input type="text" value={newData.name} className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 outline-none" placeholder="例：山田 太郎 先生" onChange={e => setNewData({ ...newData, name: e.target.value })} /></div>
              <div><label className="block text-xs font-bold text-slate-500 mb-1">写真URL（任意）</label><input type="url" value={newData.photoUrl} className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 outline-none" placeholder="https://..." onChange={e => setNewData({ ...newData, photoUrl: e.target.value })} /></div>
              <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">テーマ <span className="text-red-500">*</span></label><input type="text" value={newData.theme} className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 outline-none" placeholder="講演タイトル" onChange={e => setNewData({ ...newData, theme: e.target.value })} /></div>
              <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">講演内容概略 <span className="text-red-500">*</span></label><textarea value={newData.summary} className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 outline-none" rows="3" placeholder="講演の概要を入力" onChange={e => setNewData({ ...newData, summary: e.target.value })} /></div>
              <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">チラシ用文言 <span className="text-red-500">*</span></label><textarea value={newData.flyerText} className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 outline-none" rows="2" placeholder="チラシに掲載する文言" onChange={e => setNewData({ ...newData, flyerText: e.target.value })} /></div>
            </div>
          </div>

          {/* 開催情報セクション */}
          <div className="mb-6">
            <h5 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 bg-slate-50 p-2 rounded"><Clock size={14} /> 開催情報</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-xs font-bold text-slate-500 mb-1">開始時間 <span className="text-red-500">*</span></label><input type="time" value={newData.startTime} className="w-full border border-slate-300 rounded-lg p-3" onChange={e => setNewData({ ...newData, startTime: e.target.value })} /></div>
              <div><label className="block text-xs font-bold text-slate-500 mb-1">終了時間 <span className="text-red-500">*</span></label><input type="time" value={newData.endTime} className="w-full border border-slate-300 rounded-lg p-3" onChange={e => setNewData({ ...newData, endTime: e.target.value })} /></div>
              <div><label className="block text-xs font-bold text-slate-500 mb-1">会場/場所 <span className="text-red-500">*</span></label><input type="text" value={newData.venue} className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 outline-none" placeholder="例：メインホール" onChange={e => setNewData({ ...newData, venue: e.target.value })} /></div>
            </div>
          </div>

          {/* 費用セクション */}
          <div className="mb-6">
            <h5 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 bg-slate-50 p-2 rounded"><Wallet size={14} /> 費用（収支・予算と連動）</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-xs font-bold text-slate-500 mb-1">講演費 (円)</label><input type="number" value={newData.fee} className="w-full border border-slate-300 rounded-lg p-3" onChange={e => setNewData({ ...newData, fee: e.target.value })} /></div>
              <div><label className="block text-xs font-bold text-slate-500 mb-1">交通費 (円)</label><input type="number" value={newData.transportFee} className="w-full border border-slate-300 rounded-lg p-3" onChange={e => setNewData({ ...newData, transportFee: e.target.value })} /></div>
              <div><label className="block text-xs font-bold text-slate-500 mb-1">ステータス</label>
                <select value={newData.status} className="w-full border border-slate-300 rounded-lg p-3 bg-white" onChange={e => setNewData({ ...newData, status: e.target.value })}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* 準備・担当セクション */}
          <div className="mb-6">
            <h5 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 bg-slate-50 p-2 rounded"><Users size={14} /> 準備・担当</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-xs font-bold text-slate-500 mb-1">担当者（複数選択可能）</label>
                <button
                  onClick={() => setShowStaffDropdown(!showStaffDropdown)}
                  className="w-full text-left border border-slate-300 rounded-lg p-3 bg-white flex items-center justify-between hover:bg-slate-50"
                >
                  <span className="truncate">
                    {(newData.assignees || []).length > 0 ? `${(newData.assignees || []).join(', ')}` : '担当者を選択'}
                  </span>
                  <ChevronDown size={16} className="text-slate-400" />
                </button>
                {showStaffDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowStaffDropdown(false)}></div>
                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto p-1">
                      {staffList.length === 0 ? (
                        <div className="text-xs text-slate-400 p-2 text-center">スタッフ未登録</div>
                      ) : (
                        staffList.map(name => (
                          <label key={name} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                              checked={(newData.assignees || []).includes(name)}
                              onChange={() => toggleAssignee(name)}
                            />
                            <span className="text-sm text-slate-700">{name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
              <div><label className="block text-xs font-bold text-slate-500 mb-1">資料格納場所URL</label><input type="url" value={newData.materialUrl} className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 outline-none" placeholder="https://drive.google.com/..." onChange={e => setNewData({ ...newData, materialUrl: e.target.value })} /></div>
              <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">準備するもの（自由記述）</label><textarea value={newData.preparations} className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 outline-none" rows="2" placeholder="必要な準備物を入力" onChange={e => setNewData({ ...newData, preparations: e.target.value })} /></div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
            <button onClick={() => { setIsAdding(false); setIsEditing(null); }} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-slate-200 transition-colors">キャンセル</button>
            <button onClick={handleSave} className="px-8 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 shadow-lg shadow-purple-500/30 transition-all">保存する</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4 pb-20">
        {(lectures || []).length === 0 && (
          <div className="text-center py-20 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <Mic size={48} className="mx-auto mb-4 opacity-20" />
            <p>登録された講演はありません</p>
          </div>
        )}
        {(lectures || []).map(l => (
          <div key={l.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row gap-6 group relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-2 h-full ${STATUS_LABELS[l.status || 'planning'].color.replace('text-', 'bg-').split(' ')[0]}`}></div>

            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_LABELS[l.status || 'planning'].color}`}>{STATUS_LABELS[l.status || 'planning'].label}</span>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(l)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Edit3 size={16} /></button>
                  <button onClick={() => handleDelete(l.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                </div>
              </div>
              <h4 className="text-xl font-bold text-slate-800 mb-1">{l.theme}</h4>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-serif text-slate-500 font-bold">{l.name?.[0]}</div>
                <span className="font-bold text-slate-700">{l.name} <span className="text-xs text-slate-400 font-normal">先生</span></span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg mb-3">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-bold">時間・会場</span>
                  <span className="font-bold flex items-center gap-1"><Clock size={14} /> {l.startTime || '--:--'} ~ {l.endTime || '--:--'}</span>
                  <span className="text-xs ml-5">{l.venue}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-bold">費用（謝礼+交通費）</span>
                  <span className="font-bold flex items-center gap-1"><Wallet size={14} /> ¥{(Number(l.fee || 0) + Number(l.transportFee || 0)).toLocaleString()}</span>
                  <span className="text-xs ml-5 opacity-70">(内訳: ¥{Number(l.fee).toLocaleString()} + ¥{Number(l.transportFee).toLocaleString()})</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-bold">担当者</span>
                  <span className="font-bold flex items-center gap-1"><User size={14} /> {(l.assignees || []).join(', ') || l.pic || '-'}</span>
                </div>
              </div>
              {l.summary && (
                <div className="text-sm text-slate-700 bg-white border border-slate-100 p-2 rounded mb-1">
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">概要</span>
                  <p className="line-clamp-2">{l.summary}</p>
                </div>
              )}
              {l.flyerText && (
                <div className="text-sm text-slate-700 bg-white border border-slate-100 p-2 rounded">
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">チラシ用文言</span>
                  <p className="line-clamp-2">{l.flyerText}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 5. メーカー回答フォーム & タブ定義
// ============================================================================

const FIELD_LABELS = {
  moveInDate: '搬入日時',
  lunchCount: '昼食について',
  status: '参加有無',
  packages: '出荷個口数',
  note: '特記事項',
  itemsPower: '電源',
  transport: '搬送方法',
  products: '展示品',
  itemsDesk: '長机',
  boothCount: '希望コマ数',
  companyNameKana: '貴社名（カナ）',
  repName: '担当者名',
  itemsChair: '椅子',
  companyName: '貴社名',
  payment: '支払方法',
  billIssue: '請求書発行',
  phone: '電話番号',
  email: 'メールアドレス',
  staffCount: '参加人数',
  powerDetail: '電源詳細'
};

const FIELD_ORDER = [
  'companyName', 'companyNameKana', 'repName', 'phone', 'email', 'status',
  'moveInDate', 'boothCount', 'staffCount', 'lunchCount',
  'itemsDesk', 'itemsChair', 'itemsPower', 'powerDetail',
  'transport', 'packages', 'products', 'payment', 'billIssue', 'note'
];

function MakerResponseForm({ exhibition, config, onClose, onSubmit }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  // ★修正: configからsection1/section2を正しく取得
  const section1 = config?.section1 || {};
  const section2 = config?.section2 || {};
  const section3 = config?.section3 || {};
  const settings = config?.settings || {};

  const isParticipationStep = step === 1;
  const isDetailStep = step === 2;
  const isCompleteStep = step === 3;

  // Overview Data (Fallback to exhibition data if config is empty)
  const exDates = exhibition?.dates?.length > 0 ? exhibition.dates.join(', ') : '-';
  const exPlace = exhibition?.place || settings.venueName || '-';
  const exAddress = exhibition?.venueAddress || settings.venueAddress || '-';
  const exPhone = settings.venuePhone || '-';

  // 条件分岐チェック関数
  const shouldShowItem = (item) => {
    if (!item.condition) return true;
    const { targetId, operator, value } = item.condition;
    const currentValue = formData[targetId];
    if (operator === 'eq') return currentValue === value;
    if (operator === 'neq') return currentValue !== value;
    return true;
  };

  // 必須バリデーション
  const validateStep = (stepNum) => {
    const newErrors = {};
    let isValid = true;
    let items = [];
    if (stepNum === 1) items = section1.items || [];
    if (stepNum === 2) items = section2.items || [];

    items.forEach(item => {
      if (item.required && shouldShowItem(item)) {
        if (!formData[item.id] || formData[item.id] === '') {
          newErrors[item.id] = '必須項目です';
          isValid = false;
        }
      }
    });
    setErrors(newErrors);
    return isValid;
  };

  const handleNext = () => {
    if (step === 1) {
      if (!validateStep(1)) {
        alert('必須項目を入力してください');
        return;
      }
      // Check participation status (if 'status' field exists and says decline)
      const statusItem = section1.items?.find(i => i.id === 'status');
      if (statusItem && formData.status === '出展を申し込まない') {
        setStep(3); // Go to decline screen
      } else {
        setStep(2); // Go to details
      }
    } else if (step === 2) {
      if (!validateStep(2)) {
        alert('必須項目を入力してください');
        return;
      }
      handleSubmit();
    } else if (step === 3) {
      handleSubmit(); // Submit decline
    }
  };

  const handleSubmit = async () => {
    await onSubmit(formData);
    setSubmitted(true);
    if (formData.email) {
      console.log(`Sending copy to ${formData.email} and r.kitagawa@caremax.co.jp`);
    }
  };

  const copyToClipboard = () => {
    let text = `【${section1.title || '出展申し込みフォーム'} 回答内容】\n\n`;
    text += `回答日時: ${new Date().toLocaleString()}\n`;
    text += `貴社名: ${formData.companyName || '-'}\n`;
    text += `担当者様: ${formData.repName || '-'}\n\n`;

    const allItems = [...(section1.items || []), ...(section2.items || []), ...(section3.items || [])];

    // もしconfigが正しくロードされていない場合のフォールバック: formDataのキーから表示
    if (allItems.length === 0) {
      Object.keys(formData).forEach(key => {
        const label = FIELD_LABELS[key] || key;
        const val = Array.isArray(formData[key]) ? formData[key].join(', ') : formData[key];
        text += `■ ${label}\n${val}\n\n`;
      });
    } else {
      allItems.forEach(item => {
        if (!item || !formData[item.id]) return;
        const val = Array.isArray(formData[item.id]) ? formData[item.id].join(', ') : formData[item.id];
        if (val === '' || (Array.isArray(val) && val.length === 0)) return;

        const label = FIELD_LABELS[item.id] || item.label || item.id;
        text += `■ ${label}\n${val}\n\n`;
      });
    }

    navigator.clipboard.writeText(text).then(() => alert('回答内容をコピーしました'));
  };

  // 動的フォームフィールド生成
  const renderFormField = (item) => {
    if (!shouldShowItem(item)) return null;

    const hasError = errors[item.id];

    return (
      <div key={item.id} className="space-y-1">
        <label className="block font-bold text-slate-700">
          {item.label} {item.required && <span className="text-red-500">*</span>}
        </label>
        {item.help && <p className="text-xs text-slate-500 mb-1">{item.help}</p>}

        {item.type === 'text' && (
          <input
            type="text"
            className={`w-full p-3 border rounded-lg ${hasError ? 'border-red-500 bg-red-50' : ''}`}
            value={formData[item.id] || ''}
            onChange={e => setFormData({ ...formData, [item.id]: e.target.value })}
          />
        )}
        {item.type === 'email' && (
          <input
            type="email"
            className={`w-full p-3 border rounded-lg ${hasError ? 'border-red-500 bg-red-50' : ''}`}
            value={formData[item.id] || ''}
            onChange={e => setFormData({ ...formData, [item.id]: e.target.value })}
          />
        )}
        {item.type === 'textarea' && (
          <textarea
            className={`w-full p-3 border rounded-lg h-24 ${hasError ? 'border-red-500 bg-red-50' : ''}`}
            value={formData[item.id] || ''}
            onChange={e => setFormData({ ...formData, [item.id]: e.target.value })}
          />
        )}
        {item.type === 'select' && (
          <select
            className={`w-full p-3 border rounded-lg bg-white ${hasError ? 'border-red-500 bg-red-50' : ''}`}
            value={formData[item.id] || ''}
            onChange={e => setFormData({ ...formData, [item.id]: e.target.value })}
          >
            <option value="">選択してください</option>
            {(item.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        )}
        {item.type === 'radio' && (
          <div className="flex flex-wrap gap-3">
            {(item.options || []).map(opt => (
              <label key={opt} className={`px-4 py-2 rounded-lg border-2 cursor-pointer transition-all ${formData[item.id] === opt ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold' : 'border-slate-200 hover:border-blue-300'}`}>
                <input
                  type="radio"
                  name={item.id}
                  value={opt}
                  checked={formData[item.id] === opt}
                  onChange={() => setFormData({ ...formData, [item.id]: opt })}
                  className="mr-2"
                />
                {opt}
              </label>
            ))}
          </div>
        )}
        {item.type === 'checkbox' && (
          <div className="flex flex-wrap gap-3">
            {(item.options || []).map(opt => (
              <label key={opt} className="px-4 py-2 rounded-lg border-2 cursor-pointer transition-all border-slate-200 hover:border-blue-300">
                <input
                  type="checkbox"
                  checked={(formData[item.id] || []).includes(opt)}
                  onChange={(e) => {
                    const current = formData[item.id] || [];
                    const updated = e.target.checked ? [...current, opt] : current.filter(v => v !== opt);
                    setFormData({ ...formData, [item.id]: updated });
                  }}
                  className="mr-2"
                />
                {opt}
              </label>
            ))}
          </div>
        )}
        {hasError && <p className="text-xs text-red-600 font-bold">{hasError}</p>}
      </div>
    );
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-slate-100 overflow-y-auto z-50">
        <div className="min-h-full py-10 px-4 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 md:p-8 max-w-3xl w-full mx-auto animate-fade-in text-center relative">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600"><Check size={32} /></div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-4">
              {formData.status === '出展を申し込まない' ? 'ご回答を受け付けました' : '回答ありがとうございました'}
            </h2>
            <p className="text-sm md:text-base text-slate-600 mb-6">
              {formData.status === '出展を申し込まない' ? 'またの機会がございましたら、よろしくお願い申し上げます。' : '登録内容を確認しました。ホームより展示会の詳細をご確認ください。'}
            </p>

            <div
              id="response-content"
              className="p-6 md:p-8 rounded-xl text-left text-sm mb-6 overflow-x-auto"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                color: '#1f2937',
                fontFamily: '"Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif'
              }}
            >
              <h2 className="text-lg md:text-xl font-bold mb-6 text-center" style={{ color: '#1e3a8a', borderBottom: '2px solid #1e3a8a', paddingBottom: '10px' }}>
                {section1.title || '出展申し込みフォーム'} 回答控え
              </h2>
              <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 text-xs" style={{ color: '#4b5563' }}>
                <div><span style={{ fontWeight: 'bold' }}>回答日時:</span> {new Date().toLocaleString()}</div>
                <div><span style={{ fontWeight: 'bold' }}>貴社名:</span> {formData.companyName || '-'}</div>
                <div><span style={{ fontWeight: 'bold' }}>担当者様:</span> {formData.repName || '-'}</div>
                <div><span style={{ fontWeight: 'bold' }}>電話番号:</span> {formData.phone || '-'}</div>
              </div>

              <h4
                className="font-bold pb-2 mb-4 text-base"
                style={{ borderBottom: '1px solid #d1d5db', color: '#374151', marginTop: '20px' }}
              >
                回答内容詳細
              </h4>
              <div className="space-y-3 font-mono">
                {/* 項目定義がある場合 */}
                {[...(section1.items || []), ...(section2.items || []), ...(section3.items || [])].map(item => {
                  if (!item || !formData[item.id]) return null;
                  const val = Array.isArray(formData[item.id]) ? formData[item.id].join(', ') : formData[item.id];
                  if (val === '' || (Array.isArray(val) && val.length === 0)) return null;

                  const label = FIELD_LABELS[item.id] || item.label || item.id;


                  return (
                    <div key={item.id} className="pb-2 last:border-0" style={{ borderBottom: '1px solid #f3f4f6', pageBreakInside: 'avoid' }}>
                      <span className="block text-xs font-bold mb-1" style={{ color: '#6b7280' }}>{label}</span>
                      <span className="block whitespace-pre-wrap text-base" style={{ color: '#1f2937' }}>{val}</span>
                    </div>
                  );
                })}

                {/* 項目定義がない場合のフォールバック表示 (config読み込みエラー対策) */}
                {(!section1.items && !section2.items) && Object.keys(formData).map(key => {
                  if (['companyName', 'repName', 'phone', 'email', 'status'].includes(key)) return null; // ヘッダーで表示済み
                  const label = FIELD_LABELS[key] || key;
                  const val = Array.isArray(formData[key]) ? formData[key].join(', ') : formData[key];
                  return (
                    <div key={key} className="pb-2 last:border-0" style={{ borderBottom: '1px solid #f3f4f6', pageBreakInside: 'avoid' }}>
                      <span className="block text-xs font-bold mb-1" style={{ color: '#6b7280' }}>{label}</span>
                      <span className="block whitespace-pre-wrap text-base" style={{ color: '#1f2937' }}>{val}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 pt-4 border-t text-xs text-center text-gray-400" style={{ borderTop: '1px solid #e5e7eb', color: '#9ca3af' }}>
                Exhibition Maker Form System
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 justify-center items-stretch md:items-center">
              <button onClick={onClose} className="bg-slate-200 text-slate-700 px-6 py-3 rounded-lg font-bold hover:bg-slate-300 transition-colors">閉じる</button>
              <button onClick={copyToClipboard} className="bg-slate-800 text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors"><Copy size={18} /> 回答をコピー</button>
              <button
                onClick={() => {
                  const content = document.getElementById('response-content');
                  if (!content) return;

                  import('html2canvas').then(module => {
                    const html2canvas = module.default;
                    const btn = document.activeElement;
                    if (btn) btn.disabled = true;

                    html2canvas(content, {
                      scale: 2,
                      useCORS: true,
                      logging: false, // ログは非表示に
                      onclone: (clonedDoc) => {
                        const styles = clonedDoc.getElementsByTagName('style');
                        const links = clonedDoc.getElementsByTagName('link');
                        Array.from(styles).forEach(el => el.remove());
                        Array.from(links).forEach(el => {
                          if (el.rel === 'stylesheet') el.remove();
                        });
                        const clonedContent = clonedDoc.getElementById('response-content');
                        if (clonedContent) {
                          clonedContent.style.backgroundColor = '#ffffff';
                          clonedContent.style.fontFamily = 'sans-serif';
                          clonedContent.style.padding = '40px'; // 印刷用に見栄え良くパディング増やす
                        }
                      }
                    }).then(canvas => {
                      const link = document.createElement('a');
                      link.download = `回答内容_${formData.companyName || 'response'}_${new Date().toISOString().slice(0, 10)}.png`;
                      link.href = canvas.toDataURL('image/png');
                      link.click();
                      if (btn) btn.disabled = false;
                    }).catch(e => {
                      console.error("Canvas creation failed:", e);
                      alert("画像の生成に失敗しました。\n\n" + e.message);
                      if (btn) btn.disabled = false;
                    });
                  }).catch(e => {
                    console.error("html2canvas load failed:", e);
                    alert("保存機能の読み込みに失敗しました。");
                  });
                }}
                className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
              >
                <Download size={18} /> PNGで保存
              </button>
            </div>
            <button onClick={() => window.location.reload()} className="mt-8 text-slate-500 hover:text-slate-800 underline block mx-auto">フォームに戻る</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-100 overflow-y-auto z-50 flex items-center justify-center p-0 md:p-4 animate-fade-in">
      <div className="bg-white w-full md:max-w-3xl md:rounded-2xl shadow-2xl overflow-hidden animate-slide-up flex flex-col h-full md:h-auto md:max-h-[90vh]">
        <div className="bg-blue-900 p-4 md:p-6 text-white shrink-0 flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2"><FileText /> {section1.title || '出展申し込みフォーム'}</h2>
          <button onClick={() => {
            if (window.confirm('入力内容は破棄されます。フォームを閉じてもよろしいですか？')) onClose();
          }} className="text-blue-200 hover:text-white transition-colors"><X size={28} /></button>
        </div>

        <div className="p-4 md:p-8 overflow-y-auto flex-1 space-y-6 md:space-y-8">
          {/* Step 1: Basic Info & Greeting */}
          {isParticipationStep && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                {section1.description || 'ご案内文がここに表示されます。'}
              </div>

              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                <h3 className="font-bold border-b pb-2 mb-2">展示会概要</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><span className="text-slate-500 block text-xs">開催日時</span><span className="font-bold">{exDates}</span></div>
                  <div><span className="text-slate-500 block text-xs">会場</span><span className="font-bold">{exPlace}</span></div>
                  <div><span className="text-slate-500 block text-xs">住所</span><span className="font-bold">{exAddress}</span></div>
                  <div><span className="text-slate-500 block text-xs">電話</span><span className="font-bold">{exPhone}</span></div>
                </div>
              </div>

              <div className="space-y-4">
                {(section1.items || []).map(item => renderFormField(item))}
              </div>
            </div>
          )}

          {/* Step 2: Detailed Questions */}
          {isDetailStep && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-lg font-bold border-b pb-2">{section2.title || '詳細情報の入力'}</h3>
              {section2.description && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-sm text-yellow-800 whitespace-pre-wrap">
                  {section2.description}
                </div>
              )}

              <div className="space-y-4">
                {(section2.items || []).map(item => renderFormField(item))}
              </div>

              <div className="pt-6 border-t">
                <label className="block font-bold text-slate-700 mb-1">お問い合わせ先</label>
                <p className="text-slate-600 bg-slate-100 p-3 rounded-lg select-all">r.kitagawa@caremax.co.jp</p>
              </div>
            </div>
          )}

          {/* Step 3: Decline Reason */}
          {isCompleteStep && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-bold border-b pb-2 text-red-600">{section3.title || '辞退理由の入力'}</h3>
              <div className="text-slate-600 whitespace-pre-wrap">{section3.description}</div>
              <div className="space-y-4">
                {(section3.items || []).map(item => renderFormField(item))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-50 p-4 border-t flex justify-end gap-3 shrink-0">
          {step > 1 && <button onClick={() => setStep(step - 1)} className="px-6 py-3 rounded-lg text-slate-600 hover:bg-slate-200 font-bold">戻る</button>}
          <button onClick={handleNext} className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg">
            {step === 2 || step === 3 ? '送信する' : '次へ'}
          </button>
        </div>
      </div>
    </div>
  );
}

const ALL_TAB_DEFINITIONS = [
  { id: 'main', label: 'Main Board', icon: LayoutDashboard },
  { id: 'tasks', label: 'タスク管理', icon: CheckSquare },
  { id: 'schedule', label: 'スケジュール', icon: Calendar },
  { id: 'makers', label: '招待メーカー', icon: Briefcase },
  { id: 'entrance', label: '来場者管理', icon: UserCheck },
  { id: 'lectures', label: '講演会', icon: Mic },
  { id: 'equipment', label: '会場・備品', icon: Box },
  { id: 'budget', label: '収支・予算', icon: DollarSign },
  { id: 'files', label: '資料', icon: FileText },
];



// ============================================================================
// 6. 公開フォーム・ダッシュボード・アプリ本体
// ============================================================================

// -----------------------------------------------------------
// 公開フォーム: ダウンロード機能付き（スマホ対応修正版）
// -----------------------------------------------------------
function PublicVisitorView({ exhibition, onSubmit }) {
  const { visitorFormConfig } = exhibition;
  const [formData, setFormData] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [qrData, setQrData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const visitorId = crypto.randomUUID();
    // QRコードにはIDのみ埋め込む（シンプルなQRで読み取りやすく）
    setQrData(visitorId);

    const finalData = { ...formData, id: visitorId };
    const success = await onSubmit(finalData);
    if (success) setSubmitted(true);
  };

  // 画像保存処理
  const downloadQR = () => {
    // ラッパーdivの中にあるcanvas要素を確実に探す
    const canvas = document.querySelector('#qr-wrapper canvas');

    if (canvas) {
      try {
        const pngUrl = canvas.toDataURL("image/png");

        // ダウンロード用リンクを作成してクリック
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `visitor_qr_${Date.now()}.png`; // ユニークなファイル名
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      } catch (e) {
        // エラー時はアラートを出す
        alert("保存に失敗しました。QRコードを長押しして「写真に保存」してください。");
      }
    } else {
      alert("QRコードの生成待ちです。もう一度押してください。");
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full rounded-2xl shadow-xl p-8 text-center animate-fade-in">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-4"><Check size={32} strokeWidth={3} /></div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">登録完了</h2>
          <p className="text-slate-600 text-sm mb-6">以下のQRコードを保存し、当日受付にご提示ください。</p>

          {/* ID付きのdivで囲む (ダウンロード機能用) */}
          <div id="qr-wrapper" className="bg-white border-2 border-slate-800 p-4 rounded-xl inline-block mb-6">
            <QRCodeCanvas
              value={qrData}
              size={200}
              level={"H"}
              includeMargin={true}
            />
          </div>

          <button onClick={downloadQR} className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl mb-2 flex items-center justify-center gap-2 hover:bg-slate-700">
            <Download size={18} /> 画像として保存
          </button>
          {/* スマホユーザーへの案内 */}
          <p className="text-xs text-slate-400 mb-6">※ボタンで保存できない場合は、<br />QRコードを長押しして「写真に保存」してください。</p>

          <div className="bg-slate-50 p-4 rounded-lg text-left text-sm space-y-2 mb-6">
            {visitorFormConfig?.items?.map(item => (
              <div key={item.id} className="flex justify-between">
                <span className="text-slate-500">{item.label}</span>
                <span className="font-bold">{formData[item.id] || '-'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-blue-600 p-6 text-white"><h1 className="text-xl font-bold mb-2">{exhibition.title}</h1><h2 className="text-lg opacity-90">{visitorFormConfig.title}</h2></div>
        <div className="p-6 md:p-8"><form onSubmit={handleSubmit} className="space-y-5">{visitorFormConfig.items.map(item => (<div key={item.id}><label className="block text-sm font-bold text-slate-700 mb-1">{item.label} {item.required && <span className="text-red-500">*</span>}</label>{item.type === 'select' ? (<select required={item.required} className="w-full border border-slate-300 p-3 rounded-lg bg-white outline-none" onChange={e => setFormData({ ...formData, [item.id]: e.target.value })}><option value="">選択してください</option>{item.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>) : (<input type={item.type} required={item.required} className="w-full border border-slate-300 p-3 rounded-lg outline-none" placeholder={item.help} onChange={e => setFormData({ ...formData, [item.id]: e.target.value })} />)}</div>))}<button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 transition-all mt-4">登録してQRコードを発行</button></form></div>
      </div>
    </div>
  );
}

function PublicMakerView({ exhibition, onSubmit }) {
  const isDeadlinePassed = exhibition.formConfig?.deadline && new Date(exhibition.formConfig.deadline) < new Date();

  if (isDeadlinePassed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500"><Clock size={32} /></div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">受付は終了しました</h2>
          <p className="text-slate-500 text-sm">この展示会の出展申し込み受付は締め切られました。<br />お問い合わせは主催者までご連絡ください。</p>
        </div>
      </div>
    );
  }

  return <MakerResponseForm exhibition={exhibition} config={exhibition.formConfig} onClose={() => { }} onSubmit={async (data) => { await onSubmit(data); }} />;
}


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

// CsvImportModal and EditMakerModal moved to components/EnterpriseConsole.jsx



// Exhibition Card Component - Independent
const ExhibitionCard = ({ exhibition, status, onAction, onScan }) => {
  const statusConfig = {
    confirmed: { bg: 'from-emerald-600 to-teal-700', badge: 'bg-emerald-400 text-emerald-900', label: '参加確定', icon: CheckCircle },
    invited: { bg: 'from-amber-500 to-orange-600', badge: 'bg-amber-300 text-amber-900', label: '招待中', icon: Mail },
    declined: { bg: 'from-slate-500 to-slate-600', badge: 'bg-slate-300 text-slate-700', label: '辞退', icon: X },
    past: { bg: 'from-slate-400 to-slate-500', badge: 'bg-slate-200 text-slate-600', label: '終了', icon: Clock }
  };
  const config = statusConfig[status] || statusConfig.invited;
  const StatusIcon = config.icon;

  const handleCardClick = (e) => {
    e.stopPropagation();
    if (onAction) onAction();
  };

  const formatDates = (dates) => {
    if (!dates || dates.length === 0) return '日程未定';
    return dates.map(d => {
      const date = new Date(d);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }).join(', ');
  };

  // 残り日数計算
  const getDaysLeft = () => {
    const deadline = exhibition.formConfig?.settings?.deadline;
    if (!deadline) return null;
    const today = new Date();
    const target = new Date(deadline);
    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysLeft = getDaysLeft();
  const isUrgent = daysLeft !== null && daysLeft <= 3;

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(e); }}
      className={`w-full text-left relative rounded-xl overflow-hidden shadow-lg cursor-pointer group transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${status === 'declined' || status === 'past' ? 'opacity-70' : ''}`}
      onClick={handleCardClick}
    >
      {/* Background Image or Gradient */}
      <div className={`h-40 bg-gradient-to-br ${config.bg} relative`}>
        {exhibition.imageUrl ? (
          <img src={exhibition.imageUrl} alt={exhibition.title} className="w-full h-full object-cover absolute inset-0" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>

        {/* Status Badge */}
        <div className={`absolute top-3 left-3 ${config.badge} px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1`}>
          <StatusIcon size={12} /> {config.label}
        </div>

        {/* QR Button Overlay (Confirmed Only) */}
        {status === 'confirmed' && onScan && (
          <button
            onClick={(e) => { e.stopPropagation(); onScan(exhibition); }}
            className="absolute top-3 right-3 z-30 bg-white/90 backdrop-blur-md text-blue-600 px-3 py-1.5 rounded-lg shadow-sm border border-blue-100 flex items-center gap-1.5 text-xs font-bold hover:bg-blue-600 hover:text-white transition-all transform hover:scale-105"
          >
            <ScanLine size={14} /> QR受付
          </button>
        )}

        {/* Deadline Badge */}
        {status === 'invited' && daysLeft !== null && (
          <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold shadow-sm ${isUrgent ? 'bg-red-500 text-white animate-pulse' : 'bg-white/90 text-slate-700'}`}>
            あと{daysLeft}日
          </div>
        )}

        {/* Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h4 className="font-bold text-white text-lg drop-shadow-lg line-clamp-2">{exhibition.title}</h4>
        </div>
      </div>

      {/* Info Footer */}
      <div className="bg-white p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Calendar size={14} className="text-blue-500" />
          <span className="font-medium">{formatDates(exhibition.dates)}</span>
        </div>
        {status === 'invited' && exhibition.formConfig?.settings?.deadline && (
          <div className={`flex items-center gap-2 text-sm ${isUrgent ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
            <Clock size={14} className={isUrgent ? 'text-red-500' : 'text-slate-400'} />
            <span>回答期限: {exhibition.formConfig.settings.deadline}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <MapPin size={14} className="text-emerald-500" />
          <span className="truncate">{exhibition.place || exhibition.venueAddress || '会場未定'}</span>
        </div>

        {/* Action Hint */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {status === 'invited' ? 'タップしてアンケート回答' : status === 'confirmed' ? 'タップして詳細・QRスキャン' : 'タップして詳細を確認'}
          </span>
          <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </div>
  );
};

function MakerPortal({ maker, exhibitions, onScan, onResponseSubmit, markMessageAsRead, initialExhibition }) {
  const [activeTab, setActiveTab] = useState('home');
  // Initialize with initialExhibition if provided
  const [selectedExhibition, setSelectedExhibition] = useState(initialExhibition || null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [showInvitationModal, setShowInvitationModal] = useState(null);
  const [showResponseForm, setShowResponseForm] = useState(null); // 招待中タップ時のアンケートフォーム表示
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Mobile Menu State
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false); // 詳細説明の開閉
  const [seenInvitations, setSeenInvitations] = useState(() => {
    const saved = localStorage.getItem(`seen_invitations_${maker.code}`);
    return saved ? JSON.parse(saved) : [];
  });

  // Sync selectedExhibition with latest data from exhibitions prop OR initialExhibition update
  const initialProcessed = useRef(false);
  const explicitCloseRef = useRef(false);

  useEffect(() => {
    // If user explicitly closed the detail view, do not auto-select/override from initialExhibition
    if (explicitCloseRef.current && !selectedExhibition) return;

    if (selectedExhibition) {
      const updated = exhibitions.find(e => e.id === selectedExhibition.id);

      // Ensure the selected exhibition is actually one I am invited to
      const isMine = myExhibitions.some(e => e.id === selectedExhibition.id);
      if (!isMine) {
        setSelectedExhibition(null);
        setActiveTab('home');
        return;
      }

      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedExhibition)) {
        setSelectedExhibition(updated);
      }
    } else if (initialExhibition && !initialProcessed.current) {
      // First load or switch
      const isMine = myExhibitions.some(e => e.id === initialExhibition.id);

      if (isMine) {
        setSelectedExhibition(initialExhibition);
        initialProcessed.current = true;
        setActiveTab('detail');
      } else {
        setSelectedExhibition(null);
        initialProcessed.current = true;
        setActiveTab('home');
      }
    }
  }, [exhibitions, selectedExhibition, initialExhibition]); // Remove myExhibitions from deps to avoid loop, use within effect

  // Filter exhibitions where this maker is invited AND Deduplicate by content (Title + Dates)
  // This safeguards against duplicate exhibition data causing UI glitches and double counting
  const myExhibitions = useMemo(() => {
    const raw = exhibitions.filter(ex => {
      const makers = ex.makers || [];
      return makers.some(m => m.code === maker.code);
    });
    // Deduplicate
    return raw.filter((ex, index, self) =>
      index === self.findIndex(t => (
        t.title === ex.title && JSON.stringify(t.dates) === JSON.stringify(ex.dates)
      ))
    );
  }, [exhibitions, maker.code]);

  // Categorize exhibitions
  const today = new Date();
  const getStatus = (ex) => {
    const m = (ex.makers || []).find(m => m.code === maker.code);
    if (!m) return 'none';
    return m.status || 'invited';
  };
  const isPast = (ex) => {
    if (!ex.dates || ex.dates.length === 0) return false;
    const lastDate = new Date(ex.dates[ex.dates.length - 1]);
    return lastDate < today;
  };

  const sortByDate = (exList) => [...exList].sort((a, b) => {
    const dateA = a.dates?.[0] ? new Date(a.dates[0]) : new Date(0);
    const dateB = b.dates?.[0] ? new Date(b.dates[0]) : new Date(0);
    return dateA - dateB;
  });
  const confirmedExhibitions = sortByDate(myExhibitions.filter(ex => getStatus(ex) === 'confirmed' && !isPast(ex)));
  const invitedExhibitions = sortByDate(myExhibitions.filter(ex => ['invited', 'pending'].includes(getStatus(ex))));
  const declinedExhibitions = sortByDate(myExhibitions.filter(ex => getStatus(ex) === 'declined'));
  const pastExhibitions = sortByDate(myExhibitions.filter(ex => getStatus(ex) === 'confirmed' && isPast(ex)));

  // Unread invitations count
  const unreadInvitations = invitedExhibitions.filter(ex => !seenInvitations.includes(ex.id));

  // Check for new invitation on mount
  useEffect(() => {
    if (unreadInvitations.length > 0 && !showInvitationModal) {
      const newest = unreadInvitations[0];
      setShowInvitationModal(newest);
    }
  }, [unreadInvitations.length]);

  // Removed redundant useEffect (lines 5471-5482) that was conflicting with the main sync logic


  const handleDismissInvitation = (exId) => {
    const updated = [...seenInvitations, exId];
    setSeenInvitations(updated);
    localStorage.setItem(`seen_invitations_${maker.code}`, JSON.stringify(updated));
    setShowInvitationModal(null);
  };

  const handleScan = async (result) => {
    if (!result) return;
    const rawCode = result[0]?.rawValue;
    if (!rawCode) return;
    setShowScanner(false);
    const res = await onScan(rawCode, selectedExhibition?.id);
    setScanResult(res);
  };

  const closeScanResult = () => {
    setScanResult(null);
    setShowScanner(true);
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  // Get scan logs for selected exhibition
  const getMyLogs = (ex) => {
    if (!ex) return [];
    return (ex.scanLogs || []).filter(l => l.makerId === maker.code);
  };



  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}><Menu size={24} /></button>
          <h1 className="text-lg font-bold flex items-center gap-2"><Ghost className="text-red-500" size={20} /> Kaientai-X</h1>
        </div>
      </div>

      {/* Left Sidebar - Admin Style */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tighter text-blue-400 flex items-center gap-2"><Ghost className="text-red-500" size={24} /> Kaientai-X</h1>
            <p className="text-xs text-slate-400 mt-1">Event Management System</p>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400"><X /></button>
        </div>
        <div className="px-4 py-6 border-b border-slate-700">
          <div className="bg-slate-800 p-3 rounded-lg">
            <p className="text-xs text-slate-400">ログイン企業</p>
            <p className="font-bold text-sm truncate">{maker.name}</p>
            <p className="text-xs text-slate-500 font-mono mt-1">{maker.code}</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => { setActiveTab('home'); setSelectedExhibition(null); setIsMobileMenuOpen(false); }}
            className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 ${activeTab === 'home' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            <LayoutDashboard size={18} /> ホーム
          </button>
          <button
            onClick={() => { setActiveTab('analysis'); setIsMobileMenuOpen(false); }}
            className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 ${activeTab === 'analysis' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            <TrendingUp size={18} /> 展示会分析
          </button>
          <button
            onClick={() => { setActiveTab('messages'); setIsMobileMenuOpen(false); }}
            className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 relative ${activeTab === 'messages' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            <Inbox size={18} /> メッセージ一覧
            {(() => {
              // Count unread invitations + unread messages
              const unreadMsgCount = myExhibitions.reduce((acc, ex) => {
                const msgs = ex.messages || [];
                const myMaker = (ex.makers || []).find(m => m.code === maker.code);
                if (!myMaker || myMaker.status !== 'confirmed') return acc;
                const unread = msgs.filter(m => !(m.readBy || []).includes(maker.code));
                return acc + unread.length;
              }, 0);
              const totalUnread = unreadInvitations.length + unreadMsgCount;
              if (totalUnread === 0) return null;
              return (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                  {totalUnread}
                </span>
              );
            })()}
          </button>
        </nav>
        <div className="p-4 border-t border-slate-700 text-xs text-slate-500">
          © Kaientai-X
        </div>
      </div>

      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>}

      {/* Main Content */}
      <div className="flex-1 md:w-full w-full h-[calc(100vh-60px)] md:h-screen overflow-y-auto">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-30 px-4 md:px-8 py-4 flex justify-between items-center">
          <h2 className="text-lg md:text-xl font-bold text-slate-800 truncate max-w-[200px] md:max-w-none">
            {activeTab === 'home' && 'マイ展示会'}
            {activeTab === 'analysis' && '展示会分析'}
            {activeTab === 'messages' && 'メッセージ一覧'}
            {activeTab === 'detail' && selectedExhibition?.title}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">{maker.name}</span>
            <div className="bg-slate-100 p-2 rounded-full"><User size={20} className="text-slate-400" /></div>
          </div>
        </header>

        {/* Content Area */}
        {/* Content Area */}
        <div role="main" className="p-4 md:p-8 pb-24">
          {/* HOME TAB */}
          {activeTab === 'home' && (
            <div className="space-y-8 animate-fade-in">
              {/* Confirmed */}
              <section>
                <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <CheckCircle className="text-emerald-500" size={20} /> 参加確定 ({confirmedExhibitions.length})
                </h3>
                {confirmedExhibitions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {confirmedExhibitions.map(ex => (
                      <ExhibitionCard
                        key={ex.id}
                        exhibition={ex}
                        status="confirmed"
                        onAction={() => {
                          setSelectedExhibition(ex);
                          setActiveTab('detail');
                        }}
                        onScan={(ex) => {
                          setSelectedExhibition(ex);
                          setShowScanner(true);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">参加確定の展示会はありません</p>
                )}
              </section>

              {/* Invited */}
              <section>
                <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Mail className="text-amber-500" size={20} /> 招待中 ({invitedExhibitions.length})
                </h3>
                {invitedExhibitions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {invitedExhibitions.map(ex => (
                      <ExhibitionCard
                        key={ex.id}
                        exhibition={ex}
                        status="invited"
                        onAction={() => {
                          console.log('Home invited card clicked');
                          handleDismissInvitation(ex.id);
                          setShowResponseForm(ex);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">招待中の展示会はありません</p>
                )}
              </section>

              {/* Declined */}
              <section>
                <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <UserX className="text-slate-400" size={20} /> 辞退 ({declinedExhibitions.length})
                </h3>
                {declinedExhibitions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {declinedExhibitions.map(ex => (
                      <ExhibitionCard
                        key={ex.id}
                        exhibition={ex}
                        status="declined"
                        onAction={() => {
                          setSelectedExhibition(ex);
                          setActiveTab('detail');
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">辞退した展示会はありません</p>
                )}
              </section>

              {/* Past */}
              <section>
                <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Clock className="text-slate-400" size={20} /> 終了済み ({pastExhibitions.length})
                </h3>
                {pastExhibitions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pastExhibitions.map(ex => (
                      <ExhibitionCard
                        key={ex.id}
                        exhibition={ex}
                        status="past"
                        onAction={() => {
                          setSelectedExhibition(ex);
                          setActiveTab('detail');
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">終了済みの展示会はありません</p>
                )}
              </section>

              {myExhibitions.length === 0 && (
                <div className="text-center py-20 text-slate-400">
                  招待されている展示会はありません
                </div>
              )}
            </div>
          )}

          {/* ANALYSIS TAB */}
          {activeTab === 'analysis' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm text-center">
                  <p className="text-sm text-slate-500">参加展示会数</p>
                  <p className="text-4xl font-bold text-blue-600 mt-2">{confirmedExhibitions.length + pastExhibitions.length}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm text-center">
                  <p className="text-sm text-slate-500">総スキャン数</p>
                  <p className="text-4xl font-bold text-emerald-600 mt-2">
                    {myExhibitions.reduce((sum, ex) => sum + getMyLogs(ex).length, 0)}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm text-center">
                  <p className="text-sm text-slate-500">ユニーク来場者</p>
                  <p className="text-4xl font-bold text-amber-600 mt-2">
                    {new Set(myExhibitions.flatMap(ex => getMyLogs(ex).map(l => l.visitorId))).size}
                  </p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="font-bold text-slate-700 mb-4">来場者属性分析</h3>
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: '小売', value: 40 }, { name: '商社', value: 30 }, { name: 'メーカー', value: 20 }, { name: 'その他', value: 10 }
                        ]}
                        cx="50%" cy="50%"
                        innerRadius={60} outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {COLORS.map((color, index) => <Cell key={`cell-${index}`} fill={color} />)}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-center text-slate-400 mt-2">※デモデータ表示中</p>
              </div>
            </div>
          )}

          {/* MESSAGES TAB */}
          {activeTab === 'messages' && (
            <div className="space-y-4 animate-fade-in">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Inbox size={24} className="text-blue-500" /> メッセージ一覧</h2>

              {(() => {
                // Collect all messages: invitations + document notifications
                const allMessages = [];

                // Add invitations
                invitedExhibitions.forEach(ex => {
                  allMessages.push({
                    id: `inv-${ex.id}`,
                    type: 'invitation',
                    exhibition: ex,
                    title: `${ex.title} への出展招待`,
                    content: `${ex.dates?.join(', ')} | ${ex.place || ex.venueAddress}`,
                    date: ex.invitedAt || ex.createdAt || new Date().toISOString(),
                    isRead: seenInvitations.includes(ex.id),
                    isDeclined: false
                  });
                });

                // Add declined
                declinedExhibitions.forEach(ex => {
                  allMessages.push({
                    id: `dec-${ex.id}`,
                    type: 'declined',
                    exhibition: ex,
                    title: `${ex.title} (辞退済み)`,
                    content: `${ex.dates?.join(', ')} | ${ex.place || ex.venueAddress}`,
                    date: ex.respondedAt || ex.createdAt || new Date().toISOString(),
                    isRead: true,
                    isDeclined: true
                  });
                });

                // Add document notifications from All Confirmed Exhibitions (Same logic as Badge)
                // ★修正: バッジのカウントロジックと完全に一致させるため、myExhibitionsから直接フィルタリング
                const targetExhibitions = myExhibitions.filter(ex => {
                  const m = (ex.makers || []).find(mm => mm.code === maker.code);
                  return m && m.status === 'confirmed';
                });

                targetExhibitions.forEach(ex => {
                  (ex.messages || []).forEach(msg => {
                    // ★修正: 全てのメッセージタイプを表示する（もし特定のタイプを除外したい場合はここで条件追加）
                    // バッジは全てのメッセージをカウントしているため、ここも全て通す
                    allMessages.push({
                      id: msg.id,
                      type: msg.type === 'document_sent' ? 'document' : 'message', // Generic type for others
                      exhibition: ex,
                      title: msg.type === 'document_sent' ? `${ex.title}: ${msg.title}` : `${ex.title}: ${msg.title || 'お知らせ'}`,
                      content: msg.content,
                      date: msg.sentAt || msg.date || new Date().toISOString(),
                      isRead: (msg.readBy || []).includes(maker.code),
                      isDeclined: false
                    });
                  });
                });

                // Sort by date descending
                allMessages.sort((a, b) => new Date(b.date) - new Date(a.date));

                if (allMessages.length === 0) {
                  return <div className="text-center py-20 text-slate-400">メッセージはありません</div>;
                }

                return allMessages.map(msg => (
                  <div
                    key={msg.id}
                    className={`bg-white p-4 rounded-lg shadow-sm border-l-4 flex items-center justify-between cursor-pointer hover:shadow-md transition-all ${msg.isDeclined ? 'border-l-slate-400 bg-slate-50 opacity-70' :
                      msg.type === 'document' ? (msg.isRead ? 'border-l-amber-400' : 'border-l-amber-500 bg-amber-50') :
                        msg.isRead ? 'border-l-blue-400' : 'border-l-red-500 bg-red-50'
                      }`}
                    onClick={() => {
                      if (msg.type === 'invitation') {
                        handleDismissInvitation(msg.exhibition.id);
                        setShowResponseForm(msg.exhibition);
                      } else if (msg.type === 'document' || msg.type === 'message') {
                        if (!msg.isRead && markMessageAsRead) {
                          markMessageAsRead(msg.exhibition.id, msg.id, maker.code);
                        }
                        setSelectedExhibition(msg.exhibition);
                        setActiveTab('detail');
                      } else if (msg.type === 'declined') {
                        setSelectedExhibition(msg.exhibition);
                        setActiveTab('detail');
                      }
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-full ${msg.isDeclined ? 'bg-slate-200' :
                        msg.type === 'document' ? 'bg-amber-100' :
                          msg.isRead ? 'bg-blue-100' : 'bg-red-100'
                        }`}>
                        {msg.isDeclined ? <UserX size={20} className="text-slate-500" /> :
                          msg.type === 'document' ? <FileText size={20} className="text-amber-600" /> :
                            <Mail size={20} className={msg.isRead ? 'text-blue-500' : 'text-red-500'} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                          {msg.title}
                          {!msg.isRead && !msg.isDeclined && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">未読</span>}
                        </h4>
                        <p className="text-xs text-slate-500">{msg.content}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{new Date(msg.date).toLocaleString()}</p>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-400" />
                  </div>
                ));
              })()}
            </div>
          )}

          {/* DETAIL TAB */}
          {activeTab === 'detail' && selectedExhibition && myExhibitions.some(e => e.id === selectedExhibition.id) && (
            <div className="space-y-6 animate-fade-in">
              <button
                onClick={() => {
                  setActiveTab('home');
                  setSelectedExhibition(null);
                  explicitCloseRef.current = true; // Use Ref to prevent auto-reopen loop
                }}
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                <ArrowLeft size={16} /> 戻る
              </button>

              {/* 1. New Header Design with QR Button */}
              <div className="relative rounded-2xl overflow-hidden shadow-lg bg-white border border-slate-100">
                {/* Header Background */}
                <div className="h-32 bg-gradient-to-r from-slate-800 to-slate-900 relative">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>
                  <div className="absolute bottom-4 left-6 text-white z-10 w-2/3">
                    <h2 className="text-xl md:text-2xl font-bold drop-shadow-md leading-tight">{selectedExhibition.title}</h2>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-slate-300 text-xs md:text-sm">
                      <span className="flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded backdrop-blur-sm"><Calendar size={12} /> {selectedExhibition.dates?.join(', ')}</span>
                      <span className="flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded backdrop-blur-sm"><MapPin size={12} /> {selectedExhibition.venueAddress || selectedExhibition.place}</span>
                    </div>
                  </div>
                </div>

                {/* QR Scan Action Bar (Prominent) */}
                <div className="bg-blue-50 p-4 border-b border-blue-100">
                  <button onClick={() => setShowScanner(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02]">
                    <ScanLine size={24} />
                    <span className="text-lg">QRコードを読み取って受付する</span>
                  </button>
                  <p className="text-center text-xs text-blue-400 mt-2">※来場者のQRコードをカメラで読み取ってください</p>
                </div>
              </div>

              {/* Description (Always Open) */}
              <div className="p-6 bg-white">
                <div className="flex items-center gap-2 mb-4">
                  <Info size={18} className="text-blue-500" />
                  <h3 className="font-bold text-slate-700">展示会詳細情報</h3>
                </div>

                <div className="bg-slate-50 p-5 rounded-xl text-sm text-slate-600 leading-relaxed border border-slate-100 shadow-inner">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-white p-3 rounded-lg border border-slate-100">
                      <span className="block text-xs font-bold text-slate-400 mb-1">コンセプト</span>
                      {selectedExhibition.concept}
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-100">
                      <span className="block text-xs font-bold text-slate-400 mb-1">開場時間</span>
                      {selectedExhibition.openTime} - {selectedExhibition.closeTime}
                    </div>
                  </div>
                  {(selectedExhibition.formConfig?.section1?.description || selectedExhibition.description) && (
                    <div className="bg-white p-4 rounded-lg border border-slate-100">
                      <span className="block text-xs font-bold text-slate-400 mb-2 border-b border-slate-100 pb-1">ご案内・詳細</span>
                      <div className="whitespace-pre-wrap">{selectedExhibition.formConfig?.section1?.description || selectedExhibition.description}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Documents Download Section - Updated to use TabFiles (materials) */}
              {(() => {
                const materials = selectedExhibition.materials || {};
                const docs = selectedExhibition.documents || {};

                // Use new materials (TabFiles) with fallback to legacy documents (TabMakers)
                const layoutUrl = materials.venue || docs.layoutPdf?.url;
                const flyerUrl = materials.flyer || docs.flyerPdf?.url;

                if (!layoutUrl && !flyerUrl && !materials.other) return null;

                return (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-2xl shadow-lg border border-amber-100">
                    <h3 className="font-bold text-amber-800 mb-4 flex items-center gap-2"><Download size={18} className="text-amber-600" /> 資料ダウンロード</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {layoutUrl && (
                        <a
                          href={layoutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 bg-white p-4 rounded-xl border border-amber-200 hover:border-amber-400 hover:shadow-md transition-all group"
                        >
                          <div className="p-3 bg-amber-100 rounded-lg group-hover:bg-amber-200 transition-colors">
                            <LayoutDashboard size={24} className="text-amber-600" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-700">会場資料・レイアウト</div>
                            <div className="text-xs text-slate-400">Google Drive / 外部リンク</div>
                          </div>
                          <ChevronRight size={20} className="text-slate-400 ml-auto group-hover:translate-x-1 transition-transform" />
                        </a>
                      )}

                      {flyerUrl && (
                        <a
                          href={flyerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 bg-white p-4 rounded-xl border border-orange-200 hover:border-orange-400 hover:shadow-md transition-all group"
                        >
                          <div className="p-3 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                            <FileText size={24} className="text-orange-600" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-700">案内チラシ・ポスター</div>
                            <div className="text-xs text-slate-400">Google Drive / 外部リンク</div>
                          </div>
                          <ChevronRight size={20} className="text-slate-400 ml-auto group-hover:translate-x-1 transition-transform" />
                        </a>
                      )}
                      {materials.other && (
                        <a
                          href={materials.other}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-400 hover:shadow-md transition-all group"
                        >
                          <div className="p-3 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                            <Folder size={24} className="text-slate-600" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-700">その他参考資料</div>
                            <div className="text-xs text-slate-400">Google Drive / 外部リンク</div>
                          </div>
                          <ChevronRight size={20} className="text-slate-400 ml-auto group-hover:translate-x-1 transition-transform" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 2. Response Data - Fixed to also check root level data */}
              {(() => {
                const myInfo = (selectedExhibition.makers || []).find(m => m.code === maker.code);
                if (!myInfo) return null;

                // Check both myInfo.response and myInfo directly for data
                const response = myInfo.response || {};
                const hasResponseData = Object.keys(response).some(k => response[k] !== undefined && response[k] !== '');

                // Also check root level properties and formData
                // ★修正: FIELD_ORDERにあるすべてのキーと、formDataからのデータも考慮
                const rootKeys = [...FIELD_ORDER];
                const formData = myInfo.formData || {};

                // formData も mergedData に追加
                Object.keys(formData).forEach(k => {
                  if (!rootKeys.includes(k)) rootKeys.push(k);
                });

                const hasRootData = rootKeys.some(k => myInfo[k] !== undefined && myInfo[k] !== '' || formData[k] !== undefined && formData[k] !== '');

                if (!hasResponseData && !hasRootData) return null;

                // Merge root data and formData into response for display
                // ★修正: formDataからのデータも追加
                const mergedData = { ...response };
                rootKeys.forEach(k => {
                  // 1. Root level data
                  if (myInfo[k] !== undefined && myInfo[k] !== '' && !mergedData[k]) {
                    mergedData[k] = myInfo[k];
                  }
                  // 2. formData (過去のフォーム方式からの回答)
                  if (formData[k] !== undefined && formData[k] !== '' && !mergedData[k]) {
                    mergedData[k] = formData[k];
                  }
                });

                return (
                  <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><CheckCircle size={18} className="text-emerald-500" /> 出展申込時の回答内容</h3>
                    {(() => {
                      const orderedKeys = FIELD_ORDER.filter(k => mergedData[k] !== undefined && mergedData[k] !== '');
                      const otherKeys = Object.keys(mergedData).filter(k => !FIELD_ORDER.includes(k) && mergedData[k] !== undefined && mergedData[k] !== '');
                      const displayKeys = [...orderedKeys, ...otherKeys];

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/50 p-4 rounded-xl">
                          {displayKeys.map(key => {
                            const val = mergedData[key];
                            const label = FIELD_LABELS[key] || key;
                            const isFullWidth = ['note', 'products', 'powerDetail'].includes(key);
                            return (
                              <div key={key} className={`bg-white p-3 rounded-lg border border-slate-100 shadow-sm hover:border-blue-200 transition-colors ${isFullWidth ? 'md:col-span-2' : ''}`}>
                                <div className="text-[10px] font-bold text-slate-400 mb-1 tracking-wider uppercase">{label}</div>
                                <div className="text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">{String(val)}</div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
              {/* 3. Scan & History */}
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><HistoryIcon size={18} className="text-amber-500" /> スキャン履歴 <span className="text-sm bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{getMyLogs(selectedExhibition).length}件</span></h3>
                  <button
                    onClick={() => {
                      const logs = getMyLogs(selectedExhibition);
                      if (logs.length === 0) { alert('データがありません'); return; }
                      const wb = new ExcelJS.Workbook();
                      const ws = wb.addWorksheet('ScanLogs');
                      ws.addRow(['日時', '会社名', '氏名', '電話', 'メール']);
                      logs.forEach(l => {
                        ws.addRow([
                          new Date(l.scannedAt).toLocaleString(),
                          l.visitorSnapshot?.companyName || '',
                          l.visitorSnapshot?.repName || '',
                          l.visitorSnapshot?.phone || '',
                          l.visitorSnapshot?.email || ''
                        ]);
                      });
                      wb.xlsx.writeBuffer().then(buffer => {
                        saveAs(new Blob([buffer]), `scan_logs_${selectedExhibition.title}.xlsx`);
                      });
                    }}
                    className="text-xs font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Download size={14} /> Excel出力
                  </button>
                </div>

                <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {getMyLogs(selectedExhibition).length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <ScanLine size={32} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-slate-400 text-sm">まだスキャン履歴がありません</p>
                      <button onClick={() => setShowScanner(true)} className="mt-4 text-sm text-blue-500 hover:underline">QRスキャンを開始する</button>
                    </div>
                  ) : (
                    getMyLogs(selectedExhibition).map(log => (
                      <div key={log.id} className="py-3 flex items-center gap-3 group hover:bg-slate-50 rounded-lg px-2 transition-colors">
                        <div className="bg-slate-100 p-2.5 rounded-full text-slate-400 group-hover:bg-white group-hover:text-blue-500 group-hover:shadow-sm transition-all"><User size={16} /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-700 truncate">{log.visitorSnapshot?.repName || 'Unknown'}</p>
                          <p className="text-xs text-slate-400 truncate">{log.visitorSnapshot?.companyName}</p>
                        </div>
                        <span className="text-xs font-mono text-slate-300 group-hover:text-slate-500">{new Date(log.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scanner Modal */}
      {
        showScanner && (
          <div className="fixed inset-0 bg-black z-50 flex flex-col">
            <div className="p-4 flex justify-between items-center text-white bg-black/50 absolute top-0 w-full z-40">
              <h2 className="font-bold flex items-center gap-2"><ScanLine /> スキャン中...</h2>
              <button onClick={() => setShowScanner(false)} className="p-2 bg-white/20 rounded-full"><X /></button>
            </div>
            <div className="flex-1 relative flex items-center justify-center bg-black">
              <Scanner onScan={handleScan} components={{ audio: false }} styles={{ container: { width: '100%', height: '100%' } }} />
              <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-blue-500/50 relative">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-500"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-500"></div>
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-500"></div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-500"></div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Scan Result Modal */}
      {
        scanResult && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className={`bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl ${scanResult.success ? 'border-t-8 border-green-500' : 'border-t-8 border-red-500'}`}>
              <div className="p-6 text-center">
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${scanResult.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {scanResult.success ? <Check size={32} /> : <AlertTriangle size={32} />}
                </div>
                <h3 className="text-xl font-bold mb-1">{scanResult.success ? 'スキャン成功' : 'エラー'}</h3>
                <p className="text-sm text-slate-500 mb-6">{scanResult.message}</p>
                {scanResult.visitor && (
                  <div className="bg-slate-50 p-4 rounded-xl text-left mb-6 space-y-2">
                    <div><p className="text-xs text-slate-400">会社名</p><p className="font-bold text-slate-700">{scanResult.visitor.companyName}</p></div>
                    <div><p className="text-xs text-slate-400">氏名</p><p className="font-bold text-slate-700 text-lg">{scanResult.visitor.repName} <span className="text-sm font-normal">様</span></p></div>
                  </div>
                )}
                <button onClick={closeScanResult} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl">続けてスキャン</button>
              </div>
            </div>
          </div>
        )
      }

      {/* New Invitation Modal (One-time) */}
      {
        showInvitationModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white max-w-md w-full rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-center text-white">
                <Mail size={48} className="mx-auto mb-3" />
                <h2 className="text-2xl font-bold">新しい招待状</h2>
              </div>
              <div className="p-6 text-center">
                <h3 className="text-xl font-bold text-slate-800 mb-2">{showInvitationModal.title}</h3>
                <p className="text-sm text-slate-500 mb-1">{showInvitationModal.dates?.join(', ')}</p>
                <p className="text-sm text-slate-500 mb-6">{showInvitationModal.place || showInvitationModal.venueAddress}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDismissInvitation(showInvitationModal.id)}
                    className="flex-1 bg-slate-200 text-slate-700 font-bold py-3 rounded-xl"
                  >
                    後で
                  </button>
                  <button
                    onClick={() => {
                      const ex = showInvitationModal;
                      handleDismissInvitation(ex.id);
                      setShowResponseForm(ex);
                    }}
                    className="flex-1 bg-amber-500 text-white font-bold py-3 rounded-xl"
                  >
                    回答する
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Response Form Modal - 招待中の展示会からアンケート回答 */}
      {
        showResponseForm && (
          <div className="fixed inset-0 bg-black/80 z-[9999] overflow-y-auto">
            <div className="min-h-full py-4 px-2">
              <MakerResponseForm
                exhibition={showResponseForm}
                config={showResponseForm.formConfig || DEFAULT_FORM_CONFIG}
                onClose={() => setShowResponseForm(null)}
                onSubmit={(data) => {
                  // 回答を送信
                  if (typeof onResponseSubmit === 'function') {
                    onResponseSubmit(showResponseForm.id, data);
                  } else {
                    console.log('Form submitted (no handler):', data);
                  }
                  // alertは削除し、MakerResponseForm側の完了画面に遷移させる
                }}
              />
            </div>
          </div>
        )
      }
    </div >
  );
}

// Legacy wrapper for compatibility
function MakerDashboard({ maker, exhibitionName, scanLogs, onScan, exhibitions, onResponseSubmit }) {
  // If exhibitions array is provided, use new MakerPortal
  if (exhibitions && exhibitions.length > 0) {
    return <MakerPortal maker={maker} exhibitions={exhibitions} onScan={onScan} onResponseSubmit={onResponseSubmit} />;
  }

  // Fallback to single-exhibition mode (legacy)
  const singleExhibition = { title: exhibitionName, scanLogs: scanLogs, id: 'legacy' };
  return <MakerPortal maker={maker} exhibitions={[singleExhibition]} onScan={onScan} onResponseSubmit={onResponseSubmit} />;
}

// EnterpriseConsole moved to components/EnterpriseConsole.jsx




// ============================================================================
// Performance Analysis View - 実績分析
// ============================================================================
function PerformanceAnalysisView({ exhibitions }) {
  // 年度別収支計算
  const getYearlyStats = useMemo(() => {
    const yearlyData = {};

    exhibitions.forEach(ex => {
      // 開催日から年度を算出（4月始まり）
      const dateStr = ex.dates?.[0];
      if (!dateStr) return;

      const date = new Date(dateStr);
      const month = date.getMonth() + 1;
      const year = month >= 4 ? date.getFullYear() : date.getFullYear() - 1;
      const fiscalYear = `${year}年度`;

      if (!yearlyData[fiscalYear]) {
        yearlyData[fiscalYear] = { income: 0, expense: 0, exhibitions: 0, visitors: 0 };
      }

      // 収入計算
      const makers = ex.makers || [];
      const confirmedMakers = makers.filter(m => m.status === 'confirmed');
      const feePerBooth = ex.formConfig?.settings?.feePerBooth || 30000;
      const boothIncome = confirmedMakers.reduce((sum, m) => {
        const boothCount = parseInt(String(m.boothCount || '1').match(/\d+/)?.[0] || '1');
        return sum + (boothCount * feePerBooth);
      }, 0);
      const otherIncomes = (ex.otherBudgets || []).filter(b => b.type === 'income').reduce((s, i) => s + (i.amount || 0), 0);

      // 支出計算
      const venueCost = ex.venueDetails?.cost || 0;
      const equipmentTotal = (ex.venueDetails?.equipment || []).reduce((sum, item) => sum + (item.count * item.price), 0);
      const lectureFees = (ex.lectures || []).reduce((sum, l) => sum + Number(l.speakerFee || 0) + Number(l.transportFee || 0), 0);
      const otherExpenses = (ex.otherBudgets || []).filter(b => b.type === 'expense').reduce((s, i) => s + (i.amount || 0), 0);

      yearlyData[fiscalYear].income += boothIncome + otherIncomes;
      yearlyData[fiscalYear].expense += venueCost + equipmentTotal + lectureFees + otherExpenses;
      yearlyData[fiscalYear].exhibitions += 1;
      yearlyData[fiscalYear].visitors += (ex.visitors || []).length;
    });

    return Object.entries(yearlyData).map(([year, data]) => ({
      year,
      ...data,
      profit: data.income - data.expense
    })).sort((a, b) => b.year.localeCompare(a.year));
  }, [exhibitions]);

  // 総来場者数
  const totalVisitors = useMemo(() => {
    return exhibitions.reduce((sum, ex) => sum + (ex.visitors || []).length, 0);
  }, [exhibitions]);

  // 来場済み数
  const checkedInVisitors = useMemo(() => {
    return exhibitions.reduce((sum, ex) => {
      const visitors = ex.visitors || [];
      return sum + visitors.filter(v => v.checkedIn || v.status === 'arrived').length;
    }, 0);
  }, [exhibitions]);

  const analysisStatuses = useMemo(() => new Set(['invited', 'confirmed', 'declined']), []);
  const normalizeCompanyName = (name) => String(name || '')
    .replace(/[ \t\r\n\u3000]/g, '')
    .trim()
    .toLowerCase();
  const getMakerField = (maker, key) => {
    if (!maker) return '';
    if (maker[key] !== undefined && maker[key] !== null && maker[key] !== '') return String(maker[key]).trim();
    if (maker.response?.[key] !== undefined && maker.response?.[key] !== null && maker.response?.[key] !== '') return String(maker.response[key]).trim();
    if (maker.formData?.[key] !== undefined && maker.formData?.[key] !== null && maker.formData?.[key] !== '') return String(maker.formData[key]).trim();
    return '';
  };
  const getMakerCode = (maker) => {
    return getMakerField(maker, 'supplierCode')
      || getMakerField(maker, 'code')
      || '';
  };
  const getMakerDisplayName = (maker) => {
    return getMakerField(maker, 'companyName')
      || getMakerField(maker, 'name')
      || (getMakerCode(maker) ? `コード:${getMakerCode(maker)}` : '企業名不明');
  };
  const getMakerCompanyKey = (maker) => {
    const code = getMakerCode(maker);
    if (code) return `code:${code}`;
    const normalizedName = normalizeCompanyName(getMakerDisplayName(maker));
    if (normalizedName) return `name:${normalizedName}`;
    return null;
  };
  const normalizeMakerStatusForAnalysis = (rawStatus) => {
    const s = String(rawStatus || '').trim().toLowerCase();
    if (!s) return '';
    if (s === 'confirmed' || s.includes('参加確定') || s.includes('申し込む')) return 'confirmed';
    if (s === 'declined' || s.includes('辞退') || s.includes('申し込まない')) return 'declined';
    if (s === 'invited' || s.includes('招待中')) return 'invited';
    if (s === 'listed' || s.includes('未送付') || s.includes('リスト')) return 'listed';
    return s;
  };

  // 来場者属性（受付区分）
  const visitorAttributes = useMemo(() => {
    const attributes = {};
    exhibitions.forEach(ex => {
      (ex.visitors || []).forEach(v => {
        const category = v.receptionType || v.category || v.type || '未分類';
        attributes[category] = (attributes[category] || 0) + 1;
      });
    });
    return Object.entries(attributes).map(([name, value]) => ({ name, value }));
  }, [exhibitions]);

  // 企業別の実績母集計（展示会単位で重複排除）
  const companyPerformanceStats = useMemo(() => {
    const statsByCompany = new globalThis.Map();
    const pickMostVoted = (votes) => {
      let picked = '';
      let max = -1;
      votes.forEach((count, value) => {
        if (count > max || (count === max && String(value).length > String(picked).length)) {
          picked = value;
          max = count;
        }
      });
      return picked;
    };

    exhibitions.forEach((ex, exIndex) => {
      const exhibitionKey = ex.id || `${ex.title || '展示会'}__${ex.dates?.[0] || ''}__${exIndex}`;
      const perExCompany = new globalThis.Map();

      (ex.makers || []).forEach((maker) => {
        const status = normalizeMakerStatusForAnalysis(maker?.status);
        if (!analysisStatuses.has(status)) return;

        const companyKey = getMakerCompanyKey(maker);
        if (!companyKey) return;

        if (!perExCompany.has(companyKey)) {
          perExCompany.set(companyKey, { statuses: new Set(), nameVotes: new globalThis.Map(), codeVotes: new globalThis.Map() });
        }
        const perEx = perExCompany.get(companyKey);
        perEx.statuses.add(status);

        const name = getMakerDisplayName(maker);
        if (name) perEx.nameVotes.set(name, (perEx.nameVotes.get(name) || 0) + 1);

        const code = getMakerCode(maker);
        if (code) perEx.codeVotes.set(code, (perEx.codeVotes.get(code) || 0) + 1);
      });

      perExCompany.forEach((perEx, companyKey) => {
        if (!statsByCompany.has(companyKey)) {
          statsByCompany.set(companyKey, {
            key: companyKey,
            name: '企業名不明',
            code: '',
            invitedExhibitions: new Set(),
            confirmedExhibitions: new Set(),
            declinedExhibitions: new Set()
          });
        }
        const company = statsByCompany.get(companyKey);
        const votedName = pickMostVoted(perEx.nameVotes);
        const votedCode = pickMostVoted(perEx.codeVotes);
        if (votedName && (company.name === '企業名不明' || votedName.length > company.name.length)) company.name = votedName;
        if (votedCode && !company.code) company.code = votedCode;

        company.invitedExhibitions.add(exhibitionKey);
        if (perEx.statuses.has('confirmed')) company.confirmedExhibitions.add(exhibitionKey);
        if (perEx.statuses.has('declined')) company.declinedExhibitions.add(exhibitionKey);
      });
    });

    return Array.from(statsByCompany.values()).map((company) => {
      const invited = company.invitedExhibitions.size;
      const confirmed = company.confirmedExhibitions.size;
      const declined = company.declinedExhibitions.size;
      const declineRate = invited > 0 ? Number(((declined / invited) * 100).toFixed(1)) : 0;
      const participationRate = invited > 0 ? Number(((confirmed / invited) * 100).toFixed(1)) : 0;
      return {
        key: company.key,
        name: company.name,
        code: company.code,
        invited,
        confirmed,
        declined,
        declineRate,
        participationRate
      };
    });
  }, [analysisStatuses, exhibitions]);

  // 参加企業ランキング TOP30（参加確定回数ベース）
  const companyRanking = useMemo(() => {
    return [...companyPerformanceStats]
      .sort((a, b) => b.confirmed - a.confirmed || b.invited - a.invited || a.name.localeCompare(b.name, 'ja'))
      .slice(0, 30)
      .map(company => ({
        name: company.name,
        code: company.code,
        count: company.confirmed,
        invited: company.invited,
        declined: company.declined
      }));
  }, [companyPerformanceStats]);

  // 辞退割合が高い企業ランキング TOP30（招待数3回以上）
  const declineRanking = useMemo(() => {
    return [...companyPerformanceStats]
      .filter(company => company.invited >= 3)
      .sort((a, b) => b.declineRate - a.declineRate || b.declined - a.declined || b.invited - a.invited || a.name.localeCompare(b.name, 'ja'))
      .slice(0, 30)
      .map(company => ({
        name: company.name,
        code: company.code,
        invited: company.invited,
        declined: company.declined,
        rate: company.declineRate.toFixed(1)
      }));
  }, [companyPerformanceStats]);

  const [aiReportGeneratedAt, setAiReportGeneratedAt] = useState(() => Date.now());
  const [aiReportRevision, setAiReportRevision] = useState(1);
  const [isAiRegenerating, setIsAiRegenerating] = useState(false);
  const aiRegenerateTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (aiRegenerateTimerRef.current) {
        clearTimeout(aiRegenerateTimerRef.current);
        aiRegenerateTimerRef.current = null;
      }
    };
  }, []);

  const overallExhibitionStats = useMemo(() => {
    const toInt = (value, fallback = 0) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    };
    const parseCount = (value, fallback = 0) => {
      const m = String(value ?? '').match(/\d+/);
      return m ? Number(m[0]) : fallback;
    };
    const now = new Date();

    const perExhibition = exhibitions.map((ex, exIndex) => {
      const makers = ex.makers || [];
      const visitors = ex.visitors || [];
      const tasks = ex.tasks || [];
      const scheduleDayBefore = ex.schedule?.dayBefore || [];
      const scheduleEventDay = ex.schedule?.eventDay || [];
      const lectures = ex.lectures || [];
      const scanLogs = ex.scanLogs || [];
      const hotels = ex.hotelReservations || ex.hotels || [];
      const staffCount = String(ex.staff || '').split(',').map(s => s.trim()).filter(Boolean).length;

      const statusCounts = { listed: 0, invited: 0, confirmed: 0, declined: 0 };
      makers.forEach((maker) => {
        const normalized = normalizeMakerStatusForAnalysis(maker?.status);
        if (statusCounts[normalized] !== undefined) statusCounts[normalized] += 1;
      });

      const actionableInvites = statusCounts.invited + statusCounts.confirmed + statusCounts.declined;
      const answered = statusCounts.confirmed + statusCounts.declined;
      const responseRate = actionableInvites > 0 ? (answered / actionableInvites) * 100 : 0;
      const confirmRate = actionableInvites > 0 ? (statusCounts.confirmed / actionableInvites) * 100 : 0;
      const declineRate = actionableInvites > 0 ? (statusCounts.declined / actionableInvites) * 100 : 0;

      const checkedIn = visitors.filter(v => v.checkedIn || v.status === 'arrived').length;
      const visitorTarget = toInt(ex.targetVisitors, 0);
      const makerTarget = toInt(ex.targetMakers, 0);
      const profitTarget = toInt(ex.targetProfit, 0);

      const taskDone = tasks.filter(t => t.status === 'done').length;
      const taskRate = tasks.length > 0 ? (taskDone / tasks.length) * 100 : 0;
      const scheduleCount = scheduleDayBefore.length + scheduleEventDay.length;

      const feePerBooth = toInt(ex.formConfig?.settings?.feePerBooth, 30000);
      const boothIncome = makers
        .filter(m => normalizeMakerStatusForAnalysis(m?.status) === 'confirmed')
        .reduce((sum, maker) => {
          const boothCountRaw = getMakerField(maker, 'boothCount') || maker.boothCount || 0;
          return sum + (parseCount(boothCountRaw, 0) * feePerBooth);
        }, 0);
      const otherIncomes = (ex.otherBudgets || []).filter(b => b.type === 'income').reduce((sum, b) => sum + toInt(b.amount, 0), 0);
      const venueCost = toInt(ex.venueDetails?.cost, 0);
      const equipmentTotal = (ex.venueDetails?.equipment || []).reduce((sum, item) => sum + (toInt(item.count, 0) * toInt(item.price, 0)), 0);
      const lectureFees = lectures.reduce((sum, l) => sum + toInt(l.speakerFee ?? l.fee, 0) + toInt(l.transportFee, 0), 0);
      const otherExpenses = (ex.otherBudgets || []).filter(b => b.type === 'expense').reduce((sum, b) => sum + toInt(b.amount, 0), 0);
      const income = boothIncome + otherIncomes;
      const expense = venueCost + equipmentTotal + lectureFees + otherExpenses;
      const profit = income - expense;

      const hasLayout = !!(ex.materials?.venue || ex.documents?.layoutPdf?.url || ex.documents?.layoutPdf?.data);
      const hasFlyer = !!(ex.materials?.flyer || ex.documents?.flyerPdf?.url || ex.documents?.flyerPdf?.data);
      const hasOtherMaterial = !!ex.materials?.other;
      const docScore = (hasLayout ? 1 : 0) + (hasFlyer ? 1 : 0) + (hasOtherMaterial ? 1 : 0);

      const deadlineRaw = ex.formConfig?.settings?.deadline || ex.formConfig?.deadline || null;
      const deadline = deadlineRaw ? new Date(deadlineRaw) : null;
      const hasPastDeadlinePending = !!(deadline && !Number.isNaN(deadline.getTime()) && deadline < now && statusCounts.invited > 0);

      const exName = ex.title || `展示会#${exIndex + 1}`;
      return {
        id: ex.id || `ex-${exIndex}`,
        name: exName,
        date: ex.dates?.[0] || '',
        visitors: visitors.length,
        checkedIn,
        visitorTarget,
        confirmedMakers: statusCounts.confirmed,
        makerTarget,
        listedMakers: statusCounts.listed,
        invitedMakers: statusCounts.invited,
        declinedMakers: statusCounts.declined,
        actionableInvites,
        responseRate,
        confirmRate,
        declineRate,
        taskCount: tasks.length,
        taskDone,
        taskRate,
        scheduleCount,
        lecturesCount: lectures.length,
        scanCount: scanLogs.length,
        hotelsCount: hotels.length,
        staffCount,
        docScore,
        hasLayout,
        hasFlyer,
        hasOtherMaterial,
        hasPastDeadlinePending,
        income,
        expense,
        profit,
        profitTarget
      };
    });

    const totals = perExhibition.reduce((acc, ex) => {
      acc.visitors += ex.visitors;
      acc.checkedIn += ex.checkedIn;
      acc.confirmedMakers += ex.confirmedMakers;
      acc.listedMakers += ex.listedMakers;
      acc.invitedMakers += ex.invitedMakers;
      acc.declinedMakers += ex.declinedMakers;
      acc.actionableInvites += ex.actionableInvites;
      acc.tasks += ex.taskCount;
      acc.tasksDone += ex.taskDone;
      acc.scheduleItems += ex.scheduleCount;
      acc.scanLogs += ex.scanCount;
      acc.lectures += ex.lecturesCount;
      acc.staff += ex.staffCount;
      acc.hotels += ex.hotelsCount;
      acc.docsScore += ex.docScore;
      acc.docsComplete += ex.docScore >= 2 ? 1 : 0;
      acc.pendingAfterDeadline += ex.hasPastDeadlinePending ? 1 : 0;
      acc.income += ex.income;
      acc.expense += ex.expense;
      acc.profit += ex.profit;
      if (ex.visitorTarget > 0) {
        acc.targetVisitorsSet += 1;
        if (ex.checkedIn >= ex.visitorTarget) acc.targetVisitorsAchieved += 1;
      }
      if (ex.makerTarget > 0) {
        acc.targetMakersSet += 1;
        if (ex.confirmedMakers >= ex.makerTarget) acc.targetMakersAchieved += 1;
      }
      if (ex.profitTarget > 0) {
        acc.targetProfitSet += 1;
        if (ex.profit >= ex.profitTarget) acc.targetProfitAchieved += 1;
      }
      return acc;
    }, {
      visitors: 0,
      checkedIn: 0,
      confirmedMakers: 0,
      listedMakers: 0,
      invitedMakers: 0,
      declinedMakers: 0,
      actionableInvites: 0,
      tasks: 0,
      tasksDone: 0,
      scheduleItems: 0,
      scanLogs: 0,
      lectures: 0,
      staff: 0,
      hotels: 0,
      docsScore: 0,
      docsComplete: 0,
      pendingAfterDeadline: 0,
      income: 0,
      expense: 0,
      profit: 0,
      targetVisitorsSet: 0,
      targetVisitorsAchieved: 0,
      targetMakersSet: 0,
      targetMakersAchieved: 0,
      targetProfitSet: 0,
      targetProfitAchieved: 0
    });

    const rates = {
      checkinRate: totals.visitors > 0 ? (totals.checkedIn / totals.visitors) * 100 : 0,
      responseRate: totals.actionableInvites > 0 ? ((totals.confirmedMakers + totals.declinedMakers) / totals.actionableInvites) * 100 : 0,
      declineRate: totals.actionableInvites > 0 ? (totals.declinedMakers / totals.actionableInvites) * 100 : 0,
      confirmRate: totals.actionableInvites > 0 ? (totals.confirmedMakers / totals.actionableInvites) * 100 : 0,
      taskDoneRate: totals.tasks > 0 ? (totals.tasksDone / totals.tasks) * 100 : 0,
      docsCompleteRate: exhibitions.length > 0 ? (totals.docsComplete / exhibitions.length) * 100 : 0
    };

    return { perExhibition, totals, rates };
  }, [exhibitions]);

  // AI統合分析（全展示会データ横断）
  const aiIntegratedReport = useMemo(() => {
    const { perExhibition, totals, rates } = overallExhibitionStats;
    const topProfit = [...perExhibition].sort((a, b) => b.profit - a.profit).slice(0, 3);
    const weakResponse = [...perExhibition]
      .filter(ex => ex.actionableInvites >= 3)
      .sort((a, b) => a.responseRate - b.responseRate)
      .slice(0, 3);

    const executiveSummary = [
      `全${exhibitions.length}展示会の統合分析。来場登録${totals.visitors}名、来場済み${totals.checkedIn}名（来場率${rates.checkinRate.toFixed(1)}%）。`,
      `招待母数${totals.actionableInvites}件に対して、参加確定率${rates.confirmRate.toFixed(1)}%、辞退率${rates.declineRate.toFixed(1)}%、回答率${rates.responseRate.toFixed(1)}%。`,
      `全体収支は 収入¥${totals.income.toLocaleString()} / 支出¥${totals.expense.toLocaleString()} / 収支¥${totals.profit.toLocaleString()}。`,
      `主要資料（レイアウト・チラシ）が揃う展示会比率は${rates.docsCompleteRate.toFixed(1)}%（${totals.docsComplete}/${exhibitions.length || 0}件）。`,
      `タスク完了率は${rates.taskDoneRate.toFixed(1)}%（${totals.tasksDone}/${totals.tasks}件）、期限超過未回答の展示会は${totals.pendingAfterDeadline}件。`
    ];

    const risks = [];
    if (totals.pendingAfterDeadline > 0) {
      risks.push({ score: 95, title: '回答期限超過の未回答企業が残存', detail: `${totals.pendingAfterDeadline}展示会で、期限経過後も「招待中」が残っています。` });
    }
    if (rates.responseRate < 60 && totals.actionableInvites >= 10) {
      risks.push({ score: 88, title: '招待回答率が低い', detail: `回答率が${rates.responseRate.toFixed(1)}%です。回答導線とリマインド間隔の再設計が必要です。` });
    }
    if (rates.declineRate >= 35 && totals.actionableInvites >= 10) {
      risks.push({ score: 82, title: '辞退率が高い', detail: `辞退率が${rates.declineRate.toFixed(1)}%です。対象選定基準の見直し余地があります。` });
    }
    if (rates.docsCompleteRate < 65 && exhibitions.length > 0) {
      risks.push({ score: 74, title: '資料整備のばらつき', detail: `資料整備率が${rates.docsCompleteRate.toFixed(1)}%で、展示会ごとの品質差があります。` });
    }
    if (rates.taskDoneRate < 70 && totals.tasks >= 20) {
      risks.push({ score: 70, title: 'タスク完了率が低い', detail: `全体タスク完了率が${rates.taskDoneRate.toFixed(1)}%です。進行管理の強化が必要です。` });
    }
    risks.sort((a, b) => b.score - a.score);

    const opportunities = [];
    if (topProfit.length > 0) {
      const lead = topProfit[0];
      opportunities.push(`最も収支が良い展示会は「${lead.name}」（¥${lead.profit.toLocaleString()}）。同条件（会場/対象企業/出展費）を横展開する価値があります。`);
    }
    if (weakResponse.length > 0) {
      opportunities.push(`回答率が低い展示会（例: ${weakResponse.map(x => x.name).join(' / ')}）は、回答期限前の個別連絡で改善余地があります。`);
    }
    if (totals.targetVisitorsSet > 0) {
      opportunities.push(`来場目標達成は ${totals.targetVisitorsAchieved}/${totals.targetVisitorsSet} 件。未達展示会の集客施策をテンプレ化できます。`);
    }
    if (totals.scanLogs > 0 && totals.confirmedMakers > 0) {
      opportunities.push(`スキャンログ${totals.scanLogs}件が蓄積。企業別の商談量と次回出展率を紐づけると、招待精度が上がります。`);
    }

    const actions = [];
    if (totals.pendingAfterDeadline > 0) actions.push('締切当日夜に自動で「招待中」を一括クローズし、辞退確定へ遷移する運用を固定化する。');
    if (rates.responseRate < 60) actions.push('回答期限7日前/3日前/前日の3段階リマインドを標準化し、未回答企業へ担当者電話を連携する。');
    if (rates.declineRate >= 35) actions.push('辞退率上位企業は次回招待前に参加条件確認を実施し、対象企業リストを優先度別に再編する。');
    if (rates.docsCompleteRate < 65) actions.push('資料（レイアウト・チラシ）公開チェックリストを追加し、公開漏れをゼロ化する。');
    if (rates.taskDoneRate < 70) actions.push('進行タスクを週次で強制棚卸しし、担当未設定・期限未設定タスクを禁止する。');
    if (actions.length === 0) actions.push('主要KPIは安定。高収支展示会の再現性を高める標準運用書を作成してください。');

    return {
      generatedAt: aiReportGeneratedAt,
      executiveSummary,
      risks: risks.slice(0, 5),
      opportunities: opportunities.slice(0, 5),
      actions: actions.slice(0, 7),
      kpi: {
        responseRate: rates.responseRate.toFixed(1),
        declineRate: rates.declineRate.toFixed(1),
        confirmRate: rates.confirmRate.toFixed(1),
        taskDoneRate: rates.taskDoneRate.toFixed(1),
        docsCompleteRate: rates.docsCompleteRate.toFixed(1)
      }
    };
  }, [aiReportGeneratedAt, exhibitions.length, overallExhibitionStats]);

  const makerStrategyReport = useMemo(() => {
    const companies = [...companyPerformanceStats].filter((company) => company.invited > 0);
    const totals = companies.reduce((acc, company) => {
      acc.invited += company.invited;
      acc.confirmed += company.confirmed;
      acc.declined += company.declined;
      return acc;
    }, { invited: 0, confirmed: 0, declined: 0 });

    const participationRate = totals.invited > 0 ? Number(((totals.confirmed / totals.invited) * 100).toFixed(1)) : 0;
    const declineRate = totals.invited > 0 ? Number(((totals.declined / totals.invited) * 100).toFixed(1)) : 0;

    const strategyLabel = (company) => {
      if (company.invited >= 3 && company.declineRate >= 50) return '要因ヒアリング後に再招待';
      if (company.confirmed >= 3 && company.participationRate >= 70) return '先行招待＋ブース拡張提案';
      if (company.confirmed === 0 && company.invited >= 3) return '招待優先度を下げて保留';
      if (company.participationRate >= 50) return '通常招待＋追加提案';
      return '個別フォローで参加可否確認';
    };

    const topParticipants = [...companies]
      .sort((a, b) => b.confirmed - a.confirmed || b.participationRate - a.participationRate || a.name.localeCompare(b.name, 'ja'))
      .slice(0, 30)
      .map((company) => ({
        ...company,
        strategy: strategyLabel(company)
      }));

    const highDecliners = [...companies]
      .filter((company) => company.invited >= 2)
      .sort((a, b) => b.declineRate - a.declineRate || b.declined - a.declined || b.invited - a.invited || a.name.localeCompare(b.name, 'ja'))
      .slice(0, 30)
      .map((company) => ({
        ...company,
        strategy: strategyLabel(company)
      }));

    const segmentCounts = companies.reduce((acc, company) => {
      if (company.invited >= 3 && company.declineRate >= 50) acc.caution += 1;
      else if (company.confirmed >= 3 && company.participationRate >= 70 && company.declineRate <= 20) acc.core += 1;
      else if (company.confirmed > 0) acc.growth += 1;
      else acc.dormant += 1;
      return acc;
    }, { core: 0, growth: 0, caution: 0, dormant: 0 });

    const coreFocus = topParticipants
      .filter((company) => company.confirmed >= 3 && company.participationRate >= 70 && company.declineRate <= 25)
      .slice(0, 5);
    const cautionFocus = highDecliners
      .filter((company) => company.invited >= 3 && company.declined >= 2)
      .slice(0, 5);
    const dormantFocus = [...companies]
      .filter((company) => company.invited >= 3 && company.confirmed === 0)
      .sort((a, b) => b.invited - a.invited || b.declined - a.declined || a.name.localeCompare(b.name, 'ja'))
      .slice(0, 5);

    const executiveSummary = [
      `対象${companies.length}社の招待実績を分析。招待${totals.invited}回、出展${totals.confirmed}回、辞退${totals.declined}回。`,
      `全社平均の出展率は${participationRate.toFixed(1)}%、辞退率は${declineRate.toFixed(1)}%。`,
      `重点育成${segmentCounts.core}社 / 成長余地${segmentCounts.growth}社 / 辞退高リスク${segmentCounts.caution}社 / 休眠${segmentCounts.dormant}社。`
    ];

    const policyRecommendations = [];
    if (coreFocus.length > 0) {
      policyRecommendations.push(`重点育成候補（${coreFocus.map((x) => x.name).join(' / ')}）には先行招待とブース拡張提案を実施する。`);
    }
    if (cautionFocus.length > 0) {
      policyRecommendations.push(`辞退高リスク（${cautionFocus.map((x) => x.name).join(' / ')}）は、次回招待前に不参加要因ヒアリングを必須化する。`);
    }
    if (dormantFocus.length > 0) {
      policyRecommendations.push(`連続未出展（${dormantFocus.map((x) => x.name).join(' / ')}）は、招待頻度と優先度を見直して母集団を再編する。`);
    }
    if (policyRecommendations.length === 0) {
      policyRecommendations.push('現状は分布が安定。出展率上位企業の成功要因をテンプレート化して横展開する。');
    }

    const nextActions = [];
    if (segmentCounts.caution > 0) nextActions.push('辞退率50%以上かつ招待3回以上の企業を次回招待前にレビューし、個別連絡で条件調整する。');
    if (segmentCounts.core > 0) nextActions.push('出展上位企業に対して、次回展示会の先行案内と追加コマ提案を標準運用に組み込む。');
    if (segmentCounts.dormant > 0) nextActions.push('3回以上招待で未出展の企業は、優先度を下げた再分類リストへ移して招待効率を改善する。');
    if (nextActions.length === 0) nextActions.push('主要企業群は健全。現行の招待運用を維持しつつ、来場成果データと連携した精度改善を進める。');

    return {
      generatedAt: aiReportGeneratedAt,
      totals: {
        companies: companies.length,
        invited: totals.invited,
        confirmed: totals.confirmed,
        declined: totals.declined
      },
      kpi: {
        participationRate,
        declineRate
      },
      segmentCounts,
      executiveSummary,
      policyRecommendations: policyRecommendations.slice(0, 5),
      nextActions: nextActions.slice(0, 5),
      topParticipants,
      highDecliners
    };
  }, [aiReportGeneratedAt, companyPerformanceStats]);

  const formatReportTimestamp = (ts) => {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '-';
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const handleRegenerateAiReport = () => {
    if (isAiRegenerating) return;
    setIsAiRegenerating(true);
    if (aiRegenerateTimerRef.current) {
      clearTimeout(aiRegenerateTimerRef.current);
    }
    aiRegenerateTimerRef.current = setTimeout(() => {
      setAiReportGeneratedAt(Date.now());
      setAiReportRevision((prev) => prev + 1);
      setIsAiRegenerating(false);
      aiRegenerateTimerRef.current = null;
    }, 250);
  };

  const handleExportAiReport = () => {
    const header = `# AI統合分析レポート\n- 生成日時: ${formatReportTimestamp(aiIntegratedReport.generatedAt)}\n- 対象展示会: ${exhibitions.length}件\n`;
    const kpi = `\n## KPI\n- 回答率: ${aiIntegratedReport.kpi.responseRate}%\n- 参加確定率: ${aiIntegratedReport.kpi.confirmRate}%\n- 辞退率: ${aiIntegratedReport.kpi.declineRate}%\n- タスク完了率: ${aiIntegratedReport.kpi.taskDoneRate}%\n- 資料整備率: ${aiIntegratedReport.kpi.docsCompleteRate}%\n`;
    const summary = `\n## サマリー\n${aiIntegratedReport.executiveSummary.map((x) => `- ${x}`).join('\n')}\n`;
    const risks = `\n## 主要リスク\n${aiIntegratedReport.risks.map((x) => `- [${x.score}] ${x.title}: ${x.detail}`).join('\n')}\n`;
    const opportunities = `\n## 改善機会\n${aiIntegratedReport.opportunities.map((x) => `- ${x}`).join('\n')}\n`;
    const actions = `\n## 推奨アクション\n${aiIntegratedReport.actions.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n`;
    const body = `${header}${kpi}${summary}${risks}${opportunities}${actions}`;
    const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' });
    const now = new Date();
    const fileName = `AI統合分析レポート_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.md`;
    saveAs(blob, fileName);
  };

  const handleExportMakerStrategyReport = () => {
    const report = makerStrategyReport;
    const header = `# 出展メーカー戦略レポート\n- 生成日時: ${formatReportTimestamp(report.generatedAt)}\n- 対象企業数: ${report.totals.companies}社\n`;
    const kpi = `\n## KPI\n- 招待回数合計: ${report.totals.invited}回\n- 出展回数合計: ${report.totals.confirmed}回\n- 辞退回数合計: ${report.totals.declined}回\n- 平均出展率: ${report.kpi.participationRate.toFixed(1)}%\n- 平均辞退率: ${report.kpi.declineRate.toFixed(1)}%\n`;
    const segments = `\n## セグメント\n- 重点育成: ${report.segmentCounts.core}社\n- 成長余地: ${report.segmentCounts.growth}社\n- 辞退高リスク: ${report.segmentCounts.caution}社\n- 休眠: ${report.segmentCounts.dormant}社\n`;
    const summary = `\n## サマリー\n${report.executiveSummary.map((x) => `- ${x}`).join('\n')}\n`;
    const policy = `\n## 方針提案\n${report.policyRecommendations.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n`;
    const actions = `\n## 次回アクション\n${report.nextActions.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n`;
    const top = `\n## 出展回数上位企業\n${report.topParticipants.slice(0, 30).map((company, i) => `${i + 1}. ${company.name}${company.code ? ` (code:${company.code})` : ''} / 出展:${company.confirmed} / 招待:${company.invited} / 辞退率:${company.declineRate.toFixed(1)}% / 方針:${company.strategy}`).join('\n')}\n`;
    const decline = `\n## 辞退率上位企業\n${report.highDecliners.slice(0, 30).map((company, i) => `${i + 1}. ${company.name}${company.code ? ` (code:${company.code})` : ''} / 招待:${company.invited} / 辞退:${company.declined} / 辞退率:${company.declineRate.toFixed(1)}% / 方針:${company.strategy}`).join('\n')}\n`;
    const body = `${header}${kpi}${segments}${summary}${policy}${actions}${top}${decline}`;
    const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' });
    const now = new Date();
    const fileName = `出展メーカー戦略レポート_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.md`;
    saveAs(blob, fileName);
  };

  // 講演会一覧
  const allLectures = useMemo(() => {
    const lectures = [];
    exhibitions.forEach(ex => {
      (ex.lectures || []).forEach(l => {
        lectures.push({
          ...l,
          exhibitionTitle: ex.title,
          exhibitionDate: ex.dates?.[0] || '日付未定'
        });
      });
    });
    return lectures.sort((a, b) => new Date(b.exhibitionDate) - new Date(a.exhibitionDate));
  }, [exhibitions]);

  // チャート用カラー
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <TrendingUp className="text-blue-600" size={32} />
            実績分析
          </h2>
          <p className="text-slate-500 mt-1">全展示会の実績データを一括で分析・表示</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-lg border">
          <Calendar size={16} />
          対象: {exhibitions.length}件の展示会
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg">
          <p className="text-blue-100 text-sm font-bold mb-1">総収支（累計）</p>
          <p className="text-3xl font-bold">¥{getYearlyStats.reduce((s, y) => s + y.profit, 0).toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-xl p-6 shadow-lg">
          <p className="text-emerald-100 text-sm font-bold mb-1">総来場者数</p>
          <p className="text-3xl font-bold">{totalVisitors.toLocaleString()}名</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-xl p-6 shadow-lg">
          <p className="text-amber-100 text-sm font-bold mb-1">来場済み</p>
          <p className="text-3xl font-bold">{checkedInVisitors.toLocaleString()}名</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
          <p className="text-purple-100 text-sm font-bold mb-1">開催講演会</p>
          <p className="text-3xl font-bold">{allLectures.length}件</p>
        </div>
      </div>

      {/* AI Integrated Analysis */}
      <div className="bg-gradient-to-r from-indigo-50 via-sky-50 to-cyan-50 rounded-xl border border-indigo-100 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Wand2 className="text-indigo-600" size={20} />
            AI統合分析レポート
            <span className="text-xs font-normal text-slate-500">全展示会データ横断（実績・招待・収支・運営）</span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerateAiReport}
              disabled={isAiRegenerating}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 ${isAiRegenerating ? 'border-indigo-100 bg-indigo-50 text-indigo-400 cursor-not-allowed' : 'border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50'}`}
            >
              <RefreshCw size={13} className={isAiRegenerating ? 'animate-spin' : ''} />
              {isAiRegenerating ? '再生成中...' : '再生成'}
            </button>
            <button onClick={handleExportAiReport} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-50">
              Markdown出力
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-4">最終生成: {formatReportTimestamp(aiIntegratedReport.generatedAt)} / 生成回数: {aiReportRevision}回</p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="bg-white/80 border border-indigo-100 rounded-lg p-3"><p className="text-[11px] text-slate-500">回答率</p><p className="text-lg font-bold text-slate-800">{aiIntegratedReport.kpi.responseRate}%</p></div>
          <div className="bg-white/80 border border-indigo-100 rounded-lg p-3"><p className="text-[11px] text-slate-500">参加確定率</p><p className="text-lg font-bold text-slate-800">{aiIntegratedReport.kpi.confirmRate}%</p></div>
          <div className="bg-white/80 border border-indigo-100 rounded-lg p-3"><p className="text-[11px] text-slate-500">辞退率</p><p className="text-lg font-bold text-slate-800">{aiIntegratedReport.kpi.declineRate}%</p></div>
          <div className="bg-white/80 border border-indigo-100 rounded-lg p-3"><p className="text-[11px] text-slate-500">タスク完了率</p><p className="text-lg font-bold text-slate-800">{aiIntegratedReport.kpi.taskDoneRate}%</p></div>
          <div className="bg-white/80 border border-indigo-100 rounded-lg p-3"><p className="text-[11px] text-slate-500">資料整備率</p><p className="text-lg font-bold text-slate-800">{aiIntegratedReport.kpi.docsCompleteRate}%</p></div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="bg-white/80 rounded-lg border border-indigo-100 p-4">
            <p className="text-sm font-bold text-slate-700 mb-2">エグゼクティブサマリー</p>
            <div className="space-y-2">
              {aiIntegratedReport.executiveSummary.map((line, idx) => (
                <p key={idx} className="text-sm text-slate-700 leading-relaxed">{line}</p>
              ))}
            </div>
          </div>
          <div className="bg-white/80 rounded-lg border border-red-100 p-4">
            <p className="text-sm font-bold text-slate-700 mb-2">主要リスク</p>
            <div className="space-y-2">
              {aiIntegratedReport.risks.length === 0 && <p className="text-sm text-slate-500">重大リスクは検知されませんでした。</p>}
              {aiIntegratedReport.risks.map((risk, idx) => (
                <div key={idx} className="rounded-md border border-red-100 bg-red-50/60 p-2">
                  <p className="text-xs font-bold text-red-700">Severity {risk.score}</p>
                  <p className="text-sm font-bold text-slate-800">{risk.title}</p>
                  <p className="text-xs text-slate-600 mt-1">{risk.detail}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white/80 rounded-lg border border-cyan-100 p-4">
            <p className="text-sm font-bold text-slate-700 mb-2">推奨アクション</p>
            <div className="space-y-2">
              {aiIntegratedReport.actions.map((line, idx) => (
                <p key={idx} className="text-sm text-slate-700 leading-relaxed">{idx + 1}. {line}</p>
              ))}
            </div>
            {aiIntegratedReport.opportunities.length > 0 && (
              <div className="mt-4 pt-3 border-t border-cyan-100 space-y-2">
                <p className="text-sm font-bold text-slate-700">改善機会</p>
                {aiIntegratedReport.opportunities.map((line, idx) => (
                  <p key={idx} className="text-xs text-slate-600 leading-relaxed">- {line}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Maker Strategy Report */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-xl border border-emerald-100 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="text-emerald-600" size={20} />
            出展メーカー戦略レポート
            <span className="text-xs font-normal text-slate-500">出展回数・辞退率・次回方針</span>
          </h3>
          <button onClick={handleExportMakerStrategyReport} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50">
            Markdown出力
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">最終生成: {formatReportTimestamp(makerStrategyReport.generatedAt)}</p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="bg-white/80 border border-emerald-100 rounded-lg p-3"><p className="text-[11px] text-slate-500">対象企業数</p><p className="text-lg font-bold text-slate-800">{makerStrategyReport.totals.companies}社</p></div>
          <div className="bg-white/80 border border-emerald-100 rounded-lg p-3"><p className="text-[11px] text-slate-500">招待回数合計</p><p className="text-lg font-bold text-slate-800">{makerStrategyReport.totals.invited}回</p></div>
          <div className="bg-white/80 border border-emerald-100 rounded-lg p-3"><p className="text-[11px] text-slate-500">出展回数合計</p><p className="text-lg font-bold text-slate-800">{makerStrategyReport.totals.confirmed}回</p></div>
          <div className="bg-white/80 border border-emerald-100 rounded-lg p-3"><p className="text-[11px] text-slate-500">平均出展率</p><p className="text-lg font-bold text-slate-800">{makerStrategyReport.kpi.participationRate.toFixed(1)}%</p></div>
          <div className="bg-white/80 border border-emerald-100 rounded-lg p-3"><p className="text-[11px] text-slate-500">平均辞退率</p><p className="text-lg font-bold text-slate-800">{makerStrategyReport.kpi.declineRate.toFixed(1)}%</p></div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
          <div className="bg-white/80 rounded-lg border border-emerald-100 p-4">
            <p className="text-sm font-bold text-slate-700 mb-2">サマリー</p>
            <div className="space-y-2">
              {makerStrategyReport.executiveSummary.map((line, idx) => (
                <p key={idx} className="text-sm text-slate-700 leading-relaxed">{line}</p>
              ))}
            </div>
          </div>
          <div className="bg-white/80 rounded-lg border border-emerald-100 p-4">
            <p className="text-sm font-bold text-slate-700 mb-2">方針提案</p>
            <div className="space-y-2">
              {makerStrategyReport.policyRecommendations.map((line, idx) => (
                <p key={idx} className="text-sm text-slate-700 leading-relaxed">{idx + 1}. {line}</p>
              ))}
            </div>
          </div>
          <div className="bg-white/80 rounded-lg border border-emerald-100 p-4">
            <p className="text-sm font-bold text-slate-700 mb-2">次回アクション</p>
            <div className="space-y-2">
              {makerStrategyReport.nextActions.map((line, idx) => (
                <p key={idx} className="text-sm text-slate-700 leading-relaxed">{idx + 1}. {line}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white/80 rounded-lg border border-emerald-100 p-4">
            <p className="text-sm font-bold text-slate-700 mb-3">出展回数 上位10社</p>
            <div className="space-y-2">
              {makerStrategyReport.topParticipants.slice(0, 10).map((company, idx) => (
                <div key={company.key || idx} className="rounded-md border border-slate-100 bg-white p-2">
                  <p className="text-sm font-bold text-slate-800">{idx + 1}. {company.name}</p>
                  <p className="text-xs text-slate-600 mt-0.5">出展:{company.confirmed}回 / 招待:{company.invited}回 / 辞退率:{company.declineRate.toFixed(1)}%</p>
                  <p className="text-xs text-emerald-700 mt-1">方針: {company.strategy}</p>
                </div>
              ))}
              {makerStrategyReport.topParticipants.length === 0 && <p className="text-sm text-slate-500">対象データがありません。</p>}
            </div>
          </div>
          <div className="bg-white/80 rounded-lg border border-emerald-100 p-4">
            <p className="text-sm font-bold text-slate-700 mb-3">辞退率 高位10社（招待2回以上）</p>
            <div className="space-y-2">
              {makerStrategyReport.highDecliners.slice(0, 10).map((company, idx) => (
                <div key={company.key || idx} className="rounded-md border border-slate-100 bg-white p-2">
                  <p className="text-sm font-bold text-slate-800">{idx + 1}. {company.name}</p>
                  <p className="text-xs text-slate-600 mt-0.5">招待:{company.invited}回 / 辞退:{company.declined}回 / 辞退率:{company.declineRate.toFixed(1)}%</p>
                  <p className="text-xs text-emerald-700 mt-1">方針: {company.strategy}</p>
                </div>
              ))}
              {makerStrategyReport.highDecliners.length === 0 && <p className="text-sm text-slate-500">対象データがありません。</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Yearly Revenue Section */}
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Wallet className="text-blue-500" size={20} />
          年度別収支サマリー
        </h3>
        {getYearlyStats.length === 0 ? (
          <p className="text-slate-400 text-center py-8">データがありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left p-3 font-bold text-slate-600">年度</th>
                  <th className="text-right p-3 font-bold text-slate-600">開催数</th>
                  <th className="text-right p-3 font-bold text-slate-600">来場者</th>
                  <th className="text-right p-3 font-bold text-blue-600">収入</th>
                  <th className="text-right p-3 font-bold text-red-600">支出</th>
                  <th className="text-right p-3 font-bold text-slate-800">収支</th>
                </tr>
              </thead>
              <tbody>
                {getYearlyStats.map((row, idx) => (
                  <tr key={idx} className="border-b hover:bg-slate-50">
                    <td className="p-3 font-bold">{row.year}</td>
                    <td className="p-3 text-right">{row.exhibitions}件</td>
                    <td className="p-3 text-right">{row.visitors.toLocaleString()}名</td>
                    <td className="p-3 text-right text-blue-600 font-bold">¥{row.income.toLocaleString()}</td>
                    <td className="p-3 text-right text-red-600 font-bold">¥{row.expense.toLocaleString()}</td>
                    <td className={`p-3 text-right font-bold ${row.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      ¥{row.profit.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visitor Attributes */}
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Users className="text-emerald-500" size={20} />
            来場者属性
          </h3>
          {visitorAttributes.length === 0 ? (
            <p className="text-slate-400 text-center py-8">データがありません</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                <PieChart>
                  <Pie
                    data={visitorAttributes}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {visitorAttributes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Company Ranking */}
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Trophy className="text-amber-500" size={20} />
            参加企業ランキング TOP30
          </h3>
          {companyRanking.length === 0 ? (
            <p className="text-slate-400 text-center py-8">データがありません</p>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2">
              {companyRanking.map((company, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                  <span className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${idx < 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{company.name}</p>
                    {company.code && <p className="text-[11px] text-slate-400 font-mono truncate">code: {company.code}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-blue-600 font-bold">{company.count}回</p>
                    <p className="text-[11px] text-slate-400">招待:{company.invited} / 辞退:{company.declined}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Decline Rate Ranking */}
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <UserX className="text-red-500" size={20} />
          辞退割合が高い企業 TOP30
          <span className="text-xs font-normal text-slate-400 ml-2">※招待数3回以上の企業のみ</span>
        </h3>
        {declineRanking.length === 0 ? (
          <p className="text-slate-400 text-center py-8">該当データがありません</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b bg-slate-50">
                  <th className="text-left p-3 font-bold text-slate-600 w-12">順位</th>
                  <th className="text-left p-3 font-bold text-slate-600">企業名</th>
                  <th className="text-right p-3 font-bold text-slate-600">招待回数</th>
                  <th className="text-right p-3 font-bold text-slate-600">辞退回数</th>
                  <th className="text-right p-3 font-bold text-slate-600">辞退率</th>
                </tr>
              </thead>
              <tbody>
                {declineRanking.map((company, idx) => (
                  <tr key={idx} className="border-b hover:bg-slate-50">
                    <td className="p-3">
                      <span className={`w-8 h-8 inline-flex items-center justify-center rounded-full font-bold text-sm ${idx < 3 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="p-3">
                      <p className="font-medium truncate max-w-[220px]">{company.name}</p>
                      {company.code && <p className="text-[11px] text-slate-400 font-mono truncate max-w-[220px]">code: {company.code}</p>}
                    </td>
                    <td className="p-3 text-right">{company.invited}回</td>
                    <td className="p-3 text-right text-red-600 font-bold">{company.declined}回</td>
                    <td className="p-3 text-right">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${parseFloat(company.rate) >= 50 ? 'bg-red-100 text-red-700' : parseFloat(company.rate) >= 30 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        {company.rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lecture Details */}
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Mic className="text-purple-500" size={20} />
          講演会詳細一覧
        </h3>
        {allLectures.length === 0 ? (
          <p className="text-slate-400 text-center py-8">講演会データがありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left p-3 font-bold text-slate-600">展示会</th>
                  <th className="text-left p-3 font-bold text-slate-600">開催日</th>
                  <th className="text-left p-3 font-bold text-slate-600">テーマ</th>
                  <th className="text-left p-3 font-bold text-slate-600">講師</th>
                  <th className="text-right p-3 font-bold text-slate-600">講演費</th>
                  <th className="text-right p-3 font-bold text-slate-600">交通費</th>
                </tr>
              </thead>
              <tbody>
                {allLectures.map((lecture, idx) => (
                  <tr key={idx} className="border-b hover:bg-slate-50">
                    <td className="p-3 font-medium truncate max-w-[150px]">{lecture.exhibitionTitle}</td>
                    <td className="p-3">{lecture.exhibitionDate}</td>
                    <td className="p-3 truncate max-w-[200px]">{lecture.theme || '-'}</td>
                    <td className="p-3">{lecture.speakerName || '-'}</td>
                    <td className="p-3 text-right">¥{(lecture.speakerFee || 0).toLocaleString()}</td>
                    <td className="p-3 text-right">¥{(lecture.transportFee || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardView({ exhibitions, onCreateClick, onCardClick, onDeleteClick, onScanClick }) {

  const [viewMode, setViewMode] = useState('large'); // large, compact, list

  // Helper to sort and calculate dates
  const sortedExhibitions = [...exhibitions].sort((a, b) => {
    const dateA = a.dates && a.dates[0] ? new Date(a.dates[0]) : new Date(8640000000000000);
    const dateB = b.dates && b.dates[0] ? new Date(b.dates[0]) : new Date(8640000000000000);
    return Math.abs(dateA - new Date()) - Math.abs(dateB - new Date()); // Sort by closeness to today? Or just date? Result: Closest first.
  });

  const getDaysUntil = (dates) => {
    if (!dates || dates.length === 0) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDates = dates.map(d => new Date(d)).sort((a, b) => a - b);
    const firstDate = eventDates[0];
    const diff = Math.ceil((firstDate - today) / (1000 * 60 * 60 * 24));
    return { diff, isPast: diff < 0 && Math.ceil((eventDates[eventDates.length - 1] - today) / (1000 * 60 * 60 * 24)) < 0 };
  };



  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Projects</h2>
          <p className="text-slate-500 mt-1">現在進行中の展示会プロジェクト一覧</p>
        </div>
        <div className="flex gap-3">

          <div className="flex bg-white rounded-lg border border-slate-200 p-1 mr-2">
            <button onClick={() => setViewMode('large')} className={`p-2 rounded ${viewMode === 'large' ? 'bg-slate-100 text-blue-600' : 'text-slate-400'}`} title="大きく表示"><LayoutGrid size={18} /></button>
            <button onClick={() => setViewMode('compact')} className={`p-2 rounded ${viewMode === 'compact' ? 'bg-slate-100 text-blue-600' : 'text-slate-400'}`} title="コンパクト"><Grid size={18} /></button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded ${viewMode === 'list' ? 'bg-slate-100 text-blue-600' : 'text-slate-400'}`} title="リスト"><List size={18} /></button>
          </div>
          <button
            onClick={onCreateClick}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full shadow-lg transition-all hover:-translate-y-1 font-bold"
          >
            <Plus size={20} /> 新規展示会を作成
          </button>
        </div>
      </div>

      {/* Project Grid */}
      {exhibitions.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-300 transition-colors group cursor-pointer" onClick={onCreateClick}>
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-50 transition-colors">
            <Plus size={40} className="text-slate-300 group-hover:text-blue-500" />
          </div>
          <h3 className="text-xl font-bold text-slate-600 mb-2">プロジェクトがありません</h3>
          <p className="text-slate-400 mb-6">最初の展示会プロジェクトを作成して始めましょう</p>
          <button className="text-blue-600 font-bold hover:underline">新規作成</button>
        </div>
      ) : (
        <div className={`grid gap-6 ${viewMode === 'large' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : viewMode === 'compact' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1'}`}>
          {sortedExhibitions.map((ex) => {
            const registeredCount = ex.visitors?.length || 0;
            const visitorProgress = ex.targetVisitors > 0 ? Math.min((registeredCount / ex.targetVisitors) * 100, 100) : 0;
            // Task Rate: Completed / Total. Mocking total tasks as length of ex.tasks (if exists) or default to some logic.
            // Since tasks structure isn't fully visible, assuming ex.tasks is array of objects with 'status'.
            // If ex.tasks doesn't exist, we'll use a placeholder or random logic (since this is UI refinement).
            // Actually, let's try to be safe. If tasks undefined, show 0%.
            const totalTasks = ex.tasks?.length || 0;
            const completedTasks = ex.tasks?.filter(t => t.status === 'done').length || 0;
            const taskRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            const makerCount = ex.makers?.filter(m => m.status === 'confirmed')?.length || 0;

            const eventDateStr = ex.dates && ex.dates.length > 0 ? ex.dates[0] : null;
            const countdown = getDaysUntil(ex.dates);
            const isPast = countdown?.diff < 0 && !countdown?.isPast;

            if (viewMode === 'list') {
              return (
                <div key={ex.id} onClick={() => onCardClick(ex)} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-all cursor-pointer flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0">
                    {ex.imageUrl ? <img src={ex.imageUrl} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-slate-400"><Image size={24} /></div>}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800">{ex.title}</h3>
                    <p className="text-xs text-slate-500">{eventDateStr} @ {ex.place}</p>
                  </div>
                  <div className="flex gap-4 text-sm text-slate-600">
                    <div className="text-center"><span className="block font-bold">{registeredCount}</span><span className="text-xs text-slate-400">集客</span></div>
                    <div className="text-center"><span className="block font-bold">{taskRate}%</span><span className="text-xs text-slate-400">完了率</span></div>
                    <div className="text-center"><span className="block font-bold">{makerCount}</span><span className="text-xs text-slate-400">企業</span></div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onDeleteClick(ex.id); }} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={18} /></button>
                </div>
              );
            }

            return (
              <div
                key={ex.id}
                onClick={() => onCardClick(ex)}
                className={`group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden flex flex-col relative transform hover:-translate-y-1 ${ex.isPast ? 'opacity-75 grayscale' : ''}`}
              >
                {/* Actions & QR */}
                <div className="absolute top-3 right-3 z-10 flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); if (onScanClick) onScanClick(ex); }}
                    className="bg-white/95 backdrop-blur px-4 py-2.5 rounded-xl hover:bg-slate-800 hover:text-white text-blue-600 transition-all shadow-lg text-sm font-bold flex items-center gap-2 border border-blue-100 hover:border-slate-800 transform hover:scale-105"
                    title="QR受付"
                  >
                    <ScanLine size={18} /> QR受付
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteClick(ex.id); }}
                    className="bg-white/90 backdrop-blur p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors shadow-sm"
                    title="プロジェクトを削除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Countdown Badge */}
                {countdown && (
                  <div className={`absolute top-3 left-3 z-10 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md flex items-center gap-1 ${ex.isPast ? 'bg-slate-600 text-white' :
                    countdown.diff <= 0 ? 'bg-red-600 text-white animate-pulse' :
                      countdown.diff <= 7 ? 'bg-orange-500 text-white' :
                        'bg-blue-600 text-white'
                    }`}>
                    <Clock size={12} />
                    {ex.isPast ? '開催終了' : countdown.diff <= 0 ? '本日開催' : `あと${countdown.diff}日`}
                  </div>
                )}

                {/* Cover Image with Overlay */}
                <div className="h-48 bg-slate-200 relative overflow-hidden">
                  {ex.imageUrl ? (
                    <img src={ex.imageUrl} alt={ex.place} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300">
                      <Image size={48} />
                    </div>
                  )}
                  {/* Overlay: Venue/Prefecture Only */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent flex items-end p-4">
                    <p className="text-white font-bold flex items-center gap-1 text-sm shadow-sm">
                      <MapPin size={14} />
                      {(() => {
                        const address = ex.venueAddress || '';
                        const prefMatch = address.match(/(.{2,3}?[都道府県])/);
                        const prefecture = prefMatch ? prefMatch[0] : '';
                        return prefecture ? `${prefecture}・${ex.place}` : ex.place || '会場未定';
                      })()}
                    </p>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 flex-1 flex flex-col gap-3">
                  {/* Title */}
                  <h3 className="text-xl font-bold text-slate-800 leading-tight line-clamp-2 hover:text-blue-600 transition-colors">{ex.title}</h3>

                  {/* Date & Tags */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="flex items-center gap-1 text-blue-600 font-bold text-sm">
                      <Calendar size={14} /> {eventDateStr || '日程未定'}
                    </span>
                    {ex.preDates?.length > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold">前日搬入あり</span>}
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold flex items-center gap-1"><Building2 size={10} /> {makerCount}社参加</span>
                    {/* 講演会ありラベル */}
                    {ex.lectures?.length > 0 && (
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                        <Mic size={10} /> 講演会あり
                      </span>
                    )}
                  </div>

                  {/* Status Metrics */}
                  <div className="mt-auto space-y-3 pt-3 border-t border-slate-100">
                    {/* Visitors */}
                    <div>
                      <div className="flex justify-between text-xs mb-1.5 items-center">
                        <span className="text-slate-500 font-bold flex items-center gap-1"><Users size={12} /> 集客目標</span>
                        <span className="font-bold text-slate-700">{registeredCount} / {ex.targetVisitors || 500}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${visitorProgress}%` }}></div>
                      </div>
                    </div>

                    {/* Task Rate */}
                    <div>
                      <div className="flex justify-between text-xs mb-1.5 items-center">
                        <span className="text-slate-500 font-bold flex items-center gap-1"><CheckSquare size={12} /> タスク完了率</span>
                        <span className="font-bold text-slate-700">{taskRate}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${taskRate}%` }}></div>
                      </div>
                    </div>

                    {/* Maker Participation Goal */}
                    <div>
                      <div className="flex justify-between text-xs mb-1.5 items-center">
                        <span className="text-slate-500 font-bold flex items-center gap-1"><Briefcase size={12} /> 参加企業数</span>
                        <span className="font-bold text-slate-700">{makerCount} / {ex.targetMakers || 0}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${ex.targetMakers > 0 ? Math.min((makerCount / ex.targetMakers) * 100, 100) : 0}%` }}></div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateExhibitionForm({ data, setData, onCancel, onSubmit }) {
  const [tempDate, setTempDate] = useState(''); const [tempPreDate, setTempPreDate] = useState(''); const [staffName, setStaffName] = useState(''); const [isFetchingImg, setIsFetchingImg] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  const handleChange = (e) => setData({ ...data, [e.target.name]: e.target.value });
  const addDate = (type) => { if (type === 'main' && tempDate) { setData({ ...data, dates: [...data.dates, tempDate].sort() }); setTempDate(''); } else if (type === 'pre' && tempPreDate) { setData({ ...data, preDates: [...data.preDates, tempPreDate].sort() }); setTempPreDate(''); } };
  const removeDate = (type, index) => { if (type === 'main') { const newDates = [...data.dates]; newDates.splice(index, 1); setData({ ...data, dates: newDates }); } else { const newPreDates = [...data.preDates]; newPreDates.splice(index, 1); setData({ ...data, preDates: newPreDates }); } };
  const addStaff = () => { if (!staffName.trim()) return; const currentStaff = data.staff ? data.staff.split(',').map(s => s.trim()) : []; setData({ ...data, staff: [...currentStaff, staffName].join(', ') }); setStaffName(''); };
  const removeStaff = (name) => { const currentStaff = data.staff ? data.staff.split(',').map(s => s.trim()) : []; setData({ ...data, staff: currentStaff.filter(s => s !== name).join(', ') }); };

  const MOCK_IMAGES = [
    // Strictly Exhibition / Trade Show / Big Venue / Convention Center
    'https://images.unsplash.com/photo-1540575467063-17e6c43d2e58?auto=format&fit=crop&w=800&q=80', // Large Exhibition Hall
    'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=800&q=80', // Conference Hall
    'https://images.unsplash.com/photo-1596524430615-b46475ddff6e?auto=format&fit=crop&w=800&q=80', // Modern Convention Center
    'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80', // Hall Interior
    'https://images.unsplash.com/photo-1560520031-3a4dc4e9de0c?auto=format&fit=crop&w=800&q=80', // Trade Show Booths (Blur)
    'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=800&q=80', // Corporate Event Dark
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80', // Event Space Crowd
    'https://images.unsplash.com/photo-1551818255-e6e10975bc17?auto=format&fit=crop&w=800&q=80', // Convention Audience
    'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80', // Empty Trade Show Floor
    'https://images.unsplash.com/photo-1475721027767-f753c9130ae4?auto=format&fit=crop&w=800&q=80', // Keynote Stage
    'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=800&q=80', // Tech Expo
    'https://images.unsplash.com/photo-1561489413-985b06da5bee?auto=format&fit=crop&w=800&q=80', // Exhibition Aisle
    'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=800&q=80', // Red Seats Audience
    'https://images.unsplash.com/photo-1559223607-a43c990c364e?auto=format&fit=crop&w=800&q=80', // Panel Discussion
    'https://images.unsplash.com/photo-1582192730841-2a682d7375f9?auto=format&fit=crop&w=800&q=80', // Conference Room Large
    'https://images.unsplash.com/photo-1550305080-4e029753abcf?auto=format&fit=crop&w=800&q=80', // Walkway / Corridor
    'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=800&q=80', // Fashion Runway/Expo
    'https://images.unsplash.com/photo-1560439514-e960a3ef5019?auto=format&fit=crop&w=800&q=80', // Business Meeting Hall
    'https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?auto=format&fit=crop&w=800&q=80', // Networking Event
    'https://images.unsplash.com/photo-1596704017254-9b121068fb29?auto=format&fit=crop&w=800&q=80', // Empty Hall Light
    'https://images.unsplash.com/photo-1544531861-c0aaec1d5758?auto=format&fit=crop&w=800&q=80', // Seminar Side View
    'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=800&q=80', // Showroom
    'https://images.unsplash.com/photo-1570126618953-d437176e8c79?auto=format&fit=crop&w=800&q=80', // Corporate Venue
    'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80', // Event Space Setup
    'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&w=800&q=80', // People Networking
    'https://images.unsplash.com/photo-1505932794465-14a51f20c268?auto=format&fit=crop&w=800&q=80', // Modern Office/Lobby
    'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=800&q=80', // Co-working Hall
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80', // Digital Signage
    'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=800&q=80', // Conference Room Board
    'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80', // Strategy Meeting
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80', // Data Analytics Screen
    'https://images.unsplash.com/photo-1628348070889-cb656235b4eb?auto=format&fit=crop&w=800&q=80', // Reception Desk
    'https://images.unsplash.com/photo-1533750516457-a7f992034fec?auto=format&fit=crop&w=800&q=80', // Registration Area
    'https://images.unsplash.com/photo-1574633069187-1033411b9b6e?auto=format&fit=crop&w=800&q=80', // Sketching Event
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80', // Corporate Building
    'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80', // Concert/Crowd
    'https://images.unsplash.com/photo-1555848962-6e79363ec58f?auto=format&fit=crop&w=800&q=80', // Modern Architecture
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80', // Technology Chip/Abstract
    'https://images.unsplash.com/photo-1563986768494-4dee74395a1e?auto=format&fit=crop&w=800&q=80', // ID Badge
    'https://images.unsplash.com/photo-1591115765373-5207764f72e7?auto=format&fit=crop&w=800&q=80', // Long Corridor
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=800&q=80', // Office Interior
    'https://images.unsplash.com/photo-1565514020176-dbf2277f0c3e?auto=format&fit=crop&w=800&q=80', // Abstract Mesh
    'https://images.unsplash.com/photo-1549923746-c502d488b3ea?auto=format&fit=crop&w=800&q=80', // Conference Chairs
    'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=800&q=80', // Online Conference
    'https://images.unsplash.com/photo-1558403194-611308249627?auto=format&fit=crop&w=800&q=80', // Team Room
    'https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?auto=format&fit=crop&w=800&q=80', // Spotlight
    'https://images.unsplash.com/photo-1510074377623-8cf13fb86c08?auto=format&fit=crop&w=800&q=80', // Gold Light Abstract
    'https://images.unsplash.com/photo-1525909002-1b05e0c869d8?auto=format&fit=crop&w=800&q=80', // Colorful Booths
    'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?auto=format&fit=crop&w=800&q=80', // Discussion Table
    'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80'  // Black Background People
  ];
  const simulateFetchImage = () => { if (!data.venueUrl) return; setIsFetchingImg(true); setTimeout(() => { const random = MOCK_IMAGES[Math.floor(Math.random() * MOCK_IMAGES.length)]; setData({ ...data, imageUrl: random }); setIsFetchingImg(false); }, 1000); };

  // Validation function
  const validateAndSubmit = () => {
    const errors = [];
    if (!data.title.trim()) errors.push('展示会タイトルは必須です');
    if (!data.dates || data.dates.length === 0) errors.push('開催日を1日以上追加してください');
    if (!data.targetVisitors || data.targetVisitors <= 0) errors.push('集客目標を入力してください');
    if (!data.targetMakers || data.targetMakers <= 0) errors.push('招致メーカー目標を入力してください');
    if (!data.targetProfit || data.targetProfit <= 0) errors.push('目標利益額を入力してください');
    if (!data.staff || data.staff.split(',').filter(s => s.trim()).length === 0) errors.push('運営スタッフを1人以上追加してください');

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    onSubmit();
  };

  const RequiredLabel = ({ children }) => (
    <label className="block text-sm font-medium text-slate-600 mb-1">
      {children} <span className="text-red-500">*</span>
    </label>
  );

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-slide-up">
      <div className="bg-slate-900 p-8 text-white flex justify-between items-center"><div><h2 className="text-2xl font-bold">New Exhibition Project</h2><p className="text-slate-400">新しい展示会プロジェクトを立ち上げます</p></div><button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-full"><X size={24} /></button></div>
      <div className="p-8 space-y-8 h-[70vh] overflow-y-auto">
        {validationErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <p className="text-red-700 font-bold text-sm mb-2">以下の項目を確認してください：</p>
            <ul className="text-red-600 text-sm list-disc list-inside">
              {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}

        <section><h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4 flex items-center gap-2"><FileText className="text-blue-600" /> 基本情報</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="col-span-2"><RequiredLabel>展示会タイトル</RequiredLabel><input type="text" name="title" value={data.title} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="例：2026 未来技術展" /></div><div><RequiredLabel>開催日 (複数可)</RequiredLabel><div className="flex gap-2 mb-2"><input type="date" value={tempDate} onChange={e => setTempDate(e.target.value)} className="flex-1 p-2 border border-slate-200 rounded-lg" /><button onClick={() => addDate('main')} className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200"><Plus size={20} /></button></div><div className="flex flex-wrap gap-2">{data.dates.map((d, i) => (<span key={i} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-sm flex items-center gap-1">{d} <button onClick={() => removeDate('main', i)}><X size={12} /></button></span>))}</div></div><div><label className="block text-sm font-medium text-slate-600 mb-1">事前準備日 (複数可)</label><div className="flex gap-2 mb-2"><input type="date" value={tempPreDate} onChange={e => setTempPreDate(e.target.value)} className="flex-1 p-2 border border-slate-200 rounded-lg" /><button onClick={() => addDate('pre')} className="bg-amber-100 text-amber-600 p-2 rounded-lg hover:bg-amber-200"><Plus size={20} /></button></div><div className="flex flex-wrap gap-2">{data.preDates.map((d, i) => (<span key={i} className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-sm flex items-center gap-1">{d} <button onClick={() => removeDate('pre', i)}><X size={12} /></button></span>))}</div></div></div></section>

        <section><h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4 flex items-center gap-2"><MapPin className="text-blue-600" /> エリア・会場・Web</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-sm font-medium text-slate-600 mb-1">エリア選択</label><select name="prefecture" value={data.prefecture} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-lg bg-white"><option value="">都道府県を選択...</option>{PREFECTURES.map(group => (<optgroup key={group.region} label={group.region}>{group.prefs.map(p => <option key={p} value={p}>{p}</option>)}</optgroup>))}</select></div><div><label className="block text-sm font-medium text-slate-600 mb-1">会場名（予定）</label><input type="text" name="place" value={data.place} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-lg" placeholder="例：福岡国際センター" /></div><div className="col-span-2"><label className="block text-sm font-medium text-slate-600 mb-1">会場住所</label><input type="text" name="venueAddress" value={data.venueAddress} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-lg" placeholder="例：福岡県福岡市博多区石城町２−１" /></div><div><label className="block text-sm font-medium text-slate-600 mb-1">開場時間</label><input type="time" name="openTime" value={data.openTime} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-lg" /></div><div><label className="block text-sm font-medium text-slate-600 mb-1">閉場時間</label><input type="time" name="closeTime" value={data.closeTime} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-lg" /></div><div className="col-span-2"><label className="block text-sm font-medium text-slate-600 mb-1">展示会場URL</label><div className="flex gap-2"><input type="text" name="venueUrl" value={data.venueUrl} onChange={handleChange} className="flex-1 p-3 border border-slate-200 rounded-lg" placeholder="https://..." /><button onClick={simulateFetchImage} disabled={!data.venueUrl || isFetchingImg} className="bg-slate-800 text-white px-4 rounded-lg text-sm font-bold hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">{isFetchingImg ? <RefreshCw className="animate-spin" size={16} /> : <LinkIcon size={16} />} 画像を取得</button></div>{data.imageUrl && (<div className="mt-2 p-2 border border-slate-200 rounded-lg bg-slate-50 flex items-center gap-4"><img src={data.imageUrl} alt="Preview" className="w-20 h-14 object-cover rounded" /><span className="text-xs text-green-600 font-bold">✓ 画像を取得しました</span></div>)}</div><div className="col-span-2"><label className="block text-sm font-medium text-slate-600 mb-1 flex items-center gap-2"><Map size={16} /> GoogleマップURL</label><input type="text" name="googleMapsUrl" value={data.googleMapsUrl || ''} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-lg" placeholder="https://maps.google.com/..." /></div><div className="col-span-2"><label className="block text-sm font-medium text-slate-600 mb-1">コンセプト</label><textarea name="concept" value={data.concept} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-lg" rows="3" placeholder="展示会のテーマや狙いを記入" /></div></div></section>

        <section><h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4 flex items-center gap-2"><Target className="text-blue-600" /> 目標設定・チーム</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div><RequiredLabel>集客目標 (人)</RequiredLabel><input type="number" name="targetVisitors" value={data.targetVisitors} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-lg" /></div><div><RequiredLabel>招致メーカー目標 (社)</RequiredLabel><input type="number" name="targetMakers" value={data.targetMakers} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-lg" /></div><div><RequiredLabel>目標利益額 (円)</RequiredLabel><input type="number" name="targetProfit" value={data.targetProfit} onChange={handleChange} className="w-full p-3 border border-blue-300 bg-blue-50 rounded-lg font-bold text-blue-800" placeholder="1000000" /></div><div className="col-span-1 md:col-span-3"><RequiredLabel>運営スタッフ</RequiredLabel><div className="flex gap-2 mb-2"><input type="text" value={staffName} onChange={e => setStaffName(e.target.value)} className="flex-1 p-3 border border-slate-200 rounded-lg" placeholder="スタッフ名" /><button onClick={addStaff} className="bg-slate-800 text-white px-4 rounded-lg"><Plus /></button></div><div className="flex flex-wrap gap-2">{data.staff && data.staff.split(',').filter(s => s).map((s, i) => (<span key={i} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full flex items-center gap-2 text-sm">{s.trim()} <button onClick={() => removeStaff(s.trim())}><X size={14} /></button></span>))}</div></div></div></section>


        <div className="flex justify-end gap-4 pt-4 border-t"><button onClick={onCancel} className="px-6 py-3 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">キャンセル</button><button onClick={validateAndSubmit} className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all">プロジェクト作成</button></div>
      </div>
    </div>
  );
}



function ExhibitionDetail({ exhibition, onBack, onNavigate, updateVisitorCount, updateExhibitionData, batchUpdateExhibitionData, masterMakers, initialTab, onTabChange, storage }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'main');
  const [entranceMode, setEntranceMode] = useState('dashboard'); // QRスキャナーモード制御用

  const setVenueDetails = (d) => updateExhibitionData(exhibition.id, 'venueDetails', d);
  const setMakers = (m) => updateExhibitionData(exhibition.id, 'makers', m);
  const setVisitors = (v) => updateExhibitionData(exhibition.id, 'visitors', v);
  const setTasks = (t) => updateExhibitionData(exhibition.id, 'tasks', t);
  const updateMainData = (k, v) => updateExhibitionData(exhibition.id, k, v);
  const updateMainDataBatch = (updates) => batchUpdateExhibitionData(exhibition.id, updates);


  // QRスキャナーを直接開くハンドラ
  const openScanner = () => {
    setActiveTab('entrance');
    setEntranceMode('scanner');
  };

  // Sync prop changes for tab persistence
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (onTabChange) onTabChange(tabId);
    if (tabId !== 'entrance') setEntranceMode('dashboard');
  };

  const ALL_TAB_DEFINITIONS = [
    { id: 'main', label: '基本情報', icon: Ghost },
    { id: 'schedule', label: 'スケジュール', icon: Calendar },
    { id: 'equipment', label: '会場・備品', icon: Box },
    { id: 'makers', label: '招待メーカー', icon: Building2 },
    { id: 'tasks', label: 'タスク管理', icon: CheckSquare },
    { id: 'budget', label: '収支・予算', icon: DollarSign },
    { id: 'entrance', label: '来場者管理', icon: Users },
    { id: 'lectures', label: '講演会', icon: Mic },
    { id: 'files', label: '資料', icon: Folder },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <button onClick={onBack} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 mb-2 text-sm">
            <ArrowLeft size={16} /> ダッシュボードに戻る
          </button>
          <div className="flex items-center gap-4 flex-wrap">
            {/* 開催日表示 */}
            <div className="flex flex-col items-start gap-1">
              {exhibition.dates && exhibition.dates.length > 0 && (
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg font-bold text-sm flex items-center gap-2">
                  <Calendar size={14} /> {exhibition.dates[0]}
                  {exhibition.dates.length > 1 && <span className="text-blue-500">(+{exhibition.dates.length - 1}日)</span>}
                </span>
              )}
              {exhibition.preDates && exhibition.preDates.length > 0 && (
                <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg font-bold text-sm flex items-center gap-2">
                  <Truck size={14} /> 前日搬入あり
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-slate-800">{exhibition.title}</h1>
            {/* プロジェクトタイトル横のQRスキャンボタン */}
            <button
              onClick={openScanner}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
              title="QRスキャナーを起動"
            >
              <ScanLine size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex overflow-x-auto gap-2 border-b border-slate-200 pb-1 scrollbar-hide">
        {ALL_TAB_DEFINITIONS.map(tab => (
          <button key={tab.id} onClick={() => handleTabChange(tab.id)} className={`flex items-center gap-2 px-4 py-3 rounded-t-lg font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-blue-600 border-b-2 border-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}><tab.icon size={18} /> {tab.label}</button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 min-h-[500px]">
        {activeTab === 'main' && <TabMainBoard exhibition={exhibition} updateMainData={updateMainData} updateBatch={updateMainDataBatch} tasks={exhibition.tasks || []} onNavigate={handleTabChange} />}
        {activeTab === 'schedule' && <TabSchedule scheduleData={exhibition.schedule} updateMainData={updateMainData} staff={exhibition.staff || ''} dates={exhibition.dates || []} preDates={exhibition.preDates || []} />}
        {activeTab === 'equipment' && <TabEquipment exhibition={exhibition} details={exhibition.venueDetails || {}} setDetails={setVenueDetails} masterMakers={masterMakers} />}
        {activeTab === 'makers' && <TabMakers exhibition={exhibition} setMakers={setMakers} updateMainData={updateMainData} masterMakers={masterMakers} onNavigate={onNavigate} storage={storage} />}
        {activeTab === 'tasks' && <TabTasks tasks={exhibition.tasks || []} setTasks={setTasks} staff={exhibition.staff || ''} />}
        {activeTab === 'budget' && <TabBudget exhibition={exhibition} updateMainData={updateMainData} />}
        {activeTab === 'entrance' && <TabEntrance exhibition={exhibition} updateVisitorCount={updateVisitorCount} visitors={exhibition.visitors || []} setVisitors={setVisitors} updateMainData={updateMainData} initialMode={entranceMode} />}
        {activeTab === 'lectures' && <TabLectures lectures={exhibition.lectures || []} updateMainData={updateMainData} updateBatch={updateMainDataBatch} staff={exhibition.staff || ''} scheduleData={exhibition.schedule} />}
        {activeTab === 'files' && <TabFiles materials={exhibition.materials || {}} updateMainData={updateMainData} />}
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = useState('loading');
  const [exhibitions, setExhibitions] = useState(null);
  const [selectedExhibition, setSelectedExhibition] = useState(null);
  const [newExhibition, setNewExhibition] = useState({ title: '', dates: [], preDates: [], place: '', prefecture: '', venueAddress: '', openTime: '10:00', closeTime: '17:00', concept: '', targetVisitors: 0, targetMakers: 0, targetProfit: 0, venueUrl: '', googleMapsUrl: '', imageUrl: '', staff: '' });
  const [exhibitionTabs, setExhibitionTabs] = useState({}); // { [exhibitionId]: 'activeTabName' }




  const [user, setUser] = useState(null);
  const [db, setDb] = useState(null);
  const [storage, setStorage] = useState(null);
  const [appId, setAppId] = useState(null);
  const [urlMode, setUrlMode] = useState('dashboard');
  const [targetExhibitionId, setTargetExhibitionId] = useState(null);
  const [dashboardMaker, setDashboardMaker] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [masterMakers, setMasterMakers] = useState([]);
  const [masterMakersLoaded, setMasterMakersLoaded] = useState(false);

  // ★最適化: useRefを使用してonSnapshotコールバック内で最新値を参照（再購読防止）
  const selectedExhibitionRef = useRef(null);
  const masterMakersRef = useRef([]);

  const applyMasterMakersData = React.useCallback((data) => {
    setMasterMakers(data);
    masterMakersRef.current = data;
    setMasterMakersLoaded(true);
  }, []);

  // 通常利用時は1回取得のみ（常時リアルタイム購読を避けて読取コストを抑制）
  useEffect(() => {
    if (!db || !appId) return;
    let isActive = true;

    const fetchMasterMakers = async () => {
      try {
        const makersRef = collection(db, 'artifacts', appId, 'public', 'data', 'masterMakers');
        const snapshot = await getDocs(makersRef);
        if (!isActive) return;
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        applyMasterMakersData(data);
      } catch (error) {
        console.error('[Firebase] Failed to load masterMakers:', error);
        if (isActive) setMasterMakersLoaded(true);
      }
    };

    fetchMasterMakers();
    return () => {
      isActive = false;
    };
  }, [db, appId, applyMasterMakersData]);

  // 企業管理画面のみリアルタイム同期を有効化（編集時の即時反映を維持）
  useEffect(() => {
    if (!db || !appId || view !== 'enterprise') return;
    const makersRef = collection(db, 'artifacts', appId, 'public', 'data', 'masterMakers');
    const unsubscribe = onSnapshot(makersRef, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      applyMasterMakersData(data);
    }, (error) => {
      console.error('[Firebase] masterMakers onSnapshot error:', error);
    });

    return () => unsubscribe();
  }, [db, appId, view, applyMasterMakersData]);

  // ★最適化: selectedExhibition の変更を Ref に同期（コールバック内で最新値を参照するため）
  useEffect(() => {
    selectedExhibitionRef.current = selectedExhibition;
  }, [selectedExhibition]);

  // Login State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('exhibition_auth') === 'true';
  });
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const PASSCODE = 'kuwanatakashi';

  const handleLogin = () => {
    if (loginPassword === PASSCODE) {
      localStorage.setItem('exhibition_auth', 'true');
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('パスワードが正しくありません');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('exhibition_auth');
    setIsAuthenticated(false);
  };

  useEffect(() => {
    let isMounted = true;
    let unsubscribeAuth = null;

    const init = async () => {
      // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
      // ここにあなたの Firebase Config を貼り付けてください
      const firebaseConfig = {
        apiKey: "AIzaSyDsIpXihZp7hQE2yeNcGxgPH-2iU-Obt-s",
        authDomain: "exhibition-app-891e0.firebaseapp.com",
        projectId: "exhibition-app-891e0",
        storageBucket: "exhibition-app-891e0.firebasestorage.app",
        messagingSenderId: "374193547856",
        appId: "1:374193547856:web:1e71260bfe402d626cbf55"
      };
      // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

      try {
        const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const firestore = getFirestore(app);
        const storageInstance = getStorage(app); // Initialize storage

        if (!isMounted) return;

        setAppId('default-app');
        setDb(firestore);
        setStorage(storageInstance); // Set storage state
        await signInAnonymously(auth);
        unsubscribeAuth = onAuthStateChanged(auth, (u) => {
          if (!isMounted) return;
          setUser(u);
        });
      } catch (e) {
        console.error("Firebase init failed:", e);
      }
    };
    init();

    return () => {
      isMounted = false;
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const id = params.get('id');
    const code = params.get('code');

    if (mode === 'demo_portal' && code) {
      setUrlMode(mode);
      // No targetExhibitionId needed for demo
    } else if (mode === 'maker' && code) {
      // Real Maker Portal Mode
      setUrlMode('maker');
    } else if (mode && id) {
      setUrlMode(mode);
      setTargetExhibitionId(id);
    } else {
      setUrlMode('dashboard');
    }
  }, []);

  // 1. Data Fetching Effect (Stable) - Uses uid to prevent re-subscription on auth state changes
  useEffect(() => {
    if (!user || !db || !appId) return;

    console.log('[Firebase] Setting up onSnapshot subscription for uid:', user.uid);

    const exRef = collection(db, 'artifacts', appId, 'public', 'data', 'exhibitions');

    const unsubscribe = onSnapshot(exRef, (snapshot) => {
      try {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('[Firebase] Received', data.length, 'exhibitions');

        // Ensure uniqueness safely
        const seenIds = new Set();
        const uniqueData = [];
        for (const item of data) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            uniqueData.push(item);
          }
        }

        uniqueData.sort((a, b) => b.createdAt - a.createdAt);
        setExhibitions(uniqueData);

        // ★最適化: onSnapshot内でselectedExhibitionを直接同期（不要なEffect再実行を防止）
        const currentSelectedId = selectedExhibitionRef.current?.id;
        if (currentSelectedId) {
          const latest = uniqueData.find(e => e.id === currentSelectedId);
          if (latest) {
            selectedExhibitionRef.current = latest;
            setSelectedExhibition(latest);
          }
        }
      } catch (err) {
        console.error("Error in onSnapshot processing:", err);
        setExhibitions([]); // Fallback to empty to unblock loading
      }
    }, (error) => {
      console.error("Firestore sync error:", error);
      setExhibitions([]); // Fallback
    });

    return () => {
      console.log('[Firebase] Cleaning up onSnapshot subscription');
      unsubscribe();
    };
  }, [user?.uid, db, appId]); // Use uid instead of user object to prevent re-subscription

  // 2. View Routing & Logic Effect (Reactive) - ★最適化: 初回ロード時とURLパラメータ変更時のみ実行
  // selectedExhibitionの同期はonSnapshot内で直接行うため、ここでは不要
  const exhibitionsLoadedRef = useRef(false);

  useEffect(() => {
    // Wait for exhibitions to be loaded (not null)
    if (exhibitions === null) {
      return;
    }

    // ポータル系はマスター企業の読込完了を待ってから判定（早期not_foundを防止）
    const needsMasterMakers = urlMode === 'demo_portal' || urlMode === 'maker';
    if (needsMasterMakers && !masterMakersLoaded) {
      return;
    }

    // ★最適化: 初回ロード完了後は urlMode/targetExhibitionId 変更時のみ実行
    if (exhibitionsLoadedRef.current) {
      return;
    }
    exhibitionsLoadedRef.current = true;

    // Safety for empty array
    const data = exhibitions;

    if (urlMode === 'visitor_register' && targetExhibitionId) {
      const target = data.find(e => e.id === targetExhibitionId);
      if (target) { setSelectedExhibition(target); setView('public_visitor_form'); }
      else { setView('not_found'); }
    } else if (urlMode === 'maker_register' && targetExhibitionId) {
      const target = data.find(e => e.id === targetExhibitionId);
      if (target) { setSelectedExhibition(target); setView('public_maker_form'); }
      else { setView('not_found'); }
    } else if (urlMode === 'dashboard') { // Maker Dashboard Logic
      const params = new URLSearchParams(window.location.search);
      const key = params.get('key');
      if (key && targetExhibitionId) {
        const target = data.find(e => e.id === targetExhibitionId);
        if (target) {
          const maker = (target.makers || []).find(m => m.accessToken === key);
          if (maker) {
            setSelectedExhibition(target);
            setDashboardMaker(maker);
            setView('maker_dashboard');
          } else {
            setView('not_found'); // Invalid Token
          }
        } else {
          setView('not_found');
        }
      } else {
        setView(prev => prev === 'loading' ? 'dashboard' : prev); // Login functionality?
      }
    } else if (urlMode === 'demo_portal') {
      // Demo Portal Logic
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const currentMasterMakers = masterMakersRef.current;
      const maker = currentMasterMakers.find(m => m.code === code);

      if (maker) {
        setDashboardMaker(maker);

        let targetDemoEx = null;
        if (data && data.length > 0) {
          targetDemoEx = data.find(ex => (ex.makers || []).some(m => m.code === maker.code));
          if (!targetDemoEx) {
            targetDemoEx = data[0];
          }
        }

        if (targetDemoEx) {
          setSelectedExhibition(targetDemoEx);
        } else {
          setSelectedExhibition({
            title: 'Kaientai-X Demo Exhibition',
            id: 'demo',
            scanLogs: [],
            dates: ['2026-10-01', '2026-10-02'],
            venueAddress: 'Demo Venue'
          });
        }
        setView('maker_dashboard');
      } else {
        if (currentMasterMakers.length > 0) {
          console.log('Maker not found in master list:', code);
          setView('not_found');
        }
      }
    } else if (urlMode === 'demo_maker_form') {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      const targetEx = data.find(e => e.id === id);

      if (targetEx) {
        setSelectedExhibition(targetEx);
      } else {
        console.warn('Demo exhibition ID not found, using mock.');
        setSelectedExhibition({
          title: '【デモ】展示会申し込みフォーム',
          id: 'demo_form',
          formConfig: { items: [] },
          makers: [],
          visitors: []
        });
      }
      setView('public_maker_form');
    } else if (urlMode === 'maker') {
      // Real Maker Portal Mode
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      // 1. Validate against Master Makers
      const currentMasterMakers2 = masterMakersRef.current;
      const masterMaker = currentMasterMakers2.find(m => m.code === code);
      if (!masterMaker) {
        console.warn('Maker not found in master list for portal:', code);
        if (currentMasterMakers2.length > 0) setView('not_found');
        else {
          // Allow a grace period? Or show not found immediately?
          // If masterMakers is empty, maybe it hasn't loaded.
          // But since masterMakers loads via another effect which runs in parallel, we might race.
          // However, for now, let's assume if exhibitions loaded, masterMakers likely loaded too (small data).
          setView('not_found');
        }
        return;
      }

      // 2. Find relevant exhibition
      const id = params.get('id');
      let targetEx = null;
      if (id) {
        targetEx = data.find(e => e.id === id);
      } else {
        const relevant = data.filter(e => (e.makers || []).some(m => m.code === code));
        if (relevant.length > 0) {
          targetEx = null; // Ensure home screen
        } else {
          targetEx = null;
        }
      }

      if (targetEx) {
        setDashboardMaker(masterMaker);
        setSelectedExhibition(targetEx);
        setView('maker_dashboard');
      } else {
        // Portal Home
        setDashboardMaker(masterMaker);
        setSelectedExhibition(null);
        setView('maker_dashboard');
      }
    } else {
      setView(prev => prev === 'loading' ? 'dashboard' : prev);
    }
  }, [exhibitions, urlMode, targetExhibitionId, masterMakersLoaded]); // Simplified - removed user/db as they rarely change after init

  const handleCreate = async () => {
    if (!user || !db) return;
    const id = crypto.randomUUID();
    const finalImg = newExhibition.imageUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80';
    const baseUrl = window.location.origin + window.location.pathname;
    const formUrlMaker = `${baseUrl}?mode=maker_register&id=${id}`;
    const formUrlVisitor = `${baseUrl}?mode=visitor_register&id=${id}`;

    // メーカー初期リストは空配列を使用（CSV取込前提）
    const newProject = {
      ...newExhibition, id, createdAt: Date.now(), currentVisitors: 0, imageUrl: finalImg,
      makers: [], visitors: [], venueDetails: { cost: 0, equipment: [], notes: '', internalSupplies: INITIAL_INTERNAL_SUPPLIES },
      otherBudgets: [], tasks: INITIAL_TASKS, formUrlMaker, formUrlVisitor,
      formConfig: DEFAULT_FORM_CONFIG, visitorFormConfig: DEFAULT_VISITOR_FORM_CONFIG, hotels: [], schedule: { dayBefore: [], eventDay: [] }
    };
    try {
      console.log('[DEBUG] Creating new project:', newProject);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'exhibitions', id), newProject);
      console.log('[DEBUG] Creation success');
      setView('dashboard');
      setNewExhibition({ title: '', dates: [], preDates: [], place: '', prefecture: '', venueAddress: '', openTime: '10:00', closeTime: '17:00', concept: '', targetVisitors: 0, targetMakers: 0, targetProfit: 0, venueUrl: '', imageUrl: '', staff: '' });

    } catch (e) {
      console.error('[DEBUG] Creation error:', e);
      alert('作成エラー: ' + e.message);
    }
  };

  const deleteExhibition = async (id) => { if (window.confirm("削除しますか？")) { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'exhibitions', id)); if (selectedExhibition?.id === id) setView('dashboard'); } };
  const updateExhibitionData = async (id, key, value) => {
    try {
      console.log(`[DEBUG] Updating single key: ${key}`, value);
      const exRef = doc(db, 'artifacts', appId, 'public', 'data', 'exhibitions', id);
      if (selectedExhibition?.id === id) setSelectedExhibition(prev => ({ ...prev, [key]: value }));
      await updateDoc(exRef, { [key]: value });
      console.log(`[DEBUG] Successfully updated ${key}`);
    } catch (e) {
      console.error(`[DEBUG] Error updating ${key}:`, e);
      alert(`保存エラー (${key}): ` + e.message);
    }
  };
  const batchUpdateExhibitionData = async (id, updates) => {
    try {
      console.log('[DEBUG] Batch updating exhibition:', updates);
      // 特別に日付データをチェック
      if (updates.dates) console.log('[DEBUG] Dates to save:', updates.dates);
      if (updates.preDates) console.log('[DEBUG] PreDates to save:', updates.preDates);

      const exRef = doc(db, 'artifacts', appId, 'public', 'data', 'exhibitions', id);
      if (selectedExhibition?.id === id) setSelectedExhibition(prev => ({ ...prev, ...updates }));
      await updateDoc(exRef, updates);
      console.log('[DEBUG] Batch update success');
      console.log('Batch update success');
    } catch (e) {
      console.error('[DEBUG] Batch update error:', e);
      alert('一括保存エラー: ' + e.message);
    }
  };
  const updateVisitorCount = async (id, n) => { updateExhibitionData(id, 'currentVisitors', n); };
  const handlePublicSubmit = async (type, data) => {
    if (!selectedExhibition) return;
    const current = selectedExhibition;

    // ... (rest of handlePublicSubmit)

    let updates = {};
    let finalStatus;
    if (type === 'visitor') {
      const newVisitor = { id: data.id || crypto.randomUUID(), ...data, status: 'registered', registeredAt: Date.now() };
      updates = { visitors: [...(current.visitors || []), newVisitor] };
    } else if (type === 'maker') {
      // デバッグログ
      console.log('[DEBUG] handlePublicSubmit - Received data:', data);
      console.log('[DEBUG] handlePublicSubmit - data.status:', data.status);

      // ステータス判定を厳密に行う
      const isConfirmed = data.status === 'confirmed' ||
        data.status === '出展を申し込む' ||
        data.status === 'Confirmed' ||
        (data.status && data.status.includes('申し込む'));
      finalStatus = isConfirmed ? 'confirmed' : 'declined';

      console.log('[DEBUG] handlePublicSubmit - isConfirmed:', isConfirmed, '-> finalStatus:', finalStatus);

      // 既存のメーカーリストから会社名またはメールで検索
      const existingMakers = current.makers || [];
      const existingIndex = existingMakers.findIndex(m =>
        (m.companyName && m.companyName === data.companyName) ||
        (m.email && m.email === data.email)
      );

      if (existingIndex >= 0) {
        // 既存メーカーを更新（招待リストにいる場合）
        const updatedMakers = [...existingMakers];
        updatedMakers[existingIndex] = {
          ...updatedMakers[existingIndex],
          ...data,
          status: finalStatus,
          respondedAt: Date.now()
        };
        updates = { makers: updatedMakers };
      } else {
        // 新規回答者（招待リストにはいなかった）- 回答者としてのみ追加
        const newMaker = {
          id: crypto.randomUUID(),
          ...data,
          code: 'WEB-' + Date.now().toString().slice(-4),
          status: finalStatus,
          source: 'web_response', // 招待リストからではなくWeb回答
          respondedAt: Date.now()
        };
        updates = { makers: [...existingMakers, newMaker] };
      }
    }

    try {
      await updateExhibitionData(current.id, Object.keys(updates)[0], Object.values(updates)[0]);
      if (type === 'maker') {
        // Return objects for QR display
        const updatedMakers = updates.makers;
        const ourMaker = updatedMakers[updatedMakers.length - 1]; // Assume last if new, or find
        // Simplified: just return the data + computed status
        return ourMaker;
      }
      return true;
    } catch (e) { alert("送信エラー: " + e.message); return false; }
  };

  const handleVisitorScan = async (code) => {
    if (!selectedExhibition || !dashboardMaker) return { success: false, type: 'error', message: 'System error: Missing context' };
    const current = selectedExhibition;

    console.log('[DEBUG] handleVisitorScan code:', code);

    // 1. Find Visitor (Handle JSON or Raw ID)
    let searchId = code;
    try {
      const parsed = JSON.parse(code);
      if (parsed && parsed.id) {
        searchId = parsed.id;
      }
    } catch {
      // Not JSON, use as is
    }

    const visitor = (current.visitors || []).find(v => v.id === searchId);
    if (!visitor) {
      return { success: false, type: 'error', message: '未登録の来場者QRコードです' };
    }

    // 2. Check Duplicates
    const alreadyScanned = (current.scanLogs || []).some(log =>
      log.makerId === (dashboardMaker.id || dashboardMaker.code) &&
      log.visitorId === visitor.id
    );

    if (alreadyScanned) {
      return { success: false, type: 'warning', message: `${visitor.repName} 様は既にスキャン済みです`, visitor };
    }

    // 3. Create Scan Log (Save ALL visitor data)
    const newLog = {
      id: crypto.randomUUID(),
      makerId: dashboardMaker.id || dashboardMaker.code,
      visitorId: visitor.id,
      scannedAt: Date.now(),
      visitorSnapshot: { ...visitor } // Save ALL visitor data
    };

    // 4. Update DB (Fire-and-forget for faster UI response)
    const currentLogs = current.scanLogs || [];
    const updatedLogs = [...currentLogs, newLog];
    updateExhibitionData(current.id, 'scanLogs', updatedLogs).catch(err => {
      console.error('Failed to save scan log:', err);
    });
    console.log('Scan logged (async):', newLog);

    return { success: true, type: 'success', message: 'スキャン完了', visitor };
  };

  // Maker Response Handler
  const handleMakerResponse = async (exhibitionId, data) => {
    console.log('[DEBUG] handleMakerResponse', exhibitionId, data);

    // Find the exhibition (Latest from state)
    const exhibition = exhibitions.find(e => e.id === exhibitionId);
    if (!exhibition) {
      alert('展示会データが見つかりません。画面をリロードしてください。');
      return;
    }

    // Find the maker in the exhibition
    const currentMakers = exhibition.makers || [];
    // Try matching by Code or ID first
    let makerIndex = currentMakers.findIndex(m =>
      (m.code && dashboardMaker.code && m.code === dashboardMaker.code) ||
      (m.id && dashboardMaker.id && m.id === dashboardMaker.id)
    );

    // Fallback: match by Company Name or Email
    if (makerIndex === -1) {
      console.log('Match by code/id failed. Trying name/email fallback...');
      makerIndex = currentMakers.findIndex(m =>
        (m.companyName && m.companyName === dashboardMaker.companyName) ||
        (m.email && m.email === dashboardMaker.email)
      );
    }

    if (makerIndex === -1) {
      console.error('Maker not found in exhibition');
      alert(`エラー: メーカー情報がリスト内で見つかりませんでした。\n会社名: ${dashboardMaker.companyName}`);
      return;
    }

    // Determine status
    let newStatus = 'confirmed';
    if (data.status === '出展を申し込まない' || data.status === '辞退' || data.status === 'declined') {
      newStatus = 'declined';
    }

    // Update maker status and save response
    const updatedMakers = [...currentMakers];
    const targetMaker = updatedMakers[makerIndex];

    const updatedMakerData = {
      ...targetMaker,
      status: newStatus,
      confirmedAt: Date.now(),
      response: data, // ★修正: 管理画面との整合性のため 'response' に名前変更
      applicationDate: new Date().toISOString(),
    };

    // Only update logistics info if confirmed (to prevent undefined errors)
    if (newStatus === 'confirmed') {
      updatedMakerData.boothCount = data.boothCount || targetMaker.boothCount || 0; // Data or Keep Existing or Default 0
      updatedMakerData.attendees = data.staffCount || targetMaker.attendees || 0;
      updatedMakerData.moveInDate = data.moveInDate || targetMaker.moveInDate || '';
    }

    updatedMakers[makerIndex] = updatedMakerData;

    // Update DB
    try {
      await updateExhibitionData(exhibitionId, 'makers', updatedMakers);
      // alert('回答を保存しました。'); // Duplicate alert suppression
      console.log(`Maker response saved. Status: ${newStatus}`);

      // Force update selectedExhibition if it's the current one (Optimistic UI update)
      if (selectedExhibition?.id === exhibitionId) {
        setSelectedExhibition(prev => ({ ...prev, makers: updatedMakers }));
      }
    } catch (e) {
      console.error(e);
      alert('保存に失敗しました: ' + e.message);
    }
  };



  const markMessageAsRead = async (exhibitionId, messageId, makerCode) => {
    try {
      const ex = exhibitions.find(e => e.id === exhibitionId);
      if (!ex) return;

      const updatedMessages = (ex.messages || []).map(msg => {
        if (msg.id === messageId) {
          const currentReadBy = msg.readBy || [];
          if (!currentReadBy.includes(makerCode)) {
            return { ...msg, readBy: [...currentReadBy, makerCode] };
          }
        }
        return msg;
      });

      // Optimistic update
      if (selectedExhibition?.id === exhibitionId) {
        setSelectedExhibition(prev => ({ ...prev, messages: updatedMessages }));
      }

      const exRef = doc(db, 'artifacts', appId, 'public', 'data', 'exhibitions', exhibitionId);
      await updateDoc(exRef, { messages: updatedMessages });
    } catch (e) {
      console.error('Error marking message as read:', e);
    }
  };


  // Scroll Preservation Logic
  const mainRef = useRef(null);
  const scrollPositions = useRef({}); // Store scroll positions for each view

  const navigateTo = (nextView) => {
    if (mainRef.current) {
      // Save current view's scroll position
      scrollPositions.current[view] = mainRef.current.scrollTop;
    }
    setView(nextView);
  };

  useLayoutEffect(() => {
    if (mainRef.current) {
      // Restore scroll position for the new view (default to 0)
      const savedPos = scrollPositions.current[view] || 0;
      mainRef.current.scrollTop = savedPos;
    }
  }, [view]);

  if (view === 'loading') return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="text-center"><Loader className="animate-spin text-blue-600 mb-2 mx-auto" size={40} /><p className="text-slate-500 font-bold">Connecting to Database...</p></div></div>;
  if (view === 'not_found') return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">プロジェクトが見つかりません。URLを確認してください。</div>;
  if (view === 'public_visitor_form') return <PublicVisitorView exhibition={selectedExhibition} onSubmit={(d) => handlePublicSubmit('visitor', d)} />;
  if (view === 'public_maker_form') return <PublicMakerView exhibition={selectedExhibition} onSubmit={(d) => handlePublicSubmit('maker', d)} />;
  if (view === 'maker_dashboard' && dashboardMaker) {
    return <MakerPortal maker={dashboardMaker} exhibitionName={selectedExhibition?.title} scanLogs={selectedExhibition?.scanLogs || []} onScan={handleVisitorScan} exhibitions={exhibitions || []} onResponseSubmit={handleMakerResponse} markMessageAsRead={markMessageAsRead} initialExhibition={selectedExhibition} />;
  }

  // Login Screen
  if (!isAuthenticated && view !== 'public_visitor_form' && view !== 'public_maker_form' && view !== 'maker_dashboard') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full mb-4">
              <Ghost className="text-red-500" size={24} />
              <span className="font-bold text-lg">Kaientai-X</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">ログイン</h2>
            <p className="text-slate-500 text-sm mt-2">パスワードを入力してください</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">パスワード</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="パスワードを入力"
              />
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm">
                {loginError}
              </div>
            )}

            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg"
            >
              ログイン
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col md:flex-row">
      <div className="md:hidden bg-slate-900 text-white p-4 flex items-center gap-4 sticky top-0 z-50">
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}><Menu size={24} /></button>
        <h1 className="text-lg font-bold flex items-center gap-2"><Ghost className="text-red-500" size={20} /> Kaientai-X</h1>
      </div>

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <div onClick={() => { navigateTo('dashboard'); setIsMobileMenuOpen(false); }} className="cursor-pointer transition-opacity hover:opacity-80">
            <h1 className="text-2xl font-bold tracking-tighter text-blue-400 flex items-center gap-2"><Ghost className="text-red-500" size={28} /> Kaientai-X</h1>
            <p className="text-xs text-slate-400 mt-1">Event Management System</p>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400"><X /></button>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => { navigateTo('dashboard'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}><LayoutDashboard size={20} /> ダッシュボード</button>
          <button onClick={() => { navigateTo('enterprise'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'enterprise' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}><Building2 size={20} /> 企業管理コンソール</button>
          <button onClick={() => { navigateTo('manual'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'manual' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}><BookOpen size={20} /> 運用マニュアル</button>
          <button onClick={() => { navigateTo('analysis'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'analysis' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}><BarChart3 size={20} /> 実績分析</button>

          {/* Resume Project Button */}
          {selectedExhibition && view !== 'detail' && (
            <div className="pt-4 mt-2 border-t border-slate-800">
              <p className="text-xs text-slate-500 font-bold mb-2 px-2 uppercase tracking-wider">Active Project</p>
              <button onClick={() => { navigateTo('detail'); setIsMobileMenuOpen(false); }} className="w-full text-left bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-blue-500/50 p-3 rounded-xl transition-all group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-blue-400 font-bold text-xs"><Radio size={12} className="animate-pulse" /> 編集中</div>
                  <ArrowRight size={14} className="text-slate-500 group-hover:text-blue-400 transform group-hover:translate-x-1 transition-all" />
                </div>
                <div className="font-bold text-sm truncate text-white">{selectedExhibition.title}</div>
              </button>
            </div>
          )}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-3"><img src="/ship_blue_icon.png" alt="Admin" className="w-10 h-10 rounded-full object-cover border border-slate-700 bg-white" /><div><p className="text-sm font-medium">caremax-corp</p><p className="text-xs text-slate-400 truncate max-w-[150px]" title="seisaku.tokyo@kaientaiweb.jp">seisaku.tokyo@kaientaiweb.jp</p></div></div>
          <button onClick={handleLogout} className="w-full text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-lg text-sm flex items-center gap-2"><LogOut size={16} /> ログアウト</button>
        </div>
      </aside>

      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>}

      <main ref={mainRef} className="flex-1 h-[calc(100vh-60px)] md:h-screen overflow-y-auto bg-slate-50 relative">
        <div className="p-4 md:p-10 max-w-7xl mx-auto">
          {view === 'dashboard' && <DashboardView exhibitions={exhibitions || []} onCreateClick={() => navigateTo('create')} onCardClick={(ex) => { setSelectedExhibition(ex); navigateTo('detail'); }} onDeleteClick={deleteExhibition} onScanClick={(ex) => { setSelectedExhibition(ex); setExhibitionTabs(prev => ({ ...prev, [ex.id]: 'entrance' })); navigateTo('detail'); }} />}
          {view === 'create' && <CreateExhibitionForm data={newExhibition} setData={setNewExhibition} onCancel={() => navigateTo('dashboard')} onSubmit={handleCreate} />}
          {view === 'enterprise' && <EnterpriseConsole masterMakers={masterMakers} setMasterMakers={setMasterMakers} db={db} appId={appId} />}
          {view === 'manual' && <OperationalManualView />}
          {view === 'analysis' && <PerformanceAnalysisView exhibitions={exhibitions || []} />}
          {view === 'detail' && selectedExhibition && <ExhibitionDetail exhibition={selectedExhibition} onBack={() => navigateTo('dashboard')} onNavigate={navigateTo} updateVisitorCount={updateVisitorCount} updateExhibitionData={updateExhibitionData} batchUpdateExhibitionData={batchUpdateExhibitionData} masterMakers={masterMakers} initialTab={exhibitionTabs[selectedExhibition.id]} onTabChange={(tab) => setExhibitionTabs(prev => ({ ...prev, [selectedExhibition.id]: tab }))} storage={storage} />}
        </div>
      </main>


    </div>
  );
}

export default App;


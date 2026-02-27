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
  Camera, Loader, BedDouble, CalendarDays, Menu,
  ChevronDown, ChevronUp, ChevronRight, Trash, GitBranch, Mic, Truck, Layout, User, Info, LogOut, Maximize,
  Box, BookOpen, Star, LayoutGrid, Grid, Image, Radio, ArrowRight, XCircle, History as HistoryIcon, Minus, Inbox, Square, Trophy, BarChart3, Wand2, Skull
} from 'lucide-react';
// import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { collection, getDocs, onSnapshot, updateDoc as updateDocRaw, doc, deleteDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
// QRコード用ライブラリ
import { QRCodeCanvas } from 'qrcode.react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import EnterpriseConsole from './components/EnterpriseConsole';
import OperationalManualView from './components/OperationalManualView';
import LayoutBuilderModal from './components/LayoutBuilderModal';
import MakerDetailModal from './components/makers/MakerDetailModal';
import {
  buildAiIntegratedReport,
  buildCheckedInVisitors,
  buildCompanyPerformanceStats,
  buildCompanyRanking,
  buildDeclineRanking,
  buildMakerStrategyReport,
  buildOverallExhibitionStats,
  buildRevenueSimulation,
  buildTotalVisitors,
  buildVisitorForecast,
  buildVisitorCheckinHeatmap,
  buildVisitorAttributes,
  buildYearlyStats,
  formatReportTimestamp
} from './features/performanceAnalysis/analysisEngine';
import {
  exportConfirmedMakersExcel,
  exportConfirmedMakersAccountingExcel,
  exportInvitedMakersExcel
} from './features/makers/makerExcelExports';
import { buildAiInviteRecommendations } from './features/makers/aiRecommendations';
import { useMakerActions } from './features/makers/useMakerActions';
import { useMakerViewModel } from './features/makers/useMakerViewModel';
import { useInvoiceDownloads } from './features/invoice/useInvoiceDownloads';
import { useFirebaseInit } from './hooks/useFirebaseInit';
import { useMasterMakersSync } from './hooks/useMasterMakersSync';

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
const BRAND_NAME = "Kaientai-X 2.0";
const BRAND_ICON_PATH = "/icon.png";

const BrandIcon = ({ size = 24, className = "", alt = BRAND_NAME }) => (
  <img
    src={BRAND_ICON_PATH}
    alt={alt}
    className={`object-contain ${className}`.trim()}
    style={{ width: size, height: size }}
  />
);

const BrandTabIcon = ({ size = 18, className = "" }) => (
  <BrandIcon size={size} className={className} alt="" />
);

const INITIAL_INTERNAL_SUPPLIES = [
  "メジャー", "テープ", "消毒液", "音楽用CD", "ダンボール", "ヤマト佐川送り状",
  "ラミネート看板", "介援隊袋", "横断幕", "延長ケーブル",
  "自社用レイアウト用紙", "お客様用レイアウト用紙", "介援隊カタログ", "展示会案内チラシ　50枚ほど"
].map((name, i) => ({ id: `is-${i}`, name, count: 1, checked: false }));

// ▼ メーカーリスト初期値（CSV取込前提のため空配列）
const FIXED_MAKERS_LIST = [];

const TASK_TEMPLATE_VERSION = 20260213;
const PLANNING_FLYER_CREATION_TASK_TITLE = '案内チラシ作成（メーカー確定・講演会確定後）';
const PLANNING_FLYER_FIXED_SUBTASK_TITLES = [
  '得意先チラシFAX送付（対象県）',
  'チラシ印刷依頼',
  '介援隊WEBアップロード'
];
const SALES_TASK_TITLES = [
  '展示会場選び',
  '展示会日時・エリアの決定',
  '展示会場申請',
  'メーカー選定、企画へ招待依頼',
  'メーカー追加招待、企画に招待依頼',
  'メーカー招待締め切り、企画に報告',
  '講演会企画の計画',
  'レイアウト作成',
  '講演会企画の諸々手配',
  '電気設備会社手配',
  '展示会必要品の手配（リストを参照）',
  '展示会場備品確保',
  '集荷会社手配（ヤマト・佐川）',
  'バイトの手配と打ち合わせ',
  '（仮）収支報告書作成',
  '展示会場最終打ち合わせ',
  '当日のデモンストレーション',
  '得意先への集客',
  'エンド（施設など）集客',
  '当日の展示会運営マニュアル',
  '当日の講演会運営マニュアル',
  'ホテル予約',
  '弁当手配',
  '打ち上げ会場手配',
  '備品整理',
  '収支報告書作成'
];
const PLANNING_TASK_TITLES = [
  'メーカー招待実行（営業から指示あり次第）',
  'メーカー追加招待（営業から指示あり次第）',
  'メーカー回答催促',
  PLANNING_FLYER_CREATION_TASK_TITLE,
  ...PLANNING_FLYER_FIXED_SUBTASK_TITLES,
  'メーカー確定案内メール',
  'メーカーへチラシ配布を依頼',
  'チラシ配布以外の集客戦略を実行',
  'メーカーパネルラミネートを作成',
  'メーカー請求書送付',
  '入金確認（経理と連携）'
];

const buildFixedTaskTemplate = () => [
  ...SALES_TASK_TITLES.map((title, index) => ({
    id: `s${index + 1}`,
    category: 'sales',
    title,
    status: 'pending',
    assignees: [],
    dueDate: '',
    desc: ''
  })),
  ...PLANNING_TASK_TITLES.map((title, index) => ({
    id: `p${index + 1}`,
    category: 'planning',
    title,
    status: 'pending',
    assignees: [],
    dueDate: '',
    desc: ''
  }))
];

const normalizeTaskShape = (task, fallbackTask = null) => ({
  id: task?.id || fallbackTask?.id || crypto.randomUUID(),
  category:
    task?.category === 'sales' || task?.category === 'planning'
      ? task.category
      : fallbackTask?.category || 'planning',
  title: task?.title || fallbackTask?.title || '',
  status: task?.status === 'done' ? 'done' : 'pending',
  assignees: Array.isArray(task?.assignees) ? task.assignees : [],
  dueDate: typeof task?.dueDate === 'string' ? task.dueDate : '',
  desc: typeof task?.desc === 'string' ? task.desc : ''
});

const mergeTasksWithTemplate = (tasks) => {
  const fixedTemplateTasks = buildFixedTaskTemplate();
  const existingTasks = Array.isArray(tasks) ? [...tasks] : [];

  const mergedFixedTasks = fixedTemplateTasks.map((templateTask) => {
    const matchIndex = existingTasks.findIndex(
      (task) => task?.category === templateTask.category && task?.title === templateTask.title
    );

    if (matchIndex === -1) {
      return normalizeTaskShape(
        { ...templateTask, id: `fixed:${templateTask.category}:${templateTask.title}` },
        templateTask
      );
    }

    const [matchedTask] = existingTasks.splice(matchIndex, 1);
    return normalizeTaskShape(matchedTask, templateTask);
  });

  const customTasks = existingTasks
    .filter((task) => task && typeof task.title === 'string' && task.title.trim())
    .map((task) => normalizeTaskShape(task));

  return [...mergedFixedTasks, ...customTasks];
};

const INITIAL_TASKS = buildFixedTaskTemplate();

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

const normalizeMakerFormSection = (section, defaultSection) => {
  const baseSection = (section && typeof section === 'object') ? section : {};
  const defaultItems = Array.isArray(defaultSection?.items) ? defaultSection.items : [];
  const sourceItems = Array.isArray(baseSection.items) ? baseSection.items : defaultItems;

  const normalizedItems = sourceItems
    .filter((item) => item && typeof item === 'object')
    .map((item) => (item.id === 'payment' ? { ...item, required: true } : item));

  const paymentDefault = defaultItems.find((item) => item?.id === 'payment');
  const hasPayment = normalizedItems.some((item) => item?.id === 'payment');
  const finalItems = (!hasPayment && paymentDefault)
    ? [...normalizedItems, { ...paymentDefault, required: true }]
    : normalizedItems;

  return {
    ...(defaultSection || {}),
    ...baseSection,
    items: finalItems
  };
};

const normalizeMakerFormConfig = (config) => {
  const base = (config && typeof config === 'object') ? config : {};
  return {
    ...DEFAULT_FORM_CONFIG,
    ...base,
    section1: normalizeMakerFormSection(base.section1, DEFAULT_FORM_CONFIG.section1),
    section2: normalizeMakerFormSection(base.section2, DEFAULT_FORM_CONFIG.section2),
    section3: normalizeMakerFormSection(base.section3, DEFAULT_FORM_CONFIG.section3),
    settings: { ...(DEFAULT_FORM_CONFIG.settings || {}), ...(base.settings || {}) },
    mail: { ...(DEFAULT_FORM_CONFIG.mail || {}), ...(base.mail || {}) }
  };
};

const VISITOR_TYPE_GENERAL_INDIVIDUAL = '一般・個人';

const VISITOR_TYPE_OPTIONS = [
  '福祉用具貸与事業所',
  '医療機器販売',
  '介護施設・病院管理者様',
  '介護・看護従事者様(看護師・介護士・ケアマネ等)',
  'メーカー・製造業',
  VISITOR_TYPE_GENERAL_INDIVIDUAL,
  'その他'
];

const VISITOR_CONTACT_DISABLED_TYPES = new Set([
  '介護・看護従事者様(看護師・介護士・ケアマネ等)',
  VISITOR_TYPE_GENERAL_INDIVIDUAL
]);

const PRIVACY_CONSENT_ITEM_ID = 'privacyConsent';
const VISITOR_PRIVACY_CONSENT_LABEL = '上記の個人情報の取り扱いに同意する';
const VISITOR_PRIVACY_USAGE_PURPOSES = [
  '本展示会の運営・受付業務',
  '展示会に関する各種ご連絡',
  '出展メーカーによる来場者対応（※詳細は下記）'
];

const getDefaultVisitorFormItems = () => ([
  { id: 'type', label: '★受付区分', type: 'select', options: [...VISITOR_TYPE_OPTIONS], required: true, isFixed: true },
  { id: 'companyName', label: '★会社名・法人名', type: 'text', help: '個人の場合は「個人」とご明記ください (例：株式会社ケアマックスコーポレーション)', required: true, isFixed: true },
  { id: 'repName', label: '★お名前', type: 'text', help: '', required: true, isFixed: true },
  { id: 'phone', label: '★電話番号', type: 'text', help: 'ハイフンなしでも可', required: true, isFixed: true },
  { id: 'email', label: '★メールアドレス', type: 'email', help: '', required: true, isFixed: true },
  { id: 'invitedBy', label: '★招待企業様名', type: 'text', help: '招待状をお持ちの場合、企業名をご記入ください（任意）', required: false, isFixed: true },
  { id: PRIVACY_CONSENT_ITEM_ID, label: '★個人情報の取り扱い同意', type: 'checkbox', help: '', required: true, isFixed: true }
]);

const FIXED_VISITOR_ITEM_IDS = new Set(getDefaultVisitorFormItems().map(item => item.id));
const isVisitorFixedQuestion = (itemOrId) => {
  const id = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
  return FIXED_VISITOR_ITEM_IDS.has(id);
};

const isContactDisabledByVisitorType = (typeValue) => VISITOR_CONTACT_DISABLED_TYPES.has(typeValue || '');
const isCompanyNameDisabledByVisitorType = (typeValue) => typeValue === VISITOR_TYPE_GENERAL_INDIVIDUAL;

const normalizeVisitorContactFields = (formData = {}) => {
  const next = { ...formData };
  if (isContactDisabledByVisitorType(next.type)) {
    next.phone = '';
    next.email = '';
  }
  if (isCompanyNameDisabledByVisitorType(next.type)) {
    next.companyName = '';
  }
  return next;
};

const normalizeVisitorFormConfig = (config) => {
  const base = (config && typeof config === 'object') ? config : {};
  const defaults = getDefaultVisitorFormItems();
  const sourceItems = Array.isArray(base.items) ? base.items : [];
  const customItems = sourceItems
    .filter(item => !isVisitorFixedQuestion(item?.id))
    .filter((item) => {
      const id = String(item?.id || '');
      // Legacy schema items can leak into visitor forms; only keep editor-generated custom IDs.
      return id.startsWith('custom-') || id.startsWith('custom_');
    })
    .map(item => ({ ...item, isFixed: false }));

  return {
    title: typeof base.title === 'string' && base.title.trim() ? base.title : '来場者事前登録',
    description: typeof base.description === 'string' && base.description.trim()
      ? base.description
      : '当日のスムーズな入場のため、事前登録にご協力をお願いいたします。登録完了後、入場用QRコードが発行されます。',
    items: [...defaults, ...customItems]
  };
};

function VisitorPrivacyConsentField({ checked, onChange, required = true }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
      <details className="group">
        <summary className="cursor-pointer list-none font-bold text-slate-800 flex items-center justify-between gap-2">
          <span>【個人情報の取り扱いについて】</span>
          <span className="text-slate-400 text-xs group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="mt-3 text-sm text-slate-700 leading-relaxed space-y-3">
          <p>ご入力いただいた個人情報は、以下の目的で使用いたします。</p>
          <ul className="space-y-1 pl-4">
            {VISITOR_PRIVACY_USAGE_PURPOSES.map((line) => (
              <li key={line}>・{line}</li>
            ))}
          </ul>
          <div className="pt-1">
            <p className="font-bold text-slate-800">【出展メーカーへの情報提供について】</p>
            <p className="mt-1">
              展示会場内にて、出展メーカーがお客様の入場QRコードを読み取った場合、
              お客様のご登録情報（会社名・お名前・連絡先等）が当該メーカーに共有されます。
              これは、メーカーからのご連絡やアフターフォローを目的としています。
            </p>
          </div>
          <p className="text-xs text-slate-500">※ご本人の同意なく、上記以外の第三者への提供は行いません。</p>
        </div>
      </details>

      <label className="flex items-start gap-2 text-sm font-bold text-slate-700">
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onChange(e.target.checked)}
          required={required}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
        />
        <span>
          □ {VISITOR_PRIVACY_CONSENT_LABEL} {required && <span className="text-red-500">*</span>}
        </span>
      </label>
    </div>
  );
}

const DEFAULT_VISITOR_FORM_CONFIG = normalizeVisitorFormConfig({
  title: '来場者事前登録',
  description: '当日のスムーズな入場のため、事前登録にご協力をお願いいたします。登録完了後、入場用QRコードが発行されます。',
  items: getDefaultVisitorFormItems()
});

const EXHIBITION_WRITE_DEDUP_WINDOW_MS = 1500;
const PROTECTED_EXHIBITION_WRITE_KEYS = new Set(['visitorFormConfig', 'formConfig']);
// Permanent policy: visitor pre-registration questions are fixed (7 items).
// Admin users can view the configuration but cannot add/edit/save question definitions.
const VISITOR_FORM_POLICY_LOCKED = true;
const EMERGENCY_DISABLE_VISITOR_FORM_CONFIG_WRITES = VISITOR_FORM_POLICY_LOCKED;
const EMERGENCY_PUBLIC_VISITOR_FORM_FIXED_ONLY = VISITOR_FORM_POLICY_LOCKED;
const PUBLIC_VISITOR_FORM_URL_VERSION = '20260212a';
const APP_BUILD_TAG = '2026-02-12-writeguard2';
const BLOCKED_UPDATE_FIELD_PREFIXES = ['visitorFormConfig'];

const isBlockedUpdateFieldPath = (key) => {
  const normalized = String(key || '').trim();
  if (!normalized) return false;
  return BLOCKED_UPDATE_FIELD_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}.`));
};

const hasBlockedUpdateFieldPath = (payload) => {
  if (!payload || typeof payload !== 'object') return false;
  return Object.keys(payload).some((key) => isBlockedUpdateFieldPath(key));
};

const guardedUpdateDoc = async (docRef, payload, context = '') => {
  if (hasBlockedUpdateFieldPath(payload)) {
    console.error('[WriteGuard] Blocked direct updateDoc for protected field path', {
      context,
      keys: Object.keys(payload || {})
    });
    return false;
  }
  await updateDocRaw(docRef, payload);
  return true;
};

const buildVisitorRegisterUrl = (exhibitionId) => {
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const params = new URLSearchParams({
    mode: 'visitor_register',
    id: exhibitionId,
    v: PUBLIC_VISITOR_FORM_URL_VERSION
  });
  return `${baseUrl}?${params.toString()}`;
};

const getPublicVisitorFormConfig = (config) => {
  const normalized = normalizeVisitorFormConfig(config);
  if (!EMERGENCY_PUBLIC_VISITOR_FORM_FIXED_ONLY) return normalized;
  return {
    ...normalized,
    items: getDefaultVisitorFormItems()
  };
};

const safeJsonStringify = (value) => {
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.warn('[Serialize] Failed to stringify value', error);
    return '__SERIALIZE_ERROR__';
  }
};

const isDeepEqual = (left, right) => safeJsonStringify(left) === safeJsonStringify(right);

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
  const [localConfig, setLocalConfig] = useState(() => normalizeMakerFormConfig(config));
  const [activeTab, setActiveTab] = useState('settings');
  const [expandedItems, setExpandedItems] = useState({});

  const getCurrentItems = () => localConfig[activeTab]?.items || [];
  const findItemById = (id) => getCurrentItems().find(item => item.id === id);
  const isFixedQuestion = (item) => !!item?.isFixed || !String(item?.id || '').startsWith('custom_');
  const isPaymentQuestion = (item) => item?.id === 'payment';

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
    const targetItem = findItemById(id);
    if (!targetItem) return;
    if (isPaymentQuestion(targetItem)) return;
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
    const targetItem = findItemById(itemId);
    if (!targetItem) return;
    if (isPaymentQuestion(targetItem)) return;
    const updatedItems = localConfig[activeTab].items.map(i => {
      if (i.id === itemId) return { ...i, options: [...(i.options || []), '新しい選択肢'] };
      return i;
    });
    updateSection('items', updatedItems);
  };

  const removeOption = (itemId, index) => {
    const targetItem = findItemById(itemId);
    if (!targetItem) return;
    if (isPaymentQuestion(targetItem)) return;
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
    const targetItem = findItemById(itemId);
    if (!targetItem) return;
    if (isPaymentQuestion(targetItem)) return;
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
    const targetItem = findItemById(id);
    if (!targetItem) return;
    if (isFixedQuestion(targetItem)) {
      alert('固定質問は削除できません。');
      return;
    }
    if (window.confirm('この質問を削除してもよろしいですか？')) {
      const updatedItems = localConfig[activeTab].items.filter(i => i.id !== id);
      updateSection('items', updatedItems);
    }
  };

  const updateCondition = (itemId, field, value) => {
    const targetItem = findItemById(itemId);
    if (!targetItem) return;
    if (isPaymentQuestion(targetItem)) return;
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
                    {localConfig[activeTab].items.map(item => {
                      const itemIsFixed = isFixedQuestion(item);
                      const itemIsPaymentLocked = isPaymentQuestion(item);
                      return (
                      <div key={item.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <div
                          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => toggleItem(item.id)}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-bold px-2 py-1 rounded border ${item.type === 'radio' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{item.type === 'text' ? 'テキスト' : item.type === 'radio' ? 'ラジオボタン' : item.type === 'select' ? 'プルダウン' : item.type === 'checkbox' ? 'チェックボックス' : item.type === 'textarea' ? '長文' : item.type}</span>
                            <span className="font-bold text-slate-700">{item.label}</span>
                            {item.required && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">必須</span>}
                            {itemIsFixed && <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">固定</span>}
                            {itemIsPaymentLocked && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">編集不可</span>}
                            {item.condition && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-1"><GitBranch size={10} /> 分岐あり</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                              disabled={itemIsFixed}
                              title={itemIsFixed ? '固定質問は削除できません' : '削除'}
                              className={`p-2 rounded transition-colors ${itemIsFixed ? 'text-slate-300 cursor-not-allowed' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}
                            >
                              <Trash2 size={16} />
                            </button>
                            {expandedItems[item.id] ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                          </div>
                        </div>

                        {expandedItems[item.id] && (
                          <div className="p-4 bg-slate-50 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                            <div className="md:col-span-2">
                              <label className="block text-xs font-bold text-slate-400 mb-1">質問ラベル</label>
                              <input
                                className={`w-full border p-2 rounded text-sm ${itemIsPaymentLocked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                value={item.label}
                                onChange={e => updateItem(item.id, 'label', e.target.value)}
                                disabled={itemIsPaymentLocked}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-400 mb-1">回答タイプ</label>
                              <select
                                className={`w-full border p-2 rounded text-sm bg-white ${itemIsPaymentLocked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                value={item.type}
                                onChange={e => updateItem(item.id, 'type', e.target.value)}
                                disabled={itemIsPaymentLocked}
                              >
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
                                <input
                                  type="checkbox"
                                  checked={item.required || false}
                                  onChange={e => updateItem(item.id, 'required', e.target.checked)}
                                  className="w-4 h-4 text-blue-600 rounded"
                                  disabled={itemIsPaymentLocked}
                                />
                                <span className="text-sm font-bold text-slate-700">必須にする</span>
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-bold text-slate-400 mb-1">補足説明 (Help Text)</label>
                              <input
                                className={`w-full border p-2 rounded text-sm ${itemIsPaymentLocked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                value={item.help || ''}
                                onChange={e => updateItem(item.id, 'help', e.target.value)}
                                disabled={itemIsPaymentLocked}
                              />
                            </div>
                            {(item.type === 'select' || item.type === 'radio' || item.type === 'checkbox') && (
                              <div className="md:col-span-2 bg-white p-4 rounded border border-slate-200">
                                <label className="block text-xs font-bold text-slate-400 mb-2">選択肢設定</label>
                                <div className="space-y-2">
                                  {(item.options || []).map((opt, idx) => (
                                    <div key={idx} className="flex gap-2">
                                      <input
                                        className={`flex-1 border p-2 rounded text-sm ${itemIsPaymentLocked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                        value={opt}
                                        onChange={e => updateOptionText(item.id, idx, e.target.value)}
                                        disabled={itemIsPaymentLocked}
                                      />
                                      <button
                                        onClick={() => removeOption(item.id, idx)}
                                        className={`p-2 rounded ${itemIsPaymentLocked ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}
                                        title="削除"
                                        disabled={itemIsPaymentLocked}
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => addOption(item.id)}
                                    className={`w-full py-2 border-2 border-dashed rounded text-sm font-bold flex items-center justify-center gap-2 transition-colors ${itemIsPaymentLocked ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50' : 'border-slate-300 text-slate-400 hover:bg-slate-50 hover:border-slate-400'}`}
                                    disabled={itemIsPaymentLocked}
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
                                    disabled={itemIsPaymentLocked}
                                  />
                                  <span className="text-xs font-bold text-amber-700">条件を有効にする</span>
                                </div>
                              </div>

                              {item.condition && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 animate-fade-in">
                                  <div>
                                    <label className="block text-[10px] font-bold text-amber-600 mb-1">この質問の回答が...</label>
                                    <select
                                      className={`w-full border p-2 rounded text-xs bg-white ${itemIsPaymentLocked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                      value={item.condition.targetId}
                                      onChange={e => updateCondition(item.id, 'targetId', e.target.value)}
                                      disabled={itemIsPaymentLocked}
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
                                      className={`w-full border p-2 rounded text-xs bg-white ${itemIsPaymentLocked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                      value={item.condition.operator}
                                      onChange={e => updateCondition(item.id, 'operator', e.target.value)}
                                      disabled={itemIsPaymentLocked}
                                    >
                                      <option value="eq">と等しい時 (Equals)</option>
                                      <option value="neq">と異なる時 (Not Equals)</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-amber-600 mb-1">対象の値</label>
                                    {item.condition.targetId && (getOptionsForTarget(item.condition.targetId).length > 0) ? (
                                      <select
                                        className={`w-full border p-2 rounded text-xs bg-white ${itemIsPaymentLocked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                        value={item.condition.value}
                                        onChange={e => updateCondition(item.id, 'value', e.target.value)}
                                        disabled={itemIsPaymentLocked}
                                      >
                                        <option value="">(値を選択)</option>
                                        {getOptionsForTarget(item.condition.targetId).map(val => (
                                          <option key={val} value={val}>{val}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        className={`w-full border p-2 rounded text-xs ${itemIsPaymentLocked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                        placeholder="値を入力"
                                        value={item.condition.value}
                                        onChange={e => updateCondition(item.id, 'value', e.target.value)}
                                        disabled={itemIsPaymentLocked}
                                      />
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )})}
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
          <button onClick={() => onSave(normalizeMakerFormConfig(localConfig))} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg">設定を保存</button>
        </div>
      </div>
    </div >
  );
}


function VisitorFormEditor({ config }) {
  const normalizedConfig = useMemo(() => normalizeVisitorFormConfig(config), [config]);
  const fixedItems = useMemo(
    () => normalizedConfig.items.filter(item => isVisitorFixedQuestion(item)),
    [normalizedConfig.items]
  );

  return (
    <div className="animate-fade-in max-w-3xl mx-auto space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h2 className="text-xl font-bold text-amber-900">事前登録フォーム設定（閲覧のみ）</h2>
        <p className="text-sm text-amber-800 mt-2">
          管理者権限ポリシーにより、質問事項の追加・編集・削除はできません。事前登録フォームは固定7項目で運用されます。
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <p className="text-xs font-bold text-slate-500 mb-1">フォームタイトル</p>
          <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded p-3">{normalizedConfig.title}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 mb-1">説明文</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded p-3">
            {normalizedConfig.description || '-'}
          </p>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <h3 className="font-bold text-slate-700 border-b pb-2 mb-4">固定質問 7項目</h3>
        <div className="space-y-3">
          {fixedItems.map((item, idx) => (
            <div key={item.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-slate-500">
                  項目 {idx + 1} ({item.type})
                </span>
                <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">固定</span>
              </div>
              <p className="text-sm font-bold text-slate-800">{item.label}</p>
              <p className="text-xs text-slate-500 mt-1">{item.help || '補足説明なし'}</p>
              <p className="text-xs mt-2">
                <span className={`font-bold ${item.required ? 'text-red-600' : 'text-slate-500'}`}>
                  {item.required ? '必須' : '任意'}
                </span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const formatExhibitionDateText = (dates = []) => {
  if (!Array.isArray(dates) || dates.length === 0) return '日程未設定';
  return dates
    .map((dateStr) => {
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
    })
    .join(' / ');
};

const formatExhibitionTimeText = (openTime, closeTime) => {
  if (openTime && closeTime) return `${openTime} - ${closeTime}`;
  if (openTime) return `${openTime} -`;
  if (closeTime) return `- ${closeTime}`;
  return '未設定';
};

const isMobileClient = () => /iPhone|iPad|iPod|Android/i.test(window.navigator.userAgent || '');

const openQrImageInNewTab = (imageUrl) => {
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  if (!popup) return false;
  popup.document.write(`
    <!doctype html>
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>入場用QRコード</title>
      </head>
      <body style="margin:0;padding:16px;font-family:sans-serif;background:#f8fafc;color:#0f172a;">
        <p style="margin:0 0 12px;font-size:14px;">画像を長押しして保存してください。</p>
        <img src="${imageUrl}" alt="入場用QRコード" style="width:100%;max-width:420px;height:auto;border:1px solid #cbd5e1;border-radius:12px;background:white;" />
      </body>
    </html>
  `);
  popup.document.close();
  return true;
};

const saveQrImageWithFallback = async ({ imageUrl, fileName, shareText }) => {
  if (!imageUrl) {
    alert('QR画像を準備中です。数秒後にもう一度お試しください。');
    return;
  }

  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: '入場用QRコード',
        text: shareText,
        files: [file]
      });
      return;
    }
  } catch (error) {
    console.error('QR share failed', error);
  }

  if (isMobileClient() && openQrImageInNewTab(imageUrl)) {
    return;
  }

  const link = document.createElement('a');
  link.href = imageUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function SimulatedPublicVisitorForm({ config, exhibition, onClose, onSubmit }) {
  const [formData, setFormData] = useState({});
  const [submittedData, setSubmittedData] = useState(null);
  const [qrImageUrl, setQrImageUrl] = useState('');
  const qrCanvasRef = useRef(null);
  const normalizedConfig = useMemo(() => getPublicVisitorFormConfig(config), [config]);
  const isContactDisabled = isContactDisabledByVisitorType(formData.type);
  const isCompanyNameDisabled = isCompanyNameDisabledByVisitorType(formData.type);
  const exhibitionDateText = useMemo(() => formatExhibitionDateText(exhibition?.dates), [exhibition?.dates]);
  const exhibitionTimeText = useMemo(() => formatExhibitionTimeText(exhibition?.openTime, exhibition?.closeTime), [exhibition?.openTime, exhibition?.closeTime]);

  const handleChange = (id, val) => {
    const next = { ...formData, [id]: val };
    setFormData(normalizeVisitorContactFields(next));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData[PRIVACY_CONSENT_ITEM_ID]) {
      alert('個人情報の取り扱いへの同意が必要です。');
      return;
    }
    // Simulate ID generation
    const newId = crypto.randomUUID();
    const finalData = { ...normalizeVisitorContactFields(formData), id: newId, status: 'registered' };

    onSubmit(finalData);
    setSubmittedData(finalData);
  };

  useEffect(() => {
    if (!submittedData?.id) return;
    setQrImageUrl('');
    let rafId = null;
    const generateQrImage = () => {
      const canvas = qrCanvasRef.current?.querySelector('canvas');
      if (!canvas) {
        rafId = requestAnimationFrame(generateQrImage);
        return;
      }
      try {
        setQrImageUrl(canvas.toDataURL('image/png'));
      } catch (error) {
        console.error('QR image conversion failed', error);
      }
    };
    rafId = requestAnimationFrame(generateQrImage);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [submittedData?.id]);

  if (submittedData) {
    return (
      <div className="fixed inset-0 bg-slate-900/90 z-[90] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up relative p-8 text-center">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X /></button>
          <div className="mb-4 text-green-500 flex justify-center"><CheckCircle size={64} /></div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">登録完了</h2>
          <p className="text-slate-600 text-sm mb-4">ご来場ありがとうございます。<br />以下のQRコードを保存し、当日受付でご提示ください。</p>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-left text-sm mb-4">
            <div className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-1">
              <span className="text-slate-500">展示会名</span>
              <span className="font-bold text-slate-800 break-words">{exhibition?.title || '展示会'}</span>
              <span className="text-slate-500">会場名</span>
              <span className="font-bold text-slate-800 break-words">{exhibition?.place || '未設定'}</span>
              <span className="text-slate-500">住所</span>
              <span className="font-bold text-slate-800 break-words">{exhibition?.venueAddress || '未設定'}</span>
              <span className="text-slate-500">開催日時</span>
              <span className="font-bold text-slate-800 break-words">{exhibitionDateText} / {exhibitionTimeText}</span>
            </div>
          </div>

          <p className="text-xs font-bold text-red-600 mb-4">※入場にはQRコードの提示が必須です。QRコードがない場合は入場できません。</p>

          <div className="bg-white p-4 rounded-xl border-2 border-slate-100 inline-block mb-4 shadow-sm">
            {qrImageUrl ? (
              <img src={qrImageUrl} alt="入場用QRコード" className="w-[200px] h-[200px] object-contain" />
            ) : (
              <div ref={qrCanvasRef}>
                <QRCodeCanvas
                  value={JSON.stringify({ id: submittedData.id, type: 'visitor', name: submittedData.repName })}
                  size={200}
                  level={"H"}
                  includeMargin={true}
                />
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400 mb-3 font-mono">ID: {submittedData.id.slice(0, 8)}...</p>

          <button
            onClick={() => saveQrImageWithFallback({
              imageUrl: qrImageUrl,
              fileName: `visitor_qr_${submittedData.id}.png`,
              shareText: '入場時にこのQRコードを提示してください。'
            })}
            className="mb-2 w-full border border-blue-200 text-blue-600 font-bold py-2 rounded-lg hover:bg-blue-50 text-sm flex items-center justify-center gap-2"
          >
            <Download size={16} /> 画像として保存
          </button>
          <p className="text-xs text-slate-400 mb-6">
            ※ボタンで保存できない場合は、画像を長押しして保存してください。<br />
            それでも難しい場合はスクリーンショットで保存をお願い致します。
          </p>

          <button onClick={onClose} className="w-full bg-slate-800 text-white font-bold py-3 rounded-lg hover:bg-slate-700 transition-colors">閉じる</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/90 z-[90] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg my-8 overflow-hidden animate-slide-up relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-blue-200 bg-black/20 rounded-full p-1"><X size={20} /></button>
        <div className="bg-blue-600 p-8 text-white"><h2 className="text-2xl font-bold mb-2">{normalizedConfig.title}</h2><p className="text-blue-100 text-sm">{normalizedConfig.description}</p></div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
          {normalizedConfig.items && normalizedConfig.items.map(item => {
            if (item.id === PRIVACY_CONSENT_ITEM_ID) {
              return (
                <VisitorPrivacyConsentField
                  key={item.id}
                  checked={!!formData[item.id]}
                  onChange={(checked) => handleChange(item.id, checked)}
                  required={item.required !== false}
                />
              );
            }
            const disabledField =
              (isContactDisabled && (item.id === 'phone' || item.id === 'email')) ||
              (isCompanyNameDisabled && item.id === 'companyName');
            const requiredField = disabledField ? false : item.required;
            const baseClass = `w-full border border-slate-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 ${disabledField ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'}`;
            return (
              <div key={item.id}>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  {item.label} {requiredField && <span className="text-red-500">*</span>}
                </label>
                {item.type === 'select' ? (
                  <select
                    required={requiredField}
                    className={baseClass}
                    onChange={e => handleChange(item.id, e.target.value)}
                    value={formData[item.id] || ''}
                    disabled={disabledField}
                  >
                    <option value="">選択してください</option>
                    {item.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    type={item.type}
                    required={requiredField}
                    className={baseClass}
                    placeholder={disabledField ? '対象外' : item.help}
                    onChange={e => handleChange(item.id, e.target.value)}
                    value={formData[item.id] || ''}
                    disabled={disabledField}
                  />
                )}
                {item.help && item.type !== 'text' && !disabledField && <p className="text-xs text-slate-400 mt-1">{item.help}</p>}
              </div>
            );
          })}
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
    moveInDate: getInitVal('moveInDate'),
    itemsDesk: getInitVal('itemsDesk') || getInitVal('desk'),
    itemsChair: getInitVal('itemsChair') || getInitVal('chair'),
    itemsPower: getInitVal('itemsPower') || getInitVal('power'),
    powerDetail: getInitVal('powerDetail') || getInitVal('powerDetails'),
    note: getInitVal('note'),
    products: getInitVal('products') // 展示品
  });

  const handleChange = (k, v) => setFormData(prev => ({ ...prev, [k]: v }));
  const moveInDateOptions = ['前日搬入', '当日搬入'];

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
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">搬入日時</label>
              <select className="w-full border p-2 rounded bg-white" value={formData.moveInDate || ''} onChange={e => handleChange('moveInDate', e.target.value)}>
                <option value="">未設定</option>
                {formData.moveInDate && !moveInDateOptions.includes(formData.moveInDate) && (
                  <option value={formData.moveInDate}>{formData.moveInDate}</option>
                )}
                {moveInDateOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
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
  const [isAssigneeFilterEnabled, setIsAssigneeFilterEnabled] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const UNASSIGNED_FILTER_VALUE = '__unassigned__';

  // Constants
  const START_HOUR = 6;
  const END_HOUR = 22;
  const HOURS_COUNT = END_HOUR - START_HOUR;
  const BASE_HOUR_HEIGHT = 80;

  const hourHeight = BASE_HOUR_HEIGHT * zoomLevel;
  const totalHeight = hourHeight * HOURS_COUNT;
  const staffMembers = useMemo(
    () => (staff || '').split(',').map(s => s.trim()).filter(Boolean),
    [staff]
  );

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

  const splitAssignees = (assigneeRaw) =>
    String(assigneeRaw || '')
      .split(',')
      .map(name => name.trim())
      .filter(Boolean);

  const unassignedTaskCount = useMemo(() => {
    const dayBeforeItems = activeSchedule.dayBefore || [];
    const eventDayItems = activeSchedule.eventDay || [];
    return [...dayBeforeItems, ...eventDayItems].filter(item => splitAssignees(item?.assignee).length === 0).length;
  }, [activeSchedule]);

  const hasUnassignedItems = unassignedTaskCount > 0;

  const assigneeFilterOptions = useMemo(() => {
    const options = staffMembers.map(member => ({ value: member, label: member }));
    if (hasUnassignedItems) {
      options.unshift({ value: UNASSIGNED_FILTER_VALUE, label: `未割当 (${unassignedTaskCount})` });
    }
    return options;
  }, [staffMembers, hasUnassignedItems, unassignedTaskCount]);

  useEffect(() => {
    if (!isAssigneeFilterEnabled) return;
    if (assigneeFilterOptions.length === 0) {
      setSelectedAssignee('');
      return;
    }
    const hasSelectedOption = assigneeFilterOptions.some(option => option.value === selectedAssignee);
    if (!selectedAssignee || !hasSelectedOption) {
      setSelectedAssignee(assigneeFilterOptions[0].value);
    }
  }, [isAssigneeFilterEnabled, selectedAssignee, assigneeFilterOptions]);

  const shouldShowByAssigneeFilter = (item) => {
    if (!isAssigneeFilterEnabled) return true;
    if (!selectedAssignee) return false;
    const assignees = splitAssignees(item?.assignee);
    if (selectedAssignee === UNASSIGNED_FILTER_VALUE) {
      return assignees.length === 0;
    }
    return assignees.includes(selectedAssignee);
  };

  const filteredDayBeforeItems = (activeSchedule.dayBefore || []).filter(shouldShowByAssigneeFilter);
  const filteredEventDayItems = (activeSchedule.eventDay || []).filter(shouldShowByAssigneeFilter);

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
              const isUnassignedItem = splitAssignees(item?.assignee).length === 0;
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
                  className={`schedule-item absolute left-10 right-2 rounded-lg border shadow-sm p-1 px-2 cursor-pointer hover:shadow-md transition-all z-10 overflow-hidden ${
                    isUnassignedItem
                      ? 'bg-rose-100 border-rose-300 hover:bg-rose-200'
                      : 'bg-blue-100 border-blue-300 hover:bg-blue-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`font-bold text-xs ${isUnassignedItem ? 'text-rose-800' : 'text-blue-800'}`}>
                      {item.time}{item.endTime && ` - ${item.endTime}`}
                    </span>
                  </div>
                  <div className="font-bold text-sm text-slate-800 leading-tight truncate">{item.title}</div>
                  <div className={`text-[10px] truncate flex items-center gap-1 font-bold ${isUnassignedItem ? 'text-rose-700' : 'text-slate-500'}`}>
                    <Users size={10} className={isUnassignedItem ? 'text-rose-600' : ''} /> {item.assignee || '未割当'}
                  </div>
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (assigneeFilterOptions.length === 0) return;
                setIsAssigneeFilterEnabled(prev => {
                  const next = !prev;
                  if (next && !selectedAssignee) setSelectedAssignee(assigneeFilterOptions[0]?.value || '');
                  return next;
                });
              }}
              disabled={assigneeFilterOptions.length === 0}
              className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors ${
                assigneeFilterOptions.length === 0
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : isAssigneeFilterEnabled
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
              title={assigneeFilterOptions.length === 0 ? '担当者を設定したタスクがあると利用できます' : '担当者で絞り込み'}
            >
              {isAssigneeFilterEnabled ? '担当者のみ表示' : '全体表示'}
            </button>
            {hasUnassignedItems && (
              <span className="px-2 py-1 text-[11px] font-bold rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                未割当 {unassignedTaskCount}件
              </span>
            )}
            {isAssigneeFilterEnabled && (
              <select
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
                className={`px-2 py-1 text-xs font-bold border rounded-lg outline-none ${
                  selectedAssignee === UNASSIGNED_FILTER_VALUE
                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                    : 'border-blue-200 bg-blue-50 text-blue-700'
                }`}
              >
                {assigneeFilterOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            )}
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
            items={filteredDayBeforeItems}
            dateLabel={preDates?.join(', ')}
            colorClass="border-amber-400 text-amber-700 bg-amber-50"
          />
        </div>
        <div className={`flex-1 min-h-[500px] md:h-full md:min-h-0 ${mobileActiveTab === 'eventDay' ? 'block' : 'hidden md:block'}`}>
          <TimelineColumn
            title="開催当日"
            type="eventDay"
            items={filteredEventDayItems}
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
  const detailsSyncTimerRef = useRef(null);
  const detailsPropRef = useRef(details);
  const latestDetailsPayloadRef = useRef(null);
  const hasPendingDetailsSyncRef = useRef(false);

  useEffect(() => {
    detailsPropRef.current = details;
  }, [details]);

  // Sync to parent
  useEffect(() => {
    latestDetailsPayloadRef.current = {
      ...detailsPropRef.current,
      cost: venueFee,
      notes,
      layoutImage,
      layoutData, // Save layout vector data
      rentals,
      supplies,
      equipment: rentals.filter(r => r.count > 0) // For budget tab compatibility
    };

    if (detailsSyncTimerRef.current) {
      clearTimeout(detailsSyncTimerRef.current);
    }
    hasPendingDetailsSyncRef.current = true;
    detailsSyncTimerRef.current = setTimeout(() => {
      detailsSyncTimerRef.current = null;
      hasPendingDetailsSyncRef.current = false;
      setDetails(latestDetailsPayloadRef.current);
    }, 700);

    return () => {
      if (detailsSyncTimerRef.current) {
        clearTimeout(detailsSyncTimerRef.current);
        detailsSyncTimerRef.current = null;
      }
    };
  }, [venueFee, notes, layoutImage, rentals, supplies, layoutData, setDetails]);

  useEffect(() => {
    return () => {
      if (detailsSyncTimerRef.current) {
        clearTimeout(detailsSyncTimerRef.current);
        detailsSyncTimerRef.current = null;
      }
      if (hasPendingDetailsSyncRef.current && latestDetailsPayloadRef.current) {
        hasPendingDetailsSyncRef.current = false;
        setDetails(latestDetailsPayloadRef.current);
      }
    };
  }, [setDetails]);

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
function TabMakers({ exhibition, setMakers, updateMainData, masterMakers, onNavigate, storage, allExhibitions = [] }) {
  const [activeTab, setActiveTab] = useState('invited'); // invited, confirmed, declined, unanswered
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // const [csvImporting, setCsvImporting] = useState(false); // Removed CSV import state
  const [showFormSettings, setShowFormSettings] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(null); // For Maker Detail Modal
  const [confirmedFilter, setConfirmedFilter] = useState('all'); // 'all', 'power', 'lunch'
  const [editingMaker, setEditingMaker] = useState(null); // 編集中のメーカー
  const [selectedMakerIds, setSelectedMakerIds] = useState(new Set());
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [selectedAiRecommendationCodes, setSelectedAiRecommendationCodes] = useState(new Set());
  const [aiRecommendationGeneratedAt, setAiRecommendationGeneratedAt] = useState(0);
  const [layoutPdfUrlDraft, setLayoutPdfUrlDraft] = useState(exhibition.documents?.layoutPdf?.url || '');
  const [flyerPdfUrlDraft, setFlyerPdfUrlDraft] = useState(exhibition.documents?.flyerPdf?.url || '');
  const layoutPdfSaveTimerRef = useRef(null);
  const flyerPdfSaveTimerRef = useRef(null);

  const makers = exhibition.makers || [];
  const formConfig = normalizeMakerFormConfig(exhibition.formConfig);
  const [isSendingDocs, setIsSendingDocs] = useState(false);
  const normalizeCode = (rawCode) => String(rawCode || '').trim();
  const {
    isBulkInvoiceDownloading,
    bulkInvoiceProgress,
    handleDownloadInvoice,
    handleDownloadInvoicesBulk
  } = useInvoiceDownloads({
    makers,
    exhibition,
    formConfig,
    extractNum
  });

  const clearDocumentSaveTimer = (docKey) => {
    const targetRef = docKey === 'layoutPdf' ? layoutPdfSaveTimerRef : flyerPdfSaveTimerRef;
    if (targetRef.current) {
      clearTimeout(targetRef.current);
      targetRef.current = null;
    }
  };

  const saveDocumentUrl = (docKey, nextUrl) => {
    const docs = exhibition.documents || {};
    const currentDoc = docs[docKey] || {};
    const normalizedNextUrl = String(nextUrl || '');
    const normalizedCurrentUrl = String(currentDoc.url || '');
    if (normalizedNextUrl === normalizedCurrentUrl) return;
    const newDocs = {
      ...docs,
      [docKey]: { ...currentDoc, url: normalizedNextUrl, uploadedAt: new Date().toISOString() }
    };
    updateMainData('documents', JSON.parse(JSON.stringify(newDocs)));
  };

  const scheduleDocumentUrlSave = (docKey, nextUrl) => {
    clearDocumentSaveTimer(docKey);
    const targetRef = docKey === 'layoutPdf' ? layoutPdfSaveTimerRef : flyerPdfSaveTimerRef;
    targetRef.current = setTimeout(() => {
      targetRef.current = null;
      saveDocumentUrl(docKey, nextUrl);
    }, 700);
  };

  const flushDocumentUrlSave = (docKey, nextUrl) => {
    clearDocumentSaveTimer(docKey);
    saveDocumentUrl(docKey, nextUrl);
  };

  useEffect(() => {
    setLayoutPdfUrlDraft(exhibition.documents?.layoutPdf?.url || '');
  }, [exhibition.id, exhibition.documents?.layoutPdf?.url]);

  useEffect(() => {
    setFlyerPdfUrlDraft(exhibition.documents?.flyerPdf?.url || '');
  }, [exhibition.id, exhibition.documents?.flyerPdf?.url]);

  useEffect(() => {
    return () => {
      if (layoutPdfSaveTimerRef.current) clearTimeout(layoutPdfSaveTimerRef.current);
      if (flyerPdfSaveTimerRef.current) clearTimeout(flyerPdfSaveTimerRef.current);
    };
  }, []);

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

  const { filteredMakers, stats, aggregates } = useMakerViewModel({
    makers,
    searchTerm,
    activeTab,
    confirmedFilter
  });


  const {
    handleSendInvitations,
    handleCloseReception,
    handleDeleteInvitation,
    handleBulkDelete,
    handleNormalizeMakers
  } = useMakerActions({
    makers,
    setMakers,
    formConfig,
    selectedMakerIds,
    setSelectedMakerIds
  });

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
      await exportConfirmedMakersExcel({
        makers,
        formConfig,
        exhibitionId: exhibition?.id,
        origin: window.location.origin
      });
    } catch (e) {
      console.error(e);
      alert('Excel出力エラー: ' + e.message);
    }
  };

  const handleExportAccountingExcel = async () => {
    try {
      await exportConfirmedMakersAccountingExcel({
        makers,
        formConfig,
        exhibitionTitle: exhibition?.title
      });
    } catch (e) {
      console.error(e);
      alert('経理用Excel出力エラー: ' + e.message);
    }
  };

  const handleGenerateAiRecommendations = () => {
    const recommendations = buildAiInviteRecommendations({
      masterMakers,
      currentMakers: makers,
      allExhibitions,
      currentExhibitionId: exhibition.id,
      limit: 30
    });

    setAiRecommendations(recommendations);
    setSelectedAiRecommendationCodes(new Set(recommendations.map((item) => item.code)));
    setAiRecommendationGeneratedAt(Date.now());

    if (recommendations.length === 0) {
      alert('提案対象の企業が見つかりませんでした（全て招待リスト登録済み、または企業マスター未登録）。');
    }
  };

  const toggleAiRecommendation = (code) => {
    setSelectedAiRecommendationCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleSelectAllAiRecommendations = () => {
    if (selectedAiRecommendationCodes.size === aiRecommendations.length) {
      setSelectedAiRecommendationCodes(new Set());
    } else {
      setSelectedAiRecommendationCodes(new Set(aiRecommendations.map((item) => item.code)));
    }
  };

  const handleApplyAiRecommendations = () => {
    const selectedRecommendations = aiRecommendations.filter((item) => selectedAiRecommendationCodes.has(item.code));
    if (selectedRecommendations.length === 0) {
      alert('追加する企業を選択してください。');
      return;
    }

    const existingCodes = new Set(makers.map((maker) => normalizeCode(maker.code)).filter(Boolean));
    const candidatesToAdd = selectedRecommendations.filter((item) => !existingCodes.has(item.code));

    if (candidatesToAdd.length === 0) {
      alert('選択された企業は既に招待リストに追加されています。');
      return;
    }

    if (!window.confirm(`これらの企業を追加しますか？\n${candidatesToAdd.length}社を招待リストに追加します。`)) {
      return;
    }

    const generatedAtIso = new Date().toISOString();
    const newMakers = candidatesToAdd.map((item) => ({
      id: crypto.randomUUID(),
      code: item.code,
      companyName: item.companyName,
      category: item.category || 'その他',
      status: 'listed',
      invitationSentAt: null,
      response: {},
      note: `[AI提案] ${item.reason}`,
      aiRecommendation: {
        score: item.score,
        invitedCount: item.invitedCount,
        confirmedCount: item.confirmedCount,
        declinedCount: item.declinedCount,
        participationRate: item.participationRate,
        declineRate: item.declineRate,
        generatedAt: generatedAtIso
      }
    }));

    setMakers([...makers, ...newMakers]);
    const addedCodeSet = new Set(newMakers.map((item) => item.code));
    setAiRecommendations((prev) => prev.filter((item) => !addedCodeSet.has(item.code)));
    setSelectedAiRecommendationCodes((prev) => new Set([...prev].filter((code) => !addedCodeSet.has(code))));
    alert(`${newMakers.length}社を招待リストに追加しました。`);
  };

  const handleExportInvitedExcel = async () => {
    try {
      const result = await exportInvitedMakersExcel({
        makers,
        exhibitionId: exhibition.id,
        exhibitionTitle: exhibition.title,
        origin: window.location.origin
      });
      if (!result.exported) {
        alert('出力対象のデータがありません');
      }
    } catch (e) {
      console.error(e);
      alert('Excel出力エラー: ' + e.message);
    }
  };

  // Invoice download handlers are provided by src/features/invoice/useInvoiceDownloads.js

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

  // Reset selection when tab changes
  useEffect(() => {
    setSelectedMakerIds(new Set());
  }, [activeTab]);

  useEffect(() => {
    if (aiRecommendations.length === 0) return;

    const existingCodes = new Set(makers.map((maker) => normalizeCode(maker.code)).filter(Boolean));
    const remaining = aiRecommendations.filter((item) => !existingCodes.has(item.code));

    if (remaining.length !== aiRecommendations.length) {
      setAiRecommendations(remaining);
      setSelectedAiRecommendationCodes((prev) => new Set([...prev].filter((code) => !existingCodes.has(code))));
    }
  }, [aiRecommendations, makers]);

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
                        clearDocumentSaveTimer('layoutPdf');
                        setLayoutPdfUrlDraft('');
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
                  value={layoutPdfUrlDraft}
                  onChange={(e) => {
                    const nextUrl = e.target.value;
                    setLayoutPdfUrlDraft(nextUrl);
                    scheduleDocumentUrlSave('layoutPdf', nextUrl);
                  }}
                  onBlur={() => flushDocumentUrlSave('layoutPdf', layoutPdfUrlDraft)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    flushDocumentUrlSave('layoutPdf', layoutPdfUrlDraft);
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
                        clearDocumentSaveTimer('flyerPdf');
                        setFlyerPdfUrlDraft('');
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
                  value={flyerPdfUrlDraft}
                  onChange={(e) => {
                    const nextUrl = e.target.value;
                    setFlyerPdfUrlDraft(nextUrl);
                    scheduleDocumentUrlSave('flyerPdf', nextUrl);
                  }}
                  onBlur={() => flushDocumentUrlSave('flyerPdf', flyerPdfUrlDraft)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    flushDocumentUrlSave('flyerPdf', flyerPdfUrlDraft);
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
                  onClick={handleGenerateAiRecommendations}
                  className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 shadow-sm whitespace-nowrap"
                  title="企業管理コンソール未追加企業から、参加可能性の高い企業を提案します"
                >
                  <Wand2 size={16} /> AI提案
                </button>
                <button
                  onClick={handleNormalizeMakers}
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 shadow-sm whitespace-nowrap"
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
                <button onClick={handleExportAccountingExcel} className="flex items-center gap-2 bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-800 shadow-sm whitespace-nowrap">
                  <FileSpreadsheet size={16} /> 経理用Excel
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

        {/* AI Recommendation Panel */}
        {activeTab === 'invited' && (aiRecommendations.length > 0 || aiRecommendationGeneratedAt > 0) && (
          <div className="border-b border-indigo-100 bg-indigo-50/50 p-4 animate-fade-in">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
              <h4 className="font-bold text-indigo-800 flex items-center gap-2">
                <Wand2 size={16} />
                AIアドバイス: 招待候補ランキング
              </h4>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-white border border-indigo-200 text-indigo-700 font-bold">
                  提案 {aiRecommendations.length}社 (最大30社)
                </span>
                <span className="px-2 py-1 rounded-full bg-white border border-indigo-200 text-indigo-700 font-bold">
                  選択 {selectedAiRecommendationCodes.size}社
                </span>
                {aiRecommendationGeneratedAt > 0 && (
                  <span className="text-slate-500">
                    生成: {new Date(aiRecommendationGeneratedAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {aiRecommendations.length === 0 ? (
              <p className="text-sm text-slate-500">提案対象の企業はありませんでした。必要に応じて「AI提案」を再実行してください。</p>
            ) : (
              <>
                <div className="overflow-x-auto bg-white rounded-lg border border-indigo-100">
                  <table className="w-full text-xs">
                    <thead className="bg-indigo-50 text-indigo-800">
                      <tr>
                        <th className="p-2 text-center w-10">
                          <input
                            type="checkbox"
                            checked={aiRecommendations.length > 0 && selectedAiRecommendationCodes.size === aiRecommendations.length}
                            onChange={toggleSelectAllAiRecommendations}
                            className="w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </th>
                        <th className="p-2 text-center w-12">順位</th>
                        <th className="p-2 text-left w-24">コード</th>
                        <th className="p-2 text-left min-w-[220px]">会社名</th>
                        <th className="p-2 text-right w-24">AIスコア</th>
                        <th className="p-2 text-right w-20">参加回数</th>
                        <th className="p-2 text-right w-20">辞退率</th>
                        <th className="p-2 text-left min-w-[260px]">提案理由</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-50">
                      {aiRecommendations.map((item) => (
                        <tr key={item.code} className={selectedAiRecommendationCodes.has(item.code) ? 'bg-indigo-50/40' : 'hover:bg-slate-50'}>
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedAiRecommendationCodes.has(item.code)}
                              onChange={() => toggleAiRecommendation(item.code)}
                              className="w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-2 text-center font-bold text-indigo-700">{item.rank}</td>
                          <td className="p-2 font-mono text-slate-700">{item.code}</td>
                          <td className="p-2 text-slate-800 font-bold">{item.companyName}</td>
                          <td className="p-2 text-right font-bold text-indigo-700">{item.score}</td>
                          <td className="p-2 text-right text-slate-700">{item.confirmedCount}回</td>
                          <td className="p-2 text-right text-slate-700">{item.declineRate}%</td>
                          <td className="p-2 text-slate-600">{item.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setAiRecommendations([]);
                      setSelectedAiRecommendationCodes(new Set());
                    }}
                    className="px-4 py-2 border border-slate-300 bg-white text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50"
                  >
                    提案を閉じる
                  </button>
                  <button
                    onClick={handleApplyAiRecommendations}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-sm"
                  >
                    これらの企業を追加
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Confirmed Aggregates Bar */}
        {activeTab === 'confirmed' && (
          <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex flex-wrap gap-6 text-sm text-emerald-800 animate-fade-in shadow-inner">
            <div className="font-bold flex items-center gap-2 bg-white/50 px-3 py-1 rounded-lg"><LayoutGrid size={16} /> コマ数合計: <span className="text-xl text-emerald-700">{aggregates.totalBooths}</span></div>
            <div className="font-bold flex items-center gap-2 bg-white/50 px-3 py-1 rounded-lg"><Users size={16} /> 参加人数: <span className="text-xl text-emerald-700">{aggregates.totalPeople}</span></div>
            <div className="flex items-center gap-2 bg-white/50 px-3 py-1 rounded-lg"><span className="text-emerald-600">弁当:</span> <strong>{aggregates.totalLunch}</strong></div>
            <div className="flex items-center gap-2 bg-white/50 px-3 py-1 rounded-lg"><span className="text-emerald-600">長机:</span> <strong>{aggregates.totalDesks}</strong></div>
            <div className="flex items-center gap-2 bg-white/50 px-3 py-1 rounded-lg"><span className="text-emerald-600">椅子:</span> <strong>{aggregates.totalChairs}</strong></div>
            <div className="flex items-center gap-2 bg-white/50 px-3 py-1 rounded-lg"><span className="text-emerald-600">電源:</span> <strong>{aggregates.totalPower}</strong></div>
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
                      const makerCode = String(m.code || '').trim();
                      const masterMaker = makerCode
                        ? masterMakers.find(mm => String(mm.code || '').trim() === makerCode)
                        : null;
                      if (makerCode && masterMaker) {
                        return (
                          <div className="flex items-center gap-2">
                            <a href={`${window.location.origin}${window.location.pathname}?mode=maker&code=${makerCode}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                              <LinkIcon size={12} /> ポータル
                            </a>
                            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?mode=maker&code=${makerCode}`); alert('URLをコピーしました'); }} className="text-slate-400 hover:text-blue-500" title="URLをコピー">
                              <Copy size={12} />
                            </button>
                          </div>
                        );
                      }
                      return <span className="text-slate-400">{makerCode ? '未登録' : '未登録 (No Code)'}</span>;
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
        <MakerDetailModal
          maker={showDetailModal}
          onClose={() => setShowDetailModal(null)}
          onEdit={(maker) => setEditingMaker(maker)}
        />
      )}

      {/* Edit Modal */}
      {editingMaker && (
        <MakerDataEditModal
          maker={editingMaker}
          onSave={handleSaveMakerData}
          onClose={() => setEditingMaker(null)}
        />
      )}

      {showFormSettings && <FormEditorModal config={formConfig} exhibition={exhibition} onSave={(newConfig) => { updateMainData('formConfig', normalizeMakerFormConfig(newConfig)); setShowFormSettings(false); }} onClose={() => setShowFormSettings(false)} />}
    </div >
  );
}

// TabEntrance: QRスキャン実装 (修正版: 連打防止・URL表示)
function TabEntrance({ exhibition, updateVisitorCount, visitors, setVisitors, updateMainData, updateBatch, initialMode }) {
  const { formUrlVisitor, visitorFormConfig } = exhibition;
  const normalizedVisitorFormConfig = useMemo(() => normalizeVisitorFormConfig(visitorFormConfig), [visitorFormConfig]);
  const canonicalVisitorFormUrl = useMemo(() => buildVisitorRegisterUrl(exhibition.id), [exhibition.id]);
  const [mode, setMode] = useState(initialMode || 'dashboard');
  const [showSimulatedPublicForm, setShowSimulatedPublicForm] = useState(false);
  const [lastScannedVisitor, setLastScannedVisitor] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
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

  // Copy function for TabEntrance
  const copyVisitorFormUrl = () => {
    const urlToCopy = canonicalVisitorFormUrl;
    if (!urlToCopy) return;
    navigator.clipboard.writeText(urlToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const currentUrl = (formUrlVisitor || '').trim();
    if (currentUrl === canonicalVisitorFormUrl) return;
    updateMainData('formUrlVisitor', canonicalVisitorFormUrl);
  }, [canonicalVisitorFormUrl, formUrlVisitor, updateMainData]);

  // 実機スキャン用ハンドラ (react-qr-scanner用) - 修正版
  const handleRealScan = (dataString) => {
    if (!dataString) return;

    // クールダウン処理（2秒間は再スキャンしない）
    const now = Date.now();
    if (now - lastScanTime.current < 2000) return;
    lastScanTime.current = now;

    let searchId = String(dataString).trim();
    try {
      const parsed = JSON.parse(searchId);
      if (typeof parsed === 'string' && parsed.trim()) {
        searchId = parsed.trim();
      } else if (parsed && typeof parsed === 'object' && parsed.id) {
        searchId = String(parsed.id).trim();
      }
    } catch {
      // JSON形式でない場合は、そのままID文字列として扱う
    }

    if (!searchId) return;

    const exists = visitors.find(v => v.id === searchId);

    if (exists) {
      if (exists.status !== 'checked-in') {
        const checkedInAt = Date.now();
        const updated = visitors.map(v => v.id === searchId ? { ...v, status: 'checked-in', checkedIn: true, checkedInAt } : v);
        updateMainData('visitors', updated);
        updateVisitorCount(exhibition.id, exhibition.currentVisitors + 1);
        setLastScannedVisitor({ ...exists, status: 'checked-in', checkedIn: true, checkedInAt, isNew: false });
      } else {
        setLastScannedVisitor({ ...exists, msg: '既に入場済みです' });
      }
    } else {
      alert("未登録のQRコードです");
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
        <button onClick={() => setMode('editForm')} className={`flex-1 md:flex-none text-left px-4 py-3 rounded-lg font-bold flex items-center justify-center md:justify-start gap-2 whitespace-nowrap ${mode === 'editForm' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-600'}`}><Settings size={18} /> <span className="hidden md:inline">登録フォーム（閲覧のみ）</span><span className="md:hidden">閲覧</span></button>
      </div>

      <div className="flex-1 overflow-y-auto bg-white p-4 md:p-8">

        {/* 事前登録URL表示エリア */}
        <div className="bg-slate-900 text-slate-300 rounded-xl p-5 mb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full">
              <h4 className="font-bold text-white mb-1 flex items-center gap-2"><QrCode size={18} /> 事前登録用フォーム</h4>
              <div className="mt-2 flex gap-2">
                <div className="relative w-full">
                  <input
                    type="text"
                    value={canonicalVisitorFormUrl}
                    readOnly
                    className="bg-slate-800 text-blue-300 text-xs px-3 py-2 rounded border border-slate-700 w-full focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="https://..."
                  />
                </div>
                <button className={`px-3 py-2 rounded text-xs flex items-center gap-1 shrink-0 transition-colors ${isCopied ? 'bg-green-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`} onClick={copyVisitorFormUrl}>{isCopied ? <Check size={14} /> : <Copy size={14} />} {isCopied ? '完了' : 'コピー'}</button>
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
                            const updatedVisitors = visitors.filter(item => item.id !== v.id);
                            const updatedScanLogs = (exhibition.scanLogs || []).filter((log) => log?.visitorId !== v.id);
                            const checkedInCount = updatedVisitors.filter(
                              (item) => item?.status === 'checked-in' || item?.checkedIn
                            ).length;

                            if (typeof updateBatch === 'function') {
                              updateBatch({
                                visitors: updatedVisitors,
                                scanLogs: updatedScanLogs,
                                currentVisitors: checkedInCount
                              });
                            } else {
                              updateMainData('visitors', updatedVisitors);
                              updateMainData('scanLogs', updatedScanLogs);
                              updateVisitorCount(exhibition.id, checkedInCount);
                            }
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

        {mode === 'editForm' && <VisitorFormEditor config={normalizedVisitorFormConfig} />}
      </div>
      {showSimulatedPublicForm && <SimulatedPublicVisitorForm config={normalizedVisitorFormConfig} exhibition={exhibition} onClose={() => setShowSimulatedPublicForm(false)} onSubmit={handlePublicRegister} />}
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
  const targetProfitValue = Number(exhibition.targetProfit) || 0;
  const profitGap = finalBalance - targetProfitValue;
  const profitAchievementRate = targetProfitValue > 0 ? (finalBalance / targetProfitValue) * 100 : 0;
  const confirmedBoothTotal = confirmedMakers.reduce((sum, maker) => sum + extractNum(maker.boothCount), 0);

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
  const resolveGoogleMapsUrl = () => {
    const raw = (exhibition.googleMapsUrl || '').trim();
    if (raw) {
      try {
        const parsed = new URL(raw);
        const host = parsed.hostname.toLowerCase();
        const isGoogleComHost = host.includes('google.com');
        const isMapsAppHost = host === 'maps.app.goo.gl' || host.endsWith('.maps.app.goo.gl');
        const isGoogleShortHost = host === 'goo.gl' || host.endsWith('.goo.gl');
        const isMapsPath =
          parsed.pathname.includes('/maps') ||
          parsed.pathname.includes('/search') ||
          parsed.pathname.includes('/place');
        if (
          isMapsAppHost ||
          (isGoogleComHost && isMapsPath) ||
          (isGoogleShortHost && parsed.pathname.includes('/maps'))
        ) {
          return raw;
        }
      } catch (_) {
        // ignore malformed URL and fallback below
      }
    }
    if (!mapQuery) return '';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  };
  const googleMapsLinkUrl = resolveGoogleMapsUrl();

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
          <div className="text-slate-600 text-sm font-bold mt-1">総コマ数: {confirmedBoothTotal.toLocaleString()}コマ</div>
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
          <div className="text-slate-500 text-xs mt-1">目標利益: ¥{targetProfitValue.toLocaleString()}</div>
          <div className={`text-xs font-bold mt-1 ${profitGap >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            乖離: {profitGap >= 0 ? '+' : '-'}¥{Math.abs(profitGap).toLocaleString()}
            {targetProfitValue > 0 ? ` (${profitAchievementRate.toFixed(1)}%)` : ''}
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
                  {googleMapsLinkUrl && (
                    <a href={googleMapsLinkUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1"><Map size={14} /> Googleマップで開く</a>
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
  const visitorFormConfig = useMemo(() => getPublicVisitorFormConfig(exhibition?.visitorFormConfig), [exhibition?.visitorFormConfig]);
  const [formData, setFormData] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [qrImageUrl, setQrImageUrl] = useState('');
  const qrCanvasRef = useRef(null);
  const isContactDisabled = isContactDisabledByVisitorType(formData.type);
  const isCompanyNameDisabled = isCompanyNameDisabledByVisitorType(formData.type);
  const exhibitionDateText = useMemo(() => formatExhibitionDateText(exhibition?.dates), [exhibition?.dates]);
  const exhibitionTimeText = useMemo(() => formatExhibitionTimeText(exhibition?.openTime, exhibition?.closeTime), [exhibition?.openTime, exhibition?.closeTime]);

  const handleChange = (id, value) => {
    const next = { ...formData, [id]: value };
    setFormData(normalizeVisitorContactFields(next));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData[PRIVACY_CONSENT_ITEM_ID]) {
      alert('個人情報の取り扱いへの同意が必要です。');
      return;
    }
    const visitorId = crypto.randomUUID();
    // QRコードにはIDのみ埋め込む（シンプルなQRで読み取りやすく）
    setQrImageUrl('');
    setQrData(visitorId);

    const finalData = { ...normalizeVisitorContactFields(formData), id: visitorId };
    const success = await onSubmit(finalData);
    if (success) setSubmitted(true);
  };

  useEffect(() => {
    if (!submitted || !qrData) return;
    setQrImageUrl('');
    let rafId = null;
    const generateQrImage = () => {
      const canvas = qrCanvasRef.current?.querySelector('canvas');
      if (!canvas) {
        rafId = requestAnimationFrame(generateQrImage);
        return;
      }
      try {
        setQrImageUrl(canvas.toDataURL('image/png'));
      } catch (error) {
        console.error('QR image conversion failed', error);
      }
    };
    rafId = requestAnimationFrame(generateQrImage);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [submitted, qrData]);

  // 画像保存処理
  const downloadQR = async () => {
    await saveQrImageWithFallback({
      imageUrl: qrImageUrl,
      fileName: `visitor_qr_${qrData || Date.now()}.png`,
      shareText: '入場時にこのQRコードを提示してください。'
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full rounded-2xl shadow-xl p-8 text-center animate-fade-in">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-4"><Check size={32} strokeWidth={3} /></div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">登録完了</h2>
          <p className="text-slate-600 text-sm mb-4">以下のQRコードを保存し、当日受付にご提示ください。</p>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-left text-sm mb-4">
            <div className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-1">
              <span className="text-slate-500">展示会名</span>
              <span className="font-bold text-slate-800 break-words">{exhibition?.title || '展示会'}</span>
              <span className="text-slate-500">会場名</span>
              <span className="font-bold text-slate-800 break-words">{exhibition?.place || '未設定'}</span>
              <span className="text-slate-500">住所</span>
              <span className="font-bold text-slate-800 break-words">{exhibition?.venueAddress || '未設定'}</span>
              <span className="text-slate-500">開催日時</span>
              <span className="font-bold text-slate-800 break-words">{exhibitionDateText} / {exhibitionTimeText}</span>
            </div>
          </div>

          <p className="text-xs font-bold text-red-600 mb-4">※入場にはQRコードの提示が必須です。QRコードがない場合は入場できません。</p>

          {/* ID付きのdivで囲む (ダウンロード機能用) */}
          <div id="qr-wrapper" className="bg-white border-2 border-slate-800 p-4 rounded-xl inline-block mb-6">
            {qrImageUrl ? (
              <img src={qrImageUrl} alt="入場用QRコード" className="w-[200px] h-[200px] object-contain" />
            ) : (
              <div ref={qrCanvasRef}>
                <QRCodeCanvas
                  value={qrData}
                  size={200}
                  level={"H"}
                  includeMargin={true}
                />
              </div>
            )}
          </div>

          <button onClick={downloadQR} className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl mb-2 flex items-center justify-center gap-2 hover:bg-slate-700">
            <Download size={18} /> 画像として保存
          </button>
          <p className="text-xs text-slate-400 mb-6">
            ※ボタンで保存できない場合は、画像を長押しして保存してください。<br />
            それでも難しい場合はスクリーンショットで保存をお願い致します。
          </p>

          <div className="bg-slate-50 p-4 rounded-lg text-left text-sm space-y-2 mb-6">
            {visitorFormConfig?.items?.map(item => (
              <div key={item.id} className="flex justify-between">
                <span className="text-slate-500">{item.label}</span>
                <span className="font-bold">{item.id === PRIVACY_CONSENT_ITEM_ID ? (formData[item.id] ? '同意済み' : '未同意') : (formData[item.id] || '-')}</span>
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
        <div className="p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {visitorFormConfig.items.map(item => {
              if (item.id === PRIVACY_CONSENT_ITEM_ID) {
                return (
                  <VisitorPrivacyConsentField
                    key={item.id}
                    checked={!!formData[item.id]}
                    onChange={(checked) => handleChange(item.id, checked)}
                    required={item.required !== false}
                  />
                );
              }
              const disabledField =
                (isContactDisabled && (item.id === 'phone' || item.id === 'email')) ||
                (isCompanyNameDisabled && item.id === 'companyName');
              const requiredField = disabledField ? false : item.required;
              const baseClass = `w-full border border-slate-300 p-3 rounded-lg outline-none ${disabledField ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'}`;

              return (
                <div key={item.id}>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    {item.label} {requiredField && <span className="text-red-500">*</span>}
                  </label>
                  {item.type === 'select' ? (
                    <select
                      required={requiredField}
                      className={baseClass}
                      onChange={e => handleChange(item.id, e.target.value)}
                      value={formData[item.id] || ''}
                      disabled={disabledField}
                    >
                      <option value="">選択してください</option>
                      {item.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input
                      type={item.type}
                      required={requiredField}
                      className={baseClass}
                      placeholder={disabledField ? '対象外' : item.help}
                      onChange={e => handleChange(item.id, e.target.value)}
                      value={formData[item.id] || ''}
                      disabled={disabledField}
                    />
                  )}
                </div>
              );
            })}
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 transition-all mt-4">登録してQRコードを発行</button>
          </form>
        </div>
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

  return <MakerResponseForm exhibition={exhibition} config={normalizeMakerFormConfig(exhibition.formConfig)} onClose={() => { }} onSubmit={async (data) => { await onSubmit(data); }} />;
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

function MakerPortal({ maker, exhibitions, onScan, onResponseSubmit, markMessageAsRead, initialExhibition, onDeleteScanLog, onUpdateScanLogNote }) {
  const [activeTab, setActiveTab] = useState('home');
  // Initialize with initialExhibition if provided
  const [selectedExhibition, setSelectedExhibition] = useState(initialExhibition || null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [showInvitationModal, setShowInvitationModal] = useState(null);
  const [showResponseForm, setShowResponseForm] = useState(null); // 招待中タップ時のアンケートフォーム表示
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Mobile Menu State
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false); // 詳細説明の開閉
  const [scanLogNoteDrafts, setScanLogNoteDrafts] = useState({});
  const [scanLogActionState, setScanLogActionState] = useState({});
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

  // Filter exhibitions where this maker is invited (idでのみ重複排除)
  // NOTE: タイトル/日付で重複排除すると、別展示会の履歴が見えなくなるため禁止
  const makerCode = String(maker.code || '').trim();
  const myExhibitions = useMemo(() => {
    const raw = exhibitions.filter(ex => {
      const makers = ex.makers || [];
      return makers.some(m => String(m.code || '').trim() === makerCode);
    });
    const seenIds = new Set();
    return raw.filter((ex) => {
      if (!ex?.id || seenIds.has(ex.id)) return false;
      seenIds.add(ex.id);
      return true;
    });
  }, [exhibitions, makerCode]);

  // Categorize exhibitions
  const today = new Date();
  const getStatus = (ex) => {
    const m = (ex.makers || []).find((item) => String(item.code || '').trim() === makerCode);
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
    const res = await onScan(rawCode, selectedExhibition?.id, maker);
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
    const myKeys = new Set(
      [maker.code, maker.id]
        .filter(Boolean)
        .map((v) => String(v))
    );
    return (ex.scanLogs || []).filter((log) => {
      const candidates = [log?.makerCode, log?.makerId, log?.makerRefId]
        .filter(Boolean)
        .map((v) => String(v));
      return candidates.some((key) => myKeys.has(key));
    });
  };

  const getScanLogDraft = (log) => {
    if (Object.prototype.hasOwnProperty.call(scanLogNoteDrafts, log.id)) {
      return scanLogNoteDrafts[log.id];
    }
    return log.note || '';
  };

  const setScanLogBusy = (logId, actionType) => {
    setScanLogActionState((prev) => {
      const next = { ...prev };
      if (actionType) {
        next[logId] = actionType;
      } else {
        delete next[logId];
      }
      return next;
    });
  };

  const handleSaveScanLogNote = async (log) => {
    if (!selectedExhibition || typeof onUpdateScanLogNote !== 'function') return;
    const draft = getScanLogDraft(log);
    setScanLogBusy(log.id, 'save');
    try {
      const result = await onUpdateScanLogNote(selectedExhibition.id, log.id, draft, maker);
      if (!result?.success) {
        alert(result?.message || 'メモの保存に失敗しました。');
        return;
      }
      if (Array.isArray(result.updatedLogs)) {
        setSelectedExhibition((prev) => {
          if (!prev || prev.id !== selectedExhibition.id) return prev;
          return { ...prev, scanLogs: result.updatedLogs };
        });
      }
    } finally {
      setScanLogBusy(log.id, null);
    }
  };

  const handleDeleteScanLog = async (log) => {
    if (!selectedExhibition || typeof onDeleteScanLog !== 'function') return;
    if (!window.confirm('このスキャン履歴を削除しますか？')) return;
    setScanLogBusy(log.id, 'delete');
    try {
      const result = await onDeleteScanLog(selectedExhibition.id, log.id, maker);
      if (!result?.success) {
        alert(result?.message || 'スキャン履歴の削除に失敗しました。');
        return;
      }
      if (Array.isArray(result.updatedLogs)) {
        setSelectedExhibition((prev) => {
          if (!prev || prev.id !== selectedExhibition.id) return prev;
          return { ...prev, scanLogs: result.updatedLogs };
        });
      }
      setScanLogNoteDrafts((prev) => {
        const next = { ...prev };
        delete next[log.id];
        return next;
      });
    } finally {
      setScanLogBusy(log.id, null);
    }
  };



  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}><Menu size={24} /></button>
          <h1 className="text-lg font-bold flex items-center gap-2"><BrandIcon size={20} /> {BRAND_NAME}</h1>
        </div>
      </div>

      {/* Left Sidebar - Admin Style */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tighter text-blue-400 flex items-center gap-2"><BrandIcon size={24} /> {BRAND_NAME}</h1>
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
          c {BRAND_NAME}
        </div>
      </div>

      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>}

      {/* Main Content */}
      <div className="flex-1 md:w-full w-full min-h-0 overflow-y-auto">
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

              {/* 2. Response Data */}
              {(() => {
                const normalizeIdentity = (value) => String(value || '').trim();

                const isNonEmptyValue = (value) => {
                  if (value === undefined || value === null) return false;
                  if (typeof value === 'string') return value.trim() !== '';
                  if (Array.isArray(value)) return value.length > 0;
                  return true;
                };

                const toSafeObject = (value) => (
                  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
                );

                const isAiProposalNote = (value) => (
                  typeof value === 'string' && /^\s*\[AI/i.test(value)
                );

                const normalizeMakerStatus = (value) => {
                  const raw = normalizeIdentity(value).toLowerCase();
                  if (!raw) return '';
                  if (raw === 'declined' || raw.includes('申し込まない') || raw.includes('辞退')) return 'declined';
                  if (raw === 'confirmed' || raw.includes('申し込む') || raw.includes('参加確定')) return 'confirmed';
                  return raw;
                };
                const isDeclineStatusValue = (value) => normalizeMakerStatus(value) === 'declined';

                const myCode = normalizeIdentity(maker.code);
                const myId = normalizeIdentity(maker.id);
                const configuredFieldIds = [
                  ...(selectedExhibition?.formConfig?.section1?.items || []),
                  ...(selectedExhibition?.formConfig?.section2?.items || []),
                  ...(selectedExhibition?.formConfig?.section3?.items || [])
                ]
                  .map((item) => item?.id)
                  .filter((id) => typeof id === 'string' && id.trim());
                const CONTACT_KEYS = new Set(['companyName', 'companyNameKana', 'repName', 'phone', 'email']);
                const EXTRA_KEYS = ['declineReason'];
                const DECLINED_DISPLAY_KEYS = ['companyName', 'companyNameKana', 'repName', 'phone', 'email', 'status', 'declineReason'];
                const baseFieldKeys = Array.from(new Set([...FIELD_ORDER, ...EXTRA_KEYS, ...configuredFieldIds]));
                const detailKeys = baseFieldKeys.filter((key) => !CONTACT_KEYS.has(key));

                const scoreMakerRecord = (record) => {
                  const response = toSafeObject(record.response);
                  const formData = toSafeObject(record.formData);
                  const payload = { ...formData, ...response };
                  const payloadDetailCount = detailKeys.filter((key) => {
                    const value = payload[key];
                    if (key === 'note' && isAiProposalNote(value)) return false;
                    return isNonEmptyValue(value);
                  }).length;
                  const rootDetailCount = detailKeys.filter((key) => {
                    const value = record[key];
                    if (key === 'note' && isAiProposalNote(value)) return false;
                    return isNonEmptyValue(value);
                  }).length;
                  const payloadAnyCount = Object.keys(payload).filter((key) => isNonEmptyValue(payload[key])).length;
                  const respondedAtMsRaw = new Date(record.respondedAt || record.applicationDate || 0).getTime();
                  const respondedAtMs = Number.isFinite(respondedAtMsRaw) ? respondedAtMsRaw : 0;
                  return { payloadDetailCount, rootDetailCount, payloadAnyCount, respondedAtMs };
                };

                const candidates = (selectedExhibition.makers || []).filter((m) => {
                  const makerCode = normalizeIdentity(m.code);
                  const makerId = normalizeIdentity(m.id);
                  if (myCode && makerCode && makerCode === myCode) return true;
                  if (myId && makerId && makerId === myId) return true;
                  return false;
                });
                if (candidates.length === 0) return null;

                const myInfo = [...candidates].sort((a, b) => {
                  const scoreA = scoreMakerRecord(a);
                  const scoreB = scoreMakerRecord(b);
                  if (scoreB.payloadDetailCount !== scoreA.payloadDetailCount) return scoreB.payloadDetailCount - scoreA.payloadDetailCount;
                  if (scoreB.rootDetailCount !== scoreA.rootDetailCount) return scoreB.rootDetailCount - scoreA.rootDetailCount;
                  if (scoreB.payloadAnyCount !== scoreA.payloadAnyCount) return scoreB.payloadAnyCount - scoreA.payloadAnyCount;
                  return scoreB.respondedAtMs - scoreA.respondedAtMs;
                })[0];

                const response = toSafeObject(myInfo.response);
                const formData = toSafeObject(myInfo.formData);
                const payload = { ...formData, ...response };
                const makerStatus = normalizeMakerStatus(myInfo.status || payload.status);
                const payloadDetailCount = detailKeys.filter((key) => {
                  const value = payload[key];
                  if (key === 'note' && isAiProposalNote(value)) return false;
                  return isNonEmptyValue(value);
                }).length;
                const rootDetailCount = detailKeys.filter((key) => {
                  const value = myInfo[key];
                  if (key === 'note' && isAiProposalNote(value)) return false;
                  return isNonEmptyValue(value);
                }).length;
                const isLegacyPublicSource = myInfo.source === 'web_response' || myInfo.source === 'public_form';
                const hasDeclinePayload = isDeclineStatusValue(payload.status) || isNonEmptyValue(payload.declineReason);
                const hasDeclineLegacyRoot = isLegacyPublicSource && (isDeclineStatusValue(myInfo.status) || isNonEmptyValue(myInfo.declineReason));
                const shouldShowResponse =
                  makerStatus === 'declined'
                    ? (hasDeclinePayload || hasDeclineLegacyRoot)
                    : (payloadDetailCount > 0 || rootDetailCount > 0);
                if (!shouldShowResponse) return null;

                const mergedData = {};
                const payloadKeys = makerStatus === 'declined'
                  ? DECLINED_DISPLAY_KEYS
                  : baseFieldKeys;

                // Prefer explicit payload fields first.
                payloadKeys.forEach((key) => {
                  const value = payload[key];
                  if (!isNonEmptyValue(value)) return;
                  if (key === 'note' && isAiProposalNote(value)) return;
                  mergedData[key] = value;
                });

                // Legacy alias mapping for older records.
                if (makerStatus !== 'declined' && !isNonEmptyValue(mergedData.staffCount) && isNonEmptyValue(myInfo.attendees)) {
                  mergedData.staffCount = myInfo.attendees;
                }

                const fallbackKeys = makerStatus === 'declined'
                  ? DECLINED_DISPLAY_KEYS
                  : baseFieldKeys;

                // Backfill missing keys from root-level legacy storage.
                fallbackKeys.forEach((key) => {
                  if (isNonEmptyValue(mergedData[key])) return;
                  const value = myInfo[key];
                  if (!isNonEmptyValue(value)) return;
                  if (key === 'note' && isAiProposalNote(value)) return;
                  mergedData[key] = value;
                });

                // Keep non-standard payload keys visible as supplemental info.
                if (makerStatus !== 'declined') {
                  Object.keys(payload).forEach((key) => {
                    if (baseFieldKeys.includes(key)) return;
                    const value = payload[key];
                    if (!isNonEmptyValue(value)) return;
                    if (key === 'note' && isAiProposalNote(value)) return;
                    mergedData[key] = value;
                  });
                }

                if (makerStatus === 'declined' && !isNonEmptyValue(mergedData.status)) {
                  mergedData.status = isNonEmptyValue(myInfo.status) ? myInfo.status : 'declined';
                }

                // Hide internal AI recommendation memo from maker portal.
                if (isAiProposalNote(mergedData.note)) {
                  delete mergedData.note;
                }

                const orderedKeys = (
                  makerStatus === 'declined'
                    ? DECLINED_DISPLAY_KEYS
                    : [...FIELD_ORDER, ...EXTRA_KEYS]
                ).filter((key) => isNonEmptyValue(mergedData[key]));
                const otherKeys = makerStatus === 'declined'
                  ? []
                  : Object.keys(mergedData).filter((key) => !orderedKeys.includes(key) && isNonEmptyValue(mergedData[key]));
                const displayKeys = [...orderedKeys, ...otherKeys];

                if (displayKeys.length === 0) return null;

                return (
                  <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><CheckCircle size={18} className="text-emerald-500" /> 出展申込時の回答内容</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/50 p-4 rounded-xl">
                      {displayKeys.map((key) => {
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
                  </div>
                );
              })()}
              {/* 3. Scan & History */}
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><HistoryIcon size={18} className="text-amber-500" /> スキャン履歴 <span className="text-sm bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{getMyLogs(selectedExhibition).length}件</span></h3>
                  <button
                    onClick={async () => {
                      const logs = getMyLogs(selectedExhibition);
                      if (logs.length === 0) { alert('データがありません'); return; }
                      try {
                        const ExcelJSImport = await import('exceljs');
                        const ExcelJS = ExcelJSImport.default || ExcelJSImport;
                        const wb = new ExcelJS.Workbook();
                        const ws = wb.addWorksheet('ScanLogs');
                        ws.addRow(['日時', '受付区分', '会社名', '氏名', '電話', 'メール', 'メモ']);
                        logs.forEach(l => {
                          ws.addRow([
                            new Date(l.scannedAt).toLocaleString(),
                            l.visitorSnapshot?.type || '',
                            l.visitorSnapshot?.companyName || '',
                            l.visitorSnapshot?.repName || '',
                            l.visitorSnapshot?.phone || '',
                            l.visitorSnapshot?.email || '',
                            l.note || ''
                          ]);
                        });
                        const safeTitle = String(selectedExhibition?.title || 'exhibition').replace(/[\\/:*?"<>|]/g, '_');
                        const buffer = await wb.xlsx.writeBuffer();
                        saveAs(new Blob([buffer]), `scan_logs_${safeTitle}.xlsx`);
                      } catch (e) {
                        console.error('Excel出力エラー:', e);
                        alert('Excel出力エラー: ' + (e?.message || '不明なエラー'));
                      }
                    }}
                    className="text-xs font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Download size={14} /> Excel出力
                  </button>
                </div>
                <p className="text-xs text-slate-500 mb-4">※エクセル出力で来場者の電話番号及びメールアドレスが出力できます。</p>

                <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {getMyLogs(selectedExhibition).length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <ScanLine size={32} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-slate-400 text-sm">まだスキャン履歴がありません</p>
                      <button onClick={() => setShowScanner(true)} className="mt-4 text-sm text-blue-500 hover:underline">QRスキャンを開始する</button>
                    </div>
                  ) : (
                    getMyLogs(selectedExhibition).map(log => (
                      <div key={log.id} className="py-3 px-2 hover:bg-slate-50 rounded-lg transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="bg-slate-100 p-2.5 rounded-full text-slate-400"><User size={16} /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-700 truncate">{log.visitorSnapshot?.repName || 'Unknown'}</p>
                                <p className="text-xs text-slate-400 truncate">{log.visitorSnapshot?.companyName}</p>
                                <p className="text-[11px] text-blue-600">受付区分: {log.visitorSnapshot?.type || '-'}</p>
                              </div>
                              <span className="text-xs font-mono text-slate-400 shrink-0">{new Date(log.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="mt-2">
                              <textarea
                                value={getScanLogDraft(log)}
                                onChange={(e) => setScanLogNoteDrafts((prev) => ({ ...prev, [log.id]: e.target.value }))}
                                placeholder="会話内容・ネクストアクションを記載"
                                rows={2}
                                className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                              />
                              <div className="mt-2 flex gap-2">
                                <button
                                  onClick={() => handleSaveScanLogNote(log)}
                                  disabled={!!scanLogActionState[log.id]}
                                  className="text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg flex items-center gap-1 disabled:opacity-50"
                                >
                                  <Save size={12} /> {scanLogActionState[log.id] === 'save' ? '保存中...' : 'メモ保存'}
                                </button>
                                <button
                                  onClick={() => handleDeleteScanLog(log)}
                                  disabled={!!scanLogActionState[log.id]}
                                  className="text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg flex items-center gap-1 disabled:opacity-50"
                                >
                                  <Trash2 size={12} /> {scanLogActionState[log.id] === 'delete' ? '削除中...' : '削除'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
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
                config={normalizeMakerFormConfig(showResponseForm.formConfig)}
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
function MakerDashboard({ maker, exhibitionName, scanLogs, onScan, exhibitions, onResponseSubmit, onDeleteScanLog, onUpdateScanLogNote }) {
  // If exhibitions array is provided, use new MakerPortal
  if (exhibitions && exhibitions.length > 0) {
    return <MakerPortal maker={maker} exhibitions={exhibitions} onScan={onScan} onResponseSubmit={onResponseSubmit} onDeleteScanLog={onDeleteScanLog} onUpdateScanLogNote={onUpdateScanLogNote} />;
  }

  // Fallback to single-exhibition mode (legacy)
  const singleExhibition = { title: exhibitionName, scanLogs: scanLogs, id: 'legacy' };
  return <MakerPortal maker={maker} exhibitions={[singleExhibition]} onScan={onScan} onResponseSubmit={onResponseSubmit} onDeleteScanLog={onDeleteScanLog} onUpdateScanLogNote={onUpdateScanLogNote} />;
}

// EnterpriseConsole moved to components/EnterpriseConsole.jsx




// ============================================================================
// Performance Analysis View - 実績分析
// ============================================================================
function PerformanceAnalysisView({ exhibitions }) {
  // 年度別収支計算
  const getYearlyStats = useMemo(() => {
    return buildYearlyStats(exhibitions);
  }, [exhibitions]);

  // 総来場者数
  const totalVisitors = useMemo(() => {
    return buildTotalVisitors(exhibitions);
  }, [exhibitions]);

  // 来場済み数
  const checkedInVisitors = useMemo(() => {
    return buildCheckedInVisitors(exhibitions);
  }, [exhibitions]);

  // 来場者属性（受付区分）
  const visitorAttributes = useMemo(() => {
    return buildVisitorAttributes(exhibitions);
  }, [exhibitions]);

  const visitorCheckinHeatmap = useMemo(() => {
    return buildVisitorCheckinHeatmap(exhibitions);
  }, [exhibitions]);

  // 企業別の実績母集計（展示会単位で重複排除）
  const companyPerformanceStats = useMemo(() => {
    return buildCompanyPerformanceStats(exhibitions);
  }, [exhibitions]);

  // 参加企業ランキング TOP30（参加確定回数ベース）
  const companyRanking = useMemo(() => {
    return buildCompanyRanking(companyPerformanceStats);
  }, [companyPerformanceStats]);

  // 辞退割合が高い企業ランキング TOP30（招待数3回以上）
  const declineRanking = useMemo(() => {
    return buildDeclineRanking(companyPerformanceStats);
  }, [companyPerformanceStats]);

  const [simulationAdditionalCompanies, setSimulationAdditionalCompanies] = useState(5);
  const [aiReportGeneratedAt, setAiReportGeneratedAt] = useState(() => Date.now());
  const [aiReportRevision, setAiReportRevision] = useState(1);
  const [isAiRegenerating, setIsAiRegenerating] = useState(false);
  const [isMakerStrategyOpen, setIsMakerStrategyOpen] = useState(false);
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
    return buildOverallExhibitionStats(exhibitions);
  }, [exhibitions]);

  const visitorForecast = useMemo(() => {
    return buildVisitorForecast(exhibitions);
  }, [exhibitions]);

  const revenueSimulation = useMemo(() => {
    return buildRevenueSimulation(exhibitions, simulationAdditionalCompanies);
  }, [exhibitions, simulationAdditionalCompanies]);

  // AI統合分析（全展示会データ横断）
  const aiIntegratedReport = useMemo(() => {
    return buildAiIntegratedReport({
      overallExhibitionStats,
      exhibitionsCount: exhibitions.length,
      generatedAt: aiReportGeneratedAt
    });
  }, [aiReportGeneratedAt, exhibitions.length, overallExhibitionStats]);

  const makerStrategyReport = useMemo(() => {
    return buildMakerStrategyReport({
      companyPerformanceStats,
      generatedAt: aiReportGeneratedAt
    });
  }, [aiReportGeneratedAt, companyPerformanceStats]);

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
    const watchlist = (report.autoDeclineWatchlist || []).slice(0, 10);
    const header = `# 出展メーカー戦略レポート\n- 生成日時: ${formatReportTimestamp(report.generatedAt)}\n- 対象企業数: ${report.totals.companies}社\n`;
    const kpi = `\n## KPI\n- 招待回数合計: ${report.totals.invited}回\n- 出展回数合計: ${report.totals.confirmed}回\n- 辞退回数合計: ${report.totals.declined}回\n- 自動辞退回数合計（受付締切時/未回答）: ${report.totals.autoDeclined || 0}回\n- 平均出展率: ${report.kpi.participationRate.toFixed(1)}%\n- 平均辞退率: ${report.kpi.declineRate.toFixed(1)}%\n- 自動辞退率（全招待比）: ${report.kpi.autoDeclineRate.toFixed(1)}%\n`;
    const segments = `\n## セグメント\n- 重点育成: ${report.segmentCounts.core}社\n- 成長余地: ${report.segmentCounts.growth}社\n- 辞退高リスク: ${report.segmentCounts.caution}社\n- 休眠: ${report.segmentCounts.dormant}社\n`;
    const summary = `\n## サマリー\n${report.executiveSummary.map((x) => `- ${x}`).join('\n')}\n`;
    const policy = `\n## 方針提案\n${report.policyRecommendations.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n`;
    const actions = `\n## 次回アクション\n${report.nextActions.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n`;
    const top = `\n## 出展回数上位企業\n${report.topParticipants.slice(0, 30).map((company, i) => `${i + 1}. ${company.name}${company.code ? ` (code:${company.code})` : ''} / 出展:${company.confirmed} / 招待:${company.invited} / 辞退率:${company.declineRate.toFixed(1)}% / 方針:${company.strategy}`).join('\n')}\n`;
    const decline = `\n## 辞退率上位企業\n${report.highDecliners.slice(0, 30).map((company, i) => `${i + 1}. ${company.name}${company.code ? ` (code:${company.code})` : ''} / 招待:${company.invited} / 辞退:${company.declined} / 辞退率:${company.declineRate.toFixed(1)}% / 方針:${company.strategy}`).join('\n')}\n`;
    const autoDecline = `\n## 要注意企業（未回答自動辞退率 高位）\n${watchlist.length > 0
      ? watchlist.map((company, i) => `${i + 1}. ${company.name}${company.code ? ` (code:${company.code})` : ''} / 招待:${company.invited} / 自動辞退:${company.autoDeclined || 0} / 自動辞退率:${company.autoDeclineRate.toFixed(1)}% / 方針:${company.strategy}`).join('\n')
      : '- 該当なし'}\n`;
    const body = `${header}${kpi}${segments}${summary}${policy}${actions}${top}${decline}${autoDecline}`;
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
  const HEATMAP_START_HOUR = 8;
  const HEATMAP_END_HOUR = 18;

  const heatmapVisibleSlots = useMemo(() => {
    return (visitorCheckinHeatmap.hourLabels || [])
      .map((hourLabel, idx) => ({ hourLabel, idx, hour: Number(hourLabel.slice(0, 2)) }))
      .filter(({ hour }) => hour >= HEATMAP_START_HOUR && hour <= HEATMAP_END_HOUR);
  }, [visitorCheckinHeatmap.hourLabels]);

  const getHeatCellClassName = (count, maxCount) => {
    if (!count || count <= 0) return 'bg-slate-50 text-slate-300';
    const safeMax = Math.max(maxCount, 1);
    const ratio = count / safeMax;
    if (ratio >= 0.8) return 'bg-rose-600 text-white';
    if (ratio >= 0.6) return 'bg-rose-500 text-white';
    if (ratio >= 0.4) return 'bg-orange-400 text-white';
    if (ratio >= 0.2) return 'bg-amber-300 text-amber-900';
    return 'bg-emerald-100 text-emerald-800';
  };

  const visibleHeatmapMaxCount = useMemo(() => {
    if (heatmapVisibleSlots.length === 0) return 0;
    let max = 0;
    (visitorCheckinHeatmap.rows || []).forEach((row) => {
      heatmapVisibleSlots.forEach(({ idx }) => {
        const count = row.slots?.[idx] || 0;
        if (count > max) max = count;
      });
    });
    heatmapVisibleSlots.forEach(({ idx }) => {
      const total = visitorCheckinHeatmap.totalsByHour?.[idx]?.count || 0;
      if (total > max) max = total;
    });
    return max;
  }, [heatmapVisibleSlots, visitorCheckinHeatmap.rows, visitorCheckinHeatmap.totalsByHour]);

  const visibleHeatmapTotalPeak = useMemo(() => {
    let peakLabel = '-';
    let peakCount = 0;
    heatmapVisibleSlots.forEach(({ idx, hourLabel }) => {
      const count = visitorCheckinHeatmap.totalsByHour?.[idx]?.count || 0;
      if (count > peakCount) {
        peakCount = count;
        peakLabel = hourLabel;
      }
    });
    return { peakLabel, peakCount };
  }, [heatmapVisibleSlots, visitorCheckinHeatmap.totalsByHour]);

  const getVisibleRowPeak = (row) => {
    let peakLabel = '-';
    let peakCount = 0;
    heatmapVisibleSlots.forEach(({ idx, hourLabel }) => {
      const count = row.slots?.[idx] || 0;
      if (count > peakCount) {
        peakCount = count;
        peakLabel = hourLabel;
      }
    });
    return { peakLabel, peakCount };
  };

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

      {/* Forecast & Simulation */}
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <h3 className="text-xl font-bold text-slate-800 mb-5 flex items-center gap-2">
          <BarChart3 className="text-cyan-600" size={20} />
          予測・シミュレーション
        </h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
            <p className="text-sm font-bold text-cyan-900 mb-3">来場者予測</p>
            {visitorForecast.dataPoints === 0 ? (
              <p className="text-sm text-slate-500">予測に必要な過去データがありません</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-end gap-3">
                  <p className="text-3xl font-bold text-slate-800">{visitorForecast.predictedVisitors.toLocaleString()}名</p>
                  <p className="text-xs text-slate-500 pb-1">次回想定</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-white border border-cyan-100 p-3">
                    <p className="text-slate-500 text-xs">予測レンジ</p>
                    <p className="font-bold text-slate-800">{visitorForecast.predictedMin.toLocaleString()} - {visitorForecast.predictedMax.toLocaleString()}名</p>
                  </div>
                  <div className="rounded-lg bg-white border border-cyan-100 p-3">
                    <p className="text-slate-500 text-xs">想定入場者</p>
                    <p className="font-bold text-emerald-700">{visitorForecast.predictedCheckedIn.toLocaleString()}名</p>
                  </div>
                  <div className="rounded-lg bg-white border border-cyan-100 p-3">
                    <p className="text-slate-500 text-xs">平均来場者</p>
                    <p className="font-bold text-slate-700">{visitorForecast.averageVisitors.toLocaleString()}名</p>
                  </div>
                  <div className="rounded-lg bg-white border border-cyan-100 p-3">
                    <p className="text-slate-500 text-xs">1展示会あたり傾向</p>
                    <p className={`font-bold ${visitorForecast.trendPerExhibition >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      {visitorForecast.trendPerExhibition >= 0 ? '+' : ''}{visitorForecast.trendPerExhibition}名
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  過去{visitorForecast.dataPoints}展示会の実績から算出（平均入場率: {visitorForecast.avgCheckinRate}%）
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <p className="text-sm font-bold text-emerald-900">収益シミュレーション</p>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <span>出展社 +</span>
                <input
                  type="number"
                  min="0"
                  max="200"
                  value={simulationAdditionalCompanies}
                  onChange={(e) => setSimulationAdditionalCompanies(Math.max(0, Number(e.target.value) || 0))}
                  className="w-20 border rounded px-2 py-1 text-right bg-white"
                />
                <span>社</span>
              </label>
            </div>

            {revenueSimulation.dataPoints === 0 ? (
              <p className="text-sm text-slate-500">シミュレーションに必要な実績データがありません</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-white border border-emerald-100 p-3">
                    <p className="text-slate-500 text-xs">増加売上（想定）</p>
                    <p className="font-bold text-blue-700">+¥{revenueSimulation.projected.additionalIncome.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-white border border-emerald-100 p-3">
                    <p className="text-slate-500 text-xs">増加費用（想定）</p>
                    <p className="font-bold text-red-700">+¥{revenueSimulation.projected.additionalExpense.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-white border border-emerald-100 p-3">
                    <p className="text-slate-500 text-xs">利益差分</p>
                    <p className={`font-bold ${revenueSimulation.projected.profitDelta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {revenueSimulation.projected.profitDelta >= 0 ? '+' : ''}¥{revenueSimulation.projected.profitDelta.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white border border-emerald-100 p-3">
                    <p className="text-slate-500 text-xs">想定追加コマ</p>
                    <p className="font-bold text-slate-700">{revenueSimulation.scenario.additionalBooths}コマ</p>
                  </div>
                </div>
                <div className="rounded-lg bg-white border border-emerald-100 p-3">
                  <p className="text-xs text-slate-500">平均展示会ベースの最終収支（想定）</p>
                  <p className={`text-2xl font-bold ${revenueSimulation.projected.projectedProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    ¥{revenueSimulation.projected.projectedProfit.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    現在平均: ¥{revenueSimulation.baseline.avgProfit.toLocaleString()} / 1社あたり平均売上: ¥{revenueSimulation.baseline.avgRevenuePerCompany.toLocaleString()}
                    {revenueSimulation.projected.roi !== null ? ` / ROI: ${revenueSimulation.projected.roi}%` : ''}
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  過去{revenueSimulation.dataPoints}展示会の実績をもとに算出。固定費は据え置き、可変費用のみ増加として試算しています。
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Maker Strategy Report */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-xl border border-emerald-100 p-6 shadow-sm">
        <button
          onClick={() => setIsMakerStrategyOpen((prev) => !prev)}
          className="w-full flex items-center justify-between gap-3 text-left"
        >
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="text-emerald-600" size={20} />
            出展メーカー戦略レポート
          </h3>
          <span className="text-emerald-700">
            {isMakerStrategyOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </span>
        </button>

        {isMakerStrategyOpen && (
          <div className="mt-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 mb-4">
              <p className="text-xs text-slate-500">最終生成: {formatReportTimestamp(makerStrategyReport.generatedAt)} / 出展回数・辞退率・未回答自動辞退率・次回方針</p>
              <button onClick={handleExportMakerStrategyReport} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50">
                Markdown出力
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
              <div className="bg-white/80 border border-emerald-100 rounded-lg p-3"><p className="text-[11px] text-slate-500">対象企業数</p><p className="text-lg font-bold text-slate-800">{makerStrategyReport.totals.companies}社</p></div>
              <div className="bg-white/80 border border-emerald-100 rounded-lg p-3"><p className="text-[11px] text-slate-500">招待回数合計</p><p className="text-lg font-bold text-slate-800">{makerStrategyReport.totals.invited}回</p></div>
              <div className="bg-white/80 border border-emerald-100 rounded-lg p-3"><p className="text-[11px] text-slate-500">出展回数合計</p><p className="text-lg font-bold text-slate-800">{makerStrategyReport.totals.confirmed}回</p></div>
              <div className="bg-white/80 border border-emerald-100 rounded-lg p-3"><p className="text-[11px] text-slate-500">平均出展率</p><p className="text-lg font-bold text-slate-800">{makerStrategyReport.kpi.participationRate.toFixed(1)}%</p></div>
              <div className="bg-white/80 border border-emerald-100 rounded-lg p-3"><p className="text-[11px] text-slate-500">平均辞退率</p><p className="text-lg font-bold text-slate-800">{makerStrategyReport.kpi.declineRate.toFixed(1)}%</p></div>
              <div className="bg-white/80 border border-amber-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500">未回答自動辞退率</p>
                <p className="text-lg font-bold text-amber-700">{makerStrategyReport.kpi.autoDeclineRate.toFixed(1)}%</p>
                <p className="text-[10px] text-slate-500 mt-0.5">自動辞退 {makerStrategyReport.totals.autoDeclined || 0}回</p>
              </div>
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

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
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
              <div className="bg-white/80 rounded-lg border border-amber-200 p-4">
                <p className="text-sm font-bold text-amber-800 mb-3">要注意 受付締切時 自動辞退率 高位5社</p>
                <div className="space-y-2">
                  {(makerStrategyReport.autoDeclineWatchlist || []).slice(0, 5).map((company, idx) => (
                    <div key={company.key || idx} className="rounded-md border border-amber-100 bg-white p-2">
                      <p className="text-sm font-bold text-slate-800">{idx + 1}. {company.name}</p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        招待:{company.invited}回 / 自動辞退:{company.autoDeclined || 0}回 / 自動辞退率:{company.autoDeclineRate.toFixed(1)}%
                      </p>
                      <p className="text-xs text-amber-700 mt-1">方針: {company.strategy}</p>
                    </div>
                  ))}
                  {(makerStrategyReport.autoDeclineWatchlist || []).length === 0 && <p className="text-sm text-slate-500">対象データがありません。</p>}
                </div>
              </div>
            </div>
          </div>
        )}
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

      {/* Visitor Check-in Heatmap */}
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Clock className="text-orange-500" size={20} />
            来場時間ヒートマップ
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-full border border-cyan-200 bg-cyan-50 text-cyan-700 font-bold">
              表示時間帯 {String(HEATMAP_START_HOUR).padStart(2, '0')}-{String(HEATMAP_END_HOUR).padStart(2, '0')}
            </span>
            <span className="px-2 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold">
              時刻記録あり {visitorCheckinHeatmap.trackedCheckinsTotal.toLocaleString()}件
            </span>
            <span className="px-2 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700 font-bold">
              時刻未記録 {visitorCheckinHeatmap.unknownCheckinsTotal.toLocaleString()}件
            </span>
            <span className="px-2 py-1 rounded-full border border-rose-200 bg-rose-50 text-rose-700 font-bold">
              時間帯ピーク {visibleHeatmapTotalPeak.peakLabel} ({visibleHeatmapTotalPeak.peakCount}件)
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          各展示会ごとに、事前登録者が未入場から入場済みに変わった時刻を可視化しています（08:00-18:00のみ表示）。
        </p>

        {visitorCheckinHeatmap.rows.length === 0 ? (
          <p className="text-slate-400 text-center py-10">表示できる展示会データがありません</p>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full min-w-[860px] text-xs">
              <thead className="bg-slate-50">
                <tr className="border-b">
                  <th className="sticky left-0 z-20 bg-slate-50 p-2 text-left font-bold text-slate-600 min-w-[220px]">展示会</th>
                  {heatmapVisibleSlots.map(({ hourLabel }) => (
                    <th key={hourLabel} className="p-2 text-center font-bold text-slate-500 border-l min-w-[42px]">{hourLabel.slice(0, 2)}</th>
                  ))}
                  <th className="p-2 text-center font-bold text-slate-600 border-l min-w-[72px]">記録数</th>
                  <th className="p-2 text-center font-bold text-slate-600 border-l min-w-[92px]">時刻未記録</th>
                  <th className="p-2 text-center font-bold text-slate-600 border-l min-w-[90px]">ピーク</th>
                </tr>
              </thead>
              <tbody>
                {visitorCheckinHeatmap.rows.map((row) => {
                  const rowPeak = getVisibleRowPeak(row);
                  return (
                    <tr key={row.id} className="border-b last:border-b-0">
                      <td className="sticky left-0 z-10 bg-white p-2 border-r">
                        <p className="font-bold text-slate-800 truncate">{row.title}</p>
                        <p className="text-[11px] text-slate-500 truncate">{row.dateLabel}</p>
                      </td>
                      {heatmapVisibleSlots.map(({ idx, hourLabel }) => {
                        const count = row.slots?.[idx] || 0;
                        return (
                          <td
                            key={`${row.id}-${hourLabel}`}
                            className={`text-center border-l p-1 font-bold ${getHeatCellClassName(count, visibleHeatmapMaxCount)}`}
                            title={`${row.title} ${hourLabel}: ${count}件`}
                          >
                            {count > 0 ? count : ''}
                          </td>
                        );
                      })}
                      <td className="text-center border-l p-2 font-bold text-slate-700">{row.trackedCheckins}</td>
                      <td className="text-center border-l p-2 font-bold text-amber-700">{row.unknownCheckinTime || '-'}</td>
                      <td className="text-center border-l p-2 font-bold text-rose-700">{rowPeak.peakLabel}</td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50 border-t-2">
                  <td className="sticky left-0 z-10 bg-slate-50 p-2 border-r font-bold text-slate-700">全展示会 合計</td>
                  {heatmapVisibleSlots.map(({ idx, hourLabel }) => {
                    const count = visitorCheckinHeatmap.totalsByHour?.[idx]?.count || 0;
                    return (
                      <td
                        key={`total-${hourLabel}`}
                        className={`text-center border-l p-1 font-bold ${getHeatCellClassName(count, visibleHeatmapMaxCount)}`}
                        title={`全展示会 ${hourLabel}: ${count}件`}
                      >
                        {count > 0 ? count : ''}
                      </td>
                    );
                  })}
                  <td className="text-center border-l p-2 font-bold text-slate-700">{visitorCheckinHeatmap.trackedCheckinsTotal}</td>
                  <td className="text-center border-l p-2 font-bold text-amber-700">{visitorCheckinHeatmap.unknownCheckinsTotal || '-'}</td>
                  <td className="text-center border-l p-2 font-bold text-rose-700">{visibleHeatmapTotalPeak.peakLabel}</td>
                </tr>
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

            const confirmedMakers = ex.makers?.filter(m => m.status === 'confirmed') || [];
            const makerCount = confirmedMakers.length;
            const totalBoothCount = confirmedMakers.reduce((sum, maker) => {
              const rawBoothCount = maker?.response?.boothCount ?? maker?.boothCount ?? '';
              const parsed = extractNum(rawBoothCount);
              return sum + (parsed > 0 ? parsed : 1);
            }, 0);

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
                        <span className="text-slate-500 font-bold flex items-center gap-1"><Briefcase size={12} /> 参加コマ数/目標企業数</span>
                        <span className="font-bold text-slate-700">{totalBoothCount} / {ex.targetMakers || 0}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${ex.targetMakers > 0 ? Math.min((totalBoothCount / ex.targetMakers) * 100, 100) : 0}%` }}></div>
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

        <section><h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4 flex items-center gap-2"><MapPin className="text-blue-600" /> エリア・会場・Web</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-sm font-medium text-slate-600 mb-1">エリア選択</label><select name="prefecture" value={data.prefecture} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-lg bg-white"><option value="">都道府県を選択...</option>{PREFECTURES.map(group => (<optgroup key={group.region} label={group.region}>{group.prefs.map(p => <option key={p} value={p}>{p}</option>)}</optgroup>))}</select></div><div><label className="block text-sm font-medium text-slate-600 mb-1">会場名（予定）</label><input type="text" name="place" value={data.place} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-lg" placeholder="例：福岡国際センター" /></div><div className="col-span-2"><label className="block text-sm font-medium text-slate-600 mb-1">会場住所</label><input type="text" name="venueAddress" value={data.venueAddress} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-lg" placeholder="例：福岡県福岡市博多区石城町２?１" /></div><div><label className="block text-sm font-medium text-slate-600 mb-1">開場時間</label><input type="time" name="openTime" value={data.openTime} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-lg" /></div><div><label className="block text-sm font-medium text-slate-600 mb-1">閉場時間</label><input type="time" name="closeTime" value={data.closeTime} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-lg" /></div><div className="col-span-2"><label className="block text-sm font-medium text-slate-600 mb-1">展示会場URL</label><div className="flex gap-2"><input type="text" name="venueUrl" value={data.venueUrl} onChange={handleChange} className="flex-1 p-3 border border-slate-200 rounded-lg" placeholder="https://..." /><button onClick={simulateFetchImage} disabled={!data.venueUrl || isFetchingImg} className="bg-slate-800 text-white px-4 rounded-lg text-sm font-bold hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">{isFetchingImg ? <RefreshCw className="animate-spin" size={16} /> : <LinkIcon size={16} />} 画像を取得</button></div>{data.imageUrl && (<div className="mt-2 p-2 border border-slate-200 rounded-lg bg-slate-50 flex items-center gap-4"><img src={data.imageUrl} alt="Preview" className="w-20 h-14 object-cover rounded" /><span className="text-xs text-green-600 font-bold">? 画像を取得しました</span></div>)}</div><div className="col-span-2"><label className="block text-sm font-medium text-slate-600 mb-1 flex items-center gap-2"><Map size={16} /> GoogleマップURL</label><input type="text" name="googleMapsUrl" value={data.googleMapsUrl || ''} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-lg" placeholder="https://maps.google.com/..." /></div><div className="col-span-2"><label className="block text-sm font-medium text-slate-600 mb-1">コンセプト</label><textarea name="concept" value={data.concept} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-lg" rows="3" placeholder="展示会のテーマや狙いを記入" /></div></div></section>

        <section><h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4 flex items-center gap-2"><Target className="text-blue-600" /> 目標設定・チーム</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div><RequiredLabel>集客目標 (人)</RequiredLabel><input type="number" name="targetVisitors" value={data.targetVisitors} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-lg" /></div><div><RequiredLabel>招致メーカー目標 (社)</RequiredLabel><input type="number" name="targetMakers" value={data.targetMakers} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-lg" /></div><div><RequiredLabel>目標利益額 (円)</RequiredLabel><input type="number" name="targetProfit" value={data.targetProfit} onChange={handleChange} className="w-full p-3 border border-blue-300 bg-blue-50 rounded-lg font-bold text-blue-800" placeholder="1000000" /></div><div className="col-span-1 md:col-span-3"><RequiredLabel>運営スタッフ</RequiredLabel><div className="flex gap-2 mb-2"><input type="text" value={staffName} onChange={e => setStaffName(e.target.value)} className="flex-1 p-3 border border-slate-200 rounded-lg" placeholder="スタッフ名" /><button onClick={addStaff} className="bg-slate-800 text-white px-4 rounded-lg"><Plus /></button></div><div className="flex flex-wrap gap-2">{data.staff && data.staff.split(',').filter(s => s).map((s, i) => (<span key={i} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full flex items-center gap-2 text-sm">{s.trim()} <button onClick={() => removeStaff(s.trim())}><X size={14} /></button></span>))}</div></div></div></section>


        <div className="flex justify-end gap-4 pt-4 border-t"><button onClick={onCancel} className="px-6 py-3 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">キャンセル</button><button onClick={validateAndSubmit} className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all">プロジェクト作成</button></div>
      </div>
    </div>
  );
}



function ExhibitionDetail({
  exhibition,
  onBack,
  onNavigate,
  updateVisitorCount,
  updateExhibitionData,
  batchUpdateExhibitionData,
  masterMakers,
  initialTab,
  onTabChange,
  storage,
  allExhibitions = [],
  allowedTabs = null,
  initialEntranceMode = 'dashboard',
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'main');
  const [entranceMode, setEntranceMode] = useState(initialEntranceMode || 'dashboard'); // QRスキャナーモード制御用

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

  useEffect(() => {
    if (activeTab === 'entrance' && initialEntranceMode) {
      setEntranceMode(initialEntranceMode);
    }
  }, [activeTab, initialEntranceMode]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (onTabChange) onTabChange(tabId);
    if (tabId !== 'entrance') setEntranceMode('dashboard');
  };

  const ALL_TAB_DEFINITIONS = [
    { id: 'main', label: '基本情報', icon: BrandTabIcon },
    { id: 'schedule', label: 'スケジュール', icon: Calendar },
    { id: 'equipment', label: '会場・備品', icon: Box },
    { id: 'makers', label: '招待メーカー', icon: Building2 },
    { id: 'tasks', label: 'タスク管理', icon: CheckSquare },
    { id: 'budget', label: '収支・予算', icon: DollarSign },
    { id: 'entrance', label: '来場者管理', icon: Users },
    { id: 'lectures', label: '講演会', icon: Mic },
    { id: 'files', label: '資料', icon: Folder },
  ];

  const visibleTabDefinitions = useMemo(() => {
    if (!Array.isArray(allowedTabs) || allowedTabs.length === 0) {
      return ALL_TAB_DEFINITIONS;
    }
    const allowedSet = new Set(allowedTabs);
    return ALL_TAB_DEFINITIONS.filter(tab => allowedSet.has(tab.id));
  }, [allowedTabs]);

  useEffect(() => {
    const isCurrentTabAllowed = visibleTabDefinitions.some(tab => tab.id === activeTab);
    if (!isCurrentTabAllowed) {
      const fallbackTab = visibleTabDefinitions[0]?.id || 'main';
      setActiveTab(fallbackTab);
      if (onTabChange) onTabChange(fallbackTab);
    }
  }, [activeTab, onTabChange, visibleTabDefinitions]);

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
        {visibleTabDefinitions.map(tab => (
          <button key={tab.id} onClick={() => handleTabChange(tab.id)} className={`flex items-center gap-2 px-4 py-3 rounded-t-lg font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-blue-600 border-b-2 border-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}><tab.icon size={18} /> {tab.label}</button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 min-h-[500px]">
        {activeTab === 'main' && <TabMainBoard exhibition={exhibition} updateMainData={updateMainData} updateBatch={updateMainDataBatch} tasks={exhibition.tasks || []} onNavigate={handleTabChange} />}
        {activeTab === 'schedule' && <TabSchedule scheduleData={exhibition.schedule} updateMainData={updateMainData} staff={exhibition.staff || ''} dates={exhibition.dates || []} preDates={exhibition.preDates || []} />}
        {activeTab === 'equipment' && <TabEquipment exhibition={exhibition} details={exhibition.venueDetails || {}} setDetails={setVenueDetails} masterMakers={masterMakers} />}
        {activeTab === 'makers' && <TabMakers exhibition={exhibition} setMakers={setMakers} updateMainData={updateMainData} masterMakers={masterMakers} onNavigate={onNavigate} storage={storage} allExhibitions={allExhibitions} />}
        {activeTab === 'tasks' && <TabTasks tasks={exhibition.tasks || []} setTasks={setTasks} staff={exhibition.staff || ''} />}
        {activeTab === 'budget' && <TabBudget exhibition={exhibition} updateMainData={updateMainData} />}
        {activeTab === 'entrance' && <TabEntrance exhibition={exhibition} updateVisitorCount={updateVisitorCount} visitors={exhibition.visitors || []} setVisitors={setVisitors} updateMainData={updateMainData} updateBatch={updateMainDataBatch} initialMode={entranceMode} />}
        {activeTab === 'lectures' && <TabLectures lectures={exhibition.lectures || []} updateMainData={updateMainData} updateBatch={updateMainDataBatch} staff={exhibition.staff || ''} scheduleData={exhibition.schedule} />}
        {activeTab === 'files' && <TabFiles materials={exhibition.materials || {}} updateMainData={updateMainData} />}
      </div>
    </div>
  );
}

function normalizeYmdDate(dateValue) {
  if (dateValue == null) return null;

  if (typeof dateValue === 'number' && Number.isFinite(dateValue)) {
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }

  if (typeof dateValue !== 'string') return null;

  const text = dateValue.trim();
  if (!text) return null;

  const ymd = text.match(/(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    const d = new Date(year, month - 1, day);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }

  const fallback = new Date(text);
  if (Number.isNaN(fallback.getTime())) return null;
  fallback.setHours(0, 0, 0, 0);
  return fallback;
}

function getClosestExhibitionByDate(exhibitions = [], baseDate = new Date()) {
  if (!Array.isArray(exhibitions) || exhibitions.length === 0) return null;

  const target = new Date(baseDate);
  target.setHours(0, 0, 0, 0);

  let best = null;
  for (const ex of exhibitions) {
    const candidateDates = [...(ex?.dates || []), ...(ex?.preDates || [])]
      .map(normalizeYmdDate)
      .filter(Boolean);

    if (candidateDates.length === 0) continue;

    for (const d of candidateDates) {
      const diffMs = d.getTime() - target.getTime();
      const absDiff = Math.abs(diffMs);
      const isPast = diffMs < 0 ? 1 : 0;
      if (
        !best ||
        absDiff < best.absDiff ||
        (absDiff === best.absDiff && isPast < best.isPast) ||
        (absDiff === best.absDiff && isPast === best.isPast && d.getTime() < best.dateMs)
      ) {
        best = { exhibition: ex, absDiff, isPast, dateMs: d.getTime() };
      }
    }
  }

  if (best?.exhibition) return best.exhibition;
  return exhibitions[0] || null;
}

function MobileEventSimpleView({
  exhibitions = [],
  selectedExhibition,
  onSelectExhibition,
  onOpenAction,
}) {
  const hasExhibitions = Array.isArray(exhibitions) && exhibitions.length > 0;
  const datesText = (selectedExhibition?.dates || []).join(' / ') || '未設定';
  const venueText = selectedExhibition?.place || selectedExhibition?.venueAddress || '未設定';
  const staffText = selectedExhibition?.staff || '未設定';
  const checkedInVisitors = (selectedExhibition?.visitors || []).filter(
    (visitor) => visitor?.status === 'checked-in' || visitor?.checkedIn
  ).length;
  const currentVisitors = checkedInVisitors;

  return (
    <div className="space-y-4 animate-fade-in">
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <h2 className="text-xl font-bold text-slate-800 mb-1">展示会用簡易ビュー</h2>
        <p className="text-sm text-slate-600 mb-4">当日運営に必要な機能だけを表示しています。</p>
        {hasExhibitions ? (
          <select
            value={selectedExhibition?.id || ''}
            onChange={(e) => onSelectExhibition(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-800 font-medium"
          >
            {exhibitions.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
              </option>
            ))}
          </select>
        ) : (
          <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded-xl p-3 text-sm font-medium">
            展示会データがありません。
          </div>
        )}
      </section>

      {selectedExhibition && (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-500 mb-3">必要最低限の展示会情報</h3>
          <div className="space-y-2 text-sm">
            <p><span className="text-slate-500">展示会名:</span> <span className="font-bold text-slate-800">{selectedExhibition.title}</span></p>
            <p><span className="text-slate-500">開催日:</span> <span className="font-medium text-slate-800">{datesText}</span></p>
            <p><span className="text-slate-500">会場:</span> <span className="font-medium text-slate-800">{venueText}</span></p>
            <p><span className="text-slate-500">担当:</span> <span className="font-medium text-slate-800">{staffText}</span></p>
          </div>
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-bold text-emerald-700 mb-1">現在来場者数</p>
            <p className="text-2xl font-extrabold text-emerald-800 leading-none">
              {currentVisitors.toLocaleString()}<span className="ml-1 text-sm font-bold">名</span>
            </p>
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3">
        <button onClick={() => onOpenAction('qr')} className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl p-4 flex items-center justify-center gap-2 font-bold text-base shadow-md">
          <ScanLine size={20} /> QR読み込み
        </button>
        <button onClick={() => onOpenAction('schedule')} className="bg-white hover:bg-slate-50 border border-slate-300 rounded-xl p-3 flex items-center justify-center gap-2 font-bold text-slate-700">
          <Calendar size={18} /> スケジュール
        </button>
        <button onClick={() => onOpenAction('visitors')} className="bg-white hover:bg-slate-50 border border-slate-300 rounded-xl p-3 flex items-center justify-center gap-2 font-bold text-slate-700">
          <Users size={18} /> 来場者管理
        </button>
        <button onClick={() => onOpenAction('lectures')} className="bg-white hover:bg-slate-50 border border-slate-300 rounded-xl p-3 flex items-center justify-center gap-2 font-bold text-slate-700">
          <Mic size={18} /> 講演会確認
        </button>
        <button onClick={() => onOpenAction('files')} className="bg-white hover:bg-slate-50 border border-slate-300 rounded-xl p-3 flex items-center justify-center gap-2 font-bold text-slate-700">
          <Folder size={18} /> 資料確認
        </button>
        <button onClick={() => onOpenAction('info')} className="bg-white hover:bg-slate-50 border border-slate-300 rounded-xl p-3 flex items-center justify-center gap-2 font-bold text-slate-700">
          <FileText size={18} /> 展示会情報
        </button>
        <button onClick={() => onOpenAction('manual')} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl p-3 flex items-center justify-center gap-2 font-bold">
          <BookOpen size={18} /> 当日運営編
        </button>
      </section>
    </div>
  );
}

function App() {
  const [view, setView] = useState('loading');
  const [exhibitions, setExhibitions] = useState(null);
  const [selectedExhibition, setSelectedExhibition] = useState(null);
  const [newExhibition, setNewExhibition] = useState({ title: '', dates: [], preDates: [], place: '', prefecture: '', venueAddress: '', openTime: '10:00', closeTime: '17:00', concept: '', targetVisitors: 0, targetMakers: 0, targetProfit: 0, venueUrl: '', googleMapsUrl: '', imageUrl: '', staff: '' });
  const [exhibitionTabs, setExhibitionTabs] = useState({}); // { [exhibitionId]: 'activeTabName' }
  const { user, db, storage, appId } = useFirebaseInit();
  const [urlMode, setUrlMode] = useState('dashboard');
  const [targetExhibitionId, setTargetExhibitionId] = useState(null);
  const [dashboardMaker, setDashboardMaker] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [manualInitialTab, setManualInitialTab] = useState('preparation');
  const [exhibitionEntranceModes, setExhibitionEntranceModes] = useState({}); // { [exhibitionId]: 'dashboard' | 'scanner' }
  const [mobileAdminMode, setMobileAdminMode] = useState(() => {
    const stored = localStorage.getItem('mobile_admin_mode');
    if (window.innerWidth < 768) return 'simple';
    return stored || 'full';
  });
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth < 768);
  const hasDashboardAccessKey = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return !!params.get('key');
  }, []);
  const shouldUseOneShotExhibitionsFetch = useMemo(() => {
    const publicModes = new Set(['visitor_register', 'maker_register', 'maker', 'demo_portal', 'demo_maker_form']);
    if (publicModes.has(urlMode)) return true;
    if (urlMode === 'dashboard' && hasDashboardAccessKey) return true;
    return false;
  }, [urlMode, hasDashboardAccessKey]);

  const {
    masterMakers,
    setMasterMakers,
    masterMakersLoaded,
    masterMakersRef
  } = useMasterMakersSync({ db, appId, view, mode: urlMode });

  // ★最適化: useRefを使用してsyncコールバック内で最新値を参照（再購読防止）
  const selectedExhibitionRef = useRef(null);
  const recentExhibitionWritesRef = useRef(new globalThis.Map());

  // ★最適化: selectedExhibition の変更を Ref に同期（コールバック内で最新値を参照するため）
  useEffect(() => {
    selectedExhibitionRef.current = selectedExhibition;
  }, [selectedExhibition]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem('mobile_admin_mode', mobileAdminMode);
  }, [mobileAdminMode]);

  const isSimpleMobileMode = isMobileViewport && mobileAdminMode === 'simple';
  const closestExhibition = useMemo(() => {
    return getClosestExhibitionByDate(exhibitions || [], new Date());
  }, [exhibitions]);
  const wasSimpleModeRef = useRef(false);
  const hasAutoSelectedSimpleRef = useRef(false);

  useEffect(() => {
    if (isSimpleMobileMode && !wasSimpleModeRef.current) {
      hasAutoSelectedSimpleRef.current = false;
    }
    wasSimpleModeRef.current = isSimpleMobileMode;
  }, [isSimpleMobileMode]);

  useEffect(() => {
    if (!isSimpleMobileMode) return;
    if (!closestExhibition) return;
    if (hasAutoSelectedSimpleRef.current) return;
    setSelectedExhibition(closestExhibition);
    hasAutoSelectedSimpleRef.current = true;
  }, [closestExhibition, isSimpleMobileMode]);

  // Login State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('exhibition_auth') === 'true';
  });
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const PASSCODE = 'kuwanatakashi';

  useEffect(() => {
    globalThis.__APP_BUILD_TAG__ = APP_BUILD_TAG;
    console.info(`[Build] ${APP_BUILD_TAG}`);
  }, []);

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

  // 1. Data Fetching Effect (Stable) - Realtime subscription, never writes inside listener.
  useEffect(() => {
    if (!user || !db || !appId) return;

    const exRef = collection(db, 'artifacts', appId, 'public', 'data', 'exhibitions');
    let isSingleFetchActive = true;

    const applySnapshotDocs = (docs) => {
      try {
        const data = docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() }));
        const seenIds = new Set();
        const uniqueData = [];
        for (const item of data) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            uniqueData.push(item);
          }
        }

        const normalizedData = uniqueData.map((item) => {
          const normalizedFormConfig = normalizeMakerFormConfig(item.formConfig);
          const normalizedVisitorFormConfig = normalizeVisitorFormConfig(item.visitorFormConfig);
          const normalizedTasks = mergeTasksWithTemplate(item.tasks);
          return {
            ...item,
            formConfig: normalizedFormConfig,
            visitorFormConfig: normalizedVisitorFormConfig,
            tasks: normalizedTasks,
            taskTemplateVersion: TASK_TEMPLATE_VERSION
          };
        });

        normalizedData.sort((a, b) => b.createdAt - a.createdAt);
        setExhibitions(normalizedData);

        const currentSelectedId = selectedExhibitionRef.current?.id;
        if (!currentSelectedId) return;
        const latest = normalizedData.find((item) => item.id === currentSelectedId);
        if (latest) {
          selectedExhibitionRef.current = latest;
          setSelectedExhibition(latest);
        }
      } catch (error) {
        console.error('Error in exhibitions sync processing:', error);
        setExhibitions([]);
      }
    };

    if (shouldUseOneShotExhibitionsFetch) {
      console.log('[Firebase] Using one-shot exhibitions fetch mode:', urlMode);
      getDocs(exRef)
        .then((snapshot) => {
          if (!isSingleFetchActive) return;
          console.log('[Firebase] One-shot exhibitions fetched:', snapshot.size);
          applySnapshotDocs(snapshot.docs);
        })
        .catch((error) => {
          console.error('Firestore one-shot exhibitions fetch error:', error);
          if (!isSingleFetchActive) return;
          setExhibitions([]);
        });

      return () => {
        isSingleFetchActive = false;
      };
    }

    console.log('[Firebase] Setting up onSnapshot subscription for uid:', user.uid);
    const unsubscribe = onSnapshot(
      exRef,
      (snapshot) => {
        console.log('[Firebase] Realtime exhibitions update:', snapshot.size);
        applySnapshotDocs(snapshot.docs);
      },
      (error) => {
        console.error('Firestore realtime sync error:', error);
        setExhibitions([]);
      }
    );

    return () => {
      isSingleFetchActive = false;
      console.log('[Firebase] Cleaning up onSnapshot subscription');
      unsubscribe();
    };
  }, [user?.uid, db, appId, shouldUseOneShotExhibitionsFetch, urlMode]); // Use uid instead of user object to prevent re-subscription
  // 2. View Routing & Logic Effect (Reactive)
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

    // Safety for empty array
    const data = exhibitions;
    const findExhibitionById = (id) => data.find((exhibition) => exhibition.id === id);

    if (urlMode === 'visitor_register' && targetExhibitionId) {
      const target = findExhibitionById(targetExhibitionId);
      if (target) { setSelectedExhibition(target); setView('public_visitor_form'); }
      else { setView('not_found'); }
    } else if (urlMode === 'maker_register' && targetExhibitionId) {
      const target = findExhibitionById(targetExhibitionId);
      if (target) { setSelectedExhibition(target); setView('public_maker_form'); }
      else { setView('not_found'); }
    } else if (urlMode === 'dashboard') { // Maker Dashboard Logic
      const params = new URLSearchParams(window.location.search);
      const key = params.get('key');
      if (key && targetExhibitionId) {
        const target = findExhibitionById(targetExhibitionId);
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
            title: `${BRAND_NAME} Demo Exhibition`,
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
      const targetEx = findExhibitionById(id);

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
        targetEx = findExhibitionById(id);
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
    const formUrlVisitor = buildVisitorRegisterUrl(id);

    // メーカー初期リストは空配列を使用（CSV取込前提）
    const newProject = {
      ...newExhibition, id, createdAt: Date.now(), currentVisitors: 0, imageUrl: finalImg,
      makers: [], visitors: [], venueDetails: { cost: 0, equipment: [], notes: '', internalSupplies: INITIAL_INTERNAL_SUPPLIES },
      otherBudgets: [], tasks: buildFixedTaskTemplate(), taskTemplateVersion: TASK_TEMPLATE_VERSION, formUrlMaker, formUrlVisitor,
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
  const getExhibitionForWrite = (id) => {
    if (!id) return null;
    if (selectedExhibition?.id === id) return selectedExhibition;
    if (!Array.isArray(exhibitions)) return null;
    return exhibitions.find((item) => item.id === id) || null;
  };

  const isProtectedWriteBlocked = (key) => PROTECTED_EXHIBITION_WRITE_KEYS.has(key) && !isAuthenticated;

  const shouldSkipDuplicateWrite = (id, payload) => {
    const now = Date.now();
    for (const [cacheKey, timestamp] of recentExhibitionWritesRef.current.entries()) {
      if (now - timestamp > EXHIBITION_WRITE_DEDUP_WINDOW_MS) {
        recentExhibitionWritesRef.current.delete(cacheKey);
      }
    }

    const signature = `${id}:${safeJsonStringify(payload)}`;
    const lastTimestamp = recentExhibitionWritesRef.current.get(signature);
    if (lastTimestamp && now - lastTimestamp < EXHIBITION_WRITE_DEDUP_WINDOW_MS) {
      return true;
    }
    recentExhibitionWritesRef.current.set(signature, now);
    return false;
  };

  const applyLocalExhibitionPatch = (id, patch) => {
    if (!patch || Object.keys(patch).length === 0) return;
    setExhibitions((prev) =>
      Array.isArray(prev)
        ? prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
        : prev
    );
    if (selectedExhibition?.id === id) {
      setSelectedExhibition((prev) => (prev ? { ...prev, ...patch } : prev));
    }
  };

  const updateExhibitionData = async (id, key, value) => {
    if (!id || !db || !appId) return;
    if (EMERGENCY_DISABLE_VISITOR_FORM_CONFIG_WRITES && isBlockedUpdateFieldPath(key)) {
      console.warn('[WriteGuard] Emergency blocked write to visitorFormConfig', {
        key,
        exhibitionId: id,
        mode: urlMode,
        stack: new Error().stack
      });
      return;
    }
    if (isProtectedWriteBlocked(key)) {
      console.warn(`[WriteGuard] Blocked unauthenticated write to protected key: ${key}`);
      return;
    }

    const current = getExhibitionForWrite(id);
    if (current && isDeepEqual(current[key], value)) {
      return;
    }

    const payload = { [key]: value };
    if (shouldSkipDuplicateWrite(id, payload)) {
      console.log(`[WriteGuard] Suppressed duplicate write: ${key}`);
      return;
    }

    try {
      console.log(`[DEBUG] Updating single key: ${key}`, value);
      const exRef = doc(db, 'artifacts', appId, 'public', 'data', 'exhibitions', id);
      applyLocalExhibitionPatch(id, payload);
      const updated = await guardedUpdateDoc(exRef, payload, `updateExhibitionData:${key}`);
      if (!updated) return;
      console.log(`[DEBUG] Successfully updated ${key}`);
    } catch (e) {
      console.error(`[DEBUG] Error updating ${key}:`, e);
      alert(`Update error (${key}): ` + e.message);
    }
  };

  const batchUpdateExhibitionData = async (id, updates) => {
    if (!id || !db || !appId || !updates || typeof updates !== 'object') return;

    const filteredEntries = Object.entries(updates).filter(([key]) => {
      if (EMERGENCY_DISABLE_VISITOR_FORM_CONFIG_WRITES && isBlockedUpdateFieldPath(key)) {
        console.warn('[WriteGuard] Emergency blocked batch write to visitorFormConfig', {
          key,
          exhibitionId: id,
          mode: urlMode,
          stack: new Error().stack
        });
        return false;
      }
      if (isProtectedWriteBlocked(key)) {
        console.warn(`[WriteGuard] Blocked unauthenticated write to protected key: ${key}`);
        return false;
      }
      return true;
    });
    if (filteredEntries.length === 0) return;

    const current = getExhibitionForWrite(id);
    const changedUpdates = {};
    for (const [key, value] of filteredEntries) {
      if (!current || !isDeepEqual(current[key], value)) {
        changedUpdates[key] = value;
      }
    }
    if (Object.keys(changedUpdates).length === 0) {
      return;
    }

    if (shouldSkipDuplicateWrite(id, changedUpdates)) {
      console.log('[WriteGuard] Suppressed duplicate batch write');
      return;
    }

    try {
      console.log('[DEBUG] Batch updating exhibition:', changedUpdates);
      if (changedUpdates.dates) console.log('[DEBUG] Dates to save:', changedUpdates.dates);
      if (changedUpdates.preDates) console.log('[DEBUG] PreDates to save:', changedUpdates.preDates);

      const exRef = doc(db, 'artifacts', appId, 'public', 'data', 'exhibitions', id);
      applyLocalExhibitionPatch(id, changedUpdates);
      const updated = await guardedUpdateDoc(exRef, changedUpdates, 'batchUpdateExhibitionData');
      if (!updated) return;
      console.log('[DEBUG] Batch update success');
      console.log('Batch update success');
    } catch (e) {
      console.error('[DEBUG] Batch update error:', e);
      alert('Batch update error: ' + e.message);
    }
  };

  const updateVisitorCount = async (id, n) => { updateExhibitionData(id, 'currentVisitors', n); };
  const handlePublicSubmit = async (type, data) => {
    if (!selectedExhibition) {
      alert('展示会データの読み込みが完了していません。数秒後にもう一度お試しください。');
      return false;
    }
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
      const normalizeIdentity = (value) => String(value || '').trim();
      const submittedCode = normalizeIdentity(data.code || data.supplierCode);
      const submittedCompanyName = normalizeIdentity(data.companyName);
      const submittedEmail = normalizeIdentity(data.email).toLowerCase();
      const existingIndex = existingMakers.findIndex((m) => {
        const makerCode = normalizeIdentity(m.code || m.supplierCode);
        const makerCompanyName = normalizeIdentity(m.companyName);
        const makerEmail = normalizeIdentity(m.email).toLowerCase();
        if (submittedCode && makerCode && submittedCode === makerCode) return true;
        if (submittedCompanyName && makerCompanyName && submittedCompanyName === makerCompanyName) return true;
        if (submittedEmail && makerEmail && submittedEmail === makerEmail) return true;
        return false;
      });

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
        const normalizeIdentity = (value) => String(value || '').trim();
        const submittedCode = normalizeIdentity(data.code || data.supplierCode);
        const submittedCompanyName = normalizeIdentity(data.companyName);
        const submittedEmail = normalizeIdentity(data.email).toLowerCase();
        const ourMaker = updatedMakers.find((m) => {
          const makerCode = normalizeIdentity(m.code || m.supplierCode);
          const makerCompanyName = normalizeIdentity(m.companyName);
          const makerEmail = normalizeIdentity(m.email).toLowerCase();
          if (submittedCode && makerCode && submittedCode === makerCode) return true;
          if (submittedCompanyName && makerCompanyName && submittedCompanyName === makerCompanyName) return true;
          if (submittedEmail && makerEmail && submittedEmail === makerEmail) return true;
          return false;
        }) || updatedMakers[updatedMakers.length - 1];
        // Simplified: just return the data + computed status
        return ourMaker;
      }
      return true;
    } catch (e) { alert("送信エラー: " + e.message); return false; }
  };

  const getMakerKeys = (makerContext) => {
    return [makerContext?.code, makerContext?.id]
      .filter(Boolean)
      .map((v) => String(v));
  };

  const isLogOwnedByMaker = (log, makerKeys) => {
    const candidates = [log?.makerCode, log?.makerId, log?.makerRefId]
      .filter(Boolean)
      .map((v) => String(v));
    return candidates.some((key) => makerKeys.includes(key));
  };

  const handleDeleteMakerScanLog = async (exhibitionId, logId, makerContext) => {
    const current = (exhibitionId ? exhibitions.find(e => e.id === exhibitionId) : null) || selectedExhibition;
    const currentMaker = makerContext || dashboardMaker;
    if (!current || !currentMaker) {
      return { success: false, message: '対象データが見つかりませんでした。' };
    }

    const makerKeys = getMakerKeys(currentMaker);
    const currentLogs = current.scanLogs || [];
    const targetLog = currentLogs.find((log) => log?.id === logId);
    if (!targetLog || !isLogOwnedByMaker(targetLog, makerKeys)) {
      return { success: false, message: '削除対象の履歴が見つかりませんでした。' };
    }

    const updatedLogs = currentLogs.filter(
      (log) => !(log?.id === logId && isLogOwnedByMaker(log, makerKeys))
    );
    try {
      await updateExhibitionData(current.id, 'scanLogs', updatedLogs);
      return { success: true, updatedLogs };
    } catch (e) {
      return { success: false, message: e?.message || '削除に失敗しました。' };
    }
  };

  const handleUpdateMakerScanLogNote = async (exhibitionId, logId, note, makerContext) => {
    const current = (exhibitionId ? exhibitions.find(e => e.id === exhibitionId) : null) || selectedExhibition;
    const currentMaker = makerContext || dashboardMaker;
    if (!current || !currentMaker) {
      return { success: false, message: '対象データが見つかりませんでした。' };
    }

    const makerKeys = getMakerKeys(currentMaker);
    let updated = false;
    const safeNote = String(note || '').slice(0, 2000);
    const updatedLogs = (current.scanLogs || []).map((log) => {
      if (log?.id !== logId) return log;
      if (!isLogOwnedByMaker(log, makerKeys)) return log;
      updated = true;
      return {
        ...log,
        note: safeNote,
        noteUpdatedAt: Date.now(),
        noteUpdatedBy: currentMaker?.code || currentMaker?.id || ''
      };
    });

    if (!updated) {
      return { success: false, message: '更新対象の履歴が見つかりませんでした。' };
    }

    try {
      await updateExhibitionData(current.id, 'scanLogs', updatedLogs);
      return { success: true, updatedLogs };
    } catch (e) {
      return { success: false, message: e?.message || 'メモ保存に失敗しました。' };
    }
  };

  const handleVisitorScan = async (code, exhibitionId, makerContext) => {
    const current = (exhibitionId ? exhibitions.find(e => e.id === exhibitionId) : null) || selectedExhibition;
    const currentMaker = makerContext || dashboardMaker;
    if (!current || !currentMaker) {
      return { success: false, type: 'error', message: 'スキャン対象の展示会情報を取得できませんでした。展示会を選択し直してください。' };
    }
    const makerKeys = getMakerKeys(currentMaker);
    const primaryMakerId = makerKeys[0] || '';

    console.log('[DEBUG] handleVisitorScan code:', code);

    // 1. Find Visitor (Handle JSON or Raw ID)
    let searchId = String(code || '').trim();
    try {
      const parsed = JSON.parse(searchId);
      if (typeof parsed === 'string' && parsed.trim()) {
        searchId = parsed.trim();
      } else if (parsed && parsed.id) {
        searchId = String(parsed.id).trim();
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
      [log?.makerCode, log?.makerId, log?.makerRefId]
        .filter(Boolean)
        .map((v) => String(v))
        .some((key) => makerKeys.includes(key)) &&
      log.visitorId === visitor.id
    );

    if (alreadyScanned) {
      return { success: false, type: 'warning', message: `${visitor.repName} 様は既にスキャン済みです`, visitor };
    }

    // 3. Create Scan Log (Save ALL visitor data)
    const newLog = {
      id: crypto.randomUUID(),
      makerId: primaryMakerId,
      makerCode: currentMaker.code || '',
      makerRefId: currentMaker.id || '',
      visitorId: visitor.id,
      scannedAt: Date.now(),
      note: '',
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

    // Find the maker in the exhibition (strict match only to prevent cross-company updates)
    const currentMakers = exhibition.makers || [];
    const normalizeIdentity = (value) => String(value || '').trim();
    const dashboardCode = normalizeIdentity(dashboardMaker.code);
    const dashboardId = normalizeIdentity(dashboardMaker.id);
    const makerIndex = currentMakers.findIndex((m) => {
      const makerCode = normalizeIdentity(m.code);
      const makerId = normalizeIdentity(m.id);
      if (dashboardCode && makerCode && makerCode === dashboardCode) return true;
      if (dashboardId && makerId && makerId === dashboardId) return true;
      return false;
    });

    if (makerIndex === -1) {
      console.error('Maker not found in exhibition');
      alert(`Error: maker data not found in exhibition.\ncompany: ${dashboardMaker.name || dashboardMaker.companyName || '-'}\ncode: ${dashboardCode || '-'}`);
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
      confirmedAt: newStatus === 'confirmed' ? Date.now() : (targetMaker.confirmedAt || null),
      respondedAt: Date.now(),
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
      await guardedUpdateDoc(exRef, { messages: updatedMessages }, 'markMessageAsRead');
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

  const navigateToManual = (tab = 'preparation') => {
    setManualInitialTab(tab);
    navigateTo('manual');
  };

  const switchMobileAdminMode = (mode) => {
    setMobileAdminMode(mode);
    setIsMobileMenuOpen(false);
    if (mode === 'simple') {
      setView('dashboard');
    }
  };

  const handleSimpleSelectExhibition = (exhibitionId) => {
    const target = (exhibitions || []).find(ex => ex.id === exhibitionId);
    if (!target) return;
    setSelectedExhibition(target);
    hasAutoSelectedSimpleRef.current = true;
  };

  const openSimpleAction = (actionKey) => {
    const target = selectedExhibition || closestExhibition || (exhibitions || [])[0];
    if (!target && actionKey !== 'manual') {
      alert('展示会データがありません。');
      return;
    }

    if (actionKey === 'manual') {
      navigateToManual('dayOf');
      return;
    }

    let tabToOpen = 'main';
    let entranceModeToOpen = 'dashboard';

    if (actionKey === 'qr') {
      tabToOpen = 'entrance';
      entranceModeToOpen = 'scanner';
    } else if (actionKey === 'visitors') {
      tabToOpen = 'entrance';
      entranceModeToOpen = 'dashboard';
    } else if (actionKey === 'schedule') {
      tabToOpen = 'schedule';
    } else if (actionKey === 'lectures') {
      tabToOpen = 'lectures';
    } else if (actionKey === 'files') {
      tabToOpen = 'files';
    } else if (actionKey === 'info') {
      tabToOpen = 'main';
    }

    setSelectedExhibition(target);
    setExhibitionTabs(prev => ({ ...prev, [target.id]: tabToOpen }));
    setExhibitionEntranceModes(prev => ({ ...prev, [target.id]: entranceModeToOpen }));
    navigateTo('detail');
  };

  useLayoutEffect(() => {
    if (mainRef.current) {
      // Restore scroll position for the new view (default to 0)
      const savedPos = scrollPositions.current[view] || 0;
      mainRef.current.scrollTop = savedPos;
    }
  }, [view]);

  const showSimpleHome = isSimpleMobileMode && view !== 'detail' && view !== 'manual';

  if (view === 'loading') return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="text-center"><Loader className="animate-spin text-blue-600 mb-2 mx-auto" size={40} /><p className="text-slate-500 font-bold">Connecting to Database...</p></div></div>;
  if (view === 'not_found') return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">プロジェクトが見つかりません。URLを確認してください。</div>;
  if (view === 'public_visitor_form') return <PublicVisitorView exhibition={selectedExhibition} onSubmit={(d) => handlePublicSubmit('visitor', d)} />;
  if (view === 'public_maker_form') return <PublicMakerView exhibition={selectedExhibition} onSubmit={(d) => handlePublicSubmit('maker', d)} />;
  if (view === 'maker_dashboard' && dashboardMaker) {
    return <MakerPortal maker={dashboardMaker} exhibitionName={selectedExhibition?.title} scanLogs={selectedExhibition?.scanLogs || []} onScan={handleVisitorScan} exhibitions={exhibitions || []} onResponseSubmit={handleMakerResponse} markMessageAsRead={markMessageAsRead} initialExhibition={selectedExhibition} onDeleteScanLog={handleDeleteMakerScanLog} onUpdateScanLogNote={handleUpdateMakerScanLogNote} />;
  }

  // Login Screen
  if (!isAuthenticated && view !== 'public_visitor_form' && view !== 'public_maker_form' && view !== 'maker_dashboard') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full mb-4">
              <BrandIcon size={24} />
              <span className="font-bold text-lg">{BRAND_NAME}</span>
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
      <div className="md:hidden bg-slate-900 text-white p-4 sticky top-0 z-50">
        {isSimpleMobileMode ? (
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <BrandIcon size={20} /> 展示会用簡易ビュー
            </h1>
            <button
              onClick={() => setView('dashboard')}
              className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold px-3 py-2 rounded-lg"
            >
              TOP
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}><Menu size={24} /></button>
            <h1 className="text-lg font-bold flex items-center gap-2"><BrandIcon size={20} /> {BRAND_NAME}</h1>
          </div>
        )}
      </div>

      {isMobileViewport && (
        <div className="md:hidden bg-white border-b border-slate-200 px-3 py-3 sticky top-[60px] z-40">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => switchMobileAdminMode('full')}
              className={`col-span-1 rounded-xl font-bold text-sm transition-all ${mobileAdminMode === 'full' ? 'bg-slate-900 text-white py-3' : 'bg-slate-100 text-slate-700 py-3 hover:bg-slate-200'}`}
            >
              管理画面
            </button>
            <button
              onClick={() => switchMobileAdminMode('simple')}
              className={`col-span-2 rounded-xl font-bold text-base transition-all ${mobileAdminMode === 'simple' ? 'bg-blue-600 text-white py-4 shadow-md' : 'bg-blue-100 text-blue-700 py-4 hover:bg-blue-200'}`}
            >
              展示会用簡易ビュー
            </button>
          </div>
        </div>
      )}

      {!isSimpleMobileMode && (
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <div onClick={() => { navigateTo('dashboard'); setIsMobileMenuOpen(false); }} className="cursor-pointer transition-opacity hover:opacity-80">
            <h1 className="text-2xl font-bold tracking-tighter text-blue-400 flex items-center gap-2"><BrandIcon size={28} /> {BRAND_NAME}</h1>
            <p className="text-xs text-slate-400 mt-1">Event Management System</p>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400"><X /></button>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => { navigateTo('dashboard'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}><LayoutDashboard size={20} /> ダッシュボード</button>
          <button onClick={() => { navigateTo('enterprise'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'enterprise' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}><Building2 size={20} /> 企業管理コンソール</button>
          <button onClick={() => { navigateToManual('preparation'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'manual' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}><BookOpen size={20} /> 運用マニュアル</button>
          <button onClick={() => { navigateTo('analysis'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'analysis' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}><BarChart3 size={20} /> 実績分析</button>

          <a
            href="https://scrape-kaientai-s.netlify.app/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsMobileMenuOpen(false)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-slate-800 text-slate-300"
          >
            <Skull size={20} /> Kaientai-S
          </a>

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
      )}

      {!isSimpleMobileMode && isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>}

      <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto bg-slate-50 relative">
        <div className="p-4 md:p-10 max-w-7xl mx-auto">
          {showSimpleHome ? (
            <MobileEventSimpleView
              exhibitions={exhibitions || []}
              selectedExhibition={selectedExhibition}
              onSelectExhibition={handleSimpleSelectExhibition}
              onOpenAction={openSimpleAction}
            />
          ) : (
            <>
              {view === 'dashboard' && <DashboardView exhibitions={exhibitions || []} onCreateClick={() => navigateTo('create')} onCardClick={(ex) => { setSelectedExhibition(ex); navigateTo('detail'); }} onDeleteClick={deleteExhibition} onScanClick={(ex) => { setSelectedExhibition(ex); setExhibitionTabs(prev => ({ ...prev, [ex.id]: 'entrance' })); setExhibitionEntranceModes(prev => ({ ...prev, [ex.id]: 'scanner' })); navigateTo('detail'); }} />}
              {view === 'create' && <CreateExhibitionForm data={newExhibition} setData={setNewExhibition} onCancel={() => navigateTo('dashboard')} onSubmit={handleCreate} />}
              {view === 'enterprise' && <EnterpriseConsole masterMakers={masterMakers} setMasterMakers={setMasterMakers} db={db} appId={appId} />}
              {view === 'manual' && <OperationalManualView initialTab={manualInitialTab} />}
              {view === 'analysis' && <PerformanceAnalysisView exhibitions={exhibitions || []} />}
              {view === 'detail' && selectedExhibition && <ExhibitionDetail exhibition={selectedExhibition} onBack={() => navigateTo('dashboard')} onNavigate={navigateTo} updateVisitorCount={updateVisitorCount} updateExhibitionData={updateExhibitionData} batchUpdateExhibitionData={batchUpdateExhibitionData} masterMakers={masterMakers} initialTab={exhibitionTabs[selectedExhibition.id]} onTabChange={(tab) => setExhibitionTabs(prev => ({ ...prev, [selectedExhibition.id]: tab }))} storage={storage} allExhibitions={exhibitions || []} allowedTabs={isSimpleMobileMode ? ['main', 'schedule', 'entrance', 'lectures', 'files'] : null} initialEntranceMode={exhibitionEntranceModes[selectedExhibition.id] || 'dashboard'} />}
            </>
          )}
        </div>
      </main>


    </div>
  );
}

export default App;

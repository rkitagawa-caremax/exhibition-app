import React from 'react';
import {
  CalendarClock,
  ClipboardList,
  Megaphone,
  Sparkles,
  Users
} from 'lucide-react';

const MARKETING_MANUAL_SECTIONS = [
  {
    id: 'planning',
    title: '企画部タスク',
    icon: Megaphone,
    accentClassName: 'from-sky-500 to-blue-600',
    tasks: [
      {
        title: '来場特典の企画',
        deadline: '開催の1か月前まで',
        impact: '大',
        note: '来場者が「これが欲しい！」と思ってもらえるような物を低コストで仕入れることが肝要。手配する場合チラシには必ず来場者特典ありの表記。用意する特典に比例して集客効果は変わる。'
      },
      {
        title: '案内チラシ作成',
        deadline: '開催の1か月前まで',
        impact: '大',
        note: '場所と日程がはっきりと分かるデザイン。何をする展示会なのかがパッと見て分かるデザインで進める。'
      },
      {
        title: '介援隊WEB掲示',
        deadline: '開催の1か月前まで',
        impact: '小',
        note: 'システムに依頼'
      },
      {
        title: '案内チラシ厚紙印刷',
        deadline: '開催の1か月前まで',
        impact: '中',
        note: 'プリントパックに依頼。枚数はメイン担当者に確認。'
      },
      {
        title: '得意先メール配信',
        deadline: '開催の1か月前まで',
        impact: '中',
        note: 'エリア内得意先にメール配信。どの範囲まで配信するかはメイン担当者に確認。'
      },
      {
        title: '得意先FAX配信',
        deadline: '開催の1か月前まで',
        impact: '中',
        note: 'エリア内得意先にFAX配信。どの範囲まで配信するかはメイン担当者に確認。'
      },
      {
        title: 'SNS広報',
        deadline: '開催の1か月前まで',
        impact: '小',
        note: 'インスタ・Xで展示会開催を周知。来場特典の情報も開示。一度だけでなく直前にももう一度投稿すると僅かだが集客効果あり。'
      },
      {
        title: '興味シンシンニュース',
        deadline: '開催直前のリリース版に掲載',
        impact: '中',
        note: '興味シンシンニュースの３枚目コラムに直近の開催展示会を掲示。事前登録用のQRもチラシに載せておくとより良いかも。'
      },
      {
        title: '出展メーカーへ共同集客依頼',
        deadline: '開催の3週間前まで',
        impact: '小',
        note: '出展メーカーへKaientaiXのチラシデータをダウンロードしてもらい、対象エリアに入った際は撒いてもらうよう依頼。販売店・施設へのビラ撒きを要請。'
      },
      {
        title: '施設DM配信',
        deadline: '開催の3週間前まで',
        impact: '大',
        note: 'Kaientai-Sで施設のリストを抽出（基本的には、居宅介護支援・地域包括支援センター・特別養護老人ホーム・介護老人保健施設・福祉用具貸与・訪問看護）して、それらのリストへポスティング広告。費用は大きいが集客効果は絶大'
      },
      {
        title: '施設FAX配信',
        deadline: '開催の2週間前まで',
        impact: '大',
        note: 'Kaientai-Sで施設のリストを抽出（基本的には全ジャンルのリスト）。３回ほど送るとしっかり担当者までチラシが行き渡る。アベレージ１万件の配信になるため、コストが４万ほど発生するが拡散力は絶大。紙ベースの介護業界とも相性◎'
      }
    ]
  },
  {
    id: 'sales',
    title: '営業部タスク',
    icon: Users,
    accentClassName: 'from-emerald-500 to-teal-600',
    tasks: [
      {
        title: '講演会の実施検討',
        deadline: '開催の2か月前まで',
        impact: '中',
        note: '講演会の企画を考え、Kaientai-Xに情報記入。それをもとに企画部でチラシを作成します。集客効果を高めるために、講演会のタイトル設計は最重要'
      },
      {
        title: '業界団体・地域ネットワークへの協力依頼',
        deadline: '開催の1か月前まで',
        impact: '大',
        note: '地域の介護の有力団体（ケアマネ協会や日福協など）に集客を行ってもらう（HP掲載や関連事業所にチラシの共有をしてもらう）。本当に協力してもらえれば、学校関係者やケアマネを大量集客できるポテンシャルあり。難易度高め。'
      },
      {
        title: '販売店チラシ配布（手配布）',
        deadline: '開催の1週間前まで',
        impact: '大',
        note: '販売店へ営業がチラシをもって足を使った集客を行う。販売店から施設へチラシを撒いてもらえれば、効果は比例関数的に伸びていく。'
      },
      {
        title: '得意先担当者に案内メール',
        deadline: '開催の1週間前まで',
        impact: '中',
        note: '個人メールは大体チェックする傾向があるので、見てもらえる可能性が高い。ただ集客人数の単純増加は見込みにくいかも'
      }
    ]
  }
];

const totalActionCount = MARKETING_MANUAL_SECTIONS.reduce(
  (sum, section) => sum + section.tasks.length,
  0
);

const impactToneMap = {
  大: 'border-rose-200 bg-rose-50 text-rose-700',
  中: 'border-amber-200 bg-amber-50 text-amber-700',
  小: 'border-sky-200 bg-sky-50 text-sky-700'
};

function SummaryCard({ icon: Icon, label, value, toneClassName }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${toneClassName}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, index, sectionTitle }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">
            {index + 1}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">{sectionTitle}</p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">{task.title}</h3>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
            <CalendarClock size={16} />
            実行期限: {task.deadline}
          </div>
          <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${impactToneMap[task.impact] || impactToneMap['中']}`}>
            <Sparkles size={16} />
            集客効果: {task.impact}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
        <p className="mb-2 font-semibold text-slate-900">補足メモ</p>
        <p>※{task.note}</p>
      </div>
    </article>
  );
}

export default function MarketingManualView() {
  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <header className="rounded-[2rem] border border-slate-200 bg-white px-6 py-7 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              <ClipboardList size={16} />
              実行アクション一覧
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">集客マニュアル</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              展示会の集客対応を、企画部と営業部の実行タスクに分けて整理しています。
              実行期限と集客効果を確認しながら、補足メモを参考に進めてください。
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
            実行期限は開催日を基準にした目安です。
            <br />
            効果の強弱と補足メモも合わせて確認してください。
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={ClipboardList}
          label="総アクション数"
          value={`${totalActionCount}件`}
          toneClassName="from-slate-700 to-slate-900"
        />
        <SummaryCard
          icon={Megaphone}
          label="企画部タスク"
          value={`${MARKETING_MANUAL_SECTIONS[0].tasks.length}件`}
          toneClassName="from-sky-500 to-blue-600"
        />
        <SummaryCard
          icon={Users}
          label="営業部タスク"
          value={`${MARKETING_MANUAL_SECTIONS[1].tasks.length}件`}
          toneClassName="from-emerald-500 to-teal-600"
        />
      </div>

      <div className="space-y-6">
        {MARKETING_MANUAL_SECTIONS.map((section) => {
          const SectionIcon = section.icon;

          return (
            <section key={section.id} className="space-y-4">
              <div className={`rounded-[2rem] bg-gradient-to-r ${section.accentClassName} px-6 py-5 text-white shadow-sm`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
                      <SectionIcon size={26} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/80">実行アクション一覧</p>
                      <h2 className="text-2xl font-bold">{section.title}</h2>
                    </div>
                  </div>
                  <div className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
                    {section.tasks.length}件
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                {section.tasks.map((task, index) => (
                  <TaskCard
                    key={`${section.id}-${task.title}`}
                    task={task}
                    index={index}
                    sectionTitle={section.title}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

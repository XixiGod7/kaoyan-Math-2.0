import {useState,useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {MessageCircle,NotebookPen,X} from 'lucide-react';
import {recordEnglish,englishApi} from '../utils/platformStorage';
import {sendChatCompletion} from '../utils/aiClient';
import {loadAiConfig} from '../utils/aiConfigStorage';
import {StudyTarget,selectStudyTarget} from './StudyTarget';
declare global { interface Window {createStudyImagePicker:(element:HTMLElement)=>{ids:()=>string[];busy:()=>boolean;clear:()=>void};studyImageIds?:string[];platformToast?:(message:string)=>void;} }
export function StudyBridge({context}:{context:string}) {
  const [toolsHost,setToolsHost]=useState<HTMLElement|null>(null);
  useEffect(()=>{
    const host=document.getElementById('english-study-tools');setToolsHost(host);
    const header=host?.closest('.subject-nav') as HTMLElement|null,shell=host?.closest('.english-shell') as HTMLElement|null;
    if(!header||!shell)return;
    const update=()=>shell.style.setProperty('--study-subject-nav-height',`${header.offsetHeight}px`);
    update();const observer=new ResizeObserver(update);observer.observe(header);
    return()=>{observer.disconnect();shell.style.removeProperty('--study-subject-nav-height');};
  },[]);
  const [target,setTarget]=useState<StudyTarget|null>(null),[panel,setPanel]=useState<'note'|'ai'|null>(null);
  useEffect(()=>{const shell=document.querySelector('.english-shell');shell?.classList.toggle('study-tools-open',!!panel);return()=>{shell?.classList.remove('study-tools-open');};},[panel]);
  const [question,setQuestion]=useState(''),[answer,setAnswer]=useState(''),[busy,setBusy]=useState(false);
  const [note,setNote]=useState(''),[message,setMessage]=useState(''),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false);
  const drafts=useRef<Record<string,string>>({}),imageBox=useRef<HTMLDivElement>(null);
  const sourceId=target?`${target.year}:${target.number}`:'';
  const currentSource=useRef(sourceId);currentSource.current=sourceId;
  useEffect(()=>{const picker=window.createStudyImagePicker(imageBox.current!);const box=imageBox.current!;const sync=()=>{window.studyImageIds=picker.ids();};box.addEventListener('study:images',sync);sync();return()=>{box.removeEventListener('study:images',sync);window.studyImageIds=[];};},[]);
  useEffect(()=>{
    const receive=(event:Event)=>{const next=(event as CustomEvent<StudyTarget>).detail;if(!/^\d{4}$/.test(next.year)||next.number<1||next.number>52)return;setTarget(next);if(next.open)setPanel('note');};
    const locate=(event:Event)=>{const el=(event.target as Element).closest?.('[data-study-year][data-study-question]');if(el)selectStudyTarget(el.getAttribute('data-study-year')!,Number(el.getAttribute('data-study-question')));};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setPanel(null);};
    window.addEventListener('english:target',receive);document.addEventListener('click',locate);document.addEventListener('focusin',locate);document.addEventListener('keydown',escape);
    return()=>{window.removeEventListener('english:target',receive);document.removeEventListener('click',locate);document.removeEventListener('focusin',locate);document.removeEventListener('keydown',escape);};
  },[]);
  useEffect(()=>{if(!/^(reading|translation|essay)/.test(context)&&!/^quiz\d{4}$/.test(context))setTarget(null);},[context]);
  useEffect(()=>{let active=true;setMessage('');setNote('');if(!sourceId){setLoading(false);return;}setLoading(true);englishApi(`/note?sourceId=${sourceId}`).then(v=>{if(active)setNote(drafts.current[sourceId]??v.text??'');}).catch(e=>{if(active)setMessage(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[sourceId]);
  async function ask(){if(busy)return;setBusy(true);try{setAnswer(await sendChatCompletion(loadAiConfig(),[{role:'system',content:`你是考研英语学习助手。当前学习位置：${sourceId || '英语学习'}。根据用户提供的题目或图片讲解，未提供题干时请先询问题目，不要编造。`},{role:'user',content:question || '请讲解图片里的英语问题。'}]));}catch(e){setAnswer((e as Error).message);}finally{setBusy(false);}}
  async function saveNote(){if(!sourceId||loading||saving)return;setSaving(true);const savedSource=sourceId,savedText=note;try{await recordEnglish('/note',{sourceId:savedSource,text:savedText});if(drafts.current[savedSource]===savedText)delete drafts.current[savedSource];if(currentSource.current===savedSource)setMessage('已保存到学习档案');}catch(e){if(currentSource.current===savedSource)setMessage((e as Error).message);}finally{setSaving(false);}}
  return <>
    {toolsHost && createPortal(<div className="studybar-actions"><button aria-expanded={panel==='note'} aria-controls="english-study-drawer" onClick={()=>setPanel(panel==='note'?null:'note')} disabled={!target} title={target?'记录当前题目的思考':'选中一道题后记录笔记'}><NotebookPen size={16}/>题目笔记</button><button aria-expanded={panel==='ai'} aria-controls="english-study-drawer" onClick={()=>setPanel(panel==='ai'?null:'ai')}><MessageCircle size={16}/>AI 助手</button></div>,toolsHost)}

    <aside id="english-study-drawer" role="dialog" aria-modal={false} className="english-study-drawer" hidden={!panel} aria-label="英语学习工具"><div className="study-drawer-heading"><div><small>{target?`${target.year} 年 · 第 ${target.number} 题`:'英语研习'}</small><h2>{panel==='note'?'题目笔记':'AI 学习助手'}</h2></div><button aria-label="关闭学习工具" onClick={()=>setPanel(null)}><X size={20}/></button></div>
      <div hidden={panel!=='note'}><p className="study-drawer-hint">自动跟随当前题目。点击试题或作答区域即可切换，未保存内容会暂存于此页。</p><label htmlFor="english-note">我的思考</label><textarea id="english-note" aria-label="英语学习笔记" disabled={loading||!target} value={note} onChange={e=>{setNote(e.target.value);drafts.current[sourceId]=e.target.value;setMessage('');}} maxLength={10000} placeholder={loading?'正在读取笔记…':'记录思路、易错点或值得记住的表达…'}/><div className="study-drawer-footer"><span>有效笔记 +2 积分 / 每日去重</span><button className="study-primary" disabled={loading||saving||!target} onClick={saveNote}>{saving?'保存中…':'保存笔记'}</button></div><p role="status">{message}</p></div>
      <div hidden={panel!=='ai'}><p className="study-drawer-hint">附件供本页答疑、翻译及作文批阅共用。支持最多 3 张图片，每张 5 MB。</p><div ref={imageBox}></div><label htmlFor="english-question">你的问题</label><textarea id="english-question" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={4000} placeholder="输入问题，也可以上传题目或作文图片…"/><button className="study-primary" onClick={ask} disabled={busy}>{busy?'正在答疑…':'发送给 AI'}</button><p className="english-ai-answer" role="status">{answer}</p></div>
    </aside>
  </>;
}
